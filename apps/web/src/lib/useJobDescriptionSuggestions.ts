'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkType } from '@contractor-bidder/types';
import { api } from '@/lib/api';

export function useJobDescriptionSuggestions(
  title: string,
  workType: WorkType,
  description: string,
) {
  const [enabled, setEnabled] = useState(false);
  const [suggestions, setSuggestions] = useState<{ topic: string; prompt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    void api
      .getFlags()
      .then((flags) => setEnabled(flags.aiJobDescriptionEnabled))
      .catch(() => setEnabled(false));
  }, []);

  const requestSuggestions = useCallback(() => {
    if (!enabled) return;

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setSuggestions([]);
      setRequested(true);
      setError('Enter a job title first (at least 3 characters).');
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setRequested(true);
    setError(null);

    void api
      .suggestJobDescription({
        title: trimmedTitle,
        workType,
        description: description.trim(),
      })
      .then((result) => {
        if (id !== requestId.current) return;
        setSuggestions(result.suggestions);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setSuggestions([]);
        setError('Could not load recommendations. Try again in a moment.');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [enabled, title, workType, description]);

  return {
    enabled,
    suggestions,
    loading,
    requested,
    error,
    requestSuggestions,
    canRequest: enabled && title.trim().length >= 3,
  };
}
