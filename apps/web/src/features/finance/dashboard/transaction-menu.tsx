'use client';

import type { HouseholdTransaction } from '@monthloom/contracts';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function TransactionMenu({
  entry,
  onEdit,
  onRemove,
}: {
  entry: HouseholdTransaction;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDetailsElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !popoverRef.current?.contains(target))
        setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const positionPopover = () => {
      const trigger = menuRef.current?.querySelector('summary');
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const triggerRect = trigger.getBoundingClientRect();
      const gap = 4;
      const viewportMargin = 8;
      const topBelow = triggerRect.bottom + gap;
      const top =
        topBelow + popover.offsetHeight <= window.innerHeight - viewportMargin
          ? topBelow
          : Math.max(viewportMargin, triggerRect.top - popover.offsetHeight - gap);
      const left = Math.min(
        Math.max(viewportMargin, window.innerWidth - popover.offsetWidth - viewportMargin),
        Math.max(viewportMargin, triggerRect.right - popover.offsetWidth),
      );

      setPopoverPosition({ top, left });
    };

    positionPopover();
    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);
    return () => {
      window.removeEventListener('resize', positionPopover);
      window.removeEventListener('scroll', positionPopover, true);
    };
  }, [open]);

  const selectAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <details
      ref={menuRef}
      className="transactionMenu"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-label={`Actions for ${entry.source.displayName}`}>⋯</summary>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div ref={popoverRef} className="transactionMenuPopover" style={popoverPosition}>
              <button type="button" onClick={() => selectAction(onEdit)}>
                Edit
              </button>
              <button type="button" onClick={() => selectAction(onRemove)}>
                Remove
              </button>
            </div>,
            document.body,
          )
        : null}
    </details>
  );
}

