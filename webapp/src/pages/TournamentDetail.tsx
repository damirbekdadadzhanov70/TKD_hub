import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import BottomSheet from '../components/BottomSheet';
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
import { mockCoachAthletes, mockMe, mockTournamentDetail, mockTournamentResults } from '../api/mock';
import type { CoachAthlete, MeResponse, TournamentDetail as TournamentDetailType, TournamentResult } from '../types';

const MEDAL_COLORS: Record<number, string> = {
  1: 'text-medal-gold',
  2: 'text-medal-silver',
  3: 'text-medal-bronze',
};

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showBackButton, isTelegram } = useTelegram();
  const [tab, setTab] = useState<'details' | 'results'>('details');

  useEffect(() => {
    return showBackButton(() => navigate(-1));
  }, []);

  const { data: tournament, loading, refetch } = useApi<TournamentDetailType>(
    () => getTournament(id!),
    mockTournamentDetail,
    [id],
  );

  const { data: me } = useApi<MeResponse>(getMe, mockMe, []);

  // Sync entry names with current user profile
  const myAthleteId = me?.athlete?.id;
  const syncedTournament = useMemo(() => {
    if (!tournament || !myAthleteId || !me?.athlete) return tournament;
    const name = me.athlete.full_name;
    const synced = tournament.entries.some((e) => e.athlete_id === myAthleteId && e.athlete_name !== name);
    if (!synced) return tournament;
    return {
      ...tournament,
      entries: tournament.entries.map((e) =>
        e.athlete_id === myAthleteId ? { ...e, athlete_name: name } : e,
      ),
    };
  }, [tournament, myAthleteId, me?.athlete]);

  if (loading) return <LoadingSpinner />;
  if (!syncedTournament) return <EmptyState title="Tournament not found" />;

  const isAthlete = me?.role === 'athlete';
  const isCoach = me?.role === 'coach';
  const isOpen = syncedTournament.status === 'upcoming' || syncedTournament.status === 'registration_open';
  const isCompleted = syncedTournament.status === 'completed';

  return (
    <div>
      <div className="px-4 pt-4">
        {!isTelegram && (
          <button
            onClick={() => navigate(-1)}
            className="text-sm mb-3 border-none bg-transparent cursor-pointer text-accent"
          >
            ← Back
          </button>
        )}
        <h1 className="text-xl font-heading text-text-heading mb-1">
          {syncedTournament.name}
        </h1>
        {syncedTournament.description && (
          <p className="text-sm mb-3 text-text-secondary">
            {syncedTournament.description}
          </p>
        )}
      </div>

      {/* Tabs for completed tournaments */}
      {isCompleted && (
        <div className="flex px-4 mb-3 gap-6">
          <button
            onClick={() => setTab('details')}
            className={`pb-2 text-sm font-medium border-none bg-transparent cursor-pointer transition-colors ${
              tab === 'details'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-secondary'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setTab('results')}
            className={`pb-2 text-sm font-medium border-none bg-transparent cursor-pointer transition-colors ${
              tab === 'results'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-secondary'
            }`}
          >
            Results
          </button>
        </div>
      )}

      {/* Details tab */}
      {tab === 'details' && (
        <div className="px-4">
          <Card>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div>
                <span className="text-text-secondary">Dates</span>
                <p className="font-medium text-text">
                  {syncedTournament.start_date} — {syncedTournament.end_date}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Location</span>
                <p className="font-medium text-text">
                  {syncedTournament.venue}, {syncedTournament.city}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Registration deadline</span>
                <p className="font-medium text-text">
                  {syncedTournament.registration_deadline}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Entry fee</span>
                <p className="font-medium text-text">
                  {syncedTournament.entry_fee ? `${syncedTournament.entry_fee} ${syncedTournament.currency}` : 'Free'}
                </p>
              </div>
            </div>
          </Card>

          {syncedTournament.age_categories.length > 0 && (
            <Card>
              <h3 className="font-semibold text-sm mb-2 text-text">
                Age categories
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {syncedTournament.age_categories.map((cat) => (
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

          {syncedTournament.weight_categories.length > 0 && (
            <Card>
              <h3 className="font-semibold text-sm mb-2 text-text">
                Weight categories
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {syncedTournament.weight_categories.map((cat) => (
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
            <InterestButton tournamentId={syncedTournament.id} />
          )}
          {isOpen && isCoach && (
            <EnterAthletesButton tournamentId={syncedTournament.id} onDone={refetch} />
          )}

          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-3 text-text">
              Entries ({syncedTournament.entries.length})
            </h2>
            {syncedTournament.entries.length === 0 ? (
              <EmptyState title="No entries yet" />
            ) : (
              syncedTournament.entries.map((entry) => (
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
                          ? 'bg-accent-light text-accent'
                          : 'bg-bg-divider text-text-disabled'
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
      )}

      {/* Results tab */}
      {tab === 'results' && (
        <ResultsTab />
      )}
    </div>
  );
}

/* ---- Results tab ---- */

function ResultsTab() {
  const results = mockTournamentResults;

  const grouped = useMemo(() => {
    const map = new Map<string, TournamentResult[]>();
    results.forEach((r) => {
      const key = `${r.age_category} · ${r.weight_category}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    // Sort within each group by place
    map.forEach((arr) => arr.sort((a, b) => a.place - b.place));
    return map;
  }, [results]);

  if (results.length === 0) {
    return (
      <div className="px-4">
        <EmptyState title="No results yet" />
      </div>
    );
  }

  return (
    <div className="px-4">
      {Array.from(grouped.entries()).map(([category, items]) => (
        <div key={category} className="mb-5">
          <p className="text-[11px] uppercase tracking-wider text-text-disabled mb-2">
            {category}
          </p>
          <div>
            {items.map((r, i) => (
              <div
                key={`${r.athlete_name}-${r.place}`}
                className={`flex items-center py-2.5 ${
                  i < items.length - 1 ? 'border-b border-dashed border-border' : ''
                }`}
              >
                <span className={`font-mono text-base font-semibold w-8 shrink-0 ${MEDAL_COLORS[r.place] || 'text-text-disabled'}`}>
                  {r.place}
                </span>
                <span className="text-[15px] text-text flex-1 min-w-0 truncate">
                  {r.athlete_name}
                </span>
                <span className="text-[13px] text-text-secondary shrink-0 ml-2">
                  {r.city}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Interest button ---- */

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
      className={`w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer mb-3 transition-all active:opacity-80 ${
        marked
          ? 'bg-accent-light text-accent'
          : 'bg-accent text-accent-text'
      } disabled:opacity-60`}
    >
      {loading ? 'Saving...' : marked ? 'Interested!' : 'I\'m Interested'}
    </button>
  );
}

/* ---- Enter athletes button + modal ---- */

function EnterAthletesButton({ tournamentId, onDone }: { tournamentId: string; onDone: () => void }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer mb-3 bg-accent text-accent-text active:opacity-80 transition-all"
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
  const { hapticNotification } = useTelegram();
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
      hapticNotification('success');
      onDone();
    } catch {
      hapticNotification('error');
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex justify-between items-center p-4 pb-2 shrink-0">
        <h2 className="text-xl font-heading text-text-heading">Select Athletes</h2>
        <button onClick={onClose} className="text-2xl border-none bg-transparent cursor-pointer text-muted">×</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
        {loading ? (
          <LoadingSpinner />
        ) : !athletes || athletes.length === 0 ? (
          <EmptyState title="No athletes" description="You have no linked athletes" />
        ) : (
          athletes.map((a) => (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1.5 border-none cursor-pointer text-left transition-all active:opacity-80 ${
                selected.has(a.id) ? 'bg-accent-light' : 'bg-bg-secondary'
              }`}
            >
              {/* Radio circle */}
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                selected.has(a.id) ? 'border-accent bg-accent' : 'border-text-disabled'
              }`}>
                {selected.has(a.id) && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-text truncate">{a.full_name}</p>
                <p className="text-[11px] text-text-secondary">
                  {a.weight_category} · {a.belt}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="p-4 pt-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting || selected.size === 0}
          className="w-full py-3.5 rounded-lg text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-40 active:opacity-80 transition-all"
        >
          {submitting ? 'Confirming...' : selected.size === 0 ? 'Select athletes' : `Confirm · ${selected.size} athlete${selected.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </BottomSheet>
  );
}
