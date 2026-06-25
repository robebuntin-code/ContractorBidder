import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, SessionExpiredError, type NotificationItem } from '../api';
import { FeedListCard } from '../components/FeedListCard';
import { useUnreadNotifications } from '../unreadNotifications';
import { useRealtime } from '../realtime';
import { colors, styles } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActivityStackParamList } from '../navTypes';

const LABELS: Record<string, string> = {
  JOB_MATCH: 'New matching job',
  NEW_BID: 'New bid on your job',
  BID_SUBMITTED: 'Bid submitted',
  BID_ACCEPTED: 'Your bid was accepted',
  MESSAGE: 'New message',
  PAYMENT_REQUIRED: 'Payment required',
};

function notificationBody(item: NotificationItem): string {
  const message = item.data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  const title = item.data?.title;
  if (typeof title === 'string' && title.trim()) return title;
  return '';
}

export default function ActivityScreen({ navigation }: NativeStackScreenProps<ActivityStackParamList, 'Activity'>) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { refresh: refreshUnreadCount } = useUnreadNotifications();

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await api.notifications());
      await refreshUnreadCount();
    } catch (e) {
      if (e instanceof SessionExpiredError) return;
      setLoadError(e instanceof Error ? e.message : 'Could not load activity');
    }
  }, [refreshUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Prepend notifications as they arrive in realtime.
  useRealtime(undefined, {
    onNotification: () => {
      void load();
    },
  });

  async function markAllRead() {
    if (busy) return;
    setBusy(true);
    try {
      await api.markNotificationsRead();
      await load();
    } finally {
      setBusy(false);
    }
  }

  function confirmClearAll() {
    Alert.alert(
      'Clear activity?',
      'This removes all notifications from your activity feed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: () => void clearAll(),
        },
      ],
    );
  }

  async function clearAll() {
    if (busy) return;
    setBusy(true);
    try {
      await api.clearNotifications();
      setItems([]);
      await refreshUnreadCount();
    } catch {
      Alert.alert('Could not clear activity', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function clearOne(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.clearNotifications([id]);
      setItems((prev) => prev.filter((n) => n.id !== id));
      await refreshUnreadCount();
    } catch {
      Alert.alert('Could not clear entry', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const hasUnread = items.some((i) => !i.readAt);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Activity</Text>
            {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
            {items.length > 0 && (
              <View style={local.actionsRow}>
                {hasUnread ? (
                  <TouchableOpacity onPress={() => void markAllRead()} disabled={busy}>
                    <Text style={[local.actionText, busy && local.actionDisabled]}>Mark all read</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={confirmClearAll} disabled={busy}>
                  <Text style={[local.clearText, busy && local.actionDisabled]}>Clear all</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const jobId = item.data?.jobId as string | undefined;
          const body = notificationBody(item);
          return (
            <FeedListCard
              badge={LABELS[item.type] ?? item.type}
              title={body ? body : (LABELS[item.type] ?? item.type)}
              subtitle={new Date(item.createdAt).toLocaleString()}
              onPress={jobId ? () => navigation.navigate('JobDetail', { jobId }) : undefined}
              pressDisabled={!jobId || busy}
              onAction={() => void clearOne(item.id)}
              actionDisabled={busy}
              actionIcon="close-circle-outline"
              actionLabel="Clear notification"
            />
          );
        }}
        ListEmptyComponent={<Text style={styles.muted}>No activity yet.</Text>}
      />
    </View>
  );
}

const local = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8,
  },
  actionText: {
    color: colors.primary,
    fontWeight: '600',
  },
  clearText: {
    color: colors.danger,
    fontWeight: '600',
  },
  actionDisabled: {
    opacity: 0.5,
  },
});
