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
  telefone?: string;
  email?: string;
  logoUrl?: string;
  descricao?: string;
}

export interface PTEnrichmentResult {
  fuzzyMatches: FuzzyMatch[];
  webScanData?: WebScanData;
  enrichmentSource: 'fuzzy' | 'webscan' | 'combined' | 'none';
}

export function fillEntityForm(
  form: UseFormReturn<any>,
  enrichmentData: PTEnrichmentResult,
  options: {
    overwriteExisting?: boolean;
    preferredSource?: 'fuzzy' | 'webscan';
  } = {}
): void {
  const { overwriteExisting = false, preferredSource = 'fuzzy' } = options;
  
  const setFieldIfEmpty = (field: string, value: string | undefined | null) => {
    if (!value) return;
    
    const currentValue = form.getValues(field);
    if (!overwriteExisting && currentValue) return;
    
    form.setValue(field, value, { shouldValidate: false, shouldDirty: true });
  };
  
  let dataSource: FuzzyMatch | WebScanData | null = null;
  
  if (preferredSource === 'fuzzy' && enrichmentData.fuzzyMatches.length > 0) {
    dataSource = enrichmentData.fuzzyMatches[0];
  } else if (preferredSource === 'webscan' && enrichmentData.webScanData) {
    dataSource = enrichmentData.webScanData;
  } else if (enrichmentData.fuzzyMatches.length > 0) {
    dataSource = enrichmentData.fuzzyMatches[0];
  } else if (enrichmentData.webScanData) {
    dataSource = enrichmentData.webScanData;
  }
  
  if (!dataSource) return;
  
  if ('candidate' in dataSource) {
    setFieldIfEmpty('nome', dataSource.candidate);
  } else {
    setFieldIfEmpty('nome', dataSource.nome);
  }
  
  setFieldIfEmpty('domain', dataSource.domain);
  setFieldIfEmpty('website', dataSource.website);
  setFieldIfEmpty('morada', dataSource.morada);
  setFieldIfEmpty('telefone', dataSource.telefone);
  setFieldIfEmpty('email', dataSource.email);
  setFieldIfEmpty('logoUrl', dataSource.logoUrl);
  
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
