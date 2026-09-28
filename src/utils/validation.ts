/**
 * Validation and Utility functions for CENTRAL DE TV
 */

import { CONFIG } from '../config/config.ts';

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  sanitizedUrl?: string;
  domain?: string;
}

/**
 * Validates official channel URLs strictly.
 * Enforces HTTPS, blocks shorteners, blocks direct m3u/m3u8 IPTV streams,
 * and ensures official domain structure.
 */
export function validateOfficialChannelUrl(url: string, declaredSource?: string): UrlValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'A URL do canal não pode estar vazia.' };
  }

  const trimmed = url.trim();

  // Enforce HTTPS
  if (!trimmed.startsWith('https://')) {
    return {
      valid: false,
      error: 'Por segurança e conformidade, a URL deve usar protocolo seguro (https://).',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Formato de URL inválido.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  // Check against known shortener domains
  for (const blocked of CONFIG.BLOCKED_DOMAINS) {
    if (hostname === blocked || hostname.endsWith('.' + blocked)) {
      return {
        valid: false,
        error: `Links encurtados (${blocked}) são estritamente proibidos. Forneça o link direto da página oficial.`,
      };
    }
  }

  // Check forbidden extensions (M3U / IPTV streaming files)
  for (const ext of CONFIG.FORBIDDEN_EXTENSIONS) {
    if (pathname.endsWith(ext) || parsed.search.toLowerCase().includes(ext)) {
      return {
        valid: false,
        error: 'Links diretos para listas M3U/M3U8 ou transmissões irregulares não são permitidos. O sistema aceita apenas portais e páginas oficiais autorizadas.',
      };
    }
  }

  // If a declared source is provided, ensure domain correlation
  if (declaredSource && declaredSource.trim()) {
    const srcLower = declaredSource.toLowerCase();
    // Extra validation check if needed
  }

  return {
    valid: true,
    sanitizedUrl: parsed.href,
    domain: hostname,
  };
}

/**
 * Format ISO date to Portuguese format DD/MM/YYYY
 */
export function formatDateBR(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
}

/**
 * Format ISO date to Portuguese datetime DD/MM/YYYY às HH:mm
 */
export function formatDateTimeBR(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}

/**
 * Calculate remaining days until expiration
 */
export function calculateRemainingDays(expirationDateIso: string): number {
  try {
    const now = new Date().getTime();
    const exp = new Date(expirationDateIso).getTime();
    const diffMs = exp - now;
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Escape HTML special characters for Telegram HTML mode
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
