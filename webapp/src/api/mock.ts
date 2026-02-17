import type {
  AdminUserDetail,
  AdminUserItem,
  AthleteRegistration,
  CoachAthlete,
  CoachEntry,
  CoachRegistration,
  CoachSearchResult,
  MeResponse,
  MyCoachLink,
  PendingAthleteRequest,
  ProfileStats,
  RatingEntry,
  RoleRequestItem,
  TournamentCreate,
  TournamentDetail,
  TournamentEntry,
  TournamentListItem,
  TournamentResult,
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
  role: 'admin',
  is_admin: true,
  athlete: {
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Alikhanov Damir',
    date_of_birth: '2000-05-15',
    gender: 'M',
    weight_category: '-68kg',
    current_weight: 67.5,
    sport_rank: 'КМС',
    country: 'Россия',
    city: 'Москва',
    club: 'TKD Academy',
    photo_url: null,
    rating_points: 1250,
  },
  coach: {
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Alikhanov Damir',
    date_of_birth: '2000-05-15',
    gender: 'M',
    country: 'Россия',
    city: 'Москва',
    club: 'TKD Academy',
    qualification: '4 Dan, International Coach',
    photo_url: null,
    is_verified: true,
  },
};

const newUserMe: MeResponse = {
  telegram_id: 123456789,
  username: 'damir_tkd',
  language: 'ru',
  role: 'none',
  is_admin: false,
  athlete: null,
  coach: null,
};

// If no stored profile → new user (onboarding required)
// If stored → merge with defaults for schema evolution
const hasStored = !!localStorage.getItem('tkd_me');
const storedMe = load('me', defaultMe);
export let mockMe: MeResponse = hasStored
  ? {
      ...defaultMe,
      ...storedMe,
      athlete: storedMe.athlete || defaultMe.athlete,
      coach: storedMe.coach || defaultMe.coach,
    }
  : newUserMe;

export function updateMockMe(data: MeResponse) {
  mockMe = data;
  save('me', mockMe);
}

export function deleteMockAccount() {
  mockMe = { ...newUserMe };
  // Clear all tkd_* keys from localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('tkd_')) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export function registerMockProfile(
  role: 'athlete' | 'coach',
  data: AthleteRegistration | CoachRegistration,
): MeResponse {
  if (role === 'athlete') {
    const reg = data as AthleteRegistration;
    const athlete = {
      id: '00000000-0000-0000-0000-000000000001',
      full_name: reg.full_name,
      date_of_birth: reg.date_of_birth,
      gender: reg.gender,
      weight_category: reg.weight_category,
      current_weight: reg.current_weight,
      sport_rank: reg.sport_rank,
      country: 'Россия',
      city: reg.city,
      club: reg.club || null,
      photo_url: null,
      rating_points: 0,
    };
    const updated: MeResponse = { ...mockMe, role: 'athlete', is_admin: mockMe.is_admin, athlete, coach: null };
    updateMockMe(updated);
    return updated;
  }

  const reg = data as CoachRegistration;
  const coach = {
    id: '00000000-0000-0000-0000-000000000002',
    full_name: reg.full_name,
    date_of_birth: reg.date_of_birth,
    gender: reg.gender,
    country: 'Россия',
    city: reg.city,
    club: reg.club,
    qualification: reg.sport_rank || 'Не указано',
    photo_url: null,
    is_verified: false,
  };
  const updated: MeResponse = { ...mockMe, role: 'coach', is_admin: mockMe.is_admin, athlete: null, coach };
  updateMockMe(updated);
  return updated;
}

// ── Role Management ────────────────────────────────────────

export function switchMockRole(role: MeResponse['role']): MeResponse {
  const updated = { ...mockMe, role };
  updateMockMe(updated);
  return updated;
}

export let mockRoleRequests: RoleRequestItem[] = [
  {
    id: 'mock-rr-1',
    user_id: 'mock-user-1',
    username: 'ivan_tkd',
    requested_role: 'coach',
    status: 'pending',
    data: {
      full_name: 'Иванов Иван',
      date_of_birth: '1990-05-20',
      gender: 'M',
      sport_rank: 'МС',
      city: 'Казань',
      club: 'Казань TKD',
    },
    created_at: '2026-02-15T10:00:00',
  },
];

export function approveMockRoleRequest(id: string) {
  mockRoleRequests = mockRoleRequests.filter((r) => r.id !== id);
}

export function rejectMockRoleRequest(id: string) {
  mockRoleRequests = mockRoleRequests.filter((r) => r.id !== id);
}

