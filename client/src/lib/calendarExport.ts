import { format } from "date-fns";
import type { VisitaWithRelations, Gabinete, Contacto } from "@shared/schema";

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
 * Generate an iCalendar (.ics) file for a visit
 * Allows users to add visits to their calendar apps
 */
export function generateICSFile(visita: VisitaWithRelations): string {
  const startDate = new Date(visita.dataVisita);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
  
  const formatICSDate = (date: Date): string => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };
  
  const title = sanitizeICSText(`Visita: ${visita.gabinete?.nome || 'Gabinete'}`);
  const location = sanitizeICSText(visita.gabinete?.morada || '');
  const description = sanitizeICSText([
    visita.notas || '',
    visita.contacto ? `Contacto: ${visita.contacto.nome}` : '',
    visita.gabinete?.telefone ? `Tel: ${visita.gabinete.telefone}` : '',
  ].filter(Boolean).join('\\n'));
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Visitas PWA//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `UID:visita-${visita.id}@visitaspwa.app`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  return icsContent;
}

/**
 * Sanitize filename for safe file download
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

/**
 * Download an .ics file for a visit
 */
export function downloadICS(visita: VisitaWithRelations): void {
  const icsContent = generateICSFile(visita);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const filename = sanitizeFilename(`visita-${visita.gabinete?.nome || visita.id}`);
  link.download = `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Generate an .ics file for scheduled next visit
 */
export function generateNextVisitICS(
  gabinete: Gabinete,
  contacto: Contacto | undefined,
  proximaVisita: Date
): string {
  const startDate = new Date(proximaVisita);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  
  const formatICSDate = (date: Date): string => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };
  
  const title = sanitizeICSText(`Próxima Visita: ${gabinete.nome}`);
  const location = sanitizeICSText(gabinete.morada || '');
  const description = sanitizeICSText([
    contacto ? `Contacto: ${contacto.nome}` : '',
    gabinete.telefone ? `Tel: ${gabinete.telefone}` : '',
  ].filter(Boolean).join('\\n'));
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Visitas PWA//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `UID:proxima-visita-${gabinete.id}-${startDate.getTime()}@visitaspwa.app`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  return icsContent;
}

/**
 * Download .ics file for next visit
 */
export function downloadNextVisitICS(
  gabinete: Gabinete,
  contacto: Contacto | undefined,
  proximaVisita: Date
): void {
  const icsContent = generateNextVisitICS(gabinete, contacto, proximaVisita);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const filename = sanitizeFilename(`proxima-visita-${gabinete.nome}`);
  link.download = `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
