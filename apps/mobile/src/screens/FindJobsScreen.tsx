import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, type JobCoarse } from '../api';
import JobsMap from '../components/JobsMap';
import SearchRadiusMap from '../components/SearchRadiusMap';
import { colors, formatBudget, formatDistanceMiles, formatWorkType, SERVICE_TYPE_OPTIONS, styles } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FindStackParamList } from '../navTypes';
import { formatGeocodedAddress } from '../utils/addressFormat';

/** Seeded demo jobs are centered on Lower Manhattan. */
const FALLBACK = { lat: 40.7128, lng: -74.006, label: 'New York, NY (demo area)' };

const MIN_RADIUS_MILES = 1;
const MAX_RADIUS_MILES = 100;

function formatRadiusLabel(miles: number): string {
  return miles >= MAX_RADIUS_MILES ? '100+ mi' : `${miles} mi`;
}

function kmToSearchRadiusMiles(km: number | null | undefined): number {
  if (km == null) return 25;
  return Math.min(MAX_RADIUS_MILES, Math.max(MIN_RADIUS_MILES, Math.round(km / 1.60934)));
}

const WORK_TYPE_FILTERS = [{ value: '', label: 'All trades' }, ...SERVICE_TYPE_OPTIONS];

type SearchCenter = {
  lat: number;
  lng: number;
  label: string;
  source: 'device' | 'address' | 'fallback' | 'profile';
};

function centerIcon(source: SearchCenter['source'] | undefined): string {
  if (source === 'device') return '📍';
  if (source === 'profile' || source === 'address') return '🏠';
  return '🗺️';
}

function JobCard({ job, onPress }: { job: JobCoarse; onPress: () => void }) {
  const distance = formatDistanceMiles(job.distanceKm);

  return (
    <TouchableOpacity style={local.card} onPress={onPress} activeOpacity={0.7}>
      <View style={local.cardTop}>
        <View style={local.typePill}>
          <Text style={local.typePillText}>{formatWorkType(job.workType)}</Text>
        </View>
        {distance && (
          <View style={local.distancePill}>
            <Text style={local.distanceText}>{distance}</Text>
          </View>
        )}
      </View>
      <Text style={local.cardTitle}>{job.title}</Text>
      <Text style={local.cardBudget}>{formatBudget(job.budgetMin, job.budgetMax, job.currency)}</Text>
      <Text numberOfLines={2} style={local.cardDesc}>
        {job.description}
      </Text>
      <Text style={local.cardAction}>View job →</Text>
    </TouchableOpacity>
  );
}