// ── Admin Users ─────────────────────────────────────────────

export let mockAdminUsers: AdminUserItem[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    telegram_id: 123456789,
    username: 'damir_tkd',
    role: 'admin',
    full_name: 'Alikhanov Damir',
    city: 'Москва',
    created_at: '2026-01-01T00:00:00',
  },
  {
    id: 'mock-user-1',
    telegram_id: 111111111,
    username: 'ivan_tkd',
    role: 'coach',
    full_name: 'Иванов Иван',
    city: 'Казань',
    created_at: '2026-01-15T10:00:00',
  },
  {
    id: 'mock-user-2',
    telegram_id: 222222222,
    username: 'sergei_k',
    role: 'athlete',
    full_name: 'Ким Сергей',
    city: 'Москва',
    created_at: '2026-02-01T12:00:00',
  },
];

export function deleteMockAdminUser(userId: string) {
  mockAdminUsers = mockAdminUsers.filter((u) => u.id !== userId);
}

export function getMockAdminUserDetail(userId: string): AdminUserDetail | null {
  const user = mockAdminUsers.find((u) => u.id === userId);
  if (!user) return null;

  // Build detail from list item + mockMe if it's the current user
  const isSelf = user.telegram_id === mockMe.telegram_id;
  return {
    id: user.id,
    telegram_id: user.telegram_id,
    username: user.username,
    role: user.role,
    is_admin: user.role === 'admin',
    athlete: isSelf ? mockMe.athlete : (user.role === 'athlete' ? {
      id: user.id,
      full_name: user.full_name || 'Unknown',
      date_of_birth: '2000-01-01',
      gender: 'M',
      weight_category: '-68kg',
      current_weight: 68,
      sport_rank: 'КМС',
      country: 'Россия',
      city: user.city || 'Москва',
      club: null,
      photo_url: null,
      rating_points: 0,
    } : null),
    coach: isSelf ? mockMe.coach : (user.role === 'coach' ? {
      id: user.id,
      full_name: user.full_name || 'Unknown',
      date_of_birth: '1990-01-01',
      gender: 'M',
      country: 'Россия',
      city: user.city || 'Москва',
      club: 'Club',
      qualification: 'Не указано',
      photo_url: null,
      is_verified: false,
    } : null),
    created_at: user.created_at,
    stats: { tournaments_count: 0, medals_count: 0 },
  };
}

// ── Profile Stats ───────────────────────────────────────────

export const mockProfileStats: ProfileStats = {
  tournaments_count: 4,
  medals_count: 2,
  users_count: 7,
  tournaments_total: 5,
  tournament_history: [
    { place: 3, tournament_name: 'Первенство Нижнего Новгорода', tournament_date: '2026-01-18' },
    { place: 1, tournament_name: 'Турнир Дагестана', tournament_date: '2025-12-05' },
  ],
};

// ── Tournaments ─────────────────────────────────────────────

export const mockTournaments: TournamentListItem[] = [
  {
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Кубок России по тхэквондо 2026',
    start_date: '2026-04-15',
    end_date: '2026-04-17',
    city: 'Москва',
    country: 'Россия',
    status: 'upcoming',
    importance_level: 3,
    entry_count: 148,
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Открытый турнир Санкт-Петербурга',
    start_date: '2026-03-10',
    end_date: '2026-03-11',
    city: 'Санкт-Петербург',
    country: 'Россия',
    status: 'upcoming',
    importance_level: 2,
    entry_count: 72,
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    name: 'Кубок Казани',
    start_date: '2026-02-20',
    end_date: '2026-02-22',
    city: 'Казань',
    country: 'Россия',
    status: 'ongoing',
    importance_level: 3,
    entry_count: 186,
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    name: 'Первенство Нижнего Новгорода',
    start_date: '2026-01-18',
    end_date: '2026-01-20',
    city: 'Нижний Новгород',
    country: 'Россия',
    status: 'completed',
    importance_level: 3,
    entry_count: 210,
  },
  {
    id: '00000000-0000-0000-0000-000000000014',
    name: 'Турнир Дагестана',
    start_date: '2025-12-05',
    end_date: '2025-12-06',
    city: 'Махачкала',
    country: 'Россия',
    status: 'completed',
    importance_level: 1,
    entry_count: 54,
  },
];

// Map of tournament ID → TournamentDetail for full detail views
const mockTournamentDetailsMap = new Map<string, TournamentDetail>();

