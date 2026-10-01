import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}

function getTransporter() {
  if (transporter !== undefined) return transporter;

  const smtpUrl = process.env.SMTP_URL?.trim();
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!from || (!smtpUrl && !host)) {
    transporter = null;
    return transporter;
  }

  if (smtpUrl) {
    transporter = nodemailer.createTransport(smtpUrl, {
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    return transporter;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    ...(user && pass ? { auth: { user, pass } } : {}),
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return transporter;
}

export function isPasswordEmailConfigured() {
  return Boolean(
    process.env.SMTP_FROM?.trim() &&
      (process.env.SMTP_URL?.trim() || process.env.SMTP_HOST?.trim()),
  );
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}) {
  const smtp = getTransporter();
  if (!smtp) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email] Development password reset link: ${input.resetUrl}`);
      return;
    }
    throw new Error("SMTP is not configured");
  }

  const appName = process.env.APP_NAME?.trim() || "Visitas Comerciais";
  const safeAppName = escapeHtml(appName);
  const safeResetUrl = escapeHtml(input.resetUrl);
  const validityMinutes = 30;
  await smtp.sendMail({
    from: process.env.SMTP_FROM!,
    to: input.to,
    subject: `Recuperar palavra-passe - ${appName}`,
    text: [
      `Recebemos um pedido para alterar a palavra-passe de ${appName}.`,
      "",
      `Abra este link nos próximos ${validityMinutes} minutos:`,
      input.resetUrl,
      "",
      "Se não fez este pedido, pode ignorar este email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17211a">
        <h2>Recuperar palavra-passe</h2>
        <p>Recebemos um pedido para alterar a palavra-passe de ${safeAppName}.</p>
        <p>
          <a href="${safeResetUrl}" rel="noreferrer"
             style="display:inline-block;padding:12px 18px;background:#16251d;color:#fff;text-decoration:none;border-radius:8px">
            Definir nova palavra-passe
          </a>
        </p>
        <p>O link é válido durante ${validityMinutes} minutos e só pode ser usado uma vez.</p>
        <p>Se não fez este pedido, pode ignorar este email.</p>
      </div>
    `,
  });
}

export async function sendUserInvitationEmail(input: {
  to: string;
  companyName: string;
  inviteUrl: string;
}) {
  const smtp = getTransporter();
  if (!smtp) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email] Development invitation link: ${input.inviteUrl}`);
      return;
    }
    throw new Error("SMTP is not configured");
  }

  const appName = process.env.APP_NAME?.trim() || "Visitas Comerciais";
  const safeAppName = escapeHtml(appName);
  const safeCompanyName = escapeHtml(input.companyName);
  const safeInviteUrl = escapeHtml(input.inviteUrl);
  await smtp.sendMail({
    from: process.env.SMTP_FROM!,
    to: input.to,
    subject: `Convite para ${input.companyName} - ${appName}`,
    text: [
      `Foi convidado para a equipa ${input.companyName} em ${appName}.`,
      "",
      "Abra este link nos próximos 30 minutos para definir a palavra-passe:",
      input.inviteUrl,
      "",
      "Também pode entrar com Google ou Microsoft usando exatamente este email.",
      "Se não esperava este convite, pode ignorar esta mensagem.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17211a">
        <h2>Convite para ${safeCompanyName}</h2>
        <p>Foi convidado para esta equipa em ${safeAppName}.</p>
        <p>
          <a href="${safeInviteUrl}" rel="noreferrer"
             style="display:inline-block;padding:12px 18px;background:#16251d;color:#fff;text-decoration:none;border-radius:8px">
            Aceitar convite
          </a>
        </p>
        <p>O link é válido durante 30 minutos. Também pode entrar com Google ou Microsoft usando exatamente este email.</p>
        <p>Se não esperava este convite, pode ignorar esta mensagem.</p>
      </div>
    `,
  });
}
