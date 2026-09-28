/**
 * Group handlers for CENTRAL DE TV
 * Manages group interactions, pinning check-in notices, and user check-in button clicks.
 */

import { Context, InlineKeyboard } from 'grammy';
import { db } from '../database/db.ts';
import { CONFIG } from '../config/config.ts';
import { formatDateTimeBR, calculateRemainingDays } from '../utils/validation.ts';

export async function handleGroupMessage(ctx: Context) {
  const chat = ctx.chat;
  if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) {
    return;
  }

  // Check if message is a command like /checkin or /iniciar
  const text = ctx.message?.text || '';
  if (text.startsWith('/checkin') || text.startsWith('/central') || text.startsWith('/start')) {
    await sendGroupCheckInBanner(ctx);
  }
}

/**
 * Sends the official group check-in invitation banner with large button
 */
export async function sendGroupCheckInBanner(ctx: Context) {
  const keyboard = new InlineKeyboard().text('✅ FAZER CHECK-IN', 'action_do_checkin');

  const bannerText = `🎬 *CENTRAL DE TV*\n\nPara liberar seu acesso à plataforma, faça seu check-in clicando no botão abaixo:`;

  await ctx.reply(bannerText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Handles callback when user clicks "✅ FAZER CHECK-IN" in a group or private
 */
export async function handleCheckInClick(ctx: Context, botInstance?: any) {
  try {
    const from = ctx.from;
    if (!from) {
      await ctx.answerCallbackQuery({ text: 'Não foi possível identificar seus dados.', show_alert: true });
      return;
    }

    const telegramId = String(from.id);
    const firstName = from.first_name || 'Usuário';
    const lastName = from.last_name || undefined;
    const username = from.username ? `@${from.username}` : undefined;
    const chat = ctx.chat;
    const groupId = chat ? String(chat.id) : undefined;
    const groupTitle = chat?.type === 'group' || chat?.type === 'supergroup' ? chat.title : 'Privado / Direto';

    // 1. Check if user is blocked
    const userRecord = db.getUser(telegramId);
    if (userRecord && userRecord.status === 'blocked') {
      await ctx.answerCallbackQuery({
        text: '❌ Seu acesso ao sistema está bloqueado pela administração.',
        show_alert: true,
      });
      return;
    }

    // 2. Check if user already has active access
    const activeAccess = db.getActiveAccessForUser(telegramId);
    if (activeAccess) {
      const remainingDays = calculateRemainingDays(activeAccess.expiration_date);
      await ctx.answerCallbackQuery({
        text: `🟢 Você já possui acesso ATIVO!\nRestam: ${remainingDays} dias.\nAbra o bot no privado para assistir aos canais.`,
        show_alert: true,
      });
      return;
    }

    // 3. Register user and check-in record as AGUARDANDO LIBERAÇÃO
    const { checkIn } = db.createCheckIn({
      telegramId,
      firstName,
      lastName,
      username: from.username,
      groupId,
      groupTitle,
    });

    // Acknowledge user immediately
    await ctx.answerCallbackQuery({
      text: '✅ Check-in realizado com sucesso! Sua solicitação foi enviada para o proprietário para liberação.',
      show_alert: true,
    });

    // 4. Notify Owner (Telegram ID 6918626496)
    const ownerId = CONFIG.OWNER_ID;
    const timestampStr = formatDateTimeBR(checkIn.timestamp);
    const nameDisplay = `${firstName}${lastName ? ' ' + lastName : ''}`;
    const usernameDisplay = username || 'Não configurado';

    const ownerNotice =
      `🔔 *NOVO CHECK-IN*\n\n` +
      `👤 *Nome:* ${nameDisplay}\n` +
      `📱 *Username:* ${usernameDisplay}\n` +
      `🆔 *Telegram ID:* \`${telegramId}\`\n` +
      `👥 *Grupo:* ${groupTitle}\n` +
      `🕐 *Data/hora:* ${timestampStr}\n` +
      `📌 *Status:* Aguardando liberação`;

    const ownerKeyboard = new InlineKeyboard()
      .text('(1 DIA)', `grant_ask:${checkIn.id}:1`)
      .text('(7 DIAS)', `grant_ask:${checkIn.id}:7`)
      .row()
      .text('(15 DIAS)', `grant_ask:${checkIn.id}:15`)
      .text('(30 DIAS)', `grant_ask:${checkIn.id}:30`)
      .row()
      .text('(PERSONALIZAR)', `grant_custom_ask:${checkIn.id}`)
      .text('(❌ RECUSAR)', `reject_ask:${checkIn.id}`);

    // Attempt to notify owner via Telegram API if bot instance is available
    if (botInstance && botInstance.api) {
      try {
        await botInstance.api.sendMessage(ownerId, ownerNotice, {
          parse_mode: 'Markdown',
          reply_markup: ownerKeyboard,
        });
      } catch (err: any) {
        console.warn(`[Bot] Could not send direct message to Owner ID ${ownerId}:`, err?.message || err);
      }
    }
  } catch (err: any) {
    console.error('[Bot] Error in handleCheckInClick:', err);
    try {
      await ctx.answerCallbackQuery({ text: 'Ocorreu um erro ao processar o check-in.', show_alert: true });
    } catch {}
  }
}