// Pre-populate first tournament with rich detail
mockTournamentDetailsMap.set('00000000-0000-0000-0000-000000000010', {
  ...mockTournaments[0],
  description: 'Ежегодный Кубок России по тхэквондо среди всех возрастных и весовых категорий.',
  venue: 'Дворец единоборств',
  age_categories: ['Cadets (12-14)', 'Juniors (15-17)', 'Seniors (18+)'],
  weight_categories: ['-54kg', '-58kg', '-63kg', '-68kg', '-74kg', '-80kg', '-87kg', '+87kg'],
  entry_fee: 3000,
  currency: 'RUB',
  registration_deadline: '2026-04-01',
  organizer_contact: 'info@russiantkd.ru',
  entries: [
    { id: '00000000-0000-0000-0000-000000000020', athlete_id: '00000000-0000-0000-0000-000000000001', coach_id: '00000000-0000-0000-0000-000000000002', coach_name: 'Alikhanov Damir', athlete_name: 'Alikhanov Damir', weight_category: '-68kg', age_category: 'Seniors', status: 'approved' },
    { id: '00000000-0000-0000-0000-000000000023', athlete_id: '00000000-0000-0000-0000-000000000046', coach_id: '00000000-0000-0000-0000-000000000002', coach_name: 'Alikhanov Damir', athlete_name: 'Ibraimova Asel', weight_category: '-57kg', age_category: 'Seniors', status: 'approved' },
    { id: '00000000-0000-0000-0000-000000000021', athlete_name: 'Asanov Timur', coach_id: '00000000-0000-0000-0000-000000000099', coach_name: 'Petrov Ivan', weight_category: '-74kg', age_category: 'Seniors', status: 'pending' },
    { id: '00000000-0000-0000-0000-000000000022', athlete_name: 'Kim Sergei', coach_id: '00000000-0000-0000-0000-000000000099', coach_name: 'Petrov Ivan', weight_category: '-68kg', age_category: 'Seniors', status: 'approved' },
  ],
});

/** Returns mock detail for a given tournament ID. Creates a stub from list item if not in map. Returns null if not found. */
export function getMockTournamentDetail(id: string): TournamentDetail | null {
  const cached = mockTournamentDetailsMap.get(id);
  if (cached) return cached;

  // Build detail from list item
  const listItem = mockTournaments.find((t) => t.id === id);
  if (!listItem) return null;

  const detail: TournamentDetail = {
    ...listItem,
    description: null,
    venue: '',
    age_categories: [],
    weight_categories: [],
    entry_fee: null,
    currency: 'RUB',
    registration_deadline: listItem.start_date,
    organizer_contact: null,
    entries: [],
  };
  mockTournamentDetailsMap.set(id, detail);
  return detail;
}

export function addMockTournament(data: TournamentCreate): TournamentListItem {
  const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: TournamentListItem = {
    id,
    name: data.name,
    start_date: data.start_date,
    end_date: data.end_date,
    city: data.city,
    country: 'Россия',
    status: 'upcoming',
    importance_level: data.importance_level,
    entry_count: 0,
  };
  mockTournaments.unshift(item);

  // Also create full detail record
  mockTournamentDetailsMap.set(id, {
    ...item,
    description: data.description,
    venue: data.venue,
    age_categories: [],
    weight_categories: [],
    entry_fee: data.entry_fee,
    currency: data.currency,
    registration_deadline: data.registration_deadline,
    organizer_contact: null,
    entries: [],
  });

  return item;
}

export function deleteMockTournament(id: string) {
  const idx = mockTournaments.findIndex((t) => t.id === id);
  if (idx !== -1) mockTournaments.splice(idx, 1);
  mockTournamentDetailsMap.delete(id);
}

// ── Tournament Results ───────────────────────────────────────

