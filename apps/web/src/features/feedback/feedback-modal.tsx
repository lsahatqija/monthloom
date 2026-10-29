'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  feedbackTypes,
  sendFeedbackRequestSchema,
  type SendFeedbackRequest,
} from '@monthloom/contracts';
import { useMutation } from '@tanstack/react-query';
import { MessageSquareText, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, Button, FieldError, FormField, Label } from '../../components/ui';
import { isApiClientError } from '../../lib/api/errors';

import { sendFeedback } from './feedback.api';

export function FeedbackModal({ onClose }: { onClose?: () => void }) {
  const t = useTranslations('Feedback');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SendFeedbackRequest>({
    resolver: zodResolver(sendFeedbackRequestSchema),
    mode: 'onBlur',
    defaultValues: { type: 'suggestion', anonymous: false, feedback: '' },
  });
  const mutation = useMutation({
    mutationFn: sendFeedback,
    onError: (error) => {
      setError('root', {
        message: isApiClientError(error) ? error.message : t('genericError'),
      });
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const open = () => {
    reset({ type: 'suggestion', anonymous: false, feedback: '' });
    mutation.reset();
    dialogRef.current?.showModal();
    setIsOpen(true);
  };

  return (
    <>
      <button type="button" className="accountMenuItem" aria-haspopup="dialog" onClick={open}>
        <MessageSquareText aria-hidden="true" />
        {t('trigger')}
      </button>
      <dialog
        ref={dialogRef}
        className="infoModal feedbackModal"
        aria-labelledby="feedback-modal-title"
        onCancel={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
        onClose={() => {
          setIsOpen(false);
          onClose?.();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget || mutation.isPending) return;
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
            <h2 id="feedback-modal-title">{t('title')}</h2>
          </div>
          <button
            type="button"
            className="modalCloseButton"
            aria-label={t('close')}
            disabled={mutation.isPending}
            onClick={() => dialogRef.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {mutation.isSuccess ? (
          <div className="feedbackSuccess">
            <Alert>{t('success')}</Alert>
            <Button type="button" onClick={() => dialogRef.current?.close()}>
              {t('done')}
            </Button>
          </div>
        ) : (
          <form
            className="feedbackForm"
            onSubmit={handleSubmit((input) => mutation.mutate(input))}
            noValidate
          >
            <p className="feedbackIntro">{t('intro')}</p>
            {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}

            <FormField>
              <Label htmlFor="feedback-type">{t('type')}</Label>
              <select id="feedback-type" disabled={mutation.isPending} {...register('type')}>
                {feedbackTypes.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}`)}
                  </option>
                ))}
              </select>
              <FieldError message={errors.type?.message} />
            </FormField>

            <FormField>
              <Label htmlFor="feedback-message">{t('yourFeedback')}</Label>
              <textarea
                id="feedback-message"
                rows={8}
                maxLength={5000}
                placeholder={t('placeholder')}
                disabled={mutation.isPending}
                {...register('feedback')}
              />
              <p className="feedbackHint">{t('limit')}</p>
              <FieldError message={errors.feedback?.message} />
            </FormField>

            <label className="feedbackAnonymous" htmlFor="feedback-anonymous">
              <span>
                <strong>{t('anonymous')}</strong>
                <small>{t('anonymousDescription')}</small>
              </span>
              <input
                id="feedback-anonymous"
                type="checkbox"
                disabled={mutation.isPending}
                {...register('anonymous')}
              />
            </label>

            <div className="feedbackActions">
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => dialogRef.current?.close()}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t('sending') : t('send')}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
