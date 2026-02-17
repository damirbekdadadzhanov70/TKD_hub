import { apiRequest } from './client';
import type {
  AthleteRegistration,
  AthleteUpdate,
  CoachAthlete,
  CoachRegistration,
  CoachUpdate,
  CoachEntry,
  MeResponse,
  PaginatedResponse,
  ProfileStats,
  RatingEntry,
  RoleRequestItem,
  TournamentCreate,
  TournamentDetail,
  TournamentEntry,
  TournamentInterestResponse,
  TournamentListItem,
  TournamentResult,
  TrainingLog,
  TrainingLogCreate,
  TrainingLogStats,
  TrainingLogUpdate,
} from '../types';

// --- Profile ---

export function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me');
}

export function updateMe(data: AthleteUpdate): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function updateCoach(data: CoachUpdate): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me/coach', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getProfileStats(): Promise<ProfileStats> {
  return apiRequest<ProfileStats>('/me/stats');
}

export function registerProfile(payload: {
  role: 'athlete' | 'coach';
  data: AthleteRegistration | CoachRegistration;
}): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function switchRole(role: string): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me/role', {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

export function submitRoleRequest(payload: {
  requested_role: string;
  data: Record<string, unknown>;
}): Promise<{ id: string; requested_role: string; status: string }> {
  return apiRequest('/me/role-request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getRoleRequests(): Promise<RoleRequestItem[]> {
  return apiRequest<RoleRequestItem[]>('/admin/role-requests');
}

export function approveRoleRequest(id: string): Promise<void> {
  return apiRequest<void>(`/admin/role-requests/${id}/approve`, {
    method: 'POST',
  });
}

export function rejectRoleRequest(id: string): Promise<void> {
  return apiRequest<void>(`/admin/role-requests/${id}/reject`, {
    method: 'POST',
  });
}

// --- Tournaments ---

export async function getTournaments(params?: {
  city?: string;
  status?: string;
}): Promise<TournamentListItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.city) searchParams.set('city', params.city);
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  const res = await apiRequest<PaginatedResponse<TournamentListItem>>(`/tournaments${qs ? `?${qs}` : ''}`);
  return res.items;
}

export function createTournament(data: TournamentCreate): Promise<TournamentListItem> {
  return apiRequest<TournamentListItem>('/tournaments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteTournament(id: string): Promise<void> {
  return apiRequest<void>(`/tournaments/${id}`, {
    method: 'DELETE',
  });
}

export function getTournament(id: string): Promise<TournamentDetail> {
  return apiRequest<TournamentDetail>(`/tournaments/${id}`);
}

export function markInterest(tournamentId: string): Promise<TournamentInterestResponse> {
  return apiRequest<TournamentInterestResponse>(`/tournaments/${tournamentId}/interest`, {
    method: 'POST',
  });
}

export function enterTournament(
  tournamentId: string,
  athleteIds: string[],
  ageCategory: string,
): Promise<TournamentEntry[]> {
  return apiRequest<TournamentEntry[]>(`/tournaments/${tournamentId}/enter`, {
    method: 'POST',
    body: JSON.stringify({ athlete_ids: athleteIds, age_category: ageCategory }),
  });
}

export function removeEntry(tournamentId: string, entryId: string): Promise<void> {
  return apiRequest<void>(`/tournaments/${tournamentId}/entries/${entryId}`, {
    method: 'DELETE',
  });
}

export function approveCoachEntries(tournamentId: string, coachId: string): Promise<void> {
  return apiRequest<void>(`/tournaments/${tournamentId}/coaches/${coachId}/approve`, {
    method: 'POST',
  });
}

export function rejectCoachEntries(tournamentId: string, coachId: string): Promise<void> {
  return apiRequest<void>(`/tournaments/${tournamentId}/coaches/${coachId}/reject`, {
    method: 'POST',
  });
}

export function getTournamentResults(tournamentId: string): Promise<TournamentResult[]> {
  return apiRequest<TournamentResult[]>(`/tournaments/${tournamentId}/results`);
}

// --- Training Log ---

export async function getTrainingLogs(params?: {
  month?: number;
  year?: number;
}): Promise<TrainingLog[]> {
  const searchParams = new URLSearchParams();
  if (params?.month) searchParams.set('month', String(params.month));
  if (params?.year) searchParams.set('year', String(params.year));
  const qs = searchParams.toString();
  const res = await apiRequest<PaginatedResponse<TrainingLog>>(`/training-log${qs ? `?${qs}` : ''}`);
  return res.items;
}

export function createTrainingLog(data: TrainingLogCreate): Promise<TrainingLog> {
  return apiRequest<TrainingLog>('/training-log', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTrainingLog(id: string, data: TrainingLogUpdate): Promise<TrainingLog> {
  return apiRequest<TrainingLog>(`/training-log/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteTrainingLog(id: string): Promise<void> {
  return apiRequest<void>(`/training-log/${id}`, {
    method: 'DELETE',
  });
}

export function getTrainingStats(params?: {
  month?: number;
  year?: number;
}): Promise<TrainingLogStats> {
  const searchParams = new URLSearchParams();
  if (params?.month) searchParams.set('month', String(params.month));
  if (params?.year) searchParams.set('year', String(params.year));
  const qs = searchParams.toString();
  return apiRequest<TrainingLogStats>(`/training-log/stats${qs ? `?${qs}` : ''}`);
}

// --- Ratings ---

export async function getRatings(params?: {
  country?: string;
  weight_category?: string;
  gender?: string;
}): Promise<RatingEntry[]> {
  const searchParams = new URLSearchParams();
  if (params?.country) searchParams.set('country', params.country);
  if (params?.weight_category) searchParams.set('weight_category', params.weight_category);
  if (params?.gender) searchParams.set('gender', params.gender);
  const qs = searchParams.toString();
  const res = await apiRequest<PaginatedResponse<RatingEntry>>(`/ratings${qs ? `?${qs}` : ''}`);
  return res.items;
}

// --- Coach ---

export async function getCoachAthletes(): Promise<CoachAthlete[]> {
  const res = await apiRequest<PaginatedResponse<CoachAthlete>>('/coach/athletes');
  return res.items;
}

export async function getCoachEntries(): Promise<CoachEntry[]> {
  const res = await apiRequest<PaginatedResponse<CoachEntry>>('/coach/entries');
  return res.items;
}
