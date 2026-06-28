'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ContractorReviewView, JobFullView, PublicUser } from '@contractor-bidder/types';
import { formatWorkType, formatBidContractorDisplayName, isBidContractorIdentityRevealed } from '@contractor-bidder/types';
import { formatBudget } from '@contractor-bidder/ui';
import {
  MessageBubble,
  MessageComposer,
  type PendingMessagePhoto,
} from '@/components/MessageComposer';
import { api, uploadToSignedUrl, type BidWithContractor, type MessageView } from '@/lib/api';
import AcceptBidPaymentModal from '@/components/AcceptBidPaymentModal';
import type { AcceptanceFeeStatus } from '@contractor-bidder/types';
import { resolveMediaUrl, resolvePhotoUrls } from '@/lib/mediaUrl';
import { JobScopeComparisons } from '@/components/JobScopeComparisons';
import { inferImageContentType, imageExtensionForContentType } from '@/lib/uploadUtils';
import { formatJobTimeframe, jobTimeframeHeading } from '@/lib/jobDates';
import { useRealtime } from '@/lib/realtime';

const MAX_MESSAGE_PHOTOS = 4;

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id;

  const [me, setMe] = useState<PublicUser | null>(null);
  const [job, setJob] = useState<JobFullView | null>(null);
  const [bids, setBids] = useState<BidWithContractor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Bid form (contractor)
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Messaging
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [draft, setDraft] = useState('');
  const [counterpartId, setCounterpartId] = useState<string>('');
  const [pendingPhotos, setPendingPhotos] = useState<PendingMessagePhoto[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [review, setReview] = useState<ContractorReviewView | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [acceptanceFee, setAcceptanceFee] = useState<AcceptanceFeeStatus | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ jobId: string; bidId: string } | null>(null);
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) return;
    setError(null);
    setLoaded(false);
    try {
      const [meRes, jobRes, flagsRes] = await Promise.all([
        api.me(),
        api.getJob(jobId),
        api.getFlags().catch(() => ({ paymentsEnabled: false })),
      ]);
      setMe(meRes);
      setJob({
        ...jobRes,
        photos: resolvePhotoUrls(jobRes.photos),
        photoComparisons: (jobRes.photoComparisons ?? []).map((pair) => ({
          before: resolveMediaUrl(pair.before),
          after: resolveMediaUrl(pair.after),
        })),
      });
      setPaymentsEnabled(flagsRes.paymentsEnabled);
      if (meRes.id === jobRes.createdByUserId && jobRes.status === 'AWARDED') {
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
        setMessages(await api.listMessages(jobId));
      } catch {
        setMessages([]);
      }
      try {
        setReview(await api.getJobReview(jobId));
      } catch {
        setReview(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoaded(true);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates: new bids (owner) refresh the list; new messages append.
  useRealtime(jobId, {
    onBid: () => {
      if (jobId) void api.listBids(jobId).then(setBids).catch(() => undefined);
    },
    onMessage: (payload) => {
      const msg = payload as MessageView;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    },
  });

  if (error)
    return (
      <p className="error">
        {error} — try <a href="/login">signing in</a>.
      </p>
    );
  if (!loaded) return <p className="muted">Loading…</p>;
  if (!job || !me)
    return (
      <p className="error">
        Could not load this job — <Link href="/login">sign in</Link> and try again.
      </p>
    );

  const isOwner = job.createdByUserId === me.id;
  const isContractor = me.role === 'CONTRACTOR' && !isOwner;
  const canEdit = isOwner && job.status === 'OPEN' && bids.length === 0;
  const myBid = bids.find((b) => b.contractorUserId === me.id);
  const hasPreciseAddress = !!job.addressText;

  // Messaging counterpart: contractors talk to the owner; owners pick a bidder.
  const messagedContractorIds = messages
    .filter((m) => m.fromUserId === job.createdByUserId || m.toUserId === job.createdByUserId)
    .map((m) => (m.fromUserId === job.createdByUserId ? m.toUserId : m.fromUserId));
  const counterpartOptions = isOwner
    ? Array.from(new Set([...bids.map((b) => b.contractorUserId), ...messagedContractorIds]))
    : [job.createdByUserId];
  const activeCounterpart = counterpartId || counterpartOptions[0] || '';
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
      const idx = bids.findIndex((b) => b.id === acceptedBid.id);
      return formatBidContractorDisplayName(acceptedBid.contractor, {
        anonymousLabel: `Contractor #${idx >= 0 ? idx + 1 : 1}`,
        bidStatus: acceptedBid.status,
      });
    }
    if (me.id === awardedContractorId) {
      return `${me.firstName} ${me.lastName}`;
    }
    return null;
  })();

  async function addMessagePhotos(files: FileList | null) {
    if (!files?.length) return;
    setMessageError(null);
    setUploadingPhotos(true);
    let queued = pendingPhotos.length;
    try {
      for (const file of Array.from(files)) {
        if (queued >= MAX_MESSAGE_PHOTOS) break;
        const contentType = inferImageContentType(file);
        const ext = imageExtensionForContentType(contentType);
        const fileName = `message_${Date.now()}_${queued}.${ext}`;
        const id = `${Date.now()}_${fileName}`;
        const previewUrl = URL.createObjectURL(file);
        queued += 1;
        setPendingPhotos((prev) => [...prev, { id, previewUrl, fileUrl: null }]);
        try {
          const signed = await api.signUpload(contentType, fileName);
          const fileUrl = await uploadToSignedUrl(signed, file, contentType);
          setPendingPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, fileUrl } : p)));
        } catch (e) {
          queued -= 1;
          setPendingPhotos((prev) => prev.filter((p) => p.id !== id));
          URL.revokeObjectURL(previewUrl);
          throw e;
        }
      }
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : 'Photo upload failed');
    } finally {
      setUploadingPhotos(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  function removePendingPhoto(id: string) {
    setPendingPhotos((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function sendMessage() {
    if (!jobId || !activeCounterpart) return;
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
      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPendingPhotos([]);
      setMessages(await api.listMessages(jobId));
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : 'Could not send message');
    } finally {
      setSendingMessage(false);
    }
  }

  async function placeBid(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.createBid(jobId, { amountCents: Math.round(Number(amount) * 100), message });
      setAmount('');
      setMessage('');
      setNotice('Bid submitted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place bid');
    } finally {
      setSubmitting(false);
    }
  }

  async function accept(bidId: string) {
    if (
      paymentsEnabled &&
      !window.confirm(
        'Accept this bid? A $1 acceptance fee is required before the contractor can see your address.',
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    setAcceptingBidId(bidId);
    try {
      const result = await api.acceptBid(bidId);
      if (result.paymentRequired) {
        setPaymentModal({ jobId: result.jobId, bidId: result.bidId });
        setNotice('Bid accepted. Complete the $1 payment to share your address.');
      } else {
        setNotice('Bid accepted. The job is now awarded.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept bid');
    } finally {
      setAcceptingBidId(null);
    }
  }

  function openAcceptancePayment() {
    if (!jobId || !job?.acceptedBidId) return;
    setPaymentModal({ jobId, bidId: job.acceptedBidId });
  }

  async function submitReview() {
    if (!jobId) return;
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
      <div style={{ display: 'flex', gap: 4, margin: '8px 0' }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= rating;
          if (!interactive) {
            return (
              <span key={star} style={{ fontSize: 24, color: filled ? '#f59e0b' : '#cbd5e1' }}>
                {filled ? '★' : '☆'}
              </span>
            );
          }
          return (
            <button
              key={star}
              type="button"
              onClick={() => setReviewRating(star)}
              disabled={submittingReview}
              style={{
                fontSize: 24,
                color: filled ? '#f59e0b' : '#cbd5e1',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
            >
              {filled ? '★' : '☆'}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {paymentModal ? (
        <AcceptBidPaymentModal
          jobId={paymentModal.jobId}
          bidId={paymentModal.bidId}
          onClose={() => setPaymentModal(null)}
          onPaid={() => {
            setPaymentModal(null);
            setNotice('Payment complete. The contractor can now see the job address.');
            void load();
          }}
        />
      ) : null}
      <span className="badge">{formatWorkType(job.workType)}</span>
      <p className="job-title" style={{ fontSize: 22 }}>{job.title}</p>
      <p className="muted">
        {formatBudget(job)} · status {job.status}
      </p>
      <p className="muted" style={{ marginTop: 4 }}>
        <strong>{jobTimeframeHeading(job.desiredDatetimeStart, job.desiredDatetimeEnd)}:</strong>{' '}
        {formatJobTimeframe(job.desiredDatetimeStart, job.desiredDatetimeEnd)}
      </p>
      {notice && <p style={{ color: '#16a34a' }}>{notice}</p>}
      {error && <p className="error">{error}</p>}

      {canEdit && (
        <Link href={`/jobs/${job.id}/edit`} className="btn-outline" style={{ display: 'inline-block', marginTop: 8 }}>
          Edit job
        </Link>
      )}

      {isOwner && job.status === 'AWARDED' && acceptanceFee?.required ? (
        <div className="card accept-payment-banner">
          <h3 style={{ marginTop: 0 }}>Payment required</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            Pay the $1 acceptance fee so your contractor can see the job address.
          </p>
          <button type="button" className="btn-primary" onClick={openAcceptancePayment}>
            Pay $1.00
          </button>
        </div>
      ) : null}

      {awardedContractorId && (
        <div className="card" style={{ background: '#eff6ff', borderColor: '#93c5fd' }}>
          <h3 style={{ marginTop: 0 }}>Awarded contractor</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            {awardedContractorName ?? 'Your selected contractor'} will perform this job.
          </p>
          <Link href={`/contractors/${awardedContractorId}`}>View contractor profile →</Link>
        </div>
      )}

      {isOwner && job.status === 'AWARDED' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Review contractor</h3>
          {review ? (
            <>
              {renderStars(review.rating)}
              {review.comment ? <p>{review.comment}</p> : null}
              <p className="muted">Thanks for sharing your feedback.</p>
            </>
          ) : (
            <>
              <p className="muted">How did the contractor do on this job?</p>
              {renderStars(reviewRating, true)}
              <label htmlFor="review-comment" className="muted" style={{ display: 'block', marginTop: 8 }}>
                Comment (optional)
              </label>
              <textarea
                id="review-comment"
                className="input"
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share details about timeliness, quality, communication…"
                disabled={submittingReview}
                style={{ width: '100%', marginTop: 4 }}
              />
              {reviewError ? <p className="error">{reviewError}</p> : null}
              <button
                type="button"
                className="button"
                onClick={() => void submitReview()}
                disabled={submittingReview}
                style={{ marginTop: 12 }}
              >
                {submittingReview ? 'Submitting…' : 'Submit review'}
              </button>
            </>
          )}
        </div>
      )}

      {(job.photoComparisons?.length ?? 0) > 0 && (
        <JobScopeComparisons comparisons={job.photoComparisons} />
      )}

      {(job.photos?.length ?? 0) > 0 && (
        <div className="job-detail-photos">
          {job.photos.map((uri) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={uri}
              src={uri}
              alt="Job photo"
              className="job-detail-photo"
            />
          ))}
        </div>
      )}

      <div className="card">
        <p>{job.description}</p>
        {hasPreciseAddress ? (
          <p>
            <strong>Address:</strong> {job.addressText}
            <br />
            <span className="muted">
              Precise location is visible to you (owner or accepted contractor).
            </span>
          </p>
        ) : job.postalCode ? (
          <p className="muted">
            <strong>Area:</strong> ZIP {job.postalCode}.{' '}
            {job.status === 'AWARDED' && paymentsEnabled
              ? 'The exact address appears after the homeowner pays the $1 acceptance fee.'
              : 'The exact address is revealed after the homeowner accepts your bid.'}
          </p>
        ) : (
          <p className="muted">
            {job.status === 'AWARDED' && paymentsEnabled
              ? 'The exact address appears after the homeowner pays the $1 acceptance fee.'
              : 'The exact address is revealed after the homeowner accepts your bid.'}
          </p>
        )}
      </div>

      {isContractor && !myBid && job.status === 'OPEN' && (
        <div className="card">
          <h3>Ask the homeowner</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            Have a question before you bid? Message the homeowner below.
          </p>
          <div
            style={{
              maxHeight: 240,
              overflowY: 'auto',
              margin: '8px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {thread.length === 0 && <p className="muted">No messages yet.</p>}
            {thread.map((m) => (
              <MessageBubble key={m.id} message={m} isMine={m.fromUserId === me.id} />
            ))}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            hidden
            onChange={(e) => void addMessagePhotos(e.target.files)}
          />
          <MessageComposer
            draft={draft}
            onDraftChange={setDraft}
            pendingPhotos={pendingPhotos}
            onPickPhotos={() => photoInputRef.current?.click()}
            onRemovePhoto={removePendingPhoto}
            onSend={() => void sendMessage()}
            sending={sendingMessage}
            uploading={uploadingPhotos}
            placeholder="Ask a question…"
            disabled={!canMessage}
          />
          {messageError && <p className="error">{messageError}</p>}
        </div>
      )}

      {isContractor && (
        <div className="card">
          <h3>{myBid ? 'Your bid' : 'Place a bid'}</h3>
          {myBid ? (
            <p className="muted">
              You bid {formatBudget({ budgetMin: myBid.amountCents, currency: myBid.currency })} —
              status {myBid.status}.
            </p>
          ) : (
            <form onSubmit={placeBid}>
              <label>Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <label>Message (optional)</label>
              <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
              <div style={{ marginTop: 12 }}>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit bid'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {isOwner && (
        <div>
          <h3>Bids ({bids.length})</h3>
          {bids.length === 0 && <p className="muted">No bids yet.</p>}
          {bids.map((bid, index) => (
            <div key={bid.id} className="card">
              <strong>
                {formatBudget({ budgetMin: bid.amountCents, currency: bid.currency })}
              </strong>{' '}
              <span className="badge">{bid.status}</span>
              {bid.contractor && (
                <p className="muted" style={{ margin: '6px 0' }}>
                  {formatBidContractorDisplayName(bid.contractor, {
                    anonymousLabel: `Contractor #${index + 1}`,
                    bidStatus: bid.status,
                  })}{' '}
                  · ⭐ {bid.contractor.ratingAgg} ({bid.contractor.ratingCount})
                  {isBidContractorIdentityRevealed(bid.contractor, bid.status) &&
                    bid.contractor.googleReviewsUrl && (
                    <>
                      {' · '}
                      <a href={bid.contractor.googleReviewsUrl} target="_blank" rel="noreferrer">
                        Google reviews
                      </a>
                    </>
                  )}
                </p>
              )}
              {bid.message && <p>{bid.message}</p>}
              {job.status === 'OPEN' && bid.status === 'PENDING' && (
                <button
                  type="button"
                  disabled={acceptingBidId === bid.id}
                  onClick={() => void accept(bid.id)}
                >
                  {acceptingBidId === bid.id
                    ? 'Accepting…'
                    : paymentsEnabled
                      ? 'Accept bid ($1 fee)'
                      : 'Accept this bid'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(isOwner || !(isContractor && !myBid && job.status === 'OPEN')) && (
        <div className="card">
          <h3>Messages</h3>
          {isOwner && counterpartOptions.length > 1 && (
            <>
              <label>Conversation with</label>
              <select
                value={activeCounterpart}
                onChange={(e) => setCounterpartId(e.target.value)}
              >
                {counterpartOptions.map((id) => {
                  const bid = bids.find((b) => b.contractorUserId === id);
                  const idx = bid ? bids.indexOf(bid) : -1;
                  return (
                  <option key={id} value={id}>
                    {bid?.contractor
                      ? formatBidContractorDisplayName(bid.contractor, {
                          anonymousLabel: `Contractor #${idx >= 0 ? idx + 1 : 1}`,
                          bidStatus: bid.status,
                        })
                      : `Contractor ${id.slice(0, 8)}`}
                  </option>
                  );
                })}
              </select>
            </>
          )}

          {!canMessage ? (
            <p className="muted">
              {isOwner
                ? 'Messaging opens once a contractor bids or asks a question.'
                : 'This job is no longer open for new questions.'}
            </p>
          ) : (
            <>
              <div
                style={{
                  maxHeight: 240,
                  overflowY: 'auto',
                  margin: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {thread.length === 0 && <p className="muted">No messages yet. Say hello.</p>}
                {thread.map((m) => (
                  <MessageBubble key={m.id} message={m} isMine={m.fromUserId === me.id} />
                ))}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                hidden
                onChange={(e) => void addMessagePhotos(e.target.files)}
              />
              <MessageComposer
                draft={draft}
                onDraftChange={setDraft}
                pendingPhotos={pendingPhotos}
                onPickPhotos={() => photoInputRef.current?.click()}
                onRemovePhoto={removePendingPhoto}
                onSend={() => void sendMessage()}
                sending={sendingMessage}
                uploading={uploadingPhotos}
                disabled={!canMessage}
              />
              {messageError && <p className="error">{messageError}</p>}
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Live via websocket — open this job in two windows to see messages appear instantly.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