export const mockTournamentResults: TournamentResult[] = [
  { place: 1, athlete_name: 'Ким Сергей', city: 'Москва', weight_category: '-68kg', age_category: 'Seniors' },
  { place: 2, athlete_name: 'Рахимов Отабек', city: 'Казань', weight_category: '-68kg', age_category: 'Seniors' },
  { place: 3, athlete_name: 'Alikhanov Damir', city: 'Москва', weight_category: '-68kg', age_category: 'Seniors' },
  { place: 1, athlete_name: 'Ibraimova Asel', city: 'Москва', weight_category: '-57kg', age_category: 'Seniors' },
  { place: 2, athlete_name: 'Низамова Алия', city: 'Казань', weight_category: '-57kg', age_category: 'Seniors' },
  { place: 3, athlete_name: 'Омарова Динара', city: 'Санкт-Петербург', weight_category: '-57kg', age_category: 'Seniors' },
  { place: 1, athlete_name: 'Магомедов Адилет', city: 'Махачкала', weight_category: '-74kg', age_category: 'Juniors' },
  { place: 2, athlete_name: 'Беков Азамат', city: 'Москва', weight_category: '-74kg', age_category: 'Juniors' },
];

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
  // -68kg мужчины
  { rank: 1, athlete_id: '00000000-0000-0000-0000-000000000040', full_name: 'Ким Сергей', gender: 'M', country: 'Россия', city: 'Москва', club: 'Tiger Dojang', weight_category: '-68kg', sport_rank: 'МС', rating_points: 2100, photo_url: null },
  { rank: 2, athlete_id: '00000000-0000-0000-0000-000000000041', full_name: 'Рахимов Отабек', gender: 'M', country: 'Россия', city: 'Казань', club: 'Казань TKD', weight_category: '-68kg', sport_rank: 'КМС', rating_points: 1800, photo_url: null },
  { rank: 3, athlete_id: '00000000-0000-0000-0000-000000000001', full_name: 'Alikhanov Damir', gender: 'M', country: 'Россия', city: 'Москва', club: 'TKD Academy', weight_category: '-68kg', sport_rank: 'КМС', rating_points: 1250, photo_url: null },
  { rank: 4, athlete_id: '00000000-0000-0000-0000-000000000042', full_name: 'Низамов Руслан', gender: 'M', country: 'Россия', city: 'Нижний Новгород', club: 'Волга TKD', weight_category: '-68kg', sport_rank: '1 разряд', rating_points: 950, photo_url: null },
  { rank: 5, athlete_id: '00000000-0000-0000-0000-000000000043', full_name: 'Магомедов Адилет', gender: 'M', country: 'Россия', city: 'Махачкала', club: 'Дагестан Warriors', weight_category: '-68kg', sport_rank: '1 разряд', rating_points: 820, photo_url: null },
  { rank: 6, athlete_id: '00000000-0000-0000-0000-000000000044', full_name: 'Омаров Бейбит', gender: 'M', country: 'Россия', city: 'Санкт-Петербург', club: 'Нева TKD', weight_category: '-68kg', sport_rank: 'КМС', rating_points: 740, photo_url: null },
  { rank: 7, athlete_id: '00000000-0000-0000-0000-000000000045', full_name: 'Исмоилов Фаррух', gender: 'M', country: 'Россия', city: 'Рязань', club: null, weight_category: '-68kg', sport_rank: '1 разряд', rating_points: 680, photo_url: null },
  // -57kg женщины
  { rank: 8, athlete_id: '00000000-0000-0000-0000-000000000046', full_name: 'Ибраимова Асель', gender: 'F', country: 'Россия', city: 'Москва', club: 'TKD Academy', weight_category: '-57kg', sport_rank: '1 разряд', rating_points: 1600, photo_url: null },
  { rank: 9, athlete_id: '00000000-0000-0000-0000-000000000060', full_name: 'Низамова Алия', gender: 'F', country: 'Россия', city: 'Казань', club: 'Казань TKD', weight_category: '-57kg', sport_rank: 'КМС', rating_points: 1350, photo_url: null },
  { rank: 10, athlete_id: '00000000-0000-0000-0000-000000000061', full_name: 'Омарова Динара', gender: 'F', country: 'Россия', city: 'Санкт-Петербург', club: 'Нева TKD', weight_category: '-57kg', sport_rank: '1 разряд', rating_points: 1100, photo_url: null },
  // -74kg мужчины
  { rank: 11, athlete_id: '00000000-0000-0000-0000-000000000062', full_name: 'Асанов Тимур', gender: 'M', country: 'Россия', city: 'Москва', club: 'Tiger Dojang', weight_category: '-74kg', sport_rank: 'КМС', rating_points: 1900, photo_url: null },
  { rank: 12, athlete_id: '00000000-0000-0000-0000-000000000063', full_name: 'Беков Азамат', gender: 'M', country: 'Россия', city: 'Краснодар', club: 'Кубань TKD', weight_category: '-74kg', sport_rank: '1 разряд', rating_points: 1450, photo_url: null },
  { rank: 13, athlete_id: '00000000-0000-0000-0000-000000000064', full_name: 'Тагиров Шамиль', gender: 'M', country: 'Россия', city: 'Махачкала', club: 'Дагестан Warriors', weight_category: '-74kg', sport_rank: '1 разряд', rating_points: 980, photo_url: null },
  // -63kg женщины
  { rank: 14, athlete_id: '00000000-0000-0000-0000-000000000065', full_name: 'Петрова Анна', gender: 'F', country: 'Россия', city: 'Санкт-Петербург', club: 'Нева TKD', weight_category: '-63kg', sport_rank: 'КМС', rating_points: 1550, photo_url: null },
  { rank: 15, athlete_id: '00000000-0000-0000-0000-000000000066', full_name: 'Каримова Лейла', gender: 'F', country: 'Россия', city: 'Казань', club: 'Казань TKD', weight_category: '-63kg', sport_rank: '2 разряд', rating_points: 720, photo_url: null },
  // -80kg мужчины
  { rank: 16, athlete_id: '00000000-0000-0000-0000-000000000067', full_name: 'Волков Дмитрий', gender: 'M', country: 'Россия', city: 'Екатеринбург', club: 'Урал TKD', weight_category: '-80kg', sport_rank: 'МС', rating_points: 2050, photo_url: null },
  { rank: 17, athlete_id: '00000000-0000-0000-0000-000000000068', full_name: 'Салимов Артур', gender: 'M', country: 'Россия', city: 'Нижний Новгород', club: 'Волга TKD', weight_category: '-80kg', sport_rank: '1 разряд', rating_points: 890, photo_url: null },
];

