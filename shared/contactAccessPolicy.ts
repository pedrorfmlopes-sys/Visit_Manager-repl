export type ContactKind = 'entity' | 'person';
export type ContactIdentity = { name?: unknown; email?: unknown; phone?: unknown; taxId?: unknown; countryCode?: unknown };

export function normalizedIdentity(input: ContactIdentity) {
  const country = String(input.countryCode || 'PT').trim().toUpperCase();
  let phone = String(input.phone || '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (country === 'PT' && phone.length === 9) phone = '351' + phone;
  let taxId = String(input.taxId || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (taxId.startsWith(country)) taxId = taxId.slice(country.length);
  return {
    name: String(input.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    phone: phone.length >= 7 ? phone : '',
    taxId: taxId ? country + ':' + taxId : '',
  };
}

// A name match only requests human review: it never merges people or grants access.
export function identityMatch(a: ContactIdentity, b: ContactIdentity): string[] {
  const left = normalizedIdentity(a), right = normalizedIdentity(b);
  return (['taxId', 'email', 'phone', 'name'] as const).filter(key => Boolean(left[key]) && left[key] === right[key]);
}

export function canReadContact(input: {
  companyId: string; userId: string; role: string; active: boolean;
  recordCompanyId: string; createdBy?: string | null;
  decision?: 'granted' | 'revoked' | null;
}) {
  if (!input.active || !input.companyId || !input.userId || input.companyId !== input.recordCompanyId) return false;
  if (input.role === 'admin') return true;
  if (input.role !== 'agent' || input.decision === 'revoked') return false;
  return input.decision === 'granted' || input.createdBy === input.userId;
}
