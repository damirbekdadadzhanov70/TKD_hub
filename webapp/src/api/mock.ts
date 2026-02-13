import type {
  CoachAthlete,
  CoachEntry,
  MeResponse,
  RatingEntry,
  TournamentDetail,
  TournamentListItem,
  TrainingLog,
  TrainingLogCreate,
  TrainingLogStats,
  TrainingLogUpdate,
} from '../types';

// ── localStorage helpers ────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`tkd_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`tkd_${key}`, JSON.stringify(data));
  } catch { /* quota exceeded — ignore */ }
}

// ── Profile ─────────────────────────────────────────────────

const defaultMe: MeResponse = {
  telegram_id: 123456789,
  username: 'damir_tkd',
  language: 'ru',
  role: 'athlete',
  athlete: {
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Alikhanov Damir',
    date_of_birth: '2000-05-15',
    gender: 'M',
    weight_category: '-68kg',
    current_weight: 67.5,
    belt: '2 Dan',
    country: 'Kyrgyzstan',
    city: 'Bishkek',
    club: 'TKD Academy',
    photo_url: null,
    rating_points: 1250,
  },
  coach: {
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Alikhanov Damir',
    date_of_birth: '2000-05-15',
    gender: 'M',
    country: 'Kyrgyzstan',
    city: 'Bishkek',
    club: 'TKD Academy',
    qualification: '4 Dan, International Coach',
    photo_url: null,
    is_verified: true,
  },
};

export let mockMe: MeResponse = load('me', defaultMe);

export function updateMockMe(data: MeResponse) {
  mockMe = data;
  save('me', mockMe);
}

// ── Tournaments ─────────────────────────────────────────────

export const mockTournaments: TournamentListItem[] = [
  {
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Central Asian Open Championship 2026',
    start_date: '2026-04-15',
    end_date: '2026-04-17',
    city: 'Almaty',
    country: 'Kazakhstan',
    status: 'upcoming',
    importance_level: 3,
    entry_count: 148,
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Bishkek Cup 2026',
    start_date: '2026-03-10',
    end_date: '2026-03-11',
    city: 'Bishkek',
    country: 'Kyrgyzstan',
    status: 'upcoming',
    importance_level: 2,
    entry_count: 72,
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    name: 'Silk Road Taekwondo Open',
    start_date: '2026-02-20',
    end_date: '2026-02-22',
    city: 'Tashkent',
    country: 'Uzbekistan',
    status: 'ongoing',
    importance_level: 3,
    entry_count: 186,
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    name: 'Tashkent International',
    start_date: '2026-01-18',
    end_date: '2026-01-20',
    city: 'Tashkent',
    country: 'Uzbekistan',
    status: 'completed',
    importance_level: 3,
    entry_count: 210,
  },
  {
    id: '00000000-0000-0000-0000-000000000014',
    name: 'Ashgabat National Cup',
    start_date: '2025-12-05',
    end_date: '2025-12-06',
    city: 'Ashgabat',
    country: 'Turkmenistan',
    status: 'completed',
    importance_level: 1,
    entry_count: 54,
  },
];

export const mockTournamentDetail: TournamentDetail = {
  ...mockTournaments[0],
  description: 'The premier annual Central Asian Open Championship featuring athletes from 10+ countries across all age and weight categories.',
  venue: 'Almaty Arena',
  age_categories: ['Cadets (12-14)', 'Juniors (15-17)', 'Seniors (18+)'],
  weight_categories: ['-54kg', '-58kg', '-63kg', '-68kg', '-74kg', '-80kg', '-87kg', '+87kg'],
  entry_fee: 50,
  currency: 'USD',
  registration_deadline: '2026-04-01',
  organizer_contact: 'info@centralasiatkd.org',
  entries: [
    { id: '00000000-0000-0000-0000-000000000020', athlete_name: 'Alikhanov Damir', weight_category: '-68kg', age_category: 'Seniors', status: 'approved' },
    { id: '00000000-0000-0000-0000-000000000021', athlete_name: 'Asanov Timur', weight_category: '-74kg', age_category: 'Seniors', status: 'pending' },
    { id: '00000000-0000-0000-0000-000000000022', athlete_name: 'Kim Sergei', weight_category: '-68kg', age_category: 'Seniors', status: 'approved' },
    { id: '00000000-0000-0000-0000-000000000023', athlete_name: 'Ibraimova Asel', weight_category: '-57kg', age_category: 'Seniors', status: 'approved' },
  ],
};

