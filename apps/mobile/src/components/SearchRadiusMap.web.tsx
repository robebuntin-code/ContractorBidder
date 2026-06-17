import { Text, View } from 'react-native';
import { colors, styles } from '../theme';
import type { SearchRadiusMapProps } from './SearchRadiusMap';

/** react-native-maps is native-only; show a simple radius summary on web. */
export default function SearchRadiusMap({ center, radiusMiles, height = 180 }: SearchRadiusMapProps) {
  const label = radiusMiles >= 100 ? '100+' : String(radiusMiles);
  return (
    <View
      style={[
        styles.card,
        {
          height,
          marginTop: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderStyle: 'dashed',
        },
      ]}
    >
      <Text style={{ fontSize: 28, marginBottom: 8 }}>🗺️</Text>
      <Text style={styles.muted}>Map preview on iOS/Android</Text>
      <Text style={{ color: colors.text, fontWeight: '600', marginTop: 4 }}>
        {label} mi radius around ({center.lat.toFixed(3)}, {center.lng.toFixed(3)})
      </Text>
    </View>
  );
}
