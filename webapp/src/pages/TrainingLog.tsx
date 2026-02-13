import { useMemo, useState } from 'react';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import {
  createTrainingLog,
  deleteTrainingLog,
  getTrainingLogs,
  getTrainingStats,
  updateTrainingLog,
} from '../api/endpoints';
import { mockTrainingLogs, mockTrainingStats } from '../api/mock';
import type {
  TrainingLog as TrainingLogType,
  TrainingLogCreate,
  TrainingLogStats,
  TrainingLogUpdate,
} from '../types';

const TRAINING_TYPES = ['sparring', 'technique', 'cardio', 'strength', 'flexibility', 'poomsae'];
const INTENSITIES = ['low', 'medium', 'high'];

/* ---- SVG icons for training types (Lucide-style, 16x16) ---- */

function TrainingTypeIcon({ type }: { type: string }) {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'sparring': // shield
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case 'technique': // target
      return <svg {...props}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case 'cardio': // activity pulse
      return <svg {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
    case 'strength': // zap
      return <svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
    case 'flexibility': // wind
      return <svg {...props}><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" /><path d="M9.6 4.6A2 2 0 1 1 11 8H2" /><path d="M12.6 19.4A2 2 0 1 0 14 16H2" /></svg>;
    case 'poomsae': // grid
      return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
    default: // file-text
      return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>;
  }
}

const INTENSITY_STYLES: Record<string, string> = {
  high: 'bg-rose-50/60 text-rose-700',
  medium: 'bg-amber-50/60 text-amber-700',
  low: 'bg-slate-50 text-slate-500',
};

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
  const [editingLog, setEditingLog] = useState<TrainingLogType | null>(null);

  const { data: logs, loading, refetch } = useApi<TrainingLogType[]>(
    () => getTrainingLogs({ month, year }),
    mockTrainingLogs,
    [month, year],
  );

  const { data: stats } = useApi<TrainingLogStats>(
    () => getTrainingStats({ month, year }),
    mockTrainingStats,
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

  const handleDelete = async (logId: string) => {
    try {
      await deleteTrainingLog(logId);
      refetch();
    } catch {
      // ignore
    }
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

      {/* Monthly stats */}
      {stats && stats.total_sessions > 0 && (
        <div className="px-4">
          <Card>
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Month Summary</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-accent-light rounded-xl py-3">
                <p className="text-xl font-bold text-accent">{stats.total_sessions}</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Sessions</p>
              </div>
              <div className="bg-accent-light rounded-xl py-3">
                <p className="text-xl font-bold text-accent">{(stats.total_minutes / 60).toFixed(1)}</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Hours</p>
              </div>
              <div className="bg-accent-light rounded-xl py-3">
                <p className="text-xl font-bold text-accent capitalize">{stats.avg_intensity}</p>
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
          <EmptyState title="No training logs" description="Tap + to add your first entry" />
        ) : (
          logs.map((log) => (
            <Card key={log.id}>
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${INTENSITY_STYLES[log.intensity] || INTENSITY_STYLES.low}`}>
                    <TrainingTypeIcon type={log.type} />
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
                <div className="flex items-center gap-2">
                  {log.weight && (
                    <span className="text-xs font-medium text-text-secondary bg-bg-secondary px-2 py-0.5 rounded-full">
                      {log.weight} kg
                    </span>
                  )}
                  <button
                    onClick={() => setEditingLog(log)}
                    className="text-xs border-none bg-transparent cursor-pointer text-accent px-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(log.id)}
                    className="text-xs border-none bg-transparent cursor-pointer text-rose-500 px-1"
                  >
                    Del
                  </button>
                </div>
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

      {/* Edit form modal */}
      {editingLog && (
        <TrainingEditForm
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSaved={() => { setEditingLog(null); refetch(); }}
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
      <div className="w-full rounded-t-2xl bottom-sheet flex flex-col overflow-hidden bg-white">
        <div className="flex justify-between items-center p-4 pb-2 shrink-0">
          <h2 className="text-lg font-bold text-text">Add Training</h2>
          <button onClick={onClose} className="text-2xl border-none bg-transparent cursor-pointer text-muted">×</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-3">
          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Type</span>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
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
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Intensity</span>
            <select
              value={form.intensity}
              onChange={(e) => update('intensity', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
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
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
              placeholder="Optional"
            />
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Notes</span>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => update('notes', e.target.value || null)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none resize-none"
              rows={3}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="p-4 pt-2 shrink-0 bottom-sheet-footer">
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

function TrainingEditForm({
  log,
  onClose,
  onSaved,
}: {
  log: TrainingLogType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TrainingLogUpdate>({
    date: log.date,
    type: log.type,
    duration_minutes: log.duration_minutes,
    intensity: log.intensity,
    weight: log.weight,
    notes: log.notes,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await updateTrainingLog(log.id, form);
      onSaved();
    } catch {
      onSaved();
    }
  };

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="w-full rounded-t-2xl bottom-sheet flex flex-col overflow-hidden bg-white">
        <div className="flex justify-between items-center p-4 pb-2 shrink-0">
          <h2 className="text-lg font-bold text-text">Edit Training</h2>
          <button onClick={onClose} className="text-2xl border-none bg-transparent cursor-pointer text-muted">×</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-3">
          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Date</span>
            <input
              type="date"
              value={form.date ?? ''}
              onChange={(e) => update('date', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Type</span>
            <select
              value={form.type ?? ''}
              onChange={(e) => update('type', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
            >
              {TRAINING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Duration (min)</span>
            <input
              type="number"
              value={form.duration_minutes ?? 0}
              onChange={(e) => update('duration_minutes', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Intensity</span>
            <select
              value={form.intensity ?? ''}
              onChange={(e) => update('intensity', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
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
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none"
              placeholder="Optional"
            />
          </label>

          <label className="block">
            <span className="text-xs mb-1 block text-text-secondary">Notes</span>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => update('notes', e.target.value || null)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-white text-text outline-none resize-none"
              rows={3}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="p-4 pt-2 shrink-0 bottom-sheet-footer">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
