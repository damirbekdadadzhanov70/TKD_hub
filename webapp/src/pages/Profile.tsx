import { useState } from 'react';
import BottomSheet from '../components/BottomSheet';
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
const ROLE_DESCRIPTIONS: Record<MeResponse['role'], string> = {
  athlete: 'Training logs, tournaments, ratings',
  coach: 'Manage athletes and entries',
  admin: 'Full access to all features',
};

const WEIGHT_CATEGORIES = ['-54kg', '-58kg', '-63kg', '-68kg', '-74kg', '-80kg', '-87kg', '+87kg'];
const BELTS = ['1 Gup', '1 Dan', '2 Dan', '3 Dan', '4 Dan', '5 Dan'];
const CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Московская область', 'Нижний Новгород', 'Рязань', 'Дагестан', 'Новосибирск', 'Краснодар', 'Владивосток'];

/* ---- Icons ---- */

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* ---- Main ---- */

export default function Profile() {
  const { user: tgUser } = useTelegram();
  const { data: me, loading, mutate } = useApi<MeResponse>(getMe, mockMe, []);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
    <div className="pb-20">
      {/* Settings gear — top right */}
      <div className="flex justify-end px-4 pt-4">
        <button
          onClick={() => setShowSettings(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-text-disabled active:opacity-70 transition-opacity"
        >
          <GearIcon />
        </button>
      </div>

      {/* Avatar + name */}
      <div className="flex flex-col items-center pb-4 px-4">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={displayName}
            className="w-24 h-24 rounded-full object-cover mb-3"
            style={{ border: '1px solid var(--color-accent)' }}
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-medium bg-accent-light text-accent mb-3"
            style={{ border: '1px solid var(--color-accent)' }}
          >
            {initial}
          </div>
        )}
        <h1 className="text-[22px] font-heading text-text-heading text-center">
          {displayName}
        </h1>
        {isAthlete && me.athlete && (
          <p className="text-sm text-text-secondary mt-0.5">
            {me.athlete.belt} · {me.athlete.weight_category}
          </p>
        )}
        {isCoach && me.coach && (
          <p className="text-sm text-text-secondary mt-0.5">
            {me.coach.qualification}
          </p>
        )}
        {isAdmin && (
          <p className="text-sm text-text-secondary mt-0.5">Administrator</p>
        )}
      </div>

      {/* Athlete profile */}
      {isAthlete && me.athlete && (
        <AthleteSection
          me={me}
          mutate={mutate}
          editing={editing}
          setEditing={setEditing}
        />
      )}

      {/* Coach profile */}
      {isCoach && me.coach && (
        <CoachSection me={me} />
      )}

      {/* Admin profile */}
      {isAdmin && (
        <div className="px-4">
          <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">Information</p>
          <InfoRow label="Role" value="Administrator" />
          <InfoRow label="Users" value="7 registered" />
          <InfoRow label="Tournaments" value="5 total" />
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <SettingsSheet
          me={me}
          onClose={() => setShowSettings(false)}
          onRoleChange={handleRoleChange}
        />
      )}
    </div>
  );
}

/* ---- Athlete Section ---- */

