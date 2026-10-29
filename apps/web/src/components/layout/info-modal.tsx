'use client';

import { Info, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

export function InfoModal({
  triggerVariant = 'icon',
  onClose,
}: {
  triggerVariant?: 'icon' | 'menuItem';
  onClose?: () => void;
}) {
  const t = useTranslations('Shell.info');
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
        className={triggerVariant === 'menuItem' ? 'accountMenuItem' : 'iconButton'}
        aria-label={t('open')}
        title={t('title')}
        aria-haspopup="dialog"
        onClick={() => {
          dialogRef.current?.showModal();
          setIsOpen(true);
        }}
      >
        <Info aria-hidden="true" />
        {triggerVariant === 'menuItem' ? t('title') : null}
      </button>
      <dialog
        ref={dialogRef}
        className="infoModal"
        aria-labelledby="info-modal-title"
        onClose={() => {
          setIsOpen(false);
          onClose?.();
        }}
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
            <p className="transactionModalEyebrow">{t('eyebrow')}</p>
            <h2 id="info-modal-title">{t('title')}</h2>
          </div>
          <button
            type="button"
            className="modalCloseButton"
            aria-label={t('close')}
            onClick={() => dialogRef.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="infoModalContent">
          <section aria-labelledby="info-description-title">
            <h3 id="info-description-title">{t('descriptionTitle')}</h3>
            <p>{t('description')}</p>
          </section>
          <section aria-labelledby="info-purpose-title">
            <h3 id="info-purpose-title">{t('purposeTitle')}</h3>
            <p>{t('purpose')}</p>
          </section>
          <section className="infoBetaNotice" aria-labelledby="info-beta-title">
            <h3 id="info-beta-title">{t('betaTitle')}</h3>
            <p>{t('beta')}</p>
          </section>
        </div>
      </dialog>
    </>
  );
}
