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
  url?: string;
  domain?: string; // Extracted from email or URL
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
        case 'URL':
          if (!result.url) {
            result.url = value;
          }
          break;
      }
    }

    // Extract domain from email or URL
    result.domain = extractDomain(result.email, result.url);

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

export function extractDomain(email?: string, url?: string): string | undefined {
  // Try to extract domain from email first
  if (email && email.includes('@')) {
    const domain = email.split('@')[1].toLowerCase();
    // Filter out generic email providers
    const genericProviders = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'aol.com', 'protonmail.com'];
    if (!genericProviders.includes(domain)) {
      return domain;
    }
  }

  // Try to extract domain from URL
  if (url) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace(/^www\./, '').toLowerCase();
    } catch (e) {
      // Invalid URL, ignore
    }
  }

  return undefined;
}

export function isVCard(text: string): boolean {
  return text.includes('BEGIN:VCARD') && text.includes('END:VCARD');
}
