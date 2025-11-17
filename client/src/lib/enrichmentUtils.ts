import type { UseFormReturn } from 'react-hook-form';

export interface FuzzyMatch {
  candidate: string;
  score: number;
  id: number;
  type: 'entidade' | 'contacto';
  domain?: string;
  logoUrl?: string;
  website?: string;
  morada?: string;
  telefone?: string;
  email?: string;
}

export interface WebScanData {
  nome?: string;
  domain?: string;
  website?: string;
  morada?: string;
  cidade?: string;
  codigoPostal?: string;
  telefone?: string;
  email?: string;
  logoUrl?: string;
  descricao?: string;
}

export interface GoogleSearchData {
  nome?: string;
  morada?: string;
  cidade?: string;
  codigoPostal?: string;
  telefone?: string;
  email?: string;
  website?: string;
  descricao?: string;
  confidence: number;
  sourceUrl: string;
}

export interface PTEnrichmentResult {
  fuzzyMatches: FuzzyMatch[];
  webScanData?: WebScanData;
  googleResults?: GoogleSearchData[];
  enrichmentSource: 'fuzzy' | 'webscan' | 'combined' | 'google' | 'disabled' | 'none';
}

export function fillEntityForm(
  form: UseFormReturn<any>,
  enrichmentData: PTEnrichmentResult,
  options: {
    overwriteExisting?: boolean;
    preferredSource?: 'fuzzy' | 'webscan' | 'google';
  } = {}
): void {
  const { overwriteExisting = false, preferredSource = 'fuzzy' } = options;
  
  const setFieldIfEmpty = (field: string, value: string | undefined | null) => {
    if (!value) return;
    
    const currentValue = form.getValues(field);
    if (!overwriteExisting && currentValue) return;
    
    form.setValue(field, value, { shouldValidate: false, shouldDirty: true });
  };
  
  let dataSource: FuzzyMatch | WebScanData | GoogleSearchData | null = null;
  
  if (preferredSource === 'fuzzy' && enrichmentData.fuzzyMatches.length > 0) {
    dataSource = enrichmentData.fuzzyMatches[0];
  } else if (preferredSource === 'webscan' && enrichmentData.webScanData) {
    dataSource = enrichmentData.webScanData;
  } else if (preferredSource === 'google' && enrichmentData.googleResults && enrichmentData.googleResults.length > 0) {
    dataSource = enrichmentData.googleResults[0];
  } else if (enrichmentData.fuzzyMatches.length > 0) {
    dataSource = enrichmentData.fuzzyMatches[0];
  } else if (enrichmentData.googleResults && enrichmentData.googleResults.length > 0) {
    dataSource = enrichmentData.googleResults[0];
  } else if (enrichmentData.webScanData) {
    dataSource = enrichmentData.webScanData;
  }
  
  if (!dataSource) return;
  
  if ('candidate' in dataSource) {
    setFieldIfEmpty('nome', dataSource.candidate);
  } else {
    setFieldIfEmpty('nome', dataSource.nome);
  }
  
  if ('domain' in dataSource) {
    setFieldIfEmpty('domain', dataSource.domain);
  }
  setFieldIfEmpty('website', dataSource.website);
  
  if ('cidade' in dataSource && dataSource.cidade) {
    setFieldIfEmpty('morada', dataSource.morada);
    setFieldIfEmpty('cidade', dataSource.cidade);
    setFieldIfEmpty('codigoPostal', dataSource.codigoPostal);
  } else if (dataSource.morada) {
    const parsedAddress = parsePortugueseAddress(dataSource.morada);
    setFieldIfEmpty('morada', parsedAddress.morada);
    setFieldIfEmpty('codigoPostal', parsedAddress.codigoPostal);
    setFieldIfEmpty('cidade', parsedAddress.cidade);
  }
  
  setFieldIfEmpty('telefone', dataSource.telefone);
  setFieldIfEmpty('email', dataSource.email);
  if ('logoUrl' in dataSource) {
    setFieldIfEmpty('logoUrl', dataSource.logoUrl);
  }
  
  if ('descricao' in dataSource && dataSource.descricao) {
    setFieldIfEmpty('descricao', dataSource.descricao);
  }
}

export function extractDomainFromEmail(email: string | undefined | null): string | undefined {
  if (!email) return undefined;
  
  const match = email.match(/@(.+)$/);
  return match ? match[1] : undefined;
}

export function extractDomainFromWebsite(website: string | undefined | null): string | undefined {
  if (!website) return undefined;
  
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace('www.', '');
  } catch {
    return undefined;
  }
}

export function normalizeDomain(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  
  const emailDomain = extractDomainFromEmail(input);
  if (emailDomain) return emailDomain;
  
  const websiteDomain = extractDomainFromWebsite(input);
  if (websiteDomain) return websiteDomain;
  
  return input.toLowerCase().trim();
}

export interface ParsedAddress {
  morada?: string;
  codigoPostal?: string;
  cidade?: string;
}

export function parsePortugueseAddress(fullAddress: string | undefined | null): ParsedAddress {
  if (!fullAddress) return {};
  
  const normalized = fullAddress.trim();
  
  const postalCodeRegex = /\b(\d{4}-\d{3})\b/;
  const match = normalized.match(postalCodeRegex);
  
  if (!match) {
    return { morada: normalized };
  }
  
  const codigoPostal = match[1];
  const postalCodeIndex = normalized.indexOf(codigoPostal);
  
  const beforePostalCode = normalized.substring(0, postalCodeIndex).trim();
  const afterPostalCode = normalized.substring(postalCodeIndex + codigoPostal.length).trim();
  
  let morada = beforePostalCode.replace(/,\s*$/, '').trim();
  
  let cidade = afterPostalCode
    .replace(/^,\s*/, '')
    .replace(/,?\s*Portugal\s*$/i, '')
    .trim();
  
  return {
    morada: morada || undefined,
    codigoPostal: codigoPostal || undefined,
    cidade: cidade || undefined,
  };
}
