import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import BottomSheet from '../components/BottomSheet';
import PullToRefresh from '../components/PullToRefresh';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import { useI18n } from '../i18n/I18nProvider';
import {
  getWeightEntries,
  createWeightEntry,
  deleteWeightEntry,
  getSleepEntries,
  createSleepEntry,
  deleteSleepEntry,
  getCoachAthleteWeightEntries,
  getCoachAthleteSleepEntries,
  getCoachAthletes,
  getMe,
} from '../api/endpoints';
import {
  mockWeightEntries,
  mockSleepEntries,
  getMockCoachAthleteWeightEntries,
  getMockCoachAthleteSleepEntries,
  mockCoachAthletes,
  mockMe,
} from '../api/mock';
import type { CoachAthlete, MeResponse, WeightEntry, SleepEntry } from '../types';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default function Health() {
  const { t, tArray } = useI18n();
  const { hapticFeedback } = useTelegram();
  const MONTH_NAMES = tArray('training.months');
  const WEEKDAYS = tArray('training.weekdays');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showChoice, setShowChoice] = useState(false);
  const [formType, setFormType] = useState<'weight' | 'sleep' | null>(null);
  const [chartMode, setChartMode] = useState<'weight' | 'sleep'>('weight');

  // Coach mode
  const { data: me } = useApi<MeResponse>(getMe, mockMe, []);
  const isCoach = me?.role === 'coach';

  const { data: athletes } = useApi<CoachAthlete[]>(
    getCoachAthletes,
    mockCoachAthletes,
    [],
  );

  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>('self');
  const [showAthleteSelector, setShowAthleteSelector] = useState(false);
  const [athleteSearch, setAthleteSearch] = useState('');

  const isSelfLog = selectedAthleteId === 'self';

  const selectedAthlete = useMemo(
    () => (isSelfLog ? null : athletes?.find((a) => a.id === selectedAthleteId) ?? null),
    [athletes, selectedAthleteId, isSelfLog],
  );

  const filteredAthletes = useMemo(() => {
    if (!athletes) return [];
    if (!athleteSearch.trim()) return athletes;
    const q = athleteSearch.toLowerCase();
    return athletes.filter((a) => a.full_name.toLowerCase().includes(q));
  }, [athletes, athleteSearch]);

  const viewingOtherAthlete = isCoach && selectedAthleteId && !isSelfLog;
  const readOnly = isCoach && !isSelfLog;

  // Conditional data fetching
  const weightFetcher = useCallback(() => {
    if (viewingOtherAthlete) return getCoachAthleteWeightEntries(selectedAthleteId);
    return getWeightEntries();
  }, [viewingOtherAthlete, selectedAthleteId]);

  const weightMock = useMemo(() => {
    if (viewingOtherAthlete) return getMockCoachAthleteWeightEntries();
    return mockWeightEntries;
  }, [viewingOtherAthlete, selectedAthleteId]);

  const sleepFetcher = useCallback(() => {
    if (viewingOtherAthlete) return getCoachAthleteSleepEntries(selectedAthleteId);
    return getSleepEntries();
  }, [viewingOtherAthlete, selectedAthleteId]);

  const sleepMock = useMemo(() => {
    if (viewingOtherAthlete) return getMockCoachAthleteSleepEntries();
    return mockSleepEntries;
  }, [viewingOtherAthlete, selectedAthleteId]);

  const shouldFetch = !isCoach || !!selectedAthleteId;

  const [weightEntries, setWeightEntries] = useState<WeightEntry[] | null>(null);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[] | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!shouldFetch) {
      setWeightEntries(null);
      setSleepEntries(null);
      return;
    }
    if (!silent) setDataLoading(true);
    const hasApi = !!import.meta.env.VITE_API_URL;
    const isTg = !!(window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData;
    if (!isTg || !hasApi) {
      await new Promise((r) => setTimeout(r, 300));
      setWeightEntries(weightMock);
      setSleepEntries(sleepMock);
      setDataLoading(false);
      return;
    }
    try {
      const [w, s] = await Promise.all([weightFetcher(), sleepFetcher()]);
      setWeightEntries(w);
      setSleepEntries(s);
    } catch (err) {
      console.error('Health data fetch error:', err);
    } finally {
      setDataLoading(false);
    }
  }, [shouldFetch, weightFetcher, sleepFetcher, weightMock, sleepMock]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loading = dataLoading;

  const weightDates = useMemo(() => {
    const map = new Map<string, WeightEntry>();
    if (weightEntries) {
      weightEntries.forEach((e) => map.set(e.date, e));
    }
    return map;
  }, [weightEntries]);

  const sleepDates = useMemo(() => {
    const map = new Map<string, SleepEntry>();
    if (sleepEntries) {
      sleepEntries.forEach((e) => map.set(e.date, e));
    }
    return map;
  }, [sleepEntries]);

  const sortedWeightEntries = useMemo(() => {
    if (!weightEntries) return [];
    return [...weightEntries].sort((a, b) => a.date.localeCompare(b.date));
  }, [weightEntries]);

  const sortedSleepEntries = useMemo(() => {
    if (!sleepEntries) return [];
    return [...sleepEntries].sort((a, b) => a.date.localeCompare(b.date));
  }, [sleepEntries]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const prevMonth = () => {
    setSelectedDate(null);
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
  const nextMonth = () => {
    if (isFutureMonth) return;
    setSelectedDate(null);
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const handleDayClick = (day: number) => {
    const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1) || (isCurrentMonth && day > today);
    if (isFuture) return;
    hapticFeedback('light');
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
  };

  const handleFabClick = () => {
    hapticFeedback('light');
    if (!selectedDate) {
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setSelectedDate(todayStr);
    }
    setShowChoice(true);
  };

  const handleChoicePick = (type: 'weight' | 'sleep') => {
    setShowChoice(false);
    setFormType(type);
  };

  const handleFormClose = () => {
    setFormType(null);
  };

  const handleFormSaved = () => {
    setFormType(null);
    fetchData(true);
  };

  const handleRefresh = async () => {
    await fetchData(true);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="relative">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-3xl font-heading text-text-heading">
            {t('health.title')}
          </h1>
        </div>

        {/* Coach: Athlete Selector */}
        {isCoach && (
          <div className="px-4 mb-2">
            <button
              onClick={() => {
                setAthleteSearch('');
                setShowAthleteSelector(true);
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-bg-secondary text-sm cursor-pointer hover:border-accent active:opacity-80 transition-all"
            >
              <span className={selectedAthleteId ? 'text-text font-medium' : 'text-text-secondary'}>
                {isSelfLog
                  ? t('training.myLog')
                  : selectedAthlete
                    ? `${t('training.athleteLog')}: ${selectedAthlete.full_name}`
                    : t('training.selectAthlete')}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary shrink-0">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        )}

        {/* Coach: no athlete selected state */}
        {isCoach && !selectedAthleteId && (
          <div className="px-4 pt-8">
            <EmptyState
              title={t('training.selectAthlete')}
              description={t('training.noAthleteSelected')}
            />
          </div>
        )}

        {/* Main content */}
        {(!isCoach || selectedAthleteId) && (
          <>
            {/* Calendar */}
            <div className="px-4">
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <button aria-label={t('training.prevMonth')} onClick={prevMonth} className="text-lg border-none bg-transparent cursor-pointer px-2 text-accent">&#8249;</button>
                  <span className="font-semibold text-sm text-text">
                    {MONTH_NAMES[month - 1]} {year}
                  </span>
                  <button aria-label={t('training.nextMonth')} onClick={nextMonth} disabled={isFutureMonth} className={`text-lg border-none bg-transparent px-2 ${isFutureMonth ? 'text-text-disabled cursor-default' : 'text-accent cursor-pointer'}`}>&#8250;</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {WEEKDAYS.map((d: string) => (
                    <div key={d} className="py-1 font-medium text-text-secondary">{d}</div>
                  ))}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const hasWeight = weightDates.has(dateStr);
                    const hasSleep = sleepDates.has(dateStr);
                    const isToday = isCurrentMonth && day === today;
                    const isSelected = selectedDate === dateStr;
                    const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1) || (isCurrentMonth && day > today);
                    return (
                      <div
                        key={day}
                        onClick={() => handleDayClick(day)}
                        className={`py-1.5 rounded-lg relative text-xs transition-colors ${
                          isFuture
                            ? 'text-text-disabled cursor-default'
                            : isSelected && isToday
                              ? 'bg-accent text-white font-bold cursor-pointer ring-2 ring-accent ring-offset-1'
                              : isSelected
                                ? 'bg-accent/15 text-accent font-bold cursor-pointer'
                                : isToday
                                  ? 'bg-accent text-white font-bold cursor-pointer'
                                  : 'text-text cursor-pointer hover:bg-bg-secondary'
                        }`}
                      >
                        {day}
                        {(hasWeight || hasSleep) && (
                          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                            {hasWeight && (
                              <div className={`w-1.5 h-1.5 rounded-full ${isToday && !isSelected ? 'bg-white' : 'bg-accent'}`} />
                            )}
                            {hasSleep && (
                              <div className={`w-1.5 h-1.5 rounded-full ${isToday && !isSelected ? 'bg-white/70' : 'bg-blue-600'}`} />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Selected date data */}
                {selectedDate && (() => {
                  const sw = weightDates.get(selectedDate);
                  const ss = sleepDates.get(selectedDate);
                  const d = new Date(selectedDate + 'T00:00:00');
                  return (
                    <div className="mt-3 pt-3 border-t border-dashed border-border">
                      <p className="text-[11px] uppercase tracking-wider text-text-disabled mb-2">
                        {d.getDate()} {MONTH_NAMES[d.getMonth()]}
                      </p>
                      {sw || ss ? (
                        <>
                          {sw && (
                            <div
                              onClick={readOnly ? undefined : () => setFormType('weight')}
                              className={`flex items-center justify-between py-2 -mx-2 px-2 rounded-lg transition-all ${
                                readOnly ? '' : 'cursor-pointer hover:bg-bg-secondary/50 active:opacity-80'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-accent/10">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                                    <path d="M6.5 6.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
                                    <path d="M12 6.5V4" />
                                    <path d="M9 10h6" />
                                  </svg>
                                </div>
                                <span className="text-sm font-semibold text-text">{t('health.weight')}</span>
                              </div>
                              <span className="text-sm font-mono font-bold text-accent">{sw.weight_kg} {t('health.kg')}</span>
                            </div>
                          )}
                          {ss && (
                            <div
                              onClick={readOnly ? undefined : () => setFormType('sleep')}
                              className={`flex items-center justify-between py-2 -mx-2 px-2 rounded-lg transition-all ${
                                readOnly ? '' : 'cursor-pointer hover:bg-bg-secondary/50 active:opacity-80'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-blue-600/10">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                  </svg>
                                </div>
                                <span className="text-sm font-semibold text-text">{t('health.sleep')}</span>
                              </div>
                              <span className="text-sm font-mono font-bold text-blue-600">{ss.sleep_hours} {t('health.hours')}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-text-secondary py-2">{t('health.noDataThisDay')}</p>
                      )}
                    </div>
                  );
                })()}
              </Card>
            </div>

            {/* Chart */}
            <div className="px-4">
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    {chartMode === 'weight' ? t('health.weightChart') : t('health.sleepChart')}
                  </h3>
                  <div className="flex gap-1">
                    <button
                      aria-label={t('health.weight')}
                      onClick={() => setChartMode('weight')}
                      className={`p-1.5 rounded-lg border-none cursor-pointer transition-colors ${
                        chartMode === 'weight' ? 'text-accent bg-accent/10' : 'text-text-secondary bg-transparent hover:text-text'
                      }`}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6.5 6.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
                        <path d="M12 6.5V4" />
                        <path d="M9 10h6" />
                      </svg>
                    </button>
                    <button
                      aria-label={t('health.sleep')}
                      onClick={() => setChartMode('sleep')}
                      className={`p-1.5 rounded-lg border-none cursor-pointer transition-colors ${
                        chartMode === 'sleep' ? 'text-blue-600 bg-blue-600/10' : 'text-text-secondary bg-transparent hover:text-text'
                      }`}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    </button>
                  </div>
                </div>
                {loading ? (
                  <LoadingSpinner />
                ) : chartMode === 'weight' ? (
                  sortedWeightEntries.length === 0 ? (
                    <EmptyState title={t('health.noData')} description={t('health.noDataDesc')} />
                  ) : (
                    <WeightChart entries={sortedWeightEntries} highlightDate={selectedDate} />
                  )
                ) : (
                  sortedSleepEntries.length === 0 ? (
                    <EmptyState title={t('health.noData')} description={t('health.noDataDesc')} />
                  ) : (
                    <SleepChart entries={sortedSleepEntries} highlightDate={selectedDate} />
                  )
                )}
              </Card>
            </div>

            {/* FAB — only in editable mode */}
            {!readOnly && (
              <button
                aria-label={t('health.chooseType')}
                onClick={handleFabClick}
                className="fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl border-none cursor-pointer bg-accent text-white shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 active:scale-95 transition-all z-40"
              >
                +
              </button>
            )}

            {/* Choice BottomSheet */}
            {showChoice && selectedDate && !readOnly && (
              <BottomSheet onClose={() => setShowChoice(false)}>
                <div className="p-4 pb-2">
                  <h2 className="text-lg font-bold text-text">{t('health.chooseType')}</h2>
                </div>
                <div className="px-4 pb-4 space-y-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                  <button
                    onClick={() => handleChoicePick('weight')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-bg-secondary text-text cursor-pointer hover:bg-bg-secondary/80 active:opacity-80 transition-all"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
                      <path d="M6.5 6.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
                      <path d="M12 6.5V4" />
                      <path d="M9 10h6" />
                    </svg>
                    <span className="font-semibold text-sm">{t('health.weight')}</span>
                  </button>
                  <button
                    onClick={() => handleChoicePick('sleep')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-bg-secondary text-text cursor-pointer hover:bg-bg-secondary/80 active:opacity-80 transition-all"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 shrink-0">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                    <span className="font-semibold text-sm">{t('health.sleep')}</span>
                  </button>
                </div>
              </BottomSheet>
            )}

            {/* Weight Form BottomSheet */}
            {formType === 'weight' && selectedDate && !readOnly && (
              <WeightForm
                date={selectedDate}
                existing={weightDates.get(selectedDate) || null}
                onClose={handleFormClose}
                onSaved={handleFormSaved}
              />
            )}

            {/* Sleep Form BottomSheet */}
            {formType === 'sleep' && selectedDate && !readOnly && (
              <SleepForm
                date={selectedDate}
                existing={sleepDates.get(selectedDate) || null}
                onClose={handleFormClose}
                onSaved={handleFormSaved}
              />
            )}
          </>
        )}

        {/* Athlete selector bottom sheet */}
        {showAthleteSelector && (
          <BottomSheet onClose={() => setShowAthleteSelector(false)}>
            <div className="p-4 pt-5">
              <h2 className="text-lg font-bold text-text mb-3">{t('training.selectAthlete')}</h2>
              <input
                type="text"
                value={athleteSearch}
                onChange={(e) => setAthleteSearch(e.target.value)}
                placeholder={t('training.searchAthlete')}
                className="w-full rounded-lg px-3 py-2.5 text-sm border border-border bg-bg-secondary text-text outline-none mb-3"
                autoFocus
              />
              <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                {/* Coach's own log — always available */}
                {(!athleteSearch.trim() || t('training.myLog').toLowerCase().includes(athleteSearch.toLowerCase()) || (me?.athlete?.full_name && me.athlete.full_name.toLowerCase().includes(athleteSearch.toLowerCase()))) && (
                  <button
                    onClick={() => {
                      setSelectedAthleteId('self');
                      setSelectedDate(null);
                      setShowAthleteSelector(false);
                    }}
                    className={`w-full text-left px-3 py-3 rounded-xl border-none cursor-pointer active:opacity-80 transition-all ${
                      isSelfLog
                        ? 'bg-accent/10 text-accent'
                        : 'bg-transparent text-text hover:bg-bg-secondary'
                    }`}
                  >
                    <p className="text-sm font-semibold">{t('training.myLog')}</p>
                    {me?.athlete && (
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        {me.athlete.full_name} · {me.athlete.weight_category}
                      </p>
                    )}
                  </button>
                )}
                {filteredAthletes.length === 0 && athleteSearch.trim() === '' && (
                  <p className="text-sm text-text-secondary text-center py-4">{t('training.noAcceptedAthletes')}</p>
                )}
                {filteredAthletes.map((athlete) => (
                  <button
                    key={athlete.id}
                    onClick={() => {
                      setSelectedAthleteId(athlete.id);
                      setSelectedDate(null);
                      setShowAthleteSelector(false);
                    }}
                    className={`w-full text-left px-3 py-3 rounded-xl border-none cursor-pointer active:opacity-80 transition-all ${
                      selectedAthleteId === athlete.id
                        ? 'bg-accent/10 text-accent'
                        : 'bg-transparent text-text hover:bg-bg-secondary'
                    }`}
                  >
                    <p className="text-sm font-semibold">{athlete.full_name}</p>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      {athlete.weight_category}{athlete.club ? ` · ${athlete.club}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </BottomSheet>
        )}
      </div>
    </PullToRefresh>
  );
}

function WeightForm({
  date,
  existing,
  onClose,
  onSaved,
}: {
  date: string;
  existing: WeightEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { hapticNotification } = useTelegram();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [weight, setWeight] = useState(existing ? String(existing.weight_kg) : '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(weight);
    if (!val || val <= 0) return;
    setSaving(true);
    try {
      await createWeightEntry({ date, weight_kg: val });
      hapticNotification('success');
      showToast(t('health.weightSaved'), 'success');
      onSaved();
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setDeleting(true);
    try {
      await deleteWeightEntry(existing.id);
      hapticNotification('success');
      onSaved();
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
      setDeleting(false);
    }
  };

  const formattedDate = (() => {
    const d = new Date(date + 'T00:00:00');
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  })();

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex justify-between items-center p-4 pb-2 shrink-0">
        <h2 className="text-lg font-bold text-text">{formattedDate}</h2>
        <button onClick={onClose} className="text-2xl border-none bg-transparent cursor-pointer text-muted">&times;</button>
      </div>

      <div className="px-4 pb-2 space-y-3">
        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">{t('health.weightKg')}</span>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
            placeholder="67.5"
            autoFocus
          />
        </label>
      </div>

      <div className="p-4 pt-2 space-y-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleSave}
          disabled={saving || !weight}
          className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-60 active:opacity-80 transition-all"
        >
          {saving ? t('common.saving') : t('health.save')}
        </button>
        {existing && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500/10 text-rose-500 disabled:opacity-40 active:opacity-80 transition-all"
          >
            {deleting ? t('common.deleting') : t('health.delete')}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

function SleepForm({
  date,
  existing,
  onClose,
  onSaved,
}: {
  date: string;
  existing: SleepEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { hapticNotification } = useTelegram();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [hours, setHours] = useState(existing ? String(existing.sleep_hours) : '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(hours);
    if (!val || val <= 0 || val > 24) return;
    setSaving(true);
    try {
      await createSleepEntry({ date, sleep_hours: val });
      hapticNotification('success');
      showToast(t('health.sleepSaved'), 'success');
      onSaved();
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setDeleting(true);
    try {
      await deleteSleepEntry(existing.id);
      hapticNotification('success');
      onSaved();
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
      setDeleting(false);
    }
  };

  const formattedDate = (() => {
    const d = new Date(date + 'T00:00:00');
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  })();

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex justify-between items-center p-4 pb-2 shrink-0">
        <h2 className="text-lg font-bold text-text">{formattedDate}</h2>
        <button onClick={onClose} className="text-2xl border-none bg-transparent cursor-pointer text-muted">&times;</button>
      </div>

      <div className="px-4 pb-2 space-y-3">
        <label className="block">
          <span className="text-xs mb-1 block text-text-secondary">{t('health.sleepHours')}</span>
          <input
            type="number"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-bg-secondary text-text outline-none"
            placeholder="8.0"
            autoFocus
          />
        </label>
      </div>

      <div className="p-4 pt-2 space-y-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleSave}
          disabled={saving || !hours}
          className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-60 active:opacity-80 transition-all"
        >
          {saving ? t('common.saving') : t('health.save')}
        </button>
        {existing && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500/10 text-rose-500 disabled:opacity-40 active:opacity-80 transition-all"
          >
            {deleting ? t('common.deleting') : t('health.delete')}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

function InteractiveChart({
  entryCount,
  yLabels,
  chartH,
  highlightIndex,
  children,
}: {
  entryCount: number;
  yLabels: { label: string; y: number }[];
  chartH: number;
  highlightIndex: number;
  children: (spacing: number, padL: number) => ReactNode;
}) {
  const BASE_SPACING = 60;
  const Y_AXIS_W = 40;
  const PAD_L = 25;
  const PAD_R = 30;

  const [scale, setScale] = useState(1.0);
  const [scrollRatio, setScrollRatio] = useState(1);
  const [thumbRatio, setThumbRatio] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1.0);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

  useEffect(() => { scaleRef.current = scale; }, [scale]);

  const spacing = BASE_SPACING * scale;
  const svgW = PAD_L + Math.max((entryCount - 1) * spacing, 100) + PAD_R;

  const updateScrollInfo = useCallback(() => {
    const el = containerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) {
      setScrollRatio(0);
      setThumbRatio(1);
      return;
    }
    setThumbRatio(el.clientWidth / el.scrollWidth);
    setScrollRatio(el.scrollLeft / (el.scrollWidth - el.clientWidth));
  }, []);

  // Auto-scroll to right on mount / data change
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    }
  }, [entryCount]);

  // Scroll to highlighted point when selection changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el || highlightIndex < 0) return;
    const pointX = PAD_L + highlightIndex * spacing;
    const center = pointX - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, center), behavior: 'smooth' });
  }, [highlightIndex, spacing]);

  // Ctrl+Wheel zoom (non-passive for preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pointerX = e.clientX - rect.left + el.scrollLeft;
      const oldScale = scaleRef.current;
      const next = Math.min(3.0, Math.max(0.5, oldScale - e.deltaY * 0.005));
      if (next === oldScale) return;
      const oldW = PAD_L + Math.max((entryCount - 1) * BASE_SPACING * oldScale, 100) + PAD_R;
      const ratio = pointerX / oldW;
      setScale(next);
      requestAnimationFrame(() => {
        const newW = PAD_L + Math.max((entryCount - 1) * BASE_SPACING * next, 100) + PAD_R;
        el.scrollLeft = ratio * newW - (e.clientX - rect.left);
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [entryCount]);

  // Touch pinch-to-zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { startDist: Math.hypot(dx, dy), startScale: scaleRef.current };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return;
    e.stopPropagation();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const next = Math.min(3.0, Math.max(0.5, pinchRef.current.startScale * (dist / pinchRef.current.startDist)));
    setScale(next);
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null;
  }, []);

  return (
    <div className="relative">
      {/* Fixed Y-axis overlay */}
      <div
        className="absolute left-0 top-0 z-[1] bg-bg-secondary"
        style={{ width: `${Y_AXIS_W}px`, height: chartH }}
      >
        <svg width={Y_AXIS_W} height={chartH}>
          {yLabels.map((label, i) => (
            <text
              key={i}
              x={Y_AXIS_W - 4}
              y={label.y + 3}
              textAnchor="end"
              className="text-text-secondary"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              {label.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Scrollable chart area */}
      <div
        ref={containerRef}
        className="overflow-y-hidden hide-scrollbar"
        style={{ marginLeft: `${Y_AXIS_W}px`, overflowX: 'auto', touchAction: 'pan-x' }}
        onScroll={updateScrollInfo}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <svg width={svgW} height={chartH}>
          {/* Horizontal grid lines */}
          {yLabels.map((label, i) => (
            <line
              key={i}
              x1={0}
              y1={label.y}
              x2={svgW}
              y2={label.y}
              stroke="currentColor"
              className="text-border"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
          ))}
          {children(spacing, PAD_L)}
        </svg>
      </div>

      {/* Scroll indicator */}
      {thumbRatio < 1 && (
        <div className="mt-2 rounded-full bg-border/30" style={{ marginLeft: `${Y_AXIS_W}px`, height: 3 }}>
          <div
            className="h-full rounded-full bg-accent/40 transition-[left] duration-75"
            style={{
              width: `${thumbRatio * 100}%`,
              marginLeft: `${scrollRatio * (1 - thumbRatio) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function WeightChart({ entries, highlightDate }: { entries: WeightEntry[]; highlightDate: string | null }) {
  const hlIndex = highlightDate ? entries.findIndex((e) => e.date === highlightDate) : -1;
  const weights = entries.map((e) => e.weight_kg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const padding = Math.max((maxW - minW) * 0.2, 0.5);
  const yMin = minW - padding;
  const yMax = maxW + padding;

  const chartH = 140;
  const padT = 10;
  const padB = 25;
  const innerH = chartH - padT - padB;

  const yMid = (yMin + yMax) / 2;
  const yLabels = [
    { label: yMax.toFixed(1), y: padT },
    { label: yMid.toFixed(1), y: padT + innerH / 2 },
    { label: yMin.toFixed(1), y: padT + innerH },
  ];

  return (
    <InteractiveChart entryCount={entries.length} yLabels={yLabels} chartH={chartH} highlightIndex={hlIndex}>
      {(spacing, padL) => {
        const points = entries.map((e, i) => ({
          x: padL + i * spacing,
          y: padT + innerH - ((e.weight_kg - yMin) / (yMax - yMin)) * innerH,
          entry: e,
        }));
        const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
        const labelStep = Math.max(1, Math.ceil(40 / spacing));
        return (
          <>
            <polyline
              points={polyline}
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p) => {
              const isHl = p.entry.date === highlightDate;
              return (
                <g key={p.entry.id}>
                  {isHl && <circle cx={p.x} cy={p.y} r="8" fill="#D4AF37" opacity="0.2" />}
                  <circle cx={p.x} cy={p.y} r={isHl ? 5 : 4} fill="#D4AF37" />
                  <circle cx={p.x} cy={p.y} r="2" fill="white" />
                  {(entries.length === 1 || isHl) && (
                    <text
                      x={p.x}
                      y={p.y - 10}
                      textAnchor="middle"
                      fill="#D4AF37"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="var(--font-mono)"
                    >
                      {p.entry.weight_kg}
                    </text>
                  )}
                </g>
              );
            })}
            {points.map((p, i) => {
              if (i % labelStep !== 0 && i !== entries.length - 1) return null;
              const d = new Date(p.entry.date + 'T00:00:00');
              const label = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
              return (
                <text
                  key={p.entry.id}
                  x={p.x}
                  y={chartH - 3}
                  textAnchor="middle"
                  className="text-text-secondary"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                >
                  {label}
                </text>
              );
            })}
          </>
        );
      }}
    </InteractiveChart>
  );
}

function SleepChart({ entries, highlightDate }: { entries: SleepEntry[]; highlightDate: string | null }) {
  const hlIndex = highlightDate ? entries.findIndex((e) => e.date === highlightDate) : -1;
  const hours = entries.map((e) => e.sleep_hours);
  const minH = Math.min(...hours);
  const maxH = Math.max(...hours);
  const padding = Math.max((maxH - minH) * 0.2, 0.5);
  const yMin = minH - padding;
  const yMax = maxH + padding;

  const chartH = 140;
  const padT = 10;
  const padB = 25;
  const innerH = chartH - padT - padB;

  const yMid = (yMin + yMax) / 2;
  const yLabels = [
    { label: yMax.toFixed(1), y: padT },
    { label: yMid.toFixed(1), y: padT + innerH / 2 },
    { label: yMin.toFixed(1), y: padT + innerH },
  ];

  return (
    <InteractiveChart entryCount={entries.length} yLabels={yLabels} chartH={chartH} highlightIndex={hlIndex}>
      {(spacing, padL) => {
        const points = entries.map((e, i) => ({
          x: padL + i * spacing,
          y: padT + innerH - ((e.sleep_hours - yMin) / (yMax - yMin)) * innerH,
          entry: e,
        }));
        const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
        const labelStep = Math.max(1, Math.ceil(40 / spacing));
        return (
          <>
            <polyline
              points={polyline}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p) => {
              const isHl = p.entry.date === highlightDate;
              return (
                <g key={p.entry.id}>
                  {isHl && <circle cx={p.x} cy={p.y} r="8" fill="#2563eb" opacity="0.2" />}
                  <circle cx={p.x} cy={p.y} r={isHl ? 5 : 4} fill="#2563eb" />
                  <circle cx={p.x} cy={p.y} r="2" fill="white" />
                  {(entries.length === 1 || isHl) && (
                    <text
                      x={p.x}
                      y={p.y - 10}
                      textAnchor="middle"
                      fill="#2563eb"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="var(--font-mono)"
                    >
                      {p.entry.sleep_hours}
                    </text>
                  )}
                </g>
              );
            })}
            {points.map((p, i) => {
              if (i % labelStep !== 0 && i !== entries.length - 1) return null;
              const d = new Date(p.entry.date + 'T00:00:00');
              const label = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
              return (
                <text
                  key={p.entry.id}
                  x={p.x}
                  y={chartH - 3}
                  textAnchor="middle"
                  className="text-text-secondary"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                >
                  {label}
                </text>
              );
            })}
          </>
        );
      }}
    </InteractiveChart>
  );
}
