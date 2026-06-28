import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, uploadToSignedUrl } from '../api';
import { useAuth } from '../auth';
import RemotePhoto from '../components/RemotePhoto';
import ProfileFieldRow from '../components/profile/ProfileFieldRow';
import { accountStyles as s } from '../components/profile/accountStyles';
import { colors, formatRole, SERVICE_TYPE_OPTIONS } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navTypes';
import { formatGeocodedAddress, normalizeAddressDisplay } from '../utils/addressFormat';
import { extractMediaKey, resolveMediaUrl } from '../utils/mediaUrl';
import { formatPhoneDisplay, formatPhoneInput, phoneDigits, phoneForStorage } from '../utils/phoneFormat';

const RADIUS_MILES = [10, 25, 50] as const;
const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

type ProfileSection = 'personal' | 'business' | 'service' | 'account';

type NavItem = {
  id: ProfileSection;
  label: string;
};

function kmToRadiusMiles(km: number | null | undefined): (typeof RADIUS_MILES)[number] {
  if (km == null) return 25;
  const miles = km / 1.60934;
  if (miles <= 15) return 10;
  if (miles <= 37) return 25;
  return 50;
}

export default function ProfileScreen(_props: NativeStackScreenProps<ProfileStackParamList, 'Profile'>) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const isContractor = user?.role === 'CONTRACTOR';

  const [loading, setLoading] = useState(isContractor);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreviewUri, setLogoPreviewUri] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [phone, setPhone] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [description, setDescription] = useState('');
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [radiusMiles, setRadiusMiles] = useState<(typeof RADIUS_MILES)[number]>(25);
  const [baseLat, setBaseLat] = useState<number | null>(null);
  const [baseLng, setBaseLng] = useState<number | null>(null);
  const [serviceAreaAddress, setServiceAreaAddress] = useState('');
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [serviceAreaGeocoding, setServiceAreaGeocoding] = useState(false);
  const [addressLocating, setAddressLocating] = useState(false);
  const [googleReviewsUrl, setGoogleReviewsUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileSection>('personal');
  const [expandedField, setExpandedField] = useState<string | null>(null);

  const navItems: NavItem[] = isContractor
    ? [
        { id: 'personal', label: 'Personal' },
        { id: 'business', label: 'Business' },
        { id: 'service', label: 'Service' },
        { id: 'account', label: 'Account' },
      ]
    : [
        { id: 'personal', label: 'Personal' },
        { id: 'account', label: 'Account' },
      ];

  const sectionTitles: Record<ProfileSection, string> = {
    personal: 'Personal info',
    business: 'Business',
    service: 'Service area',
    account: 'Account',
  };

  const sectionTitle = sectionTitles[activeSection];

  function switchSection(section: ProfileSection) {
    setActiveSection(section);
    setExpandedField(null);
    setStatus(null);
    setError(null);
  }

  function toggleField(field: string) {
    setExpandedField((prev) => (prev === field ? null : field));
  }

  const resolveLocation = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setError('Location permission is needed to use your current location.');
        return false;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setBaseLat(pos.coords.latitude);
      setBaseLng(pos.coords.longitude);
      const results = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (results.length) {
        const label = formatGeocodedAddress(results[0]);
        setServiceAreaAddress(label);
        setLocationLabel(label);
      } else {
        setLocationLabel('Your current location');
      }
      return true;
    } catch {
      setError('Could not read your location. Enter an address below instead.');
      return false;
    } finally {
      setLocating(false);
    }
  }, []);

  const labelSavedServiceArea = useCallback(async (lat: number, lng: number, fallback?: string) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length) {
        const label = formatGeocodedAddress(results[0]);
        setServiceAreaAddress(label);
        setLocationLabel(label);
        return;
      }
    } catch {
      /* fall through */
    }
    if (fallback?.trim()) {
      setServiceAreaAddress(fallback.trim());
      setLocationLabel(fallback.trim());
    } else {
      setLocationLabel('Saved location');
    }
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (!isContractor) {
      setError(null);
      setLoading(true);
      try {
        const me = await api.me();
        setPhone(formatPhoneDisplay(me.phone));
        setHomeAddress(me.homeAddress ?? '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load profile');
      } finally {
        setLoading(false);
      }
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const profile = await api.myContractorProfile();
      setHasProfile(true);
      setCompanyName(profile.companyName ?? '');
      setLogoUrl(profile.logoUrl ? extractMediaKey(profile.logoUrl) ?? profile.logoUrl : null);
      setLogoPreviewUri(profile.logoUrl ? resolveMediaUrl(profile.logoUrl) : null);
      setPhone(formatPhoneDisplay(profile.phone));
      setBusinessAddress(profile.businessAddress ?? '');
      setDescription(profile.description ?? '');
      setServiceTypes(profile.serviceTypes ?? []);
      setRadiusMiles(kmToRadiusMiles(profile.serviceRadiusKm));
      setGoogleReviewsUrl(profile.googleReviewsUrl ?? '');
      if (profile.baseLat != null && profile.baseLng != null) {
        setBaseLat(profile.baseLat);
        setBaseLng(profile.baseLng);
        await labelSavedServiceArea(
          profile.baseLat,
          profile.baseLng,
          profile.businessAddress ?? undefined,
        );
      } else {
        setBaseLat(null);
        setBaseLng(null);
        setServiceAreaAddress('');
        setLocationLabel(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (!msg.toLowerCase().includes('not found')) {
        setError(msg || 'Could not load profile');
      }
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  }, [user, isContractor, labelSavedServiceArea]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  function toggleServiceType(value: string) {
    setServiceTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function fillHomeAddressFromLocation() {
    setAddressLocating(true);
    setError(null);
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setError('Location permission is needed to fill your address.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const results = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (!results.length) {
        setError('Could not determine your address. Please enter it manually.');
        return;
      }
      setHomeAddress(formatGeocodedAddress(results[0]));
    } catch {
      setError('Could not read your location. Enter your address manually.');
    } finally {
      setAddressLocating(false);
    }
  }

  async function fillAddressFromLocation() {
    setAddressLocating(true);
    setError(null);
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setError('Location permission is needed to fill your business address.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setBaseLat(pos.coords.latitude);
      setBaseLng(pos.coords.longitude);
      const results = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (!results.length) {
        setError('Could not determine your address. Please enter it manually.');
        return;
      }
      const label = formatGeocodedAddress(results[0]);
      setServiceAreaAddress(label);
      setLocationLabel(label);
      setBusinessAddress(label);
    } catch {
      setError('Could not read your location. Enter your address manually.');
    } finally {
      setAddressLocating(false);
    }
  }

  async function geocodeServiceArea(
    trimmed: string,
  ): Promise<{ lat: number; lng: number; label: string } | null> {
    const normalized = normalizeAddressDisplay(trimmed);
    try {
      const result = await api.geocodeAddress(normalized);
      return {
        lat: result.lat,
        lng: result.lng,
        label: normalizeAddressDisplay(result.label),
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not look up that address.');
      return null;
    }
  }

  /** Resolve coords from the address field, or fall back to coords already set via GPS. */
  async function resolveServiceAreaForSave(): Promise<{ lat: number; lng: number } | null> {
    const trimmed = normalizeAddressDisplay(serviceAreaAddress);
    if (trimmed.length >= 3) {
      const coords = await geocodeServiceArea(trimmed);
      if (!coords) return null;
      setBaseLat(coords.lat);
      setBaseLng(coords.lng);
      setLocationLabel(coords.label);
      setServiceAreaAddress(coords.label);
      return { lat: coords.lat, lng: coords.lng };
    }
    if (baseLat != null && baseLng != null) {
      return { lat: baseLat, lng: baseLng };
    }
    setError('Enter your service area address or use current location before saving.');
    return null;
  }

  async function applyServiceAreaAddress() {
    const trimmed = normalizeAddressDisplay(serviceAreaAddress);
    if (trimmed.length < 3) {
      setError('Enter an address with city and state for your service area.');
      return;
    }
    setServiceAreaGeocoding(true);
    setError(null);
    try {
      const coords = await geocodeServiceArea(trimmed);
      if (!coords) return;
      setBaseLat(coords.lat);
      setBaseLng(coords.lng);
      setLocationLabel(coords.label);
      setServiceAreaAddress(coords.label);
    } finally {
      setServiceAreaGeocoding(false);
    }
  }

  const serviceAreaBusy = locating || serviceAreaGeocoding;

  function onPhoneChange(value: string) {
    setPhone(formatPhoneInput(value));
  }

  async function pickLogo() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required to choose a logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const contentType =
      asset.mimeType && ALLOWED_LOGO_TYPES.includes(asset.mimeType)
        ? asset.mimeType
        : 'image/jpeg';
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    const fileName = `logo_${Date.now()}.${ext}`;

    setLogoPreviewUri(asset.uri);
    setLogoUploading(true);
    try {
      const signed = await api.signUpload(contentType, fileName);
      const fileUrl = await uploadToSignedUrl(signed, asset.uri, contentType);
      setLogoUrl(fileUrl);
      setLogoPreviewUri(resolveMediaUrl(fileUrl));
    } catch (e) {
      setLogoPreviewUri(logoUrl ? resolveMediaUrl(logoUrl) : null);
      setError(e instanceof Error ? e.message : 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  }

  function removeLogo() {
    setLogoUrl(null);
    setLogoPreviewUri(null);
  }

  async function saveHomeowner() {
    if (phone.trim() && phoneDigits(phone).length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      await api.updateMe({
        phone: phoneForStorage(phone) ?? '',
        homeAddress: homeAddress.trim(),
      });
      setStatus('Profile saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (serviceTypes.length === 0) {
      setError('Select at least one trade you offer.');
      return;
    }

    if (logoUploading) {
      setError('Wait for the logo upload to finish.');
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const coords = await resolveServiceAreaForSave();
      if (!coords) return;

      const trimmedArea = serviceAreaAddress.trim();
      setBaseLat(coords.lat);
      setBaseLng(coords.lng);
      if (trimmedArea) {
        setLocationLabel(trimmedArea);
        setServiceAreaAddress(trimmedArea);
      }

      await api.updateMe({ phone: phoneForStorage(phone) });
      const saved = await api.upsertProfile({
        companyName: companyName.trim() || undefined,
        logoUrl,
        businessAddress: businessAddress.trim() || undefined,
        description: description.trim() || undefined,
        serviceTypes,
        serviceRadiusKm: radiusMiles * 1.60934,
        baseLat: coords.lat,
        baseLng: coords.lng,
        googleReviewsUrl: googleReviewsUrl.trim() || undefined,
      });
      setLogoUrl(saved.logoUrl ? extractMediaKey(saved.logoUrl) ?? saved.logoUrl : null);
      setLogoPreviewUri(saved.logoUrl ? resolveMediaUrl(saved.logoUrl) : null);
      if (saved.baseLat != null && saved.baseLng != null) {
        setBaseLat(saved.baseLat);
        setBaseLng(saved.baseLng);
        await labelSavedServiceArea(
          saved.baseLat,
          saved.baseLng,
          trimmedArea || saved.businessAddress || undefined,
        );
      }
      setHasProfile(true);
      setStatus('Profile saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    Alert.alert('Log out?', 'You will need to sign in again to use DOJOBID.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const phoneDisplay = phone.trim() ? `+1 ${phone.trim()}` : '';
  const tradesDisplay =
    serviceTypes.length > 0
      ? serviceTypes
          .map((v) => SERVICE_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v)
          .join(', ')
      : '';
  const areaCenterDisplay = locating
    ? 'Getting location…'
    : locationLabel ?? (baseLat != null ? 'Location set' : 'Not set yet');
  const showSave = activeSection !== 'account';

  async function handleSave() {
    if (isContractor) {
      if (phone.trim() && phoneDigits(phone).length < 10) {
        setError('Please enter a valid 10-digit phone number.');
        return;
      }
      await save();
      setExpandedField(null);
    } else {
      await saveHomeowner();
      setExpandedField(null);
    }
  }

  function renderPhoneEditor() {
    return (
      <>
        <Text style={s.editorLabel}>Phone</Text>
        <View style={s.phoneRow}>
          <Text style={s.phonePrefix}>+1</Text>
          <TextInput
            style={s.phoneInput}
            value={phone}
            onChangeText={onPhoneChange}
            placeholder="(555) 123-4567"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            maxLength={14}
          />
        </View>
      </>
    );
  }

  function renderSaveBar() {
    if (!showSave) return null;
    return (
      <View style={s.saveBar}>
        {status ? <Text style={s.successText}>{status}</Text> : null}
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        <TouchableOpacity
          style={[s.saveBtn, (saving || logoUploading) && s.saveBtnDisabled]}
          onPress={() => void handleSave()}
          disabled={saving || logoUploading}
        >
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={[s.navHeader, { paddingTop: insets.top + 8 }]}>
        <View style={s.navTrack}>
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  s.navItem,
                  active && s.navItemActive,
                  pressed && s.navItemPressed,
                ]}
                onPress={() => switchSection(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={sectionTitles[item.id]}
              >
                <Text
                  style={[s.navItemText, active && s.navItemTextActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={s.mainScroll}
        contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.loadingText}>Loading profile…</Text>
          </View>
        ) : (
          <>
            <Text style={s.mainTitle}>{sectionTitle}</Text>

            {activeSection === 'personal' ? (
              <View style={s.fieldList}>
                <ProfileFieldRow label="Name" value={fullName} editable={false} />
                <ProfileFieldRow
                  label="Email"
                  value={user.email}
                  editable={false}
                  verified={user.isVerified}
                />
                <ProfileFieldRow label="Role" value={formatRole(user.role)} editable={false} />
                <ProfileFieldRow
                  label="Phone number"
                  value={phoneDisplay}
                  placeholder="Add your phone number"
                  verified={!!phone.trim() && user.isVerified}
                  expanded={expandedField === 'phone'}
                  onPress={() => toggleField('phone')}
                >
                  {renderPhoneEditor()}
                </ProfileFieldRow>
                {!isContractor ? (
                  <ProfileFieldRow
                    label="Home address"
                    value={homeAddress.replace(/\n/g, ', ')}
                    placeholder="Add your home address"
                    expanded={expandedField === 'homeAddress'}
                    onPress={() => toggleField('homeAddress')}
                  >
                    <Text style={s.editorLabel}>Home address</Text>
                    <TextInput
                      style={[s.input, s.textArea]}
                      value={homeAddress}
                      onChangeText={setHomeAddress}
                      placeholder={'Street address\nCity, State ZIP'}
                      placeholderTextColor={colors.muted}
                      multiline
                      textAlignVertical="top"
                    />
                    <Pressable
                      style={({ pressed }) => [s.linkBtn, pressed && s.linkBtnPressed]}
                      onPress={() => void fillHomeAddressFromLocation()}
                      disabled={addressLocating}
                    >
                      <Text style={s.linkBtnText}>
                        {addressLocating ? 'Looking up address…' : 'Use current location'}
                      </Text>
                    </Pressable>
                  </ProfileFieldRow>
                ) : null}
              </View>
            ) : null}

            {activeSection === 'business' && isContractor ? (
              <>
                <View style={s.photoWrap}>
                  <Pressable
                    style={s.photoBtn}
                    onPress={() => void pickLogo()}
                    disabled={logoUploading}
                  >
                    {logoPreviewUri ? (
                      <RemotePhoto
                        uri={logoPreviewUri}
                        style={s.photoImage}
                        containerStyle={s.photoImage}
                        resizeMode="cover"
                        fallback={
                          <Text style={s.photoInitials}>
                            {companyName.trim() ? companyName.trim().slice(0, 2).toUpperCase() : 'CO'}
                          </Text>
                        }
                      />
                    ) : (
                      <Text style={s.photoInitials}>
                        {companyName.trim() ? companyName.trim().slice(0, 2).toUpperCase() : 'CO'}
                      </Text>
                    )}
                    {logoUploading ? (
                      <View style={s.photoOverlay}>
                        <ActivityIndicator color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [s.photoEdit, pressed && s.photoEditPressed]}
                    onPress={() => void pickLogo()}
                    disabled={logoUploading}
                    accessibilityLabel="Edit company logo"
                  >
                    <Text style={s.photoEditText}>Edit</Text>
                  </Pressable>
                </View>

                <View style={s.fieldList}>
                  <ProfileFieldRow
                    label="Company name"
                    value={companyName}
                    placeholder="Add your company name"
                    expanded={expandedField === 'companyName'}
                    onPress={() => toggleField('companyName')}
                  >
                    <Text style={s.editorLabel}>Company name</Text>
                    <TextInput
                      style={s.input}
                      value={companyName}
                      onChangeText={setCompanyName}
                      placeholder="Smith Plumbing LLC"
                      placeholderTextColor={colors.muted}
                    />
                  </ProfileFieldRow>

                  <ProfileFieldRow
                    label="About your business"
                    value={description}
                    placeholder="Tell homeowners about your experience"
                    expanded={expandedField === 'description'}
                    onPress={() => toggleField('description')}
                  >
                    <Text style={s.editorLabel}>About your business</Text>
                    <TextInput
                      style={[s.input, s.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Briefly describe your experience and services…"
                      placeholderTextColor={colors.muted}
                      multiline
                      textAlignVertical="top"
                    />
                  </ProfileFieldRow>

                  <ProfileFieldRow
                    label="Business address"
                    value={businessAddress.replace(/\n/g, ', ')}
                    placeholder="Add your business address"
                    expanded={expandedField === 'businessAddress'}
                    onPress={() => toggleField('businessAddress')}
                  >
                    <Text style={s.editorLabel}>Business address</Text>
                    <TextInput
                      style={[s.input, s.textArea]}
                      value={businessAddress}
                      onChangeText={setBusinessAddress}
                      placeholder={'Street address\nCity, State ZIP'}
                      placeholderTextColor={colors.muted}
                      multiline
                      textAlignVertical="top"
                    />
                    <Pressable
                      style={({ pressed }) => [s.linkBtn, pressed && s.linkBtnPressed]}
                      onPress={() => void fillAddressFromLocation()}
                      disabled={addressLocating}
                    >
                      <Text style={s.linkBtnText}>
                        {addressLocating ? 'Looking up address…' : 'Use current location'}
                      </Text>
                    </Pressable>
                  </ProfileFieldRow>

                  <ProfileFieldRow
                    label="Google reviews"
                    value={googleReviewsUrl}
                    placeholder="Add your Google reviews link"
                    expanded={expandedField === 'googleReviews'}
                    onPress={() => toggleField('googleReviews')}
                  >
                    <Text style={s.editorLabel}>Google reviews link</Text>
                    <TextInput
                      style={s.input}
                      value={googleReviewsUrl}
                      onChangeText={setGoogleReviewsUrl}
                      placeholder="https://g.page/your-business/review"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </ProfileFieldRow>

                  {logoPreviewUri ? (
                    <Pressable onPress={removeLogo} disabled={logoUploading}>
                      <Text style={s.dangerLink}>Remove company logo</Text>
                    </Pressable>
                  ) : null}
                </View>

                {!hasProfile ? (
                  <Text style={s.sectionHint}>
                    Complete your business profile so we can match you with nearby jobs.
                  </Text>
                ) : null}
              </>
            ) : null}

            {activeSection === 'service' && isContractor ? (
              <View style={s.fieldList}>
                <ProfileFieldRow
                  label="Trades you offer"
                  value={tradesDisplay}
                  placeholder="Select your trades"
                  expanded={expandedField === 'trades'}
                  onPress={() => toggleField('trades')}
                >
                  <Text style={s.editorHint}>Select all trades you want to bid on.</Text>
                  <View style={s.chipWrap}>
                    {SERVICE_TYPE_OPTIONS.map((t) => {
                      const active = serviceTypes.includes(t.value);
                      return (
                        <TouchableOpacity
                          key={t.value}
                          onPress={() => toggleServiceType(t.value)}
                          style={[s.chip, active && s.chipActive]}
                        >
                          <Text style={[s.chipText, active && s.chipTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ProfileFieldRow>

                <ProfileFieldRow
                  label="Travel radius"
                  value={radiusMiles ? `${radiusMiles} mi` : ''}
                  placeholder="Set travel radius"
                  expanded={expandedField === 'radius'}
                  onPress={() => toggleField('radius')}
                >
                  <View style={s.segmentRow}>
                    {RADIUS_MILES.map((miles) => {
                      const active = radiusMiles === miles;
                      return (
                        <TouchableOpacity
                          key={miles}
                          onPress={() => setRadiusMiles(miles)}
                          style={[s.segment, active && s.segmentActive]}
                        >
                          <Text style={[s.segmentText, active && s.segmentTextActive]}>{miles} mi</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ProfileFieldRow>

                <ProfileFieldRow
                  label="Area center"
                  value={areaCenterDisplay}
                  placeholder="Set your service area center"
                  expanded={expandedField === 'location'}
                  onPress={() => toggleField('location')}
                >
                  <Text style={s.editorHint}>
                    Used to match you with nearby jobs. Your exact location is not shown publicly.
                  </Text>
                  <View style={s.serviceAreaInputRow}>
                    <TextInput
                      style={[s.input, s.serviceAreaInput]}
                      value={serviceAreaAddress}
                      onChangeText={setServiceAreaAddress}
                      placeholder="Street address, city, state"
                      placeholderTextColor={colors.muted}
                      returnKeyType="done"
                      onSubmitEditing={() => void applyServiceAreaAddress()}
                      editable={!serviceAreaBusy}
                    />
                    {serviceAreaAddress.length > 0 ? (
                      <TouchableOpacity
                        style={s.serviceAreaClear}
                        onPress={() => setServiceAreaAddress('')}
                        disabled={serviceAreaBusy}
                        accessibilityLabel="Clear address"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.muted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={s.serviceAreaActions}>
                    <Pressable
                      style={({ pressed }) => [
                        s.serviceAreaBtn,
                        s.serviceAreaBtnSecondary,
                        pressed && s.serviceAreaBtnSecondaryPressed,
                      ]}
                      onPress={() => void resolveLocation()}
                      disabled={serviceAreaBusy}
                    >
                      {locating ? (
                        <ActivityIndicator size="small" color={colors.text} />
                      ) : (
                        <Text style={s.serviceAreaBtnSecondaryText}>
                          {baseLat != null ? 'Update GPS location' : 'Set GPS location'}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        s.serviceAreaBtn,
                        s.serviceAreaBtnPrimary,
                        pressed && s.serviceAreaBtnPressed,
                      ]}
                      onPress={() => void applyServiceAreaAddress()}
                      disabled={serviceAreaBusy}
                    >
                      {serviceAreaGeocoding ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.serviceAreaBtnPrimaryText}>Set location</Text>
                      )}
                    </Pressable>
                  </View>
                </ProfileFieldRow>
              </View>
            ) : null}

            {activeSection === 'account' ? (
              <View style={s.fieldList}>
                <ProfileFieldRow label="Signed in as" value={user.email} editable={false} />
                <ProfileFieldRow label="Account type" value={formatRole(user.role)} editable={false} />
                <ProfileFieldRow
                  label="Log out"
                  value=""
                  placeholder="Sign out on this device"
                  actionLabel={null}
                  onPress={confirmLogout}
                />
              </View>
            ) : null}

            {renderSaveBar()}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
