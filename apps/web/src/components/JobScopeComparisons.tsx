'use client';

import { resolveMediaUrl } from '@/lib/mediaUrl';
import type { JobPhotoComparison } from '@contractor-bidder/types';

interface JobScopeComparisonsProps {
  comparisons: JobPhotoComparison[];
  title?: string;
  compact?: boolean;
}

/** Before/after scope pairs shown to contractors on job detail and search. */
export function JobScopeComparisons({
  comparisons,
  title = 'Planned scope (before & after)',
  compact = false,
}: JobScopeComparisonsProps) {
  if (!comparisons.length) return null;

  return (
    <div className="scope-comparisons" style={{ marginTop: compact ? 0 : 12 }}>
      {!compact ? <p className="scope-comparisons-title">{title}</p> : null}
      <p className="field-hint" style={{ marginTop: compact ? 0 : 4, marginBottom: 10 }}>
        These before/after images show the homeowner&apos;s vision for the finished work.
      </p>
      <div className="scope-comparisons-list">
        {comparisons.map((pair, index) => (
          <div key={`${pair.before}-${index}`} className="scope-comparison-card">
            <div className="scope-comparison-half">
              <span className="scope-comparison-label">Before</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveMediaUrl(pair.before)} alt="Before" className="scope-comparison-img" />
            </div>
            <div className="scope-comparison-half">
              <span className="scope-comparison-label">After (planned)</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveMediaUrl(pair.after)} alt="After planned scope" className="scope-comparison-img" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ScopeComparisonDraft {
  id: string;
  beforeKey: string;
  afterKey: string;
  beforePreview: string;
  afterPreview: string;
}

interface ScopeComparisonDraftListProps {
  items: ScopeComparisonDraft[];
  onRemove: (id: string) => void;
}

export function ScopeComparisonDraftList({ items, onRemove }: ScopeComparisonDraftListProps) {
  if (!items.length) return null;

  return (
    <div className="scope-comparisons" style={{ marginTop: 12, marginBottom: 8 }}>
      <p className="scope-comparisons-title">Scope photos added</p>
      <p className="field-hint" style={{ marginTop: 4, marginBottom: 10 }}>
        Contractors will see these before/after pairs on your job posting.
      </p>
      <div className="scope-comparisons-list">
        {items.map((item) => (
          <div key={item.id} className="scope-comparison-card">
            <div className="scope-comparison-half">
              <span className="scope-comparison-label">Before</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.beforePreview} alt="Before" className="scope-comparison-img" />
            </div>
            <div className="scope-comparison-half">
              <span className="scope-comparison-label">After (planned)</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.afterPreview} alt="After planned" className="scope-comparison-img" />
            </div>
            <button type="button" className="scope-comparison-remove" onClick={() => onRemove(item.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