function AthleteSection({
  me,
  mutate,
  editing,
  setEditing,
}: {
  me: MeResponse;
  mutate: (d: MeResponse) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
}) {
  const athlete = me.athlete!;
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      {/* Stats — 3 columns with vertical dividers */}
      <div className="flex items-center justify-center mx-4 mb-5 py-3 border-y border-border">
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl text-text-heading">{athlete.rating_points}</p>
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">Rating</p>
        </div>
        <div className="w-px h-10 bg-border" />
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl text-text-heading">—</p>
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">Tourneys</p>
        </div>
        <div className="w-px h-10 bg-border" />
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl text-text-heading">—</p>
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">Medals</p>
        </div>
      </div>

      {/* Information */}
      <div className="px-4 mb-4">
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">Information</p>
        <InfoRow label="Club" value={athlete.club || '—'} />
        <InfoRow label="City" value={athlete.city} />
        <InfoRow label="Country" value={athlete.country} />
        <InfoRow label="Weight" value={`${athlete.current_weight} kg`} />
        <InfoRow label="Gender" value={athlete.gender === 'M' ? 'Male' : 'Female'} />
      </div>

      {/* Tournament History — collapsible */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="flex items-center gap-1.5 border-none bg-transparent cursor-pointer p-0 mb-2"
        >
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled">Tournament History</span>
          <ChevronIcon open={historyOpen} />
        </button>
        {historyOpen && (
          <div>
            <TournamentHistoryRow place={3} name="Первенство Нижнего Новгорода" date="Jan 2026" />
            <TournamentHistoryRow place={1} name="Турнир Дагестана" date="Dec 2025" />
          </div>
        )}
      </div>

      {/* Edit button — outlined */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setEditing(true)}
          className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer bg-transparent text-accent border border-accent active:bg-accent-light transition-colors"
        >
          Edit Profile
        </button>
      </div>

      {editing && (
        <EditProfileForm
          athlete={athlete}
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
  );
}

/* ---- Coach Section ---- */

function CoachSection({ me }: { me: MeResponse }) {
  const coach = me.coach!;
  const { data: athletes, loading: loadingAthletes } = useApi<CoachAthlete[]>(
    getCoachAthletes,
    mockCoachAthletes,
    [],
  );
  const { data: entries, loading: loadingEntries } = useApi<CoachEntry[]>(
    getCoachEntries,
    mockCoachEntries,
    [],
  );

  return (
    <>
      {/* Stats — 2 columns */}
      <div className="flex items-center justify-center mx-4 mb-5 py-3 border-y border-border">
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl text-text-heading">{athletes?.length || 0}</p>
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">Athletes</p>
        </div>
        <div className="w-px h-10 bg-border" />
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl text-text-heading">{entries?.length || 0}</p>
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">Active Entries</p>
        </div>
      </div>

      {/* Information */}
      <div className="px-4 mb-4">
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">Information</p>
        <InfoRow label="Club" value={coach.club} />
        <InfoRow label="City" value={coach.city} />
        <InfoRow label="Country" value={coach.country} />
        <InfoRow label="Qualification" value={coach.qualification} />
        <InfoRow label="Verified" value={coach.is_verified ? 'Yes' : 'Pending'} accent={coach.is_verified} />
      </div>

      {/* Athletes list */}
      <div className="px-4 mb-4">
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">Athletes</p>
        {loadingAthletes ? (
          <LoadingSpinner />
        ) : !athletes || athletes.length === 0 ? (
          <p className="text-sm text-text-secondary">No athletes yet</p>
        ) : (
          athletes.map((a, i) => (
            <div
              key={a.id}
              className={`flex items-center gap-3 py-3 ${i < athletes.length - 1 ? 'border-b border-dashed border-border' : ''}`}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0 bg-accent-light text-accent">
                {a.full_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-text truncate">{a.full_name}</p>
                <p className="text-[13px] text-text-secondary">
                  {a.weight_category} · {a.belt} · <span className="text-accent">{a.rating_points} pts</span>
                </p>
              </div>
            </div>
          ))
        )}
        <button className="text-sm text-accent border-none bg-transparent cursor-pointer p-0 mt-2 active:opacity-70">
          + Add athlete
        </button>
      </div>

      {/* Active entries */}
      <div className="px-4 mb-4">
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">Active Entries</p>
        {loadingEntries ? (
          <LoadingSpinner />
        ) : !entries || entries.length === 0 ? (
          <p className="text-sm text-text-secondary">No active entries</p>
        ) : (
          entries.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-center justify-between py-3 ${i < entries.length - 1 ? 'border-b border-dashed border-border' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-text truncate">{e.tournament_name}</p>
                <p className="text-[13px] text-text-secondary">
                  {e.athlete_name} · {e.weight_category} · {e.status}
                </p>
              </div>
              <span className="text-[13px] text-accent shrink-0 ml-2 cursor-pointer">Edit →</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ---- Info Row ---- */

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-[11px] text-text-disabled">{label}</span>
      <span className={`text-[15px] ${accent ? 'text-accent' : 'text-text'}`}>{value}</span>
    </div>
  );
}

/* ---- Tournament History Row ---- */

const MEDAL_COLORS: Record<number, string> = {
  1: 'text-medal-gold',
  2: 'text-medal-silver',
  3: 'text-medal-bronze',
};

function TournamentHistoryRow({ place, name, date }: { place: number; name: string; date: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-dashed border-border">
      <span className={`font-mono text-base font-medium w-6 text-center ${MEDAL_COLORS[place] || 'text-text-disabled'}`}>
        {place}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text truncate">{name}</p>
        <p className="text-[11px] text-text-secondary">{date}</p>
      </div>
    </div>
  );
}

/* ---- Settings Sheet ---- */

function SettingsSheet({
  me,
  onClose,
  onRoleChange,
}: {
  me: MeResponse;
  onClose: () => void;
  onRoleChange: (role: MeResponse['role']) => void;
}) {
  const [lang, setLang] = useState(me.language || 'ru');

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-heading text-text-heading">Settings</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {/* Role */}
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 mt-3">Role</p>
        <div className="space-y-1.5 mb-4">
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() => onRoleChange(role)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-none cursor-pointer text-left transition-all active:opacity-80 ${
                me.role === role ? 'bg-accent text-white' : 'bg-bg-secondary text-text'
              }`}
            >
              <div>
                <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                <p className={`text-[11px] ${me.role === role ? 'text-white/70' : 'text-text-secondary'}`}>
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
              {me.role === role && <CheckIcon />}
            </button>
          ))}
        </div>

        {/* Language */}
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2">Language</p>
        <div className="space-y-1 mb-4">
          {[{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }].map((l) => (
            <button
              key={l.value}
              onClick={() => setLang(l.value)}
              className="w-full flex items-center gap-3 py-2.5 border-none bg-transparent cursor-pointer text-left"
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                lang === l.value ? 'border-accent' : 'border-text-disabled'
              }`}>
                {lang === l.value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
              </div>
              <span className="text-sm text-text">{l.label}</span>
            </button>
          ))}
        </div>

        {/* Account links */}
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2">Account</p>
        <div className="mb-4">
          {['Request coach role', 'Export data', 'About', 'Support'].map((item) => (
            <div key={item} className="flex items-center justify-between py-2.5 border-b border-border">
              <span className="text-sm text-text">{item}</span>
              <span className="text-text-disabled text-sm">→</span>
            </div>
          ))}
        </div>

        <button className="w-full text-center text-sm text-text-disabled border-none bg-transparent cursor-pointer py-2">
          Delete account
        </button>

        <p className="text-center font-mono text-[11px] text-text-disabled mt-4">v0.1.0</p>
      </div>
    </BottomSheet>
  );
}

/* ---- Edit Profile Form ---- */

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
  const { hapticNotification } = useTelegram();
  const [saving, setSaving] = useState(false);

  const hasChanges =
    form.full_name !== athlete.full_name ||
    form.weight_category !== athlete.weight_category ||
    form.current_weight !== athlete.current_weight ||
    form.belt !== athlete.belt ||
    form.city !== athlete.city ||
    form.club !== (athlete.club || '');

  const handleSubmit = async () => {
    setSaving(true);
    try { await updateMe(form); } catch { }
    finally { hapticNotification('success'); onSaved(form); }
  };

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-heading text-text-heading">Edit Profile</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-4">
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">Full Name</span>
          <input
            value={form.full_name || ''}
            onChange={(e) => update('full_name', e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">Weight Category</span>
          <div className="flex flex-wrap gap-1.5">
            {WEIGHT_CATEGORIES.map((w) => (
              <button
                key={w}
                onClick={() => update('weight_category', w)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                  form.weight_category === w
                    ? 'bg-accent text-white border-accent'
                    : 'bg-transparent text-text-disabled border-text-disabled'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">Current Weight (kg)</span>
          <input
            type="number"
            step="0.1"
            value={form.current_weight ?? ''}
            onChange={(e) => update('current_weight', parseFloat(e.target.value) || 0)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">Belt</span>
          <select
            value={form.belt || ''}
            onChange={(e) => update('belt', e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors appearance-none"
          >
            {!BELTS.includes(form.belt || '') && form.belt && (
              <option value={form.belt}>{form.belt}</option>
            )}
            {BELTS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">City</span>
          <select
            value={form.city || ''}
            onChange={(e) => update('city', e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors appearance-none"
          >
            {!CITIES.includes(form.city || '') && form.city && (
              <option value={form.city}>{form.city}</option>
            )}
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">Club</span>
          <input
            value={form.club || ''}
            onChange={(e) => update('club', e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div className="p-4 pt-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !hasChanges}
          className="w-full py-3.5 rounded-lg text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-40 active:opacity-80 transition-all"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </BottomSheet>
  );
}
