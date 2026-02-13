import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import TrainingLogPage from './pages/TrainingLog';
import Rating from './pages/Rating';
import Profile from './pages/Profile';
import Onboarding from './pages/Onboarding';
import { useTelegram } from './hooks/useTelegram';
import { useApi } from './hooks/useApi';
import { useI18n } from './i18n/I18nProvider';
import { getMe } from './api/endpoints';
import { mockMe } from './api/mock';
import type { MeResponse } from './types';

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="space-y-3 px-4 py-6 w-full max-w-sm">
        <div className="h-4 w-3/4 skeleton" />
        <div className="h-4 w-1/2 skeleton" />
        <div className="h-4 w-5/6 skeleton" />
      </div>
    </div>
  );
}

function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center pt-20 px-4">
      <p className="text-5xl font-heading text-text-heading mb-3">404</p>
      <p className="text-sm text-text-secondary">{t('common.pageNotFound')}</p>
    </div>
  );
}

function AppRoutes() {
  const { data: me, loading, mutate } = useApi<MeResponse>(getMe, mockMe, []);
  const location = useLocation();
  const navigate = useNavigate();

  const isNone = me?.role === 'none';

  // Guard: redirect to /onboarding if role is 'none'
  useEffect(() => {
    if (!loading && me && isNone && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true });
    }
  }, [loading, me, isNone, location.pathname, navigate]);

  // Guard: redirect away from /onboarding if role is set
  useEffect(() => {
    if (!loading && me && !isNone && location.pathname === '/onboarding') {
      navigate('/', { replace: true });
    }
  }, [loading, me, isNone, location.pathname, navigate]);

  if (loading) return <FullScreenSpinner />;

  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          isNone
            ? <Onboarding onComplete={(result) => mutate(result)} />
            : <Navigate to="/" replace />
        }
      />
      {isNone ? (
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      ) : (
        <Route element={<Layout />}>
          <Route path="/" element={<Tournaments />} />
          <Route path="/tournament/:id" element={<TournamentDetail />} />
          <Route path="/training" element={<TrainingLogPage />} />
          <Route path="/rating" element={<Rating />} />
          <Route path="/profile" element={<Profile />} />
          <Route
            path="*"
            element={<NotFoundPage />}
          />
        </Route>
      )}
    </Routes>
  );
}

export default function App() {
  const { ready, expand, setHeaderColor, setBackgroundColor } = useTelegram();

  useEffect(() => {
    ready();
    expand();
    setHeaderColor('#FAFAF9');
    setBackgroundColor('#FAFAF9');
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
