import { useCallback, useRef, useState, type ReactNode } from 'react';

const THRESHOLD = 50;

export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  /* ---- Shared logic ---- */

  const onStart = useCallback(
    (clientY: number) => {
      if (window.scrollY <= 0 && !refreshing) {
        startY.current = clientY;
        pulling.current = true;
      }
    },
    [refreshing],
  );

  const onMove = useCallback((clientY: number) => {
    if (!pulling.current) return;
    const dy = clientY - startY.current;
    if (dy > 0) {
      setPullY(Math.min(dy * 0.4, 80));
    } else {
      pulling.current = false;
      setPullY(0);
    }
  }, []);

  const onEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  }, [pullY, onRefresh]);

  /* ---- Touch handlers ---- */

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => onStart(e.touches[0].clientY),
    [onStart],
  );
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => onMove(e.touches[0].clientY),
    [onMove],
  );
  const handleTouchEnd = useCallback(() => onEnd(), [onEnd]);

  /* ---- Mouse handlers (desktop) ---- */

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => { onStart(e.clientY); },
    [onStart],
  );
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => { if (e.buttons === 1) onMove(e.clientY); },
    [onMove],
  );
  const handleMouseUp = useCallback(() => onEnd(), [onEnd]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="flex justify-center items-center overflow-hidden transition-[height] duration-200"
        style={{ height: pullY > 10 || refreshing ? `${refreshing ? 40 : pullY}px` : '0px' }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-accent ${refreshing ? 'animate-spin' : ''}`}
          style={{
            opacity: refreshing ? 1 : Math.min(pullY / THRESHOLD, 1),
            transform: refreshing ? undefined : `rotate(${pullY * 3}deg)`,
          }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
      {children}
    </div>
  );
}
