import { z } from "zod";

// Email template types
export const emailTemplateTypes = [
  "followup_pos_visita",
  "agradecimento",
  "envio_catalogo",
  "resumo_interno",
  "acompanhamento",
] as const;

export type EmailTemplateType = typeof emailTemplateTypes[number];

// Email tone options
export const emailTones = ["formal", "neutro", "amigavel"] as const;
export type EmailTone = typeof emailTones[number];

// Template metadata
export interface EmailTemplate {
  id: EmailTemplateType;
  label: string;
  description: string;
  defaultSubject: string;
  defaultBody: string;
}

// All available templates
export const emailTemplates: EmailTemplate[] = [
  {
    id: "followup_pos_visita",
    label: "Follow-up pós-visita",
    description: "Email de acompanhamento após uma visita comercial",
    defaultSubject: "Seguimento da nossa reunião",
    defaultBody: `Exmo(a) Senhor(a) {contacto},

Foi um prazer reunir com V. Exa. no dia {data_visita} nas instalações {entidade}.

Conforme combinado, seguem as informações discutidas durante a nossa visita:

{notas_visita}

{marcas_entregues}

Fico ao dispor para qualquer esclarecimento adicional.

Com os melhores cumprimentos,
{usuario}`,
  },
  {
    id: "agradecimento",
    label: "Agradecimento",
    description: "Email de agradecimento pela disponibilidade",
    defaultSubject: "Agradecimento pela reunião",
    defaultBody: `Exmo(a) Senhor(a) {contacto},

Venho por este meio agradecer a disponibilidade demonstrada na nossa reunião do dia {data_visita}.

Foi muito importante conhecer as necessidades e projetos da {entidade}.

Estou certo de que poderemos desenvolver uma parceria profícua.

Fico ao dispor para qualquer questão.

Com os melhores cumprimentos,
{usuario}`,
  },
  {
    id: "envio_catalogo",
    label: "Envio de catálogo",
    description: "Email para envio de catálogos e materiais técnicos",
    defaultSubject: "Documentação técnica solicitada",
    defaultBody: `Exmo(a) Senhor(a) {contacto},

Conforme solicitado na nossa reunião do dia {data_visita}, segue em anexo a documentação técnica das marcas:

{marcas_entregues}

A documentação inclui fichas técnicas, especificações e informações de instalação.

Para qualquer esclarecimento adicional, estou ao dispor.

Com os melhores cumprimentos,
{usuario}`,
  },
  {
    id: "resumo_interno",
    label: "Resumo interno",
    description: "Relatório de visita para uso interno da equipa",
    defaultSubject: "Relatório de visita - {entidade}",
    defaultBody: `Relatório de Visita Comercial

Entidade: {entidade}
Contacto: {contacto}
Data: {data_visita}

Resumo da reunião:
{resumo_ia}

Notas adicionais:
{notas_visita}

Materiais entregues:
{marcas_entregues}

Próximos passos:
{tarefas}`,
  },
  {
    id: "acompanhamento",
    label: "Acompanhamento de cliente/obra",
    description: "Email de acompanhamento de projeto ou obra",
    defaultSubject: "Acompanhamento - {entidade}",
    defaultBody: `Exmo(a) Senhor(a) {contacto},

Venho acompanhar o desenvolvimento do projeto em curso na {entidade}.

Com base na nossa última reunião do dia {data_visita}, gostaria de saber:

- Estado atual do projeto
- Eventuais necessidades adicionais
- Datas previstas para próximas fases

{notas_visita}

Fico ao dispor para apoiar no que for necessário.

Com os melhores cumprimentos,
{usuario}`,
  },
];

// Request/Response schemas for API
export const generateEmailRequestSchema = z.object({
  templateType: z.enum(emailTemplateTypes),
  tone: z.enum(emailTones),
  visitaId: z.string().optional(),
  contactoId: z.string().optional(),
  entidadeId: z.string().optional(),
});

export type GenerateEmailRequest = z.infer<typeof generateEmailRequestSchema>;

export const generateEmailResponseSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type GenerateEmailResponse = z.infer<typeof generateEmailResponseSchema>;

// Helper function to get template by ID
export function getTemplate(id: EmailTemplateType): EmailTemplate {
  const template = emailTemplates.find((t) => t.id === id);
  if (!template) {
    throw new Error(`Template ${id} not found`);
  }
  return template;
}

// Helper function to get tone label
export function getToneLabel(tone: EmailTone): string {
  const labels: Record<EmailTone, string> = {
    formal: "Formal",
    neutro: "Neutro",
    amigavel: "Amigável",
  };
  return labels[tone];
}
