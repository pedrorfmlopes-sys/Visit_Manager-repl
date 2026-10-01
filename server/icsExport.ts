import { format } from "date-fns";

/**
 * Sanitize text for ICS format by escaping special characters
 */
function sanitizeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Fold ICS lines to comply with RFC 5545 (max 75 octets per line)
 * Uses byte-length instead of character count for proper UTF-8 handling
 */
function foldICSLine(line: string): string {
  // Quick check: if byte length is under limit, no folding needed
  if (Buffer.byteLength(line, 'utf-8') <= 75) {
    return line;
  }
  
  const folded: string[] = [];
  let currentLine = '';
  let currentByteLength = 0;
  
  // First line: max 75 octets
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const charByteLength = Buffer.byteLength(char, 'utf-8');
    
    if (currentByteLength + charByteLength > 75 && currentLine.length > 0) {
      // Current line would exceed limit, push it and start continuation
      folded.push(currentLine);
      currentLine = ' ' + char; // Continuation lines start with space
      currentByteLength = 1 + charByteLength; // Space (1 byte) + char
    } else {
      currentLine += char;
      currentByteLength += charByteLength;
    }
  }
  
  // Push remaining content
  if (currentLine.length > 0) {
    folded.push(currentLine);
  }
  
  return folded.join('\r\n');
}

/**
 * Format date for ICS (UTC format)
 */
function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generate a complete ICS file for a visit
 * RFC 5545 compliant
 */
export function generateVisitaICS(visita: any): string {
  const startDate = new Date(visita.dataVisita);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour default
  const now = new Date();

  // Get entidade
  const entidade = visita.entidade;
  const entidadeNome = entidade?.nome || 'Visita';
  const entidadeTipo = entidade?.tipoEntidade || '';

  // Build summary
  const summary = sanitizeICSText(`Visita — ${entidadeNome}`);

  // Build comprehensive description (use real newlines, then sanitize)
  const descriptionParts: string[] = [];
  
  // Visit notes
  if (visita.notas) {
    descriptionParts.push(`Notas: ${visita.notas}`);
    descriptionParts.push('');
  }

  // AI Summary
  if (visita.resumoIa) {
    descriptionParts.push(`Resumo IA: ${visita.resumoIa}`);
    descriptionParts.push('');
  }

  // Contact info
  if (visita.contacto) {
    descriptionParts.push('--- CONTACTO ---');
    descriptionParts.push(`Nome: ${visita.contacto.nome}`);
    if (visita.contacto.funcao) descriptionParts.push(`Função: ${visita.contacto.funcao}`);
    if (visita.contacto.email) descriptionParts.push(`Email: ${visita.contacto.email}`);
    if (visita.contacto.telemovel) descriptionParts.push(`Telemóvel: ${visita.contacto.telemovel}`);
    if (visita.contacto.telefone) descriptionParts.push(`Telefone: ${visita.contacto.telefone}`);
    descriptionParts.push('');
  }

  // Entidade info
  if (entidade) {
    descriptionParts.push('--- ENTIDADE ---');
    descriptionParts.push(`Nome: ${entidade.nome}`);
    if (entidadeTipo) descriptionParts.push(`Tipo: ${entidadeTipo}`);
    if (entidade.nif) descriptionParts.push(`NIF: ${entidade.nif}`);
    if (entidade.email) descriptionParts.push(`Email: ${entidade.email}`);
    if (entidade.telefone) descriptionParts.push(`Telefone: ${entidade.telefone}`);
    if (entidade.website) descriptionParts.push(`Website: ${entidade.website}`);
    descriptionParts.push('');
  }

  // GPS coordinates
  if (visita.latitude && visita.longitude) {
    descriptionParts.push('--- LOCALIZAÇÃO GPS ---');
    descriptionParts.push(`Coordenadas: ${visita.latitude}, ${visita.longitude}`);
    if (visita.locationAccuracy) {
      descriptionParts.push(`Precisão: ${visita.locationAccuracy}m`);
    }
    descriptionParts.push('');
  }

  // Deep link
  if (visita.deepLink) {
    descriptionParts.push('--- ACESSO DIRETO ---');
    descriptionParts.push(`Link: ${visita.deepLink}`);
  }

  // Join with real newlines, then sanitize (converts \n to \\n)
  const description = sanitizeICSText(descriptionParts.join('\n'));

  // Build location
  let location = '';
  if (entidade?.morada) {
    const locationParts = [entidade.morada];
    if (entidade.codigoPostal && entidade.cidade) {
      locationParts.push(`${entidade.codigoPostal} ${entidade.cidade}`);
    } else if (entidade.cidade) {
      locationParts.push(entidade.cidade);
    }
    location = sanitizeICSText(locationParts.join(', '));
  } else if (visita.latitude && visita.longitude) {
    // Fallback to GPS coordinates if no address
    location = sanitizeICSText(`${visita.latitude}, ${visita.longitude}`);
  }

  // Build URL (deep link)
  const url = visita.deepLink || '';

  // Build UID
  const uid = `visita-${visita.id}@divitek-visits.app`;

  // Build ICS content (RFC 5545 compliant with line folding)
  // Note: Folding must happen AFTER sanitization since escaping can increase byte count
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Divitek//Visit Manager//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    foldICSLine(`UID:${uid}`),
    foldICSLine(`DTSTAMP:${formatICSDate(now)}`),
    foldICSLine(`DTSTART:${formatICSDate(startDate)}`),
    foldICSLine(`DTEND:${formatICSDate(endDate)}`),
    foldICSLine(`SUMMARY:${summary}`), // summary is already sanitized
    foldICSLine(`DESCRIPTION:${description}`), // description is already sanitized
  ];

  // Add optional fields (already sanitized)
  if (location) {
    icsLines.push(foldICSLine(`LOCATION:${location}`));
  }

  if (url) {
    icsLines.push(foldICSLine(`URL:${url}`));
  }

  // Add status and sequence
  icsLines.push('STATUS:CONFIRMED');
  icsLines.push('SEQUENCE:0');

  // Add alarm (reminder 60 minutes before)
  icsLines.push('BEGIN:VALARM');
  icsLines.push('TRIGGER:-PT60M');
  icsLines.push('ACTION:DISPLAY');
  icsLines.push(foldICSLine('DESCRIPTION:Lembrete: Visita em 1 hora'));
  icsLines.push('END:VALARM');

  // Close event and calendar
  icsLines.push('END:VEVENT');
  icsLines.push('END:VCALENDAR');

  // Join with CRLF as per RFC 5545
  return icsLines.join('\r\n');
}

/**
 * Generate safe filename for ICS download
 */
export function generateVisitaICSFilename(visita: any): string {
  const entidade = visita.entidade;
  const entidadeNome = entidade?.nome || 'visita';
  const dataVisita = format(new Date(visita.dataVisita), 'yyyy-MM-dd');
  
  // Sanitize filename (remove special characters)
  const safeName = entidadeNome
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
  
  return `Visita-${safeName}-${dataVisita}.ics`;
}
