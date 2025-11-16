export interface ParsedVCard {
  name?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  title?: string;
  email?: string;
  phone?: string;
  address?: string;
  note?: string;
}

export function parseVCard(vcardText: string): ParsedVCard | null {
  try {
    const lines = vcardText.split(/\r\n|\n|\r/).filter(line => line.trim());
    
    if (!lines.some(line => line.includes('BEGIN:VCARD'))) {
      return null;
    }

    const result: ParsedVCard = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).split(';')[0].trim();
      const value = line.substring(colonIndex + 1).trim();

      switch (key) {
        case 'FN':
          result.name = value;
          break;
        case 'N':
          const nameParts = value.split(';');
          result.lastName = nameParts[0] || '';
          result.firstName = nameParts[1] || '';
          if (!result.name && (result.firstName || result.lastName)) {
            result.name = `${result.firstName} ${result.lastName}`.trim();
          }
          break;
        case 'ORG':
          result.organization = value;
          break;
        case 'TITLE':
          result.title = value;
          break;
        case 'EMAIL':
          if (!result.email) {
            result.email = value.toLowerCase();
          }
          break;
        case 'TEL':
          if (!result.phone) {
            result.phone = normalizePhone(value);
          }
          break;
        case 'ADR':
          const addrParts = value.split(';').filter(p => p);
          result.address = addrParts.join(', ');
          break;
        case 'NOTE':
          result.note = value;
          break;
      }
    }

    return result;
  } catch (error) {
    console.error('Error parsing vCard:', error);
    return null;
  }
}

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[^0-9+]/g, '');
  
  if (!normalized.startsWith('+') && normalized.length === 9) {
    normalized = '+351' + normalized;
  }
  
  return normalized;
}

export function isVCard(text: string): boolean {
  return text.includes('BEGIN:VCARD') && text.includes('END:VCARD');
}
