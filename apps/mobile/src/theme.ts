import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#2563eb',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  bg: '#f8fafc',
  surface: '#ffffff',
  danger: '#dc2626',
  success: '#16a34a',
};

/** iOS system-style grays for native-looking buttons. */
export const ios = {
  buttonGray: '#E5E5EA',
  buttonGrayPressed: '#D1D1D6',
};

export function formatBudget(budgetMin?: number | null, budgetMax?: number | null, currency = 'USD') {
  const fmt = (c: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(c / 100);
  if (budgetMin != null && budgetMax != null) return `${fmt(budgetMin)} – ${fmt(budgetMax)}`;
  if (budgetMin != null) return `From ${fmt(budgetMin)}`;
  if (budgetMax != null) return `Up to ${fmt(budgetMax)}`;
  return 'Open budget';
}

const WORK_TYPE_LABELS: Record<string, string> = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  landscaping: 'Landscaping',
  hauling: 'Hauling',
  carpentry: 'Carpentry',
  handyman: 'Handyman',
  remodeling: 'Remodeling',
  painting: 'Painting',
  heating_ac: 'Heating/AC',
  other: 'Other',
};

export const SERVICE_TYPE_OPTIONS = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'hauling', label: 'Hauling' },
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'handyman', label: 'Handyman' },
  { value: 'remodeling', label: 'Remodeling' },
  { value: 'painting', label: 'Painting' },
  { value: 'heating_ac', label: 'Heating/AC' },
  { value: 'other', label: 'Other' },
] as const;

export function formatWorkType(value: string): string {
  return WORK_TYPE_LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatRole(role: string): string {
  if (role === 'HOMEOWNER') return 'Homeowner';
  if (role === 'CONTRACTOR') return 'Contractor';
  if (role === 'ADMIN') return 'Admin';
  return role;
}

export function formatDistanceMiles(distanceKm?: number | null): string | null {
  if (distanceKm == null) return null;
  const miles = distanceKm * 0.621371;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 12 },
  subtitle: { fontSize: 16, fontWeight: '600', color: colors.muted, marginBottom: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 44,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: ios.buttonGray,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 17 },
  buttonTextSecondary: { color: colors.text, fontWeight: '600', fontSize: 17 },
  editAction: {
    backgroundColor: ios.buttonGray,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActionPressed: {
    backgroundColor: ios.buttonGrayPressed,
  },
  editActionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  badge: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  jobTitle: { fontSize: 16, fontWeight: '700', marginVertical: 4, color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, marginTop: 8 },
});
