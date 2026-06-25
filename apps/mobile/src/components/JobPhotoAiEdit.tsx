import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { colors, ios } from '../theme';
import { resolveMediaUrl } from '../utils/mediaUrl';

export interface JobPhotoAiEditTarget {
  id: string;
  previewUri: string;
  fileUrl: string | null;
}

interface JobPhotoAiEditModalProps {
  visible: boolean;
  target: JobPhotoAiEditTarget | null;
  onClose: () => void;
  resolveSourceKey: (target: JobPhotoAiEditTarget) => Promise<string>;
  onApply: (
    photoId: string,
    result: {
      beforeKey: string;
      afterKey: string;
      beforePreview: string;
      afterPreview: string;
    },
  ) => void;
}

const EXAMPLE_PROMPT =
  'Remove the bushes in front of the house and add a flower bed with yellow flowers. Add a palm tree in the front right corner of the yard.';

export function JobPhotoAiEditModal({
  visible,
  target,
  onClose,
  resolveSourceKey,
  onApply,
}: JobPhotoAiEditModalProps) {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedPreview, setEditedPreview] = useState<string | null>(null);
  const [editedKey, setEditedKey] = useState<string | null>(null);
  const [beforeKey, setBeforeKey] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getFlags()
      .then((flags) => setEnabled(flags.aiPhotoEditEnabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (!visible || !target) {
      setPrompt('');
      setError(null);
      setEditedPreview(null);
      setEditedKey(null);
      setBeforeKey(null);
      setBusy(false);
    }
  }, [visible, target]);

  if (!enabled) return null;

  async function generate() {
    if (!target || prompt.trim().length < 10) {
      setError('Describe the changes you want (at least 10 characters).');
      return;
    }

    setBusy(true);
    setError(null);
    setEditedPreview(null);
    setEditedKey(null);
    setBeforeKey(null);

    try {
      const sourceKey = await resolveSourceKey(target);
      setBeforeKey(sourceKey);
      const result = await api.editJobPhoto(sourceKey, prompt.trim());
      const previewUri = resolveMediaUrl(result.key);
      setEditedKey(result.key);
      setEditedPreview(previewUri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate preview.');
    } finally {
      setBusy(false);
    }
  }

  function useEdited() {
    if (!target || !editedKey || !editedPreview || !beforeKey) return;
    onApply(target.id, {
      beforeKey,
      afterKey: editedKey,
      beforePreview: target.previewUri,
      afterPreview: editedPreview,
    });
    onClose();
  }

  return (
    <Modal visible={visible && !!target} animationType="slide" onRequestClose={onClose}>
      <View style={[local.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={local.header}>
          <Text style={local.title}>Show contractors the planned result</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={local.close}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={local.content} keyboardShouldPersistTaps="handled">
          <Text style={local.hint}>
            Describe how you want the work to look when it&apos;s done. We&apos;ll add a before/after pair
            to your job so contractors understand the scope.
          </Text>

          <View style={local.compareRow}>
            <View style={local.compareCol}>
              <Text style={local.caption}>Original</Text>
              {target ? (
                <Image source={{ uri: target.previewUri }} style={local.preview} resizeMode="cover" />
              ) : null}
            </View>
            <View style={local.compareCol}>
              <Text style={local.caption}>AI preview</Text>
              {editedPreview ? (
                <Image source={{ uri: editedPreview }} style={local.preview} resizeMode="cover" />
              ) : (
                <View style={local.previewPlaceholder}>
                  {busy ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={local.placeholderText}>Preview appears here</Text>
                  )}
                </View>
              )}
            </View>
          </View>

          <Text style={local.label}>What should change?</Text>
          <TextInput
            style={local.input}
            value={prompt}
            onChangeText={setPrompt}
            placeholder={EXAMPLE_PROMPT}
            placeholderTextColor={colors.muted}
            multiline
            editable={!busy}
          />

          {error ? <Text style={local.error}>{error}</Text> : null}
        </ScrollView>

        <View style={local.actions}>
          <Pressable style={[local.btn, local.btnSecondary]} onPress={onClose} disabled={busy}>
            <Text style={local.btnSecondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[local.btn, local.btnSecondary, busy && local.btnDisabled]}
            onPress={() => void generate()}
            disabled={busy}
          >
            <Text style={local.btnSecondaryText}>{busy ? 'Generating…' : editedPreview ? 'Regenerate' : 'Generate'}</Text>
          </Pressable>
          <Pressable
            style={[local.btn, local.btnPrimary, (!editedKey || busy) && local.btnDisabled]}
            onPress={useEdited}
            disabled={busy || !editedKey}
          >
            <Text style={local.btnPrimaryText}>Add before & after</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function JobPhotoAiEditButton({
  disabled,
  onPress,
}: {
  disabled?: boolean;
  onPress: () => void;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void api
      .getFlags()
      .then((flags) => setEnabled(flags.aiPhotoEditEnabled))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  return (
    <TouchableOpacity style={local.badge} onPress={onPress} disabled={disabled}>
      <Text style={local.badgeText}>Scope</Text>
    </TouchableOpacity>
  );
}

const local = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  close: { fontSize: 28, color: colors.muted, lineHeight: 28 },
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  hint: { fontSize: 14, lineHeight: 20, color: colors.muted },
  compareRow: { flexDirection: 'row', gap: 10 },
  compareCol: { flex: 1, gap: 6 },
  caption: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  preview: { width: '100%', height: 140, borderRadius: 10, backgroundColor: colors.border },
  previewPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  placeholderText: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ios ? 10 : 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: { fontSize: 13, color: '#b91c1c' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnSecondaryText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  badge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
