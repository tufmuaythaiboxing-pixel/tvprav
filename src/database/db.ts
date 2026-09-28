/**
 * Persistent Database Engine for CENTRAL DE TV
 * Stores all entities with atomic persistence in JSON and in-memory cache.
 */

import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config/config.ts';
import {
  User,
  Access,
  CheckIn,
  Channel,
  Category,
  Admin,
  MoviePlatform,
  Highlight,
  AdultContent,
  AdultAccessRequest,
  PrivateContent,
  PrivateAccessRequest,
  VazadoContent,
  SystemSettings,
  AccessLog,
  SystemStats,
  BackupPayload,
} from '../models/types.ts';

interface DatabaseSchema {
  users: Record<string, User>; // Keyed by Telegram ID
  accesses: Record<string, Access>; // Keyed by Access ID
  checkins: Record<string, CheckIn>; // Keyed by CheckIn ID
  channels: Record<string, Channel>; // Keyed by Channel ID
  categories: Record<string, Category>; // Keyed by Category ID
  admins: Record<string, Admin>; // Keyed by Telegram ID
  movies: Record<string, MoviePlatform>; // Keyed by Movie ID
  highlights: Record<string, Highlight>; // Keyed by Highlight ID
  adult_contents: Record<string, AdultContent>; // Keyed by Adult Content ID
  adult_requests: Record<string, AdultAccessRequest>; // Keyed by Request ID or Telegram ID
  private_contents: Record<string, PrivateContent>; // Keyed by Private Content ID ('private_01', 'private_02')
  private_requests: Record<string, PrivateAccessRequest>; // Keyed by Request ID or Telegram ID
  vazados: Record<string, VazadoContent>; // Keyed by Vazado Content ID
  settings: SystemSettings;
  logs: AccessLog[];
}

// Initial catalog of official authorized channels requested by user
// 13 Official Authorized Channels (Rakuten TV, Samsung TV Plus and Canal Gov permanently removed; TV Globo added)
const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'chan_tv_globo',
    name: '📺 TV Globo — Ao Vivo',
    description: 'Assista à TV Globo ao vivo pelo Globoplay.',
    category_id: 'cat_brasil',
    category_name: '🇧🇷 BRASIL',
    image_url: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://globoplay.globo.com/tv-globo/ao-vivo/7832875/',
    official_source: 'Globoplay',
    available_regions: ['BR'],
    content_type: 'live',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'needs_register',
    requirement_note: '👤 Pode exigir Conta Globo e/ou disponibilidade conforme região e condições da plataforma.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Transmissão oficial ao vivo TV Globo via Globoplay. Não baixa, copia ou retransmite o sinal.',
  },
  {
    id: 'chan_pluto_tv',
    name: '🎬 Pluto TV',
    description: 'Plataforma de streaming gratuito com filmes, séries e canais ao vivo, sujeito à disponibilidade regional.',
    category_id: 'cat_filmes',
    category_name: '🎬 FILMES',
    image_url: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://pluto.tv/',
    official_source: 'Pluto TV / Paramount Streaming',
    available_regions: ['BR', 'US', 'LATAM', 'EU'],
    content_type: 'live',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'direct',
    requirement_note: '✅ Acesso direto e gratuito na plataforma oficial.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Plataforma oficial gratuita.',
  },
  {
    id: 'chan_plex_tv',
    name: '🍿 Plex',
    description: 'Plataforma com filmes, séries e canais gratuitos, sujeito à disponibilidade regional.',
    category_id: 'cat_filmes',
    category_name: '🎬 FILMES',
    image_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://watch.plex.tv/',
    official_source: 'Plex, Inc.',
    available_regions: ['Global', 'BR', 'US'],
    content_type: 'vod',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'official_site',
    requirement_note: '🌐 Abre no site oficial Plex.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Catálogo oficial sob demanda e canais FAST.',
  },
  {
    id: 'chan_lg_channels',
    name: '📺 LG Channels',
    description: 'Serviço de canais gratuitos da LG, sujeito à disponibilidade e compatibilidade do dispositivo.',
    category_id: 'cat_filmes',
    category_name: '🎬 FILMES',
    image_url: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://www.lg.com/us/lg-channels',
    official_source: 'LG Electronics',
    available_regions: ['US', 'Global'],
    content_type: 'live',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'official_site',
    requirement_note: '🌐 Abre no site oficial LG Channels.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Canais oficiais LG gratuitos.',
  },
  {
    id: 'chan_redbull_tv',
    name: '🏎️ Red Bull TV',
    description: 'Plataforma oficial da Red Bull com programação, documentários e conteúdos de entretenimento.',
    category_id: 'cat_filmes',
    category_name: '🎬 FILMES / DOCUMENTÁRIOS',
    image_url: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://www.redbull.com/int-en/tv',
    official_source: 'Red Bull Media House',
    available_regions: ['Global'],
    content_type: 'live',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'direct',
    requirement_note: '✅ Acesso direto à programação oficial Red Bull.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Programação oficial Red Bull.',
  },
  {
    id: 'chan_tv_brasil',
    name: '🇧🇷 TV Brasil Play',
    description: 'Plataforma oficial da TV Brasil/EBC com programação e conteúdos disponibilizados pela emissora.',
    category_id: 'cat_brasil',
    category_name: '🇧🇷 BRASIL',
    image_url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://tvbrasil.ebc.com.br/',
    official_source: 'Empresa Brasil de Comunicação (EBC)',
    available_regions: ['BR', 'Global'],
    content_type: 'live',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'direct',
    requirement_note: '✅ Acesso direto à emissora pública oficial.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Emissora pública brasileira oficial.',
  },
  {
    id: 'chan_sesctv',
    name: '🎭 SescTV',
    description: 'Canal oficial do SescTV com programação cultural e audiovisual.',
    category_id: 'cat_cultura',
    category_name: '🎭 CULTURA',
    image_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://sesctv.org.br/',
    official_source: 'Sesc São Paulo',
    available_regions: ['BR', 'Global'],
    content_type: 'culture',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'direct',
    requirement_note: '✅ Acesso direto e programação cultural gratuita.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Programação cultural e artística gratuita.',
  },
  {
    id: 'chan_futura',
    name: '🎓 Futura',
    description: 'Canal e plataforma de conteúdo educacional e cultural.',
    category_id: 'cat_educacao',
    category_name: '🎓 EDUCAÇÃO',
    image_url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://www.futura.org.br/',
    official_source: 'Fundação Roberto Marinho',
    available_regions: ['BR', 'Global'],
    content_type: 'education',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'direct',
    requirement_note: '✅ Acesso direto ao conteúdo educativo oficial.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Canal educativo oficial.',
  },
  {
    id: 'chan_cultura',
    name: '📺 TV Cultura',
    description: 'Site oficial da TV Cultura com programação e conteúdos da emissora.',
    category_id: 'cat_brasil',
    category_name: '🇧🇷 BRASIL',
    image_url: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://tvcultura.com.br/',
    official_source: 'Fundação Padre Anchieta',
    available_regions: ['BR', 'Global'],
    content_type: 'live',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'direct',
    requirement_note: '✅ Acesso direto à TV Cultura oficial.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Transmissão oficial TV Cultura.',
  },
  {
    id: 'chan_camara',
    name: '🏛️ TV Câmara',
    description: 'Canal oficial da Câmara dos Deputados.',
    category_id: 'cat_noticias',
    category_name: '📰 NOTÍCIAS',
    image_url: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://www.camara.leg.br/tv/',
    official_source: 'Câmara dos Deputados',
    available_regions: ['BR', 'Global'],
    content_type: 'live',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'direct',
    requirement_note: '✅ Acesso direto e público.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Transmissões oficiais legislativas.',
  },
  {
    id: 'chan_senado',
    name: '🏛️ TV Senado',
    description: 'Canal oficial do Senado Federal.',
    category_id: 'cat_noticias',
    category_name: '📰 NOTÍCIAS',
    image_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://www12.senado.leg.br/tv',
    official_source: 'Senado Federal',
    available_regions: ['BR', 'Global'],
    content_type: 'live',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'direct',
    requirement_note: '✅ Acesso direto legislativo.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Sinal oficial do Senado.',
  },
  {
    id: 'chan_dw',
    name: '🌎 DW',
    description: 'Emissora internacional Deutsche Welle.',
    category_id: 'cat_noticias',
    category_name: '📰 NOTÍCIAS / INTERNACIONAIS',
    image_url: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://www.dw.com/',
    official_source: 'Deutsche Welle',
    available_regions: ['Global'],
    content_type: 'live',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'official_site',
    requirement_note: '🌐 Abre no site oficial internacional Deutsche Welle.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Emissora internacional oficial pública da Alemanha.',
  },
  {
    id: 'chan_euronews',
    name: '🌎 Euronews',
    description: 'Canal internacional de notícias.',
    category_id: 'cat_noticias',
    category_name: '📰 NOTÍCIAS / INTERNACIONAIS',
    image_url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80',
    official_url: 'https://www.euronews.com/',
    official_source: 'Euronews',
    available_regions: ['Global', 'EU'],
    content_type: 'live',
    status: 'active',
    admin_authorized: true,
    access_requirement: 'official_site',
    requirement_note: '🌐 Abre no portal de notícias pan-europeu Euronews.',
    verification_date: new Date().toISOString(),
    created_by_id: CONFIG.DEFAULT_OWNER_ID,
    created_by_name: 'Sistema Central de TV',
    created_at: new Date().toISOString(),
    notes: 'Jornalismo internacional pan-europeu.',
  },
];

