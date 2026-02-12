import { useMemo, useState } from 'react';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { createTrainingLog, getTrainingLogs } from '../api/endpoints';
import { mockTrainingLogs } from '../api/mock';
import type { TrainingLog as TrainingLogType, TrainingLogCreate } from '../types';

const TRAINING_TYPES = ['sparring', 'technique', 'cardio', 'strength', 'flexibility', 'poomsae'];
const INTENSITIES = ['low', 'medium', 'high'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const INTENSITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export default function TrainingLogPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showForm, setShowForm] = useState(false);

  const { data: logs, loading, refetch } = useApi<TrainingLogType[]>(
    () => getTrainingLogs({ month, year }),
    mockTrainingLogs,
    [month, year],
  );

  const logDates = useMemo(() => {
    const set = new Set<number>();
    if (logs) {
      logs.forEach((log) => {
        const d = new Date(log.date);
        if (d.getFullYear() === year && d.getMonth() + 1 === month) {
          set.add(d.getDate());
        }
      });
    }
    return set;
  }, [logs, year, month]);

  const stats = useMemo(() => {
    if (!logs || logs.length === 0) return null;
    const totalSessions = logs.length;
    const totalMinutes = logs.reduce((s, l) => s + l.duration_minutes, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    // Average intensity: low=1, medium=2, high=3
    const intensityMap: Record<string, number> = { low: 1, medium: 2, high: 3 };
    const avgIntensityNum = logs.reduce((s, l) => s + (intensityMap[l.intensity] || 2), 0) / totalSessions;
    let avgIntensity = 'Medium';
    if (avgIntensityNum < 1.5) avgIntensity = 'Low';
    else if (avgIntensityNum > 2.5) avgIntensity = 'High';
    return { totalSessions, totalHours, avgIntensity };
  }, [logs]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  return (
    <div className="relative min-h-screen pb-20">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-text">
          Training Log
        </h1>
      </div>

      {/* Calendar */}
      <div className="px-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="text-lg border-none bg-transparent cursor-pointer px-2 text-accent">‹</button>
            <span className="font-semibold text-sm text-text">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="text-lg border-none bg-transparent cursor-pointer px-2 text-accent">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <div key={d} className="py-1 font-medium text-text-secondary">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const hasLog = logDates.has(day);
              const isToday = isCurrentMonth && day === today;
              return (
                <div
                  key={day}
                  className={`py-1.5 rounded-lg relative text-xs ${
                    isToday ? 'bg-accent text-white font-bold' : 'text-text'
                  }`}
                >
                  {day}
                  {hasLog && (
                    <div
                      className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                        isToday ? 'bg-white' : 'bg-green-500'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Monthly stats */}
      {stats && (
        <div className="px-4">
          <Card>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Month Summary</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-accent-light rounded-xl py-3">
                <p className="text-xl font-bold text-accent">{stats.totalSessions}</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Sessions</p>
              </div>
              <div className="bg-accent-light rounded-xl py-3">
                <p className="text-xl font-bold text-accent">{stats.totalHours}</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Hours</p>
              </div>
              <div className="bg-accent-light rounded-xl py-3">
                <p className="text-xl font-bold text-accent">{stats.avgIntensity}</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Avg Intensity</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Log list */}
      <div className="px-4">
        <h3 className="text-sm font-semibold text-text-secondary mb-2">Recent Sessions</h3>
        {loading ? (
          <LoadingSpinner />
        ) : !logs || logs.length === 0 ? (
          <EmptyState icon="🥋" title="No training logs" description="Tap + to add your first entry" />
        ) : (
          logs.map((log) => (
            <Card key={log.id}>
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${
                    log.intensity === 'high' ? 'bg-red-50 text-red-500' :
                    log.intensity === 'medium' ? 'bg-amber-50 text-amber-500' :
                    'bg-green-50 text-green-500'
                  }`}>
                    {log.type === 'sparring' ? '🥊' :
                     log.type === 'technique' ? '🥋' :
                     log.type === 'cardio' ? '🏃' :
                     log.type === 'strength' ? '💪' :
                     log.type === 'flexibility' ? '🧘' :
                     log.type === 'poomsae' ? '🎯' : '📝'}
                  </div>
                  <div>
                    <p className="font-semibold text-sm capitalize text-text">
                      {log.type}
                    </p>
                    <p className="text-xs mt-0.5 text-text-secondary">
                      {log.date} · {log.duration_minutes} min · {INTENSITY_LABELS[log.intensity] || log.intensity}
                    </p>
                  </div>
                </div>
                {log.weight && (
                  <span className="text-xs font-medium text-text-secondary bg-bg-secondary px-2 py-0.5 rounded-full">
                    {log.weight} kg
                  </span>
                )}
              </div>
              {log.notes && (
                <p className="text-xs mt-2 text-text ml-12">{log.notes}</p>
              )}
              {log.coach_comment && (
                <p className="text-xs mt-1 italic text-accent ml-12">
                  Coach: {log.coach_comment}
                </p>
              )}
            </Card>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl border-none cursor-pointer bg-accent text-white shadow-lg shadow-accent/30 active:scale-95 transition-transform z-40"
      >
        +
      </button>

      {/* Add form modal */}
      {showForm && (
        <TrainingForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); }}
        />
      )}
    </div>
  );
}

function TrainingForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<TrainingLogCreate>({
    date: new Date().toISOString().slice(0, 10),
    type: 'sparring',
    duration_minutes: 60,
    intensity: 'medium',
    weight: null,
    notes: null,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createTrainingLog(form);
      onSaved();
    } catch {
      onSaved();
    }
  };

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="w-full rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-text">Add Training</h2>
          <button onClick={onClose} className="text-2xl border-none bg-transparent cursor-pointer text-muted">×</button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-gray-200 bg-white text-text outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Type</span>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-gray-200 bg-white text-text outline-none"
            >
              {TRAINING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Duration (min)</span>
            <input
              type="number"
              value={form.duration_minutes}
              onChange={(e) => update('duration_minutes', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-gray-200 bg-white text-text outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Intensity</span>
            <select
              value={form.intensity}
              onChange={(e) => update('intensity', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-gray-200 bg-white text-text outline-none"
            >
              {INTENSITIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Weight (kg)</span>
            <input
              type="number"
              step="0.1"
              value={form.weight ?? ''}
              onChange={(e) => update('weight', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-gray-200 bg-white text-text outline-none"
              placeholder="Optional"
            />
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Notes</span>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => update('notes', e.target.value || null)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-gray-200 bg-white text-text outline-none resize-none"
              rows={3}
              placeholder="Optional"
            />
          </label>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
