import assert from "node:assert/strict";
import test from "node:test";
import {
  getCountryName,
  normalizeTaxNumber,
  stripCountryPrefix,
} from "../../shared/countries";
import {
  DEFAULT_ENTITY_RESEARCH_SETTINGS,
  resolveEntityResearchSettings,
} from "../../shared/entityResearch";
import {
  parseGeoApiPostalResponse,
  parseNominatimResult,
  validateVatWithVies,
} from "../../server/entityResearch";

test("entity research settings use conservative defaults", () => {
  assert.deepEqual(resolveEntityResearchSettings(null), DEFAULT_ENTITY_RESEARCH_SETTINGS);
  assert.equal(resolveEntityResearchSettings({ entityResearch: { defaultCountry: "es" } }).defaultCountry, "ES");
  assert.equal(resolveEntityResearchSettings({ entityResearch: { defaultCountry: "Portugal" } }).defaultCountry, "PT");
});

test("tax numbers are normalized and country prefixes are removed", () => {
  assert.equal(normalizeTaxNumber(" pt 501-234-567 "), "PT501234567");
  assert.equal(stripCountryPrefix("PT 501 234 567", "PT"), "501234567");
  assert.match(getCountryName("PT"), /Portugal/i);
});

test("VIES rejects unsupported countries without making a network request", async () => {
  const result = await validateVatWithVies({ countryCode: "US", vatNumber: "US-123" });
  assert.equal(result.supported, false);
  assert.equal(result.valid, null);
  assert.equal(result.vatNumber, "123");
});

test("GeoAPI postal responses are reduced to safe address suggestions", () => {
  const result = parseGeoApiPostalResponse(
    {
      CP: "2495-300",
      Distrito: "Santarém",
      Concelho: "Ourém",
      Localidade: "Fátima",
      "Designação Postal": "FÁTIMA",
      centro: [39.62, -8.67],
      partes: [{ Artéria: "Rua Principal" }],
      pontos: [
        { rua: "Rua Principal", casa: "12" },
        { rua: "Rua Principal", casa: "2" },
        { rua: "Avenida Nova", casa: "1" },
      ],
    },
    "2495-300",
  );

  assert.equal(result.locality, "Fátima");
  assert.equal(result.latitude, 39.62);
  assert.equal(result.longitude, -8.67);
  assert.deepEqual(result.streets, [
    { street: "Avenida Nova", numbers: ["1"] },
    { street: "Rua Principal", numbers: ["2", "12"] },
  ]);
});

test("OpenStreetMap address results are reduced to form-safe fields", () => {
  assert.deepEqual(
    parseNominatimResult({
      display_name: "1, Avenida da Liberdade, Lisboa, Portugal",
      lat: "38.7201",
      lon: "-9.1451",
      address: {
        road: "Avenida da Liberdade",
        house_number: "1",
        city: "Lisboa",
        postcode: "1250-139",
      },
    }),
    {
      displayName: "1, Avenida da Liberdade, Lisboa, Portugal",
      street: "Avenida da Liberdade",
      houseNumber: "1",
      city: "Lisboa",
      postalCode: "1250-139",
      latitude: 38.7201,
      longitude: -9.1451,
      source: "openstreetmap",
    },
  );
  assert.equal(parseNominatimResult({ display_name: "Sem coordenadas" }), null);
});
