import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function Layout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.classList.remove('page-enter-active');
    el.classList.add('page-enter');
    // force reflow
    void el.offsetHeight;
    el.classList.add('page-enter-active');
    el.classList.remove('page-enter');
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-bg">
      <main ref={mainRef} className="pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
