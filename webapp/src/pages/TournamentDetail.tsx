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
  updateTournament,
} from '../api/endpoints';
import { CITIES } from '../constants/cities';
import { formatDate } from '../constants/format';
import { getMockTournamentDetail, mockCoachAthletes, mockMe, mockTournamentResults } from '../api/mock';
import type { CoachAthlete, MeResponse, TournamentCreate, TournamentDetail as TournamentDetailType, TournamentEntry, TournamentResult } from '../types';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    return showBackButton(() => navigate(-1));
  }, []);

  const mockDetail = getMockTournamentDetail(id!);
  const { data: tournament, loading, error, refetch } = useApi<TournamentDetailType>(
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

      {/* Details */}
      <div className="px-4">
        <Card>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <span className="text-text-secondary">{t('tournamentDetail.dates')}</span>
              <p className="font-medium text-text">
                {formatDate(syncedTournament.start_date)} — {formatDate(syncedTournament.end_date)}
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
                {formatDate(syncedTournament.registration_deadline)}
              </p>
            </div>
            {syncedTournament.entry_fee != null && (
              <div>
                <span className="text-text-secondary">{t('tournamentDetail.entryFee')}</span>
                <p className="font-medium text-text">
                  {syncedTournament.entry_fee} {syncedTournament.currency}
                </p>
              </div>
            )}
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

        {/* Results accordion */}
        {syncedTournament.results && syncedTournament.results.length > 0 && (
          <ResultsAccordion results={syncedTournament.results} />
        )}

        {/* Photos section */}
        {syncedTournament.photos_url && (
          <Card>
            <a
              href={syncedTournament.photos_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-sm font-medium text-accent no-underline active:opacity-80 transition-opacity"
            >
              <span>{t('tournamentDetail.viewPhotos')}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </Card>
        )}

        {/* Contacts section */}
        {(syncedTournament.organizer_name || syncedTournament.organizer_phone || syncedTournament.organizer_telegram) && (
          <Card>
            <h3 className="font-semibold text-sm mb-2 text-text">
              {t('tournamentDetail.contactsSection')}
            </h3>
            <div className="space-y-1.5 text-sm">
              {syncedTournament.organizer_name && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('tournamentDetail.organizer')}</span>
                  <span className="text-text">{syncedTournament.organizer_name}</span>
                </div>
              )}
              {syncedTournament.organizer_phone && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('tournamentDetail.phone')}</span>
                  <a href={`tel:${syncedTournament.organizer_phone}`} className="text-accent no-underline">
                    {syncedTournament.organizer_phone}
                  </a>
                </div>
              )}
              {syncedTournament.organizer_telegram && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('tournamentDetail.telegram')}</span>
                  <a
                    href={`https://t.me/${syncedTournament.organizer_telegram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent no-underline"
                  >
                    {syncedTournament.organizer_telegram}
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Admin edit + delete buttons */}
      {isAdmin && (
        <div className="px-4 mt-6 mb-8 space-y-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text active:opacity-80 hover:opacity-90 transition-all"
          >
            {t('tournamentDetail.editTournament')}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500/10 text-rose-500 active:opacity-80 hover:bg-rose-500/20 transition-all"
          >
            {t('tournamentDetail.deleteTournament')}
          </button>
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && (
        <EditTournamentModal
          tournament={syncedTournament}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); refetch(); }}
        />
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

export function EntriesSection({
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

export function ResultsTab({ tournamentId }: { tournamentId: string }) {
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

/* ---- Results accordion ---- */

function ResultsAccordion({ results }: { results: TournamentResult[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, TournamentResult[]>();
    results.forEach((r) => {
      const genderLabel = r.gender === 'M' ? t('tournamentDetail.genderM') : r.gender === 'F' ? t('tournamentDetail.genderF') : '';
      const key = `${r.weight_category} · ${r.age_category}${genderLabel ? ` (${genderLabel})` : ''}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    map.forEach((arr) => arr.sort((a, b) => a.place - b.place));
    return map;
  }, [results, t]);

  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between border-none bg-transparent cursor-pointer p-0 active:opacity-80 transition-opacity"
      >
        <h3 className="font-semibold text-sm text-text">
          {t('tournamentDetail.resultsSection')} ({results.length})
        </h3>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <p className="text-[11px] uppercase tracking-wider text-text-disabled mb-2">
                {category}
              </p>
              <div>
                {items.map((r, i) => (
                  <div
                    key={r.id}
                    className={`flex items-center py-2 ${
                      i < items.length - 1 ? 'border-b border-dashed border-border' : ''
                    }`}
                  >
                    <span className={`font-mono text-sm font-semibold w-7 shrink-0 ${MEDAL_COLORS[r.place] || 'text-text-disabled'}`}>
                      {r.place}
                    </span>
                    <span className="text-sm text-text flex-1 min-w-0 truncate">
                      {r.athlete_name}
                    </span>
                    <span className="text-xs text-text-secondary shrink-0 ml-2">
                      {r.city}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---- Edit tournament modal ---- */

const IMPORTANCE_LEVELS = [1, 2, 3];

function EditTournamentModal({
  tournament,
  onClose,
  onSaved,
}: {
  tournament: TournamentDetailType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { hapticNotification } = useTelegram();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [form, setForm] = useState<TournamentCreate>({
    name: tournament.name,
    description: tournament.description ?? null,
    start_date: tournament.start_date,
    end_date: tournament.end_date,
    city: tournament.city,
    venue: tournament.venue,
    age_categories: tournament.age_categories,
    weight_categories: tournament.weight_categories,
    entry_fee: tournament.entry_fee ? Number(tournament.entry_fee) : null,
    currency: tournament.currency,
    registration_deadline: tournament.registration_deadline,
    importance_level: tournament.importance_level,
    photos_url: tournament.photos_url ?? null,
    organizer_name: tournament.organizer_name ?? null,
    organizer_phone: tournament.organizer_phone ?? null,
    organizer_telegram: tournament.organizer_telegram ?? null,
  });
  const [saving, setSaving] = useState(false);

  const canSave = form.name.trim() && form.venue.trim() && form.start_date && form.end_date;

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await updateTournament(tournament.id, form);
      hapticNotification('success');
      showToast(t('tournamentDetail.tournamentUpdated'));
      onSaved();
    } catch (err) {
      hapticNotification('error');
      showToast(err instanceof Error ? err.message : t('common.error'), 'error');
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex justify-between items-center p-4 pb-2 shrink-0">
        <h2 className="text-lg font-bold text-text">{t('tournamentDetail.editTournament')}</h2>
        <button onClick={onClose} className="text-2xl border-none bg-transparent cursor-pointer text-muted">×</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-3">
        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.tournamentName')}</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.description')}</span>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => update('description', e.target.value || null)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none resize-none"
            rows={2}
            placeholder={t('common.optional')}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.startDate')}</span>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => update('start_date', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.endDate')}</span>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => update('end_date', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.selectCity')}</span>
          <select
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
          >
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.venue')}</span>
          <input
            type="text"
            value={form.venue}
            onChange={(e) => update('venue', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.entryFee')}</span>
            <input
              type="number"
              value={form.entry_fee ?? ''}
              onChange={(e) => update('entry_fee', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
              placeholder={t('common.free')}
            />
          </label>
          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.currency')}</span>
            <select
              value={form.currency}
              onChange={(e) => update('currency', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
            >
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.registrationDeadline')}</span>
          <input
            type="date"
            value={form.registration_deadline}
            onChange={(e) => update('registration_deadline', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
          />
        </label>

        <div className="block">
          <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.importanceLevel')}</span>
          <div className="flex gap-2">
            {IMPORTANCE_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => update('importance_level', lvl)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${
                  form.importance_level === lvl
                    ? 'bg-accent text-white border-accent'
                    : 'bg-bg-secondary text-text-secondary border-border hover:border-accent/40'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.photosUrl')}</span>
          <input
            type="url"
            value={form.photos_url ?? ''}
            onChange={(e) => update('photos_url', e.target.value || null)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
            placeholder={t('common.optional')}
          />
        </label>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.organizerName')}</span>
          <input
            type="text"
            value={form.organizer_name ?? ''}
            onChange={(e) => update('organizer_name', e.target.value || null)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
            placeholder={t('common.optional')}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.organizerPhone')}</span>
            <input
              type="tel"
              value={form.organizer_phone ?? ''}
              onChange={(e) => update('organizer_phone', e.target.value || null)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
              placeholder={t('common.optional')}
            />
          </label>
          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">{t('tournaments.organizerTelegram')}</span>
            <input
              type="text"
              value={form.organizer_telegram ?? ''}
              onChange={(e) => update('organizer_telegram', e.target.value || null)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
              placeholder={t('common.optional')}
            />
          </label>
        </div>
      </div>

      <div className="p-4 pt-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !canSave}
          className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-60 active:opacity-80 transition-all"
        >
          {saving ? t('tournamentDetail.savingTournament') : t('common.save')}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ---- Interest button ---- */

export function InterestButton({ tournamentId }: { tournamentId: string }) {
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

export function EnterAthletesButton({
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
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      await enterTournament(tournamentId, Array.from(selected), selectedAge || '');
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
