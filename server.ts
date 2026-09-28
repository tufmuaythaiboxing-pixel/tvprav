/**
 * Server entrypoint for CENTRAL DE TV
 * Express server with Vite middleware in development and static assets in production.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/database/db.ts';
import { CONFIG } from './src/config/config.ts';
import { telegramBot } from './src/bot/telegramBot.ts';
import { expirationService } from './src/services/expirationService.ts';
import { backupService } from './src/services/backupService.ts';
import { broadcastNewContentNotification } from './src/services/notificationService.ts';
import { validateOfficialChannelUrl, calculateRemainingDays, formatDateBR } from './src/utils/validation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = CONFIG.PORT || 3000;

async function createServer() {
  const app = express();
  app.use(express.json());

  // Start background services (expiration checks & daily automatic backups)
  expirationService.start();
  backupService.start();

  // Try to start Telegram Bot if token exists in environment
  if (CONFIG.TELEGRAM_BOT_TOKEN) {
    telegramBot
      .initialize()
      .then((res) => {
        if (res.success) {
          console.log(`[Server] Telegram bot initialized as @${res.username}`);
          // Start polling automatically if not in webhook mode
          telegramBot.startPolling().catch((e) => {
            console.warn('[Server] Could not start polling automatically:', e.message);
          });
        }
      })
      .catch((e) => {
        console.warn('[Server] Bot init error:', e.message);
      });
  }

  // ==========================================
  // TELEGRAM WEBHOOK ENDPOINT
  // ==========================================
  app.post('/api/telegram-webhook', async (req, res) => {
    try {
      const settings = db.getSettings();
      // Verify Telegram Secret Token if configured
      if (settings.webhook_secret) {
        const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
        if (receivedSecret !== settings.webhook_secret) {
          console.warn('[Webhook] Unauthorized webhook call: invalid secret token header.');
          return res.status(403).json({ error: 'Invalid secret token' });
        }
      }

      await telegramBot.handleWebhookUpdate(req.body);
      res.status(200).send('OK');
    } catch (err: any) {
      console.error('[Webhook] Error processing update:', err?.message || err);
      res.status(500).send('Error');
    }
  });

  // ==========================================
  // REST API ROUTES
  // ==========================================

  // System Status
  app.get('/api/status', (req, res) => {
    const settings = db.getSettings();
    const stats = db.getStats();
    res.json({
      status: 'online',
      system_name: CONFIG.SYSTEM_NAME,
      owner_id: CONFIG.OWNER_ID,
      bot_configured: telegramBot.isConfigured(),
      bot_running: telegramBot.isRunning(),
      bot_username: settings.bot_username || null,
      app_url: CONFIG.APP_URL,
      webhook_mode: !!settings.webhook_mode,
      webhook_url: settings.webhook_url || null,
      webhook_secret_set: !!settings.webhook_secret,
      last_webhook_status: settings.last_webhook_status || (settings.webhook_mode ? 'active' : 'disabled'),
      last_webhook_error: settings.last_webhook_error || null,
      last_webhook_check: settings.last_webhook_check || null,
      stats,
    });
  });

  // System Stats
  app.get('/api/stats', (req, res) => {
    res.json(db.getStats());
  });

  // Get live webhook diagnostic info from Telegram API
  app.get('/api/bot/webhook-info', async (req, res) => {
    try {
      const result = await telegramBot.getWebhookInfo();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Falha ao consultar webhook' });
    }
  });

  // Configure Webhook URL and mode
  app.post('/api/bot/webhook', async (req, res) => {
    const { action, webhookUrl, secretToken } = req.body;

    if (action === 'set') {
      if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
        return res.status(400).json({ error: 'URL do Webhook inválida. Deve iniciar com https://' });
      }

      if (!webhookUrl.startsWith('https://') && !webhookUrl.includes('localhost') && !webhookUrl.includes('127.0.0.1')) {
        return res.status(400).json({
          error: 'O Telegram exige obrigatoriamente protocolo HTTPS com certificado válido para Webhooks.',
        });
      }

      const result = await telegramBot.setWebhook(webhookUrl, secretToken);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      db.logAction(
        CONFIG.OWNER_ID,
        'WEBHOOK_CONFIGURED',
        `Webhook configurado para: ${webhookUrl}`,
        'panel'
      );

      return res.json({ success: true, message: result.message });
    }

    if (action === 'delete') {
      const result = await telegramBot.deleteWebhook(true);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      db.logAction(
        CONFIG.OWNER_ID,
        'WEBHOOK_DISABLED',
        'Webhook desativado e alternado para Long Polling.',
        'panel'
      );

      return res.json({ success: true, message: result.message });
    }

    if (action === 'test_ping') {
      // Simulate/test pinging webhook endpoint internally
      return res.json({
        success: true,
        endpoint: '/api/telegram-webhook',
        message: 'Endpoint de Webhook pronto para receber conexões HTTP POST do Telegram.',
        timestamp: new Date().toISOString(),
      });
    }

    res.status(400).json({ error: 'Ação desconhecida (use set, delete ou test_ping)' });
  });

  // Bot Configuration & Reconnect
  app.post('/api/bot/configure', async (req, res) => {
    const { token, mode, webhookUrl, secretToken } = req.body;

    if (token) {
      const initResult = await telegramBot.initialize(token);
      if (!initResult.success) {
        return res.status(400).json({ error: initResult.error });
      }

      if (mode === 'webhook' && webhookUrl) {
        await telegramBot.setWebhook(webhookUrl, secretToken);
      } else if (mode === 'polling') {
        await telegramBot.deleteWebhook(false);
        await telegramBot.startPolling();
      }

      return res.json({
        success: true,
        username: initResult.username,
        message: `Bot conectado com sucesso como @${initResult.username}`,
      });
    }

    if (mode === 'polling') {
      await telegramBot.deleteWebhook(false);
      await telegramBot.startPolling();
      return res.json({ success: true, message: 'Long-polling iniciado com sucesso.' });
    }

    if (mode === 'stop') {
      await telegramBot.stop();
      return res.json({ success: true, message: 'Bot pausado.' });
    }

    res.json({ success: true });
  });

  // Users Management
  app.get('/api/users', (req, res) => {
    const search = ((req.query.search as string) || '').toLowerCase().trim();
    let users = db.getUsers();

    if (search) {
      users = users.filter(
        (u) =>
          u.id.includes(search) ||
          u.first_name.toLowerCase().includes(search) ||
          (u.last_name && u.last_name.toLowerCase().includes(search)) ||
          (u.username && u.username.toLowerCase().includes(search))
      );
    }

    // Attach active access details
    const enriched = users.map((u) => {
      const activeAccess = db.getActiveAccessForUser(u.id);
      return {
        ...u,
        active_access: activeAccess
          ? {
              ...activeAccess,
              remaining_days: calculateRemainingDays(activeAccess.expiration_date),
            }
          : null,
      };
    });

    res.json(enriched);
  });

  app.get('/api/users/:id', (req, res) => {
    const user = db.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const activeAccess = db.getActiveAccessForUser(user.id);
    const history = db.getUserAccessHistory(user.id);

    res.json({
      user,
      active_access: activeAccess
        ? {
            ...activeAccess,
            remaining_days: calculateRemainingDays(activeAccess.expiration_date),
          }
        : null,
      history,
    });
  });

  // Grant Access directly to user
  app.post('/api/users/:id/grant', (req, res) => {
    const { days, adminId, adminName } = req.body;
    const durationDays = parseInt(days, 10);
    if (!durationDays || durationDays <= 0) {
      return res.status(400).json({ error: 'Quantidade de dias inválida.' });
    }

    const user = db.getUser(req.params.id);
    const userName = user ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : 'Usuário';

    const access = db.createAccess({
      telegramId: req.params.id,
      userName,
      durationDays,
      grantedById: adminId || CONFIG.OWNER_ID,
      grantedByName: adminName || 'Administrador Central de TV',
    });

    res.json({ success: true, access });
  });

  // Block / Unblock User
  app.post('/api/users/:id/block', (req, res) => {
    const { reason } = req.body;
    const ok = db.blockUser(req.params.id, reason);
    if (!ok) {
      return res.status(400).json({ error: 'Não é possível bloquear o proprietário ou usuário inexistente.' });
    }
    res.json({ success: true });
  });

  app.post('/api/users/:id/unblock', (req, res) => {
    const ok = db.unblockUser(req.params.id);
    res.json({ success: ok });
  });

  // Check-ins
  app.get('/api/checkins', (req, res) => {
    res.json(db.getCheckIns());
  });

  app.post('/api/checkins/:id/approve', (req, res) => {
    const { days, adminId, adminName } = req.body;
    const durationDays = parseInt(days, 10) || 7;
    const checkin = db.getCheckIns().find((c) => c.id === req.params.id);

    if (!checkin) return res.status(404).json({ error: 'Check-in não encontrado' });

    const userFullName = `${checkin.first_name}${checkin.last_name ? ' ' + checkin.last_name : ''}`;
    const access = db.createAccess({
      telegramId: checkin.telegram_id,
      userName: userFullName,
      durationDays,
      grantedById: adminId || CONFIG.OWNER_ID,
      grantedByName: adminName || 'Administrador',
    });

    db.updateCheckInStatus(checkin.id, 'approved', adminId || CONFIG.OWNER_ID, durationDays, access.id);

    // Try to notify via bot if active
    const bot = telegramBot.getBot();
    if (bot) {
      const msg =
        `🎉 *ACESSO LIBERADO!*\n\n` +
        `👤 *${userFullName}*\n` +
        `🆔 \`${checkin.telegram_id}\`\n\n` +
        `📅 *Início:* ${formatDateBR(access.start_date)}\n` +
        `⏰ *Expira:* ${formatDateBR(access.expiration_date)}\n` +
        `⌛ *Duração:* ${durationDays} dias\n\n` +
        `Envie /start para acessar a Central de TV!`;
      bot.api.sendMessage(checkin.telegram_id, msg, { parse_mode: 'Markdown' }).catch(() => {});
    }

    res.json({ success: true, access });
  });

  app.post('/api/checkins/:id/reject', (req, res) => {
    const { adminId } = req.body;
    const checkin = db.updateCheckInStatus(req.params.id, 'rejected', adminId || CONFIG.OWNER_ID);
    if (!checkin) return res.status(404).json({ error: 'Check-in não encontrado' });

    // Try to notify
    const bot = telegramBot.getBot();
    if (bot) {
      bot.api
        .sendMessage(
          checkin.telegram_id,
          '❌ Sua solicitação de acesso à Central de TV não foi aprovada pela administração no momento.'
        )
        .catch(() => {});
    }

    res.json({ success: true });
  });

  // Channels Management
  app.get('/api/channels', (req, res) => {
    const onlyActive = req.query.active === 'true';
    res.json(db.getChannels(onlyActive));
  });

  app.post('/api/channels', (req, res) => {
    const {
      name,
      description,
      category_id,
      image_url,
      official_url,
      official_source,
      available_regions,
      content_type,
      status,
      admin_authorized,
      admin_id,
      admin_name,
      notes,
    } = req.body;

    if (!name || !official_url || !official_source || !category_id) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    // Strict Anti-Piracy validation
    const validation = validateOfficialChannelUrl(official_url, official_source);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const categories = db.getCategories();
    const cat = categories.find((c) => c.id === category_id);

    const newChannel = db.createChannel({
      name: name.trim(),
      description: description ? description.trim() : 'Canal oficial autorizado.',
      category_id,
      category_name: cat?.name || 'CANAL',
      image_url:
        image_url ||
        'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=600&auto=format&fit=crop&q=80',
      official_url: validation.sanitizedUrl!,
      official_source: official_source.trim(),
      available_regions: Array.isArray(available_regions) && available_regions.length > 0 ? available_regions : ['Global'],
      content_type: content_type || 'live',
      status: status === 'active' ? 'active' : 'inactive',
      admin_authorized: !!admin_authorized,
      verification_date: admin_authorized ? new Date().toISOString() : undefined,
      created_by_id: admin_id || CONFIG.OWNER_ID,
      created_by_name: admin_name || 'Administrador Central de TV',
      notes,
    });

    res.json({ success: true, channel: newChannel });
  });

  app.put('/api/channels/:id', (req, res) => {
    const channel = db.getChannel(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Canal não encontrado' });

    const updates = req.body;

    if (updates.official_url) {
      const validation = validateOfficialChannelUrl(updates.official_url, updates.official_source || channel.official_source);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      updates.official_url = validation.sanitizedUrl;
    }

    if (updates.admin_authorized && !channel.admin_authorized) {
      updates.verification_date = new Date().toISOString();
    }

    const updated = db.updateChannel(req.params.id, updates, req.body.admin_id || CONFIG.OWNER_ID);
    res.json({ success: true, channel: updated });
  });

  app.post('/api/channels/:id/toggle-status', (req, res) => {
    const channel = db.getChannel(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Canal não encontrado' });

    const newStatus = channel.status === 'active' ? 'inactive' : 'active';
    const updated = db.updateChannel(
      req.params.id,
      { status: newStatus },
      req.body.admin_id || CONFIG.OWNER_ID
    );
    res.json({ success: true, channel: updated });
  });

  app.post('/api/channels/:id/verify', (req, res) => {
    const channel = db.getChannel(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Canal não encontrado' });

    const updated = db.updateChannel(
      req.params.id,
      {
        admin_authorized: true,
        status: 'active',
        verification_date: new Date().toISOString(),
      },
      req.body.admin_id || CONFIG.OWNER_ID
    );
    res.json({ success: true, channel: updated });
  });

  app.delete('/api/channels/:id', (req, res) => {
    const ok = db.deleteChannel(req.params.id, (req.query.admin_id as string) || CONFIG.OWNER_ID);
    res.json({ success: ok });
  });

  app.delete('/api/channels/:id', (req, res) => {
    const adminId = (req.body && req.body.admin_id) || (req.query.admin_id as string) || CONFIG.OWNER_ID;
    const ok = db.deleteChannel(req.params.id, adminId);
    if (!ok) return res.status(404).json({ error: 'Canal não encontrado' });
    res.json({ success: true });
  });

  // Categories
  app.get('/api/categories', (req, res) => {
    res.json(db.getCategories());
  });

  app.post('/api/categories', (req, res) => {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    const cat = db.createCategory(name, icon || '🎬');
    res.json({ success: true, category: cat });
  });

  app.delete('/api/categories/:id', (req, res) => {
    const ok = db.deleteCategory(req.params.id);
    res.json({ success: ok });
  });

  // ==========================================
  // MOVIES (FILMES) MANAGEMENT
  // ==========================================
  app.get('/api/movies', (req, res) => {
    const onlyActive = req.query.active === 'true';
    res.json(db.getMovies(onlyActive));
  });

  app.post('/api/movies', (req, res) => {
    const { name, description, url, image_url, platform, category, requires_registration, requires_login, is_active, order, notes } = req.body;
    if (!name || !url || !platform) {
      return res.status(400).json({ error: 'Nome, URL e Plataforma são obrigatórios.' });
    }
    const created = db.createMovie({
      name: name.trim(),
      description: description ? description.trim() : 'Plataforma oficial de filmes e séries.',
      url: url.trim(),
      image_url: image_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80',
      platform: platform.trim(),
      category: category ? category.trim() : 'Filmes & Séries',
      requires_registration: !!requires_registration,
      requires_login: !!requires_login,
      is_active: is_active !== false,
      order: parseInt(order, 10) || 1,
      notes,
    });
    res.json({ success: true, movie: created });
  });

  app.put('/api/movies/:id', (req, res) => {
    const updated = db.updateMovie(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Plataforma não encontrada' });
    res.json({ success: true, movie: updated });
  });

  app.delete('/api/movies/:id', (req, res) => {
    const ok = db.deleteMovie(req.params.id);
    res.json({ success: ok });
  });

  app.post('/api/movies/:id/toggle-status', (req, res) => {
    const updated = db.toggleMovieStatus(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Plataforma não encontrada' });
    res.json({ success: true, movie: updated });
  });

  // ==========================================
  // HIGHLIGHTS (⭐ DESTAQUES) MANAGEMENT
  // ==========================================
  app.get('/api/highlights', (req, res) => {
    const onlyActive = req.query.active === 'true';
    res.json(db.getHighlights(onlyActive));
  });

  app.post('/api/highlights', (req, res) => {
    const { title, description, url, extra_url, platform, image_url, category, is_live, is_active, is_featured, order, start_date, end_date } = req.body;
    if (!title || !url || !platform) {
      return res.status(400).json({ error: 'Título, URL e Plataforma são obrigatórios.' });
    }
    const created = db.createHighlight({
      title: title.trim(),
      description: description ? description.trim() : 'Transmissão pública em destaque.',
      url: url.trim(),
      extra_url: extra_url ? extra_url.trim() : undefined,
      platform: platform.trim(),
      image_url,
      category: category ? category.trim() : 'Geral',
      is_live: !!is_live,
      is_active: is_active !== false,
      is_featured: !!is_featured,
      order: parseInt(order, 10) || 1,
      start_date,
      end_date,
    });

    const bot = telegramBot.getBot();
    if (bot) {
      broadcastNewContentNotification(
        bot.api,
        'Destaques',
        created.title,
        created.url,
        'menu_highlights'
      ).catch(() => {});
    }

    res.json({ success: true, highlight: created });
  });

  app.put('/api/highlights/:id', (req, res) => {
    const updated = db.updateHighlight(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Destaque não encontrado' });
    res.json({ success: true, highlight: updated });
  });

  app.delete('/api/highlights/:id', (req, res) => {
    const ok = db.deleteHighlight(req.params.id);
    res.json({ success: ok });
  });

  app.post('/api/highlights/:id/toggle-status', (req, res) => {
    const updated = db.toggleHighlightStatus(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Destaque não encontrado' });
    res.json({ success: true, highlight: updated });
  });

  app.post('/api/highlights/:id/click', (req, res) => {
    db.incrementHighlightClick(req.params.id);
    res.json({ success: true });
  });

  // ==========================================
  // 🔐 PRIVADO (ÁREA RESTRITA / CONTEÚDOS 01 & 02)
  // ==========================================
  app.get('/api/private/contents', (req, res) => {
    res.json(db.getPrivateContents());
  });

  app.get('/api/private/contents/:id', (req, res) => {
    const item = db.getPrivateContent(req.params.id);
    if (!item) return res.status(404).json({ error: 'Conteúdo não encontrado' });
    res.json(item);
  });

  app.post('/api/private/contents/:id/url', (req, res) => {
    const { url, adminId } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });
    const updated = db.savePrivateContentUrl(req.params.id, url, adminId || CONFIG.OWNER_ID);

    const bot = telegramBot.getBot();
    if (bot && updated) {
      broadcastNewContentNotification(
        bot.api,
        'Privado',
        updated.name,
        updated.url,
        'menu_private'
      ).catch(() => {});
    }

    res.json({ success: true, content: updated });
  });

  app.delete('/api/private/contents/:id/url', (req, res) => {
    const adminId = (req.body && req.body.adminId) || (req.query.adminId as string) || CONFIG.OWNER_ID;
    const updated = db.clearPrivateContentUrl(req.params.id, adminId);
    res.json({ success: true, content: updated });
  });

  // ==========================================
  // 🔐 VAZADOS (BIBLIOTECA DINÂMICA)
  // ==========================================
  app.get('/api/vazados', (req, res) => {
    const onlyActive = req.query.active === 'true';
    res.json(db.getVazados(onlyActive));
  });

  app.get('/api/vazados/:id', (req, res) => {
    const item = db.getVazado(req.params.id);
    if (!item) return res.status(404).json({ error: 'Conteúdo não encontrado' });
    res.json(item);
  });

  app.post('/api/vazados', (req, res) => {
    const { title, description, url, created_by } = req.body;
    if (!title || !url) {
      return res.status(400).json({ error: 'Título e URL são obrigatórios.' });
    }
    const created = db.createVazado({
      title,
      description: description || '',
      url,
      created_by: created_by || CONFIG.OWNER_ID,
    });

    const bot = telegramBot.getBot();
    if (bot) {
      broadcastNewContentNotification(
        bot.api,
        'Vazados',
        `${created.display_name} - ${created.title}`,
        created.url,
        'menu_vazados'
      ).catch(() => {});
    }

    res.json({ success: true, vazado: created });
  });

  app.put('/api/vazados/:id', (req, res) => {
    const { adminId } = req.body;
    const updated = db.updateVazado(req.params.id, req.body, adminId || CONFIG.OWNER_ID);
    if (!updated) return res.status(404).json({ error: 'Conteúdo não encontrado' });
    res.json({ success: true, vazado: updated });
  });

  app.delete('/api/vazados/:id', (req, res) => {
    const adminId = (req.body && req.body.adminId) || (req.query.adminId as string) || CONFIG.OWNER_ID;
    const ok = db.deleteVazado(req.params.id, adminId);
    res.json({ success: ok });
  });

  app.post('/api/vazados/:id/toggle-status', (req, res) => {
    const { adminId } = req.body;
    const updated = db.toggleVazadoStatus(req.params.id, adminId || CONFIG.OWNER_ID);
    if (!updated) return res.status(404).json({ error: 'Conteúdo não encontrado' });
    res.json({ success: true, vazado: updated });
  });

  app.post('/api/vazados/:id/reorder', (req, res) => {
    const { direction } = req.body;
    if (direction !== 'up' && direction !== 'down') {
      return res.status(400).json({ error: 'Direção inválida (up/down).' });
    }
    const ok = db.reorderVazado(req.params.id, direction);
    res.json({ success: ok });
  });

  app.get('/api/private/requests', (req, res) => {
    res.json(db.getPrivateRequests());
  });

  app.post('/api/private/requests/:id/approve', (req, res) => {
    const { adminId, adminName } = req.body;
    const approved = db.approvePrivateAccess(req.params.id, adminId || CONFIG.OWNER_ID, adminName || '👑 DONO DO BOT');
    if (!approved) return res.status(404).json({ error: 'Solicitação não encontrada' });

    const bot = telegramBot.getBot();
    if (bot) {
      const userMsg =
        `✅ *Seu acesso à área 🔐 PRIVADO foi liberado pelo administrador.*\n\n` +
        `Você já pode acessar os conteúdos disponíveis.`;
      bot.api.sendMessage(approved.telegram_id, userMsg, { parse_mode: 'Markdown' }).catch(() => {});
    }

    res.json({ success: true, request: approved });
  });

  app.post('/api/private/requests/:id/reject', (req, res) => {
    const { adminId } = req.body;
    const rejected = db.rejectPrivateAccess(req.params.id, adminId || CONFIG.OWNER_ID);
    if (!rejected) return res.status(404).json({ error: 'Solicitação não encontrada' });

    const bot = telegramBot.getBot();
    if (bot) {
      bot.api
        .sendMessage(
          rejected.telegram_id,
          '❌ Solicitação de acesso não aprovada pelo administrador.',
          { parse_mode: 'Markdown' }
        )
        .catch(() => {});
    }

    res.json({ success: true, request: rejected });
  });

  // ==========================================
  // ADULT CONTENT & ACCESS (COMPATIBILITY)
  // ==========================================
  app.get('/api/adult/contents', (req, res) => {
    const onlyActive = req.query.active === 'true';
    res.json(db.getAdultContents(onlyActive));
  });

  app.post('/api/adult/contents', (req, res) => {
    const { title, description, url, image_url, platform, category, is_active, order } = req.body;
    if (!title || !url) {
      return res.status(400).json({ error: 'Título e URL são obrigatórios.' });
    }
    const created = db.createAdultContent({
      title: title.trim(),
      description: description ? description.trim() : 'Link externo autorizado.',
      url: url.trim(),
      image_url,
      platform: platform ? platform.trim() : 'Web Oficial',
      category: category ? category.trim() : 'Adulto',
      is_active: is_active !== false,
      order: parseInt(order, 10) || 1,
    });
    res.json({ success: true, content: created });
  });

  app.put('/api/adult/contents/:id', (req, res) => {
    const updated = db.updateAdultContent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Conteúdo não encontrado' });
    res.json({ success: true, content: updated });
  });

  app.delete('/api/adult/contents/:id', (req, res) => {
    const ok = db.deleteAdultContent(req.params.id);
    res.json({ success: ok });
  });

  app.post('/api/adult/contents/:id/toggle-status', (req, res) => {
    const updated = db.toggleAdultContentStatus(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Conteúdo não encontrado' });
    res.json({ success: true, content: updated });
  });

  app.get('/api/adult/requests', (req, res) => {
    res.json(db.getAdultRequests());
  });

  app.post('/api/adult/requests/:id/approve', (req, res) => {
    const { adminId, adminName } = req.body;
    const approved = db.approveAdultAccess(req.params.id, adminId || CONFIG.OWNER_ID, adminName || '👑 DONO DO BOT');
    if (!approved) return res.status(404).json({ error: 'Solicitação não encontrada' });

    // Notify user via Telegram bot if active
    const bot = telegramBot.getBot();
    if (bot) {
      const userMsg =
        `✅ *Seu acesso à área +18 foi liberado pelo administrador.*\n\n` +
        `Você pode acessar os conteúdos disponíveis abaixo.\n\n` +
        `🔞 *Conteúdo destinado exclusivamente a maiores de 18 anos.*`;
      bot.api.sendMessage(approved.telegram_id, userMsg, { parse_mode: 'Markdown' }).catch(() => {});
    }

    res.json({ success: true, request: approved });
  });

  app.post('/api/adult/requests/:id/reject', (req, res) => {
    const { adminId } = req.body;
    const rejected = db.rejectAdultAccess(req.params.id, adminId || CONFIG.OWNER_ID);
    if (!rejected) return res.status(404).json({ error: 'Solicitação não encontrada' });

    const bot = telegramBot.getBot();
    if (bot) {
      bot.api
        .sendMessage(
          rejected.telegram_id,
          '❌ Solicitação de acesso não aprovada pelo administrador.',
          { parse_mode: 'Markdown' }
        )
        .catch(() => {});
    }

    res.json({ success: true, request: rejected });
  });

  app.post('/api/adult/requests/:id/block', (req, res) => {
    const { reason } = req.body;
    const ok = db.blockAdultAccess(req.params.id, reason);
    res.json({ success: ok });
  });


  // Run Expiration check immediately
  app.post('/api/expiration/run', async (req, res) => {
    const result = await expirationService.runCheck();
    res.json({ success: true, result });
  });

  // Audit Logs
  app.get('/api/logs', (req, res) => {
    const limit = parseInt((req.query.limit as string) || '100', 10);
    res.json(db.getLogs(limit));
  });

  // ==========================================
  // DATABASE BACKUP SYSTEM (USERS, CHANNELS, LOGS)
  // Daily automated routine & Owner download endpoints
  // ==========================================

  // Get backup routine status
  app.get('/api/backup/status', (req, res) => {
    res.json(backupService.getStatus());
  });

  // Get list of all generated backups
  app.get('/api/backup/list', (req, res) => {
    res.json(backupService.listBackups());
  });

  // Manually trigger a backup generation
  app.post('/api/backup/generate', (req, res) => {
    const type = req.body?.type === 'daily_auto' ? 'daily_auto' : 'manual';
    const triggeredBy = req.body?.triggered_by || 'Proprietário Absoluto (Painel)';
    const result = backupService.createBackup(type, triggeredBy);
    res.json({
      success: true,
      message: `Backup ${type === 'daily_auto' ? 'diário' : 'manual'} gerado com sucesso!`,
      backup: result.metadata,
      stats: result.payload.stats,
    });
  });

  // Download latest backup JSON file
  app.get('/api/backup/download', (req, res) => {
    const latest = backupService.getLatestBackup();
    if (!latest) {
      return res.status(404).json({ error: 'Nenhum backup disponível para download.' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${latest.filename}"`);
    res.send(latest.contentStr);
  });

  // Download specific backup JSON file by filename
  app.get('/api/backup/download/:filename', (req, res) => {
    const file = backupService.getBackupFile(req.params.filename);
    if (!file) {
      return res.status(404).json({ error: 'Arquivo de backup não encontrado.' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.contentStr);
  });

  // View backup content as JSON
  app.get('/api/backup/view/:filename', (req, res) => {
    const file = backupService.getBackupFile(req.params.filename);
    if (!file) {
      return res.status(404).json({ error: 'Arquivo de backup não encontrado.' });
    }

    try {
      const parsed = JSON.parse(file.contentStr);
      res.json({
        filename: file.filename,
        payload: parsed,
      });
    } catch {
      res.status(500).json({ error: 'Erro ao processar conteúdo do arquivo de backup.' });
    }
  });

  // ==========================================
  // IN-BROWSER TELEGRAM SANDBOX SIMULATOR
  // Allows testing bot interactions, check-in, owner notification & channel viewing
  // ==========================================
  app.post('/api/bot/simulate', async (req, res) => {
    const { action, payload } = req.body;

    if (action === 'group_checkin') {
      const { telegramId, firstName, lastName, username, groupTitle } = payload;
      const id = String(telegramId || `sim_${Date.now()}`);
      const fn = firstName || 'Usuário Simulado';

      const active = db.getActiveAccessForUser(id);
      if (active) {
        return res.json({
          status: 'already_active',
          message: `🟢 Usuário já possui acesso ativo (${calculateRemainingDays(active.expiration_date)} dias restantes).`,
          access: active,
        });
      }

      const { checkIn } = db.createCheckIn({
        telegramId: id,
        firstName: fn,
        lastName,
        username,
        groupId: '-10099887766',
        groupTitle: groupTitle || '🎬 Grupo Central de TV Oficial',
      });

      return res.json({
        status: 'pending',
        message: '✅ Check-in realizado! Aguardando liberação do proprietário.',
        checkIn,
      });
    }

    if (action === 'user_start') {
      const { telegramId, firstName } = payload;
      const id = String(telegramId);
      const user = db.getUser(id) || db.upsertUser({ id, first_name: firstName || 'Usuário' });
      const active = db.getActiveAccessForUser(id);

      if (user.status === 'blocked') {
        return res.json({
          status: 'blocked',
          title: '🚫 ACESSO BLOQUEADO',
          body: `Seu acesso à CENTRAL DE TV foi suspenso pela administração.`,
          buttons: [],
        });
      }

      if (active) {
        const days = calculateRemainingDays(active.expiration_date);
        return res.json({
          status: 'active',
          title: '🎬 CENTRAL DE TV',
          body: `Olá, ${user.first_name}!\n\nSeu acesso:\n🟢 ATIVO\n\nDias restantes:\n${days} dias\n\nValidade:\n${formatDateBR(active.expiration_date)}\n\nEscolha uma categoria:`,
          buttons: [
            '⭐ DESTAQUES',
            '📺 CANAIS AO VIVO',
            '🎬 FILMES',
            '🔐 PRIVADO',
            '📺 TODOS OS CANAIS',
            '👤 MEU ACESSO',
            '🔄 NOVO CHECK-IN',
            'ℹ️ INFORMAÇÕES',
          ],
        });
      }

      return res.json({
        status: 'unauthorized',
        title: '🔴 ACESSO NÃO LIBERADO',
        body: `Você precisa realizar o check-in e aguardar a liberação do administrador.`,
        buttons: ['✅ FAZER CHECK-IN'],
      });
    }

    if (action === 'view_private') {
      const { telegramId } = payload;
      const id = String(telegramId);
      const isOwner = db.isOwner(id);
      const hasAccess = db.hasPrivateAccess(id);

      if (!hasAccess) {
        return res.json({
          status: 'restricted',
          title: '🔒 ACESSO RESTRITO',
          body: 'Esta área é exclusiva para usuários autorizados pelo proprietário.\nSeu acesso ainda não está autorizado.',
          buttons: ['🔐 SOLICITAR ACESSO', '⬅️ VOLTAR AO MENU'],
        });
      }

      const c01 = db.getPrivateContent('private_01');
      const c02 = db.getPrivateContent('private_02');

      return res.json({
        status: 'private_menu',
        title: '🔐 PRIVADO',
        body: 'Área de acesso restrito controlada pelo proprietário.\nSelecione um dos conteúdos disponíveis abaixo:',
        contents: [
          { id: 'private_01', name: 'CONTEÚDO 01', hasLink: !!c01?.url, url: c01?.url || '' },
          { id: 'private_02', name: 'CONTEÚDO 02', hasLink: !!c02?.url, url: c02?.url || '' },
        ],
        buttons: ['🔗 CONTEÚDO 01', '🔗 CONTEÚDO 02', '🔐 VAZADOS', '⬅️ VOLTAR AO MENU'],
      });
    }

    if (action === 'view_vazados') {
      const { telegramId } = payload;
      const id = String(telegramId);
      const isOwner = db.isOwner(id);
      const hasAccess = db.hasPrivateAccess(id);

      if (!hasAccess) {
        return res.json({
          status: 'restricted',
          title: '🔒 ACESSO RESTRITO',
          body: 'Esta área é exclusiva para usuários autorizados pelo proprietário.\nSeu acesso ainda não está autorizado.',
          buttons: ['🔐 SOLICITAR ACESSO', '⬅️ VOLTAR AO MENU'],
        });
      }

      const vazados = db.getVazados(!isOwner);
      return res.json({
        status: 'vazados_list',
        title: '🔐 VAZADOS — BIBLIOTECA EXCLUSIVA',
        body: 'Conteúdos restritos cadastrados e atualizados pela administração.',
        vazados: vazados.map((v) => ({
          id: v.id,
          display_name: v.display_name,
          title: v.title,
          description: v.description,
          url: v.url,
        })),
        buttons: vazados.map((v) => `${v.display_name}: ${v.title}`).concat(['⬅️ VOLTAR AO PRIVADO']),
      });
    }

    if (action === 'request_private') {
      const { telegramId, firstName, username } = payload;
      const { request } = db.createPrivateRequest({
        telegramId: String(telegramId),
        userName: firstName || 'Usuário',
        username,
      });
      return res.json({
        status: 'pending',
        title: '⏳ AGUARDANDO APROVAÇÃO',
        body: 'Sua solicitação de acesso foi enviada ao proprietário (6918626496).\nAguarde a liberação.',
        buttons: ['⬅️ VOLTAR AO MENU'],
        request,
      });
    }

    if (action === 'view_category') {
      const { telegramId, categoryKey } = payload;
      const id = String(telegramId);
      const active = db.getActiveAccessForUser(id);

      // Strict validation before showing channels
      if (!active) {
        return res.json({
          status: 'unauthorized',
          title: '🔴 ACESSO NÃO LIBERADO',
          body: `Você precisa realizar o check-in e aguardar a liberação do administrador.`,
          buttons: ['✅ FAZER CHECK-IN'],
        });
      }

      const channels = db.getChannelsByCategory(categoryKey);
      const catTitles: Record<string, string> = {
        all: '📺 CANAIS',
        cat_filmes: '🎬 FILMES',
        cat_tv_ao_vivo: '📡 TV AO VIVO',
        cat_internacionais: '🌎 INTERNACIONAIS',
        cat_brasil: '🇧🇷 BRASIL',
        cat_educacao: '🎓 EDUCAÇÃO',
        cat_cultura: '🎭 CULTURA',
        cat_noticias: '📰 NOTÍCIAS',
      };
      const catTitle = catTitles[categoryKey] || '📺 CANAIS';

      return res.json({
        status: 'channels_list',
        categoryTitle: catTitle,
        channels: channels.map((c) => ({
          name: c.name,
          description: c.description,
          official_url: c.official_url,
          official_source: c.official_source,
        })),
        buttons: channels.map((c) => `▶️ ABRIR: ${c.name.replace(/^[^\w\s\u00C0-\u00FF]+/g, '').trim() || c.name}`).concat(['⬅️ VOLTAR']),
      });
    }

    res.status(400).json({ error: 'Ação de simulação desconhecida' });
  });

  // ==========================================
  // VITE OR STATIC SERVING
  // ==========================================
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 CENTRAL DE TV Server running at http://0.0.0.0:${PORT}`);
    console.log(`👑 Absolute Owner ID: ${CONFIG.OWNER_ID}`);
  });
}

createServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});
