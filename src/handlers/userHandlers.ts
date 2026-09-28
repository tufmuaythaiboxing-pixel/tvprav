/**
 * User Private Chat Handlers for CENTRAL DE TV
 * Handles /start, access validation, category navigation, and authorized channel viewing.
 */

import { Context, InlineKeyboard } from 'grammy';
import { db } from '../database/db.ts';
import { CONFIG } from '../config/config.ts';
import { Channel } from '../models/types.ts';
import { formatDateBR, calculateRemainingDays } from '../utils/validation.ts';
import { sendGroupCheckInBanner } from './groupHandlers.ts';

/**
 * Handles /start command in private chat
 */
export async function handleStartCommand(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const firstName = from.first_name || 'Usuário';

  // Ensure user is registered
  let user = db.getUser(telegramId);
  if (!user) {
    user = db.upsertUser({
      id: telegramId,
      first_name: firstName,
      last_name: from.last_name,
      username: from.username,
    });
  }

  // Check if user is blocked
  if (user.status === 'blocked') {
    await ctx.reply(
      `🚫 *ACESSO BLOQUEADO*\n\nSeu acesso à CENTRAL DE TV foi suspenso pela administração.\nMotivo: ${user.notes || 'Violação de regras.'}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Check access validity
  const activeAccess = db.getActiveAccessForUser(telegramId);

  if (activeAccess) {
    const daysLeft = calculateRemainingDays(activeAccess.expiration_date);
    const validUntil = formatDateBR(activeAccess.expiration_date);

    const welcomeMsg =
      `🎬 *CENTRAL DE TV*\n\n` +
      `Olá, *${firstName}*!\n\n` +
      `Seu acesso:\n🟢 *ATIVO*\n\n` +
      `Dias restantes:\n*${daysLeft} dias*\n\n` +
      `Validade:\n*${validUntil}*\n\n` +
      `ℹ️ *INFORMAÇÃO IMPORTANTE*\n` +
      `• Alguns canais e serviços podem exigir cadastro/login diretamente no site oficial da plataforma.\n` +
      `• O cadastro é feito diretamente na plataforma oficial.\n` +
      `• O bot apenas direciona você para o site oficial correspondente.\n` +
      `• A Central não solicita sua senha, código de acesso ou dados bancários.\n\n` +
      `Escolha uma das opções abaixo:`;

    const keyboard = new InlineKeyboard()
      .text('⭐ DESTAQUES', 'menu_highlights')
      .row()
      .text('📺 CANAIS AO VIVO', 'view_cat:cat_tv_ao_vivo')
      .text('🎬 FILMES', 'menu_movies')
      .row()
      .text('🔐 PRIVADO', 'menu_private')
      .row()
      .text('📺 TODOS OS CANAIS', 'view_cat:all')
      .row()
      .text('👤 MEU ACESSO', 'menu_my_access')
      .text('🔄 NOVO CHECK-IN', 'action_do_checkin')
      .row()
      .text('ℹ️ INFORMAÇÕES', 'menu_info');

    // Absolute owner (6918626496) or appointed admin shortcut
    if (db.isAdmin(telegramId) || db.isOwner(telegramId)) {
      keyboard.row().text('👑 PAINEL DO DONO / ADMIN', 'admin_main');
    }

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(welcomeMsg, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(welcomeMsg, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      }
    } catch {
      await ctx.reply(welcomeMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  } else {
    // No active access
    const noAccessMsg =
      `🔴 *ACESSO NÃO LIBERADO*\n\n` +
      `Você precisa realizar o check-in e aguardar a liberação do administrador.`;

    const keyboard = new InlineKeyboard().text('✅ FAZER CHECK-IN', 'action_do_checkin');

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(noAccessMsg, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply(noAccessMsg, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      }
    } catch {
      await ctx.reply(noAccessMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  }
}


/**
 * Handles "👤 MEU ACESSO"
 */
export async function handleMyAccess(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const activeAccess = db.getActiveAccessForUser(telegramId);
  const user = db.getUser(telegramId);

  if (!activeAccess) {
    const keyboard = new InlineKeyboard()
      .text('✅ FAZER CHECK-IN', 'action_do_checkin')
      .row()
      .text('⬅️ VOLTAR AO MENU', 'menu_start_back');

    await ctx.editMessageText(
      `🔴 *ACESSO NÃO LIBERADO*\n\n` +
        `Você precisa realizar o check-in e aguardar a liberação do administrador.`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    return;
  }

  const daysLeft = calculateRemainingDays(activeAccess.expiration_date);
  const startDate = formatDateBR(activeAccess.start_date);
  const expDate = formatDateBR(activeAccess.expiration_date);

  const text =
    `👤 *MEU ACESSO — CENTRAL DE TV*\n\n` +
    `👤 *Usuário:* ${user?.first_name || from.first_name}\n` +
    `🆔 *Telegram ID:* \`${telegramId}\`\n` +
    `🟢 *Status:* ATIVO\n` +
    `📅 *Data de Início:* ${startDate}\n` +
    `⏰ *Data de Expiração:* ${expDate}\n` +
    `⌛ *Dias Restantes:* *${daysLeft} dias*\n` +
    `🛡️ *Liberado por:* ${activeAccess.granted_by_name}`;

  const keyboard = new InlineKeyboard()
    .text('📺 CANAIS', 'view_cat:all')
    .row()
    .text('⬅️ VOLTAR AO MENU', 'menu_start_back');

  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * Handles "📺 VER CANAIS" - Lists categories
 */
export async function handleChannelsMenu(ctx: Context) {
  return handleCategoryView(ctx, 'all');
}

/**
 * Handles category channels list with strict access validation and official direct URL buttons
 */
export async function handleCategoryView(ctx: Context, categoryId: string) {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);

  // Strict Access Validation: Verify if user has active access
  const activeAccess = db.getActiveAccessForUser(telegramId);
  if (!activeAccess) {
    const keyboard = new InlineKeyboard().text('✅ FAZER CHECK-IN', 'action_do_checkin');
    const msg =
      `🔴 *ACESSO NÃO LIBERADO*\n\n` +
      `Você precisa realizar o check-in e aguardar a liberação do administrador.`;

    try {
      await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  const channels = db.getChannelsByCategory(categoryId);

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

  const catTitle = catTitles[categoryId] || '📺 CANAIS';

  let text = `${catTitle}\n\n`;

  if (channels.length === 0) {
    text += `Nenhum canal ativo disponível nesta categoria no momento.`;
  } else {
    channels.forEach((c) => {
      text += `${c.name}\n${c.description}\n\n`;
    });
  }

  const keyboard = new InlineKeyboard();

  // Each item strictly has a "▶️ ABRIR" button pointing directly to the official URL
  channels.forEach((c) => {
    const cleanName = c.name.replace(/^[^\w\s\u00C0-\u00FF]+/g, '').trim() || c.name;
    keyboard.url(`▶️ ABRIR: ${cleanName}`, c.official_url).row();
  });

  keyboard.text('⬅️ VOLTAR AO MENU', 'menu_start_back');

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
 * Returns user-friendly badge for channel access requirement
 */
export function getRequirementBadge(req?: string): string {
  switch (req) {
    case 'direct':
      return '✅ Acesso direto';
    case 'needs_register':
      return '👤 Necessita cadastro';
    case 'needs_login':
      return '🔐 Necessita login';
    case 'may_require_sub':
      return '💳 Pode exigir assinatura';
    case 'official_site':
      return '🌐 Abre no site oficial';
    default:
      return '✅ Acesso direto';
  }
}

/**
 * Handles "🎬 FILMES" menu
 */
export async function handleMoviesMenu(ctx: Context) {
  const from = ctx.from;
  if (!from) return;
  const telegramId = String(from.id);

  const activeAccess = db.getActiveAccessForUser(telegramId);
  if (!activeAccess) {
    const keyboard = new InlineKeyboard().text('✅ FAZER CHECK-IN', 'action_do_checkin');
    const msg = `🔴 *ACESSO NÃO LIBERADO*\n\nVocê precisa realizar o check-in e aguardar a liberação do administrador.`;
    if (ctx.callbackQuery) {
      await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  const movies = db.getMovies(true);
  let text =
    `🎬 *FILMES — PLATAFORMAS OFICIAIS*\n\n` +
    `Plataformas oficiais gratuitas e sob demanda disponibilizadas legalmente.\n\n` +
    `ℹ️ *Informação:* O bot apenas direciona você para a plataforma oficial. O cadastro/login, se exigido, é feito diretamente no site oficial.\n\n`;

  movies.forEach((m) => {
    text += `*${m.name}*\n`;
    text += `${m.description}\n`;
    if (m.notes) {
      text += `📌 _${m.notes}_\n`;
    }
    text += `\n`;
  });

  const keyboard = new InlineKeyboard();
  movies.forEach((m) => {
    const cleanName = m.name.replace(/^[^\w\s\u00C0-\u00FF]+/g, '').trim() || m.name;
    keyboard.url(`🎬 ABRIR ${cleanName.toUpperCase()}`, m.url).row();
  });
  keyboard.text('⬅️ VOLTAR AO MENU', 'menu_start_back');

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Handles "⭐ DESTAQUES" menu
 */
export async function handleHighlightsMenu(ctx: Context) {
  const from = ctx.from;
  if (!from) return;
  const telegramId = String(from.id);

  const activeAccess = db.getActiveAccessForUser(telegramId);
  if (!activeAccess) {
    const keyboard = new InlineKeyboard().text('✅ FAZER CHECK-IN', 'action_do_checkin');
    const msg = `🔴 *ACESSO NÃO LIBERADO*\n\nVocê precisa realizar o check-in e aguardar a liberação do administrador.`;
    if (ctx.callbackQuery) {
      await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  const highlights = db.getHighlights(true);
  let text =
    `⭐ *DESTAQUES — TRANSMISSÕES PÚBLICAS*\n\n` +
    `Transmissões ao vivo, estreias e destaques no YouTube, Twitch, TikTok, Kick e outras plataformas.\n\n` +
    `🔗 O clique levará você para a transmissão oficial na plataforma original.\n\n`;

  highlights.forEach((h) => {
    text += `*${h.title}*\n`;
    text += `📺 Plataforma: ${h.platform}\n`;
    text += `${h.description}\n\n`;
  });

  const keyboard = new InlineKeyboard();
  highlights.forEach((h) => {
    const cleanName = h.title.replace(/^[^\w\s\u00C0-\u00FF]+/g, '').trim() || h.title;
    const buttonLabel = cleanName ? `▶️ Assistir: ${cleanName}` : '▶️ Assistir';
    if (h.extra_url && h.extra_url.trim().length > 0) {
      keyboard.url(buttonLabel, h.url);
      keyboard.url('📎 Link Extra', h.extra_url).row();
    } else {
      keyboard.url(buttonLabel, h.url).row();
    }
  });
  keyboard.text('⬅️ VOLTAR AO MENU', 'menu_start_back');

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Handles "🔐 PRIVADO" menu
 * Acesso restrito para links externos cadastrados pelo proprietário.
 * Não abre Google nem navegador externo ao clicar na aba.
 */
export async function handlePrivateMenu(ctx: Context) {
  const from = ctx.from;
  if (!from) return;
  const telegramId = String(from.id);

  // 1. Check active general bot access
  const activeAccess = db.getActiveAccessForUser(telegramId);
  if (!activeAccess) {
    const keyboard = new InlineKeyboard().text('✅ FAZER CHECK-IN', 'action_do_checkin');
    const msg = `🔴 *ACESSO NÃO LIBERADO*\n\nVocê precisa realizar o check-in e aguardar a liberação do administrador.`;
    if (ctx.callbackQuery) {
      await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  // 2. Check if user has active private authorization
  const hasAccess = db.hasPrivateAccess(telegramId);

  if (hasAccess) {
    // Approved user or Owner: show internal screen with CONTEÚDO 01, CONTEÚDO 02 and 🔐 VAZADOS
    const text =
      `🔐 *PRIVADO*\n\n` +
      `Área de acesso restrito controlada pelo proprietário.\n` +
      `Selecione um dos conteúdos disponíveis abaixo:`;

    const keyboard = new InlineKeyboard()
      .text('🔗 CONTEÚDO 01', 'priv_view:private_01')
      .row()
      .text('🔗 CONTEÚDO 02', 'priv_view:private_02')
      .row()
      .text('🔐 VAZADOS', 'menu_vazados')
      .row()
      .text('⬅️ VOLTAR AO MENU', 'menu_start_back');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  // 3. User does not have approved private access
  const existingReq = db.getPrivateRequestByTelegramId(telegramId) || db.getAdultRequestByTelegramId(telegramId);

  if (existingReq?.status === 'blocked') {
    const text =
      `🚫 *ACESSO PRIVADO BLOQUEADO*\n\n` +
      `Seu acesso a esta área restrita foi suspenso pela administração.\n` +
      `Motivo: ${existingReq.notes || 'Restrição administrativa'}`;
    const keyboard = new InlineKeyboard().text('⬅️ VOLTAR AO MENU', 'menu_start_back');
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  if (existingReq?.status === 'pending') {
    const text =
      `⏳ *AGUARDANDO APROVAÇÃO*\n\n` +
      `Sua solicitação de acesso foi enviada ao proprietário.\n` +
      `Aguarde a liberação para visualizar os conteúdos cadastrados.`;
    const keyboard = new InlineKeyboard().text('⬅️ VOLTAR AO MENU', 'menu_start_back');
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  // 4. Show Restricted Access screen with button to request access
  const promptText =
    `🔒 *ACESSO RESTRITO*\n\n` +
    `> Seu acesso ainda não está autorizado.\n\n` +
    `Esta área é exclusiva para usuários autorizados pelo proprietário.\n` +
    `Clique no botão abaixo para solicitar autorização de acesso.`;

  const keyboard = new InlineKeyboard()
    .text('🔐 SOLICITAR ACESSO', 'priv_request_access')
    .row()
    .text('⬅️ VOLTAR AO MENU', 'menu_start_back');

  if (ctx.callbackQuery) {
    await ctx.editMessageText(promptText, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else {
    await ctx.reply(promptText, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Handles click on "🔐 SOLICITAR ACESSO"
 */
export async function handlePrivateRequestAccess(ctx: Context, bot?: any) {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const userName = `${from.first_name}${from.last_name ? ' ' + from.last_name : ''}`;
  const username = from.username;

  const { request } = db.createPrivateRequest({
    telegramId,
    userName,
    username,
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Send automatic notification to Owner: 6918626496
  const ownerId = CONFIG.OWNER_ID;
  if (bot && ownerId) {
    const ownerMsg =
      `🔐 *NOVA SOLICITAÇÃO DE ACESSO — PRIVADO*\n\n` +
      `👤 Usuário: *${userName}*\n` +
      `🆔 ID: \`${telegramId}\`\n` +
      `🔗 Username: ${username ? '@' + username : 'Não informado'}\n` +
      `📅 Data: ${dateStr}\n` +
      `⏰ Hora: ${timeStr}\n\n` +
      `*Deseja liberar o acesso?*`;

    const ownerKb = new InlineKeyboard()
      .text('✅ LIBERAR', `priv_grant:${request.id}`)
      .text('❌ RECUSAR', `priv_reject:${request.id}`);

    bot.api.sendMessage(ownerId, ownerMsg, { parse_mode: 'Markdown', reply_markup: ownerKb }).catch((e: any) => {
      console.warn('[Bot] Failed to send private request alert to owner:', e.message);
    });
  }

  const userReply =
    `⏳ *AGUARDANDO APROVAÇÃO*\n\n` +
    `Sua solicitação de acesso foi enviada ao administrador.\n` +
    `Aguarde a liberação para visualizar os conteúdos cadastrados.`;

  const keyboard = new InlineKeyboard().text('⬅️ VOLTAR AO MENU', 'menu_start_back');

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(userReply, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(userReply, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  } catch {
    await ctx.reply(userReply, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Handles viewing CONTEÚDO 01 or CONTEÚDO 02
 */
export async function handlePrivateContentView(ctx: Context, contentId: string) {
  const from = ctx.from;
  if (!from) return;
  const telegramId = String(from.id);
  const isOwner = db.isOwner(telegramId);

  // Check authorization
  if (!isOwner && !db.hasPrivateAccess(telegramId)) {
    await handlePrivateMenu(ctx);
    return;
  }

  const content = db.getPrivateContent(contentId);
  const contentName = content?.name || (contentId === 'private_02' ? 'CONTEÚDO 02' : 'CONTEÚDO 01');
  const hasLink = !!content?.url && content.url.trim().length > 0;

  if (isOwner) {
    // Owner view:
    let text = `📎 *LINK DO ${contentName}*\n\n`;
    const keyboard = new InlineKeyboard();

    if (hasLink) {
      text += `Link cadastrado:\n\`${content!.url}\`\n\nVocê pode acessar o link, alterá-lo ou removê-lo:`;
      keyboard.url('▶️ ACESSAR', content!.url).row();
      keyboard.text('✏️ ALTERAR LINK', `priv_add:${contentId}`).row();
      keyboard.text('🗑️ REMOVER LINK', `priv_remove:${contentId}`).row();
    } else {
      text += `⚠️ *Nenhum link cadastrado.*`;
      keyboard.text('➕ CADASTRAR LINK', `priv_add:${contentId}`).row();
    }

    keyboard.text('⬅️ VOLTAR', 'menu_private');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  // Regular authorized user view:
  if (hasLink) {
    const text =
      `🔗 *${contentName}*\n\n` +
      `Link disponível para acesso. Clique no botão abaixo para abrir:`;

    const keyboard = new InlineKeyboard()
      .url('▶️ ACESSAR', content!.url)
      .row()
      .text('⬅️ VOLTAR', 'menu_private');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  } else {
    const text =
      `🔗 *${contentName}*\n\n` +
      `⚠️ *Este conteúdo ainda não está disponível.*`;

    const keyboard = new InlineKeyboard().text('⬅️ VOLTAR', 'menu_private');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }
}

/**
 * Handles "🔐 VAZADOS" sub-menu inside 🔐 PRIVADO
 * Biblioteca dinâmica de conteúdos exclusivos.
 */
export async function handleVazadosMenu(ctx: Context) {
  const from = ctx.from;
  if (!from) return;
  const telegramId = String(from.id);

  // 1. Check general bot access
  const activeAccess = db.getActiveAccessForUser(telegramId);
  if (!activeAccess) {
    const keyboard = new InlineKeyboard().text('✅ FAZER CHECK-IN', 'action_do_checkin');
    const msg = `🔴 *ACESSO NÃO LIBERADO*\n\nVocê precisa realizar o check-in e aguardar a liberação do administrador.`;
    if (ctx.callbackQuery) {
      await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  // 2. Check private access authorization
  const hasAccess = db.hasPrivateAccess(telegramId);
  if (!hasAccess) {
    await handlePrivateMenu(ctx);
    return;
  }

  const isOwner = db.isOwner(telegramId);
  const vazados = db.getVazados(!isOwner);

  let text =
    `🔐 *VAZADOS — BIBLIOTECA EXCLUSIVA*\n\n` +
    `Conteúdos restritos cadastrados e atualizados pela administração.\n\n`;

  if (vazados.length === 0) {
    text += `⚠️ *Nenhum conteúdo disponível no momento.*`;
  } else {
    text += `Selecione um item abaixo para visualizar os detalhes:`;
  }

  const keyboard = new InlineKeyboard();

  vazados.forEach((v) => {
    const statusPrefix = isOwner ? (v.status === 'active' ? '🟢 ' : '🔴 ') : '';
    keyboard.text(`${statusPrefix}${v.display_name}: ${v.title.slice(0, 22)}`, `vaz_view:${v.id}`).row();
  });

  if (isOwner) {
    keyboard.text('➕ NOVO VAZADO', 'vaz_add_start').row();
  }

  keyboard.text('⬅️ VOLTAR AO PRIVADO', 'menu_private');

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Handles viewing a single Vazado item
 */
export async function handleVazadoDetail(ctx: Context, vazadoId: string) {
  const from = ctx.from;
  if (!from) return;
  const telegramId = String(from.id);

  // Check authorization
  if (!db.hasPrivateAccess(telegramId)) {
    await handlePrivateMenu(ctx);
    return;
  }

  const vazado = db.getVazado(vazadoId);
  if (!vazado) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: 'Conteúdo não encontrado.', show_alert: true });
    }
    await handleVazadosMenu(ctx);
    return;
  }

  const isOwner = db.isOwner(telegramId);

  if (isOwner) {
    // Owner view with management tools
    const statusText = vazado.status === 'active' ? '🟢 ATIVO' : '🔴 DESATIVADO';
    const toggleLabel = vazado.status === 'active' ? '🔴 DESATIVAR' : '🟢 ATIVAR';

    const text =
      `🔐 *${vazado.display_name}*\n\n` +
      `*${vazado.title}*\n\n` +
      `${vazado.description || 'Sem descrição informada.'}\n\n` +
      `🔗 *Link:* \`${vazado.url}\`\n` +
      `📌 *Status:* ${statusText}\n` +
      `🔢 *Ordem:* ${vazado.order}\n\n` +
      `Opções de gerenciamento do Proprietário:`;

    const keyboard = new InlineKeyboard()
      .url('▶️ Acessar', vazado.url)
      .row()
      .text('✏️ ALTERAR LINK', `vaz_edit_link:${vazado.id}`)
      .text('✏️ ALTERAR TÍTULO', `vaz_edit_title:${vazado.id}`)
      .row()
      .text('✏️ ALTERAR DESCRIÇÃO', `vaz_edit_desc:${vazado.id}`)
      .row()
      .text(toggleLabel, `vaz_toggle:${vazado.id}`)
      .text('🗑️ EXCLUIR', `vaz_del_ask:${vazado.id}`)
      .row()
      .text('⬆️ SUBIR', `vaz_reorder_up:${vazado.id}`)
      .text('⬇️ DESCER', `vaz_reorder_down:${vazado.id}`)
      .row()
      .text('⬅️ VOLTAR AOS VAZADOS', 'menu_vazados');

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      } catch {
        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    return;
  }

  // Regular authorized user view
  const text =
    `*${vazado.display_name}*\n\n` +
    `*${vazado.title}*\n\n` +
    `${vazado.description || ''}`;

  const keyboard = new InlineKeyboard()
    .url('▶️ Acessar', vazado.url)
    .row()
    .text('⬅️ VOLTAR', 'menu_vazados');

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}


// Backwards compatibility wrappers
export async function handleAdultMenu(ctx: Context) {
  return handlePrivateMenu(ctx);
}

export async function handleAdultConfirmAge(ctx: Context, bot?: any) {
  return handlePrivateRequestAccess(ctx, bot);
}

/**
 * Handles "ℹ️ INFORMAÇÕES"
 */
export async function handleInfoMenu(ctx: Context) {
  const infoText =
    `ℹ️ *INFORMAÇÃO IMPORTANTE — CENTRAL DE TV*\n\n` +
    `> Alguns canais e serviços disponíveis nesta Central podem exigir cadastro ou login diretamente no site oficial da plataforma para liberar a transmissão.\n\n` +
    `> O cadastro é feito diretamente na plataforma oficial.\n\n` +
    `> O bot apenas direciona você para o site oficial correspondente.\n\n` +
    `> A Central não solicita sua senha, código de acesso ou dados bancários.\n\n` +
    `🔒 *Diretrizes de Segurança & Legalidade:*\n` +
    `• O sistema opera exclusivamente como direcionador para portais e transmissões oficiais.\n` +
    `• Não realizamos download, cópia, retransmissão ou hospedagem de conteúdos protegidos.\n` +
    `• O usuário sempre é enviado para a página original da plataforma.`;

  const keyboard = new InlineKeyboard().text('⬅️ VOLTAR AO MENU', 'menu_start_back');

  await ctx.editMessageText(infoText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Sends or edits a channel detail card with direct official URL, requirement info and pagination
 */
export async function sendChannelCard(
  ctx: Context,
  channelList: Channel[],
  currentIndex: number,
  catFilter = 'all'
) {
  if (!channelList || channelList.length === 0) {
    const emptyKb = new InlineKeyboard().text('⬅️ VOLTAR AO MENU', 'menu_start_back');
    if (ctx.callbackQuery) {
      await ctx.editMessageText('Nenhum canal ativo disponível no momento.', { reply_markup: emptyKb });
    } else {
      await ctx.reply('Nenhum canal ativo disponível no momento.', { reply_markup: emptyKb });
    }
    return;
  }

  const safeIndex = Math.max(0, Math.min(currentIndex, channelList.length - 1));
  const channel = channelList[safeIndex];
  const total = channelList.length;

  const reqBadge = getRequirementBadge(channel.access_requirement);
  let reqSection = `📌 *Acesso:* ${reqBadge}\n`;
  if (channel.requirement_note) {
    reqSection += `ℹ️ ${channel.requirement_note}\n`;
  }
  if (channel.access_requirement === 'needs_register' || channel.access_requirement === 'needs_login') {
    reqSection += `\n⚠️ *Aviso Importante:* O cadastro ou login é realizado diretamente no site oficial da plataforma. A Central não solicita suas credenciais nem dados bancários.\n`;
  }

  const cardText =
    `🎬 *CENTRAL DE TV — CANAL OFICIAL* (${safeIndex + 1}/${total})\n\n` +
    `*${channel.name}*\n` +
    `📁 *Categoria:* ${channel.category_name}\n` +
    `🏛️ *Fonte Oficial:* ${channel.official_source}\n` +
    `🌍 *Disponibilidade:* ${channel.available_regions.join(', ')}\n\n` +
    reqSection + `\n` +
    `📝 *Descrição:*\n${channel.description}\n\n` +
    `🛡️ *Acesso Oficial:* Este botão abre o link oficial no navegador/Telegram.`;

  const keyboard = new InlineKeyboard();

  // Official direct link
  const cleanName = channel.name.replace(/^[^\w\s\u00C0-\u00FF]+/g, '').trim() || channel.name;
  keyboard.url(`▶️ ABRIR NO SITE OFICIAL`, channel.official_url).row();

  // Navigation pagination
  if (total > 1) {
    const prevIndex = safeIndex > 0 ? safeIndex - 1 : total - 1;
    const nextIndex = safeIndex < total - 1 ? safeIndex + 1 : 0;
    keyboard
      .text('◀️ ANTERIOR', `chan_nav:${catFilter}:${prevIndex}`)
      .text(`${safeIndex + 1}/${total}`, `chan_nav:${catFilter}:${safeIndex}`)
      .text('PRÓXIMO ▶️', `chan_nav:${catFilter}:${nextIndex}`)
      .row();
  }

  keyboard
    .text('📺 LISTA DA CATEGORIA', `view_cat:${catFilter}`)
    .text('⬅️ MENU PRINCIPAL', 'menu_start_back');

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(cardText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(cardText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  } catch {
    await ctx.reply(cardText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }
}

