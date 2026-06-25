import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api';
import { colors } from '../theme';

interface JobDescriptionSuggestionsProps {
  title: string;
  workType: string;
  description: string;
  onAppend: (line: string) => void;
}

export function JobDescriptionSuggestions({
  title,
  workType,
  description,
  onAppend,
}: JobDescriptionSuggestionsProps) {
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

  const canRequest = enabled && title.trim().length >= 3;

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

  if (!enabled) return null;

  return (
    <View style={local.wrap}>
      <TouchableOpacity
        style={[local.suggestBtn, (!canRequest || loading) && local.suggestBtnDisabled]}
        onPress={requestSuggestions}
        disabled={!canRequest || loading}
      >
        <Text style={local.suggestBtnText}>
          {loading ? 'Checking description…' : 'Get description recommendations'}
        </Text>
      </TouchableOpacity>

      {!canRequest ? (
        <Text style={local.hint}>Add a job title first to get recommendations.</Text>
      ) : null}

      {error ? <Text style={local.error}>{error}</Text> : null}

      {requested && !loading && !error && suggestions.length === 0 ? (
        <Text style={local.hint}>Your description already covers the key details contractors need.</Text>
      ) : null}

      {requested && (loading || suggestions.length > 0) ? (
        <View style={local.results}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={local.spinner} />
          ) : (
            <>
              <Text style={local.title}>Consider adding these details</Text>
              {suggestions.map((item) => (
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
              ))}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const local = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  suggestBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
  },
  suggestBtnDisabled: {
    opacity: 0.55,
  },
  suggestBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    color: '#b91c1c',
  },
  results: {
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
