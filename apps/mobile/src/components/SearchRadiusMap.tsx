import { useMemo } from 'react';
import MapView, { Circle, Marker } from 'react-native-maps';
import { StyleSheet } from 'react-native';
import { colors } from '../theme';
import { milesToMeters, regionForRadiusMiles } from '../utils/mapUtils';

export interface SearchRadiusMapProps {
  center: { lat: number; lng: number };
  radiusMiles: number;
  height?: number;
}

export { regionForRadiusMiles } from '../utils/mapUtils';

export default function SearchRadiusMap({
  center,
  radiusMiles,
  height = 180,
}: SearchRadiusMapProps) {
  const region = useMemo(
    () => regionForRadiusMiles(center, radiusMiles),
    [center.lat, center.lng, radiusMiles],
  );

  return (
    <MapView style={[styles.map, { height }]} region={region} scrollEnabled={false} rotateEnabled={false}>
      <Marker
        coordinate={{ latitude: center.lat, longitude: center.lng }}
        pinColor={colors.primary}
      />
      <Circle
        center={{ latitude: center.lat, longitude: center.lng }}
        radius={milesToMeters(radiusMiles)}
        strokeColor={colors.primary}
        fillColor="rgba(37, 99, 235, 0.14)"
        strokeWidth={2}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
