import { useEffect, useState } from 'react';
import { registerProfile } from '../api/endpoints';
import { registerMockProfile } from '../api/mock';
import { useTelegram } from '../hooks/useTelegram';
import { useI18n } from '../i18n/I18nProvider';
import type { AthleteRegistration, CoachRegistration, MeResponse } from '../types';

const RANKS = ['Без разряда', '3 разряд', '2 разряд', '1 разряд', 'КМС', 'МС', 'МСМК', 'ЗМС'];
const WEIGHT_M = ['54kg', '58kg', '63kg', '68kg', '74kg', '80kg', '87kg', '+87kg'];
const WEIGHT_F = ['46kg', '49kg', '53kg', '57kg', '62kg', '67kg', '73kg', '+73kg'];
const CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Нижний Новгород', 'Рязань', 'Махачкала', 'Новосибирск', 'Краснодар', 'Владивосток'];
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

type SelectedRole = 'athlete' | 'coach';
type Step = 'role' | 'form';

const API_URL = import.meta.env.VITE_API_URL;
const hasApi = !!API_URL;

/* ---- Helpers ---- */

function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

/* ---- Icons ---- */

function AthleteIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CoachIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="m21 5-3 3-1.5-1.5" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
    </svg>
  );
}

/* ---- Progress Bar ---- */

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex gap-2 mb-8">
      <div className="flex-1 h-1 rounded-full bg-accent" />
      <div className={`flex-1 h-1 rounded-full ${step === 'form' ? 'bg-accent' : 'bg-border'}`} />
    </div>
  );
}

/* ---- Pill selector component ---- */

