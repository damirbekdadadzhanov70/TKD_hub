import { useEffect, useRef, useState } from 'react';
import { registerProfile } from '../api/endpoints';
import { registerMockProfile } from '../api/mock';
import BottomSheet from '../components/BottomSheet';
import { useTelegram } from '../hooks/useTelegram';
import { useI18n } from '../i18n/I18nProvider';
import type { AthleteRegistration, CoachRegistration, MeResponse } from '../types';

const RANKS = ['Без разряда', '3 разряд', '2 разряд', '1 разряд', 'КМС', 'МС', 'МСМК', 'ЗМС'];
const WEIGHT_M = ['54kg', '58kg', '63kg', '68kg', '74kg', '80kg', '87kg', '+87kg'];
const WEIGHT_F = ['46kg', '49kg', '53kg', '57kg', '62kg', '67kg', '73kg', '+73kg'];
const CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Нижний Новгород', 'Рязань', 'Махачкала', 'Новосибирск', 'Краснодар', 'Владивосток'];
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type SelectedRole = 'athlete' | 'coach';
type Step = 'language' | 'role' | 'form';

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

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* ---- Progress Bar ---- */

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex gap-2 mb-8">
      <div className={`flex-1 h-1 rounded-full ${step !== 'language' ? 'bg-accent' : 'bg-border'}`} />
      <div className={`flex-1 h-1 rounded-full ${step === 'form' ? 'bg-accent' : 'bg-border'}`} />
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

/* ---- SelectSheet — replaces native <select> ---- */

