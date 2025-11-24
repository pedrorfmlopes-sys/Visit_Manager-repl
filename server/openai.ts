import OpenAI from "openai";
import fs from "fs";

// Environment guards
if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️  OPENAI_API_KEY not configured. AI features will be disabled.");
}

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export function getOpenAIClient(): OpenAI {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }
  return openai;
}

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
  entidadeNome: string;
  contactoNome?: string;
}): Promise<string> {
  if (!openai) {
    console.warn("OpenAI not configured. Skipping AI summary generation.");
    return `## Resumo da Visita\n\nVisita à entidade ${data.entidadeNome}${data.contactoNome ? ` - Contacto: ${data.contactoNome}` : ''}.\n\n[Resumo automático indisponível - API key não configurada]`;
  }

  try {
    const prompt = `
Analisa esta visita comercial a uma entidade empresarial e cria um resumo profissional em português.

**Entidade:** ${data.entidadeNome}
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
      model: "gpt-4o-mini",
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

// FASE 14: Generate AI summary with key points and suggested tasks
export interface IAResumoOutput {
  resumoIA: string;
  pontosChaveIA: string[];
  tarefasSugeridasIA: Array<{
    titulo: string;
    descricao: string;
    prioridade: "baixa" | "normal" | "alta";
    prazo_sugerido_dias: number;
    tipo: "tarefa" | "agendamento";
  }>;
}

export async function generateAISummaryAndTasks(data: {
  entidadeNome: string;
  contactoNome?: string;
  notas?: string;
  audioTranscricoes: string[]; // Array of transcribed audio texts
  marcasIds?: string[];
  dataVisita: Date;
}): Promise<IAResumoOutput> {
  if (!openai) {
    console.warn("OpenAI not configured. Skipping AI summary generation.");
    return {
      resumoIA: "[Resumo automático indisponível - API key não configurada]",
      pontosChaveIA: [],
      tarefasSugeridasIA: [],
    };
  }

  try {
    // Concatenate all audio transcriptions
    const audioContent = data.audioTranscricoes && data.audioTranscricoes.length > 0
      ? `**Transcrições de Áudio:**\n${data.audioTranscricoes.join('\n\n')}`
      : "Sem transcrições de áudio";

    const prompt = `
Analisa esta visita comercial e gera um resumo profissional com pontos-chave e sugestões de follow-up em português PT-PT.

**Entidade:** ${data.entidadeNome}
${data.contactoNome ? `**Contacto:** ${data.contactoNome}` : ''}
**Data da visita:** ${data.dataVisita.toLocaleDateString('pt-PT')}

**Notas da visita:**
${data.notas || 'Sem notas escritas'}

${audioContent}

Por favor, gera um JSON estruturado com os seguintes campos:
{
  "resumo": "Resumo executivo profissional em 2-3 parágrafos, focando nos pontos principais comerciais",
  "pontos_chave": ["ponto 1", "ponto 2", "ponto 3", "ponto 4", "ponto 5"],
  "tarefas_sugeridas": [
    {
      "titulo": "Título da ação/reunião",
      "descricao": "Descrição detalhada",
      "prioridade": "alta|normal|baixa",
      "prazo_sugerido_dias": número de dias,
      "tipo": "tarefa ou agendamento"
    }
  ]
}

Instruções:
1. Tipo "tarefa": para ações internas (enviar email, preparar proposta, etc)
2. Tipo "agendamento": para reuniões/visitas futuras (próxima reunião, demonstração, etc)
3. Prioridades: "alta" urgente, "normal" standard, "baixa" informativo
4. Prazos em dias (ex: 3, 7, 14, 30)
5. Máx 2-3 sugestões
6. Responde APENAS com JSON válido
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "És um assistente especializado em análise de visitas comerciais e geração de tarefas de follow-up. Respondes sempre em português de Portugal e em formato JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result || "{}");

    return {
      resumoIA: parsed.resumo || "Sem resumo disponível",
      pontosChaveIA: parsed.pontos_chave || [],
      tarefasSugeridasIA: parsed.tarefas_sugeridas || [],
    };
  } catch (error) {
    console.error("Error generating AI summary and tasks:", error);
    throw new Error("Failed to generate AI summary and tasks");
  }
}