// Initial Movie Platforms
const INITIAL_MOVIES: MoviePlatform[] = [
  {
    id: 'mov_netmovies',
    name: '🎬 NetMovies',
    description: 'Filmes e séries online, com conteúdo gratuito disponível na plataforma.',
    url: 'https://www.netmovies.com.br/',
    image_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80',
    platform: 'NetMovies',
    category: 'Filmes & Séries',
    requires_registration: true,
    requires_login: false,
    is_active: true,
    order: 1,
    notes: '👤 Alguns recursos podem exigir cadastro/login diretamente no site.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mov_runtime',
    name: '🎬 Runtime',
    description: 'Filmes e séries gratuitos disponíveis pela Runtime.',
    url: 'https://www.runtime.tv/pt-br/feature/bruxa-do-cabelo-branco-do-reino-lunar',
    image_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80',
    platform: 'Runtime',
    category: 'Filmes & Séries',
    requires_registration: false,
    requires_login: false,
    is_active: true,
    order: 2,
    notes: 'Filmes e séries gratuitos disponíveis pela Runtime.',
    created_at: new Date().toISOString(),
  },
];

// Initial Public Highlights (YouTube, TikTok, Twitch, Kick)
const INITIAL_HIGHLIGHTS: Highlight[] = [
  {
    id: 'hl_youtube',
    title: '⭐ YouTube — Transmissões em Alta',
    description: 'Acompanhe as principais lives e estreias públicas no YouTube.',
    url: 'https://www.youtube.com/live',
    platform: 'YouTube',
    image_url: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=600&auto=format&fit=crop&q=80',
    category: 'Destaques Ao Vivo',
    is_live: true,
    is_active: true,
    is_featured: true,
    order: 1,
    clicks_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'hl_twitch',
    title: '⭐ Twitch — Principais Streams & Eventos',
    description: 'Transmissões oficiais de games, campeonatos e entretenimento ao vivo.',
    url: 'https://www.twitch.tv/',
    platform: 'Twitch',
    image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
    category: 'Games & Ao Vivo',
    is_live: true,
    is_active: true,
    is_featured: false,
    order: 2,
    clicks_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'hl_tiktok',
    title: '⭐ TikTok — Publicações & Tendências',
    description: 'Acesse diretamente as publicações e tendências mais assistidas.',
    url: 'https://www.tiktok.com/',
    platform: 'TikTok',
    image_url: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&auto=format&fit=crop&q=80',
    category: 'Tendências',
    is_live: false,
    is_active: true,
    is_featured: false,
    order: 3,
    clicks_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'hl_kick',
    title: '⭐ Kick — Transmissões Ao Vivo',
    description: 'Acesse transmissões de criadores parceiros na plataforma Kick.',
    url: 'https://kick.com/',
    platform: 'Kick',
    image_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80',
    category: 'Ao Vivo',
    is_live: true,
    is_active: true,
    is_featured: false,
    order: 4,
    clicks_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'hl_cazetv',
    title: '⭐ CazéTV',
    description: 'Canal CazéTV no YouTube.',
    url: 'https://www.youtube.com/@CazeTV',
    platform: 'YouTube',
    image_url: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=600&auto=format&fit=crop&q=80',
    category: 'Esportes & Ao Vivo',
    is_live: true,
    is_active: true,
    is_featured: false,
    order: 5,
    clicks_count: 0,
    created_at: new Date().toISOString(),
  },
];

