/**
 * Telegram Bot Core Service for CENTRAL DE TV
 * Supports both Long Polling and Webhook modes, plus manual simulation.
 */

import { Bot, Context, InlineKeyboard } from 'grammy';
import { CONFIG } from '../config/config.ts';
import { db } from '../database/db.ts';
import { expirationService } from '../services/expirationService.ts';
import { handleGroupMessage, handleCheckInClick, sendGroupCheckInBanner } from '../handlers/groupHandlers.ts';
import {
  handleStartCommand,
  handleChannelsMenu,
  handleMyAccess,
  handleInfoMenu,
  handleCategoryView,
  sendChannelCard,
  handleMoviesMenu,
  handleHighlightsMenu,
  handlePrivateMenu,
  handlePrivateRequestAccess,
  handlePrivateContentView,
  handleVazadosMenu,
  handleVazadoDetail,
  handleAdultMenu,
  handleAdultConfirmAge,
} from '../handlers/userHandlers.ts';
import { broadcastNewContentNotification } from '../services/notificationService.ts';
import {
  handleAdminCommand,
  sendAdminMainMenu,
  handleGrantAsk,
  handleGrantConfirm,
  handleRejectAsk,
  handleRejectConfirm,
  handleAdminPending,
  handleAdminActive,
  handleAdminStats,
  handleAdminChannels,
  handleAdminChannelDetail,
  handleAdminToggleChannelStatus,
  handleAdminDeleteChannelAsk,
  handleAdminDeleteChannelConfirm,
  handleAdminBackup,
  handleAdminBackupDownload,
  handleAdminBackupGenerate,
  handleAdminMovies,
  handleAdminMovieDetail,
  handleAdminToggleMovie,
  handleAdminDeleteMovie,
  handleAdminHighlights,
  handleAdminHighlightDetail,
  handleAdminToggleHighlight,
  handleAdminDeleteHighlight,
  handleAdminAdult,
  handleAdminAdultRequests,
  handleAdminAdultGrant,
  handleAdminAdultReject,
  handleAdminAdultContents,
  handleAdminAdultContentDetail,
  handleAdminToggleAdultContent,
  handleAdminDeleteAdultContent,
} from '../admin/adminHandlers.ts';

// State tracking for Owner (ID 6918626496) registration flows
const ownerLinkInputState = new Map<string, { contentId: string }>();
const pendingLinkConfirmations = new Map<string, { contentId: string; link: string }>();

const ownerLiveInputState = new Map<
  string,
  { step: 'url' | 'title' | 'description' | 'extra_url'; url?: string; title?: string; description?: string }
>();
const pendingLiveConfirmations = new Map<
  string,
  { url: string; extra_url?: string; title: string; description: string; platform: string }
>();

const ownerVazadoInputState = new Map<
  string,
  {
    step: 'url' | 'title' | 'description' | 'edit_link' | 'edit_title' | 'edit_desc';
    vazadoId?: string;
    url?: string;
    title?: string;
  }
>();
const pendingVazadoConfirmations = new Map<
  string,
  { url: string; title: string; description: string; itemNumber: number; displayName: string }
>();

class TelegramBotManager {
  private bot: Bot | null = null;
  private isPolling = false;
  private currentToken = '';

  constructor() {
    this.currentToken = CONFIG.TELEGRAM_BOT_TOKEN;
  }

  getBot(): Bot | null {
    return this.bot;
  }

  isConfigured(): boolean {
    return !!this.currentToken && this.currentToken.length > 10;
  }

  isRunning(): boolean {
    return this.isPolling;
  }

  /**
   * Initializes or re-initializes the bot with a token
   */
  async initialize(token?: string): Promise<{ success: boolean; username?: string; error?: string }> {
    const targetToken = token || this.currentToken || process.env.TELEGRAM_BOT_TOKEN;

    if (!targetToken || targetToken.trim().length < 10) {
      console.log('[Bot] No valid TELEGRAM_BOT_TOKEN found. Bot is waiting for configuration.');
      return { success: false, error: 'Token do Telegram não informado.' };
    }

    try {
      if (this.bot && this.isPolling) {
        await this.stop();
      }

      this.currentToken = targetToken.trim();
      const bot = new Bot(this.currentToken);

      // Verify token with getMe
      const me = await bot.api.getMe();
      console.log(`[Bot] Successfully verified bot: @${me.username} (${me.first_name})`);

      db.updateSettings({
        bot_username: me.username || '',
        telegram_token_configured: true,
      });

      // Hook bot up to ExpirationService so it can send warning/expired messages
      expirationService.setSendMessageFunction(async (chatId, text) => {
        try {
          await bot.api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
          return true;
        } catch (e: any) {
          console.warn(`[Bot] Failed to send expiration message to ${chatId}:`, e?.message);
          return false;
        }
      });

      // Register middlewares and handlers
      this.setupHandlers(bot);

      this.bot = bot;
      return { success: true, username: me.username };
    } catch (err: any) {
      console.error('[Bot] Failed to initialize bot with token:', err?.message || err);
      return { success: false, error: err?.message || 'Falha ao autenticar token no Telegram.' };
    }
  }

