import { useCallback, useMemo, useState } from 'react';
import BottomSheet from '../components/BottomSheet';
import PullToRefresh from '../components/PullToRefresh';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useTelegram } from '../hooks/useTelegram';
import { useI18n } from '../i18n/I18nProvider';
import {
  mockWeightEntries,
  addMockWeightEntry,
  deleteMockWeightEntry,
} from '../api/mock';
import type { WeightEntry } from '../types';

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
  const [showForm, setShowForm] = useState(false);
  const [entries, setEntries] = useState<WeightEntry[]>(mockWeightEntries);
  const reload = useCallback(() => setEntries([...mockWeightEntries]), []);

  const weightDates = useMemo(() => {
    const map = new Map<string, WeightEntry>();
    if (entries) {
      entries.forEach((e) => map.set(e.date, e));
    }
    return map;
  }, [entries]);

  const monthEntries = useMemo(() => {
    if (!entries) return [];
    return entries
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, year, month]);

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
    setSelectedDate(dateStr);
    setShowForm(true);
  };

  return (
    <PullToRefresh onRefresh={reload}>
      <div className="relative">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-3xl font-heading text-text-heading">
            {t('health.title')}
          </h1>
        </div>

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
                const hasEntry = weightDates.has(dateStr);
                const isToday = isCurrentMonth && day === today;
                const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1) || (isCurrentMonth && day > today);
                return (
                  <div
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`py-1.5 rounded-lg relative text-xs transition-colors ${
                      isFuture
                        ? 'text-text-disabled cursor-default'
                        : isToday
                          ? 'bg-accent text-white font-bold cursor-pointer'
                          : 'text-text cursor-pointer hover:bg-bg-secondary'
                    }`}
                  >
                    {day}
                    {hasEntry && (
                      <div
                        className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                          isToday ? 'bg-white' : 'bg-accent'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Weight Chart */}
        <div className="px-4">
          <Card>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
              {t('health.weightChart')}
            </h3>
            {monthEntries.length === 0 ? (
              <EmptyState title={t('health.noData')} description={t('health.noDataDesc')} />
            ) : (
              <WeightChart entries={monthEntries} />
            )}
          </Card>
        </div>

        {/* Weight Form BottomSheet */}
        {showForm && selectedDate && (
          <WeightForm
            date={selectedDate}
            existing={weightDates.get(selectedDate) || null}
            onClose={() => { setShowForm(false); setSelectedDate(null); }}
            onSaved={() => {
              setShowForm(false);
              setSelectedDate(null);
              reload();
            }}
          />
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

  const handleSave = () => {
    const val = parseFloat(weight);
    if (!val || val <= 0) return;
    setSaving(true);
    addMockWeightEntry(date, val);
    hapticNotification('success');
    showToast(t('health.weightSaved'), 'success');
    onSaved();
  };

  const handleDelete = () => {
    if (!existing) return;
    setDeleting(true);
    deleteMockWeightEntry(existing.id);
    hapticNotification('success');
    onSaved();
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

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const { t } = useI18n();

  if (entries.length < 2) {
    const entry = entries[0];
    return (
      <div className="flex items-center justify-center py-6">
        <span className="text-2xl font-mono font-bold text-accent">{entry.weight_kg}</span>
        <span className="text-sm text-text-secondary ml-1">{t('health.kg')}</span>
      </div>
    );
  }

  const weights = entries.map((e) => e.weight_kg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const padding = Math.max((maxW - minW) * 0.2, 0.5);
  const yMin = minW - padding;
  const yMax = maxW + padding;

  const chartW = 320;
  const chartH = 140;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 25;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const points = entries.map((e, i) => {
    const x = padL + (entries.length === 1 ? innerW / 2 : (i / (entries.length - 1)) * innerW);
    const y = padT + innerH - ((e.weight_kg - yMin) / (yMax - yMin)) * innerH;
    return { x, y, entry: e };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Y-axis labels: min, mid, max
  const yMid = (yMin + yMax) / 2;
  const yLabels = [
    { value: yMax, y: padT },
    { value: yMid, y: padT + innerH / 2 },
    { value: yMin, y: padT + innerH },
  ];

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yLabels.map((label) => (
        <line
          key={label.value}
          x1={padL}
          y1={label.y}
          x2={chartW - padR}
          y2={label.y}
          stroke="currentColor"
          className="text-border"
          strokeWidth="0.5"
          strokeDasharray="3,3"
        />
      ))}

      {/* Y-axis labels */}
      {yLabels.map((label) => (
        <text
          key={label.value}
          x={padL - 5}
          y={label.y + 3}
          textAnchor="end"
          className="text-text-secondary"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          {label.value.toFixed(1)}
        </text>
      ))}

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="#D4AF37"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p) => (
        <g key={p.entry.id}>
          <circle cx={p.x} cy={p.y} r="4" fill="#D4AF37" />
          <circle cx={p.x} cy={p.y} r="2" fill="white" />
        </g>
      ))}

      {/* X-axis date labels */}
      {points.map((p, i) => {
        // Show label for first, last, and if many entries skip some
        if (entries.length > 5 && i !== 0 && i !== entries.length - 1 && i % 2 !== 0) return null;
        const day = new Date(p.entry.date).getDate();
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
            {day}
          </text>
        );
      })}
    </svg>
  );
}
