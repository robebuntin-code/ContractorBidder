export interface JobPhotoComparisonRecord {
  before: string;
  after: string;
}

export function parsePhotoComparisons(raw: unknown): JobPhotoComparisonRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: JobPhotoComparisonRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const before = (item as { before?: unknown }).before;
    const after = (item as { after?: unknown }).after;
    if (typeof before === 'string' && typeof after === 'string' && before.trim() && after.trim()) {
      out.push({ before: before.trim(), after: after.trim() });
    }
  }
  return out;
}
