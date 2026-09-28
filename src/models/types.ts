/**
 * Data Models & Interfaces for CENTRAL DE TV
 */

export type UserStatus = 'active' | 'pending' | 'expired' | 'blocked';
export type AccessStatus = 'active' | 'expired' | 'revoked';
export type CheckInStatus = 'pending' | 'approved' | 'rejected';
export type ChannelContentType = 'live' | 'vod' | 'news' | 'culture' | 'education' | 'sports' | 'family';
export type ChannelStatus = 'active' | 'inactive';

export interface User {
  id: string; // Telegram ID as string (primary key)
  first_name: string;
  last_name?: string;
  username?: string;
  status: UserStatus;
  first_seen_at: string;
  last_checkin_at?: string;
  current_access_id?: string;
  is_owner: boolean;
  is_admin: boolean;
  notes?: string;
}

export interface Access {
  id: string;
  telegram_id: string;
  user_name: string;
  start_date: string; // ISO 8601
  expiration_date: string; // ISO 8601
  duration_days: number;
  granted_by_id: string; // Admin or Owner Telegram ID
  granted_by_name: string;
  status: AccessStatus;
  warning_3_days_sent?: boolean;
  warning_1_day_sent?: boolean;
  expired_notification_sent?: boolean;
  created_at: string;
}

export interface CheckIn {
  id: string;
  telegram_id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  group_id?: string;
  group_title?: string;
  timestamp: string;
  status: CheckInStatus;
  processed_by_id?: string;
  processed_at?: string;
  duration_days?: number;
  access_id?: string;
}

export type ChannelRequirement =
  | 'direct' // ✅ Acesso direto
  | 'needs_register' // 👤 Necessita cadastro
  | 'needs_login' // 🔐 Necessita login
  | 'may_require_sub' // 💳 Pode exigir assinatura
  | 'official_site'; // 🌐 Abre no site oficial

export interface Channel {
  id: string;
  name: string;
  description: string;
  category_id: string;
  category_name: string;
  image_url: string;
  official_url: string;
  official_source: string;
  available_regions: string[];
  content_type: ChannelContentType;
  status: ChannelStatus;
  admin_authorized: boolean;
  access_requirement?: ChannelRequirement;
  requirement_note?: string;
  verification_date?: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
  created_at: string;
}

export interface Admin {
  telegram_id: string;
  name: string;
  username?: string;
  role: 'owner' | 'admin';
  added_by: string;
  added_at: string;
}

export interface MoviePlatform {
  id: string;
  name: string;
  description: string;
  url: string;
  image_url?: string;
  platform: string;
  category: string;
  requires_registration: boolean;
  requires_login: boolean;
  is_active: boolean;
  order: number;
  notes?: string;
  created_at: string;
}

export interface Highlight {
  id: string;
  title: string;
  description: string;
  url: string;
  extra_url?: string;
  platform: string; // YouTube, TikTok, Twitch, Kick, etc.
  image_url?: string;
  category: string;
  is_live: boolean;
  is_active: boolean;
  is_featured: boolean;
  order: number;
  start_date?: string;
  end_date?: string;
  clicks_count: number;
  created_at: string;
}

export interface AdultContent {
  id: string;
  title: string;
  description: string;
  url: string;
  image_url?: string;
  platform: string;
  category: string;
  is_active: boolean;
  order: number;
  created_at: string;
}

export type AdultAccessStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

export interface AdultAccessRequest {
  id: string;
  telegram_id: string;
  user_name: string;
  username?: string;
  age_confirmed: boolean;
  status: AdultAccessStatus;
  requested_at: string;
  processed_at?: string;
  processed_by_id?: string;
  processed_by_name?: string;
  notes?: string;
}

// 🔐 PRIVADO Models
export interface PrivateContent {
  id: string; // e.g. 'private_01', 'private_02'
  name: string; // 'CONTEÚDO 01', 'CONTEÚDO 02'
  url: string; // empty string initially
  status: 'active' | 'inactive';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type PrivateAccessStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

export interface PrivateAccessRequest {
  id: string;
  telegram_id: string;
  user_name: string;
  username?: string;
  status: PrivateAccessStatus;
  requested_at: string;
  processed_at?: string;
  processed_by_id?: string;
  processed_by_name?: string;
  notes?: string;
}

// 🔐 VAZADOS Models (Biblioteca Dinâmica de Conteúdos)
export interface VazadoContent {
  id: string; // e.g. 'vazado_1', 'vazado_2'
  item_number: number; // 1, 2, 3...
  display_name: string; // 'Conteúdo 01', 'Conteúdo 02', etc.
  title: string;
  description: string;
  url: string;
  status: 'active' | 'inactive';
  order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  system_name: string;
  owner_id: string;
  bot_username: string;
  bot_active: boolean;
  webhook_mode: boolean;
  webhook_url?: string;
  webhook_secret?: string;
  last_webhook_status?: string;
  last_webhook_error?: string;
  last_webhook_check?: string;
  auto_expiration_check_minutes: number;
  last_expiration_check: string;
  checkin_welcome_msg: string;
  telegram_token_configured: boolean;
  daily_backup_enabled?: boolean;
  last_daily_backup_date?: string;
  last_daily_backup_at?: string;
  last_daily_backup_file?: string;
}

export interface BackupMetadata {
  id: string;
  filename: string;
  type: 'daily_auto' | 'manual';
  timestamp: string;
  created_at_formatted: string;
  size_bytes: number;
  size_formatted: string;
  users_count: number;
  channels_count: number;
  logs_count: number;
  owner_id: string;
  system_name: string;
  file_path: string;
}

export interface BackupPayload {
  backup_version: string;
  generated_at: string;
  type: 'daily_auto' | 'manual';
  system_name: string;
  owner_id: string;
  stats: {
    users_count: number;
    channels_count: number;
    logs_count: number;
    movies_count?: number;
    highlights_count?: number;
    adult_contents_count?: number;
    private_contents_count?: number;
    vazados_count?: number;
  };
  tables: {
    users: User[];
    channels: Channel[];
    logs: AccessLog[];
    movies?: MoviePlatform[];
    highlights?: Highlight[];
    adult_contents?: AdultContent[];
    adult_requests?: AdultAccessRequest[];
    private_contents?: PrivateContent[];
    private_requests?: PrivateAccessRequest[];
    vazados?: VazadoContent[];
  };
  checksum?: string;
}

export interface BackupStatus {
  daily_auto_enabled: boolean;
  schedule_description: string;
  last_daily_backup: BackupMetadata | null;
  total_backups_stored: number;
  retention_days: number;
  next_scheduled_run: string;
  tables_included: string[];
}

export interface AccessLog {
  id: string;
  telegram_id: string;
  user_name?: string;
  action: string;
  details: string;
  timestamp: string;
  source: 'bot' | 'panel' | 'system';
}

export interface SystemStats {
  total_users: number;
  active_accesses: number;
  pending_requests: number;
  expired_accesses: number;
  blocked_users: number;
  total_channels: number;
  active_channels: number;
  total_categories: number;
  total_movies: number;
  active_movies: number;
  total_highlights: number;
  total_adult_contents?: number;
  pending_adult_requests?: number;
  approved_adult_users?: number;
  total_private_contents?: number;
  pending_private_requests?: number;
  approved_private_users?: number;
  total_vazados?: number;
  active_vazados?: number;
  checkins_today: number;
  checkins_last_7_days: number;
}


