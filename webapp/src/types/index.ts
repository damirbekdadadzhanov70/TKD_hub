export interface AthleteProfile {
  id: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  weight_category: string;
  current_weight: number;
  belt: string;
  country: string;
  city: string;
  club: string | null;
  photo_url: string | null;
  rating_points: number;
}

export interface CoachProfile {
  id: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  country: string;
  city: string;
  club: string;
  qualification: string;
  photo_url: string | null;
  is_verified: boolean;
}

export interface MeResponse {
  telegram_id: number;
  username: string | null;
  language: string;
  role: 'athlete' | 'coach' | 'admin' | 'none';
  athlete: AthleteProfile | null;
  coach: CoachProfile | null;
}

export interface AthleteUpdate {
  full_name?: string;
  weight_category?: string;
  current_weight?: number;
  belt?: string;
  country?: string;
  city?: string;
  club?: string;
  photo_url?: string;
}

export interface CoachUpdate {
  full_name?: string;
  city?: string;
  club?: string;
  qualification?: string;
}

export interface TournamentListItem {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  city: string;
  country: string;
  status: string;
  importance_level: number;
  entry_count: number;
}

export interface TournamentEntry {
  id: string;
  athlete_id?: string;
  athlete_name: string;
  weight_category: string;
  age_category: string;
  status: string;
}

export interface TournamentDetail {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  city: string;
  country: string;
  venue: string;
  age_categories: string[];
  weight_categories: string[];
  entry_fee: number | null;
  currency: string;
  registration_deadline: string;
  organizer_contact: string | null;
  status: string;
  importance_level: number;
  entries: TournamentEntry[];
}

export interface TournamentResult {
  place: number;
  athlete_name: string;
  city: string;
  weight_category: string;
  age_category: string;
}

export interface TournamentInterestResponse {
  tournament_id: string;
  athlete_id: string;
  created: boolean;
}

export interface TrainingLog {
  id: string;
  date: string;
  type: string;
  duration_minutes: number;
  intensity: string;
  weight: number | null;
  notes: string | null;
  coach_comment: string | null;
}

export interface TournamentCreate {
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  city: string;
  venue: string;
  entry_fee: number | null;
  currency: string;
  registration_deadline: string;
  importance_level: number;
}

export interface TrainingLogCreate {
  date: string;
  type: string;
  duration_minutes: number;
  intensity: string;
  weight?: number | null;
  notes?: string | null;
}

export interface TrainingLogUpdate {
  date?: string;
  type?: string;
  duration_minutes?: number;
  intensity?: string;
  weight?: number | null;
  notes?: string | null;
}

export interface TrainingLogStats {
  total_sessions: number;
  total_minutes: number;
  avg_intensity: string;
  training_days: number;
}

export interface RatingEntry {
  rank: number;
  athlete_id: string;
  full_name: string;
  gender: string;
  country: string;
  city: string;
  club: string | null;
  weight_category: string;
  belt: string;
  rating_points: number;
  photo_url: string | null;
}

export interface CoachAthlete {
  id: string;
  full_name: string;
  weight_category: string;
  belt: string;
  rating_points: number;
  club: string | null;
}

export interface CoachEntry {
  id: string;
  tournament_id: string;
  tournament_name: string;
  athlete_id: string;
  athlete_name: string;
  weight_category: string;
  age_category: string;
  status: string;
}

export interface AthleteRegistration {
  full_name: string;
  weight_category: string;
  belt: string;
  city: string;
}

export interface CoachRegistration {
  full_name: string;
  club: string;
  city: string;
  qualification: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
}
