import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import BottomSheet from '../components/BottomSheet';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n/I18nProvider';
import {
  approveCoachEntries,
  deleteTournament,
  enterTournament,
  getCoachAthletes,
  getMe,
  getTournament,
  getTournamentResults,
  markInterest,
  rejectCoachEntries,
  removeEntry,
} from '../api/endpoints';
import { getMockTournamentDetail, mockCoachAthletes, mockMe, mockTournamentResults } from '../api/mock';
import type { CoachAthlete, MeResponse, TournamentDetail as TournamentDetailType, TournamentEntry, TournamentResult } from '../types';

const MEDAL_COLORS: Record<number, string> = {
  1: 'text-medal-gold',
  2: 'text-medal-silver',
  3: 'text-medal-bronze',
};

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showBackButton, isTelegram, hapticNotification } = useTelegram();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [tab, setTab] = useState<'details' | 'results'>('details');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return showBackButton(() => navigate(-1));
  }, []);

  const mockDetail = getMockTournamentDetail(id!);
  const { data: tournament, loading, error, refetch, mutate } = useApi<TournamentDetailType>(
    () => getTournament(id!),
    mockDetail,
    [id],
  );

  // If tournament not found (deleted / 404), show toast and redirect to list
  useEffect(() => {
    if (!loading && (error || (!tournament && !mockDetail))) {
      showToast(t('tournamentDetail.tournamentDeleted'));
      navigate('/', { replace: true });
    }
  }, [loading, error, tournament]);

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
  if (!syncedTournament) return null;

  const isAdmin = me?.role === 'admin';
  const isAthlete = me?.role === 'athlete';
  const isCoach = me?.role === 'coach';
  const isOpen = syncedTournament.status === 'upcoming' || syncedTournament.status === 'registration_open' || syncedTournament.status === 'ongoing';
  const isCompleted = syncedTournament.status === 'completed';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTournament(syncedTournament.id);
      hapticNotification('success');
      showToast(t('tournamentDetail.tournamentDeleted'));
      navigate('/', { replace: true });
    } catch (err) {
      hapticNotification('error');
      showToast(err instanceof Error ? err.message : t('common.error'), 'error');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div>
      <div className="px-4 pt-4">
        {!isTelegram && (
          <button
            onClick={() => navigate(-1)}
            className="text-sm mb-3 border-none bg-transparent cursor-pointer text-accent"
          >
            {t('tournamentDetail.back')}
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
            {t('tournamentDetail.details')}
          </button>
          <button
            onClick={() => setTab('results')}
            className={`pb-2 text-sm font-medium border-none bg-transparent cursor-pointer transition-colors ${
              tab === 'results'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-secondary'
            }`}
          >
            {t('tournamentDetail.results')}
          </button>
        </div>
      )}

      {/* Details tab */}
      {tab === 'details' && (
        <div className="px-4">
          <Card>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div>
                <span className="text-text-secondary">{t('tournamentDetail.dates')}</span>
                <p className="font-medium text-text">
                  {syncedTournament.start_date} — {syncedTournament.end_date}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">{t('tournamentDetail.location')}</span>
                <p className="font-medium text-text">
                  {syncedTournament.venue}, {syncedTournament.city}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">{t('tournamentDetail.registrationDeadline')}</span>
                <p className="font-medium text-text">
                  {syncedTournament.registration_deadline}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">{t('tournamentDetail.entryFee')}</span>
                <p className="font-medium text-text">
                  {syncedTournament.entry_fee ? `${syncedTournament.entry_fee} ${syncedTournament.currency}` : t('common.free')}
                </p>
              </div>
            </div>
          </Card>

          {syncedTournament.age_categories.length > 0 && (
            <Card>
              <h3 className="font-semibold text-sm mb-2 text-text">
                {t('tournamentDetail.ageCategories')}
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
                {t('tournamentDetail.weightCategories')}
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
            <EnterAthletesButton
              tournamentId={syncedTournament.id}
              existingEntries={syncedTournament.entries}
              ageCategories={syncedTournament.age_categories}
              myCoachId={me?.coach?.id}
              onDone={(updated) => { if (updated) mutate(updated); else refetch(); }}
            />
          )}

          <EntriesSection
            tournament={syncedTournament}
            tournamentId={syncedTournament.id}
            isAdmin={isAdmin}
            isCoach={isCoach}
            myCoachId={me?.coach?.id}
            refetch={refetch}
          />
        </div>
      )}

      {/* Results tab */}
      {tab === 'results' && (
        <ResultsTab tournamentId={syncedTournament.id} />
      )}

      {/* Admin delete button */}
      {isAdmin && (
        <div className="px-4 mt-6 mb-8">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500/10 text-rose-500 active:opacity-80 hover:bg-rose-500/20 transition-all"
          >
            {t('tournamentDetail.deleteTournament')}
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <BottomSheet onClose={() => setShowDeleteConfirm(false)}>
          <div className="p-4 pt-5 text-center">
            <h2 className="text-lg font-bold text-text mb-1">
              {t('tournamentDetail.deleteTournament')}
            </h2>
            <p className="text-sm text-text-secondary mb-1">
              {syncedTournament.name}
            </p>
            <p className="text-xs text-text-disabled mb-5">
              {t('tournamentDetail.deleteTournamentDesc')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border border-border bg-transparent cursor-pointer text-text active:opacity-80 transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500 text-white active:opacity-80 disabled:opacity-60 transition-all"
              >
                {deleting ? t('tournamentDetail.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

/* ---- Status badge config ---- */

const STATUS_CONFIG: Record<string, string> = {
  approved: 'bg-accent-light text-accent',
  pending: 'bg-bg-divider text-text-disabled',
  rejected: 'bg-rose-500/10 text-rose-500',
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const labels: Record<string, string> = {
    approved: t('common.approved'),
    pending: t('common.pending'),
    rejected: t('common.rejected'),
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[status] || 'bg-bg-divider text-text-disabled'}`}>
      {labels[status] || status}
    </span>
  );
}

/* ---- Grouped entries helpers ---- */

interface CoachGroup {
  coachId: string;
  coachName: string;
  status: string; // take from first entry (all same coach → same status)
  entries: TournamentEntry[];
}

function groupEntriesByCoach(entries: TournamentEntry[]): CoachGroup[] {
  const map = new Map<string, CoachGroup>();
  for (const e of entries) {
    const key = e.coach_id || `individual-${e.id}`;
    if (!map.has(key)) {
      map.set(key, {
        coachId: e.coach_id || '',
        coachName: e.coach_name || e.athlete_name,
        status: e.status,
        entries: [],
      });
    }
    map.get(key)!.entries.push(e);
  }
  return Array.from(map.values());
}

/* ---- Entries section ---- */

function EntriesSection({
  tournament,
  tournamentId,
  isAdmin,
  isCoach,
  myCoachId,
  refetch,
}: {
  tournament: TournamentDetailType;
  tournamentId: string;
  isAdmin: boolean;
  isCoach?: boolean;
  myCoachId?: string;
  refetch: (silent?: boolean) => void;
}) {
  const { t } = useI18n();
  const groups = useMemo(() => groupEntriesByCoach(tournament.entries), [tournament.entries]);
  const pendingGroups = groups.filter((g) => g.status === 'pending').length;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold text-text">
          {t('tournamentDetail.entries')} ({groups.length})
        </h2>
        {isAdmin && pendingGroups > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-bg-divider text-text-disabled">
            {pendingGroups} {t('tournamentDetail.pendingCount')}
          </span>
        )}
      </div>
      {groups.length === 0 ? (
        <EmptyState title={t('tournamentDetail.noEntries')} />
      ) : (
        groups.map((group) => (
          <CoachEntryCard
            key={group.coachId || group.entries[0].id}
            group={group}
            tournamentId={tournamentId}
            isAdmin={isAdmin}
            isMyEntry={isCoach === true && group.coachId === myCoachId}
            refetch={refetch}
          />
        ))
      )}
    </div>
  );
}

/* ---- Coach entry card (grouped) ---- */

function CoachEntryCard({
  group,
  tournamentId,
  isAdmin,
  isMyEntry,
  refetch,
}: {
  group: CoachGroup;
  tournamentId: string;
  isAdmin: boolean;
  isMyEntry: boolean;
  refetch: (silent?: boolean) => void;
}) {
  const { t } = useI18n();
  const { hapticNotification } = useTelegram();
  const { showToast } = useToast();
  const [processing, setProcessing] = useState(false);

  const handleApprove = async () => {
    setProcessing(true);
    try {
      await approveCoachEntries(tournamentId, group.coachId);
      hapticNotification('success');
      showToast(t('tournamentDetail.entryApproved'));
      refetch(true);
    } catch (err) {
      hapticNotification('error');
      showToast(err instanceof Error ? err.message : t('common.error'), 'error');
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      await rejectCoachEntries(tournamentId, group.coachId);
      hapticNotification('success');
      showToast(t('tournamentDetail.entryRejected'));
      refetch(true);
    } catch (err) {
      hapticNotification('error');
      showToast(err instanceof Error ? err.message : t('common.error'), 'error');
      setProcessing(false);
    }
  };

  const handleRemoveAthlete = async (entryId: string) => {
    try {
      await removeEntry(tournamentId, entryId);
      hapticNotification('success');
      showToast(t('tournamentDetail.athleteRemoved'));
      refetch(true);
    } catch (err) {
      hapticNotification('error');
      showToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  };

  const count = group.entries.length;
  const athleteWord = count === 1
    ? t('tournamentDetail.athlete')
    : count >= 2 && count <= 4
      ? t('tournamentDetail.athletesGen')
      : t('tournamentDetail.athletes');

  return (
    <Card>
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="font-medium text-sm text-text">
            {t('tournamentDetail.coachEntry')} {group.coachName}
          </p>
          <p className="text-xs text-text-secondary">
            {count} {athleteWord}
          </p>
        </div>
        <StatusBadge status={group.status} />
      </div>

      {/* Athletes list */}
      <div className="border-t border-border pt-2 space-y-1.5">
        {group.entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-text truncate">{entry.athlete_name}</p>
              <p className="text-[11px] text-text-secondary">
                {entry.weight_category} · {entry.age_category}
              </p>
            </div>
            {isMyEntry && group.status === 'pending' && (
              <button
                onClick={() => handleRemoveAthlete(entry.id)}
                className="text-[11px] text-rose-500 border-none bg-transparent cursor-pointer px-2 py-1 rounded hover:bg-rose-500/10 active:opacity-80 transition-all shrink-0"
              >
                {t('tournamentDetail.removeAthlete')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Admin approve/reject */}
      {isAdmin && group.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleApprove}
            disabled={processing}
            className="flex-1 py-2 rounded-lg text-xs font-semibold border-none cursor-pointer bg-accent text-accent-text active:opacity-80 disabled:opacity-40 transition-all hover:opacity-90"
          >
            {t('tournamentDetail.approve')}
          </button>
          <button
            onClick={handleReject}
            disabled={processing}
            className="flex-1 py-2 rounded-lg text-xs font-semibold border-none cursor-pointer bg-rose-500/10 text-rose-500 active:opacity-80 disabled:opacity-40 transition-all hover:bg-rose-500/20"
          >
            {t('tournamentDetail.reject')}
          </button>
        </div>
      )}
    </Card>
  );
}

/* ---- Results tab ---- */

function ResultsTab({ tournamentId }: { tournamentId: string }) {
  const { t } = useI18n();
  const { data: results, loading } = useApi<TournamentResult[]>(
    () => getTournamentResults(tournamentId),
    mockTournamentResults,
    [tournamentId],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TournamentResult[]>();
    (results || []).forEach((r) => {
      const key = `${r.age_category} · ${r.weight_category}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    // Sort within each group by place
    map.forEach((arr) => arr.sort((a, b) => a.place - b.place));
    return map;
  }, [results]);

  if (loading) {
    return <div className="px-4"><LoadingSpinner /></div>;
  }

  if (!results || results.length === 0) {
    return (
      <div className="px-4">
        <EmptyState title={t('tournamentDetail.noResults')} />
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
  const { t } = useI18n();
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
      {loading ? t('common.saving') : marked ? t('tournamentDetail.interested') : t('tournamentDetail.imInterested')}
    </button>
  );
}

/* ---- Enter athletes button + modal ---- */

function EnterAthletesButton({
  tournamentId,
  existingEntries,
  ageCategories,
  myCoachId,
  onDone,
}: {
  tournamentId: string;
  existingEntries: TournamentEntry[];
  ageCategories: string[];
  myCoachId?: string;
  onDone: (updated?: TournamentDetailType) => void;
}) {
  const { t } = useI18n();
  const [showModal, setShowModal] = useState(false);

  const myEntries = existingEntries.filter((e) => e.coach_id === myCoachId);
  const hasEntry = myEntries.length > 0;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer mb-3 active:opacity-80 transition-all ${
          hasEntry
            ? 'bg-accent-light text-accent'
            : 'bg-accent text-accent-text'
        }`}
      >
        {hasEntry ? t('tournamentDetail.editEntry') : t('tournamentDetail.enterAthletes')}
      </button>
      {showModal && (
        <EnterAthletesModal
          tournamentId={tournamentId}
          ageCategories={ageCategories}
          existingAthleteIds={new Set(myEntries.map((e) => e.athlete_id).filter(Boolean) as string[])}
          onClose={() => setShowModal(false)}
          onDone={(updated) => { setShowModal(false); onDone(updated); }}
        />
      )}
    </>
  );
}

function EnterAthletesModal({
  tournamentId,
  ageCategories,
  existingAthleteIds,
  onClose,
  onDone,
}: {
  tournamentId: string;
  ageCategories: string[];
  existingAthleteIds: Set<string>;
  onClose: () => void;
  onDone: (updated?: TournamentDetailType) => void;
}) {
  const { hapticNotification } = useTelegram();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { data: athletes, loading, error: athletesError } = useApi<CoachAthlete[]>(
    getCoachAthletes,
    mockCoachAthletes,
    [],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedAge, setSelectedAge] = useState(ageCategories[0] || '');
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) => {
    if (existingAthleteIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0 || !selectedAge) return;
    setSubmitting(true);
    try {
      await enterTournament(tournamentId, Array.from(selected), selectedAge);
      hapticNotification('success');
      showToast(t('tournamentDetail.entriesSubmitted'));
      onDone();
    } catch (err) {
      hapticNotification('error');
      showToast(err instanceof Error ? err.message : t('common.error'), 'error');
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex justify-between items-center p-4 pb-2 shrink-0">
        <h2 className="text-xl font-heading text-text-heading">{t('tournamentDetail.selectAthletes')}</h2>
        <button onClick={onClose} className="text-2xl border-none bg-transparent cursor-pointer text-muted">×</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
        {loading ? (
          <LoadingSpinner />
        ) : athletesError ? (
          <EmptyState title={t('common.error')} description={athletesError} />
        ) : !athletes || athletes.length === 0 ? (
          <EmptyState title={t('tournamentDetail.noAthletes')} description={t('tournamentDetail.noLinkedAthletes')} />
        ) : (
          athletes.map((a) => {
            const alreadyAdded = existingAthleteIds.has(a.id);
            const isSelected = selected.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                disabled={alreadyAdded}
                className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1.5 border-none cursor-pointer text-left transition-all active:opacity-80 disabled:cursor-default disabled:opacity-50 ${
                  alreadyAdded
                    ? 'bg-bg-divider'
                    : isSelected
                      ? 'bg-accent-light'
                      : 'bg-bg-secondary'
                }`}
              >
                {/* Radio circle */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  alreadyAdded
                    ? 'border-accent bg-accent'
                    : isSelected
                      ? 'border-accent bg-accent'
                      : 'border-text-disabled'
                }`}>
                  {(alreadyAdded || isSelected) && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-text truncate">{a.full_name}</p>
                  <p className="text-[11px] text-text-secondary">
                    {a.weight_category} · {a.sport_rank}
                    {alreadyAdded && <span className="ml-1.5 text-text-disabled">· {t('tournamentDetail.alreadyAdded')}</span>}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="p-4 pt-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {/* Age category selector */}
        {ageCategories.length > 1 && (
          <div className="mb-3">
            <p className="text-[11px] uppercase tracking-wider text-text-disabled mb-1.5">{t('tournamentDetail.ageCategory')}</p>
            <div className="flex flex-wrap gap-1.5">
              {ageCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedAge(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full border-none cursor-pointer transition-all active:opacity-80 ${
                    selectedAge === cat
                      ? 'bg-accent text-accent-text'
                      : 'bg-bg-secondary text-text-secondary hover:bg-accent-light'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting || selected.size === 0}
          className="w-full py-3.5 rounded-lg text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-40 active:opacity-80 transition-all"
        >
          {submitting ? t('tournamentDetail.confirming') : selected.size === 0 ? t('tournamentDetail.selectAthletesBtn') : `${t('tournamentDetail.confirmCount')} · ${selected.size}`}
        </button>
      </div>
    </BottomSheet>
  );
}
