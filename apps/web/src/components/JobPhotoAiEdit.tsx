'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/mediaUrl';

export interface JobPhotoAiEditTarget {
  id: string;
  previewUrl: string;
  fileUrl: string | null;
}

interface JobPhotoAiEditModalProps {
  target: JobPhotoAiEditTarget | null;
  onClose: () => void;
  resolveSourceKey: (target: JobPhotoAiEditTarget) => Promise<string>;
  onApply: (
    photoId: string,
    result: {
      beforeKey: string;
      afterKey: string;
      beforePreview: string;
      afterPreview: string;
    },
  ) => void;
}

const EXAMPLE_PROMPT =
  'Remove the bushes in front of the house and add a flower bed with yellow flowers. Add a palm tree in the front right corner of the yard.';

export function JobPhotoAiEditModal({
  target,
  onClose,
  resolveSourceKey,
  onApply,
}: JobPhotoAiEditModalProps) {
  const [enabled, setEnabled] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedPreview, setEditedPreview] = useState<string | null>(null);
  const [editedKey, setEditedKey] = useState<string | null>(null);
  const [beforeKey, setBeforeKey] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getFlags()
      .then((flags) => setEnabled(flags.aiPhotoEditEnabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (!target) {
      setPrompt('');
      setError(null);
      setEditedPreview(null);
      setEditedKey(null);
      setBeforeKey(null);
      setBusy(false);
    }
  }, [target]);

  if (!target || !enabled) return null;

  async function generate() {
    if (!target || prompt.trim().length < 10) {
      setError('Describe the changes you want (at least 10 characters).');
      return;
    }

    setBusy(true);
    setError(null);
    setEditedPreview(null);
    setEditedKey(null);
    setBeforeKey(null);

    try {
      const sourceKey = await resolveSourceKey(target);
      setBeforeKey(sourceKey);
      const result = await api.editJobPhoto(sourceKey, prompt.trim());
      const previewUrl = resolveMediaUrl(result.key);
      setEditedKey(result.key);
      setEditedPreview(previewUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate preview.');
    } finally {
      setBusy(false);
    }
  }

  function useEdited() {
    if (!target || !editedKey || !editedPreview || !beforeKey) return;
    onApply(target.id, {
      beforeKey,
      afterKey: editedKey,
      beforePreview: target.previewUrl,
      afterPreview: editedPreview,
    });
    onClose();
  }

  return (
    <div className="photo-ai-overlay" role="dialog" aria-modal="true" aria-labelledby="photo-ai-title">
      <div className="photo-ai-modal">
        <div className="photo-ai-header">
          <h2 id="photo-ai-title">Show contractors the planned result</h2>
          <button type="button" className="photo-ai-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="field-hint">
          Describe how you want the work to look when it&apos;s done. We&apos;ll create a before/after pair
          contractors can review to understand the scope.
        </p>

        <div className="photo-ai-compare">
          <figure>
            <figcaption>Original</figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={target.previewUrl} alt="Original upload" className="photo-ai-img" />
          </figure>
          <figure>
            <figcaption>{editedPreview ? 'AI preview' : 'Preview'}</figcaption>
            {editedPreview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={editedPreview} alt="AI edited preview" className="photo-ai-img" />
            ) : (
              <div className="photo-ai-placeholder">{busy ? 'Generating…' : 'Preview appears here'}</div>
            )}
          </figure>
        </div>

        <label className="field-label" htmlFor="photo-ai-prompt">
          What should change?
        </label>
        <textarea
          id="photo-ai-prompt"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={EXAMPLE_PROMPT}
          disabled={busy}
        />

        {error ? <p className="photo-ai-error">{error}</p> : null}

        <div className="photo-ai-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-secondary" onClick={() => void generate()} disabled={busy}>
            {busy ? 'Generating…' : editedPreview ? 'Regenerate' : 'Generate preview'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={useEdited}
            disabled={busy || !editedKey || !editedPreview}
          >
            Use before & after on job
          </button>
        </div>
      </div>
    </div>
  );
}

interface JobPhotoAiEditButtonProps {
  disabled?: boolean;
  onClick: () => void;
}

export function JobPhotoAiEditButton({ disabled, onClick }: JobPhotoAiEditButtonProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void api
      .getFlags()
      .then((flags) => setEnabled(flags.aiPhotoEditEnabled))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  return (
    <button type="button" className="photo-ai-badge" onClick={onClick} disabled={disabled}>
      AI scope
    </button>
  );
}
