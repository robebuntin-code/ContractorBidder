import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, styles } from '../theme';

interface FeedListCardProps {
  badge: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  pressDisabled?: boolean;
  onAction: () => void;
  actionDisabled?: boolean;
  actionIcon: keyof typeof Ionicons.glyphMap;
  actionColor?: string;
  actionLabel: string;
}

export function FeedListCard({
  badge,
  title,
  subtitle,
  onPress,
  pressDisabled = false,
  onAction,
  actionDisabled = false,
  actionIcon,
  actionColor = colors.muted,
  actionLabel,
}: FeedListCardProps) {
  const body = (
    <>
      <Text style={styles.badge}>{badge}</Text>
      <Text style={styles.jobTitle}>{title}</Text>
      <Text style={styles.muted}>{subtitle}</Text>
    </>
  );

  return (
    <View style={[styles.card, local.row]}>
      {onPress ? (
        <TouchableOpacity
          style={local.body}
          disabled={pressDisabled}
          onPress={onPress}
          activeOpacity={0.7}
        >
          {body}
        </TouchableOpacity>
      ) : (
        <View style={local.body}>{body}</View>
      )}
      <TouchableOpacity
        style={local.action}
        onPress={onAction}
        disabled={actionDisabled}
        accessibilityLabel={actionLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name={actionIcon} size={22} color={actionDisabled ? colors.border : actionColor} />
      </TouchableOpacity>
    </View>
  );
}

const local = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  body: {
    flex: 1,
  },
  action: {
    paddingTop: 2,
  },
});
