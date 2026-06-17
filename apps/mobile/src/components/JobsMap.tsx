import MapView, { Circle, Marker } from 'react-native-maps';
import { StyleSheet } from 'react-native';
import { formatWorkType, colors } from '../theme';
import type { JobCoarse } from '../api';
import { milesToMeters, regionForRadiusMiles } from '../utils/mapUtils';

export interface JobsMapProps {
  jobs: JobCoarse[];
  center: { lat: number; lng: number };
  radiusMiles?: number;
  onSelect: (jobId: string) => void;
}

/**
 * Native map (iOS/Android) showing coarse job pins only. Precise coordinates are
 * never sent to non-owners, so markers use the ~1km-snapped coarse location.
 */
export default function JobsMap({ jobs, center, radiusMiles = 25, onSelect }: JobsMapProps) {
  const region = regionForRadiusMiles(center, radiusMiles);

  return (
    <MapView style={styles.map} region={region}>
      <Marker coordinate={{ latitude: center.lat, longitude: center.lng }} pinColor={colors.primary} />
      <Circle
        center={{ latitude: center.lat, longitude: center.lng }}
        radius={milesToMeters(radiusMiles)}
        strokeColor={colors.primary}
        fillColor="rgba(37, 99, 235, 0.14)"
        strokeWidth={2}
      />
      {jobs.map((job) => (
        <Marker
          key={job.id}
          coordinate={{ latitude: job.coarseLat, longitude: job.coarseLng }}
          title={job.title}
          description={formatWorkType(job.workType)}
          onCalloutPress={() => onSelect(job.id)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 280, borderRadius: 14, marginBottom: 12 },
});
