import { Text, TouchableOpacity, View } from 'react-native';
import { colors, styles } from '../theme';
import type { JobsMapProps } from './JobsMap';

/**
 * react-native-maps has no web implementation, so on web we render a simple
 * tappable list of coarse pins as a fallback.
 */
export default function JobsMap({ jobs, onSelect }: JobsMapProps) {
  return (
    <View style={[styles.card, { minHeight: 120 }]}>
      <Text style={styles.muted}>Map is available on iOS/Android. Coarse pins:</Text>
      {jobs.map((job) => (
        <TouchableOpacity key={job.id} onPress={() => onSelect(job.id)} style={{ paddingVertical: 6 }}>
          <Text style={{ color: colors.primary }}>
            📍 {job.title} ({job.coarseLat.toFixed(3)}, {job.coarseLng.toFixed(3)})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