// ── Coach Linking ────────────────────────────────────────────

export const mockCoachSearchResults: CoachSearchResult[] = [
  { id: '00000000-0000-0000-0000-000000000080', full_name: 'Петров Иван', city: 'Москва', club: 'Tiger Dojang', qualification: 'МС, 4 Dan', is_verified: true },
  { id: '00000000-0000-0000-0000-000000000081', full_name: 'Сидоров Алексей', city: 'Казань', club: 'Казань TKD', qualification: 'КМС, 3 Dan', is_verified: false },
  { id: '00000000-0000-0000-0000-000000000082', full_name: 'Ким Виктор', city: 'Санкт-Петербург', club: 'Нева TKD', qualification: 'МС, 5 Dan', is_verified: true },
];

export let mockMyCoach: MyCoachLink | null = load<MyCoachLink | null>('my_coach', null);

export function requestMockCoachLink(coachId: string): MyCoachLink {
  const coach = mockCoachSearchResults.find((c) => c.id === coachId);
  const link: MyCoachLink = {
    link_id: `mock-link-${Date.now()}`,
    coach_id: coachId,
    full_name: coach?.full_name || 'Unknown',
    city: coach?.city || '',
    club: coach?.club || '',
    qualification: coach?.qualification || '',
    is_verified: coach?.is_verified || false,
    status: 'pending',
  };
  mockMyCoach = link;
  save('my_coach', mockMyCoach);
  return link;
}

export function unlinkMockCoach() {
  mockMyCoach = null;
  save('my_coach', null);
}

export let mockPendingAthletes: PendingAthleteRequest[] = [
  { link_id: 'mock-pending-1', athlete_id: '00000000-0000-0000-0000-000000000090', full_name: 'Новиков Артём', weight_category: '-63kg', sport_rank: '1 разряд', club: 'Волга TKD' },
];

export function acceptMockAthleteRequest(linkId: string) {
  mockPendingAthletes = mockPendingAthletes.filter((r) => r.link_id !== linkId);
}

export function rejectMockAthleteRequest(linkId: string) {
  mockPendingAthletes = mockPendingAthletes.filter((r) => r.link_id !== linkId);
}

// ── Coach ───────────────────────────────────────────────────

export const mockCoachAthletes: CoachAthlete[] = [
  { id: '00000000-0000-0000-0000-000000000001', full_name: 'Alikhanov Damir', weight_category: '-68kg', sport_rank: 'КМС', rating_points: 1250, club: 'TKD Academy' },
  { id: '00000000-0000-0000-0000-000000000046', full_name: 'Ibraimova Asel', weight_category: '-57kg', sport_rank: '1 разряд', rating_points: 780, club: 'TKD Academy' },
  { id: '00000000-0000-0000-0000-000000000047', full_name: 'Bekov Azamat', weight_category: '-63kg', sport_rank: '2 разряд', rating_points: 340, club: 'TKD Academy' },
];

