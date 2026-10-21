import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';

function votingUrl(): string {
  return new URL('/', window.location.origin).toString();
}

export function VoteQrLauncher() {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const url = useMemo(() => votingUrl(), []);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: {
        dark: '#14081f',
        light: '#ffffff',
      },
    })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not create QR code');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (error || !dataUrl) {
    return null;
  }

  return createPortal(
    <>
      {!open && (
        <button
          type="button"
          className="vote-qr-float"
          onClick={() => setOpen(true)}
          aria-label="Show voting QR code"
        >
          <img src={dataUrl} alt="" width={88} height={88} />
          <span>Scan to vote</span>
        </button>
      )}

      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="modal-dialog vote-qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vote-qr-title"
          >
            <h2 id="vote-qr-title">Scan to vote</h2>
            <p className="muted">
              Point your phone camera at this code to open the voting page.
            </p>
            <img
              className="vote-qr-large"
              src={dataUrl}
              alt={`QR code for ${url}`}
              width={280}
              height={280}
            />
            <p className="vote-qr-url muted">{url}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
