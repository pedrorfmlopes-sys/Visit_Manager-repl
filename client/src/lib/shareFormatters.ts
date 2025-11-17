import type { ContactoWithRelations, EntidadeWithRelations, VisitaWithRelations } from "@shared/schema";
import { getDeepLink } from "@/components/ShareDialog";

/**
 * Format contact information for sharing
 */
export function formatContactForSharing(contacto: ContactoWithRelations): string {
  const lines: string[] = [];
  
  lines.push(`📇 ${contacto.nome}`);
  lines.push('');
  
  if (contacto.funcao) {
    lines.push(`💼 ${contacto.funcao}`);
  }
  
  if (contacto.entidade) {
    lines.push(`🏢 ${contacto.entidade.nome}`);
  }
  
  if (contacto.email) {
    lines.push(`📧 ${contacto.email}`);
  }
  
  if (contacto.telemovel) {
    lines.push(`📱 ${contacto.telemovel}`);
  }
  
  if (contacto.entidade?.website) {
    lines.push(`🌐 ${contacto.entidade.website}`);
  }
  
  if (contacto.entidade?.morada) {
    lines.push(`📍 ${contacto.entidade.morada}`);
    if (contacto.entidade.cidade || contacto.entidade.codigoPostal) {
      lines.push(`   ${contacto.entidade.codigoPostal || ''} ${contacto.entidade.cidade || ''}`.trim());
    }
  }
  
  // Social media links
  const socialLinks: string[] = [];
  if (contacto.entidade?.linkedinUrl) socialLinks.push(`LinkedIn: ${contacto.entidade.linkedinUrl}`);
  if (contacto.entidade?.facebookUrl) socialLinks.push(`Facebook: ${contacto.entidade.facebookUrl}`);
  if (contacto.entidade?.instagramUrl) socialLinks.push(`Instagram: ${contacto.entidade.instagramUrl}`);
  if (contacto.entidade?.xUrl) socialLinks.push(`X: ${contacto.entidade.xUrl}`);
  
  if (socialLinks.length > 0) {
    lines.push('');
    lines.push('🔗 Redes Sociais:');
    socialLinks.forEach(link => lines.push(`   ${link}`));
  }
  
  // Deep link
  lines.push('');
  lines.push(`🔗 Ver no sistema: ${getDeepLink('contact', contacto.id)}`);
  
  return lines.join('\n');
}

/**
 * Format entity information for sharing
 */
export function formatEntityForSharing(entidade: EntidadeWithRelations): string {
  const lines: string[] = [];
  
  lines.push(`🏢 ${entidade.nome}`);
  lines.push('');
  
  if (entidade.descricao) {
    lines.push(`📝 ${entidade.descricao}`);
    lines.push('');
  }
  
  if (entidade.industry) {
    lines.push(`🏭 ${entidade.industry}`);
  }
  
  if (entidade.website) {
    lines.push(`🌐 ${entidade.website}`);
  }
  
  if (entidade.email) {
    lines.push(`📧 ${entidade.email}`);
  }
  
  if (entidade.telefone) {
    lines.push(`📱 ${entidade.telefone}`);
  }
  
  if (entidade.morada) {
    lines.push(`📍 ${entidade.morada}`);
    if (entidade.cidade || entidade.codigoPostal) {
      lines.push(`   ${entidade.codigoPostal || ''} ${entidade.cidade || ''}`.trim());
    }
  }
  
  // Social media links
  const socialLinks: string[] = [];
  if (entidade.linkedinUrl) socialLinks.push(`LinkedIn: ${entidade.linkedinUrl}`);
  if (entidade.facebookUrl) socialLinks.push(`Facebook: ${entidade.facebookUrl}`);
  if (entidade.instagramUrl) socialLinks.push(`Instagram: ${entidade.instagramUrl}`);
  if (entidade.xUrl) socialLinks.push(`X: ${entidade.xUrl}`);
  
  if (socialLinks.length > 0) {
    lines.push('');
    lines.push('🔗 Redes Sociais:');
    socialLinks.forEach(link => lines.push(`   ${link}`));
  }
  
  // Statistics
  if (entidade.contactos && entidade.contactos.length > 0) {
    lines.push('');
    lines.push(`👥 ${entidade.contactos.length} contacto(s) registado(s)`);
  }
  
  if (entidade.visitas && entidade.visitas.length > 0) {
    lines.push(`📅 ${entidade.visitas.length} visita(s) realizada(s)`);
  }
  
  // Deep link
  lines.push('');
  lines.push(`🔗 Ver no sistema: ${getDeepLink('entity', entidade.id)}`);
  
  return lines.join('\n');
}

/**
 * Format visit information for sharing
 */
export function formatVisitForSharing(visita: VisitaWithRelations): string {
  const lines: string[] = [];
  
  lines.push(`📅 VISITA - ${new Date(visita.dataVisita).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })}`);
  lines.push('');
  
  if (visita.entidade) {
    lines.push(`🏢 Entidade: ${visita.entidade.nome}`);
  }
  
  if (visita.contacto) {
    lines.push(`👤 Contacto: ${visita.contacto.nome}`);
    if (visita.contacto.funcao) {
      lines.push(`   ${visita.contacto.funcao}`);
    }
  }
  
  lines.push('');
  
  // AI Summary
  if (visita.resumoIa) {
    lines.push('📝 RESUMO:');
    lines.push(visita.resumoIa);
    lines.push('');
  }
  
  // Written notes
  if (visita.notas) {
    lines.push('✍️ NOTAS:');
    lines.push(visita.notas);
    lines.push('');
  }
  
  // Audio transcription (if available and no AI summary)
  if (!visita.resumoIa && visita.transcricaoAudio) {
    lines.push('🎤 TRANSCRIÇÃO:');
    lines.push(visita.transcricaoAudio);
    lines.push('');
  }
  
  // Delivered brands
  if (visita.marcasEntregues && visita.marcasEntregues.length > 0) {
    lines.push('📦 MARCAS ENTREGUES:');
    visita.marcasEntregues.forEach(marca => {
      lines.push(`   • ${marca}`);
    });
    lines.push('');
  }
  
  // Next visit scheduled
  if (visita.proximaVisita) {
    lines.push(`📅 PRÓXIMA VISITA: ${new Date(visita.proximaVisita).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })}`);
    lines.push('');
  }
  
  // Deep link
  lines.push(`🔗 Ver detalhes: ${getDeepLink('visit', visita.id)}`);
  
  return lines.join('\n');
}

/**
 * Format visit summary for email subject
 */
export function formatVisitEmailSubject(visita: VisitaWithRelations): string {
  const date = new Date(visita.dataVisita).toLocaleDateString('pt-PT');
  const entity = visita.entidade?.nome || 'Visita';
  return `Resumo da Visita - ${entity} - ${date}`;
}
