import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api';
import { colors } from '../theme';

interface JobDescriptionSuggestionsProps {
  title: string;
  workType: string;
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
  if (!visible) return null;
  if (!loading && suggestions.length === 0) return null;

  return (
    <View style={local.wrap}>
      <Text style={local.title}>
        {loading ? 'Checking your description…' : 'Consider adding these details'}
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={local.spinner} />
      ) : (
        suggestions.map((item) => (
          <View key={item.topic} style={local.card}>
            <View style={local.cardBody}>
              <Text style={local.topic}>{item.topic}</Text>
              <Text style={local.prompt}>{item.prompt}</Text>
            </View>
            <TouchableOpacity
              style={local.addBtn}
              onPress={() => onAppend(`${item.topic}: `)}
            >
              <Text style={local.addBtnText}>Add line</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

const local = StyleSheet.create({
  wrap: {
    marginTop: 10,
    marginBottom: 4,
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  spinner: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
    gap: 10,
  },
  cardBody: {
    gap: 4,
  },
  topic: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  prompt: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  addBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