export default function FindJobsScreen({ navigation }: NativeStackScreenProps<FindStackParamList, 'Find'>) {
  const searchCenterTouched = useRef(false);
  const initialLoadDone = useRef(false);
  const [center, setCenter] = useState<SearchCenter | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [locating, setLocating] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [sliderMiles, setSliderMiles] = useState(25);
  const [workType, setWorkType] = useState('');
  const [jobs, setJobs] = useState<JobCoarse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [hasSearched, setHasSearched] = useState(false);

  const loadProfileSearchArea = useCallback(async (): Promise<boolean> => {
    try {
      const profile = await api.myContractorProfile();
      if (profile.baseLat == null || profile.baseLng == null) return false;

      let label = '';
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: profile.baseLat,
          longitude: profile.baseLng,
        });
        if (results.length) label = formatGeocodedAddress(results[0]);
      } catch {
        /* ignore reverse geocode failures */
      }
      if (!label) label = 'Your service area center';

      setAddressQuery(label);
      setCenter({
        lat: profile.baseLat,
        lng: profile.baseLng,
        label,
        source: 'profile',
      });
      const miles = kmToSearchRadiusMiles(profile.serviceRadiusKm);
      setRadiusMiles(miles);
      setSliderMiles(miles);
      return true;
    } catch {
      return false;
    }
  }, []);

  const setSearchCenterFromDevice = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setCenter({ ...FALLBACK, label: FALLBACK.label, source: 'fallback' });
      setError('Location permission denied. Enter an address or enable location in Settings.');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const results = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    if (results.length) {
      setAddressQuery(formatGeocodedAddress(results[0]));
    }
    setCenter({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      label: 'Your current location',
      source: 'device',
    });
  }, []);

  const useCurrentLocation = useCallback(async () => {
    searchCenterTouched.current = true;
    setLocating(true);
    setError(null);
    try {
      await setSearchCenterFromDevice();
    } catch {
      setCenter({ ...FALLBACK, label: FALLBACK.label, source: 'fallback' });
      setError('Could not read your location. Enter an address to search.');
    } finally {
      setLocating(false);
    }
  }, [setSearchCenterFromDevice]);

  const initSearchArea = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const fromProfile = await loadProfileSearchArea();
      if (!fromProfile) {
        await setSearchCenterFromDevice();
      }
    } catch {
      setCenter({ ...FALLBACK, label: FALLBACK.label, source: 'fallback' });
      setError('Could not read your location. Enter an address to search.');
    } finally {
      setLocating(false);
      initialLoadDone.current = true;
    }
  }, [loadProfileSearchArea, setSearchCenterFromDevice]);

  const applyAddress = useCallback(async () => {
    const trimmed = addressQuery.trim();
    if (trimmed.length < 3) {
      setError('Enter an address with city and state.');
      return;
    }
    searchCenterTouched.current = true;
    setGeocoding(true);
    setError(null);
    try {
      const results = await Location.geocodeAsync(trimmed);
      if (!results.length) {
        setError('Address not found. Try adding city and state, e.g. "123 Main St, Brooklyn, NY".');
        return;
      }
      setCenter({
        lat: results[0].latitude,
        lng: results[0].longitude,
        label: trimmed,
        source: 'address',
      });
    } catch {
      setError('Could not look up that address. Try a more complete address.');
    } finally {
      setGeocoding(false);
    }
  }, [addressQuery]);

  useEffect(() => {
    void initSearchArea();
  }, [initSearchArea]);

  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDone.current || searchCenterTouched.current) return;
      void loadProfileSearchArea();
    }, [loadProfileSearchArea]),
  );

  const search = useCallback(async () => {
    if (!center) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.searchJobs({
        lat: center.lat,
        lng: center.lng,
        radiusKm: radiusMiles * 1.60934,
        workType: workType || undefined,
      });
      setJobs(res.items);
      setHasSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load jobs');
    } finally {
      setLoading(false);
    }
  }, [center, radiusMiles, workType]);

  useEffect(() => {
    if (!center || locating) return;
    void search();
  }, [center, radiusMiles, workType, locating, search]);

  async function onRefresh() {
    setRefreshing(true);
    if (!searchCenterTouched.current) {
      if (!(await loadProfileSearchArea())) {
        await useCurrentLocation();
        searchCenterTouched.current = false;
      }
    } else if (center?.source === 'address' && addressQuery.trim().length >= 3) {
      await applyAddress();
    } else if (center?.source === 'profile' && addressQuery.trim().length >= 3) {
      await applyAddress();
    } else {
      await useCurrentLocation();
    }
    setRefreshing(false);
  }

  const areaBusy = locating || geocoding;

  const resultSummary =
    loading && !hasSearched
      ? 'Searching nearby…'
      : hasSearched
        ? jobs.length === 0
          ? 'No jobs in this area'
          : `${jobs.length} job${jobs.length === 1 ? '' : 's'} nearby`
        : null;

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.content, local.listContent]}
        data={view === 'list' ? jobs : []}
        keyExtractor={(j) => j.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Find Jobs</Text>
            <Text style={local.subtitle}>Browse open jobs near you and place a bid.</Text>

            <View style={local.section}>
              <Text style={local.sectionLabel}>Search area</Text>
              <View style={local.addressCard}>
                <View style={local.addressInputRow}>
                  <TextInput
                    style={local.addressInput}
                    value={addressQuery}
                    onChangeText={setAddressQuery}
                    placeholder="Street address, city, state"
                    placeholderTextColor={colors.muted}
                    returnKeyType="search"
                    onSubmitEditing={() => void applyAddress()}
                    editable={!areaBusy}
                  />
                  {addressQuery.length > 0 ? (
                    <TouchableOpacity
                      style={local.addressClearBtn}
                      onPress={() => setAddressQuery('')}
                      disabled={areaBusy}
                      accessibilityLabel="Clear address"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.muted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={local.addressActions}>
                  <TouchableOpacity
                    style={[local.addressBtn, local.addressBtnSecondary]}
                    onPress={() => void useCurrentLocation()}
                    disabled={areaBusy}
                  >
                    {locating ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={local.addressBtnSecondaryText}>📍 Current location</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[local.addressBtn, local.addressBtnPrimary]}
                    onPress={() => void applyAddress()}
                    disabled={areaBusy}
                  >
                    {geocoding ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={local.addressBtnPrimaryText}>Search here</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {center && !locating ? (
                  <View style={local.activeCenterRow}>
                    <Text style={local.locationIcon}>{centerIcon(center.source)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={local.activeCenterLabel}>Searching near</Text>
                      <Text style={local.locationText}>{center.label}</Text>
                      {center.source === 'fallback' ? (
                        <Text style={local.locationHint}>
                          Location unavailable — using demo area near NYC. Enter an address above
                          or enable location in Settings.
                        </Text>
                      ) : center.source === 'profile' ? (
                        <Text style={local.locationHint}>
                          From your profile service area. Update it under Profile, or search a
                          different address here.
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : locating ? (
                  <Text style={local.locationHint}>Getting your location…</Text>
                ) : null}
              </View>
            </View>

            <View style={local.section}>
              <View style={local.sliderHeader}>
                <Text style={local.sectionLabel}>Distance</Text>
                <Text style={local.sliderValue}>{formatRadiusLabel(sliderMiles)}</Text>
              </View>
              <View style={local.sliderCard}>
                <Slider
                  style={local.slider}
                  value={sliderMiles}
                  onValueChange={setSliderMiles}
                  onSlidingComplete={(value) => {
                    const miles = Math.round(value);
                    setSliderMiles(miles);
                    setRadiusMiles(miles);
                  }}
                  minimumValue={MIN_RADIUS_MILES}
                  maximumValue={MAX_RADIUS_MILES}
                  step={1}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.primary}
                />
                <View style={local.sliderLabels}>
                  <Text style={local.sliderBound}>1 mi</Text>
                  <Text style={local.sliderBound}>100+ mi</Text>
                </View>
              </View>
              {center && !locating ? (
                <SearchRadiusMap
                  center={{ lat: center.lat, lng: center.lng }}
                  radiusMiles={sliderMiles}
                />
              ) : null}
            </View>

            <View style={local.section}>
              <Text style={local.sectionLabel}>Trade</Text>
              <View style={local.chipWrap}>
                {WORK_TYPE_FILTERS.map((t) => {
                  const active = workType === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value || 'all'}
                      onPress={() => setWorkType(t.value)}
                      style={[local.chip, active && local.chipActive]}
                    >
                      <Text style={[local.chipText, active && local.chipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {error && (
              <View style={local.errorBox}>
                <Text style={styles.error}>{error}</Text>
                <TouchableOpacity onPress={() => void search()}>
                  <Text style={local.retryLink}>Tap to retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {(hasSearched || loading) && (
              <View style={local.resultsHeader}>
                <Text style={local.resultsCount}>{resultSummary}</Text>
                {jobs.length > 0 && (
                  <View style={local.viewToggle}>
                    {(['list', 'map'] as const).map((mode) => {
                      const active = view === mode;
                      return (
                        <TouchableOpacity
                          key={mode}
                          onPress={() => setView(mode)}
                          style={[local.viewBtn, active && local.viewBtnActive]}
                        >
                          <Text style={[local.viewBtnText, active && local.viewBtnTextActive]}>
                            {mode === 'list' ? 'List' : 'Map'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {view === 'map' && jobs.length > 0 && center && (
              <JobsMap
                jobs={jobs}
                center={{ lat: center.lat, lng: center.lng }}
                radiusMiles={sliderMiles}
                onSelect={(jobId) => navigation.navigate('JobDetail', { jobId })}
              />
            )}

            {loading && hasSearched && view === 'list' && (
              <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <JobCard job={item} onPress={() => navigation.navigate('JobDetail', { jobId: item.id })} />
        )}
        ListEmptyComponent={
          hasSearched && !loading && view === 'list' ? (
            <View style={local.empty}>
              <Text style={local.emptyTitle}>No jobs match</Text>
              <Text style={local.emptyBody}>
                Try a wider distance, choose All trades, search a different address, or pull down
                to refresh.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const local = StyleSheet.create({
  listContent: { paddingBottom: 24 },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: -4, marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  addressCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  addressInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    paddingRight: 36,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
  },
  addressInputRow: { position: 'relative' },
  addressClearBtn: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  addressActions: { flexDirection: 'row', gap: 8 },
  addressBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  addressBtnPrimary: { backgroundColor: colors.primary },
  addressBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  addressBtnSecondary: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressBtnSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  activeCenterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  activeCenterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationIcon: { fontSize: 20, marginTop: 2 },
  locationText: { fontSize: 15, fontWeight: '600', color: colors.text },
  locationHint: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  sliderCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  slider: { width: '100%', height: 40 },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  sliderBound: { fontSize: 12, fontWeight: '600', color: colors.muted },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: '#eff6ff', borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextActive: { color: colors.primary },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  retryLink: { color: colors.primary, fontWeight: '600', marginTop: 6, fontSize: 13 },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  resultsCount: { fontSize: 15, fontWeight: '700', color: colors.text },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 8,
    padding: 2,
  },
  viewBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  viewBtnActive: { backgroundColor: colors.surface },
  viewBtnText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  viewBtnTextActive: { color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typePill: {
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  typePillText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  distancePill: {
    backgroundColor: colors.bg,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  distanceText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardBudget: { fontSize: 15, fontWeight: '600', color: colors.success, marginBottom: 6 },
  cardDesc: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  cardAction: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 10 },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21 },
});
