import { getOpenAIClient } from "./openai";

export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
}

export interface GoogleSearchResponse {
  items?: GoogleSearchResult[];
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
}

export interface ExtractedCompanyData {
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

export async function searchGoogleCustom(query: string): Promise<GoogleSearchResponse> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const engineId = process.env.GOOGLE_CSE_ENGINE_ID;

  if (!apiKey || !engineId) {
    console.warn('[Google Search] API credentials not configured');
    return {};
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('cx', engineId);
    url.searchParams.append('q', query);
    url.searchParams.append('gl', 'pt');
    url.searchParams.append('lr', 'lang_pt');
    url.searchParams.append('num', '5');

    console.log(`[Google Search] Searching for: "${query}"`);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Google Search] API error ${response.status}:`, errorText);
      return {};
    }

    const data = await response.json() as GoogleSearchResponse;
    console.log(`[Google Search] Found ${data.items?.length || 0} results`);

    return data;
  } catch (error) {
    console.error('[Google Search] Error:', error);
    return {};
  }
}

export async function extractCompanyDataFromUrl(
  url: string,
  companyName: string
): Promise<ExtractedCompanyData | null> {
  try {
    console.log(`[Extract] Fetching data from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[Extract] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const cleanHtml = html.substring(0, 15000);

    const openai = getOpenAIClient();

    const prompt = `Analisa esta página web e extrai informação sobre a empresa "${companyName}".

HTML da página (primeiros 15000 chars):
${cleanHtml}

Devolve um objeto JSON com:
{
  "nome": "Nome oficial da empresa (se encontrares)",
  "morada": "Apenas rua e número (ex: 'Rua da Indústria, 123')",
  "cidade": "Apenas nome da cidade",
  "codigoPostal": "Código postal no formato 1234-567",
  "telefone": "Número de telefone português",
  "email": "Email de contacto",
  "website": "Website oficial",
  "descricao": "Breve descrição da empresa (1-2 frases)",
  "confidence": 0.0-1.0 (quão confiante estás nos dados extraídos)
}

IMPORTANTE:
- Só inclui campos que encontrares COM CERTEZA na página
- Se não encontrares, não inventes - deixa o campo vazio
- confidence deve ser baixo (0.3-0.5) se os dados forem duvidosos
- confidence deve ser alto (0.8-1.0) se os dados estiverem claramente visíveis
- Morada, cidade e código postal devem estar SEMPRE separados
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'És um extrator de dados de empresas. Devolves JSON estruturado. Só incluis informação que encontrares realmente na página.',
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
      return null;
    }

    const extracted = JSON.parse(content);

    console.log(`[Extract] Extracted data (confidence: ${extracted.confidence}):`, {
      nome: extracted.nome,
      cidade: extracted.cidade,
      hasPhone: !!extracted.telefone,
      hasEmail: !!extracted.email,
    });

    return {
      ...extracted,
      sourceUrl: url,
    };
  } catch (error) {
    console.error(`[Extract] Error extracting from ${url}:`, error);
    return null;
  }
}

export async function searchCompanyData(companyName: string): Promise<ExtractedCompanyData[]> {
  const searchResults = await searchGoogleCustom(`${companyName} Portugal empresa contato`);

  if (!searchResults.items || searchResults.items.length === 0) {
    return [];
  }

  const extractionPromises = searchResults.items.slice(0, 3).map(async (result) => {
    const extracted = await extractCompanyDataFromUrl(result.link, companyName);
    return extracted;
  });

  const results = await Promise.all(extractionPromises);
  const validResults = results.filter((r): r is ExtractedCompanyData => r !== null && r.confidence >= 0.5);

  validResults.sort((a, b) => b.confidence - a.confidence);

  console.log(`[Google Search] Returning ${validResults.length} high-confidence results`);

  return validResults;
}
