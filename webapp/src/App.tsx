import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import TrainingLogPage from './pages/TrainingLog';
import Rating from './pages/Rating';
import Profile from './pages/Profile';
import { useTelegram } from './hooks/useTelegram';

export default function App() {
  const { ready, expand } = useTelegram();

  useEffect(() => {
    ready();
    expand();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Tournaments />} />
          <Route path="/tournament/:id" element={<TournamentDetail />} />
          <Route path="/training" element={<TrainingLogPage />} />
          <Route path="/rating" element={<Rating />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
