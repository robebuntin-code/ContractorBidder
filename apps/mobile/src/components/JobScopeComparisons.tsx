import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { resolveMediaUrl } from '../utils/mediaUrl';
import RemotePhoto from './RemotePhoto';

export interface JobPhotoComparison {
  before: string;
  after: string;
}

export interface ScopeComparisonDraft {
  id: string;
  beforeKey: string;
  afterKey: string;
  beforePreview: string;
  afterPreview: string;
}

interface JobScopeComparisonsProps {
  comparisons: JobPhotoComparison[];
  compact?: boolean;
}

export function JobScopeComparisons({ comparisons, compact = false }: JobScopeComparisonsProps) {
  if (!comparisons.length) return null;

  return (
    <View style={[local.wrap, compact && local.wrapCompact]}>
      {!compact ? <Text style={local.title}>Planned scope (before & after)</Text> : null}
      <Text style={local.hint}>
        These before/after images show the homeowner&apos;s vision for the finished work.
      </Text>
      {comparisons.map((pair, index) => (
        <View key={`${pair.before}-${index}`} style={[local.card, compact && local.cardCompact]}>
          <View style={local.row}>
            <View style={local.half}>
              <Text style={local.label}>Before</Text>
              <RemotePhoto
                uri={resolveMediaUrl(pair.before)}
                style={local.img}
                containerStyle={local.imgWrap}
                resizeMode="contain"
              />
            </View>
            <View style={local.half}>
              <Text style={local.label}>After (planned)</Text>
              <RemotePhoto
                uri={resolveMediaUrl(pair.after)}
                style={local.img}
                containerStyle={local.imgWrap}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ScopeComparisonDraftList({
  items,
  onRemove,
  compact = false,
}: {
  items: ScopeComparisonDraft[];
  onRemove: (id: string) => void;
  compact?: boolean;
}) {
  if (!items.length) return null;

  return (
    <View style={[local.wrap, compact && local.wrapCompact]}>
      {!compact ? (
        <>
          <Text style={local.title}>Scope photos added</Text>
          <Text style={local.hint}>Contractors will see these before/after pairs on your job.</Text>
        </>
      ) : null}
      {items.map((item) => (
        <View key={item.id} style={[local.card, compact && local.cardCompact]}>
          <View style={local.row}>
            <View style={local.half}>
              <Text style={local.label}>Before</Text>
              <RemotePhoto
                uri={resolveMediaUrl(item.beforeKey)}
                style={local.img}
                containerStyle={local.imgWrap}
                resizeMode="contain"
              />
            </View>
            <View style={local.half}>
              <Text style={local.label}>After (planned)</Text>
              <RemotePhoto
                uri={resolveMediaUrl(item.afterKey)}
                style={local.img}
                containerStyle={local.imgWrap}
                resizeMode="contain"
              />
            </View>
          </View>
          <TouchableOpacity onPress={() => onRemove(item.id)} style={local.removeBtn}>
            <Text style={local.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  wrap: { marginTop: 12, marginBottom: 8, gap: 8 },
  wrapCompact: { marginTop: 10, marginBottom: 4 },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
    gap: 8,
  },
  cardCompact: { padding: 8 },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1, gap: 4, minWidth: 0 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  img: { width: '100%', height: '100%' },
  imgWrap: {
    width: '100%',
    height: 140,
    maxHeight: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  removeText: { fontSize: 13, fontWeight: '600', color: colors.danger },
});