// Initial 🔐 PRIVADO Contents (Starts completely empty without any link)
const INITIAL_PRIVATE_CONTENTS: PrivateContent[] = [
  {
    id: 'private_01',
    name: 'CONTEÚDO 01',
    url: '',
    status: 'active',
    created_by: CONFIG.DEFAULT_OWNER_ID,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'private_02',
    name: 'CONTEÚDO 02',
    url: '',
    status: 'active',
    created_by: CONFIG.DEFAULT_OWNER_ID,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Initial adult contents kept empty for backwards compatibility
const INITIAL_ADULT_CONTENTS: AdultContent[] = [
  {
    id: 'adult_01',
    title: 'CONTEÚDO 01',
    description: 'Área privada autorizada pelo proprietário.',
    url: '',
    platform: 'Web Oficial',
    category: 'Privado',
    is_active: true,
    order: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'adult_02',
    title: 'CONTEÚDO 02',
    description: 'Área privada autorizada pelo proprietário.',
    url: '',
    platform: 'Web Oficial',
    category: 'Privado',
    is_active: true,
    order: 2,
    created_at: new Date().toISOString(),
  },
];

const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat_filmes', name: 'FILMES', icon: '🎬', order: 1, created_at: new Date().toISOString() },
  { id: 'cat_tv_ao_vivo', name: 'TV AO VIVO', icon: '📡', order: 2, created_at: new Date().toISOString() },
  { id: 'cat_internacionais', name: 'INTERNACIONAIS', icon: '🌎', order: 3, created_at: new Date().toISOString() },
  { id: 'cat_brasil', name: 'BRASIL', icon: '🇧🇷', order: 4, created_at: new Date().toISOString() },
  { id: 'cat_educacao', name: 'EDUCAÇÃO', icon: '🎓', order: 5, created_at: new Date().toISOString() },
  { id: 'cat_cultura', name: 'CULTURA', icon: '🎭', order: 6, created_at: new Date().toISOString() },
  { id: 'cat_noticias', name: 'NOTÍCIAS', icon: '📰', order: 7, created_at: new Date().toISOString() },
  { id: 'cat_gratuitos', name: 'GRATUITOS', icon: '🆓', order: 8, created_at: new Date().toISOString() },
  { id: 'cat_esportes', name: 'ESPORTES AUTORIZADOS', icon: '⚽', order: 9, created_at: new Date().toISOString() },
  { id: 'cat_familia', name: 'FAMÍLIA', icon: '👨‍👩‍👧', order: 10, created_at: new Date().toISOString() },
  { id: 'cat_acao', name: 'AÇÃO', icon: '🔥', order: 11, created_at: new Date().toISOString() },
  { id: 'cat_comedia', name: 'COMÉDIA', icon: '😂', order: 12, created_at: new Date().toISOString() },
  { id: 'cat_terror', name: 'TERROR', icon: '👻', order: 13, created_at: new Date().toISOString() },
  { id: 'cat_romance', name: 'ROMANCE', icon: '❤️', order: 14, created_at: new Date().toISOString() },
  { id: 'cat_ficcao', name: 'FICÇÃO', icon: '🚀', order: 15, created_at: new Date().toISOString() },
  { id: 'cat_drama', name: 'DRAMA', icon: '🎭', order: 16, created_at: new Date().toISOString() },
  { id: 'cat_classicos', name: 'CLÁSSICOS', icon: '⭐', order: 17, created_at: new Date().toISOString() },
  { id: 'cat_series', name: 'SÉRIES', icon: '📺', order: 18, created_at: new Date().toISOString() },
  { id: 'cat_lancamentos', name: 'LANÇAMENTOS', icon: '🆕', order: 19, created_at: new Date().toISOString() },
];

class Database {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor() {
    this.data = this.getDefaultState();
    this.init();
  }

  private getDefaultState(): DatabaseSchema {
    const channelsMap: Record<string, Channel> = {};
    INITIAL_CHANNELS.forEach((c) => {
      channelsMap[c.id] = c;
    });

    const categoriesMap: Record<string, Category> = {};
    INITIAL_CATEGORIES.forEach((c) => {
      categoriesMap[c.id] = c;
    });

    const moviesMap: Record<string, MoviePlatform> = {};
    INITIAL_MOVIES.forEach((m) => {
      moviesMap[m.id] = m;
    });

    const highlightsMap: Record<string, Highlight> = {};
    INITIAL_HIGHLIGHTS.forEach((h) => {
      highlightsMap[h.id] = h;
    });

    const adultMap: Record<string, AdultContent> = {};
    INITIAL_ADULT_CONTENTS.forEach((a) => {
      adultMap[a.id] = a;
    });

    const privateMap: Record<string, PrivateContent> = {};
    INITIAL_PRIVATE_CONTENTS.forEach((p) => {
      privateMap[p.id] = { ...p };
    });

    const adminsMap: Record<string, Admin> = {
      [CONFIG.DEFAULT_OWNER_ID]: {
        telegram_id: CONFIG.DEFAULT_OWNER_ID,
        name: '👑 DONO DO BOT',
        username: 'Owner',
        role: 'owner',
        added_by: 'SYSTEM',
        added_at: new Date().toISOString(),
      },
    };

    const usersMap: Record<string, User> = {
      [CONFIG.DEFAULT_OWNER_ID]: {
        id: CONFIG.DEFAULT_OWNER_ID,
        first_name: 'Proprietário Absoluto',
        last_name: 'Central de TV',
        username: 'OwnerCentralTV',
        status: 'active',
        first_seen_at: new Date().toISOString(),
        is_owner: true,
        is_admin: true,
        notes: '👑 DONO DO BOT com Acesso Total e Permanente',
      },
    };

    return {
      users: usersMap,
      accesses: {},
      checkins: {},
      channels: channelsMap,
      categories: categoriesMap,
      admins: adminsMap,
      movies: moviesMap,
      highlights: highlightsMap,
      adult_contents: adultMap,
      adult_requests: {
        [CONFIG.DEFAULT_OWNER_ID]: {
          id: `req_owner_${CONFIG.DEFAULT_OWNER_ID}`,
          telegram_id: CONFIG.DEFAULT_OWNER_ID,
          user_name: 'Proprietário Absoluto',
          username: 'OwnerCentralTV',
          age_confirmed: true,
          status: 'approved',
          requested_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          processed_by_id: CONFIG.DEFAULT_OWNER_ID,
          processed_by_name: '👑 DONO DO BOT',
          notes: 'Acesso permanente liberado automaticamente para o Dono.',
        },
      },
      private_contents: privateMap,
      private_requests: {
        [CONFIG.DEFAULT_OWNER_ID]: {
          id: `req_priv_owner_${CONFIG.DEFAULT_OWNER_ID}`,
          telegram_id: CONFIG.DEFAULT_OWNER_ID,
          user_name: 'Proprietário Absoluto',
          username: 'OwnerCentralTV',
          status: 'approved',
          requested_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          processed_by_id: CONFIG.DEFAULT_OWNER_ID,
          processed_by_name: '👑 DONO DO BOT',
          notes: 'Acesso permanente liberado automaticamente para o Dono.',
        },
      },
      vazados: {},
      settings: {
        system_name: CONFIG.SYSTEM_NAME,
        owner_id: CONFIG.DEFAULT_OWNER_ID,
        bot_username: '',
        bot_active: true,
        webhook_mode: false,
        auto_expiration_check_minutes: 30,
        last_expiration_check: new Date().toISOString(),
        checkin_welcome_msg: 'Para liberar seu acesso à plataforma, faça seu check-in.',
        telegram_token_configured: false,
        daily_backup_enabled: true,
      },
      logs: [],
    };
  }

  private init() {
    try {
      if (!fs.existsSync(CONFIG.DATA_DIR)) {
        fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(CONFIG.DB_FILE)) {
        const raw = fs.readFileSync(CONFIG.DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          ...this.getDefaultState(),
          ...parsed,
          settings: { ...this.getDefaultState().settings, ...parsed.settings },
        };
      } else {
        this.saveSync();
      }

      // Ensure maps exist
      this.data.movies = this.data.movies || {};
      this.data.highlights = this.data.highlights || {};
      this.data.adult_contents = this.data.adult_contents || {};
      this.data.adult_requests = this.data.adult_requests || {};
      this.data.private_contents = this.data.private_contents || {};
      this.data.private_requests = this.data.private_requests || {};
      this.data.vazados = this.data.vazados || {};

      // Seed initial movies if empty
      if (Object.keys(this.data.movies).length === 0) {
        INITIAL_MOVIES.forEach((m) => {
          this.data.movies[m.id] = { ...m };
        });
      }

      // Seed initial highlights if empty
      if (Object.keys(this.data.highlights).length === 0) {
        INITIAL_HIGHLIGHTS.forEach((h) => {
          this.data.highlights[h.id] = { ...h };
        });
      } else {
        // Ensure CazéTV is present without duplicating existing highlights
        const existingCazeKey = Object.keys(this.data.highlights).find((key) => {
          const h = this.data.highlights[key];
          return (
            h.id === 'hl_cazetv' ||
            h.title?.toLowerCase().includes('cazétv') ||
            h.title?.toLowerCase().includes('cazetv') ||
            h.url?.toLowerCase().includes('@cazetv')
          );
        });

        if (existingCazeKey) {
          const caze = this.data.highlights[existingCazeKey];
          caze.title = caze.title || '⭐ CazéTV';
          caze.url = 'https://www.youtube.com/@CazeTV';
          caze.platform = 'YouTube';
          caze.description = 'Canal CazéTV no YouTube.';
          caze.is_active = true;
        } else {
          const cazeHighlight: Highlight = {
            id: 'hl_cazetv',
            title: '⭐ CazéTV',
            description: 'Canal CazéTV no YouTube.',
            url: 'https://www.youtube.com/@CazeTV',
            platform: 'YouTube',
            image_url: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=600&auto=format&fit=crop&q=80',
            category: 'Esportes & Ao Vivo',
            is_live: true,
            is_active: true,
            is_featured: false,
            order: Object.keys(this.data.highlights).length + 1,
            clicks_count: 0,
            created_at: new Date().toISOString(),
          };
          this.data.highlights[cazeHighlight.id] = cazeHighlight;
        }
      }

      // Ensure private_01 and private_02 exist
      INITIAL_PRIVATE_CONTENTS.forEach((p) => {
        if (!this.data.private_contents[p.id]) {
          this.data.private_contents[p.id] = { ...p };
        } else {
          // If any legacy google URL was stored, purge it!
          if (this.data.private_contents[p.id].url?.includes('google.com')) {
            this.data.private_contents[p.id].url = '';
          }
        }
      });

      // Purge any google URLs from adult_contents as well
      Object.values(this.data.adult_contents).forEach((a) => {
        if (a.url && a.url.includes('google.com')) {
          a.url = '';
        }
      });

      // Always guarantee OWNER_ID is recognized as owner in users & admins with permanent access
      const ownerId = CONFIG.OWNER_ID;
      if (!this.data.admins[ownerId]) {
        this.data.admins[ownerId] = {
          telegram_id: ownerId,
          name: '👑 DONO DO BOT',
          role: 'owner',
          added_by: 'SYSTEM',
          added_at: new Date().toISOString(),
        };
      } else {
        this.data.admins[ownerId].role = 'owner';
        this.data.admins[ownerId].name = '👑 DONO DO BOT';
      }

      if (!this.data.users[ownerId]) {
        this.data.users[ownerId] = {
          id: ownerId,
          first_name: 'Proprietário Absoluto',
          status: 'active',
          first_seen_at: new Date().toISOString(),
          is_owner: true,
          is_admin: true,
          notes: '👑 DONO DO BOT',
        };
      } else {
        this.data.users[ownerId].is_owner = true;
        this.data.users[ownerId].is_admin = true;
        this.data.users[ownerId].status = 'active';
      }

      // Owner always has adult & private access pre-approved
      if (!this.data.adult_requests[ownerId]) {
        this.data.adult_requests[ownerId] = {
          id: `req_owner_${ownerId}`,
          telegram_id: ownerId,
          user_name: '👑 DONO DO BOT',
          age_confirmed: true,
          status: 'approved',
          requested_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          processed_by_id: ownerId,
          processed_by_name: '👑 DONO DO BOT',
          notes: 'Acesso permanente do Dono Absoluto.',
        };
      } else {
        this.data.adult_requests[ownerId].status = 'approved';
        this.data.adult_requests[ownerId].age_confirmed = true;
      }

      if (!this.data.private_requests[ownerId]) {
        this.data.private_requests[ownerId] = {
          id: `req_priv_owner_${ownerId}`,
          telegram_id: ownerId,
          user_name: '👑 DONO DO BOT',
          status: 'approved',
          requested_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          processed_by_id: ownerId,
          processed_by_name: '👑 DONO DO BOT',
          notes: 'Acesso permanente do Dono Absoluto.',
        };
      } else {
        this.data.private_requests[ownerId].status = 'approved';
      }

      // PERMANENTLY REMOVE UNWANTED SERVICES (Rakuten TV, Samsung TV Plus, Canal Gov)
      delete this.data.channels['chan_rakuten_tv'];
      delete this.data.channels['chan_samsung_tv_plus'];
      delete this.data.channels['chan_canal_gov'];
      delete this.data.channels['chan_nasa_plus'];
      delete this.data.channels['chan_ted'];

      // Synchronize and ensure the official authorized channels are registered and active
      for (const ch of INITIAL_CHANNELS) {
        const existing = this.data.channels[ch.id];
        if (!existing) {
          this.data.channels[ch.id] = { ...ch };
        } else {
          // Keep existing, but ensure official name, description, URL, active status, requirements and authorization
          this.data.channels[ch.id] = {
            ...existing,
            name: ch.name,
            description: ch.description,
            category_id: ch.category_id,
            category_name: ch.category_name,
            official_url: ch.official_url,
            official_source: ch.official_source,
            access_requirement: ch.access_requirement || existing.access_requirement || 'direct',
            requirement_note: ch.requirement_note || existing.requirement_note,
            status: 'active',
            admin_authorized: true,
          };
        }
      }

      // Ensure categories have updated icons and order
      for (const cat of INITIAL_CATEGORIES) {
        if (!this.data.categories[cat.id]) {
          this.data.categories[cat.id] = { ...cat };
        } else {
          this.data.categories[cat.id].icon = cat.icon;
          this.data.categories[cat.id].name = cat.name;
        }
      }

      this.saveSync();
      this.initialized = true;
    } catch (err) {
      console.error('[DB] Failed to load database file, using fallback state:', err);
      this.data = this.getDefaultState();
      this.initialized = true;
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveSync();
    }, 250);
  }

  private saveSync() {
    try {
      if (!fs.existsSync(CONFIG.DATA_DIR)) {
        fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
      }
      const tempPath = `${CONFIG.DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, CONFIG.DB_FILE);
    } catch (err) {
      console.error('[DB] Failed to save database to disk:', err);
    }
  }

  // --- Users ---
  getUser(telegramId: string): User | undefined {
    return this.data.users[String(telegramId)];
  }

  getUsers(): User[] {
    return Object.values(this.data.users);
  }

  upsertUser(user: Partial<User> & { id: string }): User {
    const id = String(user.id);
    const existing = this.data.users[id];
    const isOwner = id === CONFIG.OWNER_ID || id === CONFIG.DEFAULT_OWNER_ID;

    const updated: User = {
      id,
      first_name: user.first_name || existing?.first_name || 'Usuário',
      last_name: user.last_name !== undefined ? user.last_name : existing?.last_name,
      username: user.username !== undefined ? user.username : existing?.username,
      status: isOwner ? 'active' : user.status || existing?.status || 'pending',
      first_seen_at: existing?.first_seen_at || new Date().toISOString(),
      last_checkin_at: user.last_checkin_at || existing?.last_checkin_at,
      current_access_id: user.current_access_id || existing?.current_access_id,
      is_owner: isOwner || existing?.is_owner || false,
      is_admin: isOwner || user.is_admin || existing?.is_admin || false,
      notes: user.notes !== undefined ? user.notes : existing?.notes,
    };

    this.data.users[id] = updated;
    this.scheduleSave();
    return updated;
  }

  blockUser(telegramId: string, reason?: string): boolean {
    const user = this.getUser(telegramId);
    if (!user) return false;
    if (user.is_owner || telegramId === CONFIG.OWNER_ID) {
      return false; // Can never block owner
    }
    user.status = 'blocked';
    if (reason) user.notes = reason;
    this.logAction(telegramId, 'USER_BLOCKED', `Usuário bloqueado pelo administrador. Motivo: ${reason || 'Não informado'}`, 'panel');
    this.scheduleSave();
    return true;
  }

  unblockUser(telegramId: string): boolean {
    const user = this.getUser(telegramId);
    if (!user) return false;
    user.status = 'active';
    this.logAction(telegramId, 'USER_UNBLOCKED', 'Usuário desbloqueado pelo administrador.', 'panel');
    this.scheduleSave();
    return true;
  }

  // --- Accesses ---
  createAccess(data: {
    telegramId: string;
    userName: string;
    durationDays: number;
    grantedById: string;
    grantedByName: string;
  }): Access {
    const id = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const expiration = new Date(now.getTime() + data.durationDays * 24 * 60 * 60 * 1000);

    const access: Access = {
      id,
      telegram_id: String(data.telegramId),
      user_name: data.userName,
      start_date: now.toISOString(),
      expiration_date: expiration.toISOString(),
      duration_days: data.durationDays,
      granted_by_id: String(data.grantedById),
      granted_by_name: data.grantedByName,
      status: 'active',
      created_at: now.toISOString(),
    };

    // Mark previous accesses for this user as expired
    Object.values(this.data.accesses).forEach((a) => {
      if (a.telegram_id === access.telegram_id && a.status === 'active') {
        a.status = 'expired';
      }
    });

    this.data.accesses[id] = access;

    // Update user record
    const user = this.getUser(data.telegramId);
    if (user) {
      user.status = 'active';
      user.current_access_id = id;
    } else {
      this.upsertUser({
        id: data.telegramId,
        first_name: data.userName,
        status: 'active',
        current_access_id: id,
      });
    }

    this.logAction(
      data.telegramId,
      'ACCESS_GRANTED',
      `Acesso de ${data.durationDays} dias liberado por ${data.grantedByName} (${data.grantedById})`,
      'panel'
    );

    this.scheduleSave();
    return access;
  }

  getActiveAccessForUser(telegramId: string): Access | undefined {
    const user = this.getUser(telegramId);
    if (user && (user.is_owner || telegramId === CONFIG.OWNER_ID)) {
      // Owner always has perpetual active access
      return {
        id: 'acc_owner_perpetual',
        telegram_id: String(telegramId),
        user_name: user.first_name,
        start_date: new Date().toISOString(),
        expiration_date: new Date(Date.now() + 3650 * 24 * 3600 * 1000).toISOString(),
        duration_days: 3650,
        granted_by_id: 'SYSTEM',
        granted_by_name: 'Proprietário Absoluto',
        status: 'active',
        created_at: new Date().toISOString(),
      };
    }

    const accesses = Object.values(this.data.accesses).filter(
      (a) => a.telegram_id === String(telegramId) && a.status === 'active'
    );
    if (accesses.length === 0) return undefined;

    // Sort by latest expiration
    accesses.sort(
      (a, b) => new Date(b.expiration_date).getTime() - new Date(a.expiration_date).getTime()
    );

    const latest = accesses[0];
    const now = new Date().getTime();
    if (new Date(latest.expiration_date).getTime() <= now) {
      latest.status = 'expired';
      if (user && user.status === 'active') {
        user.status = 'expired';
      }
      this.scheduleSave();
      return undefined;
    }

    return latest;
  }

  getAccesses(): Access[] {
    return Object.values(this.data.accesses).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  getUserAccessHistory(telegramId: string): Access[] {
    return Object.values(this.data.accesses)
      .filter((a) => a.telegram_id === String(telegramId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // --- Check-ins ---
  createCheckIn(data: {
    telegramId: string;
    firstName: string;
    lastName?: string;
    username?: string;
    groupId?: string;
    groupTitle?: string;
  }): { checkIn: CheckIn; isNew: boolean } {
    const id = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const checkIn: CheckIn = {
      id,
      telegram_id: String(data.telegramId),
      first_name: data.firstName,
      last_name: data.lastName,
      username: data.username,
      group_id: data.groupId,
      group_title: data.groupTitle,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    this.data.checkins[id] = checkIn;

    // Ensure user exists in database
    const existingUser = this.getUser(data.telegramId);
    this.upsertUser({
      id: data.telegramId,
      first_name: data.firstName,
      last_name: data.lastName,
      username: data.username,
      last_checkin_at: checkIn.timestamp,
      status: existingUser?.status === 'active' ? 'active' : 'pending',
    });

    this.logAction(
      data.telegramId,
      'CHECKIN_CREATED',
      `Check-in realizado no grupo "${data.groupTitle || 'Privado'}"`,
      'bot'
    );

    this.scheduleSave();
    return { checkIn, isNew: !existingUser };
  }

  getCheckIns(): CheckIn[] {
    return Object.values(this.data.checkins).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getPendingCheckIns(): CheckIn[] {
    return Object.values(this.data.checkins)
      .filter((c) => c.status === 'pending')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  updateCheckInStatus(
    id: string,
    status: 'approved' | 'rejected',
    processedById: string,
    durationDays?: number,
    accessId?: string
  ): CheckIn | null {
    const checkin = this.data.checkins[id];
    if (!checkin) return null;

    checkin.status = status;
    checkin.processed_by_id = String(processedById);
    checkin.processed_at = new Date().toISOString();
    if (durationDays) checkin.duration_days = durationDays;
    if (accessId) checkin.access_id = accessId;

    this.scheduleSave();
    return checkin;
  }

  // --- Channels ---
  getChannels(onlyActiveAndAuthorized = false): Channel[] {
    const all = Object.values(this.data.channels);
    if (onlyActiveAndAuthorized) {
      return all.filter((c) => c.status === 'active' && c.admin_authorized === true);
    }
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  getChannelsByCategory(categoryKey: string): Channel[] {
    const active = this.getChannels(true);
    const key = categoryKey.toLowerCase();

    if (key === 'all' || key === 'cat_canais' || key === 'canais') {
      return active;
    }

    if (key === 'cat_filmes' || key === 'filmes') {
      const targetIds = [
        'chan_pluto_tv',
        'chan_plex_tv',
        'chan_lg_channels',
        'chan_redbull_tv',
      ];
      return active.filter(
        (c) => targetIds.includes(c.id) || c.category_id === 'cat_filmes' || c.category_name.includes('FILMES')
      );
    }

    if (key === 'cat_tv_ao_vivo' || key === 'tv_ao_vivo' || key === 'live') {
      const liveIds = [
        'chan_tv_globo',
        'chan_pluto_tv',
        'chan_lg_channels',
        'chan_tv_brasil',
        'chan_cultura',
        'chan_camara',
        'chan_senado',
        'chan_dw',
        'chan_euronews',
      ];
      return active.filter(
        (c) =>
          liveIds.includes(c.id) ||
          c.content_type === 'live' ||
          c.category_id === 'cat_tv_ao_vivo' ||
          c.category_name.includes('AO VIVO')
      );
    }

    if (key === 'cat_internacionais' || key === 'internacionais') {
      const intlIds = ['chan_dw', 'chan_euronews'];
      return active.filter(
        (c) =>
          intlIds.includes(c.id) ||
          c.category_id === 'cat_internacionais' ||
          c.category_name.includes('INTERNACIONAIS')
      );
    }

    if (key === 'cat_brasil' || key === 'brasil') {
      const brIds = ['chan_tv_globo', 'chan_tv_brasil', 'chan_cultura'];
      return active.filter(
        (c) => brIds.includes(c.id) || c.category_id === 'cat_brasil' || c.category_name.includes('BRASIL')
      );
    }

    if (key === 'cat_educacao' || key === 'educacao') {
      const eduIds = ['chan_futura'];
      return active.filter(
        (c) => eduIds.includes(c.id) || c.category_id === 'cat_educacao' || c.category_name.includes('EDUCAÇÃO')
      );
    }

    if (key === 'cat_cultura' || key === 'cultura') {
      const cultIds = ['chan_sesctv'];
      return active.filter(
        (c) => cultIds.includes(c.id) || c.category_id === 'cat_cultura' || c.category_name.includes('CULTURA')
      );
    }

    if (key === 'cat_noticias' || key === 'noticias') {
      const notIds = ['chan_camara', 'chan_senado', 'chan_dw', 'chan_euronews'];
      return active.filter(
        (c) => notIds.includes(c.id) || c.category_id === 'cat_noticias' || c.category_name.includes('NOTÍCIAS')
      );
    }

    return active.filter((c) => c.category_id === categoryKey);
  }

  getChannel(id: string): Channel | undefined {
    return this.data.channels[id];
  }

  createChannel(channel: Omit<Channel, 'id' | 'created_at'>): Channel {
    const id = `chan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newChan: Channel = {
      ...channel,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.channels[id] = newChan;
    this.logAction(
      channel.created_by_id,
      'CHANNEL_CREATED',
      `Canal "${channel.name}" cadastrado. Status inicial: ${channel.status}, Autorizado: ${channel.admin_authorized}`,
      'panel'
    );
    this.scheduleSave();
    return newChan;
  }

  updateChannel(id: string, updates: Partial<Channel>, adminId: string): Channel | null {
    const channel = this.data.channels[id];
    if (!channel) return null;

    Object.assign(channel, updates);
    this.logAction(
      adminId,
      'CHANNEL_UPDATED',
      `Canal "${channel.name}" atualizado. Status: ${channel.status}, Autorizado: ${channel.admin_authorized}`,
      'panel'
    );
    this.scheduleSave();
    return channel;
  }

  deleteChannel(id: string, adminId: string): boolean {
    const channel = this.data.channels[id];
    if (!channel) return false;
    const name = channel.name;
    delete this.data.channels[id];
    this.logAction(adminId, 'CHANNEL_DELETED', `Canal "${name}" removido do catálogo.`, 'panel');
    this.scheduleSave();
    return true;
  }

  // --- Categories ---
  getCategories(): Category[] {
    return Object.values(this.data.categories).sort((a, b) => a.order - b.order);
  }

  createCategory(name: string, icon: string): Category {
    const id = `cat_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const order = Object.keys(this.data.categories).length + 1;
    const cat: Category = {
      id,
      name: name.toUpperCase().trim(),
      icon: icon || '📺',
      order,
      created_at: new Date().toISOString(),
    };
    this.data.categories[id] = cat;
    this.scheduleSave();
    return cat;
  }

  deleteCategory(id: string): boolean {
    if (this.data.categories[id]) {
      delete this.data.categories[id];
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // --- Movies (🎬 FILMES) ---
  getMovies(onlyActive = false): MoviePlatform[] {
    const list = Object.values(this.data.movies || {});
    if (onlyActive) {
      return list.filter((m) => m.is_active).sort((a, b) => a.order - b.order);
    }
    return list.sort((a, b) => a.order - b.order);
  }

  getMovie(id: string): MoviePlatform | undefined {
    return this.data.movies?.[id];
  }

  createMovie(movie: Omit<MoviePlatform, 'id' | 'created_at'>): MoviePlatform {
    const id = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const order = movie.order || Object.keys(this.data.movies || {}).length + 1;
    const newMovie: MoviePlatform = {
      ...movie,
      id,
      order,
      created_at: new Date().toISOString(),
    };
    this.data.movies[id] = newMovie;
    this.logAction(
      CONFIG.OWNER_ID,
      'MOVIE_CREATED',
      `Plataforma de filme cadastrada: "${newMovie.name}" (${newMovie.platform})`,
      'panel'
    );
    this.scheduleSave();
    return newMovie;
  }

  updateMovie(id: string, updates: Partial<MoviePlatform>): MoviePlatform | null {
    const movie = this.data.movies?.[id];
    if (!movie) return null;
    Object.assign(movie, updates);
    this.logAction(
      CONFIG.OWNER_ID,
      'MOVIE_UPDATED',
      `Plataforma de filme atualizada: "${movie.name}"`,
      'panel'
    );
    this.scheduleSave();
    return movie;
  }

  deleteMovie(id: string): boolean {
    const movie = this.data.movies?.[id];
    if (!movie) return false;
    const name = movie.name;
    delete this.data.movies[id];
    this.logAction(
      CONFIG.OWNER_ID,
      'MOVIE_DELETED',
      `Plataforma de filme removida: "${name}"`,
      'panel'
    );
    this.scheduleSave();
    return true;
  }

  toggleMovieStatus(id: string): MoviePlatform | null {
    const movie = this.data.movies?.[id];
    if (!movie) return null;
    movie.is_active = !movie.is_active;
    this.scheduleSave();
    return movie;
  }

  // --- Highlights (⭐ DESTAQUES) ---
  getHighlights(onlyActive = false): Highlight[] {
    const list = Object.values(this.data.highlights || {});
    if (onlyActive) {
      return list.filter((h) => h.is_active).sort((a, b) => a.order - b.order);
    }
    return list.sort((a, b) => a.order - b.order);
  }

  getHighlight(id: string): Highlight | undefined {
    return this.data.highlights?.[id];
  }

  createHighlight(hl: Omit<Highlight, 'id' | 'clicks_count' | 'created_at'>): Highlight {
    const id = `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const order = hl.order || Object.keys(this.data.highlights || {}).length + 1;
    const newHl: Highlight = {
      ...hl,
      id,
      order,
      clicks_count: 0,
      created_at: new Date().toISOString(),
    };
    this.data.highlights[id] = newHl;
    this.logAction(
      CONFIG.OWNER_ID,
      'HIGHLIGHT_CREATED',
      `Destaque cadastrado: "${newHl.title}" (${newHl.platform})`,
      'panel'
    );
    this.scheduleSave();
    return newHl;
  }

  updateHighlight(id: string, updates: Partial<Highlight>): Highlight | null {
    const hl = this.data.highlights?.[id];
    if (!hl) return null;
    Object.assign(hl, updates);
    this.logAction(
      CONFIG.OWNER_ID,
      'HIGHLIGHT_UPDATED',
      `Destaque atualizado: "${hl.title}"`,
      'panel'
    );
    this.scheduleSave();
    return hl;
  }

  deleteHighlight(id: string): boolean {
    const hl = this.data.highlights?.[id];
    if (!hl) return false;
    const title = hl.title;
    delete this.data.highlights[id];
    this.logAction(
      CONFIG.OWNER_ID,
      'HIGHLIGHT_DELETED',
      `Destaque removido: "${title}"`,
      'panel'
    );
    this.scheduleSave();
    return true;
  }

  incrementHighlightClick(id: string): void {
    const hl = this.data.highlights?.[id];
    if (hl) {
      hl.clicks_count = (hl.clicks_count || 0) + 1;
      this.scheduleSave();
    }
  }

  toggleHighlightStatus(id: string): Highlight | null {
    const hl = this.data.highlights?.[id];
    if (!hl) return null;
    hl.is_active = !hl.is_active;
    this.scheduleSave();
    return hl;
  }

  // --- Adult Content (🔞 CONTEÚDO +18) ---
  getAdultContents(onlyActive = false): AdultContent[] {
    const list = Object.values(this.data.adult_contents || {});
    if (onlyActive) {
      return list.filter((a) => a.is_active).sort((a, b) => a.order - b.order);
    }
    return list.sort((a, b) => a.order - b.order);
  }

  getAdultContent(id: string): AdultContent | undefined {
    return this.data.adult_contents?.[id];
  }

  createAdultContent(content: Omit<AdultContent, 'id' | 'created_at'>): AdultContent {
    const id = `adult_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const order = content.order || Object.keys(this.data.adult_contents || {}).length + 1;
    const newContent: AdultContent = {
      ...content,
      id,
      order,
      created_at: new Date().toISOString(),
    };
    this.data.adult_contents[id] = newContent;
    this.logAction(
      CONFIG.OWNER_ID,
      'ADULT_CONTENT_CREATED',
      `Conteúdo +18 cadastrado: "${newContent.title}"`,
      'panel'
    );
    this.scheduleSave();
    return newContent;
  }

  updateAdultContent(id: string, updates: Partial<AdultContent>): AdultContent | null {
    const content = this.data.adult_contents?.[id];
    if (!content) return null;
    Object.assign(content, updates);
    this.logAction(
      CONFIG.OWNER_ID,
      'ADULT_CONTENT_UPDATED',
      `Conteúdo +18 atualizado: "${content.title}"`,
      'panel'
    );
    this.scheduleSave();
    return content;
  }

  deleteAdultContent(id: string): boolean {
    const content = this.data.adult_contents?.[id];
    if (!content) return false;
    const title = content.title;
    delete this.data.adult_contents[id];
    this.logAction(
      CONFIG.OWNER_ID,
      'ADULT_CONTENT_DELETED',
      `Conteúdo +18 removido: "${title}"`,
      'panel'
    );
    this.scheduleSave();
    return true;
  }

  toggleAdultContentStatus(id: string): AdultContent | null {
    const content = this.data.adult_contents?.[id];
    if (!content) return null;
    content.is_active = !content.is_active;
    this.scheduleSave();
    return content;
  }

  // --- Adult Access Control & Security ---
  hasAdultAccess(telegramId: string): boolean {
    const id = String(telegramId);
    if (this.isOwner(id)) return true; // Owner ID 6918626496 always has total access

    const user = this.getUser(id);
    if (user && user.status === 'blocked') return false;

    // Check request record
    const req = this.getAdultRequestByTelegramId(id);
    return req !== undefined && req.status === 'approved';
  }

  getAdultRequests(): AdultAccessRequest[] {
    return Object.values(this.data.adult_requests || {}).sort(
      (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );
  }

  getAdultRequest(id: string): AdultAccessRequest | undefined {
    return this.data.adult_requests?.[id];
  }

  getAdultRequestByTelegramId(telegramId: string): AdultAccessRequest | undefined {
    const id = String(telegramId);
    return Object.values(this.data.adult_requests || {}).find((r) => r.telegram_id === id);
  }

  createAdultRequest(data: {
    telegramId: string;
    userName: string;
    username?: string;
  }): { request: AdultAccessRequest; isNew: boolean } {
    const id = String(data.telegramId);
    const existing = this.getAdultRequestByTelegramId(id);

    if (existing) {
      if (existing.status === 'blocked') {
        return { request: existing, isNew: false };
      }
      if (existing.status === 'approved') {
        return { request: existing, isNew: false };
      }
      // If already pending or previously rejected, renew request
      existing.age_confirmed = true;
      existing.status = 'pending';
      existing.requested_at = new Date().toISOString();
      existing.user_name = data.userName;
      if (data.username) existing.username = data.username;
      this.logAction(
        id,
        'ADULT_ACCESS_REQUESTED',
        `Solicitação de acesso +18 renovada por ${data.userName} (@${data.username || 'sem_username'})`,
        'bot'
      );
      this.scheduleSave();
      return { request: existing, isNew: false };
    }

    const reqId = `req_adult_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newReq: AdultAccessRequest = {
      id: reqId,
      telegram_id: id,
      user_name: data.userName,
      username: data.username,
      age_confirmed: true,
      status: 'pending',
      requested_at: new Date().toISOString(),
    };

    this.data.adult_requests[reqId] = newReq;
    this.logAction(
      id,
      'ADULT_ACCESS_REQUESTED',
      `Nova solicitação de acesso +18 registrada por ${data.userName} (@${data.username || 'sem_username'})`,
      'bot'
    );
    this.scheduleSave();
    return { request: newReq, isNew: true };
  }

  approveAdultAccess(
    requestIdOrTelegramId: string,
    adminId: string,
    adminName: string
  ): AdultAccessRequest | null {
    let req: AdultAccessRequest | undefined = this.data.adult_requests?.[requestIdOrTelegramId];
    if (!req) {
      req = this.getAdultRequestByTelegramId(requestIdOrTelegramId);
    }
    if (!req) return null;

    req.status = 'approved';
    req.processed_at = new Date().toISOString();
    req.processed_by_id = String(adminId);
    req.processed_by_name = adminName || '👑 DONO DO BOT';

    this.logAction(
      req.telegram_id,
      'ADULT_ACCESS_APPROVED',
      `Acesso +18 liberado pelo Dono ${req.processed_by_name} (${adminId})`,
      'panel'
    );
    this.scheduleSave();
    return req;
  }

  rejectAdultAccess(requestIdOrTelegramId: string, adminId: string): AdultAccessRequest | null {
    let req: AdultAccessRequest | undefined = this.data.adult_requests?.[requestIdOrTelegramId];
    if (!req) {
      req = this.getAdultRequestByTelegramId(requestIdOrTelegramId);
    }
    if (!req) return null;

    req.status = 'rejected';
    req.processed_at = new Date().toISOString();
    req.processed_by_id = String(adminId);
    req.processed_by_name = '👑 DONO DO BOT';

    this.logAction(
      req.telegram_id,
      'ADULT_ACCESS_REJECTED',
      `Solicitação de acesso +18 recusada pelo Dono (${adminId})`,
      'panel'
    );
    this.scheduleSave();
    return req;
  }

  blockAdultAccess(telegramId: string, reason?: string): boolean {
    const id = String(telegramId);
    if (this.isOwner(id)) return false; // Can never block owner

    let req = this.getAdultRequestByTelegramId(id);
    if (!req) {
      const user = this.getUser(id);
      req = {
        id: `req_adult_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        telegram_id: id,
        user_name: user?.first_name || 'Usuário',
        username: user?.username,
        age_confirmed: false,
        status: 'blocked',
        requested_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        processed_by_id: CONFIG.OWNER_ID,
        processed_by_name: '👑 DONO DO BOT',
        notes: reason || 'Bloqueio administrativo da área +18',
      };
      this.data.adult_requests[req.id] = req;
    } else {
      req.status = 'blocked';
      req.processed_at = new Date().toISOString();
      req.processed_by_id = CONFIG.OWNER_ID;
      req.processed_by_name = '👑 DONO DO BOT';
      if (reason) req.notes = reason;
    }

    this.logAction(
      id,
      'ADULT_ACCESS_BLOCKED',
      `Usuário bloqueado da área +18. Motivo: ${reason || 'Decisão administrativa'}`,
      'panel'
    );
    this.scheduleSave();
    return true;
  }

  // --- 🔐 PRIVADO (Área Restrita / Conteúdos 01 & 02) ---
  getPrivateContents(): PrivateContent[] {
    const list = Object.values(this.data.private_contents || {});
    // Ensure both private_01 and private_02 exist
    const has01 = list.find((c) => c.id === 'private_01');
    const has02 = list.find((c) => c.id === 'private_02');
    if (!has01) {
      this.data.private_contents['private_01'] = {
        id: 'private_01',
        name: 'CONTEÚDO 01',
        url: '',
        status: 'active',
        created_by: CONFIG.DEFAULT_OWNER_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    if (!has02) {
      this.data.private_contents['private_02'] = {
        id: 'private_02',
        name: 'CONTEÚDO 02',
        url: '',
        status: 'active',
        created_by: CONFIG.DEFAULT_OWNER_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return Object.values(this.data.private_contents).sort((a, b) => a.id.localeCompare(b.id));
  }

  getPrivateContent(id: string): PrivateContent | undefined {
    // If not found yet, ensure it is created on demand
    if (!this.data.private_contents?.[id]) {
      if (id === 'private_01' || id === 'private_02') {
        const item: PrivateContent = {
          id,
          name: id === 'private_02' ? 'CONTEÚDO 02' : 'CONTEÚDO 01',
          url: '',
          status: 'active',
          created_by: CONFIG.DEFAULT_OWNER_ID,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.data.private_contents = this.data.private_contents || {};
        this.data.private_contents[id] = item;
        this.scheduleSave();
        return item;
      }
    }
    return this.data.private_contents?.[id];
  }

  savePrivateContentUrl(id: string, rawUrl: string, adminId: string): PrivateContent | null {
    let content = this.getPrivateContent(id);
    const now = new Date().toISOString();
    let cleanUrl = rawUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    if (!content) {
      content = {
        id,
        name: id === 'private_02' ? 'CONTEÚDO 02' : 'CONTEÚDO 01',
        url: cleanUrl,
        status: 'active',
        created_by: String(adminId),
        created_at: now,
        updated_at: now,
      };
      this.data.private_contents[id] = content;
    } else {
      content.url = cleanUrl;
      content.status = 'active';
      content.updated_at = now;
    }

    // Keep adult_contents in sync for compatibility
    const adultId = id === 'private_02' ? 'adult_02' : 'adult_01';
    if (this.data.adult_contents?.[adultId]) {
      this.data.adult_contents[adultId].url = cleanUrl;
      this.data.adult_contents[adultId].is_active = true;
    }

    this.logAction(
      adminId,
      'PRIVATE_LINK_SAVED',
      `Link cadastrado em ${content.name}: "${cleanUrl}"`,
      'bot'
    );
    this.scheduleSave();
    return content;
  }

  clearPrivateContentUrl(id: string, adminId: string): PrivateContent | null {
    const content = this.getPrivateContent(id);
    if (!content) return null;

    content.url = '';
    content.updated_at = new Date().toISOString();

    const adultId = id === 'private_02' ? 'adult_02' : 'adult_01';
    if (this.data.adult_contents?.[adultId]) {
      this.data.adult_contents[adultId].url = '';
    }

    this.logAction(
      adminId,
      'PRIVATE_LINK_REMOVED',
      `Link removido de ${content.name}. Conteúdo sem link cadastrado.`,
      'bot'
    );
    this.scheduleSave();
    return content;
  }

  // --- Private Access Control (🔐 PRIVADO) ---
  hasPrivateAccess(telegramId: string): boolean {
    const id = String(telegramId);
    if (this.isOwner(id)) return true; // Owner ID 6918626496 always has total access

    const user = this.getUser(id);
    if (user && user.status === 'blocked') return false;

    // Check private request record
    const req = this.getPrivateRequestByTelegramId(id);
    if (req && req.status === 'approved') return true;

    // Check existing adult request as fallback
    const adultReq = this.getAdultRequestByTelegramId(id);
    return adultReq !== undefined && adultReq.status === 'approved';
  }

  getPrivateRequests(): PrivateAccessRequest[] {
    return Object.values(this.data.private_requests || {}).sort(
      (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );
  }

  getPrivateRequest(id: string): PrivateAccessRequest | undefined {
    return this.data.private_requests?.[id];
  }

  getPrivateRequestByTelegramId(telegramId: string): PrivateAccessRequest | undefined {
    const id = String(telegramId);
    return Object.values(this.data.private_requests || {}).find((r) => r.telegram_id === id);
  }

  createPrivateRequest(data: {
    telegramId: string;
    userName: string;
    username?: string;
  }): { request: PrivateAccessRequest; isNew: boolean } {
    const id = String(data.telegramId);
    const existing = this.getPrivateRequestByTelegramId(id);

    if (existing) {
      if (existing.status === 'blocked') {
        return { request: existing, isNew: false };
      }
      if (existing.status === 'approved') {
        return { request: existing, isNew: false };
      }
      existing.status = 'pending';
      existing.requested_at = new Date().toISOString();
      existing.user_name = data.userName;
      if (data.username) existing.username = data.username;
      this.logAction(
        id,
        'PRIVATE_ACCESS_REQUESTED',
        `Solicitação de acesso 🔐 PRIVADO renovada por ${data.userName} (@${data.username || 'sem_username'})`,
        'bot'
      );
      this.scheduleSave();
      return { request: existing, isNew: false };
    }

    const reqId = `req_priv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newReq: PrivateAccessRequest = {
      id: reqId,
      telegram_id: id,
      user_name: data.userName,
      username: data.username,
      status: 'pending',
      requested_at: new Date().toISOString(),
    };

    this.data.private_requests[reqId] = newReq;
    this.logAction(
      id,
      'PRIVATE_ACCESS_REQUESTED',
      `Nova solicitação de acesso 🔐 PRIVADO registrada por ${data.userName} (@${data.username || 'sem_username'})`,
      'bot'
    );
    this.scheduleSave();
    return { request: newReq, isNew: true };
  }

  approvePrivateAccess(
    requestIdOrTelegramId: string,
    adminId: string,
    adminName: string
  ): PrivateAccessRequest | null {
    let req: PrivateAccessRequest | undefined = this.data.private_requests?.[requestIdOrTelegramId];
    if (!req) {
      req = this.getPrivateRequestByTelegramId(requestIdOrTelegramId);
    }
    if (!req) {
      // Check adult request
      const adultReq = this.getAdultRequest(requestIdOrTelegramId) || this.getAdultRequestByTelegramId(requestIdOrTelegramId);
      if (adultReq) {
        req = {
          id: `req_priv_${adultReq.id}`,
          telegram_id: adultReq.telegram_id,
          user_name: adultReq.user_name,
          username: adultReq.username,
          status: 'pending',
          requested_at: adultReq.requested_at,
        };
        this.data.private_requests[req.id] = req;
      }
    }
    if (!req) return null;

    req.status = 'approved';
    req.processed_at = new Date().toISOString();
    req.processed_by_id = String(adminId);
    req.processed_by_name = adminName || '👑 DONO DO BOT';

    const adultReq = this.getAdultRequestByTelegramId(req.telegram_id);
    if (adultReq) {
      adultReq.status = 'approved';
      adultReq.processed_at = req.processed_at;
      adultReq.processed_by_id = req.processed_by_id;
      adultReq.processed_by_name = req.processed_by_name;
    }

    this.logAction(
      req.telegram_id,
      'PRIVATE_ACCESS_APPROVED',
      `Acesso 🔐 PRIVADO liberado pelo Dono ${req.processed_by_name} (${adminId})`,
      'panel'
    );
    this.scheduleSave();
    return req;
  }

  rejectPrivateAccess(requestIdOrTelegramId: string, adminId: string): PrivateAccessRequest | null {
    let req: PrivateAccessRequest | undefined = this.data.private_requests?.[requestIdOrTelegramId];
    if (!req) {
      req = this.getPrivateRequestByTelegramId(requestIdOrTelegramId);
    }
    if (!req) return null;

    req.status = 'rejected';
    req.processed_at = new Date().toISOString();
    req.processed_by_id = String(adminId);
    req.processed_by_name = '👑 DONO DO BOT';

    const adultReq = this.getAdultRequestByTelegramId(req.telegram_id);
    if (adultReq) {
      adultReq.status = 'rejected';
      adultReq.processed_at = req.processed_at;
      adultReq.processed_by_id = req.processed_by_id;
      adultReq.processed_by_name = req.processed_by_name;
    }

    this.logAction(
      req.telegram_id,
      'PRIVATE_ACCESS_REJECTED',
      `Solicitação de acesso 🔐 PRIVADO recusada pelo Dono (${adminId})`,
      'panel'
    );
    this.scheduleSave();
    return req;
  }

  blockPrivateAccess(telegramId: string, reason?: string): boolean {
    const id = String(telegramId);
    if (this.isOwner(id)) return false;

    let req = this.getPrivateRequestByTelegramId(id);
    if (!req) {
      const user = this.getUser(id);
      req = {
        id: `req_priv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        telegram_id: id,
        user_name: user?.first_name || 'Usuário',
        username: user?.username,
        status: 'blocked',
        requested_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        processed_by_id: CONFIG.OWNER_ID,
        processed_by_name: '👑 DONO DO BOT',
        notes: reason || 'Bloqueio administrativo da área privada',
      };
      this.data.private_requests[req.id] = req;
    } else {
      req.status = 'blocked';
      req.processed_at = new Date().toISOString();
      req.processed_by_id = CONFIG.OWNER_ID;
      req.processed_by_name = '👑 DONO DO BOT';
      if (reason) req.notes = reason;
    }

    this.logAction(
      id,
      'PRIVATE_ACCESS_BLOCKED',
      `Usuário bloqueado da área 🔐 PRIVADO. Motivo: ${reason || 'Decisão administrativa'}`,
      'panel'
    );
    this.scheduleSave();
    return true;
  }

  // --- 🔐 VAZADOS (Biblioteca Dinâmica de Conteúdos) ---
  getVazados(onlyActive = true): VazadoContent[] {
    const list = Object.values(this.data.vazados || {});
    const filtered = onlyActive ? list.filter((v) => v.status === 'active') : list;
    return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getVazado(id: string): VazadoContent | undefined {
    return this.data.vazados?.[id];
  }

  createVazado(data: {
    title: string;
    description: string;
    url: string;
    created_by?: string;
  }): VazadoContent {
    const existing = Object.values(this.data.vazados || {});
    const maxNum = existing.reduce((max, item) => Math.max(max, item.item_number || 0), 0);
    const itemNumber = maxNum + 1;
    const displayName = `Conteúdo ${String(itemNumber).padStart(2, '0')}`;
    const id = `vazado_${itemNumber}_${Date.now()}`;
    const now = new Date().toISOString();

    let cleanUrl = data.url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const vazado: VazadoContent = {
      id,
      item_number: itemNumber,
      display_name: displayName,
      title: data.title.trim(),
      description: data.description ? data.description.trim() : '',
      url: cleanUrl,
      status: 'active',
      order: itemNumber,
      created_by: String(data.created_by || CONFIG.OWNER_ID),
      created_at: now,
      updated_at: now,
    };

    this.data.vazados[id] = vazado;
    this.logAction(
      data.created_by || CONFIG.OWNER_ID,
      'VAZADO_CREATED',
      `Novo vazado cadastrado: [${displayName}] "${vazado.title}"`,
      'bot'
    );
    this.scheduleSave();
    return vazado;
  }

  updateVazado(id: string, updates: Partial<VazadoContent>, adminId?: string): VazadoContent | null {
    const item = this.data.vazados?.[id];
    if (!item) return null;

    if (updates.url !== undefined) {
      let cleanUrl = updates.url.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      item.url = cleanUrl;
    }
    if (updates.title !== undefined) item.title = updates.title.trim();
    if (updates.description !== undefined) item.description = updates.description.trim();
    if (updates.status !== undefined) item.status = updates.status;
    if (updates.order !== undefined) item.order = updates.order;
    item.updated_at = new Date().toISOString();

    this.logAction(
      adminId || CONFIG.OWNER_ID,
      'VAZADO_UPDATED',
      `Vazado atualizado: [${item.display_name}] "${item.title}"`,
      'panel'
    );
    this.scheduleSave();
    return item;
  }

  deleteVazado(id: string, adminId?: string): boolean {
    const item = this.data.vazados?.[id];
    if (!item) return false;
    const name = item.display_name;
    delete this.data.vazados[id];
    this.logAction(
      adminId || CONFIG.OWNER_ID,
      'VAZADO_DELETED',
      `Vazado removido: [${name}] "${item.title}"`,
      'bot'
    );
    this.scheduleSave();
    return true;
  }

  toggleVazadoStatus(id: string, adminId?: string): VazadoContent | null {
    const item = this.data.vazados?.[id];
    if (!item) return null;
    item.status = item.status === 'active' ? 'inactive' : 'active';
    item.updated_at = new Date().toISOString();
    this.scheduleSave();
    return item;
  }

  reorderVazado(id: string, direction: 'up' | 'down'): boolean {
    const all = this.getVazados(false);
    const index = all.findIndex((v) => v.id === id);
    if (index === -1) return false;
    if (direction === 'up' && index === 0) return false;
    if (direction === 'down' && index === all.length - 1) return false;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const current = all[index];
    const target = all[swapIndex];

    const tempOrder = current.order;
    current.order = target.order;
    target.order = tempOrder;

    current.updated_at = new Date().toISOString();
    target.updated_at = new Date().toISOString();

    this.scheduleSave();
    return true;
  }

  getUsersWithValidAccess(): User[] {
    const allUsers = Object.values(this.data.users || {});
    return allUsers.filter((u) => {
      if (u.status === 'blocked') return false;
      const acc = this.getActiveAccessForUser(u.id);
      return !!acc;
    });
  }

  // --- Admins & Owners ---
  isOwner(telegramId: string): boolean {
    const id = String(telegramId);
    return id === CONFIG.OWNER_ID || id === CONFIG.DEFAULT_OWNER_ID;
  }

  isAdmin(telegramId: string): boolean {
    const id = String(telegramId);
    if (this.isOwner(id)) return true;
    const admin = this.data.admins[id];
    return !!admin;
  }

  getAdmins(): Admin[] {
    return Object.values(this.data.admins);
  }

  addAdmin(telegramId: string, name: string, addedBy: string): Admin {
    const admin: Admin = {
      telegram_id: String(telegramId),
      name,
      role: 'admin',
      added_by: addedBy,
      added_at: new Date().toISOString(),
    };
    this.data.admins[String(telegramId)] = admin;
    const user = this.getUser(telegramId);
    if (user) user.is_admin = true;
    this.scheduleSave();
    return admin;
  }

  removeAdmin(telegramId: string): boolean {
    const id = String(telegramId);
    if (this.isOwner(id)) return false; // Cannot remove owner
    if (this.data.admins[id]) {
      delete this.data.admins[id];
      const user = this.getUser(id);
      if (user) user.is_admin = false;
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // --- Settings ---
  getSettings(): SystemSettings {
    return { ...this.data.settings, owner_id: CONFIG.OWNER_ID };
  }

  updateSettings(updates: Partial<SystemSettings>): SystemSettings {
    Object.assign(this.data.settings, updates);
    this.scheduleSave();
    return this.data.settings;
  }

  // --- Logs ---
  logAction(
    telegramId: string,
    action: string,
    details: string,
    source: 'bot' | 'panel' | 'system' = 'system'
  ): AccessLog {
    const user = this.getUser(telegramId);
    const log: AccessLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      telegram_id: String(telegramId),
      user_name: user?.first_name || 'Desconhecido',
      action,
      details,
      timestamp: new Date().toISOString(),
      source,
    };
    this.data.logs.unshift(log);
    // Keep max 1000 logs in memory
    if (this.data.logs.length > 1000) {
      this.data.logs = this.data.logs.slice(0, 1000);
    }
    this.scheduleSave();
    return log;
  }

  getLogs(limit = 100): AccessLog[] {
    return this.data.logs.slice(0, limit);
  }

  // --- Stats ---
  getStats(): SystemStats {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;

    const users = Object.values(this.data.users);
    const activeAccesses = Object.values(this.data.accesses).filter(
      (a) => a.status === 'active' && new Date(a.expiration_date).getTime() > now.getTime()
    );
    const expiredAccesses = Object.values(this.data.accesses).filter(
      (a) => a.status === 'expired' || new Date(a.expiration_date).getTime() <= now.getTime()
    );
    const pendingCheckIns = Object.values(this.data.checkins).filter(
      (c) => c.status === 'pending'
    );
    const blockedUsers = users.filter((u) => u.status === 'blocked');
    const channels = Object.values(this.data.channels);
    const activeChannels = channels.filter(
      (c) => c.status === 'active' && c.admin_authorized === true
    );

    const checkinsToday = Object.values(this.data.checkins).filter(
      (c) => new Date(c.timestamp).getTime() >= todayStart
    ).length;

    const checkinsLast7Days = Object.values(this.data.checkins).filter(
      (c) => new Date(c.timestamp).getTime() >= sevenDaysAgo
    ).length;

    const movies = Object.values(this.data.movies || {});
    const activeMovies = movies.filter((m) => m.is_active);
    const highlights = Object.values(this.data.highlights || {});
    const adultContents = Object.values(this.data.adult_contents || {});
    const adultRequests = Object.values(this.data.adult_requests || {});
    const pendingAdultRequests = adultRequests.filter((r) => r.status === 'pending');
    const approvedAdultUsers = adultRequests.filter((r) => r.status === 'approved');
    const privateContents = Object.values(this.data.private_contents || {});
    const privateRequests = Object.values(this.data.private_requests || {});
    const pendingPrivateRequests = privateRequests.filter((r) => r.status === 'pending');
    const approvedPrivateUsers = privateRequests.filter((r) => r.status === 'approved');

    return {
      total_users: users.length,
      active_accesses: activeAccesses.length,
      pending_requests: pendingCheckIns.length,
      expired_accesses: expiredAccesses.length,
      blocked_users: blockedUsers.length,
      total_channels: channels.length,
      active_channels: activeChannels.length,
      total_categories: Object.keys(this.data.categories).length,
      total_movies: movies.length,
      active_movies: activeMovies.length,
      total_highlights: highlights.length,
      total_adult_contents: adultContents.length,
      pending_adult_requests: pendingAdultRequests.length,
      approved_adult_users: approvedAdultUsers.length,
      total_private_contents: privateContents.length,
      pending_private_requests: pendingPrivateRequests.length,
      approved_private_users: approvedPrivateUsers.length,
      total_vazados: Object.keys(this.data.vazados || {}).length,
      active_vazados: Object.values(this.data.vazados || {}).filter((v) => v.status === 'active').length,
      checkins_today: checkinsToday,
      checkins_last_7_days: checkinsLast7Days,
    };
  }

  // Check and flag expired accesses
  checkAndExpireAccesses(): {
    expiredNow: Access[];
    warning3Days: Access[];
    warning1Day: Access[];
  } {
    const now = new Date().getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const oneDayMs = 1 * 24 * 60 * 60 * 1000;

    const expiredNow: Access[] = [];
    const warning3Days: Access[] = [];
    const warning1Day: Access[] = [];

    Object.values(this.data.accesses).forEach((access) => {
      // Don't expire owner perpetual access
      if (this.isOwner(access.telegram_id)) return;

      const exp = new Date(access.expiration_date).getTime();
      const timeLeft = exp - now;

      if (access.status === 'active') {
        if (timeLeft <= 0) {
          // Expired
          access.status = 'expired';
          const user = this.getUser(access.telegram_id);
          if (user && user.status === 'active') {
            user.status = 'expired';
          }
          expiredNow.push(access);
          this.logAction(
            access.telegram_id,
            'ACCESS_EXPIRED',
            `Acesso de ${access.user_name} expirou automaticamente.`,
            'system'
          );
        } else if (timeLeft <= oneDayMs && !access.warning_1_day_sent) {
          warning1Day.push(access);
          access.warning_1_day_sent = true;
        } else if (timeLeft <= threeDaysMs && !access.warning_3_days_sent) {
          warning3Days.push(access);
          access.warning_3_days_sent = true;
        }
      }
    });

    this.data.settings.last_expiration_check = new Date().toISOString();
    this.scheduleSave();

    return { expiredNow, warning3Days, warning1Day };
  }

  // --- Automatic & Manual Backups (users, channels, logs, movies, highlights, private, vazados) ---
  exportBackupData(type: 'daily_auto' | 'manual' = 'daily_auto'): BackupPayload {
    const usersList = Object.values(this.data.users);
    const channelsList = Object.values(this.data.channels);
    const logsList = [...this.data.logs];
    const moviesList = Object.values(this.data.movies || {});
    const highlightsList = Object.values(this.data.highlights || {});
    const adultContentsList = Object.values(this.data.adult_contents || {});
    const adultRequestsList = Object.values(this.data.adult_requests || {});
    const privateContentsList = Object.values(this.data.private_contents || {});
    const privateRequestsList = Object.values(this.data.private_requests || {});
    const vazadosList = Object.values(this.data.vazados || {});

    return {
      backup_version: '2.0',
      generated_at: new Date().toISOString(),
      type,
      system_name: CONFIG.SYSTEM_NAME,
      owner_id: CONFIG.OWNER_ID,
      stats: {
        users_count: usersList.length,
        channels_count: channelsList.length,
        logs_count: logsList.length,
        movies_count: moviesList.length,
        highlights_count: highlightsList.length,
        adult_contents_count: adultContentsList.length,
        private_contents_count: privateContentsList.length,
        vazados_count: vazadosList.length,
      },
      tables: {
        users: usersList,
        channels: channelsList,
        logs: logsList,
        movies: moviesList,
        highlights: highlightsList,
        adult_contents: adultContentsList,
        adult_requests: adultRequestsList,
        private_contents: privateContentsList,
        private_requests: privateRequestsList,
        vazados: vazadosList,
      },
    };
  }

  updateDailyBackupRecord(dateStr: string, timestampStr: string, filename: string) {
    this.data.settings.daily_backup_enabled = true;
    this.data.settings.last_daily_backup_date = dateStr;
    this.data.settings.last_daily_backup_at = timestampStr;
    this.data.settings.last_daily_backup_file = filename;
    this.scheduleSave();
  }
}

export const db = new Database();
