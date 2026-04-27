import { useEffect, useEffectEvent, useRef, useState } from 'react';

const BUTTON_SIZE = 17;
const MIN_THUMB_SIZE = 28;
const DEFAULT_SCROLL_STEP = 56;

export function ScrollPanel({
  children,
  className = '',
  viewportClassName = '',
  contentClassName = '',
  ariaLabel = 'Scrollable content',
}) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const dragStateRef = useRef(null);
  const [metrics, setMetrics] = useState({
    canScroll: false,
    thumbSize: MIN_THUMB_SIZE,
    thumbOffset: 0,
    maxScroll: 0,
    maxThumbOffset: 0,
  });

  const syncMetrics = useEffectEvent(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) {
      return;
    }

    const maxScroll = Math.max(viewport.scrollHeight - viewport.clientHeight, 0);
    const trackHeight = Math.max(track.clientHeight, 0);
    const thumbSize = maxScroll
      ? Math.max(MIN_THUMB_SIZE, Math.min(trackHeight, (viewport.clientHeight / viewport.scrollHeight) * trackHeight))
      : trackHeight;
    const maxThumbOffset = Math.max(trackHeight - thumbSize, 0);
    const thumbOffset = maxScroll ? (viewport.scrollTop / maxScroll) * maxThumbOffset : 0;

    setMetrics({
      canScroll: maxScroll > 0,
      thumbSize,
      thumbOffset,
      maxScroll,
      maxThumbOffset,
    });
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }

    syncMetrics();

    const handleScroll = () => syncMetrics();
    viewport.addEventListener('scroll', handleScroll);

    const resizeObserver = new ResizeObserver(() => syncMetrics());
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild) {
      resizeObserver.observe(viewport.firstElementChild);
    }

    window.addEventListener('resize', syncMetrics);

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncMetrics);
    };
  }, [syncMetrics, children]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      const dragState = dragStateRef.current;
      if (!viewport || !track || !dragState) {
        return;
      }

      event.preventDefault();
      const delta = event.clientY - dragState.startY;
      const nextThumbOffset = Math.min(Math.max(dragState.startThumbOffset + delta, 0), metrics.maxThumbOffset);
      const nextScrollTop = metrics.maxThumbOffset ? (nextThumbOffset / metrics.maxThumbOffset) * metrics.maxScroll : 0;
      viewport.scrollTop = nextScrollTop;
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      document.body.classList.remove('scroll-dragging');
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      document.body.classList.remove('scroll-dragging');
    };
  }, [metrics.maxScroll, metrics.maxThumbOffset]);

  function scrollByAmount(amount) {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollBy({ top: amount, behavior: 'auto' });
  }

  function handleTrackMouseDown(event) {
    if (!metrics.canScroll || event.target !== event.currentTarget) {
      return;
    }

    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport) {
      return;
    }

    const { top } = track.getBoundingClientRect();
    const clickOffset = event.clientY - top - metrics.thumbSize / 2;
    const nextThumbOffset = Math.min(Math.max(clickOffset, 0), metrics.maxThumbOffset);
    const nextScrollTop = metrics.maxThumbOffset ? (nextThumbOffset / metrics.maxThumbOffset) * metrics.maxScroll : 0;
    viewport.scrollTop = nextScrollTop;
  }

  function handleThumbMouseDown(event) {
    if (!metrics.canScroll) {
      return;
    }

    event.preventDefault();
    dragStateRef.current = {
      startY: event.clientY,
      startThumbOffset: metrics.thumbOffset,
    };
    document.body.classList.add('scroll-dragging');
  }

  return (
    <div className={`scroll-panel ${className}`.trim()}>
      <div ref={viewportRef} className={`scroll-panel-viewport ${viewportClassName}`.trim()} aria-label={ariaLabel}>
        {contentClassName ? <div className={contentClassName}>{children}</div> : children}
      </div>
      <div className="retro-scrollbar" aria-hidden="true">
        <button type="button" className="retro-scroll-button retro-scroll-button-up" onClick={() => scrollByAmount(-DEFAULT_SCROLL_STEP)} disabled={!metrics.canScroll} tabIndex={-1} />
        <div ref={trackRef} className="retro-scroll-track" onMouseDown={handleTrackMouseDown}>
          <div
            className={`retro-scroll-thumb${metrics.canScroll ? '' : ' retro-scroll-thumb-disabled'}`}
            style={{ height: `${Math.max(metrics.thumbSize, BUTTON_SIZE)}px`, transform: `translateY(${metrics.thumbOffset}px)` }}
            onMouseDown={handleThumbMouseDown}
          />
        </div>
        <button type="button" className="retro-scroll-button retro-scroll-button-down" onClick={() => scrollByAmount(DEFAULT_SCROLL_STEP)} disabled={!metrics.canScroll} tabIndex={-1} />
      </div>
    </div>
  );
}
