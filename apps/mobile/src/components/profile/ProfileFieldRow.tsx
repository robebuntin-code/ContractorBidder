import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { colors, styles as themeStyles } from '../../theme';
import { accountStyles as s } from './accountStyles';

function VerifiedBadge() {
  return (
    <View accessibilityLabel="Verified">
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
    </View>
  );
}

type ProfileFieldRowProps = {
  label: string;
  value: string;
  placeholder?: string;
  verified?: boolean;
  editable?: boolean;
  expanded?: boolean;
  actionLabel?: string | null;
  onPress?: () => void;
  children?: ReactNode;
};

export default function ProfileFieldRow({
  label,
  value,
  placeholder = 'Add',
  verified,
  editable = true,
  expanded,
  actionLabel = 'Edit',
  onPress,
  children,
}: ProfileFieldRowProps) {
  const display = value.trim() || placeholder;
  const isPlaceholder = !value.trim();

  const body = (
    <>
      <View style={s.fieldBody}>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={[s.fieldValue, isPlaceholder && s.fieldValuePlaceholder]} numberOfLines={3}>
          {display}
        </Text>
      </View>
      {verified ? <VerifiedBadge /> : null}
      {editable ? (
        actionLabel === null ? (
          <Ionicons name="chevron-forward" size={18} color="#a3a3a3" />
        ) : (
          <View style={themeStyles.editAction}>
            <Text style={themeStyles.editActionText}>{actionLabel}</Text>
          </View>
        )
      ) : null}
    </>
  );

  return (
    <View style={s.field}>
      {editable ? (
        <Pressable
          style={({ pressed }) => [s.fieldRow, pressed && { opacity: 0.7 }]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ expanded: !!expanded }}
          accessibilityLabel={`Edit ${label}`}
        >
          {body}
        </Pressable>
      ) : (
        <View style={s.fieldRow}>{body}</View>
      )}
      {expanded && children ? <View style={s.fieldEditor}>{children}</View> : null}
    </View>
  );
}