function SelectSheet({
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
  const { hapticFeedback } = useTelegram();
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-1 flex items-center justify-between bg-transparent border-b border-border text-[15px] py-2 outline-none cursor-pointer transition-colors hover:border-accent min-w-0"
      >
        <span className={selected ? 'text-text truncate' : 'text-text-disabled truncate'}>
          {selected ? selected.label : label}
        </span>
        <ChevronDown />
      </button>
      {open && (
        <BottomSheet onClose={() => setOpen(false)}>
          <div className="px-6 pt-2 pb-1">
            <h3 className="text-[17px] font-heading text-text-heading">{label}</h3>
          </div>
          <div className="overflow-y-auto px-2 pb-6" style={{ maxHeight: '50vh' }}>
            {options.map((opt) => (
              <button
                key={opt.value}
                ref={opt.value === value ? activeRef : undefined}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  hapticFeedback('light');
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg text-[15px] cursor-pointer transition-colors ${
                  opt.value === value
                    ? 'bg-accent text-white'
                    : 'text-text hover:bg-bg-secondary active:opacity-80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}

/* ---- Main ---- */

export default function Onboarding({ onComplete }: { onComplete: (me: MeResponse) => void }) {
  const { hapticFeedback, hapticNotification, showBackButton, isTelegram } = useTelegram();
  const { t, lang, setLang } = useI18n();

  const hasStoredLang = !!localStorage.getItem('app_language');
  const [step, setStep] = useState<Step>(hasStoredLang ? 'role' : 'language');
  const [role, setRole] = useState<SelectedRole | null>(null);
  const [saving, setSaving] = useState(false);

  // Split name fields
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
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

  // Telegram Back Button on step 2 and 3
  useEffect(() => {
    if (step === 'form') {
      return showBackButton(() => setStep('role'));
    }
    if (step === 'role' && !hasStoredLang) {
      return showBackButton(() => setStep('language'));
    }
  }, [step, showBackButton, hasStoredLang]);

  // Clamp day when month/year changes
  const clampDay = (day: string, month: string, year: string) => {
    if (day && month && year) {
      const maxDay = daysInMonth(Number(month), Number(year));
      if (Number(day) > maxDay) setDobDay(String(maxDay));
    }
  };
  const handleDobMonth = (m: string) => { setDobMonth(m); clampDay(dobDay, m, dobYear); };
  const handleDobYear = (y: string) => { setDobYear(y); clampDay(dobDay, dobMonth, y); };

  const handleRoleSelect = (r: SelectedRole) => {
    hapticFeedback('light');
    setRole(r);
    setStep('form');
  };

  const effectiveCity = city === 'other' ? customCity.trim() : city;
  const dobValid = dobDay && dobMonth && dobYear;

  const isFormValid = role === 'athlete'
    ? lastName.trim() && firstName.trim() && dobValid && gender && weight && currentWeight && rank && effectiveCity
    : lastName.trim() && firstName.trim() && dobValid && gender && rank && effectiveCity && club.trim();

  const handleSubmit = async () => {
    if (!role || !isFormValid) return;
    setSaving(true);

    const fullName = `${lastName.trim()} ${firstName.trim()}`;
    const dateOfBirth = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;

    const data: AthleteRegistration | CoachRegistration = role === 'athlete'
      ? {
          full_name: fullName,
          date_of_birth: dateOfBirth,
          gender: gender as 'M' | 'F',
          weight_category: weight,
          current_weight: parseFloat(currentWeight),
          sport_rank: rank,
          city: effectiveCity,
          club: club.trim() || undefined,
        }
      : {
          full_name: fullName,
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

  const months = lang === 'ru' ? MONTHS_RU : MONTHS_EN;

  /* ---- Step 0: Language Selection ---- */
  if (step === 'language') {
    return (
      <div className="min-h-screen bg-bg flex flex-col px-6 pt-12" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <ProgressBar step="language" />

        <h1 className="text-[28px] font-heading text-text-heading mb-2">
          {t('onboarding.chooseLanguage')}
        </h1>
        <p className="text-sm text-text-secondary mb-8">
          Choose language / Выберите язык
        </p>

        <div className="space-y-3 flex-1">
          <button
            onClick={() => {
              hapticFeedback('light');
              setLang('ru');
              setStep('role');
            }}
            className={`w-full flex items-center gap-4 p-5 rounded-2xl border cursor-pointer text-left transition-all hover:border-accent active:opacity-80 ${
              lang === 'ru' ? 'border-accent bg-accent-light' : 'border-border bg-bg-secondary'
            }`}
          >
            <span className="text-2xl shrink-0">RU</span>
            <span className="text-[17px] font-heading text-text-heading">Русский</span>
          </button>

          <button
            onClick={() => {
              hapticFeedback('light');
              setLang('en');
              setStep('role');
            }}
            className={`w-full flex items-center gap-4 p-5 rounded-2xl border cursor-pointer text-left transition-all hover:border-accent active:opacity-80 ${
              lang === 'en' ? 'border-accent bg-accent-light' : 'border-border bg-bg-secondary'
            }`}
          >
            <span className="text-2xl shrink-0">EN</span>
            <span className="text-[17px] font-heading text-text-heading">English</span>
          </button>
        </div>
      </div>
    );
  }

  /* ---- Step 1: Role Selection ---- */
  if (step === 'role') {
    return (
      <div className="min-h-screen bg-bg flex flex-col px-6 pt-12" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        {/* Back button to language step (desktop only) */}
        {!isTelegram && !hasStoredLang && (
          <button
            onClick={() => setStep('language')}
            aria-label={t('onboarding.back')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary hover:text-accent active:opacity-70 transition-colors mb-4 -mt-2"
          >
            <BackArrow />
          </button>
        )}

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

  const yearOptions: { value: string; label: string }[] = [];
  for (let y = 2018; y >= 1960; y--) yearOptions.push({ value: String(y), label: String(y) });

  const maxDay = dobMonth && dobYear ? daysInMonth(Number(dobMonth), Number(dobYear)) : 31;
  const dayOptions = Array.from({ length: maxDay }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));
  const monthOptions = months.map((m, i) => ({
    value: String(i + 1),
    label: m,
  }));

  const cityOptions = [
    ...CITIES.map((c) => ({ value: c, label: c })),
    { value: 'other', label: t('onboarding.otherCity') },
  ];

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
        {/* Last Name + First Name */}
        <div className="flex gap-3">
          <div className="flex-1">
            <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.lastName')}</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t('onboarding.enterLastName')}
              className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors placeholder:text-text-disabled"
            />
          </div>
          <div className="flex-1">
            <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.firstName')}</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t('onboarding.enterFirstName')}
              className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors placeholder:text-text-disabled"
            />
          </div>
        </div>

        {/* Date of Birth — 3 SelectSheet buttons */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.dateOfBirth')}</span>
          <div className="flex gap-2">
            <SelectSheet
              label={t('onboarding.day')}
              value={dobDay}
              options={dayOptions}
              onChange={setDobDay}
            />
            <SelectSheet
              label={t('onboarding.month')}
              value={dobMonth}
              options={monthOptions}
              onChange={handleDobMonth}
            />
            <SelectSheet
              label={t('onboarding.year')}
              value={dobYear}
              options={yearOptions}
              onChange={handleDobYear}
            />
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

        {/* City — SelectSheet + custom */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.city')}</span>
          <SelectSheet
            label={t('onboarding.selectCity')}
            value={city}
            options={cityOptions}
            onChange={setCity}
          />
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