  private setupHandlers(bot: Bot) {
    // Global error handler to prevent unhandled rejection crashes
    bot.catch((err) => {
      const ctx = err.ctx;
      console.warn(`[Bot] Error while handling update ${ctx.update.update_id}:`, err.error);
    });

    // 1. Group commands & messages
    bot.chatType(['group', 'supergroup']).use(async (ctx, next) => {
      await handleGroupMessage(ctx);
      return next();
    });

    // 2. Commands
    bot.command('start', async (ctx) => {
      if (ctx.chat.type === 'private') {
        await handleStartCommand(ctx);
      } else {
        await sendGroupCheckInBanner(ctx);
      }
    });

    bot.command('admin', async (ctx) => {
      await handleAdminCommand(ctx);
    });

    bot.command('backup', async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const id = String(from.id);
      if (!db.isOwner(id) && !db.isAdmin(id)) {
        await ctx.reply('⛔ Acesso restrito à administração do sistema.');
        return;
      }
      await handleAdminBackup(ctx, false);
    });

    bot.command('checkin', async (ctx) => {
      await sendGroupCheckInBanner(ctx);
    });

    bot.command('central', async (ctx) => {
      if (ctx.chat.type === 'private') {
        await handleStartCommand(ctx);
      } else {
        await sendGroupCheckInBanner(ctx);
      }
    });

