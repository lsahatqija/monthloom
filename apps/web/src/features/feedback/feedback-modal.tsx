'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  feedbackTypes,
  sendFeedbackRequestSchema,
  type SendFeedbackRequest,
} from '@monthloom/contracts';
import { useMutation } from '@tanstack/react-query';
import { MessageSquareText, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, Button, FieldError, FormField, Label } from '../../components/ui';
import { isApiClientError } from '../../lib/api/errors';

import { sendFeedback } from './feedback.api';

function feedbackTypeLabel(type: (typeof feedbackTypes)[number]) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function FeedbackModal({ onClose }: { onClose?: () => void }) {
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
    defaultValues: { type: 'suggestion', feedback: '' },
  });
  const mutation = useMutation({
    mutationFn: sendFeedback,
    onError: (error) => {
      setError('root', {
        message: isApiClientError(error)
          ? error.message
          : 'Something went wrong. Please try again.',
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
    reset({ type: 'suggestion', feedback: '' });
    mutation.reset();
    dialogRef.current?.showModal();
    setIsOpen(true);
  };

  return (
    <>
      <button type="button" className="accountMenuItem" aria-haspopup="dialog" onClick={open}>
        <MessageSquareText aria-hidden="true" />
        Feedback
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
            <p className="transactionModalEyebrow">Help shape Monthloom</p>
            <h2 id="feedback-modal-title">Feedback</h2>
          </div>
          <button
            type="button"
            className="modalCloseButton"
            aria-label="Close feedback"
            disabled={mutation.isPending}
            onClick={() => dialogRef.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {mutation.isSuccess ? (
          <div className="feedbackSuccess">
            <Alert>Thanks for helping us improve Monthloom. Your feedback has been sent.</Alert>
            <Button type="button" onClick={() => dialogRef.current?.close()}>
              Done
            </Button>
          </div>
        ) : (
          <form
            className="feedbackForm"
            onSubmit={handleSubmit((input) => mutation.mutate(input))}
            noValidate
          >
            <p className="feedbackIntro">
              Tell us what is working, what is not, or what you would like to see next.
            </p>
            {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}

            <FormField>
              <Label htmlFor="feedback-type">Feedback type</Label>
              <select id="feedback-type" disabled={mutation.isPending} {...register('type')}>
                {feedbackTypes.map((type) => (
                  <option key={type} value={type}>
                    {feedbackTypeLabel(type)}
                  </option>
                ))}
              </select>
              <FieldError message={errors.type?.message} />
            </FormField>

            <FormField>
              <Label htmlFor="feedback-message">Your feedback</Label>
              <textarea
                id="feedback-message"
                rows={8}
                maxLength={5000}
                placeholder="Describe your experience in as much detail as you can..."
                disabled={mutation.isPending}
                {...register('feedback')}
              />
              <p className="feedbackHint">Up to 5,000 characters</p>
              <FieldError message={errors.feedback?.message} />
            </FormField>

            <div className="feedbackActions">
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => dialogRef.current?.close()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Sending…' : 'Send Feedback'}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
