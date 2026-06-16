export interface Outlet {
  code: string;        // shown in the WhatsApp receipt header, e.g. (MRT)
  name: string;        // full display name
  prefix: string;      // collection + localStorage prefix; '' = legacy MRT data
}

export const OUTLETS: Record<string, Outlet> = {
  MRT: { code: 'MRT', name: 'Million Precision Time', prefix: '' },
  JCI: { code: 'JCI', name: 'JCI', prefix: 'JCI_' },
};

// Map each login email (lowercase) to the outlets it can access.
// Kuna is the owner and sees both; Camy is MRT-only; Roger is JCI-only.
// TODO: replace the placeholder emails below with the real login emails.
export const USER_OUTLETS: Record<string, string[]> = {
  'kunacosta0702@gmail.com': ['MRT', 'JCI'],
  'camycvh@gmail.com': ['MRT'],
  'fuikenlau9891@gmail.com': ['JCI'],
};

export function outletsForEmail(email: string | null | undefined): string[] {
  if (!email) return [];
  return USER_OUTLETS[email.toLowerCase()] ?? [];
}
