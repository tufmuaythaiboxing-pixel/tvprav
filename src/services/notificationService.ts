import { InlineKeyboard } from 'grammy';
import { db } from '../database/db.ts';

export async function broadcastNewContentNotification(
  botApi: any,
  category: 'Vazados' | 'Privado' | 'Destaques',
  title: string,
  url?: string,
  botCallback?: string
): Promise<{ sentCount: number; totalUsers: number }> {
  if (!botApi) {
    console.warn('[Notification] Bot API is not available to send notifications.');
    return { sentCount: 0, totalUsers: 0 };
  }

  // Obter apenas usuários que possuem acesso ativo e válido (não expirado e não bloqueado)
  const validUsers = db.getUsersWithValidAccess();
  if (validUsers.length === 0) {
    return { sentCount: 0, totalUsers: 0 };
  }

  const messageText =
    `🔔 *NOVA ATUALIZAÇÃO*\n\n` +
    `Novo conteúdo disponível.\n\n` +
    `📂 *Categoria:* ${category}\n\n` +
    `📝 *Título:* ${title}`;

  let sentCount = 0;

  for (const user of validUsers) {
    try {
      const keyboard = new InlineKeyboard();
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        keyboard.url('▶️ Abrir', url);
      } else if (botCallback) {
        keyboard.text('▶️ Abrir', botCallback);
      } else {
        if (category === 'Vazados') {
          keyboard.text('▶️ Abrir', 'menu_vazados');
        } else if (category === 'Privado') {
          keyboard.text('▶️ Abrir', 'menu_private');
        } else {
          keyboard.text('▶️ Abrir', 'menu_highlights');
        }
      }

      await botApi.sendMessage(user.id, messageText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      sentCount++;
    } catch (err: any) {
      // Falha esperada caso usuário tenha pausado o bot ou excluído a conta
      console.warn(`[Notification] Could not deliver update to user ${user.id}:`, err?.message);
    }
  }

  console.log(`[Notification] Broadcast sent to ${sentCount}/${validUsers.length} active users.`);
  return { sentCount, totalUsers: validUsers.length };
}
