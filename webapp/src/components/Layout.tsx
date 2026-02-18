import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import { resetBottomSheetOverflow } from './bottomSheetState';
import { useTelegram } from '../hooks/useTelegram';
import { useI18n } from '../i18n/I18nProvider';

const DETAIL_ROUTES = ['/tournament/', '/user/'];

function isDetailRoute(path: string) {
  return DETAIL_ROUTES.some((r) => path.startsWith(r));
}

export default function Layout() {
  const location = useLocation();
  const { isTelegram } = useTelegram();
  const { t } = useI18n();
  const mainRef = useRef<HTMLElement>(null);
  const prevPath = useRef(location.pathname);

  // Clear stale overflow from BottomSheet synchronously before paint
  useLayoutEffect(() => {
    resetBottomSheetOverflow();
  }, [location.pathname]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const goingDeeper = isDetailRoute(location.pathname) && !isDetailRoute(prevPath.current);
    const animClass = goingDeeper ? 'page-slide' : 'page-fade';

    el.classList.remove('page-fade-enter-active', 'page-slide-enter-active');
    el.classList.add(`${animClass}-enter`);
    // force reflow
    void el.offsetHeight;
    el.classList.add(`${animClass}-enter-active`);
    el.classList.remove(`${animClass}-enter`);

    prevPath.current = location.pathname;
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-bg">
      {!isTelegram && (
        <div className="bg-accent-light text-accent text-xs text-center py-2.5 px-4 font-medium">
          {t('layout.openInTelegram')}
        </div>
      )}
      <main ref={mainRef} className="pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
