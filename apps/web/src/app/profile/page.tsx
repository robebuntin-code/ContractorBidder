'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, uploadToSignedUrl } from '@/lib/api';
import { getBestCurrentPosition, reverseGeocode } from '@/lib/geocode';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { formatPhoneDisplay, formatPhoneInput, phoneDigits, phoneForStorage } from '@/lib/phoneFormat';
import { inferImageContentType, imageExtensionForContentType } from '@/lib/uploadUtils';
import { formatRole, SERVICE_TYPE_OPTIONS } from '@/lib/theme';
import { useAuth } from '@/components/AuthProvider';

const RADIUS_MILES = [10, 25, 50] as const;

type ProfileSection = 'personal' | 'business' | 'service' | 'account';

function kmToRadiusMiles(km: number | null | undefined): (typeof RADIUS_MILES)[number] {
  if (km == null) return 25;
  const miles = km / 1.60934;
  if (miles <= 15) return 10;
  if (miles <= 37) return 25;
  return 50;
}

function ChevronRight() {
  return (
    <svg className="account-field-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VerifiedBadge() {
  return (
    <span className="account-verified" aria-label="Verified">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="var(--success)" />
        <path
          d="M8 12l2.5 2.5L16 9"
          stroke="var(--white)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileFieldRow({
  label,
  value,
  placeholder = 'Add',
  verified,
  editable = true,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  placeholder?: string;
  verified?: boolean;
  editable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  const display = value.trim() || placeholder;
  const isPlaceholder = !value.trim();

  if (!editable) {
    return (
      <div className="account-field">
        <div className="account-field-row account-field-row-static">
          <div className="account-field-body">
            <span className="account-field-label">{label}</span>
            <span className={`account-field-value${isPlaceholder ? ' placeholder' : ''}`}>{display}</span>
          </div>
          {verified ? <VerifiedBadge /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`account-field${expanded ? ' expanded' : ''}`}>
      <button type="button" className="account-field-row" onClick={onToggle} aria-expanded={expanded}>
        <div className="account-field-body">
          <span className="account-field-label">{label}</span>
          <span className={`account-field-value${isPlaceholder ? ' placeholder' : ''}`}>{display}</span>
        </div>
        {verified ? <VerifiedBadge /> : null}
        <ChevronRight />
      </button>
      {expanded && children ? <div className="account-field-editor">{children}</div> : null}
    </div>
  );
}

function AccountPhoto({
  preview,
  initialsText,
  uploading,
  onEdit,
  showEdit = true,
}: {
  preview: string | null;
  initialsText: string;
  uploading?: boolean;
  onEdit: () => void;
  showEdit?: boolean;
}) {
  return (
    <div className="account-photo">
      <button
        type="button"
        className="account-photo-btn"
        onClick={showEdit ? onEdit : undefined}
        disabled={uploading || !showEdit}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="account-photo-img" />
        ) : (
          <span className="account-photo-initials">{initialsText}</span>
        )}
        {uploading ? <span className="account-photo-overlay">Uploading…</span> : null}
      </button>
      {showEdit ? (
        <button type="button" className="account-photo-edit" onClick={onEdit} disabled={uploading} aria-label="Edit photo">
          <PencilIcon />
        </button>
      ) : null}
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout, refresh: refreshAuth } = useAuth();
  const isContractor = user?.role === 'CONTRACTOR';

  const [loading, setLoading] = useState(isContractor);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileSection>('personal');
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [phone, setPhone] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [description, setDescription] = useState('');
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [radiusMiles, setRadiusMiles] = useState<(typeof RADIUS_MILES)[number]>(25);
  const [baseLat, setBaseLat] = useState<number | null>(null);
  const [baseLng, setBaseLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [addressLocating, setAddressLocating] = useState(false);
  const [googleReviewsUrl, setGoogleReviewsUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const navItems: { id: ProfileSection; label: string; shortLabel: string }[] = isContractor
    ? [
        { id: 'personal', label: 'Personal info', shortLabel: 'Personal' },
        { id: 'business', label: 'Business', shortLabel: 'Business' },
        { id: 'service', label: 'Service area', shortLabel: 'Service' },
        { id: 'account', label: 'Account', shortLabel: 'Account' },
      ]
    : [
        { id: 'personal', label: 'Personal info', shortLabel: 'Personal' },
        { id: 'account', label: 'Account', shortLabel: 'Account' },
      ];

  const sectionTitle =
    navItems.find((item) => item.id === activeSection)?.label ?? 'Personal info';

  function toggleField(field: string) {
    setExpandedField((prev) => (prev === field ? null : field));
  }

  function switchSection(section: ProfileSection) {
    setActiveSection(section);
    setExpandedField(null);
    setStatus(null);
    setError(null);
  }

  const resolveLocation = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const { lat, lng } = await getBestCurrentPosition();
      setBaseLat(lat);
      setBaseLng(lng);
      setLocationLabel('Your current location');
      return true;
    } catch {
      setLocationLabel('Could not read location');
      setError('Could not read your location. Try again or enter a business address.');
      return false;
    } finally {
      setLocating(false);
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
      setLogoUrl(profile.logoUrl ?? null);
      setLogoPreview(profile.logoUrl ? resolveMediaUrl(profile.logoUrl) : null);
      setPhone(formatPhoneDisplay(profile.phone));
      setBusinessAddress(profile.businessAddress ?? '');
      setDescription(profile.description ?? '');
      setServiceTypes(profile.serviceTypes ?? []);
      setRadiusMiles(kmToRadiusMiles(profile.serviceRadiusKm));
      setGoogleReviewsUrl(profile.googleReviewsUrl ?? '');
      if (profile.baseLat != null && profile.baseLng != null) {
        setBaseLat(profile.baseLat);
        setBaseLng(profile.baseLng);
        setLocationLabel('Saved service area');
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
  }, [user, isContractor]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function toggleServiceType(value: string) {
    setServiceTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function fillHomeAddressFromLocation() {
    setAddressLocating(true);
    setError(null);
    try {
      const { lat, lng } = await getBestCurrentPosition();
      setHomeAddress((await reverseGeocode(lat, lng)).label);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read your location.');
    } finally {
      setAddressLocating(false);
    }
  }

  async function fillAddressFromLocation() {
    setAddressLocating(true);
    setError(null);
    try {
      const { lat, lng } = await getBestCurrentPosition();
      setBaseLat(lat);
      setBaseLng(lng);
      setLocationLabel('Your current location');
      setBusinessAddress((await reverseGeocode(lat, lng)).label);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read your location.');
    } finally {
      setAddressLocating(false);
    }
  }

  async function onLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    const contentType = inferImageContentType(file);
    const ext = imageExtensionForContentType(contentType);
    const fileName = `logo_${Date.now()}.${ext}`;

    setLogoPreview(URL.createObjectURL(file));
    setLogoUploading(true);
    try {
      const signed = await api.signUpload(contentType, fileName);
      const fileUrl = await uploadToSignedUrl(signed, file, contentType);
      setLogoUrl(fileUrl);
      setLogoPreview(resolveMediaUrl(fileUrl));
    } catch (err) {
      setLogoPreview(logoUrl ? resolveMediaUrl(logoUrl) : null);
      setError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  }

  function removeLogo() {
    setLogoUrl(null);
    setLogoPreview(null);
  }

  async function saveHomeowner(e: React.FormEvent) {
    e.preventDefault();
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
      setExpandedField(null);
      await refreshAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function saveContractor(e: React.FormEvent) {
    e.preventDefault();
    if (baseLat == null || baseLng == null) {
      setError('Set your service area location before saving.');
      return;
    }
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
      await api.updateMe({ phone: phoneForStorage(phone) });
      await api.upsertProfile({
        companyName: companyName.trim() || undefined,
        logoUrl,
        businessAddress: businessAddress.trim() || undefined,
        description: description.trim() || undefined,
        serviceTypes,
        serviceRadiusKm: radiusMiles * 1.60934,
        baseLat,
        baseLng,
        googleReviewsUrl: googleReviewsUrl.trim() || undefined,
      });
      setHasProfile(true);
      setLocationLabel('Saved service area');
      setStatus('Profile saved');
      setExpandedField(null);
      await refreshAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <p className="error">
        Sign in to view your profile — <Link href="/login">sign in</Link>.
      </p>
    );
  }

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

  return (
    <div className="account-shell">
      <div className="account-layout">
        <nav className="account-sidebar" aria-label="Account sections">
          <div
            className="account-nav-track"
            style={{ ['--account-nav-count' as string]: navItems.length }}
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`account-nav-item${activeSection === item.id ? ' active' : ''}`}
                onClick={() => switchSection(item.id)}
              >
                <span className="account-nav-label account-nav-label-full">{item.label}</span>
                <span className="account-nav-label account-nav-label-short">{item.shortLabel}</span>
              </button>
            ))}
          </div>
        </nav>

        {loading ? (
          <div className="account-main">
            <p className="muted">Loading profile…</p>
          </div>
        ) : (
          <form
            className="account-main"
            onSubmit={(e) => void (isContractor ? saveContractor(e) : saveHomeowner(e))}
          >
            <h1 className="account-main-title">{sectionTitle}</h1>

            {activeSection === 'personal' ? (
              <div className="account-field-list">
                  <ProfileFieldRow label="Name" value={fullName} editable={false} />
                  <ProfileFieldRow
                    label="Email"
                    value={user.email}
                    editable={false}
                    verified={user.isVerified}
                  />
                  <ProfileFieldRow
                    label="Role"
                    value={formatRole(user.role)}
                    editable={false}
                  />
                  <ProfileFieldRow
                    label="Phone number"
                    value={phoneDisplay}
                    placeholder="Add your phone number"
                    verified={!!phone.trim() && user.isVerified}
                    expanded={expandedField === 'phone'}
                    onToggle={() => toggleField('phone')}
                  >
                    <label className="field-label" htmlFor="profile-phone">
                      Phone
                    </label>
                    <div className="phone-row">
                      <span className="phone-prefix">+1</span>
                      <input
                        id="profile-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                        placeholder="(555) 123-4567"
                        maxLength={14}
                        autoFocus
                      />
                    </div>
                  </ProfileFieldRow>

                  {!isContractor ? (
                    <ProfileFieldRow
                      label="Home address"
                      value={homeAddress.replace(/\n/g, ', ')}
                      placeholder="Add your home address"
                      expanded={expandedField === 'homeAddress'}
                      onToggle={() => toggleField('homeAddress')}
                    >
                      <label className="field-label" htmlFor="home-address">
                        Home address
                      </label>
                      <textarea
                        id="home-address"
                        rows={3}
                        value={homeAddress}
                        onChange={(e) => setHomeAddress(e.target.value)}
                        placeholder={'Street address\nCity, State ZIP'}
                        autoFocus
                      />
                      <div className="address-actions">
                        <button
                          type="button"
                          className="address-btn secondary"
                          disabled={addressLocating}
                          onClick={() => void fillHomeAddressFromLocation()}
                        >
                          {addressLocating ? 'Looking up address…' : 'Use current location'}
                        </button>
                      </div>
                    </ProfileFieldRow>
                  ) : null}
                </div>
            ) : null}

            {activeSection === 'business' && isContractor ? (
              <>
                <AccountPhoto
                  preview={logoPreview}
                  initialsText={companyName.trim() ? companyName.trim().slice(0, 2).toUpperCase() : 'CO'}
                  uploading={logoUploading}
                  onEdit={() => logoInputRef.current?.click()}
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void onLogoSelected(e)}
                />

                <div className="account-field-list">
                  <ProfileFieldRow
                    label="Company name"
                    value={companyName}
                    placeholder="Add your company name"
                    expanded={expandedField === 'companyName'}
                    onToggle={() => toggleField('companyName')}
                  >
                    <label className="field-label" htmlFor="companyName">
                      Company name
                    </label>
                    <input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Smith Plumbing LLC"
                      autoFocus
                    />
                  </ProfileFieldRow>

                  <ProfileFieldRow
                    label="About your business"
                    value={description}
                    placeholder="Tell homeowners about your experience"
                    expanded={expandedField === 'description'}
                    onToggle={() => toggleField('description')}
                  >
                    <label className="field-label" htmlFor="about">
                      About your business
                    </label>
                    <textarea
                      id="about"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Briefly describe your experience and services…"
                      autoFocus
                    />
                  </ProfileFieldRow>

                  <ProfileFieldRow
                    label="Business address"
                    value={businessAddress.replace(/\n/g, ', ')}
                    placeholder="Add your business address"
                    expanded={expandedField === 'businessAddress'}
                    onToggle={() => toggleField('businessAddress')}
                  >
                    <label className="field-label" htmlFor="business-address">
                      Business address
                    </label>
                    <textarea
                      id="business-address"
                      rows={3}
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      placeholder={'Street address\nCity, State ZIP'}
                      autoFocus
                    />
                    <div className="address-actions">
                      <button
                        type="button"
                        className="address-btn secondary"
                        disabled={addressLocating}
                        onClick={() => void fillAddressFromLocation()}
                      >
                        {addressLocating ? 'Looking up address…' : 'Use current location'}
                      </button>
                    </div>
                  </ProfileFieldRow>

                  <ProfileFieldRow
                    label="Google reviews"
                    value={googleReviewsUrl}
                    placeholder="Add your Google reviews link"
                    expanded={expandedField === 'googleReviews'}
                    onToggle={() => toggleField('googleReviews')}
                  >
                    <label className="field-label" htmlFor="googleReviews">
                      Google reviews link
                    </label>
                    <input
                      id="googleReviews"
                      value={googleReviewsUrl}
                      onChange={(e) => setGoogleReviewsUrl(e.target.value)}
                      placeholder="https://g.page/your-business/review"
                      autoFocus
                    />
                  </ProfileFieldRow>

                  {logoPreview ? (
                    <div className="account-field-editor account-field-editor-inline">
                      <button type="button" className="action-link danger" onClick={removeLogo}>
                        Remove company logo
                      </button>
                    </div>
                  ) : null}
                </div>

                {!hasProfile ? (
                  <p className="account-section-hint">
                    Complete your business profile so we can match you with nearby jobs.
                  </p>
                ) : null}
              </>
            ) : null}

            {activeSection === 'service' && isContractor ? (
              <div className="account-field-list">
                <ProfileFieldRow
                  label="Trades you offer"
                  value={tradesDisplay}
                  placeholder="Select your trades"
                  expanded={expandedField === 'trades'}
                  onToggle={() => toggleField('trades')}
                >
                  <p className="field-hint">Select all trades you want to bid on.</p>
                  <div className="chip-wrap">
                    {SERVICE_TYPE_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        className={`chip${serviceTypes.includes(t.value) ? ' active' : ''}`}
                        onClick={() => toggleServiceType(t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </ProfileFieldRow>

                <ProfileFieldRow
                  label="Travel radius"
                  value={radiusMiles ? `${radiusMiles} mi` : ''}
                  placeholder="Set travel radius"
                  expanded={expandedField === 'radius'}
                  onToggle={() => toggleField('radius')}
                >
                  <div className="segment-row">
                    {RADIUS_MILES.map((miles) => (
                      <button
                        key={miles}
                        type="button"
                        className={`segment${radiusMiles === miles ? ' active' : ''}`}
                        onClick={() => setRadiusMiles(miles)}
                      >
                        {miles} mi
                      </button>
                    ))}
                  </div>
                </ProfileFieldRow>

                <ProfileFieldRow
                  label="Area center"
                  value={areaCenterDisplay}
                  placeholder="Set your service area center"
                  expanded={expandedField === 'location'}
                  onToggle={() => toggleField('location')}
                >
                  <p className="field-hint">
                    Used to match you with nearby jobs. Your exact location is not shown publicly.
                  </p>
                  <button
                    type="button"
                    className="address-btn secondary"
                    disabled={locating}
                    onClick={() => void resolveLocation()}
                  >
                    {locating ? 'Getting location…' : baseLat != null ? 'Update GPS location' : 'Set GPS location'}
                  </button>
                </ProfileFieldRow>
              </div>
            ) : null}

            {activeSection === 'account' ? (
              <div className="account-field-list">
                <ProfileFieldRow label="Signed in as" value={user.email} editable={false} />
                <ProfileFieldRow label="Account type" value={formatRole(user.role)} editable={false} />
                <div className="account-field">
                  <button
                    type="button"
                    className="account-field-row account-logout-row"
                    onClick={() => {
                      if (window.confirm('Log out? You will need to sign in again to use DOJOBID.')) logout();
                    }}
                  >
                    <div className="account-field-body">
                      <span className="account-field-label">Log out</span>
                      <span className="account-field-value placeholder">Sign out on this device</span>
                    </div>
                    <ChevronRight />
                  </button>
                </div>
              </div>
            ) : null}

            {showSave ? (
              <div className="account-save-bar">
                {status ? <p className="success-text">{status}</p> : null}
                {error ? (
                  <div className="error-box">
                    <p className="error" style={{ margin: 0 }}>
                      {error}
                    </p>
                  </div>
                ) : null}
                <button
                  type="submit"
                  className="btn-primary account-save-btn"
                  disabled={saving || logoUploading}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
