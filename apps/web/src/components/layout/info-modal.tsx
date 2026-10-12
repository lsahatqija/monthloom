'use client';

import { Info, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function InfoModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="iconButton"
        aria-label="Open app info"
        title="Info"
        aria-haspopup="dialog"
        onClick={() => {
          dialogRef.current?.showModal();
          setIsOpen(true);
        }}
      >
        <Info aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        className="infoModal"
        aria-labelledby="info-modal-title"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) {
            event.currentTarget.close();
          }
        }}
      >
        <div className="transactionModalHeader">
          <div>
            <p className="transactionModalEyebrow">About Monthloom</p>
            <h2 id="info-modal-title">Info</h2>
          </div>
          <button
            type="button"
            className="modalCloseButton"
            aria-label="Close info"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="infoModalContent">
          <section aria-labelledby="info-description-title">
            <h3 id="info-description-title">Shared finances, month by month</h3>
            <p>
              Monthloom helps households track income and expenses together in one place. Organize
              transactions by person, source, and category, manage recurring entries, and see your
              monthly income, spending, and what is left over at a glance.
            </p>
          </section>
          <section aria-labelledby="info-purpose-title">
            <h3 id="info-purpose-title">Our purpose</h3>
            <p>
              Keep shared household finances clear, calm, and easy to understand. Monthloom gives
              everyone a common view of the month so you can plan together and stay on top of
              everyday spending.
            </p>
          </section>
          <section className="infoBetaNotice" aria-labelledby="info-beta-title">
            <h3 id="info-beta-title">Beta &amp; active development</h3>
            <p>
              Monthloom is in beta and under active development. Features may change, and you may
              encounter bugs or incomplete functionality as we continue to improve the app.
            </p>
          </section>
        </div>
      </dialog>
    </>
  );
}
