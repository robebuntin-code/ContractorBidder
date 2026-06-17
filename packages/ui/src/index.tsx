/**
 * Cross-platform UI primitives shared by web (react-native-web) and mobile.
 * Kept intentionally tiny for the scaffold; expand with a real design system.
 */
import * as React from 'react';

export const theme = {
  colors: {
    primary: '#2563eb',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
    surface: '#ffffff',
    danger: '#dc2626',
  },
  radius: 10,
  spacing: (n: number) => n * 4,
} as const;

export interface JobCardData {
  title: string;
  workType: string;
  distanceKm?: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string;
}

/** Formats a job's budget range as a human-readable string. */
export function formatBudget(data: Pick<JobCardData, 'budgetMin' | 'budgetMax' | 'currency'>) {
  const cur = data.currency ?? 'USD';
  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(cents / 100);
  if (data.budgetMin != null && data.budgetMax != null) {
    return `${fmt(data.budgetMin)} – ${fmt(data.budgetMax)}`;
  }
  if (data.budgetMin != null) return `From ${fmt(data.budgetMin)}`;
  if (data.budgetMax != null) return `Up to ${fmt(data.budgetMax)}`;
  return 'Open budget';
}

export function formatDistance(km?: number) {
  if (km == null) return '';
  return `~${km.toFixed(1)} km away`;
}

export const uiVersion = '0.1.0';
