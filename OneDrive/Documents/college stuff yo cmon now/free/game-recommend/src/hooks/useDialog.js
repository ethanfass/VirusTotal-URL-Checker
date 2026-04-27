import { useEffect, useEffectEvent, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container) {
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const styles = window.getComputedStyle(element);
    return styles.display !== 'none' && styles.visibility !== 'hidden';
  });
}

export function useDialog({ isOpen = true, onClose, initialFocusRef }) {
  const dialogRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const restoreTargetRef = useRef(null);
  const handleClose = useEffectEvent(() => {
    onClose?.();
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }

    restoreTargetRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lastFocusedRef.current = null;

    const focusInitialTarget = () => {
      const initialTarget = initialFocusRef?.current || getFocusableElements(dialog)[0] || dialog;
      if (initialTarget instanceof HTMLElement) {
        initialTarget.focus();
        lastFocusedRef.current = initialTarget;
      }
    };

    const frame = window.requestAnimationFrame(focusInitialTarget);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements(dialog);
      if (!focusableElements.length) {
        event.preventDefault();
        dialog.focus();
        lastFocusedRef.current = dialog;
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        lastFocusedRef.current = lastElement;
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
        lastFocusedRef.current = firstElement;
      }
    };

    const handleFocusIn = (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      if (dialog.contains(event.target)) {
        lastFocusedRef.current = event.target;
        return;
      }

      const fallbackTarget = initialFocusRef?.current || lastFocusedRef.current || dialog;
      if (fallbackTarget instanceof HTMLElement) {
        fallbackTarget.focus();
        lastFocusedRef.current = fallbackTarget;
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      window.cancelAnimationFrame(frame);
      dialog.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      restoreTargetRef.current?.focus?.();
      restoreTargetRef.current = null;
      lastFocusedRef.current = null;
    };
  }, [handleClose, initialFocusRef, isOpen]);

  return dialogRef;
}
