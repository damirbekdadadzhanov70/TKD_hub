import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { incrementOpen, decrementOpen } from './bottomSheetState';

export default function BottomSheet({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const [height, setHeight] = useState(() => getViewportHeight());
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Viewport resize + enter animation
  useEffect(() => {
    const update = () => setHeight(getViewportHeight());
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    requestAnimationFrame(() => setVisible(true));
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Prevent background scroll — only the first sheet locks, only the last unlocks
  useEffect(() => {
    incrementOpen();
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      decrementOpen();
    };
  }, []);

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed top-0 left-0 right-0 z-50 flex flex-col justify-end transition-colors duration-[250ms]"
      style={{
        height: `${height}px`,
        backgroundColor: visible ? 'rgba(0,0,0,0.3)' : 'transparent',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={sheetRef}
        className="w-full rounded-t-2xl flex flex-col overflow-hidden bg-bg-secondary transition-transform duration-[250ms]"
        style={{
          maxHeight: `${Math.floor(height * 0.85)}px`,
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-bg-divider" />
        </div>
        {children}
      </div>
    </div>,
    document.getElementById('root')!,
  );
}

function getViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}
