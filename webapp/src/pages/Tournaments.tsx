import { useEffect, useMemo, useRef, useState } from 'react';
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



function LocationIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function FilterDropdown<T extends string>({
  icon,
  value,
  options,
  onSelect,
  ariaLabel,
}: {
  icon: React.ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const isActive = value !== '';

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm border cursor-pointer transition-colors ${
          isActive
            ? 'bg-accent/10 text-accent border-accent/30'
            : 'bg-bg-secondary text-text-secondary border-border hover:border-accent/40'
        }`}
      >
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 text-left truncate font-medium text-[13px]">{selected?.label}</span>
        <span className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-bg shadow-lg z-50 overflow-y-auto max-h-64">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onSelect(o.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm border-none cursor-pointer text-left transition-colors ${
                value === o.value
                  ? 'bg-accent text-white'
                  : 'bg-transparent text-text hover:bg-bg-secondary'
              }`}
            >
              <span className="font-medium">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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

  const CITY_OPTIONS = [
    { value: '' as string, label: t('tournaments.allCities') },
    ...CITIES.map((c) => ({ value: c, label: c })),
  ];

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

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2">
        <FilterDropdown
          icon={<CalendarIcon />}
          value={status}
          options={STATUSES}
          onSelect={setStatus}
          ariaLabel={t('tournaments.all')}
        />
        <FilterDropdown
          icon={<LocationIcon />}
          value={city}
          options={CITY_OPTIONS}
          onSelect={setCity}
          ariaLabel={t('tournaments.filterByCity')}
        />
      </div>

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
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(tr.status, t)}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-disabled">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-disabled shrink-0">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {tr.city}
                  <span className="text-text-disabled mx-0.5">·</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-disabled shrink-0">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {formatDate(tr.start_date)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <ImportanceDots level={tr.importance_level} />
                  <span className="text-[11px] uppercase tracking-[1px] text-text-disabled">
                    {tr.importance_level === 1 ? t('tournaments.importanceLow') : tr.importance_level === 2 ? t('tournaments.importanceMedium') : t('tournaments.importanceHigh')}
                  </span>
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
    results_url: null,
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