// ── Training Logs ───────────────────────────────────────────

const defaultTrainingLogs: TrainingLog[] = [
  { id: '00000000-0000-0000-0000-000000000030', date: '2026-02-12', type: 'sparring', duration_minutes: 90, intensity: 'high', weight: 67.8, notes: 'Worked on roundhouse kick combos and counterattacks', coach_comment: null },
  { id: '00000000-0000-0000-0000-000000000031', date: '2026-02-11', type: 'technique', duration_minutes: 60, intensity: 'medium', weight: 67.5, notes: 'Poomsae Koryo and Keumgang practice', coach_comment: 'Good progress on Koryo, work on stances in Keumgang' },
  { id: '00000000-0000-0000-0000-000000000032', date: '2026-02-10', type: 'cardio', duration_minutes: 45, intensity: 'high', weight: 68.0, notes: '400m intervals x8, 1 min rest between sets', coach_comment: null },
  { id: '00000000-0000-0000-0000-000000000033', date: '2026-02-08', type: 'strength', duration_minutes: 60, intensity: 'medium', weight: 67.6, notes: 'Squats, lunges, box jumps — lower body focus', coach_comment: null },
  { id: '00000000-0000-0000-0000-000000000034', date: '2026-02-07', type: 'flexibility', duration_minutes: 40, intensity: 'low', weight: 67.4, notes: 'Full split stretching routine, hip openers', coach_comment: null },
  { id: '00000000-0000-0000-0000-000000000035', date: '2026-02-05', type: 'sparring', duration_minutes: 75, intensity: 'high', weight: 67.9, notes: '3-round matches with Timur and Sergei', coach_comment: 'Great head kick timing, keep working on clinch defense' },
  { id: '00000000-0000-0000-0000-000000000036', date: '2026-02-03', type: 'poomsae', duration_minutes: 50, intensity: 'medium', weight: null, notes: 'Competition poomsae run-throughs', coach_comment: null },
];

export let mockTrainingLogs: TrainingLog[] = load('training_logs', defaultTrainingLogs);

function recalcStats(): TrainingLogStats {
  const logs = mockTrainingLogs;
  if (logs.length === 0) return { total_sessions: 0, total_minutes: 0, avg_intensity: 'low', training_days: 0 };
  const total_minutes = logs.reduce((s, l) => s + l.duration_minutes, 0);
  const intensityScore = logs.reduce((s, l) => s + (l.intensity === 'high' ? 3 : l.intensity === 'medium' ? 2 : 1), 0);
  const avg = intensityScore / logs.length;
  const avg_intensity = avg >= 2.5 ? 'high' : avg >= 1.5 ? 'medium' : 'low';
  return { total_sessions: logs.length, total_minutes, avg_intensity, training_days: new Set(logs.map(l => l.date)).size };
}

export let mockTrainingStats: TrainingLogStats = load('training_stats', recalcStats());

function saveTrainingData() {
  save('training_logs', mockTrainingLogs);
  mockTrainingStats = recalcStats();
  save('training_stats', mockTrainingStats);
}

let nextLogId = 100;

export function addMockTrainingLog(data: TrainingLogCreate): TrainingLog {
  const log: TrainingLog = { ...data, weight: data.weight ?? null, notes: data.notes ?? null, id: `mock-${Date.now()}-${nextLogId++}`, coach_comment: null };
  mockTrainingLogs = [log, ...mockTrainingLogs];
  saveTrainingData();
  return log;
}

export function updateMockTrainingLog(id: string, data: TrainingLogUpdate): TrainingLog | null {
  let updated: TrainingLog | null = null;
  mockTrainingLogs = mockTrainingLogs.map(l => {
    if (l.id === id) { updated = { ...l, ...data }; return updated; }
    return l;
  });
  saveTrainingData();
  return updated;
}

