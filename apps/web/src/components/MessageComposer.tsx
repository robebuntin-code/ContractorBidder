'use client';

import type { MessageView } from '@/lib/api';

export function MessageBubble({ message, isMine }: { message: MessageView; isMine: boolean }) {
  return (
    <div
      style={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        background: isMine ? '#2563eb' : '#f1f5f9',
        color: isMine ? '#fff' : '#0f172a',
        padding: '8px 12px',
        borderRadius: 12,
        maxWidth: '75%',
      }}
    >
      {message.body ? <div>{message.body}</div> : null}
      {message.attachments.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: message.body ? 8 : 0,
          }}
        >
          {message.attachments.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Message attachment"
                style={{
                  width: 120,
                  height: 90,
                  objectFit: 'cover',
                  borderRadius: 8,
                  display: 'block',
                }}
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export interface PendingMessagePhoto {
  id: string;
  previewUrl: string;
  fileUrl: string | null;
}

interface MessageComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  pendingPhotos: PendingMessagePhoto[];
  onPickPhotos: () => void;
  onRemovePhoto: (id: string) => void;
  onSend: () => void;
  sending: boolean;
  uploading: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function MessageComposer({
  draft,
  onDraftChange,
  pendingPhotos,
  onPickPhotos,
  onRemovePhoto,
  onSend,
  sending,
  uploading,
  placeholder = 'Type a message…',
  disabled = false,
}: MessageComposerProps) {
  const readyUrls = pendingPhotos.filter((p) => p.fileUrl).map((p) => p.fileUrl as string);
  const canSend = !disabled && !sending && !uploading && (draft.trim() || readyUrls.length > 0);

  return (
    <div>
      {pendingPhotos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {pendingPhotos.map((photo) => (
            <div key={photo.id} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt="Pending attachment"
                style={{
                  width: 72,
                  height: 72,
                  objectFit: 'cover',
                  borderRadius: 8,
                  opacity: photo.fileUrl ? 1 : 0.6,
                }}
              />
              <button
                type="button"
                onClick={() => onRemovePhoto(photo.id)}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: 'none',
                  background: '#0f172a',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: '1 1 180px' }}
          disabled={disabled || sending}
        />
        <button
          type="button"
          className="secondary"
          onClick={onPickPhotos}
          disabled={disabled || sending || uploading || pendingPhotos.length >= 4}
        >
          {uploading ? 'Uploading…' : 'Add photo'}
        </button>
        <button type="button" onClick={onSend} disabled={!canSend} style={{ flex: 'none' }}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
