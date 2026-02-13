import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PullToRefresh from '../components/PullToRefresh';
import BottomSheet from '../components/BottomSheet';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getTournaments } from '../api/endpoints';
import { mockTournaments } from '../api/mock';
import type { TournamentListItem } from '../types';

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    upcoming: 'bg-accent-light text-accent',
    ongoing: 'bg-accent-light text-accent-dark',
    completed: 'bg-bg-secondary text-muted',
  };
  const labels: Record<string, string> = {
    upcoming: 'Upcoming',
    ongoing: 'Reg. closing',
    completed: 'Completed',
  };
  return (
    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap ${styles[status] || 'bg-bg-secondary text-muted'}`}>
      {labels[status] || status}
    </span>
  );
}

function ImportanceDots({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5 items-center">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= level ? 'bg-accent' : 'bg-border'}`}
        />
      ))}
    </span>
  );
}

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
];

const CITIES = [
  'Москва',
  'Санкт-Петербург',
  'Казань',
  'Екатеринбург',
  'Нижний Новгород',
  'Рязань',
  'Махачкала',
];

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export default function Tournaments() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);

  const { data: tournaments, loading, refetch } = useApi<TournamentListItem[]>(
    () => getTournaments({ country: city || undefined, status: status || undefined }),
    mockTournaments,
    [city, status],
  );

  const filtered = (tournaments || []).filter((t) => {
    if (status && t.status !== status) return false;
    if (city && t.city !== city) return false;
    return true;
  });

  return (
    <PullToRefresh onRefresh={() => refetch(true)}>
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-3xl font-heading text-text-heading">
          Tournaments
        </h1>
      </div>

      {/* Status segments + city filter */}
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                status === s.value
                  ? 'bg-accent text-white border-accent'
                  : 'bg-bg-secondary text-text-secondary border-border hover:border-accent/40'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          aria-label="Filter by city"
          onClick={() => setShowCityPicker(true)}
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center border cursor-pointer transition-colors ${
            city
              ? 'bg-accent text-white border-accent'
              : 'bg-bg-secondary text-text-secondary border-border hover:border-accent/40'
          }`}
        >
          <FilterIcon />
        </button>
      </div>

      {/* Active city badge */}
      {city && (
        <div className="px-4 pb-1">
          <button
            onClick={() => setCity('')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-light text-accent border-none cursor-pointer"
          >
            {city}
            <span className="text-sm leading-none">&times;</span>
          </button>
        </div>
      )}

      {/* City picker bottom sheet */}
      {showCityPicker && (
        <BottomSheet onClose={() => setShowCityPicker(false)}>
          <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
            <button
              onClick={() => setShowCityPicker(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-text">Выберите город</h2>
          </div>
          <div className="px-4 pb-4 space-y-1.5 overflow-y-auto">
            <button
              onClick={() => { setCity(''); setShowCityPicker(false); }}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-none cursor-pointer text-left transition-all active:opacity-80 ${
                !city ? 'bg-accent text-white' : 'bg-bg-secondary text-text'
              }`}
            >
              <span className="text-sm font-medium">Все города</span>
              {!city && <CheckIcon />}
            </button>
            {CITIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCity(c); setShowCityPicker(false); }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border-none cursor-pointer text-left transition-all active:opacity-80 ${
                  city === c ? 'bg-accent text-white' : 'bg-bg-secondary text-text'
                }`}
              >
                <span className="text-sm font-medium">{c}</span>
                {city === c && <CheckIcon />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      <div className="px-4">
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState title="No tournaments" description="No tournaments match your filters" />
        ) : (
          filtered.map((t) => (
            <Card
              key={t.id}
              onClick={() => navigate(`/tournament/${t.id}`)}
              className={t.status === 'completed' ? 'opacity-50' : ''}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-base flex-1 mr-2 text-text">
                  {t.name}
                </h3>
                {statusBadge(t.status)}
              </div>
              <p className="text-[13px] text-text-secondary">
                {t.city} · {t.start_date}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <ImportanceDots level={t.importance_level} />
                <span className="text-[13px] font-mono text-text-secondary">{t.entry_count} entries</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}
