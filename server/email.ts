// Email service - for now we'll use a simple console log approach
// In production, you would integrate with a service like Resend, SendGrid, etc.

export async function sendVisitEmail(data: {
  toEmail: string;
  gabineteNome: string;
  contactoNome?: string;
  dataVisita: Date;
  notas?: string;
  marcasEntregues?: string[];
  resumoIa?: string;
  linkVisita: string;
}) {
  // Format the email content
  const emailContent = `
Nova Visita Registada

Gabinete: ${data.gabineteNome}
${data.contactoNome ? `Contacto: ${data.contactoNome}` : ''}
Data: ${data.dataVisita.toLocaleDateString('pt-PT')}

${data.notas ? `Notas:\n${data.notas}\n\n` : ''}

${data.marcasEntregues && data.marcasEntregues.length > 0 ? `Marcas Entregues:\n${data.marcasEntregues.join(', ')}\n\n` : ''}

${data.resumoIa ? `Resumo IA:\n${data.resumoIa}\n\n` : ''}

Ver visita completa: ${data.linkVisita}
`;

  // In production environment, send actual email
  // For now, just log it
  console.log('=== EMAIL NOTIFICATION ===');
  console.log(`To: ${data.toEmail}`);
  console.log(`Subject: Nova Visita - ${data.gabineteNome}`);
  console.log(emailContent);
  console.log('=========================');
  
  // You can integrate with email services here:
  // await resend.emails.send({
  //   from: 'visitas@yourcompany.com',
  //   to: data.toEmail,
  //   subject: `Nova Visita - ${data.gabineteNome}`,
  //   text: emailContent,
  // });
}