export function deleteMockTrainingLog(id: string) {
  mockTrainingLogs = mockTrainingLogs.filter(l => l.id !== id);
  saveTrainingData();
}

// ── Ratings ─────────────────────────────────────────────────

export const mockRatings: RatingEntry[] = [
  { rank: 1, athlete_id: '00000000-0000-0000-0000-000000000040', full_name: 'Kim Sergei', country: 'Kazakhstan', city: 'Almaty', club: 'Tiger Dojang', weight_category: '-68kg', belt: '3 Dan', rating_points: 2100, photo_url: null },
  { rank: 2, athlete_id: '00000000-0000-0000-0000-000000000041', full_name: 'Rakhimov Otabek', country: 'Uzbekistan', city: 'Tashkent', club: 'Samarkand TKD', weight_category: '-68kg', belt: '2 Dan', rating_points: 1800, photo_url: null },
  { rank: 3, athlete_id: '00000000-0000-0000-0000-000000000001', full_name: 'Alikhanov Damir', country: 'Kyrgyzstan', city: 'Bishkek', club: 'TKD Academy', weight_category: '-68kg', belt: '2 Dan', rating_points: 1250, photo_url: null },
  { rank: 4, athlete_id: '00000000-0000-0000-0000-000000000042', full_name: 'Niyazov Ruslan', country: 'Turkmenistan', city: 'Ashgabat', club: 'Turkmen Fighters', weight_category: '-68kg', belt: '1 Dan', rating_points: 950, photo_url: null },
  { rank: 5, athlete_id: '00000000-0000-0000-0000-000000000043', full_name: 'Toktosunov Adilet', country: 'Kyrgyzstan', city: 'Osh', club: 'Osh Warriors', weight_category: '-68kg', belt: '1 Dan', rating_points: 820, photo_url: null },
  { rank: 6, athlete_id: '00000000-0000-0000-0000-000000000044', full_name: 'Omarov Beibit', country: 'Kazakhstan', city: 'Astana', club: 'Nomad TKD', weight_category: '-68kg', belt: '2 Dan', rating_points: 740, photo_url: null },
  { rank: 7, athlete_id: '00000000-0000-0000-0000-000000000045', full_name: 'Ismoilov Farrukh', country: 'Uzbekistan', city: 'Bukhara', club: null, weight_category: '-68kg', belt: '1 Dan', rating_points: 680, photo_url: null },
];

// ── Coach ───────────────────────────────────────────────────

export const mockCoachAthletes: CoachAthlete[] = [
  { id: '00000000-0000-0000-0000-000000000001', full_name: 'Alikhanov Damir', weight_category: '-68kg', belt: '2 Dan', rating_points: 1250, club: 'TKD Academy' },
  { id: '00000000-0000-0000-0000-000000000046', full_name: 'Ibraimova Asel', weight_category: '-57kg', belt: '1 Dan', rating_points: 780, club: 'TKD Academy' },
  { id: '00000000-0000-0000-0000-000000000047', full_name: 'Bekov Azamat', weight_category: '-63kg', belt: '1 Gup', rating_points: 340, club: 'TKD Academy' },
];

export const mockCoachEntries: CoachEntry[] = [
  { id: '00000000-0000-0000-0000-000000000050', tournament_id: '00000000-0000-0000-0000-000000000010', tournament_name: 'Central Asian Open Championship 2026', athlete_id: '00000000-0000-0000-0000-000000000001', athlete_name: 'Alikhanov Damir', weight_category: '-68kg', age_category: 'Seniors', status: 'approved' },
  { id: '00000000-0000-0000-0000-000000000051', tournament_id: '00000000-0000-0000-0000-000000000010', tournament_name: 'Central Asian Open Championship 2026', athlete_id: '00000000-0000-0000-0000-000000000046', athlete_name: 'Ibraimova Asel', weight_category: '-57kg', age_category: 'Seniors', status: 'pending' },
];
