import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, uploadToSignedUrl } from '../api';
import { useAuth } from '../auth';
import { colors, ios, SERVICE_TYPE_OPTIONS, styles } from '../theme';
import {
  defaultExactDate,
  defaultFlexibleRange,
  formatJobDate,
  jobToTimeframeForm,
  localCalendarDate,
  startOfDay,
  timeframeToApi,
  type TimeframeMode,
  validateTimeframe,
} from '../utils/jobDates';
import { formatPhoneDisplay, formatPhoneInput, phoneDigits, phoneForStorage } from '../utils/phoneFormat';
import { extractMediaKey, resolveMediaUrl, resolvePhotoUrls } from '../utils/mediaUrl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SharedStackParamList } from '../navTypes';
import { JobDescriptionSuggestions } from '../components/JobDescriptionSuggestions';
import {
  JobPhotoAiEditButton,
  JobPhotoAiEditModal,
  type JobPhotoAiEditTarget,
} from '../components/JobPhotoAiEdit';
import {
  ScopeComparisonDraftList,
  type ScopeComparisonDraft,
} from '../components/JobScopeComparisons';

const MAX_PHOTOS = 4;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

interface PhotoDraft {
  id: string;
  previewUri: string;
  fileUrl: string | null;
}

function formatAddress(parts: Location.LocationGeocodedAddress): string {
  const line1 = [parts.streetNumber, parts.street].filter(Boolean).join(' ');
  return [line1, parts.city, parts.region, parts.postalCode].filter(Boolean).join(', ');
}

