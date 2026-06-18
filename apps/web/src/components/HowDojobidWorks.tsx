'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { HOW_DOJOBID_WORKS } from '@contractor-bidder/ui';

export function HowDojobidWorksModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  return (
    <div className="how-it-works-backdrop" onClick={onClose} role="presentation">
      <div
        className="how-it-works-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="how-it-works-header">
          <h2 id={titleId}>{HOW_DOJOBID_WORKS.title}</h2>
          <button type="button" className="how-it-works-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="how-it-works-body">
          <p className="how-it-works-intro">{HOW_DOJOBID_WORKS.intro}</p>

          {[HOW_DOJOBID_WORKS.homeowner, HOW_DOJOBID_WORKS.contractor].map((section) => (
            <section key={section.heading} className="how-it-works-section">
              <h3>{section.heading}</h3>
              <ol className="how-it-works-steps">
                {section.steps.map((step) => (
                  <li key={step.title}>
                    <strong>{step.title}</strong>
                    <span>{step.body}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <section className="how-it-works-section how-it-works-note">
            <h3>{HOW_DOJOBID_WORKS.messaging.title}</h3>
            <p>{HOW_DOJOBID_WORKS.messaging.body}</p>
          </section>
        </div>

        <div className="how-it-works-footer">
          <button type="button" className="btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function HowDojobidWorksLink({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={['how-it-works-link', className].filter(Boolean).join(' ')}
        onClick={() => setOpen(true)}
      >
        How DOJOBID works
      </button>
      <HowDojobidWorksModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}