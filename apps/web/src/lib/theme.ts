export const SERVICE_TYPE_OPTIONS = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'hauling', label: 'Hauling' },
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'handyman', label: 'Handyman' },
  { value: 'other', label: 'Other' },
] as const;

export function formatRole(role: string): string {
  if (role === 'HOMEOWNER') return 'Homeowner';
  if (role === 'CONTRACTOR') return 'Contractor';
  if (role === 'ADMIN') return 'Admin';
  return role;
}

export function initials(first?: string, last?: string): string {
  const a = first?.trim().charAt(0) ?? '';
  const b = last?.trim().charAt(0) ?? '';
  return (a + b).toUpperCase() || '?';
}
