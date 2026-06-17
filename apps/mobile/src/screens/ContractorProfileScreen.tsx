import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, type ContractorProfile, type ContractorPublicReview } from '../api';
import { colors, formatWorkType, SERVICE_TYPE_OPTIONS, styles } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SharedStackParamList } from '../navTypes';
import { formatPhoneDisplay, phoneTelUri } from '../utils/phoneFormat';
import { resolveMediaUrl } from '../utils/mediaUrl';

function initials(first: string, last: string): string {
  return `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() || '?';
}

function milesFromKm(km: number | null | undefined): string {
  if (km == null) return '—';
  return `${Math.round(km / 1.60934)} mi`;
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function renderStarRating(rating: number) {
  return (
    <Text style={local.reviewStars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Text key={star} style={{ color: star <= rating ? '#f59e0b' : colors.border }}>
          {star <= rating ? '★' : '☆'}
        </Text>
      ))}
    </Text>
  );
}

function InfoRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={local.infoRow}>
      <View style={local.infoIcon}>
        <Text style={local.infoIconText}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={local.infoLabel}>{label}</Text>
        <Text style={[local.infoValue, onPress && local.infoLink]}>{value}</Text>
      </View>
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

export default function ContractorProfileScreen({ route }: NativeStackScreenProps<SharedStackParamList, 'ContractorProfile'>) {
  const { userId } = route.params;
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [reviews, setReviews] = useState<ContractorPublicReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, reviewsRes] = await Promise.all([
        api.getContractorProfile(userId),
        api.getContractorReviews(userId).catch(() => [] as ContractorPublicReview[]),
      ]);
      setProfile(profileRes);
      setReviews(reviewsRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load contractor profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  if (error || !profile) {
    return <Text style={[styles.error, { padding: 16 }]}>{error ?? 'Profile not found'}</Text>;
  }

  const displayName =
    profile.companyName?.trim() ||
    `${profile.firstName} ${profile.lastName}`.trim() ||
    'Contractor';
  const tradeLabels = profile.serviceTypes.map(
    (t) => SERVICE_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? formatWorkType(t),
  );
  const phoneDisplay = formatPhoneDisplay(profile.phone);
  const phoneTel = phoneTelUri(profile.phone);
  const address = profile.businessAddress?.trim();
  const logoUri = profile.logoUrl?.trim() ? resolveMediaUrl(profile.logoUrl.trim()) : undefined;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={local.hero}>
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={local.avatarImage} resizeMode="cover" />
        ) : (
          <View style={local.avatar}>
            <Text style={local.avatarText}>{initials(profile.firstName, profile.lastName)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{displayName}</Text>
          {profile.companyName ? (
            <Text style={styles.muted}>
              {profile.firstName} {profile.lastName}
            </Text>
          ) : null}
          <View style={local.ratingRow}>
            <Text style={local.ratingStars}>★ {profile.ratingAgg ?? 0}</Text>
            <Text style={styles.muted}> · {profile.ratingCount ?? 0} reviews</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Contact</Text>
        {phoneDisplay ? (
          <InfoRow
            icon="📞"
            label="Phone"
            value={phoneDisplay}
            onPress={phoneTel ? () => void Linking.openURL(`tel:${phoneTel}`) : undefined}
          />
        ) : (
          <InfoRow icon="📞" label="Phone" value="Not provided" />
        )}
        {address ? (
          <View style={[local.infoRow, { marginTop: 12 }]}>
            <View style={local.infoIcon}>
              <Text style={local.infoIconText}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={local.infoLabel}>Business address</Text>
              <Text style={local.addressBlock}>{address}</Text>
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <InfoRow icon="📍" label="Business address" value="Not provided" />
          </View>
        )}
      </View>

      {profile.description ? (
        <View style={styles.card}>
          <Text style={styles.subtitle}>About</Text>
          <Text style={local.bodyText}>{profile.description}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.subtitle}>Services</Text>
        {tradeLabels.length > 0 ? (
          <View style={local.chips}>
            {tradeLabels.map((label) => (
              <View key={label} style={local.chip}>
                <Text style={local.chipText}>{label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No service types listed.</Text>
        )}
        <Text style={[styles.muted, { marginTop: 12 }]}>
          Travels up to {milesFromKm(profile.serviceRadiusKm)} for jobs
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Reviews ({reviews.length})</Text>
        {reviews.length === 0 ? (
          <Text style={styles.muted}>No reviews yet from completed jobs.</Text>
        ) : (
          reviews.map((review, index) => (
            <View
              key={review.id}
              style={[local.reviewItem, index > 0 && local.reviewItemBorder]}
            >
              <View style={local.reviewHeader}>
                {renderStarRating(review.rating)}
                <Text style={styles.muted}>{formatReviewDate(review.createdAt)}</Text>
              </View>
              <Text style={local.reviewMeta}>
                {review.reviewerName} · {review.jobTitle}
              </Text>
              {review.comment ? (
                <Text style={local.bodyText}>{review.comment}</Text>
              ) : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Credentials</Text>
        <Text style={local.bodyText}>
          License {profile.licenseNumber?.trim() || 'not provided'}
        </Text>
        {profile.googleReviewsUrl ? (
          <TouchableOpacity
            style={[styles.buttonSecondary, local.reviewsBtn]}
            onPress={() => void Linking.openURL(profile.googleReviewsUrl!)}
          >
            <Text style={styles.buttonTextSecondary}>View Google reviews</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.muted, { marginTop: 8 }]}>No Google reviews link provided.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  ratingStars: { color: colors.text, fontWeight: '700', fontSize: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: { fontSize: 18 },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  infoValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  infoLink: { color: colors.primary },
  addressBlock: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bodyText: { color: colors.text, lineHeight: 22, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#eff6ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  chipText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  reviewItem: { paddingVertical: 12 },
  reviewItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewStars: { fontSize: 16 },
  reviewMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 6,
  },
  reviewsBtn: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
});
