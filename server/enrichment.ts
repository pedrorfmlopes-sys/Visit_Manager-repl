import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// TYPES
// ============================================

export interface ClearbitResult {
  name?: string;
  domain?: string;
  logo?: string;
  description?: string;
  industry?: string;
  url?: string;
}

export interface AIEnrichmentResult {
  industry?: string;
  description?: string;
  website?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
  phone?: string;
  address?: string;
}

export interface EnrichmentInput {
  name: string;
  domain?: string;
  website?: string;
  visionText?: string;
}

export interface EnrichmentResult {
  name?: string;
  domain?: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  industry?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
  telefone?: string;
  morada?: string;
  enrichmentSource: 'clearbit' | 'ai' | 'combined' | 'none';
}

// Legacy types for backwards compatibility
export interface ClearbitCompany {
  name: string;
  domain: string;
  logo: string;
}

export interface EnrichedEntityData {
  nome?: string;
  website?: string;
  domain?: string;
  email?: string;
  telefone?: string;
  morada?: string;
  cidade?: string;
  logoUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  industry?: string;
  descricao?: string;
}

// ============================================
// DEPRECATED CLEARBIT INTEGRATION
// Legacy functions kept for backwards compatibility only
// All enrichment now uses PT-Intelligent Search (enrichmentPT.ts)
// ============================================

/**
 * @deprecated Use PT-Intelligent Search instead (enrichmentPT.ts)
 * Legacy function kept for backwards compatibility
 */
async function queryClearbit(query: string): Promise<ClearbitResult | null> {
  console.log('[Enrichment] Clearbit integration deprecated - use PT-Intelligent Search');
  return null;
}

/**
 * @deprecated Use PT-Intelligent Search instead (enrichmentPT.ts)
 * Legacy function kept for backwards compatibility
 */
export async function fetchClearbitAutocomplete(query: string): Promise<ClearbitCompany[]> {
  console.log('[Enrichment] Clearbit autocomplete deprecated - use PT-Intelligent Search');
  return [];
}

// ============================================
// AI FALLBACK ENRICHMENT
// ============================================

/**
 * Use OpenAI to enrich company data when Clearbit fails or returns partial data
 */
async function enrichWithAI(input: EnrichmentInput): Promise<AIEnrichmentResult> {
  try {
    const prompt = buildEnrichmentPrompt(input);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a business data enrichment assistant. Extract and infer company information from the provided context. Return ONLY valid JSON with the specified fields. All fields are optional - only include data you are confident about.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
    });
    
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn('[AI Enrichment] Empty response from OpenAI');
      return {};
    }
    
    const result = JSON.parse(content) as AIEnrichmentResult;
    
    // Normalize URLs
    if (result.website) {
      result.website = normalizeUrl(result.website);
    }
    if (result.linkedinUrl) {
      result.linkedinUrl = normalizeUrl(result.linkedinUrl);
    }
    if (result.facebookUrl) {
      result.facebookUrl = normalizeUrl(result.facebookUrl);
    }
    if (result.instagramUrl) {
      result.instagramUrl = normalizeUrl(result.instagramUrl);
    }
    if (result.xUrl) {
      result.xUrl = normalizeUrl(result.xUrl);
    }
    
    return result;
  } catch (error) {
    console.error('[AI Enrichment] Error:', error);
    return {};
  }
}

/**
 * Build enrichment prompt for OpenAI
 */
function buildEnrichmentPrompt(input: EnrichmentInput): string {
  let prompt = `Enrich the following company information:\n\nCompany Name: ${input.name}\n`;
  
  if (input.domain) {
    prompt += `Domain: ${input.domain}\n`;
  }
  
  if (input.website) {
    prompt += `Website: ${input.website}\n`;
  }
  
  if (input.visionText) {
    prompt += `\nBusiness Card Text (from OCR):\n${input.visionText}\n`;
  }
  
  prompt += `\nReturn a JSON object with these optional fields:
{
  "industry": "Industry/sector (e.g., Architecture, Construction, Technology)",
  "description": "Brief company description (1-2 sentences)",
  "website": "Company website URL",
  "linkedinUrl": "LinkedIn company page URL",
  "facebookUrl": "Facebook page URL",
  "instagramUrl": "Instagram profile URL",
  "xUrl": "X/Twitter profile URL",
  "phone": "Phone number",
  "address": "Physical address"
}

Only include fields you can confidently extract or infer. Return empty object {} if you cannot determine any information.`;
  
  return prompt;
}

/**
 * @deprecated Use PT-Intelligent Search instead (enrichmentPT.ts)
 * Legacy function kept for backwards compatibility
 */
export async function enrichEntityWithAI(
  entityName: string,
  existingData: Partial<EnrichedEntityData> = {}
): Promise<EnrichedEntityData> {
  try {
    const input: EnrichmentInput = {
      name: entityName,
      domain: existingData.domain,
      website: existingData.website,
    };
    
    const aiResult = await enrichWithAI(input);
    
    // Map to legacy format
    const result: EnrichedEntityData = { ...existingData };
    
    if (aiResult.industry) result.industry = aiResult.industry;
    if (aiResult.description) result.descricao = aiResult.description;
    if (aiResult.website) result.website = aiResult.website;
    if (aiResult.linkedinUrl) result.linkedinUrl = aiResult.linkedinUrl;
    if (aiResult.facebookUrl) result.facebookUrl = aiResult.facebookUrl;
    if (aiResult.xUrl) result.twitterUrl = aiResult.xUrl;
    if (aiResult.instagramUrl) result.instagramUrl = aiResult.instagramUrl;
    if (aiResult.phone) result.telefone = aiResult.phone;
    if (aiResult.address) result.morada = aiResult.address;
    
    return result;
  } catch (error) {
    console.error('[AI Enrichment] Error:', error);
    return existingData;
  }
}

