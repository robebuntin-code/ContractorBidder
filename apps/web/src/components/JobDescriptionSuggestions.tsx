'use client';

import type { WorkType } from '@contractor-bidder/types';
import { useJobDescriptionSuggestions } from '@/lib/useJobDescriptionSuggestions';

interface JobDescriptionSuggestionsProps {
  title: string;
  workType: WorkType;
  description: string;
  fetchToken: number;
  hidden: boolean;
  onAppend: (line: string) => void;
}

export function JobDescriptionSuggestions({
  title,
  workType,
  description,
  fetchToken,
  hidden,
  onAppend,
}: JobDescriptionSuggestionsProps) {
  const { visible, suggestions, loading } = useJobDescriptionSuggestions(
    title,
    workType,
    description,
    fetchToken,
    hidden,
  );

  if (!visible) return null;
  if (!loading && suggestions.length === 0) return null;

  return (
    <div className="description-suggestions" aria-live="polite">
      <p className="description-suggestions-title">
        {loading ? 'Checking your description…' : 'Consider adding these details'}
      </p>
      {!loading &&
        suggestions.map((item) => (
          <div key={item.topic} className="description-suggestion">
            <div>
              <p className="description-suggestion-topic">{item.topic}</p>
              <p className="description-suggestion-prompt">{item.prompt}</p>
            </div>
            <button
              type="button"
              className="description-suggestion-add"
              onClick={() => onAppend(`${item.topic}: `)}
            >
              Add line
            </button>
          </div>
        ))}
    </div>
  );
}