export async function generateEmailDraft(data: {
  templateType: string;
  tone: string;
  entidadeName?: string;
  contactoName?: string;
  contactoEmail?: string;
  visitData?: {
    dataVisita: Date;
    notas?: string;
    marcasEntregues?: string[];
    resumoIa?: string;
    tarefas?: Array<{ titulo: string; descricao?: string }>;
  };
  recentVisits?: Array<{
    dataVisita: Date;
    notas?: string;
  }>;
  userName?: string;
}): Promise<{ subject: string; body: string }> {
  if (!openai) {
    console.warn("OpenAI not configured. Returning default email template.");
    return {
      subject: "Assunto do email",
      body: "[Geração automática de email indisponível - API key não configurada]",
    };
  }

  try {
    const toneInstructions = {
      formal: "Tom extremamente formal e profissional, utilizando tratamento protocolar",
      neutro: "Tom profissional mas acessível, equilibrado entre formal e cordial",
      amigavel: "Tom cordial e próximo, mantendo profissionalismo",
    }[data.tone] || "Tom profissional";

    const visitInfo = data.visitData
      ? `**Data da visita:** ${data.visitData.dataVisita.toLocaleDateString('pt-PT')}\n**Notas:** ${data.visitData.notas || 'N/A'}`
      : "Sem dados de visita";

    const prompt = `
Gera um rascunho de email comercial seguindo estas especificações:

**Destinatário:** ${data.contactoName || 'N/A'}
**Entidade:** ${data.entidadeName || 'N/A'}
**Tipo de email:** ${data.templateType}
**Tom requerido:** ${toneInstructions}

**Contexto da visita:**
${visitInfo}

${data.visitData?.marcasEntregues ? `**Marcas entregues:** ${data.visitData.marcasEntregues.join(', ')}` : ''}

Por favor, gera um JSON com os seguintes campos:
{
  "assunto": "Assunto do email",
  "corpo": "Corpo do email em português PT-PT, bem estruturado com parágrafos"
}

Instruções:
1. Responde APENAS com JSON válido
2. Email profissional mas com o tom requerido
3. Sem cumprimentos genéricos - foco em conteúdo específico da visita
4. Máx 3-4 parágrafos
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "És um especialista em redação de emails comerciais. Respondes sempre em português de Portugal e em formato JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result || "{}");

    return {
      subject: parsed.assunto || "Seguimento de visita comercial",
      body: parsed.corpo || "Email gerado automaticamente",
    };
  } catch (error) {
    console.error("Error generating email draft:", error);
    throw new Error("Failed to generate email draft");
  }
}

// FASE 23: Generate Dashboard Insights (AI analysis for agent/admin)
export interface DashboardInsightsOutput {
  scope: 'agent' | 'admin';
  period: {
    from: string;
    to: string;
  };
  metrics: {
    visitasRealizadas: number;
    visitasAgendadas: number;
    tarefasCriadas: number;
    tarefasConcluidas: number;
    tarefasEmAtraso: number;
    clientesChave: Array<{ nome: string; visitCount: number }>;
    marcasMaisTrabalhadas: Array<{ marca: string; count: number }>;
  };
  insightsText: string;
}

export async function generateDashboardInsights(data: {
  scope: 'agent' | 'admin';
  userName?: string;
  metrics: {
    visitasRealizadas: number;
    visitasAgendadas: number;
    tarefasCriadas: number;
    tarefasConcluidas: number;
    tarefasEmAtraso: number;
    clientesChave: Array<{ nome: string; visitCount: number }>;
    marcasMaisTrabalhadas: Array<{ marca: string; count: number }>;
  };
}): Promise<string> {
  if (!openai) {
    console.warn("OpenAI not configured. Skipping dashboard insights generation.");
    return "[Insights IA indisponíveis - API key não configurada]";
  }

  try {
    const scopeLabel = data.scope === 'agent' ? 'do agente' : 'da empresa';
    const clientesText = data.metrics.clientesChave.length > 0
      ? `Clientes chave: ${data.metrics.clientesChave.map(c => `${c.nome} (${c.visitCount} visitas)`).join(', ')}`
      : 'Sem dados de clientes chave';
    
    const marcasText = data.metrics.marcasMaisTrabalhadas.length > 0
      ? `Marcas mais trabalhadas: ${data.metrics.marcasMaisTrabalhadas.map(m => `${m.marca} (${m.count}x)`).join(', ')}`
      : 'Sem dados de marcas';

    const prompt = `
Analisa estes dados de vendas comerciais e gera um insight executivo profissional em português PT-PT.

**Período:** Últimos 30 dias
**Scope:** ${scopeLabel}

**Métricas ${scopeLabel}:**
- Visitas realizadas: ${data.metrics.visitasRealizadas}
- Visitas agendadas (próximos 7 dias): ${data.metrics.visitasAgendadas}
- Tarefas criadas: ${data.metrics.tarefasCriadas}
- Tarefas concluídas: ${data.metrics.tarefasConcluidas}
- Tarefas em atraso: ${data.metrics.tarefasEmAtraso}
- ${clientesText}
- ${marcasText}

Por favor, gera um JSON estruturado com este campo:
{
  "insights": "Texto do insight em markdown (máx 500 palavras) com: 1 parágrafo sobre o que está a correr bem, 1 parágrafo sobre riscos/problemas, e uma lista de 3-5 recomendações concretas de ações. Escreve em tom profissional mas prático, dirigido a um vendedor comercial."
}

Instruções:
1. Tom profissional mas prático
2. Focado em ações concretas e melhorias mensuráveis
3. Responde APENAS com JSON válido
4. Gera conteúdo que seja útil para melhorar performance de vendas
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "És um analista de vendas especializado em fornecer insights acionáveis. Respondes sempre em português de Portugal e em formato JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = response.choices[0].message.content;
    const parsed = JSON.parse(result || "{}");

    return parsed.insights || "Insights indisponíveis neste momento";
  } catch (error) {
    console.error("Error generating dashboard insights:", error);
    throw new Error("Failed to generate dashboard insights");
  }
}
