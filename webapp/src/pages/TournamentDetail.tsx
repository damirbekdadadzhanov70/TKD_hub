import { useParams, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getTournament } from '../api/endpoints';
import { mockTournamentDetail } from '../api/mock';
import type { TournamentDetail as TournamentDetailType } from '../types';

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: tournament, loading } = useApi<TournamentDetailType>(
    () => getTournament(id!),
    mockTournamentDetail,
    [id],
  );

  if (loading) return <LoadingSpinner />;
  if (!tournament) return <EmptyState icon="❌" title="Tournament not found" />;

  return (
    <div>
      <div className="px-4 pt-4">
        <button
          onClick={() => navigate(-1)}
          className="text-sm mb-3 border-none bg-transparent cursor-pointer text-accent"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold mb-1 text-text">
          {tournament.name}
        </h1>
        {tournament.description && (
          <p className="text-sm mb-3 text-text-secondary">
            {tournament.description}
          </p>
        )}
      </div>

      <div className="px-4">
        <Card>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <span className="text-text-secondary">Dates</span>
              <p className="font-medium text-text">
                {tournament.start_date} — {tournament.end_date}
              </p>
            </div>
            <div>
              <span className="text-text-secondary">Location</span>
              <p className="font-medium text-text">
                {tournament.venue}, {tournament.city}
              </p>
            </div>
            <div>
              <span className="text-text-secondary">Registration deadline</span>
              <p className="font-medium text-text">
                {tournament.registration_deadline}
              </p>
            </div>
            <div>
              <span className="text-text-secondary">Entry fee</span>
              <p className="font-medium text-text">
                {tournament.entry_fee ? `${tournament.entry_fee} ${tournament.currency}` : 'Free'}
              </p>
            </div>
          </div>
        </Card>

        {tournament.age_categories.length > 0 && (
          <Card>
            <h3 className="font-semibold text-sm mb-2 text-text">
              Age categories
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {tournament.age_categories.map((cat) => (
                <span
                  key={cat}
                  className="text-xs px-2 py-1 rounded-full bg-accent-light text-accent"
                >
                  {cat}
                </span>
              ))}
            </div>
          </Card>
        )}

        {tournament.weight_categories.length > 0 && (
          <Card>
            <h3 className="font-semibold text-sm mb-2 text-text">
              Weight categories
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {tournament.weight_categories.map((cat) => (
                <span
                  key={cat}
                  className="text-xs px-2 py-1 rounded-full bg-accent-light text-accent"
                >
                  {cat}
                </span>
              ))}
            </div>
          </Card>
        )}

        <div className="mt-4">
          <h2 className="text-lg font-bold mb-3 text-text">
            Entries ({tournament.entries.length})
          </h2>
          {tournament.entries.length === 0 ? (
            <EmptyState icon="📋" title="No entries yet" />
          ) : (
            tournament.entries.map((entry) => (
              <Card key={entry.id}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm text-text">
                      {entry.athlete_name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {entry.weight_category} · {entry.age_category}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.status === 'approved'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {entry.status}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
