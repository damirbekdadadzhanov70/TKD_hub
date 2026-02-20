export interface AthleteProfile {
  id: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  weight_category: string;
  current_weight: number;
  sport_rank: string;
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
  is_admin: boolean;
  athlete: AthleteProfile | null;
  coach: CoachProfile | null;
}

export interface AthleteUpdate {
  full_name?: string;
  weight_category?: string;
  current_weight?: number;
  sport_rank?: string;
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
  coach_id?: string;
  coach_name?: string;
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
  photos_url: string | null;
  results_url: string | null;
  organizer_name: string | null;
  organizer_phone: string | null;
  organizer_telegram: string | null;
  status: string;
  importance_level: number;
  entries: TournamentEntry[];
  results: TournamentResult[];
  files: TournamentFile[];
}

export type FileCategory = 'protocol' | 'bracket' | 'regulations';

export interface TournamentFile {
  id: string;
  tournament_id: string;
  category: FileCategory;
  filename: string;
  blob_url: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

export interface TournamentResult {
  id: string;
  tournament_id: string;
  athlete_id: string | null;
  athlete_name: string;
  city: string;
  weight_category: string;
  age_category: string;
  gender: string | null;
  place: number;
  rating_points_earned: number;
  is_matched?: boolean;
}

export interface CsvProcessingSummary {
  total_rows: number;
  matched: number;
  unmatched: number;
  points_awarded: number;
}

export interface TournamentFileUploadResponse extends TournamentFile {
  csv_summary: CsvProcessingSummary | null;
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
  age_categories: string[];
  weight_categories: string[];
  entry_fee: number | null;
  currency: string;
  registration_deadline: string;
  importance_level: number;
  photos_url: string | null;
  results_url: string | null;
  organizer_name: string | null;
  organizer_phone: string | null;
  organizer_telegram: string | null;
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
  sport_rank: string;
  rating_points: number;
  photo_url: string | null;
}

export interface CoachAthlete {
  id: string;
  full_name: string;
  weight_category: string;
  sport_rank: string;
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
  date_of_birth: string;
  gender: 'M' | 'F';
  weight_category: string;
  current_weight: number;
  sport_rank: string;
  city: string;
  club?: string;
}

export interface CoachRegistration {
  full_name: string;
  date_of_birth: string;
  gender: 'M' | 'F';
  sport_rank?: string;
  city: string;
  club: string;
}

export interface TournamentHistoryItem {
  place: number;
  tournament_name: string;
  tournament_date: string;
}

export interface ProfileStats {
  tournaments_count: number;
  medals_count: number;
  users_count: number;
  tournaments_total: number;
  tournament_history: TournamentHistoryItem[];
}

export interface RoleRequestItem {
  id: string;
  user_id: string;
  username: string | null;
  requested_role: string;
  status: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface CoachSearchResult {
  id: string;
  full_name: string;
  city: string;
  club: string;
  qualification: string;
  is_verified: boolean;
}

export interface MyCoachLink {
  link_id: string;
  coach_id: string;
  full_name: string;
  city: string;
  club: string;
  qualification: string;
  is_verified: boolean;
  status: string;
}

export interface PendingAthleteRequest {
  link_id: string;
  athlete_id: string;
  full_name: string;
  weight_category: string;
  sport_rank: string;
  club: string | null;
}

export interface AdminUserItem {
  id: string;
  telegram_id: number;
  username: string | null;
  role: string;
  full_name: string | null;
  city: string | null;
  created_at: string;
}

export interface AdminUserDetail {
  id: string;
  telegram_id: number;
  username: string | null;
  role: string;
  is_admin: boolean;
  athlete: AthleteProfile | null;
  coach: CoachProfile | null;
  created_at: string;
  stats: {
    tournaments_count: number;
    medals_count: number;
  };
}

export interface NotificationItem {
  id: string;
  type: string;
  role: string | null;
  title: string;
  body: string;
  ref_id: string | null;
  read: boolean;
  created_at: string;
}

export interface UserSearchItem {
  id: string;
  full_name: string | null;
  role: string;
  city: string | null;
  club: string | null;
  photo_url: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
}
