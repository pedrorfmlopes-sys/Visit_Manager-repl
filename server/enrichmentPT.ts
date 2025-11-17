import { getOpenAIClient } from "./openai";
import type { IStorage } from "./storage";

export interface PTEnrichmentInput {
  nome: string;
  userId: string;
  existingEntityId?: string;
  domain?: string;
  website?: string;
  email?: string;
}

export interface FuzzyMatch {
  candidate: string;
  score: number;
  id: string;
  type: 'entidade' | 'contacto';
  domain?: string;
  logoUrl?: string;
  website?: string;
  morada?: string;
  telefone?: string;
  email?: string;
}

export interface IANormalizerResult {
  variants: string[];
}

export interface PTWebScanResult {
  nomeOficial?: string;
  morada?: string;
  cidade?: string;
  codigoPostal?: string;
  telefone?: string;
  email?: string;
  website?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  descricao?: string;
  logoUrl?: string;
  nif?: string;
  industry?: string;
}

export interface PTEnrichmentResult {
  fuzzyMatches: FuzzyMatch[];
  webScanData?: PTWebScanResult;
  enrichmentSource: 'fuzzy' | 'webscan' | 'combined' | 'none';
}

function normalizeString(str: string): string {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaroWinkler(s1: string, s2: string): number {
  const m1 = s1.length;
  const m2 = s2.length;
  
  if (m1 === 0 && m2 === 0) return 1.0;
  if (m1 === 0 || m2 === 0) return 0.0;
  
  const matchDistance = Math.floor(Math.max(m1, m2) / 2) - 1;
  const s1Matches = new Array(m1).fill(false);
  const s2Matches = new Array(m2).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  for (let i = 0; i < m1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, m2);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0.0;
  
  let k = 0;
  for (let i = 0; i < m1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  
  const jaro = (matches / m1 + matches / m2 + (matches - transpositions / 2) / matches) / 3;
  
  let prefix = 0;
  for (let i = 0; i < Math.min(4, m1, m2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  
  return jaro + prefix * 0.1 * (1 - jaro);
}

function damerauLevenshtein(s1: string, s2: string): number {
  const m1 = s1.length;
  const m2 = s2.length;
  
  if (m1 === 0) return m2;
  if (m2 === 0) return m1;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= m2; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= m1; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= m2; i++) {
    for (let j = 1; j <= m1; j++) {
      const cost = s2[i - 1] === s1[j - 1] ? 0 : 1;
      
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
      
      if (i > 1 && j > 1 && s2[i - 1] === s1[j - 2] && s2[i - 2] === s1[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }
  
  const maxLen = Math.max(m1, m2);
  return 1 - matrix[m2][m1] / maxLen;
}

function metaphonePT(str: string): string {
  if (!str) return '';
  
  let cleaned = normalizeString(str);
  
  cleaned = cleaned
    .replace(/ph/g, 'f')
    .replace(/ç/g, 's')
    .replace(/lh/g, 'l')
    .replace(/nh/g, 'n')
    .replace(/ch/g, 'x')
    .replace(/ss/g, 's')
    .replace(/rr/g, 'r')
    .replace(/qu/g, 'k')
    .replace(/gu/g, 'g')
    .replace(/[aeiou]/g, '');
  
  return cleaned.substring(0, 8);
}

export function calculateFuzzyScore(input: string, candidate: string): number {
  const normalized1 = normalizeString(input);
  const normalized2 = normalizeString(candidate);
  
  const jaroScore = jaroWinkler(normalized1, normalized2);
  const levenScore = damerauLevenshtein(normalized1, normalized2);
  
  const metaphone1 = metaphonePT(input);
  const metaphone2 = metaphonePT(candidate);
  const metaphoneScore = metaphone1 === metaphone2 ? 1.0 : 0.0;
  
  const finalScore = 0.50 * jaroScore + 0.30 * levenScore + 0.20 * metaphoneScore;
  
  return finalScore;
}

export function calculateMaxFuzzyScore(variants: string[], candidate: string): number {
  let maxScore = 0;
  
  for (const variant of variants) {
    const score = calculateFuzzyScore(variant, candidate);
    maxScore = Math.max(maxScore, score);
  }
  
  return maxScore;
}

export async function generateIANormalizedVariants(nome: string): Promise<IANormalizerResult> {
  try {
    const openai = getOpenAIClient();
    
    const prompt = `Gera uma lista de variantes normalizadas para o nome de empresa portuguesa: "${nome}"

Regras de normalização:
- Remover pontuação
- Remover "Lda", "Limitada", "S.A.", "Unipessoal", etc.
- Substituir "e" por "&" e vice-versa
- Criar formas curtas (ex: "João Silva" → "J Silva", "J. Silva")
- Tudo em minúsculas
- Remover acentos
- Incluir 5-10 variantes

Devolve apenas um array JSON de strings:
["variante1", "variante2", ...]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'És um normalizador de nomes de empresas portuguesas. Devolve apenas arrays JSON válidos.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 300,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn('[IA-Normalizer] Empty response from OpenAI');
      return { variants: [normalizeString(nome)] };
    }

    const parsed = JSON.parse(content);
    const variants = parsed.variants || parsed.variantes || [];
    
    if (!Array.isArray(variants) || variants.length === 0) {
      return { variants: [normalizeString(nome)] };
    }

    return { variants };
  } catch (error) {
    console.error('[IA-Normalizer] Error:', error);
    return { variants: [normalizeString(nome)] };
  }
}

export async function ptWebScanFinder(nome: string): Promise<PTWebScanResult> {
  try {
    const openai = getOpenAIClient();
    
    const prompt = `Pesquisa online empresas portuguesas cujo nome se aproxime de "${nome}".

Devolve um objeto JSON com:
{
  "nomeOficial": "Nome oficial completo da empresa",
  "morada": "Apenas rua e número (ex: 'Rua da Indústria, 123' ou 'Av. da República, 45, 1º')",
  "cidade": "Apenas nome da cidade (ex: 'Porto', 'Lisboa')",
  "codigoPostal": "Código postal português no formato 1234-567",
  "email": "Email geral da empresa",
  "telefone": "Número de telefone",
  "website": "URL do website",
  "facebookUrl": "URL da página Facebook",
  "linkedinUrl": "URL da página LinkedIn",
  "instagramUrl": "URL do perfil Instagram",
  "descricao": "Breve descrição da empresa (1-2 frases)",
  "logoUrl": "URL pública do logótipo (se disponível)",
  "nif": "NIF se estiver publicamente disponível",
  "industry": "Setor/indústria (ex: Construção, Arquitetura)"
}

IMPORTANTE: Separa sempre a morada completa em três campos:
- "morada": Apenas rua e número (pode incluir andar/fração)
- "cidade": Apenas nome da cidade
- "codigoPostal": Código postal no formato XXXX-XXX

Apenas inclui campos que conseguires encontrar com certeza. Se não encontrares informação, devolve apenas os campos que tiveres.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'És um assistente de pesquisa de empresas portuguesas. Pesquisa online e devolve dados estruturados em JSON. Só inclui informação verificável.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 600,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn('[PT-WebScan] Empty response from OpenAI');
      return {};
    }

    const result = JSON.parse(content) as PTWebScanResult;
    
    console.log(`[PT-WebScan] Result for "${nome}":`, JSON.stringify(result, null, 2));
    
    if (result.website && !result.website.startsWith('http')) {
      result.website = `https://${result.website}`;
    }
    
    return result;
  } catch (error) {
    console.error('[PT-WebScan] Error:', error);
    return {};
  }
}

export async function ptIntelligentSearch(
  input: PTEnrichmentInput,
  storage: IStorage,
  userRole: 'admin' | 'agent'
): Promise<PTEnrichmentResult> {
  try {
    const { nome, userId, existingEntityId } = input;
    
    console.log(`[PT-Search] Starting intelligent search for: "${nome}"`);
    
    const normalized = normalizeString(nome);
    const variantsResult = await generateIANormalizedVariants(nome);
    
    const allVariants = [normalized, ...variantsResult.variants];
    
    console.log(`[PT-Search] Generated ${allVariants.length} normalized variants (including base)`);
    
    const allEntidades = await storage.getEntidades(userId, userRole);
    const allContactos = await storage.getContactos(userId, userRole);
    
    const fuzzyMatches: FuzzyMatch[] = [];
    
    for (const entidade of allEntidades) {
      if (existingEntityId && entidade.id === existingEntityId) {
        continue;
      }
      
      const score = calculateMaxFuzzyScore(allVariants, entidade.nome);
      
      if (score >= 0.60) {
        fuzzyMatches.push({
          candidate: entidade.nome,
          score,
          id: entidade.id,
          type: 'entidade',
          domain: entidade.domain || undefined,
          logoUrl: entidade.logoUrl || undefined,
          website: entidade.website || undefined,
          morada: entidade.morada || undefined,
          telefone: entidade.telefone || undefined,
          email: entidade.email || undefined,
        });
      }
    }
    
    for (const contacto of allContactos) {
      if (contacto.entidade?.nome) {
        const score = calculateMaxFuzzyScore(allVariants, contacto.entidade.nome);
        
        if (score >= 0.60) {
          const existing = fuzzyMatches.find(m => m.candidate === contacto.entidade!.nome);
          if (!existing) {
            fuzzyMatches.push({
              candidate: contacto.entidade.nome,
              score,
              id: contacto.id,
              type: 'contacto',
              email: contacto.email || undefined,
            });
          }
        }
      }
    }
    
    fuzzyMatches.sort((a, b) => b.score - a.score);
    
    console.log(`[PT-Search] Found ${fuzzyMatches.length} fuzzy matches`);
    
    const hasStrongMatches = fuzzyMatches.some(m => m.score >= 0.80);
    
    if (!hasStrongMatches) {
      console.log('[PT-Search] No strong fuzzy matches, calling PT-WebScan');
      const webScanData = await ptWebScanFinder(nome);
      
      return {
        fuzzyMatches,
        webScanData,
        enrichmentSource: fuzzyMatches.length > 0 ? 'combined' : 'webscan',
      };
    }
    
    return {
      fuzzyMatches,
      enrichmentSource: 'fuzzy',
    };
  } catch (error) {
    console.error('[PT-Search] Error:', error);
    return {
      fuzzyMatches: [],
      enrichmentSource: 'none',
    };
  }
}
