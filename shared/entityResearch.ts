export interface EntityResearchSettings {
  internationalEnabled: boolean;
  defaultCountry: string;
  viesEnabled: boolean;
  odooNameSearchEnabled: boolean;
  postalLookupEnabled: boolean;
  aiFallbackEnabled: boolean;
  askBeforeAi: boolean;
}

export const DEFAULT_ENTITY_RESEARCH_SETTINGS: EntityResearchSettings = {
  internationalEnabled: false,
  defaultCountry: "PT",
  viesEnabled: true,
  odooNameSearchEnabled: false,
  postalLookupEnabled: true,
  aiFallbackEnabled: true,
  askBeforeAi: true,
};

export function resolveEntityResearchSettings(
  uiSettings: unknown,
): EntityResearchSettings {
  const configured =
    uiSettings && typeof uiSettings === "object"
      ? (uiSettings as any).entityResearch
      : undefined;

  return {
    ...DEFAULT_ENTITY_RESEARCH_SETTINGS,
    ...(configured && typeof configured === "object" ? configured : {}),
    defaultCountry:
      typeof configured?.defaultCountry === "string" &&
      /^[A-Z]{2}$/i.test(configured.defaultCountry)
        ? configured.defaultCountry.toUpperCase()
        : DEFAULT_ENTITY_RESEARCH_SETTINGS.defaultCountry,
  };
}
