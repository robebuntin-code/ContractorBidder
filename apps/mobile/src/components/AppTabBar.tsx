import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth';
import { colors } from '../theme';
import type { TabParamList } from '../navTypes';
import { useUnreadNotifications } from '../unreadNotifications';

type TabName = keyof TabParamList;

type TabMeta = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
};

const TAB_META: Record<TabName, TabMeta> = {
  Find: { label: 'Find', icon: 'search-outline', iconFocused: 'search' },
  MyJobs: { label: 'Jobs', icon: 'briefcase-outline', iconFocused: 'briefcase' },
  Activity: { label: 'Activity', icon: 'notifications-outline', iconFocused: 'notifications' },
  Profile: { label: 'Profile', icon: 'person-outline', iconFocused: 'person' },
};

export default function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useUnreadNotifications();
  const { logout } = useAuth();

  function confirmLogout() {
    Alert.alert('Log out?', 'You will need to sign in again to use DOJOBID.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const tabName = route.name as TabName;
          const meta = TAB_META[tabName];
          const focused = state.index === index;
          const color = focused ? colors.primary : colors.muted;
          const showBadge = tabName === 'Activity' && unreadCount > 0;
          const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? meta.label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Ionicons name={focused ? meta.iconFocused : meta.icon} size={22} color={color} />
                {showBadge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeLabel}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logoutTab, pressed && styles.logoutTabPressed]}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="log-out-outline" size={22} color={colors.muted} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            Log out
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#eff6ff',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.muted,
    letterSpacing: 0.15,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  logoutTab: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
    marginLeft: 2,
  },
  logoutTabPressed: {
    opacity: 0.75,
  },
});