function PillSelector({
  options,
  value,
  onChange,
  columns = 4,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  columns?: number;
}) {
  const { hapticFeedback } = useTelegram();
  return (
    <div className="flex flex-wrap gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => { onChange(opt); hapticFeedback('light'); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
            value === opt
              ? 'bg-accent text-white border-accent'
              : 'bg-transparent text-text-disabled border-text-disabled hover:border-accent'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ---- Main ---- */

export default function Onboarding({ onComplete }: { onComplete: (me: MeResponse) => void }) {
  const { hapticFeedback, hapticNotification, showBackButton, isTelegram } = useTelegram();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<SelectedRole | null>(null);
  const [saving, setSaving] = useState(false);

  // Shared form state
  const [name, setName] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');
  const [rank, setRank] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [club, setClub] = useState('');

  // Athlete-only
  const [weight, setWeight] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');

  // Telegram Back Button on step 2
  useEffect(() => {
    if (step === 'form') {
      return showBackButton(() => setStep('role'));
    }
  }, [step, showBackButton]);

  // Adjust day when month/year changes
  useEffect(() => {
    if (dobDay && dobMonth && dobYear) {
      const maxDay = daysInMonth(Number(dobMonth), Number(dobYear));
      if (Number(dobDay) > maxDay) setDobDay(String(maxDay));
    }
  }, [dobMonth, dobYear, dobDay]);

  const handleRoleSelect = (r: SelectedRole) => {
    hapticFeedback('light');
    setRole(r);
    setStep('form');
  };

  const effectiveCity = city === 'other' ? customCity.trim() : city;
  const dobValid = dobDay && dobMonth && dobYear;

  const isFormValid = role === 'athlete'
    ? name.trim() && dobValid && gender && weight && currentWeight && rank && effectiveCity
    : name.trim() && dobValid && gender && rank && effectiveCity && club.trim();

  const handleSubmit = async () => {
    if (!role || !isFormValid) return;
    setSaving(true);

    const dateOfBirth = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;

    const data: AthleteRegistration | CoachRegistration = role === 'athlete'
      ? {
          full_name: name.trim(),
          date_of_birth: dateOfBirth,
          gender: gender as 'M' | 'F',
          weight_category: weight,
          current_weight: parseFloat(currentWeight),
          sport_rank: rank,
          city: effectiveCity,
          club: club.trim() || undefined,
        }
      : {
          full_name: name.trim(),
          date_of_birth: dateOfBirth,
          gender: gender as 'M' | 'F',
          sport_rank: rank,
          city: effectiveCity,
          club: club.trim(),
        };

    try {
      let result: MeResponse;
      if (hasApi) {
        result = await registerProfile({ role, data });
      } else {
        await new Promise((r) => setTimeout(r, 500));
        result = registerMockProfile(role, data);
      }
      hapticNotification('success');
      onComplete(result);
    } catch {
      hapticNotification('error');
      setSaving(false);
    }
  };

  /* ---- Step 1: Role Selection ---- */
  if (step === 'role') {
    return (
      <div className="min-h-screen bg-bg flex flex-col px-6 pt-12" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <ProgressBar step="role" />

        <h1 className="text-[28px] font-heading text-text-heading mb-2">
          {t('onboarding.welcome')}
        </h1>
        <p className="text-sm text-text-secondary mb-8">
          {t('onboarding.chooseRole')}
        </p>

        <div className="space-y-3 flex-1">
          <button
            onClick={() => handleRoleSelect('athlete')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border border-border bg-bg-secondary cursor-pointer text-left transition-all hover:border-accent active:opacity-80"
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-accent-light text-accent shrink-0">
              <AthleteIcon />
            </div>
            <div>
              <p className="text-[17px] font-heading text-text-heading mb-0.5">{t('onboarding.athlete')}</p>
              <p className="text-[13px] text-text-secondary leading-snug">
                {t('onboarding.athleteDesc')}
              </p>
            </div>
          </button>

          <button
            onClick={() => handleRoleSelect('coach')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border border-border bg-bg-secondary cursor-pointer text-left transition-all hover:border-accent active:opacity-80"
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-accent-light text-accent shrink-0">
              <CoachIcon />
            </div>
            <div>
              <p className="text-[17px] font-heading text-text-heading mb-0.5">{t('onboarding.coach')}</p>
              <p className="text-[13px] text-text-secondary leading-snug">
                {t('onboarding.coachDesc')}
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  /* ---- Step 2: Profile Form ---- */

  const selectClass = 'flex-1 bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors appearance-none';

  const yearOptions: number[] = [];
  for (let y = 2018; y >= 1960; y--) yearOptions.push(y);

  const maxDay = dobMonth && dobYear ? daysInMonth(Number(dobMonth), Number(dobYear)) : 31;

  const weightCategories = gender === 'F' ? WEIGHT_F : WEIGHT_M;

  return (
    <div className="min-h-screen bg-bg flex flex-col px-6 pt-12" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
      {/* Back button (desktop only — Telegram uses BackButton API) */}
      {!isTelegram && (
        <button
          onClick={() => setStep('role')}
          aria-label={t('onboarding.back')}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary hover:text-accent active:opacity-70 transition-colors mb-4 -mt-2"
        >
          <BackArrow />
        </button>
      )}

      <ProgressBar step="form" />

      <h1 className="text-[28px] font-heading text-text-heading mb-6">
        {role === 'athlete' ? t('onboarding.athleteProfile') : t('onboarding.coachProfile')}
      </h1>

      <div className="flex-1 space-y-5">
        {/* Full Name */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.fullName')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('onboarding.enterFullName')}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors placeholder:text-text-disabled"
          />
        </div>

        {/* Date of Birth — 3 selects */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.dateOfBirth')}</span>
          <div className="flex gap-2">
            <select
              value={dobDay}
              onChange={(e) => setDobDay(e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>{t('onboarding.day')}</option>
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>{d}</option>
              ))}
            </select>
            <select
              value={dobMonth}
              onChange={(e) => setDobMonth(e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>{t('onboarding.month')}</option>
              {MONTHS_RU.map((m, i) => (
                <option key={i} value={String(i + 1)}>{m}</option>
              ))}
            </select>
            <select
              value={dobYear}
              onChange={(e) => setDobYear(e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>{t('onboarding.year')}</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Gender — pill buttons */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.gender')}</span>
          <div className="flex gap-2">
            {([['M', t('onboarding.male')], ['F', t('onboarding.female')]] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => { setGender(val); hapticFeedback('light'); }}
                className={`flex-1 py-2.5 rounded-full text-sm font-medium border cursor-pointer transition-colors ${
                  gender === val
                    ? 'bg-accent text-white border-accent'
                    : 'bg-transparent text-text-disabled border-text-disabled hover:border-accent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {role === 'athlete' && (
          <>
            {/* Weight Category — pill selector (depends on gender) */}
            <div>
              <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.weightCategory')}</span>
              <PillSelector options={weightCategories} value={weight} onChange={setWeight} />
            </div>

            {/* Current Weight — number input */}
            <div>
              <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.currentWeight')}</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="300"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                placeholder="65.5"
                className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors placeholder:text-text-disabled"
              />
            </div>
          </>
        )}

        {/* Sport Rank — pill buttons in 2 columns */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.sportRank')}</span>
          <PillSelector options={RANKS} value={rank} onChange={setRank} columns={2} />
        </div>

        {/* City — select + custom */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.city')}</span>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors appearance-none"
          >
            <option value="" disabled>{t('onboarding.selectCity')}</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="other">{t('onboarding.otherCity')}</option>
          </select>
          {city === 'other' && (
            <input
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              placeholder={t('onboarding.enterCity')}
              className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 mt-2 outline-none focus:border-accent transition-colors placeholder:text-text-disabled"
            />
          )}
        </div>

        {/* Club */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">
            {t('onboarding.club')}
            {role === 'athlete' && <span className="normal-case tracking-normal text-text-disabled ml-1">({t('common.optional')})</span>}
          </span>
          <input
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder={t('onboarding.enterClub')}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors placeholder:text-text-disabled"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="pt-4 pb-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !isFormValid}
          className="w-full py-3.5 rounded-lg text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-40 active:opacity-80 transition-all"
        >
          {saving ? t('onboarding.settingUp') : t('onboarding.getStarted')}
        </button>
      </div>
    </div>
  );
}
