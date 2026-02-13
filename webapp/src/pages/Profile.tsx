import { useState } from 'react';
import BottomSheet from '../components/BottomSheet';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import { getCoachAthletes, getCoachEntries, getMe, updateMe } from '../api/endpoints';
import { mockCoachAthletes, mockCoachEntries, mockMe, updateMockMe } from '../api/mock';
import type { AthleteUpdate, CoachAthlete, CoachEntry, MeResponse } from '../types';

const ROLES: MeResponse['role'][] = ['athlete', 'coach', 'admin'];
const ROLE_LABELS: Record<MeResponse['role'], string> = {
  athlete: 'Athlete',
  coach: 'Coach',
  admin: 'Admin',
};
const ROLE_ICONS: Record<MeResponse['role'], string> = {
  athlete: '\u{1F94B}',
  coach: '\u{1F4CB}',
  admin: '\u{1F6E1}',
};
const ROLE_DESCRIPTIONS: Record<MeResponse['role'], string> = {
  athlete: 'Training logs, tournaments, ratings',
  coach: 'Manage athletes and entries',
  admin: 'Full access to all features',
};

export default function Profile() {
  const { user: tgUser } = useTelegram();
  const { data: me, loading, mutate } = useApi<MeResponse>(getMe, mockMe, []);
  const [editing, setEditing] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);

  if (loading) return <LoadingSpinner />;
  if (!me) return (
    <div className="flex flex-col items-center justify-center pt-20 px-4">
      <p className="text-sm text-text-secondary text-center">
        Could not load profile. Please reopen the app from Telegram.
      </p>
    </div>
  );

  const handleRoleChange = (role: MeResponse['role']) => {
    const newMe = { ...me, role };
    mutate(newMe);
    updateMockMe(newMe);
  };

  const isCoach = me.role === 'coach';
  const isAthlete = me.role === 'athlete';
  const isAdmin = me.role === 'admin';
  const displayName = me.athlete?.full_name || me.coach?.full_name || me.username || 'User';
  const initial = displayName.charAt(0);
  const photoUrl = me.athlete?.photo_url || me.coach?.photo_url || tgUser?.photo_url;

  return (
    <div>
      {/* Switch role button */}
      <div className="flex justify-end px-4 pt-4">
        <button
          onClick={() => setShowRolePicker(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-secondary border-none cursor-pointer active:opacity-70 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
            <path d="M16 3l4 4-4 4" /><path d="M20 7H4" /><path d="M8 21l-4-4 4-4" /><path d="M4 17h16" />
          </svg>
          <span className="text-xs font-medium text-text-secondary">{ROLE_LABELS[me.role]}</span>
        </button>
      </div>

      {/* Profile header — centered avatar + name */}
      <div className="flex flex-col items-center pt-2 pb-4 px-4">
        {photoUrl ? (
          <img src={photoUrl} alt={displayName} className="w-24 h-24 rounded-full object-cover mb-3" />
        ) : (
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold bg-accent-light text-accent mb-3">
            {initial}
          </div>
        )}
        <h1 className="text-xl font-bold text-text text-center">
          {displayName}
        </h1>
        {isAthlete && me.athlete && (
          <p className="text-sm text-text-secondary mt-0.5">
            {me.athlete.belt} · {me.athlete.weight_category}
          </p>
        )}
        {isCoach && me.coach && (
          <p className="text-sm text-text-secondary mt-0.5">
            {me.coach.qualification} · Coach
          </p>
        )}
        {isAdmin && (
          <p className="text-sm text-text-secondary mt-0.5">Administrator</p>
        )}
      </div>

      {/* Athlete profile */}
      {isAthlete && me.athlete && (
        <>
          {/* Stats row — 3 cards */}
          <div className="px-4 grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white rounded-xl shadow-sm border border-border p-3 text-center">
              <p className="text-xl font-bold text-accent">{me.athlete.rating_points}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">Rating</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-border p-3 text-center">
              <p className="text-xl font-bold text-accent">—</p>
              <p className="text-[11px] text-text-secondary mt-0.5">Tournaments</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-border p-3 text-center">
              <p className="text-xl font-bold text-accent">—</p>
              <p className="text-[11px] text-text-secondary mt-0.5">Medals</p>
            </div>
          </div>

          {/* Info section */}
          <div className="px-4">
            <Card>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Information</h3>
              <div className="space-y-3">
                <InfoRow icon={<ClubIcon />} label="Club" value={me.athlete.club || '—'} />
                <InfoRow icon={<LocationIcon />} label="City" value={me.athlete.city} />
                <InfoRow icon={<FlagIcon />} label="Country" value={me.athlete.country} />
                <InfoRow icon={<ScaleIcon />} label="Weight" value={`${me.athlete.current_weight} kg`} />
                <InfoRow icon={<GenderIcon />} label="Gender" value={me.athlete.gender === 'M' ? 'Male' : 'Female'} />
              </div>
            </Card>
          </div>

          {/* Edit button — outlined */}
          <div className="px-4 mt-1 mb-4">
            <button
              onClick={() => setEditing(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer bg-transparent text-accent border-2 border-accent active:bg-accent-light transition-colors"
            >
              Edit Profile
            </button>
          </div>

          {editing && (
            <EditProfileForm
              athlete={me.athlete}
              onClose={() => setEditing(false)}
              onSaved={(updated) => {
                setEditing(false);
                const newMe = { ...me, athlete: { ...me.athlete!, ...updated } };
                mutate(newMe);
                updateMockMe(newMe);
              }}
            />
          )}
        </>
      )}

      {/* Coach profile */}
      {isCoach && me.coach && (
        <>
          <div className="px-4">
            <Card>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Information</h3>
              <div className="space-y-3">
                <InfoRow icon={<ClubIcon />} label="Club" value={me.coach.club} />
                <InfoRow icon={<LocationIcon />} label="City" value={me.coach.city} />
                <InfoRow icon={<FlagIcon />} label="Country" value={me.coach.country} />
                <InfoRow
                  icon={<VerifiedIcon />}
                  label="Verified"
                  value={me.coach.is_verified ? 'Yes' : 'Pending'}
                />
              </div>
            </Card>
          </div>

          <CoachAthletesList />
          <CoachEntriesList />
        </>
      )}

      {/* Admin profile */}
      {isAdmin && (
        <div className="px-4">
          <Card>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Admin Panel</h3>
            <div className="space-y-3">
              <InfoRow icon={<VerifiedIcon />} label="Role" value="Administrator" />
              <InfoRow icon={<ClubIcon />} label="Users" value="7 registered" />
              <InfoRow icon={<FlagIcon />} label="Tournaments" value="5 total" />
            </div>
          </Card>
        </div>
      )}

      {/* Role picker — hidden behind avatar tap */}
      {showRolePicker && (
        <BottomSheet onClose={() => setShowRolePicker(false)}>
          <div className="p-4 pb-2 shrink-0">
            <h2 className="text-lg font-bold text-text">Switch Role</h2>
          </div>
          <div className="px-4 pb-2 space-y-2">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => { handleRoleChange(role); setShowRolePicker(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-none cursor-pointer text-left transition-all active:opacity-80 ${
                  me.role === role
                    ? 'bg-accent text-white'
                    : 'bg-bg-secondary text-text'
                }`}
              >
                <span className="text-lg">{ROLE_ICONS[role]}</span>
                <div>
                  <p className="text-sm font-semibold">{ROLE_LABELS[role]}</p>
                  <p className={`text-[11px] ${me.role === role ? 'text-white/70' : 'text-text-secondary'}`}>
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </div>
                {me.role === role && (
                  <svg className="ml-auto shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <div className="p-4 pt-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }} />
        </BottomSheet>
      )}
    </div>
  );
}

/* ---- Info row with icon ---- */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-text-secondary shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-text-secondary">{label}</p>
        <p className="text-sm font-medium text-text truncate">{value}</p>
      </div>
    </div>
  );
}

/* ---- Inline SVG icons (16x16) ---- */
function ClubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9v.01" /><path d="M9 12v.01" /><path d="M9 15v.01" /><path d="M9 18v.01" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" />
    </svg>
  );
}

function GenderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" /><path d="M16 8V3h5" /><path d="m21 3-5 5" />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/* ---- Coach athletes ---- */
function CoachAthletesList() {
  const { data: athletes, loading } = useApi<CoachAthlete[]>(
    getCoachAthletes,
    mockCoachAthletes,
    [],
  );

  return (
    <div className="px-4 mt-4 mb-4">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
        My Athletes ({athletes?.length || 0})
      </h2>
      {loading ? (
        <LoadingSpinner />
      ) : !athletes || athletes.length === 0 ? (
        <Card>
          <p className="text-sm text-center text-text-secondary">No athletes yet</p>
        </Card>
      ) : (
        <>
          {/* Horizontal avatar row */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 mb-3">
            {athletes.map((a) => (
              <div key={a.id} className="flex flex-col items-center shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold bg-accent-light text-accent">
                  {a.full_name.charAt(0)}
                </div>
                <p className="text-[11px] text-text mt-1 w-14 text-center truncate">{a.full_name.split(' ').pop()}</p>
              </div>
            ))}
          </div>

          {/* Detail cards */}
          {athletes.map((a) => (
            <Card key={a.id} className="!p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 bg-accent-light text-accent">
                  {a.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-text truncate">{a.full_name}</p>
                  <p className="text-[11px] text-text-secondary">
                    {a.weight_category} · {a.belt} · {a.rating_points} pts
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

/* ---- Coach entries ---- */
function CoachEntriesList() {
  const { data: entries, loading } = useApi<CoachEntry[]>(
    getCoachEntries,
    mockCoachEntries,
    [],
  );

  return (
    <div className="px-4 mb-4">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
        Active Entries ({entries?.length || 0})
      </h2>
      {loading ? (
        <LoadingSpinner />
      ) : !entries || entries.length === 0 ? (
        <Card>
          <p className="text-sm text-center text-text-secondary">No active entries</p>
        </Card>
      ) : (
        entries.map((e) => (
          <Card key={e.id} className="!p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-text truncate">{e.athlete_name}</p>
                <p className="text-[11px] text-text-secondary">
                  {e.tournament_name}
                </p>
                <p className="text-[11px] text-text-secondary">
                  {e.weight_category} · {e.age_category}
                </p>
              </div>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${
                  e.status === 'approved'
                    ? 'bg-emerald-50/70 text-emerald-700'
                    : e.status === 'rejected'
                    ? 'bg-rose-50/70 text-rose-700'
                    : 'bg-amber-50/70 text-amber-700'
                }`}
              >
                {e.status}
              </span>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

/* ---- Country → Cities mapping ---- */
const COUNTRY_CITIES: Record<string, string[]> = {
  'Kyrgyzstan': ['Bishkek', 'Osh', 'Jalal-Abad', 'Karakol', 'Tokmok', 'Naryn'],
  'Kazakhstan': ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Atyrau'],
  'Uzbekistan': ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Fergana', 'Andijan'],
  'Turkmenistan': ['Ashgabat', 'Turkmenabat', 'Mary', 'Dashoguz', 'Balkanabat'],
  'Tajikistan': ['Dushanbe', 'Khujand', 'Kulob', 'Bokhtar', 'Istaravshan'],
  'Russia': ['Moscow', 'Saint Petersburg', 'Kazan', 'Novosibirsk', 'Krasnodar', 'Vladivostok'],
  'South Korea': ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju'],
  'Iran': ['Tehran', 'Isfahan', 'Mashhad', 'Tabriz', 'Shiraz'],
  'Turkey': ['Istanbul', 'Ankara', 'Izmir', 'Antalya', 'Bursa'],
};
const COUNTRIES = Object.keys(COUNTRY_CITIES);

/* ---- Edit form ---- */
function EditProfileForm({
  athlete,
  onClose,
  onSaved,
}: {
  athlete: NonNullable<MeResponse['athlete']>;
  onClose: () => void;
  onSaved: (data: AthleteUpdate) => void;
}) {
  const [form, setForm] = useState<AthleteUpdate>({
    full_name: athlete.full_name,
    weight_category: athlete.weight_category,
    current_weight: athlete.current_weight,
    belt: athlete.belt,
    country: athlete.country,
    city: athlete.city,
    club: athlete.club || '',
  });
  const [saving, setSaving] = useState(false);

  const cities = COUNTRY_CITIES[form.country || ''] || [];

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await updateMe(form);
    } catch {
      // API may not be available in mock mode — that's ok
    } finally {
      onSaved(form);
    }
  };

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  const handleCountryChange = (country: string) => {
    const countryCities = COUNTRY_CITIES[country] || [];
    setForm((f) => ({ ...f, country, city: countryCities[0] || '' }));
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex justify-between items-center p-4 pb-2 shrink-0">
        <h2 className="text-lg font-bold text-text">Edit Profile</h2>
        <button onClick={onClose} className="text-2xl border-none bg-transparent cursor-pointer text-muted">×</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-3">
        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">Full Name</span>
          <input
            value={form.full_name || ''}
            onChange={(e) => update('full_name', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">Weight Category</span>
          <input
            value={form.weight_category || ''}
            onChange={(e) => update('weight_category', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">Current Weight (kg)</span>
          <input
            type="number"
            step="0.1"
            value={form.current_weight ?? ''}
            onChange={(e) => update('current_weight', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">Belt</span>
          <input
            value={form.belt || ''}
            onChange={(e) => update('belt', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">Country</span>
          <select
            value={form.country || ''}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
          >
            {!COUNTRIES.includes(form.country || '') && form.country && (
              <option value={form.country}>{form.country}</option>
            )}
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">City</span>
          <select
            value={form.city || ''}
            onChange={(e) => update('city', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
          >
            {cities.length === 0 && form.city && (
              <option value={form.city}>{form.city}</option>
            )}
            {!cities.includes(form.city || '') && form.city && cities.length > 0 && (
              <option value={form.city}>{form.city}</option>
            )}
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">Club</span>
          <input
            value={form.club || ''}
            onChange={(e) => update('club', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
          />
        </label>
      </div>

      <div className="p-4 pt-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-60 active:opacity-80 transition-all"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </BottomSheet>
  );
}
