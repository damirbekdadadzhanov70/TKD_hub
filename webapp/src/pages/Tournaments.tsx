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
    upcoming: 'bg-accent-light text-accent',
    ongoing: 'bg-amber-50/70 text-amber-700',
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
          <EmptyState title="No tournaments" description="No tournaments match your filters" />
        ) : (
          filtered.map((t) => (
            <Card key={t.id} onClick={() => navigate(`/tournament/${t.id}`)}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-sm flex-1 mr-2 text-text">
                  {t.name}
                </h3>
                {statusBadge(t.status)}
              </div>
              <p className="text-xs text-text-secondary">
                {t.city}, {t.country} · {t.start_date}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <ImportanceDots level={t.importance_level} />
                <span className="text-xs text-muted">{t.entry_count} entries</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
