'use client';

import type { WorkType } from '@contractor-bidder/types';
import { useJobDescriptionSuggestions } from '@/lib/useJobDescriptionSuggestions';

interface JobDescriptionSuggestionsProps {
  title: string;
  workType: WorkType;
  description: string;
  onAppend: (line: string) => void;
}

export function JobDescriptionSuggestions({
  title,
  workType,
  description,
  onAppend,
}: JobDescriptionSuggestionsProps) {
  const {
    enabled,
    suggestions,
    loading,
    requested,
    error,
    requestSuggestions,
    canRequest,
  } = useJobDescriptionSuggestions(title, workType, description);

  if (!enabled) return null;

  return (
    <div className="description-suggestions-wrap">
      <button
        type="button"
        className="btn-outline description-suggest-btn"
        onClick={requestSuggestions}
        disabled={loading || !canRequest}
      >
        {loading ? 'Checking description…' : 'Get description recommendations'}
      </button>

      {!canRequest ? (
        <p className="field-hint description-suggest-hint">Add a job title first to get recommendations.</p>
      ) : null}

      {error ? <p className="description-suggest-error">{error}</p> : null}

      {requested && !loading && !error && suggestions.length === 0 ? (
        <p className="field-hint description-suggest-hint">
          Your description already covers the key details contractors need.
        </p>
      ) : null}

      {requested && (loading || suggestions.length > 0) ? (
        <div className="description-suggestions" aria-live="polite">
          {!loading ? (
            <p className="description-suggestions-title">Consider adding these details</p>
          ) : null}
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
      ) : null}
    </div>
  );
}