export let mockCoachEntries: CoachEntry[] = [
  { id: '00000000-0000-0000-0000-000000000050', tournament_id: '00000000-0000-0000-0000-000000000010', tournament_name: 'Кубок России по тхэквондо 2026', athlete_id: '00000000-0000-0000-0000-000000000001', athlete_name: 'Alikhanov Damir', weight_category: '-68kg', age_category: 'Seniors', status: 'approved' },
  { id: '00000000-0000-0000-0000-000000000051', tournament_id: '00000000-0000-0000-0000-000000000010', tournament_name: 'Кубок России по тхэквондо 2026', athlete_id: '00000000-0000-0000-0000-000000000046', athlete_name: 'Ibraimova Asel', weight_category: '-57kg', age_category: 'Seniors', status: 'pending' },
];

let nextEntryId = 200;

/** Coach enters selected athletes into a tournament. Returns a NEW detail object for React state update. */
export function enterMockAthletes(
  tournamentId: string,
  athleteIds: string[],
): TournamentDetail | null {
  const detail = mockTournamentDetailsMap.get(tournamentId);
  if (!detail) return null;

  const newEntries: TournamentEntry[] = [];

  for (const athleteId of athleteIds) {
    // Skip if already entered
    if (detail.entries.some((e) => e.athlete_id === athleteId)) continue;

    const athlete = mockCoachAthletes.find((a) => a.id === athleteId);
    if (!athlete) continue;

    const entryId = `mock-entry-${Date.now()}-${nextEntryId++}`;
    const coachId = mockMe.coach?.id || '';
    const coachName = mockMe.coach?.full_name || '';
    const entry: TournamentEntry = {
      id: entryId,
      athlete_id: athleteId,
      coach_id: coachId,
      coach_name: coachName,
      athlete_name: athlete.full_name,
      weight_category: athlete.weight_category,
      age_category: detail.age_categories[0] || 'Seniors',
      status: 'pending',
    };
    newEntries.push(entry);

    // Also add to coach entries
    mockCoachEntries = [
      ...mockCoachEntries,
      {
        id: entryId,
        tournament_id: tournamentId,
        tournament_name: detail.name,
        athlete_id: athleteId,
        athlete_name: athlete.full_name,
        weight_category: athlete.weight_category,
        age_category: entry.age_category,
        status: 'pending',
      },
    ];
  }

  detail.entries = [...detail.entries, ...newEntries];

  // Update entry_count on the list item
  if (newEntries.length > 0) {
    const listItem = mockTournaments.find((t) => t.id === tournamentId);
    if (listItem) listItem.entry_count += newEntries.length;
  }

  // Return a NEW object so React detects the state change
  return { ...detail };
}

/** Approve all entries from a coach (by coach_id). */
export function approveMockCoachEntries(tournamentId: string, coachId: string): TournamentDetail | null {
  const detail = mockTournamentDetailsMap.get(tournamentId);
  if (detail) {
    detail.entries = detail.entries.map((e) =>
      e.coach_id === coachId ? { ...e, status: 'approved' } : e,
    );
  }
  mockCoachEntries = mockCoachEntries.map((e) =>
    e.tournament_id === tournamentId && mockMe.coach?.id === coachId ? { ...e, status: 'approved' } : e,
  );
  return detail ? { ...detail } : null;
}

/** Reject all entries from a coach (by coach_id). */
export function rejectMockCoachEntries(tournamentId: string, coachId: string): TournamentDetail | null {
  const detail = mockTournamentDetailsMap.get(tournamentId);
  if (detail) {
    detail.entries = detail.entries.map((e) =>
      e.coach_id === coachId ? { ...e, status: 'rejected' } : e,
    );
  }
  mockCoachEntries = mockCoachEntries.map((e) =>
    e.tournament_id === tournamentId && mockMe.coach?.id === coachId ? { ...e, status: 'rejected' } : e,
  );
  return detail ? { ...detail } : null;
}

/** Remove a single athlete from a coach's entry. */
export function removeMockEntryAthlete(tournamentId: string, entryId: string): TournamentDetail | null {
  const detail = mockTournamentDetailsMap.get(tournamentId);
  if (detail) {
    detail.entries = detail.entries.filter((e) => e.id !== entryId);
    const listItem = mockTournaments.find((t) => t.id === tournamentId);
    if (listItem) listItem.entry_count = Math.max(0, listItem.entry_count - 1);
  }
  mockCoachEntries = mockCoachEntries.filter((e) => e.id !== entryId);
  return detail ? { ...detail } : null;
}
