'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkType } from '@contractor-bidder/types';
import { api } from '@/lib/api';

export function useJobDescriptionSuggestions(
  title: string,
  workType: WorkType,
  description: string,
  fetchToken: number,
  hidden: boolean,
) {
  const [enabled, setEnabled] = useState(false);
  const [suggestions, setSuggestions] = useState<{ topic: string; prompt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    void api
      .getFlags()
      .then((flags) => setEnabled(flags.aiJobDescriptionEnabled))
      .catch(() => setEnabled(false));
  }, []);

  const fetchSuggestions = useCallback(() => {
    if (!enabled) return;

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setSuggestions([]);
      setHasFetched(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setHasFetched(true);

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
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [enabled, title, workType, description]);

  useEffect(() => {
    if (fetchToken < 1) return;
    fetchSuggestions();
  }, [fetchToken, fetchSuggestions]);

  const visible = enabled && hasFetched && !hidden;

  return { visible, suggestions, loading };
}
