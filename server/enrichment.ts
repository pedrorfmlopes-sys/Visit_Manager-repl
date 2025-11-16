import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Clearbit autocomplete result type
export interface ClearbitCompany {
  name: string;
  domain: string;
  logo: string;
}

// Enriched entity data type
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

/**
 * Fetch company suggestions from Clearbit autocomplete API
 */
export async function fetchClearbitAutocomplete(query: string): Promise<ClearbitCompany[]> {
  try {
    const response = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      console.error('[Clearbit] API error:', response.status);
      return [];
    }
    
    const results = await response.json() as ClearbitCompany[];
    console.log('[Clearbit] Autocomplete results:', JSON.stringify(results, null, 2));
    if (results.length > 0) {
      console.log('[Clearbit] First result logo field:', results[0].logo);
    }
    return results;
  } catch (error) {
    console.error('[Clearbit] Autocomplete error:', error);
    return [];
  }
}

/**
 * Enrich entity data using OpenAI web search
 * Falls back to AI when Clearbit data is incomplete
 */
export async function enrichEntityWithAI(
  entityName: string,
  existingData: Partial<EnrichedEntityData> = {}
): Promise<EnrichedEntityData> {
  try {
    const prompt = `
Find detailed information about the company "${entityName}". 

Existing data we already have:
${JSON.stringify(existingData, null, 2)}

Please find and return ONLY the missing information in the following JSON format:
{
  "website": "company website URL",
  "email": "contact email",
  "telefone": "phone number in Portuguese format",
  "morada": "full address",
  "cidade": "city",
  "linkedinUrl": "LinkedIn profile URL",
  "facebookUrl": "Facebook page URL",
  "twitterUrl": "Twitter/X profile URL",
  "instagramUrl": "Instagram profile URL",
  "industry": "industry/sector",
  "descricao": "brief company description in Portuguese (2-3 sentences)"
}

IMPORTANT: 
- Only include fields where you found reliable information
- Return empty string for fields you cannot find
- Phone numbers should be in Portuguese format (e.g., +351 XXX XXX XXX)
- Descriptions should be in Portuguese
- If the company is Portuguese, provide Portuguese contact details
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini-search-preview",
      web_search_options: {
        search_context_size: "medium",
      },
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      console.error('[AI Enrichment] No content returned');
      return existingData;
    }

    const enrichedData = JSON.parse(content) as EnrichedEntityData;
    
    // Merge with existing data, preferring existing non-empty values
    const result: EnrichedEntityData = { ...existingData };
    
    for (const [key, value] of Object.entries(enrichedData)) {
      if (value && value !== "" && !result[key as keyof EnrichedEntityData]) {
        result[key as keyof EnrichedEntityData] = value as any;
      }
    }
    
    return result;
  } catch (error) {
    console.error('[AI Enrichment] Error:', error);
    return existingData;
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

/**
 * Combined enrichment: Try Clearbit first, then AI for missing fields
 */
export async function enrichEntity(
  name: string,
  clearbitDomain?: string
): Promise<EnrichedEntityData> {
  const enrichedData: EnrichedEntityData = {
    nome: name,
  };
  
  // If we have a Clearbit domain, use it
  if (clearbitDomain) {
    enrichedData.domain = clearbitDomain;
    enrichedData.website = `https://${clearbitDomain}`;
    enrichedData.logoUrl = `https://logo.clearbit.com/${clearbitDomain}`;
  }
  
  // Use AI to fill in missing fields
  const aiEnriched = await enrichEntityWithAI(name, enrichedData);
  
  return aiEnriched;
}
