import { stripCountryPrefix, VIES_COUNTRY_CODES } from "@shared/countries";

const VIES_URL =
  "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number";
const GEO_API_BASE_URL = "https://geoapi.pt/cp";
const NOMINATIM_BASE_URL =
  process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const addressCache = new Map<
  string,
  { expiresAt: number; results: AddressSearchResult[] }
>();
const postalCache = new Map<
  string,
  { expiresAt: number; result: PostalLookupResult }
>();
let nextNominatimRequestAt = 0;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 12_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function cleanExternalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned && cleaned !== "---" ? cleaned.slice(0, 500) : null;
}

export interface VatValidationResult {
  supported: boolean;
  valid: boolean | null;
  countryCode: string;
  vatNumber: string;
  name: string | null;
  address: string | null;
  requestDate: string | null;
  source: "vies";
}

export async function validateVatWithVies(args: {
  countryCode: string;
  vatNumber: string;
}): Promise<VatValidationResult> {
  const requestedCountryCode = args.countryCode.toUpperCase();
  const countryCode = requestedCountryCode === "GR"
    ? "EL"
    : requestedCountryCode;
  const vatNumber = stripCountryPrefix(
    stripCountryPrefix(args.vatNumber, requestedCountryCode),
    countryCode,
  );

  if (!VIES_COUNTRY_CODES.has(countryCode)) {
    return {
      supported: false,
      valid: null,
      countryCode,
      vatNumber,
      name: null,
      address: null,
      requestDate: null,
      source: "vies",
    };
  }

  const response = await fetchWithTimeout(VIES_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "VisitManager/1.0",
    },
    body: JSON.stringify({ countryCode, vatNumber }),
  });

  if (!response.ok) {
    throw new Error(`VIES_UNAVAILABLE_${response.status}`);
  }

  const payload = (await response.json()) as any;
  return {
    supported: true,
    valid: payload.valid === true,
    countryCode,
    vatNumber,
    name: cleanExternalText(payload.name),
    address: cleanExternalText(payload.address),
    requestDate: cleanExternalText(payload.requestDate),
    source: "vies",
  };
}

export interface PostalStreetSuggestion {
  street: string;
  numbers: string[];
}

export interface PostalLookupResult {
  postalCode: string;
  locality: string | null;
  postalDesignation: string | null;
  municipality: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  streets: PostalStreetSuggestion[];
  source: "geoapi.pt" | "openstreetmap";
}

function normalizeStreetKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function parseGeoApiPostalResponse(
  payload: any,
  requestedPostalCode: string,
): PostalLookupResult {
  const streetMap = new Map<string, PostalStreetSuggestion>();
  for (const part of Array.isArray(payload?.partes) ? payload.partes : []) {
    const street = cleanExternalText(part?.["Artéria"] ?? part?.Arteria);
    if (!street) continue;
    streetMap.set(normalizeStreetKey(street), { street, numbers: [] });
  }

  for (const point of Array.isArray(payload?.pontos) ? payload.pontos : []) {
    const street = cleanExternalText(point?.rua);
    if (!street) continue;
    const key = normalizeStreetKey(street);
    const existing = streetMap.get(key) ?? { street, numbers: [] };
    const number = cleanExternalText(point?.casa);
    if (number && !existing.numbers.includes(number)) existing.numbers.push(number);
    streetMap.set(key, existing);
  }

  const center = Array.isArray(payload?.centro)
    ? payload.centro
    : Array.isArray(payload?.Centro)
      ? payload.Centro
      : [];

  return {
    postalCode: cleanExternalText(payload?.CP) ?? requestedPostalCode,
    locality: cleanExternalText(payload?.Localidade),
    postalDesignation: cleanExternalText(payload?.["Designação Postal"]),
    municipality: cleanExternalText(payload?.Concelho),
    district: cleanExternalText(payload?.Distrito),
    latitude: Number.isFinite(Number(center[0])) ? Number(center[0]) : null,
    longitude: Number.isFinite(Number(center[1])) ? Number(center[1]) : null,
    streets: Array.from(streetMap.values())
      .map((item) => ({
        ...item,
        numbers: item.numbers.sort((first, second) =>
          first.localeCompare(second, "pt", { numeric: true }),
        ).slice(0, 100),
      }))
      .sort((first, second) => first.street.localeCompare(second.street, "pt"))
      .slice(0, 50),
    source: "geoapi.pt",
  };
}

