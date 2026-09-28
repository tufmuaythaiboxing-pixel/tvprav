/**
 * Daily Automatic Backup Routine & Export Service for CENTRAL DE TV
 * Automatically backs up database tables: users, channels, logs.
 * Manages daily automated routine, retention, manual triggers, and downloads.
 */

import fs from 'fs';
import path from 'path';
import { db } from '../database/db.ts';
import { CONFIG } from '../config/config.ts';
import { BackupMetadata, BackupPayload, BackupStatus } from '../models/types.ts';

class BackupService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly checkIntervalMs = 60 * 60 * 1000; // Check hourly if today's daily backup is generated

  constructor() {
    this.ensureDirectory();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
        fs.mkdirSync(CONFIG.BACKUP_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[BackupService] Failed to create backup directory:', err);
    }
  }

  /**
   * Starts the background scheduler for daily automatic backups
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.ensureDirectory();
    console.log('[BackupService] Initialized daily automatic backup routine.');

    // Initial check after 5 seconds on startup
    setTimeout(() => {
      this.checkAndRunDailyBackup('startup');
    }, 5000);

    // Hourly routine check
    this.timer = setInterval(() => {
      this.checkAndRunDailyBackup('timer');
    }, this.checkIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[BackupService] Stopped daily backup routine.');
  }

  /**
   * Checks if today's daily backup has already been generated.
   * If not, generates it automatically.
   */
  async checkAndRunDailyBackup(triggerReason = 'scheduled'): Promise<boolean> {
    try {
      const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const settings = db.getSettings();

      // Check if daily backup for today has already run
      if (settings.last_daily_backup_date === todayStr) {
        // Already performed today
        return false;
      }

      console.log(`[BackupService] Running daily automatic backup for date: ${todayStr} (reason: ${triggerReason})`);
      this.createBackup('daily_auto', 'Rotina Diária Automática');
      return true;
    } catch (err) {
      console.error('[BackupService] Error in daily backup routine:', err);
      return false;
    }
  }

  /**
   * Formats file size in readable units (KB, MB)
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Generates a new backup file with tables (users, channels, logs)
   */
  createBackup(type: 'daily_auto' | 'manual' = 'manual', triggeredBy = 'Proprietário'): {
    metadata: BackupMetadata;
    payload: BackupPayload;
  } {
    this.ensureDirectory();

    const now = new Date();
    const datePart = now.toISOString().replace(/[:.]/g, '-');
    const dayDate = now.toISOString().split('T')[0];
    const prefix = type === 'daily_auto' ? 'backup_diario' : 'backup_manual';
    const filename = `central_tv_${prefix}_${datePart}.json`;
    const filePath = path.join(CONFIG.BACKUP_DIR, filename);

    // Export database tables
    const payload = db.exportBackupData(type);

    const jsonString = JSON.stringify(payload, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf-8');

    // Also update a fixed "latest" file for quick access
    const latestPath = path.join(CONFIG.BACKUP_DIR, 'central_tv_backup_latest.json');
    try {
      fs.writeFileSync(latestPath, jsonString, 'utf-8');
    } catch {}

    const fileStats = fs.statSync(filePath);

    const metadata: BackupMetadata = {
      id: `backup_${now.getTime()}`,
      filename,
      type,
      timestamp: now.toISOString(),
      created_at_formatted: now.toLocaleString('pt-BR'),
      size_bytes: fileStats.size,
      size_formatted: this.formatBytes(fileStats.size),
      users_count: payload.stats.users_count,
      channels_count: payload.stats.channels_count,
      logs_count: payload.stats.logs_count,
      owner_id: CONFIG.OWNER_ID,
      system_name: CONFIG.SYSTEM_NAME,
      file_path: filePath,
    };

    if (type === 'daily_auto') {
      db.updateDailyBackupRecord(dayDate, now.toISOString(), filename);
    }

    // Log the backup action in audit logs
    db.logAction(
      CONFIG.OWNER_ID,
      type === 'daily_auto' ? 'BACKUP_DAILY_SUCCESS' : 'BACKUP_MANUAL_SUCCESS',
      `Backup (${type === 'daily_auto' ? 'Diário Automático' : 'Manual'}) gerado com sucesso: ${metadata.users_count} usuários, ${metadata.channels_count} canais, ${metadata.logs_count} logs. Arquivo: ${filename} (${metadata.size_formatted}) por ${triggeredBy}`,
      'system'
    );

    // Prune old backups past retention limit
    this.pruneOldBackups();

    return { metadata, payload };
  }

  /**
   * Prunes backup files older than retention policy (default: 30 days)
   */
  private pruneOldBackups() {
    try {
      const maxAgeMs = (CONFIG.DAILY_BACKUP_RETENTION_DAYS || 30) * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const files = fs.readdirSync(CONFIG.BACKUP_DIR);

      for (const file of files) {
        if (!file.endsWith('.json') || file === 'central_tv_backup_latest.json') continue;
        const fullPath = path.join(CONFIG.BACKUP_DIR, file);
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          console.log(`[BackupService] Pruned old backup file: ${file}`);
        }
      }
    } catch (err) {
      console.warn('[BackupService] Could not prune old backups:', err);
    }
  }

  /**
   * Lists all available backups sorted by newest first
   */
  listBackups(): BackupMetadata[] {
    this.ensureDirectory();
    try {
      const files = fs.readdirSync(CONFIG.BACKUP_DIR);
      const results: BackupMetadata[] = [];

      for (const file of files) {
        if (!file.endsWith('.json') || file === 'central_tv_backup_latest.json') continue;
        const fullPath = path.join(CONFIG.BACKUP_DIR, file);
        try {
          const stats = fs.statSync(fullPath);
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const parsed: BackupPayload = JSON.parse(raw);

          const isDaily = file.includes('diario') || parsed.type === 'daily_auto';

          results.push({
            id: file.replace('.json', ''),
            filename: file,
            type: isDaily ? 'daily_auto' : 'manual',
            timestamp: parsed.generated_at || stats.mtime.toISOString(),
            created_at_formatted: new Date(parsed.generated_at || stats.mtime).toLocaleString('pt-BR'),
            size_bytes: stats.size,
            size_formatted: this.formatBytes(stats.size),
            users_count: parsed.stats?.users_count ?? (Array.isArray(parsed.tables?.users) ? parsed.tables.users.length : 0),
            channels_count: parsed.stats?.channels_count ?? (Array.isArray(parsed.tables?.channels) ? parsed.tables.channels.length : 0),
            logs_count: parsed.stats?.logs_count ?? (Array.isArray(parsed.tables?.logs) ? parsed.tables.logs.length : 0),
            owner_id: parsed.owner_id || CONFIG.OWNER_ID,
            system_name: parsed.system_name || CONFIG.SYSTEM_NAME,
            file_path: fullPath,
          });
        } catch (e) {
          // If a file is unreadable, skip it safely
        }
      }

      // Sort newest first
      return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      console.error('[BackupService] Error listing backups:', err);
      return [];
    }
  }

  /**
   * Retrieves a specific backup file safely (prevents directory traversal)
   */
  getBackupFile(filename: string): { filename: string; fullPath: string; contentStr: string; buffer: Buffer } | null {
    this.ensureDirectory();
    const safeName = path.basename(filename);
    const fullPath = path.join(CONFIG.BACKUP_DIR, safeName);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const buffer = fs.readFileSync(fullPath);
    const contentStr = buffer.toString('utf-8');
    return {
      filename: safeName,
      fullPath,
      contentStr,
      buffer,
    };
  }

  /**
   * Gets the most recent backup available, or generates one if none exists
   */
  getLatestBackup(): { filename: string; fullPath: string; contentStr: string; buffer: Buffer } | null {
    const list = this.listBackups();
    if (list.length === 0) {
      // Generate a fresh one right away
      const created = this.createBackup('daily_auto', 'Sistema (Geração Inicial)');
      return this.getBackupFile(created.metadata.filename);
    }
    return this.getBackupFile(list[0].filename);
  }

  /**
   * Retrieves status of the backup system
   */
  getStatus(): BackupStatus {
    const settings = db.getSettings();
    const list = this.listBackups();
    const lastDaily = list.find((b) => b.type === 'daily_auto') || list[0] || null;

    // Calculate next run: tomorrow at 00:00 or next hourly cycle
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      daily_auto_enabled: true,
      schedule_description: 'Rotina diária automática às 00:00 (retenção: 30 dias)',
      last_daily_backup: lastDaily,
      total_backups_stored: list.length,
      retention_days: CONFIG.DAILY_BACKUP_RETENTION_DAYS || 30,
      next_scheduled_run: tomorrow.toISOString(),
      tables_included: ['users', 'channels', 'logs'],
    };
  }
}

export const backupService = new BackupService();
