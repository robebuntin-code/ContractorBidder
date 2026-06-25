import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, SessionExpiredError, type JobFull } from '../api';
import { FeedListCard } from '../components/FeedListCard';
import { HowDojobidWorksLink } from '../components/HowDojobidWorks';
import { colors, formatBudget, styles } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MyJobsStackParamList } from '../navTypes';

export default function MyJobsScreen({ navigation }: NativeStackScreenProps<MyJobsStackParamList, 'MyJobs'>) {
  const [jobs, setJobs] = useState<JobFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setJobs(await api.myJobs());
    } catch (e) {
      if (e instanceof SessionExpiredError) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function confirmDelete(job: JobFull) {
    if (job.status === 'AWARDED') {
      Alert.alert('Cannot delete', 'Awarded jobs cannot be removed.');
      return;
    }

    Alert.alert('Delete job?', `"${job.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void deleteJob(job.id),
      },
    ]);
  }

  async function deleteJob(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (e) {
      Alert.alert('Could not delete job', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={jobs}
        keyExtractor={(j) => j.id}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>My Jobs</Text>
            <View style={{ marginBottom: 12 }}>
              <HowDojobidWorksLink style={{ alignSelf: 'flex-start' }} />
            </View>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('PostJob')}>
              <Text style={styles.buttonText}>+ Post a Job</Text>
            </TouchableOpacity>
            <View style={{ height: 12 }} />
            {loading && <ActivityIndicator />}
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <FeedListCard
            badge={item.status}
            title={item.title}
            subtitle={`${formatBudget(item.budgetMin, item.budgetMax, item.currency)} · ${item.addressText}`}
            onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
            pressDisabled={busy}
            onAction={() => confirmDelete(item)}
            actionDisabled={busy || item.status === 'AWARDED'}
            actionIcon="trash-outline"
            actionColor={colors.danger}
            actionLabel="Delete job"
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.muted, { color: colors.muted }]}>
              You haven&apos;t posted any jobs yet.
            </Text>
          ) : null
        }
      />
    </View>
  );
}