    // 👑 COMANDO EXCLUSIVO DO DONO: /adulto e /privado
    bot.command(['adulto', 'privado'], async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const id = String(from.id);

      if (id !== CONFIG.OWNER_ID) {
        await ctx.reply('⛔ Você não possui permissão para esta função.');
        return;
      }

      const kb = new InlineKeyboard()
        .text('🔗 CONTEÚDO 01', 'priv_view:private_01')
        .row()
        .text('🔗 CONTEÚDO 02', 'priv_view:private_02')
        .row()
        .text('🔐 VAZADOS', 'menu_vazados')
        .row()
        .text('⬅️ MENU PRINCIPAL', 'menu_start_back');

      await ctx.reply(
        `👑 *PAINEL PRIVADO — DONO*\n\n` +
        `Proprietário: \`${CONFIG.OWNER_ID}\`\n\n` +
        `Selecione o conteúdo para cadastrar ou gerenciar:`,
        { parse_mode: 'Markdown', reply_markup: kb }
      );
    });

    // 👑 COMANDO EXCLUSIVO DO DONO: /vazados
    bot.command('vazados', async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const id = String(from.id);

      if (id !== CONFIG.OWNER_ID) {
        await ctx.reply('⛔ Você não possui permissão para esta função.');
        return;
      }

      ownerVazadoInputState.set(id, { step: 'url' });
      await ctx.reply(
        `🔐 *NOVO CONTEÚDO VAZADO*\n\n` +
        `1️⃣ Envie o link do conteúdo:`,
        { parse_mode: 'Markdown' }
      );
    });

    // 👑 COMANDO EXCLUSIVO DO DONO: /live
    bot.command('live', async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const id = String(from.id);

      if (id !== CONFIG.OWNER_ID) {
        await ctx.reply('⛔ Você não possui permissão para esta função.');
        return;
      }

      ownerLiveInputState.set(id, { step: 'url' });
      await ctx.reply('📡 1️⃣ Envie o link da transmissão que deseja adicionar.');
    });

    // 3. Text Message Listener (para cadastro de links, vazados e lives do proprietário)
    bot.on('message:text', async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const id = String(from.id);

      // Apenas o proprietário 6918626496 possui fluxos interativos de texto
      if (id === CONFIG.OWNER_ID) {
        // Fluxo de cadastro/alteração de link em CONTEÚDO 01 ou CONTEÚDO 02
        if (ownerLinkInputState.has(id)) {
          const state = ownerLinkInputState.get(id)!;
          const link = ctx.message.text.trim();
          ownerLinkInputState.delete(id);

          const tempKey = `${Date.now()}`;
          pendingLinkConfirmations.set(tempKey, { contentId: state.contentId, link });

          const content = db.getPrivateContent(state.contentId);
          const kb = new InlineKeyboard()
            .text('✅ CONFIRMAR', `priv_confirm:${state.contentId}:${tempKey}`)
            .text('❌ CANCELAR', 'priv_cancel');

          await ctx.reply(
            `Link recebido:\n\n\`${link}\``,
            { parse_mode: 'Markdown', reply_markup: kb }
          );
          return;
        }

        // Fluxo de /live: URL -> Título -> Descrição -> Link Extra -> Confirmação
        if (ownerLiveInputState.has(id)) {
          const state = ownerLiveInputState.get(id)!;

          if (state.step === 'url') {
            state.url = ctx.message.text.trim();
            state.step = 'title';
            await ctx.reply('📝 2️⃣ Envie o título da transmissão.');
            return;
          }

          if (state.step === 'title') {
            state.title = ctx.message.text.trim();
            state.step = 'description';
            await ctx.reply('📄 3️⃣ Envie uma descrição curta.');
            return;
          }

          if (state.step === 'description') {
            state.description = ctx.message.text.trim();
            state.step = 'extra_url';
            const kb = new InlineKeyboard().text('⏭️ PULAR LINK EXTRA', 'live_skip_extra');
            await ctx.reply(
              `📎 4️⃣ Envie o Link Extra (opcional) ou clique no botão abaixo para pular:`,
              { reply_markup: kb }
            );
            return;
          }

          if (state.step === 'extra_url') {
            const extraText = ctx.message.text.trim();
            const lower = extraText.toLowerCase();
            let extra_url: string | undefined = undefined;
            if (lower !== 'pular' && lower !== 'nenhum' && lower !== 'nao' && lower !== 'não') {
              extra_url = extraText.startsWith('http://') || extraText.startsWith('https://')
                ? extraText
                : `https://${extraText}`;
            }

            const tempKey = `${Date.now()}`;
            let platform = 'Transmissão Ao Vivo';
            const lowerUrl = (state.url || '').toLowerCase();
            if (lowerUrl.includes('youtube')) platform = 'YouTube';
            else if (lowerUrl.includes('twitch')) platform = 'Twitch';
            else if (lowerUrl.includes('kick')) platform = 'Kick';
            else if (lowerUrl.includes('tiktok')) platform = 'TikTok';

            pendingLiveConfirmations.set(tempKey, {
              url: state.url!,
              extra_url,
              title: state.title!,
              description: state.description || '',
              platform,
            });
            ownerLiveInputState.delete(id);

            const kb = new InlineKeyboard()
              .text('✅ CONFIRMAR', `live_confirm:${tempKey}`)
              .text('❌ CANCELAR', 'live_cancel');

            await ctx.reply(
              `⭐ *CONFIRMAR DESTAQUE*\n\n` +
              `Título:\n${state.title}\n\n` +
              `Descrição:\n${state.description || ''}\n\n` +
              `Link Principal:\n\`${state.url}\`\n\n` +
              (extra_url ? `Link Extra:\n\`${extra_url}\`` : `Link Extra: _Nenhum_`),
              { parse_mode: 'Markdown', reply_markup: kb }
            );
            return;
          }
        }

        // Fluxo de /vazados e edição de vazados
        if (ownerVazadoInputState.has(id)) {
          const state = ownerVazadoInputState.get(id)!;

          if (state.step === 'url') {
            state.url = ctx.message.text.trim();
            state.step = 'title';
            await ctx.reply('📝 2️⃣ Envie o título do conteúdo:');
            return;
          }

          if (state.step === 'title') {
            state.title = ctx.message.text.trim();
            state.step = 'description';
            await ctx.reply('📄 3️⃣ Envie uma descrição do conteúdo:');
            return;
          }

          if (state.step === 'description') {
            const desc = ctx.message.text.trim();
            const existing = db.getVazados(false);
            const maxNum = existing.reduce((max, item) => Math.max(max, item.item_number || 0), 0);
            const nextNum = maxNum + 1;
            const nextDisplayName = `Conteúdo ${String(nextNum).padStart(2, '0')}`;

            const tempKey = `${Date.now()}`;
            pendingVazadoConfirmations.set(tempKey, {
              url: state.url!,
              title: state.title!,
              description: desc,
              itemNumber: nextNum,
              displayName: nextDisplayName,
            });
            ownerVazadoInputState.delete(id);

            const kb = new InlineKeyboard()
              .text('✅ CONFIRMAR', `vaz_confirm:${tempKey}`)
              .text('❌ CANCELAR', 'vaz_cancel');

            await ctx.reply(
              `🔐 *CONFIRMAR NOVO VAZADO*\n\n` +
              `Item: *${nextDisplayName}*\n` +
              `Título:\n${state.title}\n\n` +
              `Descrição:\n${desc}\n\n` +
              `Link:\n\`${state.url}\``,
              { parse_mode: 'Markdown', reply_markup: kb }
            );
            return;
          }

          // Edições de vazados existentes
          if (state.step === 'edit_link' && state.vazadoId) {
            const newLink = ctx.message.text.trim();
            ownerVazadoInputState.delete(id);
            db.updateVazado(state.vazadoId, { url: newLink }, id);
            await ctx.reply('✅ Link atualizado com sucesso!');
            await handleVazadoDetail(ctx, state.vazadoId);
            return;
          }

          if (state.step === 'edit_title' && state.vazadoId) {
            const newTitle = ctx.message.text.trim();
            ownerVazadoInputState.delete(id);
            db.updateVazado(state.vazadoId, { title: newTitle }, id);
            await ctx.reply('✅ Título atualizado com sucesso!');
            await handleVazadoDetail(ctx, state.vazadoId);
            return;
          }

          if (state.step === 'edit_desc' && state.vazadoId) {
            const newDesc = ctx.message.text.trim();
            ownerVazadoInputState.delete(id);
            db.updateVazado(state.vazadoId, { description: newDesc }, id);
            await ctx.reply('✅ Descrição atualizada com sucesso!');
            await handleVazadoDetail(ctx, state.vazadoId);
            return;
          }
        }
      }
    });

    // 4. Callback queries
    bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;

      try {
        // --- Group & Check-in actions ---
        if (data === 'action_do_checkin') {
          await handleCheckInClick(ctx, bot);
          return;
        }

        // --- User navigation ---
        if (data === 'menu_start_back') {
          await handleStartCommand(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'menu_channels') {
          await handleChannelsMenu(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'menu_my_access') {
          await handleMyAccess(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'menu_info') {
          await handleInfoMenu(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('view_cat:')) {
          const catId = data.replace('view_cat:', '');
          await handleCategoryView(ctx, catId);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'view_all_channels') {
          await handleCategoryView(ctx, 'all');
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('chan_nav:')) {
          const parts = data.split(':');
          const catFilter = parts[1];
          const targetIndex = parseInt(parts[2], 10);
          const allActive = db.getChannels(true);
          const list = catFilter === 'all' ? allActive : allActive.filter((c) => c.category_id === catFilter);
          await sendChannelCard(ctx, list, targetIndex, catFilter);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        // --- Movies, Highlights & +18 User Navigation ---
        if (data === 'menu_movies') {
          await handleMoviesMenu(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'menu_highlights') {
          await handleHighlightsMenu(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        // --- 🔐 PRIVADO Navigation & Content Handling ---
        if (data === 'menu_private' || data === 'menu_adult') {
          await handlePrivateMenu(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'priv_request_access' || data === 'adult_confirm_age') {
          await handlePrivateRequestAccess(ctx, bot);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('priv_view:')) {
          const contentId = data.replace('priv_view:', '');
          await handlePrivateContentView(ctx, contentId);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('priv_add:')) {
          const contentId = data.replace('priv_add:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Você não possui permissão para esta função.', show_alert: true });
            return;
          }
          ownerLinkInputState.set(String(from.id), { contentId });
          const content = db.getPrivateContent(contentId);
          const kb = new InlineKeyboard().text('❌ CANCELAR', 'priv_cancel');
          await ctx.reply(
            `🔗 *CADASTRAR LINK — ${content?.name || 'CONTEÚDO'}*\n\nEnvie o link:`,
            { parse_mode: 'Markdown', reply_markup: kb }
          );
          await ctx.answerCallbackQuery();
          return;
        }

        if (data.startsWith('priv_remove:')) {
          const contentId = data.replace('priv_remove:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Você não possui permissão para esta função.', show_alert: true });
            return;
          }
          const content = db.getPrivateContent(contentId);
          const kb = new InlineKeyboard()
            .text('✅ CONFIRMAR REMOÇÃO', `priv_del_confirm:${contentId}`)
            .row()
            .text('❌ CANCELAR', `priv_view:${contentId}`);
          await ctx.editMessageText(
            `🗑️ *REMOVER LINK*\n\nTem certeza que deseja apagar o link do *${content?.name || 'CONTEÚDO'}*?`,
            { parse_mode: 'Markdown', reply_markup: kb }
          );
          await ctx.answerCallbackQuery();
          return;
        }

        if (data.startsWith('priv_del_confirm:')) {
          const contentId = data.replace('priv_del_confirm:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          db.clearPrivateContentUrl(contentId, String(from.id));
          await ctx.answerCallbackQuery({ text: 'Link removido com sucesso!' });
          await handlePrivateContentView(ctx, contentId);
          return;
        }

        if (data.startsWith('priv_confirm:')) {
          const parts = data.split(':');
          const contentId = parts[1];
          const tempKey = parts[2];
          const pending = pendingLinkConfirmations.get(tempKey);
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          if (pending) {
            db.savePrivateContentUrl(contentId, pending.link, String(from.id));
            pendingLinkConfirmations.delete(tempKey);
            const content = db.getPrivateContent(contentId);
            const kb = new InlineKeyboard()
              .url('▶️ ACESSAR', pending.link)
              .row()
              .text('⬅️ VOLTAR AO PRIVADO', 'menu_private');
            await ctx.editMessageText(
              `✅ *CONFIRMADO!*\n\nLink salvo no *${content?.name || 'CONTEÚDO'}* com sucesso!\n\nLink:\n\`${pending.link}\``,
              { parse_mode: 'Markdown', reply_markup: kb }
            );
            await ctx.answerCallbackQuery({ text: 'Link salvo com sucesso!' });

            // Disparar notificação automática para todos os usuários com acesso ativo
            if (bot) {
              broadcastNewContentNotification(
                bot.api,
                'Privado',
                content?.name || 'CONTEÚDO 01',
                pending.link,
                'menu_private'
              ).catch((e: any) => console.warn('[Bot] Failed to broadcast private notification:', e?.message));
            }
          } else {
            await ctx.answerCallbackQuery({ text: 'Confirmação expirada.', show_alert: true });
            await handlePrivateMenu(ctx);
          }
          return;
        }

        if (data === 'priv_cancel') {
          const from = ctx.from;
          if (from) {
            ownerLinkInputState.delete(String(from.id));
          }
          await ctx.editMessageText('❌ Operação cancelada.', {
            reply_markup: new InlineKeyboard().text('⬅️ VOLTAR AO PRIVADO', 'menu_private'),
          });
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        // --- 🔐 VAZADOS Navigation & Management ---
        if (data === 'menu_vazados') {
          await handleVazadosMenu(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('vaz_view:')) {
          const vazadoId = data.replace('vaz_view:', '');
          await handleVazadoDetail(ctx, vazadoId);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'vaz_add_start') {
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Apenas o proprietário pode adicionar.', show_alert: true });
            return;
          }
          ownerVazadoInputState.set(String(from.id), { step: 'url' });
          const kb = new InlineKeyboard().text('❌ CANCELAR', 'vaz_cancel');
          await ctx.reply(
            `🔐 *NOVO CONTEÚDO VAZADO*\n\n1️⃣ Envie o link do conteúdo:`,
            { parse_mode: 'Markdown', reply_markup: kb }
          );
          await ctx.answerCallbackQuery();
          return;
        }

        if (data.startsWith('vaz_confirm:')) {
          const tempKey = data.replace('vaz_confirm:', '');
          const pending = pendingVazadoConfirmations.get(tempKey);
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          if (pending) {
            const created = db.createVazado({
              title: pending.title,
              description: pending.description,
              url: pending.url,
              created_by: String(from.id),
            });
            pendingVazadoConfirmations.delete(tempKey);

            const kb = new InlineKeyboard()
              .url('▶️ ACESSAR', created.url)
              .row()
              .text('🔐 VER VAZADOS', 'menu_vazados')
              .row()
              .text('⬅️ VOLTAR AO PRIVADO', 'menu_private');

            await ctx.editMessageText(
              `✅ *NOVO CONTEÚDO VAZADO SALVO!*\n\n` +
              `Item: *${created.display_name}*\n` +
              `Título: *${created.title}*\n` +
              `Descrição:\n${created.description || 'Sem descrição'}\n\n` +
              `Link:\n\`${created.url}\``,
              { parse_mode: 'Markdown', reply_markup: kb }
            );
            await ctx.answerCallbackQuery({ text: 'Vazado cadastrado com sucesso!' });

            // Disparar notificação automática para todos os usuários com acesso ativo
            if (bot) {
              broadcastNewContentNotification(
                bot.api,
                'Vazados',
                `${created.display_name} - ${created.title}`,
                created.url,
                'menu_vazados'
              ).catch((e: any) => console.warn('[Bot] Failed to broadcast vazado notification:', e?.message));
            }
          } else {
            await ctx.answerCallbackQuery({ text: 'Confirmação expirada.', show_alert: true });
            await handleVazadosMenu(ctx);
          }
          return;
        }

        if (data === 'vaz_cancel') {
          const from = ctx.from;
          if (from) {
            ownerVazadoInputState.delete(String(from.id));
          }
          await ctx.editMessageText('❌ Operação de Vazados cancelada.', {
            reply_markup: new InlineKeyboard().text('⬅️ VOLTAR AOS VAZADOS', 'menu_vazados'),
          });
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('vaz_edit_link:')) {
          const vazadoId = data.replace('vaz_edit_link:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          ownerVazadoInputState.set(String(from.id), { step: 'edit_link', vazadoId });
          const item = db.getVazado(vazadoId);
          await ctx.reply(
            `✏️ *ALTERAR LINK — ${item?.display_name || 'VAZADO'}*\n\nEnvie o novo endereço do link:`,
            { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('❌ CANCELAR', `vaz_view:${vazadoId}`) }
          );
          await ctx.answerCallbackQuery();
          return;
        }

        if (data.startsWith('vaz_edit_title:')) {
          const vazadoId = data.replace('vaz_edit_title:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          ownerVazadoInputState.set(String(from.id), { step: 'edit_title', vazadoId });
          const item = db.getVazado(vazadoId);
          await ctx.reply(
            `✏️ *ALTERAR TÍTULO — ${item?.display_name || 'VAZADO'}*\n\nEnvie o novo título:`,
            { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('❌ CANCELAR', `vaz_view:${vazadoId}`) }
          );
          await ctx.answerCallbackQuery();
          return;
        }

        if (data.startsWith('vaz_edit_desc:')) {
          const vazadoId = data.replace('vaz_edit_desc:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          ownerVazadoInputState.set(String(from.id), { step: 'edit_desc', vazadoId });
          const item = db.getVazado(vazadoId);
          await ctx.reply(
            `✏️ *ALTERAR DESCRIÇÃO — ${item?.display_name || 'VAZADO'}*\n\nEnvie a nova descrição:`,
            { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('❌ CANCELAR', `vaz_view:${vazadoId}`) }
          );
          await ctx.answerCallbackQuery();
          return;
        }

        if (data.startsWith('vaz_toggle:')) {
          const vazadoId = data.replace('vaz_toggle:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          const updated = db.toggleVazadoStatus(vazadoId, String(from.id));
          await ctx.answerCallbackQuery({
            text: `Conteúdo agora está ${updated?.status === 'active' ? 'ATIVO' : 'DESATIVADO'}`,
          });
          await handleVazadoDetail(ctx, vazadoId);
          return;
        }

        if (data.startsWith('vaz_del_ask:')) {
          const vazadoId = data.replace('vaz_del_ask:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          const item = db.getVazado(vazadoId);
          const kb = new InlineKeyboard()
            .text('🗑️ CONFIRMAR EXCLUSÃO', `vaz_del_confirm:${vazadoId}`)
            .row()
            .text('❌ CANCELAR', `vaz_view:${vazadoId}`);
          await ctx.editMessageText(
            `⚠️ *EXCLUIR CONTEÚDO VAZADO*\n\nTem certeza que deseja apagar o *${item?.display_name || 'item'}* (${item?.title})?`,
            { parse_mode: 'Markdown', reply_markup: kb }
          );
          await ctx.answerCallbackQuery();
          return;
        }

        if (data.startsWith('vaz_del_confirm:')) {
          const vazadoId = data.replace('vaz_del_confirm:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          db.deleteVazado(vazadoId, String(from.id));
          await ctx.answerCallbackQuery({ text: 'Vazado excluído com sucesso!' });
          await handleVazadosMenu(ctx);
          return;
        }

        if (data.startsWith('vaz_reorder_up:')) {
          const vazadoId = data.replace('vaz_reorder_up:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          db.reorderVazado(vazadoId, 'up');
          await ctx.answerCallbackQuery({ text: 'Ordem alterada (subiu)!' });
          await handleVazadoDetail(ctx, vazadoId);
          return;
        }

        if (data.startsWith('vaz_reorder_down:')) {
          const vazadoId = data.replace('vaz_reorder_down:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          db.reorderVazado(vazadoId, 'down');
          await ctx.answerCallbackQuery({ text: 'Ordem alterada (desceu)!' });
          await handleVazadoDetail(ctx, vazadoId);
          return;
        }

        // --- Owner Approvals (Privado & Adulto) ---
        if (data.startsWith('priv_grant:') || data.startsWith('adult_grant:')) {
          const reqId = data.startsWith('priv_grant:')
            ? data.replace('priv_grant:', '')
            : data.replace('adult_grant:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Somente o proprietário pode aprovar.', show_alert: true });
            return;
          }
          const approved = db.approvePrivateAccess(reqId, String(from.id), '👑 DONO DO BOT');
          if (!approved) {
            await ctx.answerCallbackQuery({ text: 'Solicitação não encontrada.', show_alert: true });
            return;
          }
          await ctx.answerCallbackQuery({ text: 'Acesso liberado com sucesso!' });
          try {
            await ctx.editMessageText(
              `✅ *ACESSO LIBERADO*\n\n` +
              `👤 Usuário: *${approved.user_name}*\n` +
              `🆔 ID: \`${approved.telegram_id}\`\n\n` +
              `Acesso à área 🔐 PRIVADO liberado com sucesso!`,
              { parse_mode: 'Markdown' }
            );
          } catch {}
          if (bot) {
            const userMsg =
              `✅ *Seu acesso à área 🔐 PRIVADO foi liberado pelo administrador.*\n\n` +
              `Você já pode acessar os conteúdos disponíveis.`;
            const userKb = new InlineKeyboard().text('🔐 ACESSAR PRIVADO', 'menu_private');
            bot.api.sendMessage(approved.telegram_id, userMsg, { parse_mode: 'Markdown', reply_markup: userKb }).catch(() => {});
          }
          return;
        }

        if (data.startsWith('priv_reject:') || data.startsWith('adult_reject:')) {
          const reqId = data.startsWith('priv_reject:')
            ? data.replace('priv_reject:', '')
            : data.replace('adult_reject:', '');
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Somente o proprietário pode recusar.', show_alert: true });
            return;
          }
          const rejected = db.rejectPrivateAccess(reqId, String(from.id));
          if (!rejected) {
            await ctx.answerCallbackQuery({ text: 'Solicitação não encontrada.', show_alert: true });
            return;
          }
          await ctx.answerCallbackQuery({ text: 'Solicitação recusada.' });
          try {
            await ctx.editMessageText(
              `❌ *SOLICITAÇÃO RECUSADA*\n\n` +
              `👤 Usuário: *${rejected.user_name}*\n` +
              `🆔 ID: \`${rejected.telegram_id}\``,
              { parse_mode: 'Markdown' }
            );
          } catch {}
          if (bot) {
            bot.api.sendMessage(rejected.telegram_id, '❌ Solicitação de acesso não aprovada pelo administrador.').catch(() => {});
          }
          return;
        }

        // --- Live Highlight Confirmation Callbacks ---
        if (data === 'live_skip_extra') {
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          const state = ownerLiveInputState.get(String(from.id));
          if (!state || !state.url || !state.title) {
            await ctx.answerCallbackQuery({ text: 'Sessão expirada.', show_alert: true });
            return;
          }

          const tempKey = `${Date.now()}`;
          let platform = 'Transmissão Ao Vivo';
          const lowerUrl = (state.url || '').toLowerCase();
          if (lowerUrl.includes('youtube')) platform = 'YouTube';
          else if (lowerUrl.includes('twitch')) platform = 'Twitch';
          else if (lowerUrl.includes('kick')) platform = 'Kick';
          else if (lowerUrl.includes('tiktok')) platform = 'TikTok';

          pendingLiveConfirmations.set(tempKey, {
            url: state.url,
            extra_url: undefined,
            title: state.title,
            description: state.description || '',
            platform,
          });
          ownerLiveInputState.delete(String(from.id));

          const kb = new InlineKeyboard()
            .text('✅ CONFIRMAR', `live_confirm:${tempKey}`)
            .text('❌ CANCELAR', 'live_cancel');

          await ctx.editMessageText(
            `⭐ *CONFIRMAR DESTAQUE*\n\n` +
            `Título:\n${state.title}\n\n` +
            `Descrição:\n${state.description || ''}\n\n` +
            `Link Principal:\n\`${state.url}\`\n\n` +
            `Link Extra: _Nenhum_`,
            { parse_mode: 'Markdown', reply_markup: kb }
          );
          await ctx.answerCallbackQuery();
          return;
        }

        if (data.startsWith('live_confirm:')) {
          const tempKey = data.replace('live_confirm:', '');
          const pending = pendingLiveConfirmations.get(tempKey);
          const from = ctx.from;
          if (!from || String(from.id) !== CONFIG.OWNER_ID) {
            await ctx.answerCallbackQuery({ text: '⛔ Permissão negada.', show_alert: true });
            return;
          }
          if (pending) {
            db.createHighlight({
              title: pending.title,
              description: pending.description,
              url: pending.url,
              extra_url: pending.extra_url,
              platform: pending.platform,
              category: 'Ao Vivo',
              is_live: true,
              is_active: true,
              is_featured: true,
              order: 1,
            });
            pendingLiveConfirmations.delete(tempKey);
            await ctx.editMessageText(
              `⭐ *DESTAQUE ADICIONADO COM SUCESSO!*\n\n` +
              `Título: *${pending.title}*\n` +
              `Plataforma: ${pending.platform}\n` +
              `Link Principal: \`${pending.url}\`\n\n` +
              (pending.extra_url ? `Link Extra: \`${pending.extra_url}\`\n\n` : '') +
              `Já está disponível na aba ⭐ DESTAQUES.`,
              {
                parse_mode: 'Markdown',
                reply_markup: new InlineKeyboard().text('⭐ VER DESTAQUES', 'menu_highlights'),
              }
            );
            await ctx.answerCallbackQuery({ text: 'Destaque cadastrado!' });

            // Disparar notificação automática para todos os usuários com acesso ativo
            if (bot) {
              broadcastNewContentNotification(
                bot.api,
                'Destaques',
                pending.title,
                pending.url,
                'menu_highlights'
              ).catch((e: any) => console.warn('[Bot] Failed to broadcast live notification:', e?.message));
            }
          } else {
            await ctx.answerCallbackQuery({ text: 'Confirmação expirada.', show_alert: true });
          }
          return;
        }

        if (data === 'live_cancel') {
          const from = ctx.from;
          if (from) {
            ownerLiveInputState.delete(String(from.id));
          }
          await ctx.editMessageText('❌ Cadastro de transmissão cancelado.');
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        // --- Admin actions ---
        if (data === 'admin_main') {
          await sendAdminMainMenu(ctx, true);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'admin_movies') {
          await handleAdminMovies(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('movie_view:')) {
          const movieId = data.replace('movie_view:', '');
          await handleAdminMovieDetail(ctx, movieId);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('movie_toggle:')) {
          const movieId = data.replace('movie_toggle:', '');
          await handleAdminToggleMovie(ctx, movieId);
          return;
        }

        if (data.startsWith('movie_del:')) {
          const movieId = data.replace('movie_del:', '');
          await handleAdminDeleteMovie(ctx, movieId);
          return;
        }

        if (data === 'admin_highlights') {
          await handleAdminHighlights(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('hl_view:')) {
          const hlId = data.replace('hl_view:', '');
          await handleAdminHighlightDetail(ctx, hlId);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('hl_toggle:')) {
          const hlId = data.replace('hl_toggle:', '');
          await handleAdminToggleHighlight(ctx, hlId);
          return;
        }

        if (data.startsWith('hl_del:')) {
          const hlId = data.replace('hl_del:', '');
          await handleAdminDeleteHighlight(ctx, hlId);
          return;
        }

        if (data === 'admin_adult' || data === 'admin_private') {
          await handleAdminAdult(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'adult_adm_requests') {
          await handleAdminAdultRequests(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'adult_adm_links') {
          await handleAdminAdultContents(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('adult_c_view:')) {
          const contentId = data.replace('adult_c_view:', '');
          await handleAdminAdultContentDetail(ctx, contentId);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('adult_c_toggle:')) {
          const contentId = data.replace('adult_c_toggle:', '');
          await handleAdminToggleAdultContent(ctx, contentId);
          return;
        }

        if (data.startsWith('adult_c_del:')) {
          const contentId = data.replace('adult_c_del:', '');
          await handleAdminDeleteAdultContent(ctx, contentId);
          return;
        }


        if (data === 'admin_pending') {
          await handleAdminPending(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'admin_active') {
          await handleAdminActive(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'admin_stats') {
          await handleAdminStats(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'admin_backup') {
          await handleAdminBackup(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data === 'admin_backup_download') {
          await handleAdminBackupDownload(ctx);
          return;
        }

        if (data === 'admin_backup_generate') {
          await handleAdminBackupGenerate(ctx);
          return;
        }

        if (data === 'admin_channels') {
          await handleAdminChannels(ctx);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('chan_view:')) {
          const channelId = data.replace('chan_view:', '');
          await handleAdminChannelDetail(ctx, channelId);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('chan_toggle:')) {
          const channelId = data.replace('chan_toggle:', '');
          await handleAdminToggleChannelStatus(ctx, channelId);
          return;
        }

        if (data.startsWith('chan_del_ask:')) {
          const channelId = data.replace('chan_del_ask:', '');
          await handleAdminDeleteChannelAsk(ctx, channelId);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('chan_del_confirm:')) {
          const channelId = data.replace('chan_del_confirm:', '');
          await handleAdminDeleteChannelConfirm(ctx, channelId);
          return;
        }

        if (data === 'chan_new_ask') {
          await ctx.answerCallbackQuery({
            text: 'Para cadastrar um novo canal com validação de URL oficial e metadados, acesse a aba "Canais" no Painel Web ou envie os dados.',
            show_alert: true,
          });
          return;
        }

        // Approval flow
        if (data.startsWith('grant_ask:')) {
          const [, checkinId, daysStr] = data.split(':');
          await handleGrantAsk(ctx, checkinId, parseInt(daysStr, 10));
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('grant_custom_ask:')) {
          const checkinId = data.replace('grant_custom_ask:', '');
          // Default custom prompt asks for 60 days
          await handleGrantAsk(ctx, checkinId, 60);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('grant_confirm:')) {
          const [, checkinId, daysStr] = data.split(':');
          await handleGrantConfirm(ctx, checkinId, parseInt(daysStr, 10), bot);
          return;
        }

        if (data.startsWith('grant_cancel:')) {
          await ctx.editMessageText('❌ Operação cancelada.');
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('reject_ask:')) {
          const checkinId = data.replace('reject_ask:', '');
          await handleRejectAsk(ctx, checkinId);
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }

        if (data.startsWith('reject_confirm:')) {
          const checkinId = data.replace('reject_confirm:', '');
          await handleRejectConfirm(ctx, checkinId, bot);
          return;
        }

        if (data === 'noop') {
          try {
            await ctx.answerCallbackQuery();
          } catch {}
          return;
        }
      } catch (err: any) {
        console.error('[Bot] Error processing callback query:', err);
        try {
          await ctx.answerCallbackQuery({ text: 'Ocorreu um erro ao processar a ação.', show_alert: true });
        } catch {}
      }
    });

    // Error handler
    bot.catch((err) => {
      console.error('[Bot] Unhandled Grammy error:', err.error);
    });
  }

  /**
   * Starts long-polling mode
   */
  async startPolling() {
    if (!this.bot) {
      const initRes = await this.initialize();
      if (!initRes.success) {
        throw new Error(initRes.error);
      }
    }

    if (this.isPolling) return;

    this.isPolling = true;
    console.log('[Bot] Starting long-polling...');

    // Run polling in background
    this.bot!.start({
      onStart: (botInfo) => {
        console.log(`[Bot] Long-polling started successfully as @${botInfo.username}`);
      },
    }).catch((err) => {
      console.error('[Bot] Polling stopped with error:', err);
      this.isPolling = false;
    });
  }

  /**
   * Stops polling
   */
  async stop() {
    if (this.bot && this.isPolling) {
      await this.bot.stop();
      this.isPolling = false;
      console.log('[Bot] Polling stopped.');
    }
  }

  /**
   * Sets Telegram Webhook URL
   */
  async setWebhook(webhookUrl: string, secretToken?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.bot) {
      const initRes = await this.initialize();
      if (!initRes.success) {
        return { success: false, error: initRes.error || 'Token não configurado.' };
      }
    }
    if (!this.bot) {
      return { success: false, error: 'Instância do bot não pôde ser criada.' };
    }

    try {
      // 1. Stop polling if currently active
      await this.stop();

      // 2. Set webhook with Telegram API
      const options: { secret_token?: string; drop_pending_updates?: boolean } = {
        drop_pending_updates: false,
      };
      if (secretToken && secretToken.trim().length > 0) {
        options.secret_token = secretToken.trim();
      }

      await this.bot.api.setWebhook(webhookUrl.trim(), options);
      console.log(`[Bot] Webhook successfully registered to: ${webhookUrl}`);

      db.updateSettings({
        webhook_mode: true,
        webhook_url: webhookUrl.trim(),
        webhook_secret: secretToken?.trim() || undefined,
        last_webhook_status: 'active',
        last_webhook_error: undefined,
        last_webhook_check: new Date().toISOString(),
      });

      return {
        success: true,
        message: `Webhook configurado com sucesso para: ${webhookUrl}`,
      };
    } catch (err: any) {
      console.error('[Bot] Failed to set webhook:', err);
      const errMsg = err?.message || 'Falha ao registrar Webhook na API do Telegram.';
      db.updateSettings({
        last_webhook_error: errMsg,
        last_webhook_check: new Date().toISOString(),
      });
      return { success: false, error: errMsg };
    }
  }

  /**
   * Deletes Telegram Webhook and switches back to Long Polling mode
   */
  async deleteWebhook(resumePolling = true): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.bot) {
      const initRes = await this.initialize();
      if (!initRes.success) {
        return { success: false, error: initRes.error || 'Token não configurado.' };
      }
    }
    if (!this.bot) {
      return { success: false, error: 'Bot não inicializado.' };
    }

    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      console.log('[Bot] Webhook deleted from Telegram.');

      db.updateSettings({
        webhook_mode: false,
        last_webhook_status: 'disabled',
        last_webhook_check: new Date().toISOString(),
      });

      if (resumePolling) {
        await this.startPolling();
      }

      return {
        success: true,
        message: 'Webhook removido. Modo de recepção alterado para Long Polling.',
      };
    } catch (err: any) {
      console.error('[Bot] Failed to delete webhook:', err);
      return { success: false, error: err?.message || 'Erro ao desativar webhook.' };
    }
  }

  /**
   * Queries Telegram API for the current Webhook status and health
   */
  async getWebhookInfo(): Promise<any> {
    if (!this.bot) {
      const initRes = await this.initialize();
      if (!initRes.success) {
        return {
          configured: false,
          error: initRes.error || 'Bot não configurado com token.',
        };
      }
    }
    if (!this.bot) {
      return { configured: false, error: 'Bot não inicializado.' };
    }

    try {
      const info = await this.bot.api.getWebhookInfo();
      db.updateSettings({
        last_webhook_check: new Date().toISOString(),
        last_webhook_error: info.last_error_message || undefined,
      });
      return {
        configured: true,
        isPolling: this.isPolling,
        info,
      };
    } catch (err: any) {
      console.error('[Bot] Error getting webhook info:', err);
      return {
        configured: true,
        error: err?.message || 'Falha ao consultar informações do Webhook no Telegram.',
      };
    }
  }

  /**
   * Processes a webhook update from Telegram
   */
  async handleWebhookUpdate(update: any) {
    if (!this.bot) {
      await this.initialize();
    }
    if (!this.bot) {
      throw new Error('Bot não inicializado.');
    }
    await this.bot.handleUpdate(update);
  }
}

export const telegramBot = new TelegramBotManager();
