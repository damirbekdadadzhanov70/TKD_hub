import { useRef, useState } from 'react';
import BottomSheet from '../components/BottomSheet';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getMe, getRatings } from '../api/endpoints';
import { mockMe, mockRatings } from '../api/mock';
import type { MeResponse, RatingEntry } from '../types';

const PODIUM_COLORS = [
  'var(--color-medal-gold)',
  'var(--color-medal-silver)',
  'var(--color-medal-bronze)',
];
const PODIUM_ORDER = [1, 0, 2]; // 2nd, 1st, 3rd

const CITY_OPTIONS = ['Москва', 'Санкт-Петербург', 'Казань', 'Нижний Новгород', 'Дагестан', 'Рязань'];
const WEIGHT_OPTIONS = ['-54kg', '-58kg', '-63kg', '-68kg', '-74kg', '-80kg', '-87kg', '+87kg'];
const GENDER_OPTIONS = [
  { value: 'M', label: 'Мужской' },
  { value: 'F', label: 'Женский' },
];

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
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
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
              <span className="text-sm font-medium">All</span>
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
  if (top3.length < 3) return null;

  const heights = ['h-28', 'h-22', 'h-18'];
  const avatarSizes = ['w-[60px] h-[60px] text-lg', 'w-12 h-12 text-sm', 'w-12 h-12 text-sm'];
  const rankSizes = ['text-4xl', 'text-3xl', 'text-3xl'];

  return (
    <div className="flex items-end justify-center gap-3 px-6 pt-6 pb-4">
      {PODIUM_ORDER.map((idx) => {
        const athlete = top3[idx];
        const rank = idx + 1;
        return (
          <div
            key={athlete.athlete_id}
            className="flex flex-col items-center flex-1 cursor-pointer"
            onClick={() => onSelect(athlete)}
          >
            {/* Avatar with rank */}
            <div className="relative mb-1.5 podium-text" style={{ animationDelay: `${idx * 100 + 250}ms` }}>
              <div
                className={`${avatarSizes[idx]} rounded-full flex items-center justify-center font-medium`}
                style={{
                  backgroundColor: PODIUM_COLORS[idx] + '20',
                  color: PODIUM_COLORS[idx],
                  border: `2px solid ${PODIUM_COLORS[idx]}`,
                }}
              >
                {athlete.full_name.charAt(0)}
              </div>
              <span
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-medium text-white"
                style={{ backgroundColor: PODIUM_COLORS[idx] }}
              >
                {rank}
              </span>
            </div>
            <p className="text-xs font-medium text-center truncate w-full text-text podium-text" style={{ animationDelay: `${idx * 100 + 300}ms` }}>
              {athlete.full_name.split(' ').pop()}
            </p>
            <p className="font-mono text-sm text-text-heading mt-0.5 podium-text" style={{ animationDelay: `${idx * 100 + 350}ms` }}>
              {athlete.rating_points}
            </p>
            <p className="text-[11px] text-text-secondary truncate w-full text-center podium-text" style={{ animationDelay: `${idx * 100 + 350}ms` }}>
              {athlete.city}
            </p>
            {/* Podium block */}
            <div
              className={`w-full ${heights[idx]} rounded-t-xl flex items-start justify-center pt-2 mt-1.5 podium-bar`}
              style={{
                backgroundColor: PODIUM_COLORS[idx] + '20',
                animationDelay: `${idx * 100}ms`,
              }}
            >
              <span
                className={`${rankSizes[idx]} font-mono font-medium leading-none`}
                style={{ color: PODIUM_COLORS[idx] }}
              >
                {rank}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Athlete Profile BottomSheet ---- */

function AthleteProfile({ athlete, onClose }: { athlete: RatingEntry; onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose}>
      <div className="p-4 pt-5">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-heading text-text-heading">Athlete Profile</h2>
        </div>

        <div className="flex flex-col items-center mb-5">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-medium mb-3"
            style={{
              backgroundColor: 'var(--color-medal-gold)20',
              color: 'var(--color-medal-gold)',
              border: '2px solid var(--color-medal-gold)',
            }}
          >
            {athlete.full_name.charAt(0)}
          </div>
          <h3 className="text-xl font-heading text-text-heading">{athlete.full_name}</h3>
          <p className="text-sm text-text-secondary mt-0.5">
            {athlete.belt} · {athlete.weight_category}
          </p>
          <p className="text-xs text-text-disabled mt-0.5">
            {athlete.city}, {athlete.country}
          </p>
          {athlete.club && (
            <p className="text-xs text-text-disabled">{athlete.club}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-bg-secondary rounded-xl py-3">
            <p className="text-xl font-mono text-text-heading">#{athlete.rank}</p>
            <p className="text-[11px] uppercase tracking-wider text-text-disabled mt-0.5">Rank</p>
          </div>
          <div className="bg-bg-secondary rounded-xl py-3">
            <p className="text-xl font-mono text-text-heading">{athlete.rating_points}</p>
            <p className="text-[11px] uppercase tracking-wider text-text-disabled mt-0.5">Points</p>
          </div>
          <div className="bg-bg-secondary rounded-xl py-3">
            <p className="text-xl font-mono text-text-heading">{athlete.belt.split(' ')[0]}</p>
            <p className="text-[11px] uppercase tracking-wider text-text-disabled mt-0.5">Dan</p>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

/* ---- Main ---- */

export default function Rating() {
  const [city, setCity] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState<RatingEntry | null>(null);

  const { data: me } = useApi<MeResponse>(getMe, mockMe, []);
  const { data: ratings, loading } = useApi<RatingEntry[]>(
    () => getRatings({
      country: city || undefined,
      weight_category: weight || undefined,
      gender: gender || undefined,
    }),
    mockRatings,
    [city, weight, gender],
  );

  const entries = ratings || [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const myAthleteId = me?.athlete?.id;
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
    <div className="relative pb-16">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-3xl font-heading text-text-heading">
          Rating
        </h1>
      </div>

      {/* Dropdown filters */}
      <div className="flex items-center gap-2 px-4 py-2">
        <DropdownFilter
          label="City"
          value={city}
          options={CITY_OPTIONS.map((c) => ({ value: c, label: c }))}
          onChange={setCity}
        />
        <DropdownFilter
          label="Weight"
          value={weight}
          options={WEIGHT_OPTIONS.map((w) => ({ value: w, label: w }))}
          onChange={setWeight}
        />
        <DropdownFilter
          label="Gender"
          value={gender}
          options={GENDER_OPTIONS}
          onChange={setGender}
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : entries.length === 0 ? (
        <EmptyState title="No ratings" description="No athletes match your filters" />
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
                  className="flex items-center gap-3 py-3 border-b border-border cursor-pointer transition-colors active:opacity-80"
                >
                  {/* Avatar with rank badge */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium bg-accent-light text-accent">
                      {entry.full_name.charAt(0)}
                    </div>
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
            Your rank: #{myEntry.rank}
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
  );
}
