import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  api,
  uploadToSignedUrl,
  type AcceptanceFeeStatus,
  type Bid,
  type ContractorReview,
  type JobFull,
  type Message,
} from '../api';
import { WEB_URL } from '../config';
import { useAuth } from '../auth';
import { useUnreadNotifications } from '../unreadNotifications';
import { useRealtime } from '../realtime';
import { colors, formatBudget, formatWorkType, styles } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SharedStackParamList } from '../navTypes';
import { resolveMediaUrl, resolvePhotoComparisons, resolvePhotoUrls } from '../utils/mediaUrl';
import RemotePhoto from '../components/RemotePhoto';
import { JobScopeComparisons } from '../components/JobScopeComparisons';
import { formatJobTimeframe, jobTimeframeHeading } from '../utils/jobDates';

const MAX_MESSAGE_PHOTOS = 4;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

interface PendingMessagePhoto {
  id: string;
  previewUri: string;
  fileUrl: string | null;
}

export default function JobDetailScreen({ route, navigation }: NativeStackScreenProps<SharedStackParamList, 'JobDetail'>) {
  const { jobId } = route.params;
  const { user } = useAuth();
  const { refresh: refreshUnreadNotifications } = useUnreadNotifications();

  const [job, setJob] = useState<JobFull | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [draft, setDraft] = useState('');
  const [counterpart, setCounterpart] = useState<string>('');
  const [pendingPhotos, setPendingPhotos] = useState<PendingMessagePhoto[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [review, setReview] = useState<ContractorReview | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [acceptanceFee, setAcceptanceFee] = useState<AcceptanceFeeStatus | null>(null);
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [j, flags] = await Promise.all([
        api.getJob(jobId),
        api.getFlags().catch(() => ({ paymentsEnabled: false })),
      ]);
      setPaymentsEnabled(flags.paymentsEnabled);
      setJob({
        ...j,
        photos: resolvePhotoUrls(j.photos),
        photoComparisons: resolvePhotoComparisons(j.photoComparisons),
      });
      if (user?.id === j.createdByUserId && j.status === 'AWARDED') {
        try {
          setAcceptanceFee(await api.getAcceptanceFeeStatus(jobId));
        } catch {
          setAcceptanceFee(null);
        }
      } else {
        setAcceptanceFee(null);
      }
      try {
        setBids(await api.listBids(jobId));
      } catch {
        setBids([]);
      }
      try {
        const raw = await api.listMessages(jobId);
        setMessages(
          raw.map((m) => ({
            ...m,
            attachments: m.attachments.map((url) => resolveMediaUrl(url)),
          })),
        );
      } catch {
        setMessages([]);
      }
      try {
        setReview(await api.getJobReview(jobId));
      } catch {
        setReview(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load job');
    }
  }, [jobId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime(jobId, {
    onBid: () => {
      void api.listBids(jobId).then(setBids).catch(() => undefined);
    },
    onMessage: (payload) => {
      const msg = payload as Message;
      const normalized: Message = {
        ...msg,
        attachments: msg.attachments.map((url) => resolveMediaUrl(url)),
      };
      setMessages((prev) =>
        prev.some((m) => m.id === normalized.id) ? prev : [...prev, normalized],
      );
    },
  });

  if (error) return <Text style={[styles.error, { padding: 16 }]}>{error}</Text>;
  if (!job || !user) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const isOwner = job.createdByUserId === user.id;
  const isContractor = user.role === 'CONTRACTOR' && !isOwner;
  const canEdit = isOwner && job.status === 'OPEN' && bids.length === 0;
  const myBid = bids.find((b) => b.contractorUserId === user.id);
  const currentUserId = user.id;

  const messagedContractorIds = messages
    .filter((m) => m.fromUserId === job.createdByUserId || m.toUserId === job.createdByUserId)
    .map((m) => (m.fromUserId === job.createdByUserId ? m.toUserId : m.fromUserId));
  const counterpartOptions = isOwner
    ? Array.from(new Set([...bids.map((b) => b.contractorUserId), ...messagedContractorIds]))
    : [job.createdByUserId];
  const activeCounterpart = counterpart || counterpartOptions[0] || '';
  const thread = messages.filter(
    (m) => m.fromUserId === activeCounterpart || m.toUserId === activeCounterpart,
  );
  const canMessage = isOwner
    ? counterpartOptions.length > 0 && !!activeCounterpart
    : !!activeCounterpart && (job.status === 'OPEN' || !!myBid);
  const acceptedBid =
    bids.find((b) => b.id === job.acceptedBidId) ?? bids.find((b) => b.status === 'ACCEPTED');
  const awardedContractorId =
    job.status === 'AWARDED' ? acceptedBid?.contractorUserId ?? null : null;
  const awardedContractorName = (() => {
    if (!awardedContractorId) return null;
    if (acceptedBid?.contractor) {
      return acceptedBid.contractor.displayName;
    }
    if (user.id === awardedContractorId) {
      return `${user.firstName} ${user.lastName}`;
    }
    return null;
  })();

  async function placeBid() {
    if (!amount) return;
    setError(null);
    setNotice(null);
    try {
      await api.createBid(jobId, Math.round(Number(amount) * 100), bidMessage || undefined);
      setAmount('');
      setBidMessage('');
      setNotice('Bid submitted.');
      await refreshUnreadNotifications();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place bid');
    }
  }

  async function completeAcceptancePayment() {
    await Linking.openURL(`${WEB_URL}/jobs/${jobId}`);
  }

  async function acceptBidNow(bidId: string) {
    setAcceptingBidId(bidId);
    setError(null);
    try {
      const result = await api.acceptBid(bidId);
      if (result.paymentRequired) {
        setNotice('Bid accepted. Complete the $1 payment on the web to share your address.');
        Alert.alert(
          'Pay $1 acceptance fee',
          'Open dojobid.com in your browser to pay the acceptance fee and share the job address with your contractor.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Pay now', onPress: () => void completeAcceptancePayment() },
          ],
        );
      } else {
        setNotice('Bid accepted.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept bid');
    } finally {
      setAcceptingBidId(null);
    }
  }

  function accept(bidId: string) {
    if (paymentsEnabled) {
      Alert.alert(
        'Accept this bid?',
        'A $1 acceptance fee is required before the contractor can see your address.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Accept', onPress: () => void acceptBidNow(bidId) },
        ],
      );
      return;
    }
    void acceptBidNow(bidId);
  }

  async function submitReview() {
    setReviewError(null);
    setSubmittingReview(true);
    try {
      const created = await api.createJobReview(jobId, reviewRating, reviewComment || undefined);
      setReview(created);
      setNotice('Thanks for your review.');
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Could not submit review');
    } finally {
      setSubmittingReview(false);
    }
  }

  function renderStars(rating: number, interactive = false) {
    return (
      <View style={{ flexDirection: 'row', gap: 4, marginVertical: 8 }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= rating;
          const starEl = (
            <Text style={{ fontSize: 28, color: filled ? '#f59e0b' : colors.border }}>
              {filled ? '★' : '☆'}
            </Text>
          );
          if (!interactive) return <View key={star}>{starEl}</View>;
          return (
            <TouchableOpacity key={star} onPress={() => setReviewRating(star)} disabled={submittingReview}>
              {starEl}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  async function addMessagePhoto() {
    if (pendingPhotos.length >= MAX_MESSAGE_PHOTOS) return;
    setMessageError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setMessageError('Photo library permission is required to attach photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const contentType =
      asset.mimeType && ALLOWED_IMAGE_TYPES.includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    const fileName = `message_${Date.now()}.${ext}`;
    const draftId = fileName;

    setPendingPhotos((prev) => [...prev, { id: draftId, previewUri: asset.uri, fileUrl: null }]);
    setUploadingPhotos(true);
    try {
      const signed = await api.signUpload(contentType, fileName);
      const fileUrl = await uploadToSignedUrl(signed, asset.uri, contentType);
      setPendingPhotos((prev) => prev.map((p) => (p.id === draftId ? { ...p, fileUrl } : p)));
    } catch (e) {
      setPendingPhotos((prev) => prev.filter((p) => p.id !== draftId));
      setMessageError(e instanceof Error ? e.message : 'Photo upload failed');
    } finally {
      setUploadingPhotos(false);
    }
  }

  function removePendingPhoto(id: string) {
    setPendingPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function send() {
    if (!activeCounterpart) return;
    const body = draft.trim();
    const attachments = pendingPhotos
      .map((p) => p.fileUrl)
      .filter((url): url is string => !!url);
    if (!body && attachments.length === 0) return;
    if (uploadingPhotos || pendingPhotos.some((p) => !p.fileUrl)) return;

    setSendingMessage(true);
    setMessageError(null);
    try {
      await api.sendMessage(jobId, activeCounterpart, body, attachments);
      setDraft('');
      setPendingPhotos([]);
      setMessages(
        (await api.listMessages(jobId)).map((m) => ({
          ...m,
          attachments: m.attachments.map((url) => resolveMediaUrl(url)),
        })),
      );
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : 'Could not send message');
    } finally {
      setSendingMessage(false);
    }
  }

  function renderMessageBubble(m: Message) {
    const isMine = m.fromUserId === currentUserId;
    return (
      <View
        key={m.id}
        style={{
          alignSelf: isMine ? 'flex-end' : 'flex-start',
          backgroundColor: isMine ? colors.primary : '#f1f5f9',
          padding: 8,
          borderRadius: 12,
          marginVertical: 3,
          maxWidth: '80%',
        }}
      >
        {m.body ? (
          <Text style={{ color: isMine ? '#fff' : colors.text }}>{m.body}</Text>
        ) : null}
        {m.attachments.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: m.body ? 6 : 0 }}>
            {m.attachments.map((uri) => (
              <RemotePhoto
                key={uri}
                uri={resolveMediaUrl(uri)}
                style={{ width: 120, height: 90, borderRadius: 8 }}
                containerStyle={{ width: 120, height: 90, borderRadius: 8, overflow: 'hidden' }}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  function renderMessageComposer(placeholder: string) {
    const readyToSend =
      !uploadingPhotos &&
      !sendingMessage &&
      !pendingPhotos.some((p) => !p.fileUrl) &&
      (draft.trim().length > 0 || pendingPhotos.some((p) => p.fileUrl));

    return (
      <>
        {pendingPhotos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            style={{ marginBottom: 8, height: 72 }}
          >
            {pendingPhotos.map((photo) => (
              <View key={photo.id} style={{ marginRight: 8, position: 'relative' }}>
                <Image
                  source={{ uri: photo.previewUri }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 8,
                    opacity: photo.fileUrl ? 1 : 0.6,
                  }}
                />
                <TouchableOpacity
                  onPress={() => removePendingPhoto(photo.id)}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: colors.text,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            editable={!sendingMessage}
          />
          <TouchableOpacity
            style={[styles.buttonSecondary, { marginTop: 0, paddingHorizontal: 10 }]}
            onPress={addMessagePhoto}
            disabled={
              uploadingPhotos || sendingMessage || pendingPhotos.length >= MAX_MESSAGE_PHOTOS
            }
          >
            <Text style={styles.buttonTextSecondary}>{uploadingPhotos ? '…' : 'Photo'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              { marginTop: 0, justifyContent: 'center', opacity: readyToSend ? 1 : 0.5 },
            ]}
            onPress={send}
            disabled={!readyToSend}
          >
            <Text style={styles.buttonText}>{sendingMessage ? '…' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.badge}>{formatWorkType(job.workType)}</Text>
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.muted}>
          {formatBudget(job.budgetMin, job.budgetMax, job.currency)} · {job.status}
        </Text>
        <Text style={[styles.muted, { marginTop: 6 }]}>
          {jobTimeframeHeading(job.desiredDatetimeStart, job.desiredDatetimeEnd)}:{' '}
          {formatJobTimeframe(job.desiredDatetimeStart, job.desiredDatetimeEnd)}
        </Text>
        {notice && <Text style={{ color: colors.success, marginTop: 6 }}>{notice}</Text>}

        {canEdit && (
          <TouchableOpacity
            style={[styles.buttonSecondary, { marginTop: 12 }]}
            onPress={() => navigation.navigate('PostJob', { jobId: job.id })}
          >
            <Text style={styles.buttonTextSecondary}>Edit job</Text>
          </TouchableOpacity>
        )}

        {isOwner && job.status === 'AWARDED' && acceptanceFee?.required ? (
          <View style={[styles.card, { marginTop: 12, backgroundColor: '#fffbeb' }]}>
            <Text style={styles.subtitle}>Payment required</Text>
            <Text style={[styles.muted, { marginBottom: 12 }]}>
              Pay the $1 acceptance fee so your contractor can see the job address.
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => void completeAcceptancePayment()}>
              <Text style={styles.buttonText}>Pay $1 on web</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {awardedContractorId && (
          <View style={[styles.card, { marginTop: 12, backgroundColor: '#eff6ff' }]}>
            <Text style={styles.subtitle}>Awarded contractor</Text>
            <Text style={{ color: colors.text, marginBottom: 10 }}>
              {awardedContractorName ?? 'Your selected contractor'} will perform this job.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() =>
                navigation.navigate('ContractorProfile', { userId: awardedContractorId })
              }
            >
              <Text style={styles.buttonText}>View contractor profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {isOwner && job.status === 'AWARDED' && (
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.subtitle}>Review contractor</Text>
            {review ? (
              <>
                {renderStars(review.rating)}
                {review.comment ? (
                  <Text style={{ color: colors.text, marginTop: 4 }}>{review.comment}</Text>
                ) : null}
                <Text style={[styles.muted, { marginTop: 8 }]}>Thanks for sharing your feedback.</Text>
              </>
            ) : (
              <>
                <Text style={styles.muted}>How did the contractor do on this job?</Text>
                {renderStars(reviewRating, true)}
                <Text style={styles.label}>Comment (optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Share details about timeliness, quality, communication…"
                  multiline
                  editable={!submittingReview}
                />
                {reviewError ? <Text style={styles.error}>{reviewError}</Text> : null}
                <TouchableOpacity
                  style={[styles.button, { opacity: submittingReview ? 0.6 : 1 }]}
                  onPress={submitReview}
                  disabled={submittingReview}
                >
                  <Text style={styles.buttonText}>{submittingReview ? 'Submitting…' : 'Submit review'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {(job.photoComparisons?.length ?? 0) > 0 && (
          <JobScopeComparisons comparisons={job.photoComparisons} />
        )}

        {job.photos.length > 0 && (
          <View style={{ marginTop: 12, gap: 12 }}>
            <Text style={[styles.muted, { marginBottom: 0 }]}>Photos</Text>
            {job.photos.map((uri) => (
              <RemotePhoto
                key={uri}
                uri={uri}
                style={{ width: '100%', height: '100%' }}
                containerStyle={{
                  width: '100%',
                  height: 280,
                  borderRadius: 12,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                }}
                resizeMode="contain"
              />
            ))}
          </View>
        )}

        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={{ color: colors.text }}>{job.description}</Text>
          {job.addressText ? (
            <Text style={{ marginTop: 8, color: colors.text }}>📍 {job.addressText}</Text>
          ) : job.postalCode ? (
            <Text style={[styles.muted, { marginTop: 8 }]}>
              📍 ZIP {job.postalCode} —{' '}
              {job.status === 'AWARDED' && paymentsEnabled
                ? 'exact address appears after the homeowner pays the $1 acceptance fee.'
                : 'exact address revealed after your bid is accepted.'}
            </Text>
          ) : (
            <Text style={[styles.muted, { marginTop: 8 }]}>
              {job.status === 'AWARDED' && paymentsEnabled
                ? 'Exact address appears after the homeowner pays the $1 acceptance fee.'
                : 'Exact address revealed after your bid is accepted.'}
            </Text>
          )}
        </View>

        {(isOwner || isContractor) && (
          <View style={styles.card}>
            <Text style={styles.subtitle}>
              {isContractor && !myBid ? 'Ask the homeowner' : 'Messages'}
            </Text>
            {isContractor && !myBid && job.status === 'OPEN' && (
              <Text style={[styles.muted, { marginBottom: 8 }]}>
                Have a question before you bid? Message the homeowner here.
              </Text>
            )}
            {isOwner && counterpartOptions.length > 1 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {counterpartOptions.map((id) => (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setCounterpart(id)}
                    style={{
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: activeCounterpart === id ? colors.primary : '#fff',
                      borderWidth: 1,
                      borderColor: activeCounterpart === id ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ color: activeCounterpart === id ? '#fff' : colors.text, fontSize: 12 }}>
                      {bids.find((b) => b.contractorUserId === id)?.contractor?.displayName ??
                        `Contractor ${id.slice(0, 8)}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!canMessage ? (
              <Text style={styles.muted}>
                {isOwner
                  ? 'Messaging opens once a contractor bids or asks a question.'
                  : 'This job is no longer open for new questions.'}
              </Text>
            ) : (
              <>
                {thread.length === 0 && <Text style={styles.muted}>No messages yet.</Text>}
                {thread.map(renderMessageBubble)}
                {renderMessageComposer(
                  isContractor && !myBid ? 'Ask a question…' : 'Type a message…',
                )}
                {messageError ? <Text style={[styles.error, { marginTop: 8 }]}>{messageError}</Text> : null}
              </>
            )}
          </View>
        )}

        {isContractor && (
          <View style={styles.card}>
            <Text style={styles.subtitle}>{myBid ? 'Your bid' : 'Place a bid'}</Text>
            {myBid ? (
              <Text style={styles.muted}>
                {formatBudget(myBid.amountCents, myBid.amountCents, myBid.currency)} · {myBid.status}
              </Text>
            ) : (
              <>
                <Text style={styles.label}>Amount ($)</Text>
                <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                <Text style={styles.label}>Message (optional)</Text>
                <TextInput style={styles.input} value={bidMessage} onChangeText={setBidMessage} />
                <TouchableOpacity style={styles.button} onPress={placeBid}>
                  <Text style={styles.buttonText}>Submit bid</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {isOwner && (
          <View style={styles.card}>
            <Text style={styles.subtitle}>Bids ({bids.length})</Text>
            {bids.length === 0 && <Text style={styles.muted}>No bids yet.</Text>}
            {bids.map((bid) => (
              <View key={bid.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {formatBudget(bid.amountCents, bid.amountCents, bid.currency)}{' '}
                  <Text style={styles.badge}>{bid.status}</Text>
                </Text>
                {bid.contractor && (
                  <Text style={styles.muted}>
                    {bid.contractor.displayName} · ⭐ {bid.contractor.ratingAgg} (
                    {bid.contractor.ratingCount})
                  </Text>
                )}
                {bid.message ? <Text style={{ color: colors.text, marginTop: 2 }}>{bid.message}</Text> : null}
                {job.status === 'OPEN' && bid.status === 'PENDING' && (
                  <TouchableOpacity
                    style={[styles.button, { marginTop: 8, opacity: acceptingBidId === bid.id ? 0.6 : 1 }]}
                    onPress={() => accept(bid.id)}
                    disabled={acceptingBidId === bid.id}
                  >
                    <Text style={styles.buttonText}>
                      {acceptingBidId === bid.id
                        ? 'Accepting…'
                        : paymentsEnabled
                          ? 'Accept bid ($1 fee)'
                          : 'Accept this bid'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