export default function PostJobScreen({
  route,
  navigation,
}: NativeStackScreenProps<SharedStackParamList, 'PostJob'>) {
  const jobId = route.params?.jobId;
  const isEditing = !!jobId;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workType, setWorkType] = useState('plumbing');
  const [addressText, setAddressText] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const flexDefaults = defaultFlexibleRange();
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>('exact');
  const [exactDate, setExactDate] = useState(defaultExactDate);
  const [flexibleStart, setFlexibleStart] = useState(flexDefaults.start);
  const [flexibleEnd, setFlexibleEnd] = useState(flexDefaults.end);
  const [datePicker, setDatePicker] = useState<'exact' | 'flexStart' | 'flexEnd' | null>(null);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingJob, setLoadingJob] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiEditTarget, setAiEditTarget] = useState<JobPhotoAiEditTarget | null>(null);
  const [scopeComparisons, setScopeComparisons] = useState<ScopeComparisonDraft[]>([]);

  useEffect(() => {
    if (!isEditing || !jobId) return;
    void (async () => {
      setLoadingJob(true);
      setError(null);
      try {
        const [job, bidList] = await Promise.all([
          api.getJob(jobId),
          api.listBids(jobId).catch(() => []),
        ]);
        if (bidList.length > 0) {
          setError('This job cannot be edited after a bid has been placed.');
          return;
        }
        if (job.status !== 'OPEN') {
          setError('Only open jobs can be edited.');
          return;
        }
        setTitle(job.title);
        setDescription(job.description);
        setWorkType(job.workType);
        setAddressText(job.addressText);
        if (job.contactPhone?.trim()) {
          setContactPhone(formatPhoneDisplay(job.contactPhone));
        }
        if (job.budgetMin != null) setBudgetMin(String(job.budgetMin / 100));
        if (job.budgetMax != null) setBudgetMax(String(job.budgetMax / 100));
        const tf = jobToTimeframeForm(job.desiredDatetimeStart, job.desiredDatetimeEnd);
        setTimeframeMode(tf.mode);
        setExactDate(tf.exactDate);
        setFlexibleStart(tf.flexibleStart);
        setFlexibleEnd(tf.flexibleEnd);
        setPhotos(
          resolvePhotoUrls(job.photos).map((previewUri, index) => ({
            id: `existing_${index}`,
            previewUri,
            fileUrl:
              extractMediaKey(job.photos[index] ?? '') ?? job.photos[index] ?? null,
          })),
        );
        setScopeComparisons(
          (job.photoComparisons ?? []).map((pair, index) => ({
            id: `existing_scope_${index}`,
            beforeKey: pair.before,
            afterKey: pair.after,
            beforePreview: resolveMediaUrl(pair.before),
            afterPreview: resolveMediaUrl(pair.after),
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load job');
      } finally {
        setLoadingJob(false);
      }
    })();
  }, [isEditing, jobId]);

  useEffect(() => {
    if (!user || isEditing) return;
    void api.me().then((me) => {
      if (me.phone?.trim()) {
        setContactPhone(formatPhoneDisplay(me.phone));
      }
      if (me.homeAddress?.trim()) {
        setAddressText(me.homeAddress.trim());
      }
    }).catch(() => undefined);
  }, [user, isEditing]);

  async function useCurrentLocation() {
    setError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to fill in your address.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const results = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (!results.length) {
        setError('Could not determine your address. Please type it manually.');
        return;
      }
      setAddressText(formatAddress(results[0]));
    } catch {
      setError('Could not read your location. Please type the address manually.');
    } finally {
      setLocating(false);
    }
  }

  async function resolveCoordinates(): Promise<{ lat: number; lng: number }> {
    const trimmed = addressText.trim();
    if (trimmed.length < 3) {
      throw new Error('Please enter the job address.');
    }
    const results = await Location.geocodeAsync(trimmed);
    if (!results.length) {
      throw new Error(
        'We could not find that address. Try adding city and state, e.g. "123 Main St, Brooklyn, NY".',
      );
    }
    return { lat: results[0].latitude, lng: results[0].longitude };
  }

  function onDatePicked(event: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS === 'android') setDatePicker(null);
    if (event.type === 'dismissed' || !picked) return;

    const day = localCalendarDate(picked);
    if (datePicker === 'exact') {
      setExactDate(day);
      return;
    }
    if (datePicker === 'flexStart') {
      setFlexibleStart(day);
      if (day > flexibleEnd) setFlexibleEnd(day);
      return;
    }
    if (datePicker === 'flexEnd') {
      setFlexibleEnd(day);
    }
  }

  const minSelectableDate = startOfDay(new Date());

  function pickerDate(): Date {
    const raw =
      datePicker === 'exact'
        ? exactDate
        : datePicker === 'flexStart'
          ? flexibleStart
          : flexibleEnd;
    const day = localCalendarDate(raw);
    return day < minSelectableDate ? minSelectableDate : day;
  }

  function openDatePicker(field: 'exact' | 'flexStart' | 'flexEnd') {
    setDatePicker(field);
  }

  function datePickerTitle(): string {
    if (datePicker === 'exact') return 'Preferred date';
    if (datePicker === 'flexStart') return 'Earliest date';
    return 'Latest date';
  }

  async function addPhoto() {
    if (photos.length >= MAX_PHOTOS) return;
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required to attach photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const contentType =
      asset.mimeType && ALLOWED_TYPES.includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    const fileName = `photo_${Date.now()}.${ext}`;
    const draftId = fileName;

    setPhotos((prev) => [...prev, { id: draftId, previewUri: asset.uri, fileUrl: null }]);
    setUploading(true);
    try {
      const signed = await api.signUpload(contentType, fileName);
      const fileUrl = await uploadToSignedUrl(signed, asset.uri, contentType);
      setPhotos((prev) =>
        prev.map((p) => (p.id === draftId ? { ...p, fileUrl } : p)),
      );
    } catch (e) {
      setPhotos((prev) => prev.filter((p) => p.id !== draftId));
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function resolvePhotoSourceKey(target: JobPhotoAiEditTarget): Promise<string> {
    if (!target.fileUrl) {
      throw new Error('Wait for the photo to finish uploading.');
    }
    return extractMediaKey(target.fileUrl) ?? target.fileUrl;
  }

  function applyScopeComparison(
    photoId: string,
    result: {
      beforeKey: string;
      afterKey: string;
      beforePreview: string;
      afterPreview: string;
    },
  ) {
    setScopeComparisons((prev) => [
      ...prev,
      {
        id: `scope_${Date.now()}`,
        beforeKey: result.beforeKey,
        afterKey: result.afterKey,
        beforePreview: result.beforePreview,
        afterPreview: result.afterPreview,
      },
    ]);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }

  async function submit() {
    setError(null);

    if (title.trim().length < 3) {
      setError('Please enter a job title (at least 3 characters).');
      return;
    }
    if (description.trim().length < 10) {
      setError('Please describe the work needed (at least 10 characters).');
      return;
    }
    if (contactPhone.trim() && phoneDigits(contactPhone).length < 10) {
      setError('Please enter a valid 10-digit contact phone number.');
      return;
    }

    if (photos.some((p) => !p.fileUrl)) {
      setError('Please wait for photos to finish uploading.');
      return;
    }

    const timeframeError = validateTimeframe(timeframeMode, exactDate, flexibleStart, flexibleEnd);
    if (timeframeError) {
      setError(timeframeError);
      return;
    }

    setBusy(true);
    try {
      const { lat, lng } = await resolveCoordinates();
      const min = budgetMin ? Math.round(Number(budgetMin) * 100) : undefined;
      const max = budgetMax ? Math.round(Number(budgetMax) * 100) : undefined;
      if (min != null && max != null && min > max) {
        setError('Minimum budget cannot be higher than maximum.');
        setBusy(false);
        return;
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        workType,
        ...timeframeToApi(timeframeMode, exactDate, flexibleStart, flexibleEnd),
        addressText: addressText.trim(),
        ...(phoneForStorage(contactPhone) ? { contactPhone: phoneForStorage(contactPhone) } : {}),
        lat,
        lng,
        photos: photos.length
          ? photos
              .map((p) => p.fileUrl)
              .filter((url): url is string => !!url)
              .map((url) => extractMediaKey(url) ?? url)
          : undefined,
        photoComparisons: scopeComparisons.length
          ? scopeComparisons.map((s) => ({ before: s.beforeKey, after: s.afterKey }))
          : undefined,
        budgetMin: min,
        budgetMax: max,
      };

      if (isEditing && jobId) {
        await api.updateJob(jobId, payload);
        navigation.replace('JobDetail', { jobId });
      } else {
        const job = await api.createJob(payload);
        navigation.replace('JobDetail', { jobId: job.id });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : isEditing ? 'Could not save job' : 'Could not create job');
    } finally {
      setBusy(false);
    }
  }

  if (loadingJob) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  }

  return (
    <>
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, local.content]}>
      <Text style={styles.title}>{isEditing ? 'Edit Job' : 'Post a Job'}</Text>
      <Text style={local.subtitle}>
        {isEditing
          ? 'Update your job details. Editing is disabled once a contractor places a bid.'
          : 'Describe the work you need. Your exact address stays private until you accept a bid.'}
      </Text>

      <View style={local.section}>
        <Text style={local.sectionTitle}>Job details</Text>

        <Text style={local.fieldLabel}>Title</Text>
        <TextInput
          style={local.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Replace water heater"
          placeholderTextColor={colors.muted}
        />

        <Text style={local.fieldLabel}>Description</Text>
        <TextInput
          style={[local.input, local.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What needs to be done? Include any details contractors should know…"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
        />

        <JobDescriptionSuggestions
          title={title}
          workType={workType}
          description={description}
          onAppend={(line) =>
            setDescription((prev) => {
              const trimmed = prev.trim();
              const prefix = trimmed.length ? `${trimmed}\n` : '';
              return `${prefix}• ${line}`;
            })
          }
        />

        <Text style={local.fieldLabel}>Photos</Text>
        <Text style={local.fieldHint}>
          Add reference photos. Use <Text style={local.fieldHintStrong}>AI scope</Text> on a photo to create a
          before/after vision.
        </Text>

        <ScopeComparisonDraftList
          compact
          items={scopeComparisons}
          onRemove={(id) => setScopeComparisons((prev) => prev.filter((s) => s.id !== id))}
        />

        <View style={local.photoRow}>
          {photos.map((photo) => (
            <View key={photo.id} style={local.photoWrap}>
              <Image source={{ uri: photo.previewUri }} style={local.photo} />
              <JobPhotoAiEditButton
                disabled={uploading || busy || !photo.fileUrl}
                onPress={() =>
                  setAiEditTarget({
                    id: photo.id,
                    previewUri: photo.previewUri,
                    fileUrl: photo.fileUrl,
                  })
                }
              />
              <TouchableOpacity
                onPress={() => setPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                style={local.photoRemove}
              >
                <Text style={local.photoRemoveText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity
              onPress={() => void addPhoto()}
              disabled={uploading || busy}
              style={local.photoAdd}
            >
              <Text style={local.photoAddText}>{uploading ? '…' : '+ Photo'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={local.photoCount}>
          {photos.length}/{MAX_PHOTOS} added
        </Text>

        <Text style={local.fieldLabel}>Type of work</Text>
        <View style={local.chipWrap}>
          {SERVICE_TYPE_OPTIONS.map((t) => {
            const active = workType === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                onPress={() => setWorkType(t.value)}
                style={[local.chip, active && local.chipActive]}
              >
                <Text style={[local.chipText, active && local.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={local.section}>
        <Text style={local.sectionTitle}>Budget</Text>
        <Text style={local.fieldHint}>Optional — helps contractors know your price range.</Text>

        <View style={local.row}>
          <View style={{ flex: 1 }}>
            <Text style={local.fieldLabel}>Min ($)</Text>
            <TextInput
              style={local.input}
              value={budgetMin}
              onChangeText={setBudgetMin}
              placeholder="500"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={local.fieldLabel}>Max ($)</Text>
            <TextInput
              style={local.input}
              value={budgetMax}
              onChangeText={setBudgetMax}
              placeholder="1200"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      </View>

      <View style={local.section}>
        <Text style={local.sectionTitle}>Timeframe</Text>
        <Text style={local.fieldHint}>When would you like the work done?</Text>

        <View style={local.chipWrap}>
          <TouchableOpacity
            onPress={() => {
              setTimeframeMode('exact');
              openDatePicker('exact');
            }}
            style={[local.chip, timeframeMode === 'exact' && local.chipActive]}
          >
            <Text style={[local.chipText, timeframeMode === 'exact' && local.chipTextActive]}>
              Exact date
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setTimeframeMode('flexible');
              openDatePicker('flexStart');
            }}
            style={[local.chip, timeframeMode === 'flexible' && local.chipActive]}
          >
            <Text style={[local.chipText, timeframeMode === 'flexible' && local.chipTextActive]}>
              I&apos;m flexible
            </Text>
          </TouchableOpacity>
        </View>

        {timeframeMode === 'exact' ? (
          <>
            <Text style={local.fieldLabel}>Preferred date</Text>
            <TouchableOpacity
              style={local.dateBtn}
              onPress={() => openDatePicker('exact')}
              disabled={busy}
            >
              <Text style={local.dateBtnText}>{formatJobDate(exactDate)}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={local.fieldLabel}>Earliest date</Text>
            <TouchableOpacity
              style={local.dateBtn}
              onPress={() => openDatePicker('flexStart')}
              disabled={busy}
            >
              <Text style={local.dateBtnText}>{formatJobDate(flexibleStart)}</Text>
            </TouchableOpacity>

            <Text style={local.fieldLabel}>Latest date</Text>
            <TouchableOpacity
              style={local.dateBtn}
              onPress={() => openDatePicker('flexEnd')}
              disabled={busy}
            >
              <Text style={local.dateBtnText}>{formatJobDate(flexibleEnd)}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={local.section}>
        <Text style={local.sectionTitle}>Location</Text>
        <Text style={local.fieldHint}>
          Contractors see an approximate area on the map until you accept a bid.
        </Text>

        <Text style={local.fieldLabel}>Street address</Text>
        <View style={local.addressInputRow}>
          <TextInput
            style={[local.input, local.textArea, local.addressInput, { minHeight: 72 }]}
            value={addressText}
            onChangeText={setAddressText}
            placeholder="123 Main St, Brooklyn, NY 11201"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
          />
          {addressText.length > 0 ? (
            <TouchableOpacity
              style={local.addressClearBtn}
              onPress={() => setAddressText('')}
              disabled={busy || locating}
              accessibilityLabel="Clear address"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={local.secondaryBtn}
          onPress={() => void useCurrentLocation()}
          disabled={locating || busy}
        >
          <Text style={local.secondaryBtnText}>
            {locating ? 'Getting location…' : '📍 Use my current location'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={local.section}>
        <Text style={local.sectionTitle}>Contact</Text>
        <Text style={local.fieldHint}>
          Optional — shared with your chosen contractor after you accept a bid.
        </Text>

        <Text style={local.fieldLabel}>Phone number</Text>
        <TextInput
          style={local.input}
          value={contactPhone}
          onChangeText={(text) => setContactPhone(formatPhoneInput(text))}
          placeholder="(555) 555-5555"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
        />
      </View>

      {error && (
        <View style={local.errorBox}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[local.submitBtn, (busy || uploading) && local.submitBtnDisabled]}
        onPress={() => void submit()}
        disabled={busy || uploading}
      >
        <Text style={local.submitBtnText}>
          {busy ? (isEditing ? 'Saving…' : 'Posting job…') : isEditing ? 'Save changes' : 'Post job'}
        </Text>
      </TouchableOpacity>
    </ScrollView>

    {Platform.OS === 'ios' ? (
      <Modal
        visible={datePicker != null}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePicker(null)}
      >
        <View style={local.dateModalBackdrop}>
          <Pressable style={local.dateModalDismiss} onPress={() => setDatePicker(null)} />
          <View style={[local.dateModalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={local.dateModalHeader}>
              <Text style={local.dateModalTitle}>{datePickerTitle()}</Text>
              <Pressable onPress={() => setDatePicker(null)} hitSlop={8}>
                <Text style={local.dateModalDone}>Done</Text>
              </Pressable>
            </View>
            {datePicker ? (
              <DateTimePicker
                value={pickerDate()}
                mode="date"
                display="spinner"
                minimumDate={minSelectableDate}
                onChange={onDatePicked}
                style={local.dateModalPicker}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    ) : null}

    {datePicker && Platform.OS === 'android' ? (
      <DateTimePicker
        value={pickerDate()}
        mode="date"
        display="default"
        minimumDate={minSelectableDate}
        onChange={onDatePicked}
      />
    ) : null}

    <JobPhotoAiEditModal
      visible={aiEditTarget != null}
      target={aiEditTarget}
      onClose={() => setAiEditTarget(null)}
      resolveSourceKey={resolvePhotoSourceKey}
      onApply={applyScopeComparison}
    />
  </>
  );
}

const local = StyleSheet.create({
  content: { paddingBottom: 32 },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: -4, marginBottom: 16, lineHeight: 22 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 6 },
  fieldHint: { fontSize: 13, color: colors.muted, marginBottom: 8, lineHeight: 18 },
  fieldHintStrong: { fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 96, paddingTop: 12 },
  addressInputRow: { position: 'relative' },
  addressInput: { paddingRight: 36 },
  addressClearBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: { backgroundColor: '#eff6ff', borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextActive: { color: colors.primary },
  secondaryBtn: {
    marginTop: 12,
    backgroundColor: ios.buttonGray,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 17, fontWeight: '600', color: colors.text },
  dateBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateBtnText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  dateModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  dateModalDismiss: {
    flex: 1,
  },
  dateModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  dateModalDone: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary,
  },
  dateModalPicker: {
    height: 216,
    alignSelf: 'stretch',
  },
  row: { flexDirection: 'row', gap: 10 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  photoWrap: { position: 'relative' },
  photo: { width: 80, height: 80, borderRadius: 10 },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.danger,
    borderRadius: 999,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontWeight: '700', fontSize: 14, lineHeight: 16 },
  photoAdd: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  photoAddText: { color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  photoCount: { fontSize: 12, color: colors.muted, marginTop: 8 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
