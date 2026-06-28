'use client';

import { useEffect, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { api } from '@/lib/api';

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

function PaymentForm({
  jobId,
  onPaid,
  onError,
}: {
  jobId: string;
  onPaid: () => void;
  onError: (message: string | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function waitForWebhookConfirmation(): Promise<boolean> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const status = await api.getAcceptanceFeeStatus(jobId);
      if (status.status === 'SUCCEEDED') return true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    onError(null);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (error) {
        onError(error.message ?? 'Payment failed.');
        return;
      }

      const confirmed = await waitForWebhookConfirmation();
      if (!confirmed) {
        onError('Payment submitted. Refresh the page in a moment if the address is not visible yet.');
        return;
      }
      onPaid();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="accept-payment-form">
      <PaymentElement />
      <button type="submit" className="btn-primary accept-payment-submit" disabled={!stripe || submitting}>
        {submitting ? 'Processing…' : 'Pay $1.00'}
      </button>
    </form>
  );
}

export default function AcceptBidPaymentModal({
  jobId,
  bidId,
  onClose,
  onPaid,
}: {
  jobId: string;
  bidId: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api
      .createPaymentSession({
        jobId,
        bidId,
        direction: 'HOMEOWNER_ACCEPT_FEE',
      })
      .then((session) => {
        if (cancelled) return;
        if (!session.clientSecret) {
          setError('Could not start checkout. Check Stripe configuration.');
          return;
        }
        setClientSecret(session.clientSecret);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not start checkout.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobId, bidId]);

  if (!stripePromise) {
    return (
      <div className="accept-payment-backdrop" role="dialog" aria-modal="true">
        <div className="accept-payment-modal card">
          <h3 style={{ marginTop: 0 }}>Payment unavailable</h3>
          <p className="muted">Stripe is not configured for this site yet.</p>
          <button type="button" className="btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="accept-payment-backdrop" role="dialog" aria-modal="true">
      <div className="accept-payment-modal card">
        <h3 style={{ marginTop: 0 }}>Pay $1 acceptance fee</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Confirm your bid acceptance. After payment, the contractor can see the job address.
        </p>
        {loading ? <p className="muted">Preparing secure checkout…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm jobId={jobId} onPaid={onPaid} onError={setError} />
          </Elements>
        ) : null}
        <button type="button" className="btn-outline accept-payment-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