// ============================================
// DOMAIN UTILITIES
// ============================================

/**
 * Extract domain from email address
 */
export function extractDomainFromEmail(email: string): string | null {
  if (!email || typeof email !== 'string') return null;
  
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Check if domain is a personal email provider
 */
export function isPersonalEmailDomain(domain: string): boolean {
  const personalDomains = [
    'gmail.com',
    'outlook.com',
    'hotmail.com',
    'yahoo.com',
    'icloud.com',
    'live.com',
    'msn.com',
    'aol.com',
    'mail.com',
    'protonmail.com',
    'zoho.com',
  ];
  
  return personalDomains.includes(domain.toLowerCase());
}

/**
 * Normalize URL by ensuring it has a protocol
 */
function normalizeUrl(url: string): string {
  if (!url) return url;
  
  url = url.trim();
  
  // Already has protocol
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  
  // Add https://
  return `https://${url}`;
}

/**
 * Extract domain from website URL
 */
export function extractDomainFromUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    const normalized = normalizeUrl(url);
    const urlObj = new URL(normalized);
    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Validate Portuguese NIF (tax number) using mod 11 algorithm
 */
export function validateNIF(nif: string): { valid: boolean; formatted?: string; error?: string } {
  // Remove spaces and PT prefix
  let cleanNIF = nif.replace(/\s/g, '').replace(/^PT/i, '');
  
  // Check format
  if (cleanNIF.length !== 9 || !/^\d{9}$/.test(cleanNIF)) {
    return {
      valid: false,
      error: 'NIF deve ter 9 dígitos',
    };
  }
  
  // Calculate weighted sum of first 8 digits
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += (9 - i) * parseInt(cleanNIF[i]);
  }
  
  // Calculate mod 11
  const mod = sum % 11;
  
  // Determine expected check digit
  let expectedCheckDigit: number;
  if (mod === 0 || mod === 1) {
    expectedCheckDigit = 0;
  } else {
    expectedCheckDigit = 11 - mod;
  }
  
  // Compare with actual last digit
  const isValid = expectedCheckDigit === parseInt(cleanNIF[8]);
  
  if (!isValid) {
    return {
      valid: false,
      error: 'NIF inválido - dígito de controlo incorreto',
    };
  }
  
  // Format as XXX XXX XXX
  const formatted = cleanNIF.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  
  return {
    valid: true,
    formatted,
  };
}

// ============================================
// MAIN ENRICHMENT FUNCTION
// ============================================

/**
 * @deprecated Use PT-Intelligent Search instead (enrichmentPT.ts)
 * Legacy enrichment pipeline kept for backwards compatibility
 * Now uses AI-only enrichment (Clearbit removed)
 */
export async function enrichEntity(input: EnrichmentInput): Promise<EnrichmentResult>;
export async function enrichEntity(name: string, clearbitDomain?: string): Promise<EnrichedEntityData>;
export async function enrichEntity(
  inputOrName: EnrichmentInput | string,
  clearbitDomain?: string
): Promise<EnrichmentResult | EnrichedEntityData> {
  console.log('[Enrichment] Legacy enrichment deprecated - use PT-Intelligent Search (enrichmentPT.ts)');
  
  // Legacy signature support
  if (typeof inputOrName === 'string') {
    const enrichedData: EnrichedEntityData = {
      nome: inputOrName,
    };
    
    if (clearbitDomain) {
      enrichedData.domain = clearbitDomain;
      enrichedData.website = `https://${clearbitDomain}`;
    }
    
    const aiEnriched = await enrichEntityWithAI(inputOrName, enrichedData);
    return aiEnriched;
  }
  
  // New implementation - AI only
  const input = inputOrName;
  
  // Skip enrichment for personal emails
  if (input.domain && isPersonalEmailDomain(input.domain)) {
    return {
      enrichmentSource: 'none',
    };
  }
  
  // Use AI enrichment only
  const aiData = await enrichWithAI(input);
  
  // Merge results
  const domain = input.domain || extractDomainFromUrl(input.website || '');
  const website = input.website || aiData.website;
  
  const result: EnrichmentResult = {
    name: input.name,
    domain: domain || undefined,
    website: website || undefined,
    logoUrl: undefined,
    description: aiData.description,
    industry: aiData.industry,
    linkedinUrl: aiData.linkedinUrl,
    facebookUrl: aiData.facebookUrl,
    instagramUrl: aiData.instagramUrl,
    xUrl: aiData.xUrl,
    telefone: aiData.phone,
    morada: aiData.address,
    enrichmentSource: Object.keys(aiData).length > 0 ? 'ai' : 'none',
  };
  
  return result;
}

