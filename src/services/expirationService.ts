/**
 * Expiration Service for CENTRAL DE TV
 * Automatically checks for expiring and expired accesses, and sends notifications.
 */

import { db } from '../database/db.ts';
import { CONFIG } from '../config/config.ts';

type SendMessageFn = (chatId: string | number, text: string) => Promise<boolean>;

class ExpirationService {
  private timer: NodeJS.Timeout | null = null;
  private sendMessageFn: SendMessageFn | null = null;
  private isRunning = false;

  setSendMessageFunction(fn: SendMessageFn) {
    this.sendMessageFn = fn;
  }

  start(intervalMs = CONFIG.EXPIRATION_CHECK_INTERVAL_MS) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[ExpirationService] Started routine with interval: ${intervalMs / 1000}s`);

    // Run first check after 10 seconds
    setTimeout(() => {
      this.runCheck();
    }, 10000);

    this.timer = setInterval(() => {
      this.runCheck();
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[ExpirationService] Stopped.');
  }

  async runCheck(): Promise<{
    expiredCount: number;
    warning3DaysCount: number;
    warning1DayCount: number;
  }> {
    try {
      const { expiredNow, warning3Days, warning1Day } = db.checkAndExpireAccesses();

      // Send 3-day warning
      for (const acc of warning3Days) {
        if (this.sendMessageFn) {
          const msg = '⚠️ *AVISO DE EXPIRAÇÃO*\n\nSeu acesso à CENTRAL DE TV expira em *3 dias*.\nEntre em contato com o suporte ou realize um novo check-in caso deseje renovar.';
          await this.sendMessageFn(acc.telegram_id, msg);
        }
      }

      // Send 1-day warning
      for (const acc of warning1Day) {
        if (this.sendMessageFn) {
          const msg = '⚠️ *AVISO DE EXPIRAÇÃO*\n\nSeu acesso à CENTRAL DE TV *expira amanhã*!\nFique atento para não perder o acesso ao catálogo de canais.';
          await this.sendMessageFn(acc.telegram_id, msg);
        }
      }

      // Send expired notification
      for (const acc of expiredNow) {
        if (this.sendMessageFn) {
          const msg =
            '🔴 *SEU ACESSO EXPIROU*\n\nSeu período de acesso terminou. Faça um novo check-in no grupo para solicitar uma nova liberação.';
          await this.sendMessageFn(acc.telegram_id, msg);
        }
      }

      return {
        expiredCount: expiredNow.length,
        warning3DaysCount: warning3Days.length,
        warning1DayCount: warning1Day.length,
      };
    } catch (err) {
      console.error('[ExpirationService] Error during expiration check:', err);
      return { expiredCount: 0, warning3DaysCount: 0, warning1DayCount: 0 };
    }
  }
}

export const expirationService = new ExpirationService();
