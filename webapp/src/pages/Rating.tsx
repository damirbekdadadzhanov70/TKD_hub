import { useMemo, useRef, useState } from 'react';
import BottomSheet from '../components/BottomSheet';
import PullToRefresh from '../components/PullToRefresh';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n/I18nProvider';
import { getMe, getRatings } from '../api/endpoints';
import { mockMe, mockRatings } from '../api/mock';
import { CITIES } from '../constants/cities';
import type { MeResponse, RatingEntry } from '../types';

const PODIUM_COLORS = [
  'var(--color-medal-gold)',
  'var(--color-medal-silver)',
  'var(--color-medal-bronze)',
];
const PODIUM_ORDER = [1, 0, 2]; // 2nd, 1st, 3rd


const WEIGHT_M = ['54kg', '58kg', '63kg', '68kg', '74kg', '80kg', '87kg', '+87kg'];
const WEIGHT_F = ['46kg', '49kg', '53kg', '57kg', '62kg', '67kg', '73kg', '+73kg'];

/* ---- Chevron icon ---- */

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ---- Dropdown Filter ---- */

function DropdownFilter({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  allLabel: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const displayLabel = value ? options.find((o) => o.value === value)?.label || value : label;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer transition-colors ${
          value
            ? 'bg-accent text-white border-accent'
            : 'bg-bg-secondary text-text-secondary border-border'
        }`}
      >
        <span className="truncate max-w-[80px]">{displayLabel}</span>
        <ChevronDown />
      </button>
      {open && (
        <BottomSheet onClose={() => setOpen(false)}>
          <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-text">{label}</h2>
          </div>
          <div className="px-4 pb-4 space-y-1.5 overflow-y-auto">
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-none cursor-pointer text-left transition-all active:opacity-80 ${
                !value ? 'bg-accent text-white' : 'bg-bg-secondary text-text'
              }`}
            >
              <span className="text-sm font-medium">{allLabel}</span>
              {!value && <CheckIcon />}
            </button>
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border-none cursor-pointer text-left transition-all active:opacity-80 ${
                  value === o.value ? 'bg-accent text-white' : 'bg-bg-secondary text-text'
                }`}
              >
                <span className="text-sm font-medium">{o.label}</span>
                {value === o.value && <CheckIcon />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}

/* ---- Podium ---- */

function Podium({ top3, onSelect }: { top3: RatingEntry[]; onSelect: (e: RatingEntry) => void }) {
  if (top3.length === 0) return null;

  const minHeights = ['min-h-[280px]', 'min-h-[240px]', 'min-h-[220px]'];
  const avatarSizes = ['w-14 h-14 text-lg', 'w-11 h-11 text-sm', 'w-11 h-11 text-sm'];
  const rankSizes = ['text-2xl', 'text-xl', 'text-xl'];
  const topMargins = ['mt-0', 'mt-10', 'mt-16'];

  // Display order: 2nd, 1st, 3rd — skip missing positions
  const slots = PODIUM_ORDER.filter((idx) => idx < top3.length);

  return (
    <div className="flex items-end justify-center gap-2.5 px-4 pt-6 pb-4">
      {slots.map((idx) => {
        const athlete = top3[idx];
        const rank = idx + 1;
        return (
          <div
            key={athlete.athlete_id}
            className={`flex-1 ${topMargins[idx]} relative cursor-pointer active:opacity-80 transition-opacity podium-bar`}
            style={{ animationDelay: `${idx * 100}ms` }}
            onClick={() => onSelect(athlete)}
          >
            {/* Background */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ backgroundColor: PODIUM_COLORS[idx], opacity: 0.1 }}
            />
            {/* Content */}
            <div className={`relative flex flex-col items-center justify-between ${minHeights[idx]} py-5 px-1`}>
              {/* Top group: rank + avatar + name */}
              <div className="flex flex-col items-center">
                <span className={`${rankSizes[idx]} font-mono font-black mb-3 podium-text`} style={{ color: PODIUM_COLORS[idx], animationDelay: `${idx * 100 + 200}ms` }}>
                  {rank}
                </span>
                <div className="podium-text mb-2" style={{ animationDelay: `${idx * 100 + 250}ms` }}>
                  {athlete.photo_url ? (
                    <img
                      src={athlete.photo_url}
                      alt={athlete.full_name}
                      className={`${avatarSizes[idx]} rounded-full object-cover`}
                      style={{ border: `2px solid ${PODIUM_COLORS[idx]}` }}
                    />
                  ) : (
                    <div
                      className={`${avatarSizes[idx]} rounded-full flex items-center justify-center font-medium`}
                      style={{
                        backgroundColor: PODIUM_COLORS[idx],
                        opacity: 0.15,
                        color: PODIUM_COLORS[idx],
                        border: `2px solid ${PODIUM_COLORS[idx]}`,
                      }}
                    >
                      {athlete.full_name.charAt(0)}
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-center truncate w-full text-text podium-text" style={{ animationDelay: `${idx * 100 + 300}ms` }}>
                  {athlete.full_name.split(' ').pop()}
                </p>
              </div>
              {/* Bottom group: rating + city */}
              <div className="flex flex-col items-center">
                <p className="font-mono text-base font-bold text-text-heading podium-text" style={{ animationDelay: `${idx * 100 + 330}ms` }}>
                  {athlete.rating_points}
                </p>
                <p className="text-[10px] text-text-secondary truncate w-full text-center mt-1 podium-text" style={{ animationDelay: `${idx * 100 + 360}ms` }}>
                  {athlete.city}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Athlete Profile BottomSheet ---- */

function AthleteProfile({ athlete, onClose }: { athlete: RatingEntry; onClose: () => void }) {
  const { t } = useI18n();
  const medalColor = athlete.rank <= 3 ? PODIUM_COLORS[athlete.rank - 1] : null;

  return (
    <BottomSheet onClose={onClose}>
      <div className="p-4 pt-5">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-heading text-text-heading">{t('rating.athleteProfile')}</h2>
        </div>

        {/* Avatar + name — matches Profile page style */}
        <div className="flex flex-col items-center pb-4">
          {athlete.photo_url ? (
            <img
              src={athlete.photo_url}
              alt={athlete.full_name}
              className="w-24 h-24 rounded-full object-cover mb-3"
              style={{ border: medalColor ? `2px solid ${medalColor}` : '1px solid var(--color-accent)' }}
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-medium mb-3"
              style={medalColor ? {
                backgroundColor: medalColor + '20',
                color: medalColor,
                border: `2px solid ${medalColor}`,
              } : {
                backgroundColor: 'var(--color-accent-light)',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
              }}
            >
              {athlete.full_name.charAt(0)}
            </div>
          )}
          <h3 className="text-[22px] font-heading text-text-heading">{athlete.full_name}</h3>
          <p className="text-sm text-text-secondary mt-0.5">
            {athlete.sport_rank} · {athlete.weight_category}
          </p>
        </div>

        {/* Stats — 3 columns with vertical dividers, same as Profile */}
        <div className="flex items-center justify-center mb-5 py-3 border-y border-border">
          <div className="flex-1 text-center">
            <p className="font-mono text-2xl text-text-heading">{athlete.rating_points}</p>
            <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">{t('rating.ratingLabel')}</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="flex-1 text-center">
            <p className="font-mono text-2xl text-text-heading">#{athlete.rank}</p>
            <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">{t('rating.rank')}</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="flex-1 text-center">
            <p className="font-mono text-2xl text-text-heading">{athlete.sport_rank}</p>
            <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">{t('rating.sportRank')}</p>
          </div>
        </div>

        {/* Information — InfoRow style like Profile */}
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">{t('rating.information')}</p>
          <div className="flex justify-between items-center py-2">
            <span className="text-[11px] text-text-disabled">{t('rating.cityLabel')}</span>
            <span className="text-[15px] text-text">{athlete.city}</span>
          </div>
          {athlete.club && (
            <div className="flex justify-between items-center py-2">
              <span className="text-[11px] text-text-disabled">{t('rating.clubLabel')}</span>
              <span className="text-[15px] text-text">{athlete.club}</span>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

/* ---- Main ---- */

export default function Rating() {
  const { t } = useI18n();
  const [city, setCity] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState<RatingEntry | null>(null);

  const GENDER_OPTIONS = [
    { value: 'M', label: t('rating.genderMale') },
    { value: 'F', label: t('rating.genderFemale') },
  ];

  const weightOptions = gender === 'F' ? WEIGHT_F : WEIGHT_M;

  const { data: me } = useApi<MeResponse>(getMe, mockMe, []);
  const { data: ratings, loading, refetch } = useApi<RatingEntry[]>(
    () => getRatings({
      country: city || undefined,
      weight_category: weight || undefined,
      gender: gender || undefined,
    }),
    mockRatings,
    [city, weight, gender],
  );

  const myAthleteId = me?.athlete?.id;

  // Sync user's rating entry with current profile data + client-side filtering
  const entries = useMemo(() => {
    let raw = ratings || [];
    // Client-side filtering for demo mode
    if (city) raw = raw.filter((e) => e.city === city);
    if (weight) raw = raw.filter((e) => e.weight_category === weight);
    if (gender) raw = raw.filter((e) => e.gender === gender);
    // Sync current user's data
    if (myAthleteId && me?.athlete) {
      const a = me.athlete;
      raw = raw.map((e) =>
        e.athlete_id === myAthleteId
          ? { ...e, full_name: a.full_name, city: a.city, club: a.club, weight_category: a.weight_category, sport_rank: a.sport_rank, rating_points: a.rating_points }
          : e,
      );
    }
    // Sort by points descending and re-rank
    return raw
      .sort((a, b) => b.rating_points - a.rating_points)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [ratings, myAthleteId, me, city, weight, gender]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const myEntry = myAthleteId ? entries.find((e) => e.athlete_id === myAthleteId) : null;
  const myRowRef = useRef<HTMLDivElement>(null);

  const scrollToMyRank = () => {
    if (myRowRef.current) {
      myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      myRowRef.current.classList.add('bg-accent-light');
      setTimeout(() => myRowRef.current?.classList.remove('bg-accent-light'), 1500);
    }
  };

  return (
    <PullToRefresh onRefresh={() => refetch(true)}>
    <div className="relative pb-16">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-3xl font-heading text-text-heading">
          {t('rating.title')}
        </h1>
      </div>

      {/* Dropdown filters */}
      <div className="flex items-center gap-2 px-4 py-2">
        <DropdownFilter
          label={t('rating.city')}
          value={city}
          options={CITIES.map((c) => ({ value: c, label: c }))}
          allLabel={t('common.all')}
          onChange={setCity}
        />
        <DropdownFilter
          label={t('rating.weight')}
          value={weight}
          options={weightOptions.map((w) => ({ value: w, label: w }))}
          allLabel={t('common.all')}
          onChange={setWeight}
        />
        <DropdownFilter
          label={t('rating.gender')}
          value={gender}
          options={GENDER_OPTIONS}
          allLabel={t('common.all')}
          onChange={(v) => {
            setGender(v);
            setWeight('');
          }}
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : entries.length === 0 ? (
        <EmptyState title={t('rating.noRatings')} description={t('rating.noRatingsDesc')} />
      ) : (
        <>
          <Podium top3={top3} onSelect={setSelectedAthlete} />

          {/* List below podium */}
          <div className="px-4">
            {rest.map((entry) => {
              const isMe = entry.athlete_id === myAthleteId;
              return (
                <div
                  key={entry.athlete_id}
                  ref={isMe ? myRowRef : undefined}
                  onClick={() => setSelectedAthlete(entry)}
                  className="flex items-center gap-3 py-3 border-b border-border cursor-pointer transition-colors hover:bg-bg-secondary active:opacity-80"
                >
                  {/* Avatar with rank badge */}
                  <div className="relative shrink-0">
                    {entry.photo_url ? (
                      <img
                        src={entry.photo_url}
                        alt={entry.full_name}
                        className="w-10 h-10 rounded-full object-cover"
                        style={{ border: '1px solid var(--color-accent)' }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium bg-accent-light text-accent">
                        {entry.full_name.charAt(0)}
                      </div>
                    )}
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-medium bg-bg-divider text-text-secondary">
                      {entry.rank}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate text-text">
                      {entry.full_name}
                    </p>
                    <p className="text-[13px] text-text-secondary">
                      {entry.city} · {entry.weight_category}
                    </p>
                  </div>
                  <span className="font-mono text-base text-text-heading shrink-0">
                    {entry.rating_points}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Your rank badge */}
      {myEntry && (
        <button
          onClick={scrollToMyRank}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-accent-light border-none cursor-pointer z-40 active:opacity-80 transition-all shadow-sm"
        >
          <span className="font-mono text-[13px] font-medium text-accent">
            {t('rating.yourRank')}: #{myEntry.rank}
          </span>
        </button>
      )}

      {/* Athlete profile */}
      {selectedAthlete && (
        <AthleteProfile
          athlete={selectedAthlete}
          onClose={() => setSelectedAthlete(null)}
        />
      )}
    </div>
    </PullToRefresh>
  );
}
