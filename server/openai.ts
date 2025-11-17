import OpenAI from "openai";
import fs from "fs";

// Environment guards
if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️  OPENAI_API_KEY not configured. AI features will be disabled.");
}

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function transcribeAudio(audioFilePath: string): Promise<{ text: string }> {
  if (!openai) {
    console.warn("OpenAI not configured. Skipping audio transcription.");
    return { text: "[Transcrição automática indisponível - API key não configurada]" };
  }

  try {
    const audioReadStream = fs.createReadStream(audioFilePath);

    const transcription = await openai.audio.transcriptions.create({
      file: audioReadStream,
      model: "whisper-1",
    });

    return {
      text: transcription.text,
    };
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio");
  }
}

export interface BusinessCardData {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  organization?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
}

export async function extractBusinessCardData(imageDataUrl: string): Promise<BusinessCardData> {
  if (!openai) {
    console.warn("OpenAI not configured. Skipping business card extraction.");
    throw new Error("OpenAI API key not configured");
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting structured data from business cards. Extract all visible contact information accurately. Return empty string for missing fields.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all contact information from this business card image and return it in JSON format with these fields: fullName, firstName, lastName, jobTitle, organization, email, phone, website, address, linkedin, instagram, facebook, twitter. Use empty strings for missing fields."
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl // Accept full data URL with correct MIME type
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    const result = response.choices[0].message.content;
    const parsedData = JSON.parse(result || "{}");
    
    return {
      fullName: parsedData.fullName || parsedData.full_name || "",
      firstName: parsedData.firstName || parsedData.first_name || "",
      lastName: parsedData.lastName || parsedData.last_name || "",
      jobTitle: parsedData.jobTitle || parsedData.job_title || "",
      organization: parsedData.organization || parsedData.company || parsedData.company_name || "",
      email: parsedData.email || "",
      phone: parsedData.phone || parsedData.phone_number || "",
      website: parsedData.website || parsedData.url || "",
      address: parsedData.address || "",
      linkedin: parsedData.linkedin || "",
      instagram: parsedData.instagram || "",
      facebook: parsedData.facebook || "",
      twitter: parsedData.twitter || parsedData.x || ""
    };
  } catch (error) {
    console.error("Error extracting business card data:", error);
    throw new Error("Failed to extract business card data");
  }
}

export async function generateVisitSummary(data: {
  notas?: string;
  transcricaoAudio?: string;
  marcasEntregues?: string[];
  gabineteNome: string;
  contactoNome?: string;
}): Promise<string> {
  if (!openai) {
    console.warn("OpenAI not configured. Skipping AI summary generation.");
    return `## Resumo da Visita\n\nVisita ao gabinete ${data.gabineteNome}${data.contactoNome ? ` - Contacto: ${data.contactoNome}` : ''}.\n\n[Resumo automático indisponível - API key não configurada]`;
  }

  try {
    const prompt = `
Analisa esta visita comercial a um gabinete de arquitetura e cria um resumo profissional em português.

**Gabinete:** ${data.gabineteNome}
${data.contactoNome ? `**Contacto:** ${data.contactoNome}` : ''}

**Notas da visita:**
${data.notas || 'Sem notas escritas'}

${data.transcricaoAudio ? `**Transcrição do áudio:**\n${data.transcricaoAudio}` : ''}

${data.marcasEntregues && data.marcasEntregues.length > 0 ? `**Marcas entregues:**\n${data.marcasEntregues.join(', ')}` : ''}

Por favor, gera um resumo estruturado em JSON com os seguintes campos:
{
  "sintese": "Resumo geral da visita em 2-3 frases",
  "necessidades": ["lista de necessidades identificadas"],
  "oportunidades": ["lista de oportunidades comerciais"],
  "materiaisEntregues": ["lista de materiais/marcas entregues"],
  "acoesRealizar": ["lista de ações a realizar no follow-up"],
  "sugestaoProximaVisita": "Sugestão para a próxima visita"
}

Responde apenas com o JSON, sem explicações adicionais.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "És um assistente especializado em análise de visitas comerciais. Respondes sempre em português de Portugal e em formato JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = response.choices[0].message.content;
    
    // Parse and format the JSON response
    const parsedResult = JSON.parse(result || "{}");
    
    // Create a formatted text summary
    let summary = `## Síntese da Visita\n${parsedResult.sintese || 'Sem síntese disponível'}\n\n`;
    
    if (parsedResult.necessidades && parsedResult.necessidades.length > 0) {
      summary += `## Necessidades Identificadas\n${parsedResult.necessidades.map((n: string) => `• ${n}`).join('\n')}\n\n`;
    }
    
    if (parsedResult.oportunidades && parsedResult.oportunidades.length > 0) {
      summary += `## Oportunidades Comerciais\n${parsedResult.oportunidades.map((o: string) => `• ${o}`).join('\n')}\n\n`;
    }
    
    if (parsedResult.materiaisEntregues && parsedResult.materiaisEntregues.length > 0) {
      summary += `## Materiais Entregues\n${parsedResult.materiaisEntregues.map((m: string) => `• ${m}`).join('\n')}\n\n`;
    }
    
    if (parsedResult.acoesRealizar && parsedResult.acoesRealizar.length > 0) {
      summary += `## Ações a Realizar\n${parsedResult.acoesRealizar.map((a: string) => `• ${a}`).join('\n')}\n\n`;
    }
    
    if (parsedResult.sugestaoProximaVisita) {
      summary += `## Sugestão para Próxima Visita\n${parsedResult.sugestaoProximaVisita}`;
    }
    
    return summary;
  } catch (error) {
    console.error("Error generating visit summary:", error);
    throw new Error("Failed to generate visit summary");
  }
}
