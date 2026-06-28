import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { cacheRemoteMedia } from '../utils/cacheMedia';
import { colors } from '../theme';

interface RemotePhotoProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
  /** Shown when download fails (e.g. initials for profile logos). */
  fallback?: ReactNode;
}

/** Remote job/profile photo — cached locally before display (direct HTTPS often fails in Expo Go). */
export default function RemotePhoto({
  uri,
  style,
  containerStyle,
  resizeMode = 'cover',
  fallback,
}: RemotePhotoProps) {
  const isLocalUri = /^(file|content|ph|assets-library|data|blob):/i.test(uri.trim());
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isLocalUri) return;

    let cancelled = false;
    setLocalUri(null);
    setFailed(false);

    void cacheRemoteMedia(uri)
      .then((cached) => {
        if (!cancelled) setLocalUri(cached);
      })
      .catch((error) => {
        if (!cancelled) setFailed(true);
        if (__DEV__) {
          console.warn('RemotePhoto failed:', uri, error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uri, isLocalUri]);

  if (isLocalUri) {
    return (
      <View style={[local.wrap, containerStyle]}>
        <Image source={{ uri }} style={style} resizeMode={resizeMode} />
      </View>
    );
  }

  return (
    <View style={[local.wrap, containerStyle]}>
      {localUri && !failed ? (
        <Image source={{ uri: localUri }} style={style} resizeMode={resizeMode} />
      ) : null}
      {!localUri && !failed ? (
        <View style={[local.placeholder, style]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      {failed ? (
        fallback ?? (
          <View style={[local.placeholder, local.fallback, style]}>
            <Text style={local.fallbackText}>
              Photo unavailable{'\n'}
              <Text style={local.fallbackHint}>Re-upload if this job was posted before today.</Text>
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}

const local = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
  },
  fallback: { padding: 8 },
  fallbackText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  fallbackHint: {
    fontSize: 11,
    color: colors.muted,
  },
});
