/**
 * System Configuration for CENTRAL DE TV
 */

export const CONFIG = {
  SYSTEM_NAME: 'CENTRAL DE TV',
  // Absolute system owner - has supreme access regardless of any configuration or roles
  OWNER_ID: process.env.OWNER_ID ? process.env.OWNER_ID.trim() : '6918626496',
  DEFAULT_OWNER_ID: '6918626496',
  
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  APP_URL: process.env.APP_URL || '',
  PORT: parseInt(process.env.PORT || '3000', 10),

  // Paths
  DATA_DIR: './data',
  DB_FILE: './data/database.json',
  BACKUP_DIR: './data/backups',
  DAILY_BACKUP_RETENTION_DAYS: 30,

  // Expiration check interval (in milliseconds) - Default: 30 minutes
  EXPIRATION_CHECK_INTERVAL_MS: 30 * 60 * 1000,

  // Disallowed domains (shorteners, known pirated lists/iptv)
  BLOCKED_DOMAINS: [
    'bit.ly',
    'tinyurl.com',
    't.co',
    'goo.gl',
    'is.gd',
    'buff.ly',
    'ow.ly',
    'pastebin.com',
    'raw.githubusercontent.com',
  ],

  // Common file extensions for unauthorized IPTV lists that MUST be blocked
  FORBIDDEN_EXTENSIONS: ['.m3u', '.m3u8', '.pls', '.ts'],
};
