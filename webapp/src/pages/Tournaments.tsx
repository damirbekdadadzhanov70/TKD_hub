import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getTournaments } from '../api/endpoints';
import { mockTournaments } from '../api/mock';
import type { TournamentListItem } from '../types';

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    upcoming: 'bg-green-50 text-green-600',
    ongoing: 'bg-red-50 text-red-500',
    completed: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<string, string> = {
    upcoming: 'Upcoming',
    ongoing: 'Reg. closing',
    completed: 'Completed',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {labels[status] || status}
    </span>
  );
}

function importanceStars(level: number) {
  return '★'.repeat(level) + '☆'.repeat(Math.max(0, 3 - level));
}

export default function Tournaments() {
  const navigate = useNavigate();
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState('');

  const { data: tournaments, loading } = useApi<TournamentListItem[]>(
    () => getTournaments({ country: country || undefined, status: status || undefined }),
    mockTournaments,
    [country, status],
  );

  const filtered = tournaments || [];

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-text">
          Tournaments
        </h1>
      </div>

      <FilterBar
        filters={[
          {
            key: 'country',
            label: 'Countries',
            options: [
              { value: 'Kyrgyzstan', label: 'Kyrgyzstan' },
              { value: 'Kazakhstan', label: 'Kazakhstan' },
              { value: 'Uzbekistan', label: 'Uzbekistan' },
              { value: 'Turkmenistan', label: 'Turkmenistan' },
              { value: 'Tajikistan', label: 'Tajikistan' },
            ],
            value: country,
            onChange: setCountry,
          },
          {
            key: 'status',
            label: 'Statuses',
            options: [
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'ongoing', label: 'Ongoing' },
              { value: 'completed', label: 'Completed' },
            ],
            value: status,
            onChange: setStatus,
          },
        ]}
      />

      <div className="px-4">
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon="🏟️" title="No tournaments" description="No tournaments match your filters" />
        ) : (
          filtered.map((t) => (
            <Card key={t.id} onClick={() => navigate(`/tournament/${t.id}`)} className="border-l-4 border-l-green-500">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-[15px] flex-1 mr-2 text-text">
                  {t.name}
                </h3>
                {statusBadge(t.status)}
              </div>
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span>📍 {t.city}, {t.country}</span>
                <span>📅 {t.start_date}</span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                <span className="text-amber-400">{importanceStars(t.importance_level)}</span>
                <span>👥 {t.entry_count} entries</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
