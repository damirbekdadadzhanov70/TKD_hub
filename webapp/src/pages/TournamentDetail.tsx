import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import {
  enterTournament,
  getCoachAthletes,
  getMe,
  getTournament,
  markInterest,
} from '../api/endpoints';
import { mockCoachAthletes, mockMe, mockTournamentDetail } from '../api/mock';
import type { CoachAthlete, MeResponse, TournamentDetail as TournamentDetailType } from '../types';

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: tournament, loading, refetch } = useApi<TournamentDetailType>(
    () => getTournament(id!),
    mockTournamentDetail,
    [id],
  );

  const { data: me } = useApi<MeResponse>(getMe, mockMe, []);

  if (loading) return <LoadingSpinner />;
  if (!tournament) return <EmptyState title="Tournament not found" />;

  const isAthlete = me?.role === 'athlete';
  const isCoach = me?.role === 'coach';
  const isOpen = tournament.status === 'upcoming' || tournament.status === 'registration_open';

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

        {/* Action buttons */}
        {isOpen && isAthlete && (
          <InterestButton tournamentId={tournament.id} />
        )}
        {isOpen && isCoach && (
          <EnterAthletesButton tournamentId={tournament.id} onDone={refetch} />
        )}

        <div className="mt-4">
          <h2 className="text-lg font-bold mb-3 text-text">
            Entries ({tournament.entries.length})
          </h2>
          {tournament.entries.length === 0 ? (
            <EmptyState title="No entries yet" />
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
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      entry.status === 'approved'
                        ? 'bg-emerald-50/70 text-emerald-700'
                        : 'bg-amber-50/70 text-amber-700'
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

function InterestButton({ tournamentId }: { tournamentId: string }) {
  const [marked, setMarked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await markInterest(tournamentId);
      setMarked(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || marked}
      className={`w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer mb-3 transition-colors ${
        marked
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-accent text-accent-text'
      } disabled:opacity-60`}
    >
      {loading ? 'Saving...' : marked ? 'Interested!' : 'I\'m Interested'}
    </button>
  );
}

function EnterAthletesButton({ tournamentId, onDone }: { tournamentId: string; onDone: () => void }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer mb-3 bg-accent text-accent-text"
      >
        Enter Athletes
      </button>
      {showModal && (
        <EnterAthletesModal
          tournamentId={tournamentId}
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); onDone(); }}
        />
      )}
    </>
  );
}

function EnterAthletesModal({
  tournamentId,
  onClose,
  onDone,
}: {
  tournamentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: athletes, loading } = useApi<CoachAthlete[]>(
    getCoachAthletes,
    mockCoachAthletes,
    [],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      await enterTournament(tournamentId, Array.from(selected));
      onDone();
    } catch {
      onDone();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="w-full rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden bg-white">
        <div className="flex justify-between items-center p-4 pb-2 shrink-0">
          <h2 className="text-lg font-bold text-text">Select Athletes</h2>
          <button onClick={onClose} className="text-2xl border-none bg-transparent cursor-pointer text-muted">×</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
          {loading ? (
            <LoadingSpinner />
          ) : !athletes || athletes.length === 0 ? (
            <EmptyState title="No athletes" description="You have no linked athletes" />
          ) : (
            athletes.map((a) => (
              <Card
                key={a.id}
                onClick={() => toggle(a.id)}
                className={`!p-3 ${selected.has(a.id) ? 'border-accent bg-accent-light' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    selected.has(a.id) ? 'border-accent bg-accent' : 'border-border'
                  }`}>
                    {selected.has(a.id) && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-text truncate">{a.full_name}</p>
                    <p className="text-[11px] text-text-secondary">
                      {a.weight_category} · {a.belt}
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="p-4 pt-2 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={submitting || selected.size === 0}
            className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-60"
          >
            {submitting ? 'Entering...' : `Enter ${selected.size} athlete${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
