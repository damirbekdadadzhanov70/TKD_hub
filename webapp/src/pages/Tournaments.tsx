import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PullToRefresh from '../components/PullToRefresh';
import BottomSheet from '../components/BottomSheet';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import { useI18n } from '../i18n/I18nProvider';
import { CITIES } from '../constants/cities';
import { formatDate } from '../constants/format';
import { createTournament, getCoachEntries, getMe, getTournaments } from '../api/endpoints';
import { mockCoachEntries, mockMe, mockTournaments } from '../api/mock';
import type { CoachEntry, MeResponse, TournamentCreate, TournamentListItem } from '../types';

function statusBadge(status: string, t: (key: string) => string) {
  const styles: Record<string, string> = {
    upcoming: 'bg-accent-light text-accent',
    ongoing: 'bg-accent-light text-accent-dark',
    completed: 'bg-bg-secondary text-muted',
  };
  const labels: Record<string, string> = {
    upcoming: t('tournaments.upcoming'),
    ongoing: t('tournaments.ongoing'),
    completed: t('tournaments.completed'),
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

const STATUS_VALUES = ['', 'upcoming', 'ongoing', 'completed'] as const;



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
  const { t } = useI18n();
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: me } = useApi<MeResponse>(getMe, mockMe, []);
  const isCoach = me?.role === 'coach';

  // Load coach entries to show "joined" indicators on tournament cards
  const { data: coachEntries } = useApi<CoachEntry[]>(
    getCoachEntries,
    isCoach ? mockCoachEntries : [],
    [isCoach],
  );

  // Map tournament_id → count of coach's entries for that tournament
  const coachEntriesByTournament = useMemo(() => {
    const map = new Map<string, number>();
    if (!isCoach || !coachEntries) return map;
    for (const e of coachEntries) {
      map.set(e.tournament_id, (map.get(e.tournament_id) || 0) + 1);
    }
    return map;
  }, [isCoach, coachEntries]);

  const STATUSES = STATUS_VALUES.map((v) => ({
    value: v,
    label: v === '' ? t('tournaments.all')
      : v === 'upcoming' ? t('tournaments.upcoming')
      : v === 'ongoing' ? t('tournaments.ongoing')
      : t('tournaments.completed'),
  }));
  const [showCityPicker, setShowCityPicker] = useState(false);

  const { data: tournaments, loading, refetch } = useApi<TournamentListItem[]>(
    () => getTournaments({ city: city || undefined, status: status || undefined }),
    mockTournaments,
    [city, status],
  );

  const filtered = tournaments || [];

  return (
    <PullToRefresh onRefresh={() => refetch(true)}>
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-3xl font-heading text-text-heading">
          {t('tournaments.title')}
        </h1>
      </div>

      {/* Create tournament button (admin only) */}
      {me?.role === 'admin' && (
        <div className="px-4 pt-1 pb-1">
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text active:opacity-80 hover:opacity-90 transition-all"
          >
            + {t('tournaments.createTournament')}
          </button>
        </div>
      )}

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
          aria-label={t('tournaments.filterByCity')}
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
            <h2 className="text-lg font-semibold text-text">{t('tournaments.selectCity')}</h2>
          </div>
          <div className="px-4 pb-4 space-y-1.5 overflow-y-auto">
            <button
              onClick={() => { setCity(''); setShowCityPicker(false); }}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-none cursor-pointer text-left transition-all active:opacity-80 ${
                !city ? 'bg-accent text-white' : 'bg-bg-secondary text-text'
              }`}
            >
              <span className="text-sm font-medium">{t('tournaments.allCities')}</span>
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
          <EmptyState title={t('tournaments.noTournaments')} description={t('tournaments.noTournamentsDesc')} />
        ) : (
          filtered.map((tr) => {
            const myCount = coachEntriesByTournament.get(tr.id) || 0;
            return (
              <Card
                key={tr.id}
                onClick={() => navigate(`/tournament/${tr.id}`)}
                className={tr.status === 'completed' ? 'opacity-50' : ''}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-base flex-1 mr-2 text-text">
                    {tr.name}
                  </h3>
                  {statusBadge(tr.status, t)}
                </div>
                <p className="text-[13px] text-text-secondary">
                  {tr.city} · {formatDate(tr.start_date)}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <ImportanceDots level={tr.importance_level} />
                  <span className="text-[13px] font-mono text-text-secondary">{tr.entry_count} {t('common.entries')}</span>
                </div>
                {isCoach && myCount > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-dashed border-border">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-[13px] text-accent font-medium">
                      {t('tournaments.yourEntries')} · {myCount} {t('tournamentDetail.athletes')}
                    </span>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Create tournament form */}
      {showCreateForm && (
        <CreateTournamentForm
          onClose={() => setShowCreateForm(false)}
          onSaved={() => {
            setShowCreateForm(false);
            refetch(true);
          }}
        />
      )}
    </div>
    </PullToRefresh>
  );
}

const IMPORTANCE_LEVELS = [1, 2, 3];

function CreateTournamentForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { hapticNotification } = useTelegram();
  const { showToast } = useToast();
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<TournamentCreate>({
    name: '',
    description: null,
    start_date: today,
    end_date: today,
    city: CITIES[0],
    venue: '',
    age_categories: [] as string[],
    weight_categories: [] as string[],
    entry_fee: null,
    currency: 'RUB',
    registration_deadline: today,
    importance_level: 2,
    photos_url: null,
    organizer_name: null,
    organizer_phone: null,
    organizer_telegram: null,
  });
  const [saving, setSaving] = useState(false);

  const canSave = form.name.trim() && form.venue.trim() && form.start_date && form.end_date;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await createTournament(form);
      hapticNotification('success');
      onSaved();
    } catch (err) {
      hapticNotification('error');
      showToast(err instanceof Error ? err.message : t('common.error'), 'error');
      setSaving(false);
    }
  };

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex justify-between items-center p-4 pb-2 shrink-0">
        <h2 className="text-lg font-bold text-text">{t('tournaments.createTournament')}</h2>
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
          {saving ? t('tournaments.creating') : t('tournaments.createTournament')}
        </button>
      </div>
    </BottomSheet>
  );
}
