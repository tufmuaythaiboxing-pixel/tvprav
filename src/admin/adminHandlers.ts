/**
 * Admin Handlers for CENTRAL DE TV
 * Provides absolute management for Owner (ID: 6918626496) and appointed administrators.
 */

import { Context, InlineKeyboard, InputFile } from 'grammy';
import { db } from '../database/db.ts';
import { CONFIG } from '../config/config.ts';
import { backupService } from '../services/backupService.ts';
import { formatDateBR, calculateRemainingDays } from '../utils/validation.ts';

/**
 * Handles `/admin` command
 */
export async function handleAdminCommand(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const isOwner = db.isOwner(telegramId);
  const isAdmin = db.isAdmin(telegramId);

  if (!isAdmin && !isOwner) {
    await ctx.reply('⛔ Acesso negado. Este comando é restrito à administração do sistema.');
    return;
  }

  await sendAdminMainMenu(ctx);
}

/**
 * Renders main administrative menu
 */
export async function sendAdminMainMenu(ctx: Context, edit = false) {
  const stats = db.getStats();

  const menuText =
    `👑 *PAINEL ADMINISTRATIVO — CENTRAL DE TV*\n\n` +
    `Olá, Administrador. Selecione uma opção para gerenciar o sistema:\n\n` +
    `📊 *Resumo Rápido:*\n` +
    `• Usuários: ${stats.total_users} (Ativos: ${stats.active_accesses})\n` +
    `• Pendentes: ${stats.pending_requests} | Expirados: ${stats.expired_accesses}\n` +
    `• Canais Ativos: ${stats.active_channels} de ${stats.total_channels}`;

  const keyboard = new InlineKeyboard()
    .text('👥 USUÁRIOS', 'admin_users')
    .text('✅ ACESSOS ATIVOS', 'admin_active')
    .row()
    .text('⏳ PENDENTES', 'admin_pending')
    .text('🔴 EXPIRADOS', 'admin_expired')
    .row()
    .text('📺 CANAIS', 'admin_channels')
    .text('🎬 FILMES', 'admin_movies')
    .row()
    .text('⭐ DESTAQUES', 'admin_highlights')
    .text('🔐 PRIVADO', 'admin_private')
    .row()
    .text('💾 BACKUP DO BANCO', 'admin_backup')
    .text('📊 ESTATÍSTICAS', 'admin_stats')
    .row()
    .text('⚙️ CONFIGURAÇÕES', 'admin_settings')
    .text('👑 ADMINISTRADORES', 'admin_team')
    .row()
    .text('⬅️ SAIR DO PAINEL', 'menu_start_back');

  if (edit) {
    try {
      await ctx.editMessageText(menuText, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    } catch {}
  }

  await ctx.reply(menuText, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * Lists all registered channels for the Administrator
 */
export async function handleAdminChannels(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const channels = db.getChannels(false);
  const text =
    `📺 *CANAIS CADASTRADOS (${channels.length})*\n\n` +
    `Aqui estão todos os canais do catálogo oficial da CENTRAL DE TV.\n` +
    `Selecione um canal para gerenciar (ativar/desativar, editar ou excluir):`;

  const keyboard = new InlineKeyboard();

  channels.forEach((c) => {
    const statusIcon = c.status === 'active' ? '🟢' : '🔴';
    keyboard.text(`${statusIcon} ${c.name.slice(0, 26)}`, `chan_view:${c.id}`).row();
  });

  keyboard.text('➕ NOVO CANAL', 'chan_new_ask').row();
  keyboard.text('⬅️ VOLTAR AO PAINEL', 'admin_main');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }
}

/**
 * Channel Detail in Admin Panel
 */
export async function handleAdminChannelDetail(ctx: Context, channelId: string) {
  const channel = db.getChannel(channelId);
  if (!channel) {
    await ctx.answerCallbackQuery({ text: 'Canal não encontrado.', show_alert: true });
    return;
  }

  const statusText = channel.status === 'active' ? '🟢 ATIVO' : '🔴 DESATIVADO';
  const toggleActionLabel = channel.status === 'active' ? '🔴 DESATIVAR' : '🟢 ATIVAR';

  const text =
    `📺 *GERENCIAR CANAL: ${channel.name}*\n\n` +
    `📝 *Descrição:* ${channel.description}\n` +
    `🏷️ *Categoria:* ${channel.category_name}\n` +
    `🔗 *URL Oficial:* \`${channel.official_url}\`\n` +
    `🏛️ *Fonte Oficial:* ${channel.official_source}\n` +
    `📌 *Status Atual:* ${statusText}\n` +
    `✅ *Autorização:* ${channel.admin_authorized ? 'Confirmada' : 'Pendente'}\n\n` +
    `Selecione uma ação abaixo:`;

  const keyboard = new InlineKeyboard()
    .text(toggleActionLabel, `chan_toggle:${channel.id}`)
    .text('✏️ EDITAR', `chan_edit:${channel.id}`)
    .row()
    .text('🗑️ EXCLUIR', `chan_del_ask:${channel.id}`)
    .row()
    .text('⬅️ VOLTAR AOS CANAIS', 'admin_channels');

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Toggle channel active/inactive
 */
export async function handleAdminToggleChannelStatus(ctx: Context, channelId: string) {
  const from = ctx.from;
  if (!from) return;

  const channel = db.getChannel(channelId);
  if (!channel) return;

  const newStatus = channel.status === 'active' ? 'inactive' : 'active';
  db.updateChannel(channelId, { status: newStatus, admin_authorized: newStatus === 'active' }, String(from.id));

  await ctx.answerCallbackQuery({
    text: `Canal agora está ${newStatus === 'active' ? 'ATIVO' : 'DESATIVADO'}`,
    show_alert: false,
  });

  await handleAdminChannelDetail(ctx, channelId);
}

/**
 * Ask confirmation before deleting channel
 */
export async function handleAdminDeleteChannelAsk(ctx: Context, channelId: string) {
  const channel = db.getChannel(channelId);
  if (!channel) return;

  const text =
    `⚠️ *CONFIRMAR EXCLUSÃO DE CANAL*\n\n` +
    `Você tem certeza de que deseja excluir o canal *"${channel.name}"* do catálogo?\n` +
    `Esta ação removerá o canal do sistema.`;

  const keyboard = new InlineKeyboard()
    .text('🗑️ SIM, EXCLUIR', `chan_del_confirm:${channel.id}`)
    .text('❌ CANCELAR', `chan_view:${channel.id}`);

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Confirm delete channel
 */
export async function handleAdminDeleteChannelConfirm(ctx: Context, channelId: string) {
  const from = ctx.from;
  if (!from) return;

  db.deleteChannel(channelId, String(from.id));
  await ctx.answerCallbackQuery({ text: 'Canal excluído com sucesso.', show_alert: true });
  await handleAdminChannels(ctx);
}

/**
 * Ask confirmation before granting days: "Você deseja liberar X dias para Y?"
 */
export async function handleGrantAsk(ctx: Context, checkinId: string, days: number) {
  const checkin = db.getCheckIns().find((c) => c.id === checkinId);
  if (!checkin) {
    await ctx.answerCallbackQuery({ text: 'Check-in não encontrado.', show_alert: true });
    return;
  }

  const name = `${checkin.first_name}${checkin.last_name ? ' ' + checkin.last_name : ''}`;
  const promptText = `⚠️ *CONFIRMAÇÃO DE LIBERAÇÃO*\n\nVocê deseja liberar *${days} dias* de acesso para *${name}* (\`${checkin.telegram_id}\`)?`;

  const keyboard = new InlineKeyboard()
    .text('✅ CONFIRMAR', `grant_confirm:${checkinId}:${days}`)
    .text('❌ CANCELAR', `grant_cancel:${checkinId}`);

  await ctx.editMessageText(promptText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Executes confirmed access release
 */
export async function handleGrantConfirm(
  ctx: Context,
  checkinId: string,
  days: number,
  botInstance?: any
) {
  const from = ctx.from;
  if (!from) return;

  const adminId = String(from.id);
  const adminName = from.first_name || 'Administrador';

  const checkin = db.getCheckIns().find((c) => c.id === checkinId);
  if (!checkin) {
    await ctx.answerCallbackQuery({ text: 'Check-in não encontrado.', show_alert: true });
    return;
  }

  const userFullName = `${checkin.first_name}${checkin.last_name ? ' ' + checkin.last_name : ''}`;

  // 1. Create access in database
  const access = db.createAccess({
    telegramId: checkin.telegram_id,
    userName: userFullName,
    durationDays: days,
    grantedById: adminId,
    grantedByName: adminName,
  });

  // 2. Mark check-in as approved
  db.updateCheckInStatus(checkinId, 'approved', adminId, days, access.id);

  const startDateStr = formatDateBR(access.start_date);
  const expDateStr = formatDateBR(access.expiration_date);

  // 3. Update admin notification message with official format
  const successAdminText =
    `✅ *ACESSO LIBERADO*\n\n` +
    `👤 *${userFullName}*\n` +
    `🆔 \`${checkin.telegram_id}\`\n\n` +
    `📅 *Início:* ${startDateStr}\n` +
    `⏰ *Expira:* ${expDateStr}\n` +
    `⌛ *Duração:* ${days} dias\n` +
    `🛡️ *Aprovado por:* ${adminName}`;

  await ctx.editMessageText(successAdminText, { parse_mode: 'Markdown' });

  // 4. Send confirmation directly to user
  let userNotified = false;
  if (botInstance && botInstance.api) {
    try {
      const userNotice =
        `🎉 *ACESSO LIBERADO COM SUCESSO!*\n\n` +
        `👤 *${userFullName}*\n` +
        `🆔 \`${checkin.telegram_id}\`\n\n` +
        `📅 *Início:* ${startDateStr}\n` +
        `⏰ *Expira:* ${expDateStr}\n` +
        `⌛ *Duração:* ${days} dias\n\n` +
        `Seu acesso à CENTRAL DE TV está liberado! Envie /start para abrir o catálogo.`;

      const userBtn = new InlineKeyboard().text('📺 ABRIR CENTRAL DE TV', 'menu_channels');

      await botInstance.api.sendMessage(checkin.telegram_id, userNotice, {
        parse_mode: 'Markdown',
        reply_markup: userBtn,
      });
      userNotified = true;
    } catch (err: any) {
      console.warn(`[Bot] Could not deliver private message to user ${checkin.telegram_id}:`, err?.message || err);

      // Section 19 Requirement:
      // "Se o usuário ainda não tiver iniciado o bot no privado, mostrar ao administrador:
      // ⚠️ O usuário ainda não iniciou o bot no privado.
      // Mostrar botão: [ 👉 INICIAR BOT ] e orientar o usuário a iniciar o bot antes da liberação."
      const botUser = db.getSettings().bot_username || 'central_tv_bot';
      const botLink = `https://t.me/${botUser.replace('@', '')}`;

      const warnKeyboard = new InlineKeyboard().url('👉 INICIAR BOT', botLink);

      await ctx.reply(
        `⚠️ *AVISO:* O usuário ainda não iniciou o bot no privado.\n` +
          `A API do Telegram não permite enviar mensagens diretas sem que o usuário tenha aberto o bot primeiro.\n` +
          `Oriente *${userFullName}* a clicar no botão abaixo para iniciar o bot:`,
        {
          parse_mode: 'Markdown',
          reply_markup: warnKeyboard,
        }
      );
    }
  }

  await ctx.answerCallbackQuery({
    text: userNotified
      ? `✅ Acesso de ${days} dias liberado e usuário notificado!`
      : `✅ Acesso liberado no sistema. Notifique o usuário para iniciar o bot.`,
    show_alert: true,
  });
}

/**
 * Rejection flow with confirmation
 */
export async function handleRejectAsk(ctx: Context, checkinId: string) {
  const checkin = db.getCheckIns().find((c) => c.id === checkinId);
  if (!checkin) {
    await ctx.answerCallbackQuery({ text: 'Check-in não encontrado.', show_alert: true });
    return;
  }

  const name = `${checkin.first_name}${checkin.last_name ? ' ' + checkin.last_name : ''}`;
  const promptText = `⚠️ *CONFIRMAÇÃO DE RECUSA*\n\nVocê deseja recusar a solicitação de *${name}* (\`${checkin.telegram_id}\`)?`;

  const keyboard = new InlineKeyboard()
    .text('✅ CONFIRMAR RECUSA', `reject_confirm:${checkinId}`)
    .text('❌ CANCELAR', `grant_cancel:${checkinId}`);

  await ctx.editMessageText(promptText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleRejectConfirm(ctx: Context, checkinId: string, botInstance?: any) {
  const from = ctx.from;
  if (!from) return;

  const adminId = String(from.id);
  const checkin = db.getCheckIns().find((c) => c.id === checkinId);
  if (!checkin) return;

  db.updateCheckInStatus(checkinId, 'rejected', adminId);

  await ctx.editMessageText(
    `❌ *SOLICITAÇÃO RECUSADA*\n\nO pedido de check-in para *${checkin.first_name}* (\`${checkin.telegram_id}\`) foi recusado.`,
    { parse_mode: 'Markdown' }
  );

  // Attempt to notify user
  if (botInstance && botInstance.api) {
    try {
      await botInstance.api.sendMessage(
        checkin.telegram_id,
        '❌ Sua solicitação de acesso à Central de TV não foi aprovada pela administração no momento.'
      );
    } catch {}
  }
}

/**
 * Pending requests list in Telegram
 */
export async function handleAdminPending(ctx: Context) {
  const pending = db.getPendingCheckIns();
  const keyboard = new InlineKeyboard();

  if (pending.length === 0) {
    keyboard.text('⬅️ VOLTAR AO PAINEL', 'admin_main');
    await ctx.editMessageText(`✅ *NENHUMA SOLICITAÇÃO PENDENTE*\n\nTodas as solicitações de check-in foram processadas.`, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    return;
  }

  let text = `⏳ *SOLICITAÇÕES PENDENTES (${pending.length})*\n\n`;
  pending.slice(0, 5).forEach((p, idx) => {
    const name = `${p.first_name}${p.last_name ? ' ' + p.last_name : ''}`;
    text += `${idx + 1}. *${name}* (\`${p.telegram_id}\`)\n   Grupo: ${p.group_title || 'Direto'}\n\n`;
    keyboard.text(`Liberar ${name.slice(0, 15)}`, `grant_ask:${p.id}:7`).row();
  });

  keyboard.text('⬅️ VOLTAR AO PAINEL', 'admin_main');

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Active accesses list in Telegram
 */
export async function handleAdminActive(ctx: Context) {
  const accesses = db.getAccesses().filter((a) => a.status === 'active');
  const keyboard = new InlineKeyboard().text('⬅️ VOLTAR AO PAINEL', 'admin_main');

  let text = `✅ *ACESSOS ATIVOS (${accesses.length})*\n\n`;

  if (accesses.length === 0) {
    text += 'Nenhum acesso ativo no momento.';
  } else {
    accesses.slice(0, 8).forEach((a, idx) => {
      const days = calculateRemainingDays(a.expiration_date);
      text += `${idx + 1}. *${a.user_name}* (\`${a.telegram_id}\`)\n   Expira em: ${formatDateBR(a.expiration_date)} (${days} dias restantes)\n\n`;
    });
  }

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Statistics overview in Telegram
 */
export async function handleAdminStats(ctx: Context) {
  const stats = db.getStats();

  const text =
    `📊 *ESTATÍSTICAS DO SISTEMA — CENTRAL DE TV*\n\n` +
    `👥 *Usuários Cadastrados:* ${stats.total_users}\n` +
    `🟢 *Acessos Ativos:* ${stats.active_accesses}\n` +
    `⏳ *Solicitações Pendentes:* ${stats.pending_requests}\n` +
    `🔴 *Acessos Expirados:* ${stats.expired_accesses}\n` +
    `🚫 *Usuários Bloqueados:* ${stats.blocked_users}\n\n` +
    `📺 *Quantidade de Canais:* ${stats.total_channels} (${stats.active_channels} ativos e autorizados)\n` +
    `🏷️ *Categorias:* ${stats.total_categories}\n\n` +
    `📈 *Check-ins Hoje:* ${stats.checkins_today}\n` +
    `📈 *Check-ins Últimos 7 Dias:* ${stats.checkins_last_7_days}`;

  const keyboard = new InlineKeyboard().text('⬅️ VOLTAR AO PAINEL', 'admin_main');

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Handles Backup Menu in Telegram Admin Panel
 */
export async function handleAdminBackup(ctx: Context, edit = true) {
  const status = backupService.getStatus();
  const stats = db.getStats();
  const lastBackup = status.last_daily_backup;

  const text =
    `💾 *BACKUP AUTOMÁTICO DO BANCO DE DADOS*\n\n` +
    `🟢 *Rotina Diária:* Ativa (Diariamente às 00:00)\n` +
    `🗄️ *Tabelas do Banco:* \`users\`, \`channels\`, \`logs\`\n` +
    `⏳ *Retenção:* 30 dias de histórico preservado\n\n` +
    `📊 *Contagem de Registros Atuais:*\n` +
    `• Usuários Cadastrados: *${stats.total_users}*\n` +
    `• Canais no Catálogo: *${stats.total_channels}*\n` +
    `• Logs de Auditoria: *${db.getLogs(1000).length}*\n\n` +
    `📁 *Último Arquivo Gerado:*\n` +
    `• Nome: \`${lastBackup?.filename || 'central_tv_backup_latest.json'}\`\n` +
    `• Data/Hora: *${lastBackup?.created_at_formatted || 'Hoje'}*\n` +
    `• Tamanho: *${lastBackup?.size_formatted || 'calculando...'}*\n\n` +
    `Escolha uma ação abaixo para download ou geração imediata:`;

  const keyboard = new InlineKeyboard()
    .text('📥 BAIXAR BACKUP JSON', 'admin_backup_download')
    .row()
    .text('⚡ GERAR NOVO BACKUP AGORA', 'admin_backup_generate')
    .row()
    .text('⬅️ VOLTAR AO PAINEL', 'admin_main');

  if (edit) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    } catch {}
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * Sends the backup JSON file directly to the owner in Telegram
 */
export async function handleAdminBackupDownload(ctx: Context) {
  try {
    await ctx.answerCallbackQuery({ text: 'Preparando arquivo de backup...' });
  } catch {}

  const file = backupService.getLatestBackup();
  if (!file) {
    await ctx.reply('❌ Nenhum backup disponível para envio no momento.');
    return;
  }

  try {
    const stats = db.getStats();
    const caption =
      `💾 *BACKUP CENTRAL DE TV*\n\n` +
      `📁 Arquivo: \`${file.filename}\`\n` +
      `📦 Tabelas: \`users\`, \`channels\`, \`logs\`\n` +
      `👥 Usuários: ${stats.total_users} | 📺 Canais: ${stats.total_channels}\n` +
      `📅 Gerado em: ${new Date().toLocaleString('pt-BR')}`;

    await ctx.replyWithDocument(new InputFile(file.buffer, file.filename), {
      caption,
      parse_mode: 'Markdown',
    });
  } catch (err: any) {
    console.error('[Bot] Failed to send backup document:', err);
    await ctx.reply(`❌ Erro ao enviar arquivo de backup: ${err?.message || 'Falha no Telegram'}`);
  }
}

/**
 * Manually generates a new backup and delivers it to the owner
 */
export async function handleAdminBackupGenerate(ctx: Context) {
  try {
    await ctx.answerCallbackQuery({ text: 'Gerando snapshot do banco de dados...' });
  } catch {}

  const adminName = ctx.from ? `@${ctx.from.username || ctx.from.id}` : 'Proprietário';
  const created = backupService.createBackup('manual', `Telegram ${adminName}`);

  const file = backupService.getBackupFile(created.metadata.filename);
  if (!file) {
    await ctx.reply('❌ Erro ao ler arquivo de backup recém-criado.');
    return;
  }

  try {
    const caption =
      `⚡ *NOVO BACKUP GERADO COM SUCESSO!*\n\n` +
      `📁 Arquivo: \`${file.filename}\`\n` +
      `📦 Tamanho: ${created.metadata.size_formatted}\n` +
      `🗄️ Tabelas: \`users\` (${created.metadata.users_count}), \`channels\` (${created.metadata.channels_count}), \`logs\` (${created.metadata.logs_count})\n` +
      `📅 Timestamp: ${created.metadata.created_at_formatted}`;

    await ctx.replyWithDocument(new InputFile(file.buffer, file.filename), {
      caption,
      parse_mode: 'Markdown',
    });

    await handleAdminBackup(ctx, false);
  } catch (err: any) {
    console.error('[Bot] Failed to send generated backup document:', err);
    await ctx.reply(`✅ Backup gerado com sucesso no servidor: \`${file.filename}\``);
  }
}

/**
 * Lists all movies/platforms for the administrator
 */
export async function handleAdminMovies(ctx: Context) {
  const movies = db.getMovies(false);
  const text =
    `🎬 *GERENCIAR FILMES (${movies.length})*\n\n` +
    `Plataformas oficiais e sob demanda disponíveis na aba Filmes.\n` +
    `Selecione uma plataforma para gerenciar ou ativar/desativar:`;

  const keyboard = new InlineKeyboard();
  movies.forEach((m) => {
    const statusIcon = m.is_active ? '🟢' : '🔴';
    keyboard.text(`${statusIcon} ${m.name.slice(0, 26)}`, `movie_view:${m.id}`).row();
  });

  keyboard.text('⬅️ VOLTAR AO PAINEL', 'admin_main');

  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

export async function handleAdminMovieDetail(ctx: Context, movieId: string) {
  const movie = db.getMovie(movieId);
  if (!movie) {
    await ctx.answerCallbackQuery({ text: 'Plataforma não encontrada.', show_alert: true });
    return;
  }

  const statusText = movie.is_active ? '🟢 ATIVO' : '🔴 DESATIVADO';
  const toggleLabel = movie.is_active ? '🔴 DESATIVAR' : '🟢 ATIVAR';

  const text =
    `🎬 *PLATAFORMA DE FILME: ${movie.name}*\n\n` +
    `📝 *Descrição:* ${movie.description}\n` +
    `🏷️ *Categoria:* ${movie.category}\n` +
    `📺 *Plataforma:* ${movie.platform}\n` +
    `🔗 *URL:* \`${movie.url}\`\n` +
    `👤 *Cadastro:* ${movie.requires_registration ? 'Sim' : 'Não'}\n` +
    `📌 *Status Atual:* ${statusText}\n`;

  const keyboard = new InlineKeyboard()
    .text(toggleLabel, `movie_toggle:${movie.id}`)
    .text('🗑️ EXCLUIR', `movie_del:${movie.id}`)
    .row()
    .text('⬅️ VOLTAR AOS FILMES', 'admin_movies');

  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

export async function handleAdminToggleMovie(ctx: Context, movieId: string) {
  const movie = db.toggleMovieStatus(movieId);
  if (!movie) return;
  await ctx.answerCallbackQuery({
    text: `Plataforma agora está ${movie.is_active ? 'ATIVA' : 'DESATIVADA'}`,
  });
  await handleAdminMovieDetail(ctx, movieId);
}

export async function handleAdminDeleteMovie(ctx: Context, movieId: string) {
  db.deleteMovie(movieId);
  await ctx.answerCallbackQuery({ text: 'Plataforma excluída com sucesso.' });
  await handleAdminMovies(ctx);
}

/**
 * Lists highlights for admin
 */
export async function handleAdminHighlights(ctx: Context) {
  const highlights = db.getHighlights(false);
  const text =
    `⭐ *GERENCIAR DESTAQUES (${highlights.length})*\n\n` +
    `Transmissões públicas de YouTube, TikTok, Twitch, Kick e outras plataformas.\n` +
    `Selecione um destaque para gerenciar:`;

  const keyboard = new InlineKeyboard();
  highlights.forEach((h) => {
    const statusIcon = h.is_active ? '🟢' : '🔴';
    keyboard.text(`${statusIcon} ${h.title.slice(0, 26)}`, `hl_view:${h.id}`).row();
  });
  keyboard.text('⬅️ VOLTAR AO PAINEL', 'admin_main');

  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

export async function handleAdminHighlightDetail(ctx: Context, highlightId: string) {
  const hl = db.getHighlight(highlightId);
  if (!hl) {
    await ctx.answerCallbackQuery({ text: 'Destaque não encontrado.', show_alert: true });
    return;
  }

  const statusText = hl.is_active ? '🟢 ATIVO' : '🔴 DESATIVADO';
  const toggleLabel = hl.is_active ? '🔴 DESATIVAR' : '🟢 ATIVAR';

  const text =
    `⭐ *DESTAQUE: ${hl.title}*\n\n` +
    `📝 *Descrição:* ${hl.description}\n` +
    `📺 *Plataforma:* ${hl.platform}\n` +
    `🏷️ *Categoria:* ${hl.category}\n` +
    `🔗 *URL:* \`${hl.url}\`\n` +
    `📊 *Cliques:* ${hl.clicks_count || 0}\n` +
    `📌 *Status:* ${statusText}\n`;

  const keyboard = new InlineKeyboard()
    .text(toggleLabel, `hl_toggle:${hl.id}`)
    .text('🗑️ EXCLUIR', `hl_del:${hl.id}`)
    .row()
    .text('⬅️ VOLTAR AOS DESTAQUES', 'admin_highlights');

  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

export async function handleAdminToggleHighlight(ctx: Context, highlightId: string) {
  const hl = db.toggleHighlightStatus(highlightId);
  if (!hl) return;
  await ctx.answerCallbackQuery({
    text: `Destaque agora está ${hl.is_active ? 'ATIVO' : 'DESATIVADO'}`,
  });
  await handleAdminHighlightDetail(ctx, highlightId);
}

export async function handleAdminDeleteHighlight(ctx: Context, highlightId: string) {
  db.deleteHighlight(highlightId);
  await ctx.answerCallbackQuery({ text: 'Destaque excluído com sucesso.' });
  await handleAdminHighlights(ctx);
}

/**
 * 🔐 ÁREA PRIVADA — Somente ID 6918626496 (DONO ABSOLUTO DO BOT)
 */
export async function handleAdminPrivate(ctx: Context) {
  const from = ctx.from;
  if (!from) return;
  const telegramId = String(from.id);

  if (!db.isOwner(telegramId)) {
    await ctx.reply('⛔ Acesso restrito ao Dono do Bot.');
    return;
  }

  const requests = db.getPrivateRequests();
  const pending = requests.filter((r) => r.status === 'pending');
  const c01 = db.getPrivateContent('private_01');
  const c02 = db.getPrivateContent('private_02');
  const vazados = db.getVazados(false);

  const text =
    `🔐 *GERENCIAR ÁREA PRIVADA*\n\n` +
    `👑 *Acesso Exclusivo do Dono do Bot* (\`${CONFIG.OWNER_ID}\`)\n\n` +
    `📌 *Status dos Conteúdos:*\n` +
    `• CONTEÚDO 01: ${c01?.url ? `🟢 Link cadastrado` : `⚠️ Nenhum link cadastrado`}\n` +
    `• CONTEÚDO 02: ${c02?.url ? `🟢 Link cadastrado` : `⚠️ Nenhum link cadastrado`}\n` +
    `• 🔐 VAZADOS: ${vazados.length} conteúdos cadastrados\n\n` +
    `👥 *Solicitações de Acesso Pendentes:* *${pending.length}*\n\n` +
    `Selecione uma opção:`;

  const keyboard = new InlineKeyboard()
    .text(`🔗 CONTEÚDO 01`, 'priv_view:private_01')
    .text(`🔗 CONTEÚDO 02`, 'priv_view:private_02')
    .row()
    .text(`🔐 VAZADOS (${vazados.length})`, 'menu_vazados')
    .row()
    .text(`👥 SOLICITAÇÕES (${pending.length})`, 'adult_adm_requests')
    .row()
    .text('⬅️ VOLTAR AO PAINEL', 'admin_main');

  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

export async function handleAdminAdult(ctx: Context) {
  return handleAdminPrivate(ctx);
}

/**
 * View adult access requests
 */
export async function handleAdminAdultRequests(ctx: Context) {
  const requests = db.getAdultRequests();
  const pending = requests.filter((r) => r.status === 'pending');

  let text =
    `🔞 *SOLICITAÇÕES DE ACESSO +18*\n\n` +
    `Pendentes de aprovação: *${pending.length}*\n\n`;

  if (pending.length === 0) {
    text += `Nenhuma solicitação pendente no momento.`;
  } else {
    pending.slice(0, 5).forEach((r) => {
      text += `👤 *${r.user_name}* (\`${r.telegram_id}\`)\n`;
      text += `📅 ${formatDateBR(r.requested_at)} — ⚠️ Confirmou 18+ anos\n\n`;
    });
  }

  const keyboard = new InlineKeyboard();
  pending.slice(0, 5).forEach((r) => {
    keyboard
      .text(`✅ Liberar: ${r.user_name.slice(0, 10)}`, `adult_grant:${r.id}`)
      .text(`❌ Recusar`, `adult_reject:${r.id}`)
      .row();
  });

  keyboard.text('⬅️ VOLTAR À ÁREA +18', 'admin_adult');

  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Owner approves +18 request
 * Somente ID 6918626496 poderá aprovar!
 */
export async function handleAdminAdultGrant(ctx: Context, requestId: string, bot?: any) {
  const from = ctx.from;
  if (!from) return;
  const adminId = String(from.id);

  if (!db.isOwner(adminId)) {
    await ctx.answerCallbackQuery({ text: '⛔ Somente o Dono pode aprovar.', show_alert: true });
    return;
  }

  const approved = db.approveAdultAccess(requestId, adminId, '👑 DONO DO BOT');
  if (!approved) {
    await ctx.answerCallbackQuery({ text: 'Solicitação não encontrada.', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '🔞 Acesso +18 liberado com sucesso!' });

  try {
    await ctx.editMessageText(
      `✅ *ACESSO +18 LIBERADO*\n\n` +
        `👤 Usuário: *${approved.user_name}*\n` +
        `🆔 ID: \`${approved.telegram_id}\`\n` +
        `Status atualizado para: *🔞 ACESSO +18 LIBERADO*`,
      { parse_mode: 'Markdown' }
    );
  } catch {}

  // Send exact confirmation to user as requested in prompt:
  if (bot) {
    const userMsg =
      `✅ *Seu acesso à área +18 foi liberado pelo administrador.*\n\n` +
      `Você pode acessar os conteúdos disponíveis abaixo.\n\n` +
      `🔞 *Conteúdo destinado exclusivamente a maiores de 18 anos.*`;

    const contents = db.getAdultContents(true);
    const userKb = new InlineKeyboard();
    contents.forEach((c) => {
      userKb.url(`🔗 ACESSAR: ${c.title}`, c.url).row();
    });
    userKb.text('⬅️ MENU PRINCIPAL', 'menu_start_back');

    bot.api.sendMessage(approved.telegram_id, userMsg, {
      parse_mode: 'Markdown',
      reply_markup: userKb,
    }).catch(() => {});
  }
}

/**
 * Owner rejects +18 request
 * Somente ID 6918626496 poderá recusar!
 */
export async function handleAdminAdultReject(ctx: Context, requestId: string, bot?: any) {
  const from = ctx.from;
  if (!from) return;
  const adminId = String(from.id);

  if (!db.isOwner(adminId)) {
    await ctx.answerCallbackQuery({ text: '⛔ Somente o Dono pode recusar.', show_alert: true });
    return;
  }

  const rejected = db.rejectAdultAccess(requestId, adminId);
  if (!rejected) {
    await ctx.answerCallbackQuery({ text: 'Solicitação não encontrada.', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'Solicitação recusada.' });

  try {
    await ctx.editMessageText(
      `❌ *SOLICITAÇÃO +18 RECUSADA*\n\n` +
        `👤 Usuário: *${rejected.user_name}*\n` +
        `🆔 ID: \`${rejected.telegram_id}\``,
      { parse_mode: 'Markdown' }
    );
  } catch {}

  // Send exact rejection message to user as requested in prompt:
  if (bot) {
    bot.api.sendMessage(
      rejected.telegram_id,
      '❌ Solicitação de acesso não aprovada pelo administrador.',
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
}

/**
 * List adult links for admin
 */
export async function handleAdminAdultContents(ctx: Context) {
  const contents = db.getAdultContents(false);
  const text =
    `🔞 *LINKS EXTERNOS +18 (${contents.length})*\n\n` +
    `Links públicos externos autorizados pelo Dono para exibição aos usuários aprovados.\n` +
    `Selecione um link para gerenciar:`;

  const keyboard = new InlineKeyboard();
  contents.forEach((c) => {
    const statusIcon = c.is_active ? '🟢' : '🔴';
    keyboard.text(`${statusIcon} ${c.title.slice(0, 26)}`, `adult_c_view:${c.id}`).row();
  });
  keyboard.text('⬅️ VOLTAR AO PAINEL +18', 'admin_adult');

  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

export async function handleAdminAdultContentDetail(ctx: Context, contentId: string) {
  const content = db.getAdultContent(contentId);
  if (!content) {
    await ctx.answerCallbackQuery({ text: 'Conteúdo não encontrado.', show_alert: true });
    return;
  }

  const statusText = content.is_active ? '🟢 ATIVO' : '🔴 DESATIVADO';
  const toggleLabel = content.is_active ? '🔴 DESATIVAR' : '🟢 ATIVAR';

  const text =
    `🔞 *CONTEÚDO +18: ${content.title}*\n\n` +
    `📝 *Descrição:* ${content.description}\n` +
    `🔗 *URL:* \`${content.url}\`\n` +
    `📺 *Plataforma:* ${content.platform}\n` +
    `📌 *Status:* ${statusText}\n`;

  const keyboard = new InlineKeyboard()
    .text(toggleLabel, `adult_c_toggle:${content.id}`)
    .text('🗑️ EXCLUIR', `adult_c_del:${content.id}`)
    .row()
    .text('⬅️ VOLTAR AOS LINKS +18', 'adult_adm_links');

  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

export async function handleAdminToggleAdultContent(ctx: Context, contentId: string) {
  const content = db.toggleAdultContentStatus(contentId);
  if (!content) return;
  await ctx.answerCallbackQuery({
    text: `Conteúdo agora está ${content.is_active ? 'ATIVO' : 'DESATIVADO'}`,
  });
  await handleAdminAdultContentDetail(ctx, contentId);
}

export async function handleAdminDeleteAdultContent(ctx: Context, contentId: string) {
  db.deleteAdultContent(contentId);
  await ctx.answerCallbackQuery({ text: 'Conteúdo excluído com sucesso.' });
  await handleAdminAdultContents(ctx);
}


