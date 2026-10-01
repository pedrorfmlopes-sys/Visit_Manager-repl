export const ISO_COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

export const VIES_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DE", "DK", "EE", "EL", "ES",
  "FI", "FR", "GR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL",
  "PL", "PT", "RO", "SE", "SI", "SK", "XI",
]);

const countryNameOverrides: Record<string, string> = {
  EL: "Grécia",
  XI: "Irlanda do Norte",
};

export function getCountryName(code: string, locale = "pt-PT"): string {
  const normalized = code.toUpperCase();
  if (countryNameOverrides[normalized]) return countryNameOverrides[normalized];

  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

export function normalizeTaxNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function stripCountryPrefix(value: string, countryCode: string): string {
  const normalized = normalizeTaxNumber(value);
  const prefix = countryCode.toUpperCase();
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

