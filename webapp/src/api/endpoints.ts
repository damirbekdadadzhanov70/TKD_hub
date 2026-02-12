import { apiRequest } from './client';
import type {
  AthleteUpdate,
  CoachAthlete,
  MeResponse,
  RatingEntry,
  TournamentDetail,
  TournamentListItem,
  TrainingLog,
  TrainingLogCreate,
} from '../types';

export function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me');
}

export function updateMe(data: AthleteUpdate): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getTournaments(params?: {
  country?: string;
  status?: string;
}): Promise<TournamentListItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.country) searchParams.set('country', params.country);
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  return apiRequest<TournamentListItem[]>(`/tournaments${qs ? `?${qs}` : ''}`);
}

export function getTournament(id: string): Promise<TournamentDetail> {
  return apiRequest<TournamentDetail>(`/tournaments/${id}`);
}

export function getTrainingLogs(params?: {
  month?: number;
  year?: number;
}): Promise<TrainingLog[]> {
  const searchParams = new URLSearchParams();
  if (params?.month) searchParams.set('month', String(params.month));
  if (params?.year) searchParams.set('year', String(params.year));
  const qs = searchParams.toString();
  return apiRequest<TrainingLog[]>(`/training-log${qs ? `?${qs}` : ''}`);
}

export function createTrainingLog(data: TrainingLogCreate): Promise<TrainingLog> {
  return apiRequest<TrainingLog>('/training-log', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getRatings(params?: {
  country?: string;
  weight_category?: string;
  gender?: string;
}): Promise<RatingEntry[]> {
  const searchParams = new URLSearchParams();
  if (params?.country) searchParams.set('country', params.country);
  if (params?.weight_category) searchParams.set('weight_category', params.weight_category);
  if (params?.gender) searchParams.set('gender', params.gender);
  const qs = searchParams.toString();
  return apiRequest<RatingEntry[]>(`/ratings${qs ? `?${qs}` : ''}`);
}

export function getCoachAthletes(): Promise<CoachAthlete[]> {
  return apiRequest<CoachAthlete[]>('/coach/athletes');
}
