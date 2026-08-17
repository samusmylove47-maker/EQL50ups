/**
 * Accessible modal shell: escape to close, focus moved in on open, trapped
 * while open, and restored to the opener on close.
 *
 * The setup effect deliberately depends on nothing. Callers pass `onClose` as
 * an inline arrow, so a dependency on it re-ran this effect on every parent
 * render — and the cleanup's focus restore then yanked focus out of the dialog
 * and back onto the button that opened it, one render after the picker had
 * focused its search box. The handler reads the latest `onClose` through a ref
 * instead, so the dialog is set up exactly once per open.
 *
 * The opener is read during render, not from that effect. Everything that
 * pulls focus into a dialog — `autoFocus`, a child's own effect — happens
 * before a parent effect runs, so an effect here only ever sees the dialog
 * looking at itself, and closing dropped the reader on `<body>`.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra header content, right-aligned. */
  headerExtra?: ReactNode;
  /**
   * Keep the title for assistive tech but not on screen — for a dialog whose
   * body already carries its own title bar, such as the item window.
   */
  titleHidden?: boolean;
  width?: number;
}

const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) =>
      !el.hasAttribute('disabled') &&
      el.tabIndex >= 0 &&
      (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0),
  );
}

export function Modal({ title, onClose, children, footer, headerExtra, titleHidden, width }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // The control the reader was on when this dialog was rendered — a lazy
  // initialiser, so it is read once, on the render that opens the dialog and
  // before commit moves focus anywhere.
  const [opener] = useState<Element | null>(() => document.activeElement);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    // Move focus inside straight away — unless a child claimed it first with
    // `autoFocus`, which React applies during commit, before this effect runs.
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const stops = focusableWithin(dialog);
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const active = document.activeElement;
      const inside = active instanceof Node && dialog.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first || active === dialog) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      /*
       * A real unmount has already taken the dialog out of the document by the
       * time this runs; StrictMode's development-only remount has not, and
       * restoring there would pull focus off whatever the dialog just gave it
       * to and never give it back.
       */
      if (dialog?.isConnected) return;
      if (opener instanceof HTMLElement && document.body.contains(opener)) opener.focus();
    };
  }, [opener]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
        style={width ? { width: `min(${width}px, 100%)` } : undefined}
      >
        <div className={`modal-head${titleHidden ? ' bare' : ''}`}>
          <h2 id={titleId} className={titleHidden ? 'sr-only' : undefined}>
            {title}
          </h2>
          <div className="grow" />
          {headerExtra}
          <button type="button" className="btn btn-quiet" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        {children}
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