export async function lookupPortuguesePostalCode(
  postalCode: string,
): Promise<PostalLookupResult> {
  const normalized = postalCode.trim();
  if (!/^\d{4}-\d{3}$/.test(normalized)) {
    throw new Error("INVALID_PORTUGUESE_POSTAL_CODE");
  }

  const cached = postalCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let result: PostalLookupResult | null = null;
  try {
    const response = await fetchWithTimeout(
      `${GEO_API_BASE_URL}/${encodeURIComponent(normalized)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "VisitManager/1.0",
        },
      },
    );
    if (response.ok) {
      result = parseGeoApiPostalResponse(await response.json(), normalized);
    } else if (response.status !== 404 && response.status !== 429) {
      throw new Error(`POSTAL_LOOKUP_UNAVAILABLE_${response.status}`);
    }
  } catch (error) {
    console.warn("[EntityResearch] GeoAPI postal lookup failed, using fallback:", error);
  }

  if (!result) {
    const fallback = (
      await searchAddress({ query: `${normalized}, Portugal`, countryCode: "PT" })
    )[0];
    if (!fallback) throw new Error("POSTAL_CODE_NOT_FOUND");
    result = {
      postalCode: fallback.postalCode || normalized,
      locality: fallback.city,
      postalDesignation: fallback.city,
      municipality: fallback.city,
      district: null,
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      streets: [],
      source: "openstreetmap",
    };
  }

  postalCache.set(normalized, {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    result,
  });
  return result;
}

export interface AddressSearchResult {
  displayName: string;
  street: string | null;
  houseNumber: string | null;
  city: string | null;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  source: "openstreetmap";
}

export function parseNominatimResult(item: any): AddressSearchResult | null {
  const latitude = Number(item?.lat);
  const longitude = Number(item?.lon);
  const displayName = cleanExternalText(item?.display_name);
  if (!displayName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const address = item?.address ?? {};
  return {
    displayName,
    street: cleanExternalText(
      address.road ?? address.pedestrian ?? address.footway ?? address.square,
    ),
    houseNumber: cleanExternalText(address.house_number),
    city: cleanExternalText(
      address.city ?? address.town ?? address.village ?? address.municipality,
    ),
    postalCode: cleanExternalText(address.postcode),
    latitude,
    longitude,
    source: "openstreetmap",
  };
}

export async function searchAddress(args: {
  query: string;
  countryCode?: string;
}): Promise<AddressSearchResult[]> {
  const query = args.query.replace(/\s+/g, " ").trim().slice(0, 200);
  const countryCode = (args.countryCode || "PT").toLowerCase();
  if (query.length < 5 || !/^[a-z]{2}$/.test(countryCode)) {
    throw new Error("INVALID_ADDRESS_QUERY");
  }

  const cacheKey = `${countryCode}:${query.toLocaleLowerCase("pt-PT")}`;
  const cached = addressCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const now = Date.now();
  const waitMs = Math.max(0, nextNominatimRequestAt - now);
  nextNominatimRequestAt = Math.max(now, nextNominatimRequestAt) + 1_100;
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

  const url = new URL("/search", NOMINATIM_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", countryCode);
  url.searchParams.set("limit", "5");

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "pt-PT,pt;q=0.9",
      "User-Agent": "VisitManager/1.0 (user-triggered address search)",
    },
  });
  if (!response.ok) throw new Error(`ADDRESS_LOOKUP_UNAVAILABLE_${response.status}`);

  const payload = await response.json();
  const results = (Array.isArray(payload) ? payload : [])
    .map(parseNominatimResult)
    .filter((item): item is AddressSearchResult => item !== null);
  if (addressCache.size >= 500) {
    const oldestKey = addressCache.keys().next().value;
    if (oldestKey) addressCache.delete(oldestKey);
  }
  addressCache.set(cacheKey, {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    results,
  });
  return results;
}
