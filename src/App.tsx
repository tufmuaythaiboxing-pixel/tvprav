/**
 * CENTRAL DE TV — Painel Administrativo & Centro de Controle
 * Tema: Cinema / Streaming Profissional
 */

import React, { useState, useEffect } from 'react';
import {
  Tv,
  Users,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Film,
  Sparkles,
  BarChart3,
  Settings,
  History,
  Lock,
  ChevronRight,
  Globe,
  Radio,
  Send,
  HelpCircle,
  Layers,
  ArrowRight,
  Webhook,
  Zap,
  Copy,
  Check,
  Activity,
  Wifi,
  WifiOff,
  Database,
  Download,
  FileText,
  HardDrive,
  FolderArchive,
} from 'lucide-react';
import {
  User,
  Channel,
  Category,
  CheckIn,
  AccessLog,
  SystemStats,
  BackupMetadata,
  BackupStatus,
} from './models/types.ts';
import { formatDateBR, calculateRemainingDays } from './utils/validation.ts';

type Tab = 'overview' | 'checkins' | 'users' | 'channels' | 'categories' | 'simulator' | 'logs' | 'backups' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // Entities
  const [users, setUsers] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);

  // Filters & Search
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'pending' | 'expired' | 'blocked'>('all');
  const [channelSearch, setChannelSearch] = useState('');
  const [channelCategoryFilter, setChannelCategoryFilter] = useState<string>('all');

  // Modals & Actions
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userHistoryModal, setUserHistoryModal] = useState<boolean>(false);
  const [grantModal, setGrantModal] = useState<{ open: boolean; user?: any; checkin?: CheckIn } | null>(null);
  const [grantDays, setGrantDays] = useState<number>(7);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [addChannelModal, setAddChannelModal] = useState(false);
  const [newChannel, setNewChannel] = useState<{
    name: string;
    description: string;
    category_id: string;
    official_url: string;
    official_source: string;
    available_regions: string;
    content_type: any;
    image_url: string;
    status: 'active' | 'inactive';
    admin_authorized: boolean;
    notes: string;
  }>({
    name: '',
    description: '',
    category_id: '',
    official_url: '',
    official_source: '',
    available_regions: 'BR, Global',
    content_type: 'live',
    image_url: '',
    status: 'inactive',
    admin_authorized: false,
    notes: '',
  });

  // Settings inputs
  const [botTokenInput, setBotTokenInput] = useState('');
  const [tokenStatusMsg, setTokenStatusMsg] = useState<{ success?: boolean; text: string } | null>(null);
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);

  // Webhook inputs & live status
  const [webhookUrlInput, setWebhookUrlInput] = useState(
    typeof window !== 'undefined' ? `${window.location.origin}/api/telegram-webhook` : ''
  );
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [webhookStatusMsg, setWebhookStatusMsg] = useState<{ success?: boolean; text: string } | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Simulator State
  const [simRole, setSimRole] = useState<'group' | 'user' | 'owner'>('group');
  const [simChatLog, setSimChatLog] = useState<Array<{ sender: string; text: string; buttons?: any[]; time: string }>>([
    {
      sender: 'Central de TV Bot',
      text: '🎬 CENTRAL DE TV\n\nPara liberar seu acesso à plataforma, faça seu check-in.',
      buttons: [{ label: '✅ FAZER CHECK-IN', action: 'sim_checkin' }],
      time: 'Agora',
    },
  ]);
  const [simUser, setSimUser] = useState({
    id: '123456789',
    name: 'João Silva',
    username: 'joaosilva',
  });
  const [simActiveCategory, setSimActiveCategory] = useState<string | null>(null);

  // Backups State
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupsList, setBackupsList] = useState<BackupMetadata[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [generatingBackup, setGeneratingBackup] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{ success: boolean; text: string } | null>(null);
  const [previewBackupModal, setPreviewBackupModal] = useState<{ filename: string; payload: any } | null>(null);
  const [copiedBackupJson, setCopiedBackupJson] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [stRes, statRes, uRes, chkRes, chRes, catRes, lgRes] = await Promise.all([
        fetch('/api/status').then((r) => r.json()),
        fetch('/api/stats').then((r) => r.json()),
        fetch('/api/users').then((r) => r.json()),
        fetch('/api/checkins').then((r) => r.json()),
        fetch('/api/channels').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/logs?limit=50').then((r) => r.json()),
      ]);

      setSystemStatus(stRes);
      if (stRes.webhook_url) {
        setWebhookUrlInput(stRes.webhook_url);
      }
      setStats(statRes);
      setUsers(uRes);
      setCheckins(chkRes);
      setChannels(chRes);
      setCategories(catRes);
      setLogs(lgRes);

      if (catRes.length > 0 && !newChannel.category_id) {
        setNewChannel((prev) => ({ ...prev, category_id: catRes[0].id }));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      setBackupLoading(true);
      const [st, list] = await Promise.all([
        fetch('/api/backup/status').then((r) => r.json()),
        fetch('/api/backup/list').then((r) => r.json()),
      ]);
      setBackupStatus(st);
      setBackupsList(list);
    } catch (e) {
      console.error('Error fetching backups:', e);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleGenerateBackup = async (type: 'daily_auto' | 'manual' = 'manual') => {
    setGeneratingBackup(true);
    setBackupNotice(null);
    try {
      const res = await fetch('/api/backup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, triggered_by: 'Proprietário Absoluto (Painel)' }),
      });
      const data = await res.json();
      if (res.ok) {
        setBackupNotice({
          success: true,
          text: `Backup gerado com sucesso! Arquivo: ${data.backup?.filename} (${data.backup?.size_formatted})`,
        });
        fetchBackups();
        fetchData();
      } else {
        setBackupNotice({ success: false, text: data.error || 'Erro ao gerar backup.' });
      }
    } catch (e: any) {
      setBackupNotice({ success: false, text: e?.message || 'Falha na requisição.' });
    } finally {
      setGeneratingBackup(false);
    }
  };

  const handleDownloadBackup = (filename?: string) => {
    const url = filename ? `/api/backup/download/${encodeURIComponent(filename)}` : '/api/backup/download';
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || 'central_tv_backup_latest.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenBackupPreview = async (filename: string) => {
    try {
      const res = await fetch(`/api/backup/view/${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (res.ok) {
        setPreviewBackupModal(data);
      } else {
        alert(data.error || 'Erro ao carregar pré-visualização.');
      }
    } catch (e: any) {
      alert('Falha ao obter visualização do backup.');
    }
  };

  useEffect(() => {
    fetchData();
    fetchBackups();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchWebhookInfo();
    }
    if (activeTab === 'backups' || activeTab === 'overview') {
      fetchBackups();
    }
  }, [activeTab]);

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.id.includes(userSearch) ||
      u.first_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.last_name && u.last_name.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.username && u.username.toLowerCase().includes(userSearch.toLowerCase()));

    if (!matchesSearch) return false;
    if (userFilter === 'all') return true;
    return u.status === userFilter;
  });

  // Filtered channels
  const filteredChannels = channels.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
      c.description.toLowerCase().includes(channelSearch.toLowerCase()) ||
      c.official_source.toLowerCase().includes(channelSearch.toLowerCase());

    if (!matchesSearch) return false;
    if (channelCategoryFilter === 'all') return true;
    return c.category_id === channelCategoryFilter;
  });

  const pendingCheckins = checkins.filter((c) => c.status === 'pending');

  // Actions
  const handleApproveCheckIn = (checkin: CheckIn, days: number) => {
    const name = `${checkin.first_name}${checkin.last_name ? ' ' + checkin.last_name : ''}`;
    setConfirmDialog({
      open: true,
      title: 'Confirmar Liberação de Acesso',
      message: `Você deseja liberar ${days} dias de acesso para ${name} (ID: ${checkin.telegram_id})?`,
      onConfirm: async () => {
        try {
          await fetch(`/api/checkins/${checkin.id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days, adminId: '6918626496', adminName: 'Proprietário' }),
          });
          fetchData();
        } catch (e) {
          console.error(e);
        }
      },
    });
  };

  const handleRejectCheckIn = (checkin: CheckIn) => {
    const name = `${checkin.first_name}${checkin.last_name ? ' ' + checkin.last_name : ''}`;
    setConfirmDialog({
      open: true,
      title: 'Confirmar Recusa',
      message: `Você deseja recusar a solicitação de check-in de ${name}?`,
      onConfirm: async () => {
        try {
          await fetch(`/api/checkins/${checkin.id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: '6918626496' }),
          });
          fetchData();
        } catch (e) {
          console.error(e);
        }
      },
    });
  };

  const handleToggleChannelStatus = async (channel: Channel) => {
    try {
      await fetch(`/api/channels/${channel.id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: '6918626496' }),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyChannel = async (channel: Channel) => {
    setConfirmDialog({
      open: true,
      title: 'Confirmar Autorização e Gratuidade',
      message: `Você confirma que o canal "${channel.name}" provém de fonte oficial pública (${channel.official_source}), não viola direitos autorais e é gratuito na região de operação?`,
      onConfirm: async () => {
        try {
          await fetch(`/api/channels/${channel.id}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_id: '6918626496' }),
          });
          fetchData();
        } catch (e) {
          console.error(e);
        }
      },
    });
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newChannel,
          available_regions: newChannel.available_regions.split(',').map((r) => r.trim()),
          admin_id: '6918626496',
          admin_name: 'Proprietário Central de TV',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao adicionar canal');
        return;
      }
      setAddChannelModal(false);
      setNewChannel({
        name: '',
        description: '',
        category_id: categories[0]?.id || '',
        official_url: '',
        official_source: '',
        available_regions: 'BR, Global',
        content_type: 'live',
        image_url: '',
        status: 'inactive',
        admin_authorized: false,
        notes: '',
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunExpiration = async () => {
    try {
      const res = await fetch('/api/expiration/run', { method: 'POST' });
      const data = await res.json();
      alert(`Rotina de expiração executada!\nExpirados agora: ${data.result?.expiredCount || 0}\nAlertas 1 dia: ${data.result?.warning1DayCount || 0}\nAlertas 3 dias: ${data.result?.warning3DaysCount || 0}`);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfigureBot = async (mode: 'polling' | 'stop') => {
    setIsUpdatingToken(true);
    setTokenStatusMsg(null);
    try {
      const res = await fetch('/api/bot/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: botTokenInput ? botTokenInput.trim() : undefined,
          mode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTokenStatusMsg({ success: true, text: data.message || 'Configurado com sucesso!' });
        fetchData();
      } else {
        setTokenStatusMsg({ success: false, text: data.error || 'Erro ao configurar bot.' });
      }
    } catch (err: any) {
      setTokenStatusMsg({ success: false, text: err?.message || 'Falha de comunicação.' });
    } finally {
      setIsUpdatingToken(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!webhookUrlInput || !webhookUrlInput.trim()) {
      setWebhookStatusMsg({ success: false, text: 'Informe uma URL válida para o Webhook.' });
      return;
    }
    setWebhookLoading(true);
    setWebhookStatusMsg(null);
    try {
      const res = await fetch('/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set',
          webhookUrl: webhookUrlInput.trim(),
          secretToken: webhookSecretInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWebhookStatusMsg({
          success: true,
          text: data.message || 'Webhook configurado e ativado com sucesso!',
        });
        fetchData();
        fetchWebhookInfo();
      } else {
        setWebhookStatusMsg({
          success: false,
          text: data.error || 'Falha ao registrar Webhook na API do Telegram.',
        });
      }
    } catch (err: any) {
      setWebhookStatusMsg({ success: false, text: err?.message || 'Falha na comunicação com o servidor.' });
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleDeleteWebhook = async () => {
    setWebhookLoading(true);
    setWebhookStatusMsg(null);
    try {
      const res = await fetch('/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      const data = await res.json();
      if (res.ok) {
        setWebhookStatusMsg({
          success: true,
          text: data.message || 'Webhook desativado. Modo alternado para Long Polling.',
        });
        fetchData();
        fetchWebhookInfo();
      } else {
        setWebhookStatusMsg({
          success: false,
          text: data.error || 'Falha ao desativar Webhook.',
        });
      }
    } catch (err: any) {
      setWebhookStatusMsg({ success: false, text: err?.message || 'Falha na comunicação com o servidor.' });
    } finally {
      setWebhookLoading(false);
    }
  };

  const fetchWebhookInfo = async () => {
    try {
      const res = await fetch('/api/bot/webhook-info');
      const data = await res.json();
      setWebhookInfo(data);
    } catch (err) {
      console.error('Error fetching webhook info:', err);
    }
  };

  const handleTestWebhookPing = async () => {
    try {
      const res = await fetch('/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_ping' }),
      });
      const data = await res.json();
      alert(
        `✅ Diagnóstico do Endpoint:\n\n${data.message}\nRota: ${data.endpoint}\nStatus: Pronto para receber updates via POST em tempo real.`
      );
    } catch (err: any) {
      alert(`Erro no teste: ${err?.message}`);
    }
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrlInput);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // Simulator triggers
  const handleSimCheckinClick = async () => {
    try {
      const res = await fetch('/api/bot/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'group_checkin',
          payload: {
            telegramId: simUser.id,
            firstName: simUser.name,
            username: simUser.username,
            groupTitle: '🎬 Grupo VIP Central de TV',
          },
        }),
      });
      const data = await res.json();

      setSimChatLog((prev) => [
        ...prev,
        {
          sender: simUser.name,
          text: `[Clicou em ✅ FAZER CHECK-IN]`,
          time: 'Agora',
        },
        {
          sender: 'Central de TV Bot (Toast)',
          text: data.message,
          time: 'Agora',
        },
      ]);

      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimStartCommand = async () => {
    try {
      const res = await fetch('/api/bot/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'user_start',
          payload: {
            telegramId: simUser.id,
            firstName: simUser.name,
          },
        }),
      });
      const data = await res.json();

      setSimChatLog((prev) => [
        ...prev,
        {
          sender: simUser.name,
          text: `/start`,
          time: 'Agora',
        },
        {
          sender: 'Central de TV Bot',
          text: `${data.title}\n\n${data.body}`,
          buttons: data.buttons.map((b: string) => ({ label: b, action: b })),
          time: 'Agora',
        },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans flex flex-col selection:bg-rose-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0d1424]/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 p-0.5 shadow-lg shadow-rose-900/30">
            <div className="w-full h-full bg-[#0d1424] rounded-[10px] flex items-center justify-center">
              <Tv className="w-5 h-5 text-rose-500" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-200 bg-clip-text text-transparent">
                CENTRAL DE TV
              </h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-rose-950/70 border border-rose-800/60 text-rose-300">
                Oficial
              </span>
            </div>
            <p className="text-xs text-slate-400">Bot Telegram Profissional & Sistema de Controle</p>
          </div>
        </div>

        {/* Owner Supreme Badge & Bot Status */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-300 text-xs">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Proprietário Absoluto:</span>
            <span className="font-mono font-bold text-amber-200">6918626496</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <div className={`w-2 h-2 rounded-full ${systemStatus?.webhook_mode ? 'bg-emerald-400 animate-pulse' : (systemStatus?.bot_running ? 'bg-blue-400 animate-pulse' : 'bg-amber-500')}`} />
            <span className="text-slate-300 font-medium">
              {systemStatus?.bot_username ? `@${systemStatus.bot_username}` : 'Bot Standby'}
            </span>
            {systemStatus?.webhook_mode ? (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Zap className="w-2.5 h-2.5 text-emerald-400" />
                WEBHOOK
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <Radio className="w-2.5 h-2.5 text-blue-400" />
                POLLING
              </span>
            )}
          </div>

          <button
            onClick={fetchData}
            title="Atualizar dados"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800/80 bg-[#0a0f1d] p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:block">
            Menu Operacional
          </div>

          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'overview'
                ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('checkins')}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'checkins'
                ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4" />
              <span>Solicitações (Check-in)</span>
            </div>
            {pendingCheckins.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {pendingCheckins.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'users'
                ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuários & Acessos</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'channels'
                ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Film className="w-4 h-4" />
              <span>Catálogo de Canais</span>
            </div>
            <span className="text-[10px] text-slate-500">
              {channels.filter((c) => c.status === 'active' && c.admin_authorized).length}/{channels.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'categories'
                ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Categorias</span>
          </button>

          <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:block mt-3">
            Ferramentas & Integração
          </div>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'simulator'
                ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>Simulador Telegram</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'logs'
                ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Auditoria & Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('backups')}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'backups'
                ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Backups & Dados</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Diário
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'settings'
                ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Deploy & Configurações</span>
          </button>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* Top Banner Alert */}
              <div className="rounded-2xl bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-amber-950/20 border border-rose-900/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Central de TV Operando</h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                      Acesso proprietário fixo ao Telegram ID <strong className="text-amber-300 font-mono">6918626496</strong>.
                      Catálogo protegido com validação estrita anti-pirataria e liberação expressa de check-ins.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownloadBackup()}
                    className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-xs font-medium text-amber-300 border border-amber-500/40 flex items-center gap-2 transition-all shadow-sm"
                    title="Baixar backup JSON imediato das tabelas users, channels e logs"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Baixar Backup JSON</span>
                  </button>

                  <button
                    onClick={handleRunExpiration}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-2 transition-all shadow-sm"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Verificar Expirações</span>
                  </button>
                </div>
              </div>

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs">Usuários Totais</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold mt-2 text-white">{stats?.total_users || 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Ativos no sistema
                  </div>
                </div>

                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs">Acessos Ativos</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold mt-2 text-emerald-400">{stats?.active_accesses || 0}</div>
                  <div className="text-[11px] text-emerald-500/80 mt-1">
                    Liberados e vigentes
                  </div>
                </div>

                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs">Solicitações Pendentes</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold mt-2 text-amber-400">{stats?.pending_requests || 0}</div>
                  <div className="text-[11px] text-amber-400/80 mt-1">
                    Aguardando liberação
                  </div>
                </div>

                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs">Canais Oficiais</span>
                    <Tv className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold mt-2 text-white">
                    {stats?.active_channels || 0} <span className="text-xs text-slate-500 font-normal">/ {stats?.total_channels || 0}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Ativos e autorizados
                  </div>
                </div>
              </div>

              {/* Secondary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Check-ins Hoje</div>
                    <div className="text-xl font-bold text-white mt-1">{stats?.checkins_today || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Check-ins Últimos 7 Dias</div>
                    <div className="text-xl font-bold text-white mt-1">{stats?.checkins_last_7_days || 0}</div>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Acessos Expirados</div>
                    <div className="text-xl font-bold text-rose-400 mt-1">{stats?.expired_accesses || 0}</div>
                  </div>
                  <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400">
                    <XCircle className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Privado & Vazados</div>
                    <div className="text-xl font-bold text-amber-300 mt-1">
                      {stats?.total_vazados || 0} <span className="text-xs text-slate-400 font-normal">vazados</span>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                    <Lock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Quick Action Tables: Pending Check-ins & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Check-ins Box */}
                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <h3 className="font-semibold text-sm text-white">Solicitações de Check-In Pendentes</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('checkins')}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                    >
                      Ver todas ({pendingCheckins.length})
                    </button>
                  </div>

                  {pendingCheckins.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-slate-500 text-xs">
                      <CheckCircle2 className="w-8 h-8 text-slate-600 mb-2" />
                      Nenhuma solicitação pendente no momento.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingCheckins.slice(0, 4).map((chk) => (
                        <div
                          key={chk.id}
                          className="bg-[#090f1d] border border-slate-800/80 rounded-lg p-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-xs text-white truncate">
                              {chk.first_name} {chk.last_name || ''}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-amber-300/80">ID: {chk.telegram_id}</span>
                              <span>•</span>
                              <span>{chk.group_title || 'Direto'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleApproveCheckIn(chk, 7)}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-medium"
                            >
                              7 Dias
                            </button>
                            <button
                              onClick={() => handleApproveCheckIn(chk, 30)}
                              className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded text-[11px] font-medium"
                            >
                              30 Dias
                            </button>
                            <button
                              onClick={() => handleRejectCheckIn(chk)}
                              className="p-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/50 rounded"
                              title="Recusar"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit Logs Box */}
                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-rose-400" />
                      <h3 className="font-semibold text-sm text-white">Últimos Eventos & Auditoria</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('logs')}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                    >
                      Histórico Completo
                    </button>
                  </div>

                  <div className="space-y-2.5 overflow-y-auto max-h-[260px]">
                    {logs.slice(0, 6).map((log) => (
                      <div
                        key={log.id}
                        className="bg-[#090f1d] border border-slate-800/60 rounded-lg p-2.5 text-xs flex items-start gap-2.5"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-200">{log.action}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {formatDateBR(log.timestamp)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{log.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHECKINS */}
          {activeTab === 'checkins' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Solicitações de Check-In</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Usuários que interagiram no grupo com o botão <strong className="text-rose-300">✅ FAZER CHECK-IN</strong>.
                  </p>
                </div>
              </div>

              {pendingCheckins.length === 0 ? (
                <div className="bg-[#0e1627] border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-white">Tudo em dia!</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Não há nenhuma solicitação de acesso aguardando liberação. Novos check-ins feitos no grupo ou bot aparecerão aqui instantaneamente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingCheckins.map((chk) => (
                    <div
                      key={chk.id}
                      className="bg-[#0e1627] border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition-all shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-sm text-white">
                              {chk.first_name} {chk.last_name || ''}
                            </h3>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              ID: <span className="text-amber-300 font-bold">{chk.telegram_id}</span>
                              {chk.username && <span className="text-slate-500 ml-2">@{chk.username}</span>}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Aguardando Liberação
                          </span>
                        </div>

                        <div className="mt-3 py-2 px-3 bg-[#090f1d] rounded-lg text-xs space-y-1 text-slate-300 border border-slate-800/80">
                          <div>
                            <span className="text-slate-500">Grupo:</span> {chk.group_title || 'Chat Privado'}
                          </div>
                          <div>
                            <span className="text-slate-500">Data e Hora:</span> {formatDateBR(chk.timestamp)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => handleApproveCheckIn(chk, 1)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium"
                        >
                          (1 DIA)
                        </button>
                        <button
                          onClick={() => handleApproveCheckIn(chk, 7)}
                          className="px-2.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 rounded text-xs font-semibold"
                        >
                          (7 DIAS)
                        </button>
                        <button
                          onClick={() => handleApproveCheckIn(chk, 15)}
                          className="px-2.5 py-1.5 bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 rounded text-xs font-semibold"
                        >
                          (15 DIAS)
                        </button>
                        <button
                          onClick={() => handleApproveCheckIn(chk, 30)}
                          className="px-2.5 py-1.5 bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 rounded text-xs font-semibold"
                        >
                          (30 DIAS)
                        </button>
                        <button
                          onClick={() => {
                            const custom = prompt('Digite a quantidade de dias personalizada:', '60');
                            if (custom && parseInt(custom, 10) > 0) {
                              handleApproveCheckIn(chk, parseInt(custom, 10));
                            }
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-xs font-medium"
                        >
                          (PERSONALIZAR)
                        </button>
                        <button
                          onClick={() => handleRejectCheckIn(chk)}
                          className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded text-xs font-medium ml-auto"
                        >
                          (❌ RECUSAR)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: USERS & ACCESSES */}
          {activeTab === 'users' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Usuários & Gestão de Acessos</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Pesquise por Nome, Username ou Telegram ID. Controle total de validade, bloqueios e histórico.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por Nome, ID ou @"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-[#0e1627] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-64"
                    />
                  </div>

                  <select
                    value={userFilter}
                    onChange={(e: any) => setUserFilter(e.target.value)}
                    className="bg-[#0e1627] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="active">Acessos Ativos</option>
                    <option value="pending">Aguardando Liberação</option>
                    <option value="expired">Acessos Expirados</option>
                    <option value="blocked">Bloqueados</option>
                  </select>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-[#0e1627] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#090f1d] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3.5">Usuário / ID</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Início / Validade</th>
                        <th className="px-4 py-3.5">Dias Restantes</th>
                        <th className="px-4 py-3.5 text-right">Ações de Gestão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            Nenhum usuário encontrado com os filtros informados.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isOwner = u.id === '6918626496';
                          const active = u.active_access;
                          return (
                            <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">
                                    {u.first_name[0]}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-white flex items-center gap-1.5">
                                      {u.first_name} {u.last_name || ''}
                                      {isOwner && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                          PROPRIETÁRIO
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                                      <span>ID: {u.id}</span>
                                      {u.username && <span className="text-slate-500">@{u.username}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                {isOwner ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    VITALÍCIO / TOTAL
                                  </span>
                                ) : u.status === 'blocked' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                    BLOQUEADO
                                  </span>
                                ) : active ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    🟢 ATIVO
                                  </span>
                                ) : u.status === 'pending' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    PENDENTE
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                    🔴 EXPIRADO
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-slate-300">
                                {isOwner ? (
                                  <span className="text-amber-300 font-medium">Acesso Permanente</span>
                                ) : active ? (
                                  <div>
                                    <div>{formatDateBR(active.expiration_date)}</div>
                                    <div className="text-[10px] text-slate-500">Início: {formatDateBR(active.start_date)}</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {isOwner ? (
                                  <span className="text-emerald-400 font-bold">∞</span>
                                ) : active ? (
                                  <span className="font-semibold text-emerald-400">
                                    {active.remaining_days} dias
                                  </span>
                                ) : (
                                  <span className="text-slate-500">0 dias</span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isOwner && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setSelectedUser(u);
                                          setGrantDays(7);
                                          setGrantModal({ open: true, user: u });
                                        }}
                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-medium"
                                      >
                                        Liberar Acesso
                                      </button>

                                      {u.status === 'blocked' ? (
                                        <button
                                          onClick={async () => {
                                            await fetch(`/api/users/${u.id}/unblock`, { method: 'POST' });
                                            fetchData();
                                          }}
                                          className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded text-[11px]"
                                        >
                                          Desbloquear
                                        </button>
                                      ) : (
                                        <button
                                          onClick={async () => {
                                            if (confirm(`Deseja bloquear o usuário ${u.first_name}?`)) {
                                              await fetch(`/api/users/${u.id}/block`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ reason: 'Ação administrativa' }),
                                              });
                                              fetchData();
                                            }
                                          }}
                                          className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded text-[11px]"
                                        >
                                          Bloquear
                                        </button>
                                      )}
                                    </>
                                  )}

                                  <button
                                    onClick={async () => {
                                      const res = await fetch(`/api/users/${u.id}`).then((r) => r.json());
                                      setSelectedUser(res);
                                      setUserHistoryModal(true);
                                    }}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                                    title="Histórico"
                                  >
                                    Histórico
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHANNELS */}
          {activeTab === 'channels' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Catálogo de Canais Oficiais & Autorizados</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Conformidade estrita: Apenas fontes oficiais públicas. Todos os canais exigem confirmação do administrador antes da exibição aos usuários.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar canal ou fonte oficial..."
                      value={channelSearch}
                      onChange={(e) => setChannelSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-[#0e1627] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-56"
                    />
                  </div>

                  <select
                    value={channelCategoryFilter}
                    onChange={(e) => setChannelCategoryFilter(e.target.value)}
                    className="bg-[#0e1627] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="all">Todas as Categorias</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setAddChannelModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-950/40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Canal Oficial</span>
                  </button>
                </div>
              </div>

              {/* Channels Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredChannels.map((chan) => (
                  <div
                    key={chan.id}
                    className="bg-[#0e1627] border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group"
                  >
                    <div>
                      {/* Image Header */}
                      <div className="relative h-36 bg-slate-900 overflow-hidden">
                        <img
                          src={chan.image_url}
                          alt={chan.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1627] via-transparent to-black/40" />

                        {/* Badges */}
                        <div className="absolute top-3 left-3 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-black/60 backdrop-blur-md text-slate-200 border border-white/10">
                            {chan.category_name}
                          </span>
                        </div>

                        <div className="absolute top-3 right-3">
                          {chan.status === 'active' && chan.admin_authorized ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 backdrop-blur-md">
                              🟢 ATIVO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 backdrop-blur-md">
                              🔴 DESATIVADO
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Info Body */}
                      <div className="p-4 space-y-2.5">
                        <h3 className="font-bold text-sm text-white group-hover:text-rose-400 transition-colors">
                          {chan.name}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {chan.description}
                        </p>

                        <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                          <div>
                            <span className="text-slate-500">Fonte Oficial:</span>{' '}
                            <strong className="text-slate-300">{chan.official_source}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Disponibilidade:</span>{' '}
                            <span className="text-slate-300">{chan.available_regions.join(', ')}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Autorização:</span>{' '}
                            {chan.admin_authorized ? (
                              <span className="text-emerald-400 font-medium">Confirmada pelo Administrador</span>
                            ) : (
                              <span className="text-amber-400 font-medium">Pendente de Confirmação</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="p-4 pt-0 border-t border-slate-800/60 mt-3 flex items-center justify-between gap-2">
                      <a
                        href={chan.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title="Abrir página oficial do canal"
                      >
                        <Play className="w-3 h-3 text-rose-400" />
                        <span>Abrir Link</span>
                        <ExternalLink className="w-3 h-3 text-slate-500 ml-0.5" />
                      </a>

                      <div className="flex items-center gap-1.5">
                        {!chan.admin_authorized && (
                          <button
                            onClick={() => handleVerifyChannel(chan)}
                            className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium"
                          >
                            Autorizar
                          </button>
                        )}

                        <button
                          onClick={() => handleToggleChannelStatus(chan)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            chan.status === 'active'
                              ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50'
                              : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50'
                          }`}
                        >
                          {chan.status === 'active' ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Categorias de Conteúdo</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Organize os canais por gênero, país ou finalidade (Filmes, Séries, Notícias, etc.).
                  </p>
                </div>

                <button
                  onClick={() => {
                    const name = prompt('Nome da nova categoria (ex: ANIMAÇÃO):');
                    if (!name) return;
                    const icon = prompt('Emoji da categoria (ex: 🎨):', '🎬');
                    fetch('/api/categories', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name, icon }),
                    }).then(() => fetchData());
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Categoria</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.map((cat) => {
                  const count = channels.filter((c) => c.category_id === cat.id).length;
                  const activeCount = channels.filter(
                    (c) => c.category_id === cat.id && c.status === 'active' && c.admin_authorized
                  ).length;
                  return (
                    <div
                      key={cat.id}
                      className="bg-[#0e1627] border border-slate-800 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cat.icon}</span>
                        <div>
                          <h4 className="font-semibold text-xs text-white">{cat.name}</h4>
                          <span className="text-[11px] text-slate-500">
                            {activeCount} ativos / {count} canais
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (confirm(`Excluir categoria ${cat.name}?`)) {
                            await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
                            fetchData();
                          }
                        }}
                        className="text-slate-600 hover:text-rose-400 p-1"
                        title="Excluir Categoria"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: TELEGRAM SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div>
                <h2 className="text-xl font-bold text-white">Simulador Telegram Interativo</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Teste o fluxo completo em tempo real diretamente no navegador (Check-in em Grupo, Aprovação pelo Dono e Navegação de Canais).
                </p>
              </div>

              {/* Perspective Selector */}
              <div className="flex items-center gap-2 p-1.5 bg-[#0e1627] border border-slate-800 rounded-xl w-fit">
                <button
                  onClick={() => setSimRole('group')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    simRole === 'group'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  👥 Visão do Grupo (Check-in)
                </button>
                <button
                  onClick={() => setSimRole('user')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    simRole === 'user'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📱 Visão do Usuário Privado (/start)
                </button>
                <button
                  onClick={() => setSimRole('owner')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    simRole === 'owner'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  👑 Notificação do Proprietário (6918626496)
                </button>
              </div>

              {/* Simulated Telegram Client Window */}
              <div className="bg-[#0b1220] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
                {/* Header */}
                <div className="bg-[#121c32] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center font-bold text-xs text-white">
                      {simRole === 'group' ? '👥' : simRole === 'owner' ? '👑' : '🎬'}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">
                        {simRole === 'group'
                          ? 'Grupo VIP CENTRAL DE TV Oficial'
                          : simRole === 'owner'
                          ? 'Central de TV Bot (Mensagem Direta ao Dono)'
                          : 'Central de TV Bot'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {simRole === 'group' ? '1.420 membros • 84 online' : 'bot verificado • oficial'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setSimChatLog([
                          {
                            sender: 'Central de TV Bot',
                            text: '🎬 CENTRAL DE TV\n\nPara liberar seu acesso à plataforma, faça seu check-in.',
                            buttons: [{ label: '✅ FAZER CHECK-IN', action: 'sim_checkin' }],
                            time: 'Agora',
                          },
                        ])
                      }
                      className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800"
                    >
                      Limpar Chat
                    </button>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-[#0b1220] to-[#080d17]">
                  {simRole === 'group' && (
                    <div className="max-w-md bg-[#16223b] border border-slate-700/80 rounded-2xl p-4 shadow-lg text-xs space-y-3">
                      <div className="font-bold text-rose-400 text-sm flex items-center gap-1.5">
                        <Tv className="w-4 h-4" /> 🎬 CENTRAL DE TV
                      </div>
                      <p className="text-slate-200 leading-relaxed">
                        Para liberar seu acesso à plataforma, faça seu check-in.
                      </p>
                      <button
                        onClick={handleSimCheckinClick}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs tracking-wide shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95"
                      >
                        <span>✅ FAZER CHECK-IN</span>
                      </button>
                    </div>
                  )}

                  {simRole === 'user' && (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <div className="bg-rose-600 text-white text-xs px-3 py-2 rounded-2xl rounded-tr-none">
                          /start
                        </div>
                      </div>

                      <div className="max-w-md bg-[#16223b] border border-slate-700/80 rounded-2xl p-4 shadow-lg text-xs space-y-3">
                        <div className="font-bold text-white text-sm">🎬 CENTRAL DE TV</div>
                        <div className="text-slate-300">
                          Olá, <strong>{simUser.name}</strong>!
                        </div>

                        {users.find((u) => u.id === simUser.id)?.active_access ? (
                          <>
                            <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl space-y-1">
                              <div className="text-[11px] text-emerald-400 font-bold">🟢 SEU ACESSO: ATIVO</div>
                              <div className="text-slate-300">
                                Dias restantes: <strong>7 dias</strong>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2">
                              <button
                                onClick={() => setActiveTab('channels')}
                                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-center"
                              >
                                📺 VER CANAIS
                              </button>
                              <button
                                onClick={() => alert('Meu Acesso: Status ATIVO.')}
                                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-center"
                              >
                                👤 MEU ACESSO
                              </button>
                              <button
                                onClick={handleSimCheckinClick}
                                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-center"
                              >
                                🔄 NOVO CHECK-IN
                              </button>
                              <button
                                onClick={() => alert('Informações: Plataforma oficial pública.')}
                                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-center"
                              >
                                ℹ️ INFORMAÇÕES
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="p-2.5 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300">
                              🔴 ACESSO NÃO LIBERADO
                            </div>
                            <button
                              onClick={handleSimCheckinClick}
                              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-center"
                            >
                              ✅ SOLICITAR ACESSO (CHECK-IN)
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {simRole === 'owner' && (
                    <div className="space-y-3">
                      {pendingCheckins.length === 0 ? (
                        <div className="text-center text-slate-500 py-12 text-xs">
                          Nenhuma notificação nova para o dono. Faça um check-in no grupo para acionar.
                        </div>
                      ) : (
                        pendingCheckins.map((chk) => (
                          <div
                            key={chk.id}
                            className="max-w-md bg-[#16223b] border border-amber-600/40 rounded-2xl p-4 shadow-lg text-xs space-y-2.5"
                          >
                            <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                              <span>🔔 NOVO CHECK-IN</span>
                            </div>

                            <div className="space-y-1 text-slate-200">
                              <div>
                                👤 <strong>Nome:</strong> {chk.first_name} {chk.last_name || ''}
                              </div>
                              <div>
                                📱 <strong>Username:</strong> @{chk.username || 'Não informado'}
                              </div>
                              <div>
                                🆔 <strong>Telegram ID:</strong>{' '}
                                <code className="text-amber-300">{chk.telegram_id}</code>
                              </div>
                              <div>
                                👥 <strong>Grupo:</strong> {chk.group_title || 'Central VIP'}
                              </div>
                              <div>
                                🕐 <strong>Data/hora:</strong> {formatDateBR(chk.timestamp)}
                              </div>
                              <div>
                                📌 <strong>Status:</strong> Aguardando liberação
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2">
                              <button
                                onClick={() => handleApproveCheckIn(chk, 1)}
                                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold text-center"
                              >
                                (1 DIA)
                              </button>
                              <button
                                onClick={() => handleApproveCheckIn(chk, 7)}
                                className="py-1.5 bg-emerald-700/50 hover:bg-emerald-600 text-emerald-200 rounded font-semibold text-center border border-emerald-500/40"
                              >
                                (7 DIAS)
                              </button>
                              <button
                                onClick={() => handleApproveCheckIn(chk, 15)}
                                className="py-1.5 bg-blue-700/50 hover:bg-blue-600 text-blue-200 rounded font-semibold text-center border border-blue-500/40"
                              >
                                (15 DIAS)
                              </button>
                              <button
                                onClick={() => handleApproveCheckIn(chk, 30)}
                                className="py-1.5 bg-purple-700/50 hover:bg-purple-600 text-purple-200 rounded font-semibold text-center border border-purple-500/40"
                              >
                                (30 DIAS)
                              </button>
                              <button
                                onClick={() => {
                                  const custom = prompt('Quantos dias?', '60');
                                  if (custom) handleApproveCheckIn(chk, parseInt(custom, 10));
                                }}
                                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded font-semibold text-center"
                              >
                                (PERSONALIZAR)
                              </button>
                              <button
                                onClick={() => handleRejectCheckIn(chk)}
                                className="py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded font-semibold text-center border border-rose-800/60"
                              >
                                (❌ RECUSAR)
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="bg-[#121c32] p-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Usuário do teste:</span>
                    <input
                      type="text"
                      value={simUser.name}
                      onChange={(e) => setSimUser({ ...simUser, name: e.target.value })}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 w-28 text-[11px]"
                    />
                    <input
                      type="text"
                      value={simUser.id}
                      onChange={(e) => setSimUser({ ...simUser, id: e.target.value })}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 w-24 text-[11px] font-mono"
                    />
                  </div>

                  <button
                    onClick={handleSimStartCommand}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium"
                  >
                    Executar /start
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Auditoria & Logs de Eventos</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Histórico persistente de todas as ações administrativas, check-ins, expirações e concessões.
                  </p>
                </div>
              </div>

              <div className="bg-[#0e1627] border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#090f1d] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Data / Hora</th>
                      <th className="px-4 py-3">Telegram ID</th>
                      <th className="px-4 py-3">Usuário</th>
                      <th className="px-4 py-3">Ação</th>
                      <th className="px-4 py-3">Detalhes</th>
                      <th className="px-4 py-3">Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {formatDateBR(log.timestamp)}
                        </td>
                        <td className="px-4 py-3 font-mono text-amber-300/90">{log.telegram_id}</td>
                        <td className="px-4 py-3 text-slate-300 font-medium">{log.user_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/40 text-rose-300 border border-rose-800/40">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{log.details}</td>
                        <td className="px-4 py-3 text-slate-500 uppercase text-[10px] font-bold">
                          {log.source}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

  // TAB: BACKUPS & DADOS
          {activeTab === 'backups' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* Header Banner */}
              <div className="rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-rose-950/30 border border-amber-800/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">Rotina de Backup Diário Automático</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        🟢 ROTINA ATIVA (DIÁRIA)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                      Backup estruturado em JSON contendo as tabelas fundamentais: <strong className="text-amber-300">users</strong>, <strong className="text-amber-300">channels</strong> e <strong className="text-amber-300">logs</strong>. O proprietário absoluto (<strong className="text-amber-300 font-mono">6918626496</strong>) pode baixar o arquivo a qualquer momento pelo painel ou pelo Telegram.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    disabled={generatingBackup}
                    onClick={() => handleDownloadBackup()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-all disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Backup Atual (.JSON)</span>
                  </button>

                  <button
                    disabled={generatingBackup}
                    onClick={() => handleGenerateBackup('manual')}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {generatingBackup ? (
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{generatingBackup ? 'Gerando...' : 'Gerar Novo Backup'}</span>
                  </button>
                </div>
              </div>

              {/* Feedback Notice Banner */}
              {backupNotice && (
                <div
                  className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between gap-3 ${
                    backupNotice.success
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/80'
                      : 'bg-rose-950/40 text-rose-300 border-rose-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {backupNotice.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{backupNotice.text}</span>
                  </div>
                  <button
                    onClick={() => setBackupNotice(null)}
                    className="text-slate-400 hover:text-white p-1 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Status & Architecture Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Tabelas Monitoradas</span>
                    <Database className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      users ({stats?.total_users || 0})
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      channels ({stats?.total_channels || 0})
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      logs ({logs.length})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1">
                    Exportação atômica das 3 tabelas solicitadas em arquivo JSON puro.
                  </p>
                </div>

                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Rotina Automática</span>
                    <Clock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold text-white flex items-center gap-1.5 pt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Diária às 00:00</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Executada no servidor em background. Retenção de 30 dias com limpeza automática.
                  </p>
                </div>

                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Último Backup Gerado</span>
                    <HardDrive className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-xs font-mono font-bold text-amber-300 truncate pt-1">
                    {backupStatus?.last_daily_backup?.filename || (backupsList[0]?.filename ?? 'Pendente')}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>{backupStatus?.last_daily_backup?.created_at_formatted || (backupsList[0]?.created_at_formatted ?? 'Hoje')}</span>
                    <span className="font-semibold text-slate-300">{backupStatus?.last_daily_backup?.size_formatted || (backupsList[0]?.size_formatted ?? 'N/A')}</span>
                  </div>
                </div>

                <div className="bg-[#0e1627] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Acesso Proprietário</span>
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-xs font-mono font-bold text-white pt-1">
                    ID: {systemStatus?.owner_id || '6918626496'}
                  </div>
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Download irrestrito & bot /backup
                  </p>
                </div>
              </div>

              {/* History Table Card */}
              <div className="bg-[#0e1627] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <FolderArchive className="w-4 h-4 text-amber-400" />
                      Histórico de Backups Disponíveis ({backupsList.length})
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Arquivos JSON armazenados no diretório do servidor prontos para download imediato.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchBackups}
                      disabled={backupLoading}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${backupLoading ? 'animate-spin' : ''}`} />
                      <span>Atualizar</span>
                    </button>

                    <button
                      onClick={() => handleGenerateBackup('daily_auto')}
                      disabled={generatingBackup}
                      className="px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-xs font-medium flex items-center gap-1.5 transition"
                      title="Simula o disparo da rotina diária automática"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Forçar Rotina Diária</span>
                    </button>
                  </div>
                </div>

                {backupsList.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Database className="w-10 h-10 text-slate-600 mx-auto" />
                    <div className="text-sm font-semibold text-slate-300">Nenhum arquivo de backup gerado ainda</div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      A rotina diária é executada automaticamente às 00:00. Você também pode gerar o primeiro snapshot manualmente agora.
                    </p>
                    <button
                      onClick={() => handleGenerateBackup('manual')}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-md inline-flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Gerar Primeiro Backup</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#090f1d] text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Arquivo JSON</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3">Data / Hora (BR)</th>
                          <th className="px-4 py-3">Tabelas Contidas</th>
                          <th className="px-4 py-3">Tamanho</th>
                          <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {backupsList.map((bk) => (
                          <tr key={bk.id || bk.filename} className="hover:bg-slate-800/30 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="font-mono text-xs text-slate-200 font-semibold">{bk.filename}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {bk.type === 'daily_auto' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <Clock className="w-3 h-3 text-emerald-400" />
                                  DIÁRIO AUTO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  <Zap className="w-3 h-3 text-purple-400" />
                                  MANUAL
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                              {bk.created_at_formatted}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-300">
                                  <strong className="text-white">{bk.users_count}</strong> users
                                </span>
                                <span className="text-slate-600">•</span>
                                <span className="text-[11px] text-slate-300">
                                  <strong className="text-white">{bk.channels_count}</strong> canais
                                </span>
                                <span className="text-slate-600">•</span>
                                <span className="text-[11px] text-slate-300">
                                  <strong className="text-white">{bk.logs_count}</strong> logs
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-400 font-medium text-xs">
                              {bk.size_formatted}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenBackupPreview(bk.filename)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1"
                                  title="Inspecionar conteúdo JSON"
                                >
                                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Visualizar</span>
                                </button>

                                <button
                                  onClick={() => handleDownloadBackup(bk.filename)}
                                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                                  title="Baixar arquivo JSON diretamente"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Baixar</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Technical Specifications Guide */}
              <div className="bg-[#0e1627] border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Garantias de Integridade & Formato de Exportação
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
                  <div className="p-3 bg-[#090f1d] rounded-xl border border-slate-800/80 space-y-1">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      1. Tabela users
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Preserva todos os usuários cadastrados, identificadores únicos do Telegram, status (ativo, pendente, expirado ou bloqueado), dados de primeiro acesso e vínculos de check-in.
                    </p>
                  </div>

                  <div className="p-3 bg-[#090f1d] rounded-xl border border-slate-800/80 space-y-1">
                    <div className="font-bold text-rose-400 flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5" />
                      2. Tabela channels
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Preserva os 15 canais e fontes oficiais (Pluto TV, Plex, Samsung TV Plus, LG Channels, Rakuten, Red Bull TV, TV Brasil, etc.) com suas URLs oficiais exatas, categorias e autorizações.
                    </p>
                  </div>

                  <div className="p-3 bg-[#090f1d] rounded-xl border border-slate-800/80 space-y-1">
                    <div className="font-bold text-purple-400 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      3. Tabela logs
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Trilha de auditoria integral registrando concessões de dias de acesso, aprovações de check-ins, configurações de webhook, alertas de expiração e rotinas de backup com timestamp ISO.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-950/20 border border-amber-800/40 rounded-xl flex items-start gap-3 text-xs text-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-[11px] leading-relaxed">
                    <div className="font-bold text-amber-300">Acesso via Telegram Bot (@BotFather)</div>
                    <div>
                      O proprietário também pode enviar o comando <code className="px-1.5 py-0.5 bg-slate-900 rounded font-mono text-amber-200">/backup</code> no chat privado do bot ou acessar o menu <code className="px-1.5 py-0.5 bg-slate-900 rounded font-mono text-amber-200">/admin</code> &gt; <strong className="text-white">💾 BACKUP DO BANCO</strong> para receber o arquivo JSON instantaneamente como documento.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SETTINGS & DEPLOY GUIDE */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div>
                <h2 className="text-xl font-bold text-white">Configurações & Guia de Deploy</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Gerenciamento do Bot Token oficial do Telegram e instruções passo a passo para hospedar o servidor.
                </p>
              </div>

              {/* Bot Token Config Card */}
              <div className="bg-[#0e1627] border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">Token do Bot Telegram (@BotFather)</h3>
                      <p className="text-xs text-slate-400">
                        Insira ou atualize o token oficial fornecido pelo @BotFather.
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      systemStatus?.bot_configured
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {systemStatus?.bot_configured ? 'TOKEN CONFIGURADO' : 'AGUARDANDO TOKEN'}
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Ex: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    value={botTokenInput}
                    onChange={(e) => setBotTokenInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#090f1d] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    O token é protegido no servidor e nunca é exposto aos clientes web.
                  </p>
                </div>

                {tokenStatusMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium border ${
                      tokenStatusMsg.success
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                        : 'bg-rose-950/40 text-rose-300 border-rose-800'
                    }`}
                  >
                    {tokenStatusMsg.text}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    disabled={isUpdatingToken}
                    onClick={() => handleConfigureBot('polling')}
                    className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-semibold shadow-md disabled:opacity-50"
                  >
                    {isUpdatingToken ? 'Conectando...' : 'Salvar Token & Iniciar Polling'}
                  </button>

                  {systemStatus?.bot_running && (
                    <button
                      onClick={() => handleConfigureBot('stop')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                    >
                      Pausar Bot
                    </button>
                  )}
                </div>
              </div>

              {/* Webhook Configuration Section */}
              <div className="bg-[#0e1627] border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Webhook className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-white">Configuração de Webhook (Tempo Real)</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/30 text-rose-300 border border-rose-500/30">
                          PRODUÇÃO
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Receba atualizações instantâneas do Telegram diretamente via HTTP POST, sem latência de polling contínuo.
                      </p>
                    </div>
                  </div>

                  <div>
                    {systemStatus?.webhook_mode ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        WEBHOOK ATIVO (TEMPO REAL)
                      </span>
                    ) : systemStatus?.bot_running ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        LONG POLLING ATIVO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                        BOT INATIVO
                      </span>
                    )}
                  </div>
                </div>

                {/* Webhook URL Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-amber-400" />
                      URL Pública do Webhook (Endpoint HTTPS)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultUrl = `${window.location.origin}/api/telegram-webhook`;
                        setWebhookUrlInput(defaultUrl);
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
                    >
                      Usar URL atual deste servidor
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="url"
                        placeholder="https://seu-dominio.com/api/telegram-webhook"
                        value={webhookUrlInput}
                        onChange={(e) => setWebhookUrlInput(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#090f1d] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyWebhookUrl}
                      title="Copiar URL do Webhook"
                      className="px-3 py-2.5 bg-[#090f1d] border border-slate-700 hover:border-slate-600 rounded-xl text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs"
                    >
                      {copiedWebhook ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    O endpoint de recepção do sistema é fixo em{' '}
                    <code className="px-1.5 py-0.5 bg-slate-900 text-amber-300 rounded font-mono">
                      /api/telegram-webhook
                    </code>
                    . O Telegram exige obrigatoriamente protocolo <strong className="text-slate-200">HTTPS</strong> com certificado válido.
                  </p>
                </div>

                {/* Secret Token Input */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                    Token Secreto de Validação (Opcional - Segurança Adicional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: segredo_super_seguro_central_tv"
                    value={webhookSecretInput}
                    onChange={(e) => setWebhookSecretInput(e.target.value)}
                    className="w-full px-4 py-2 bg-[#090f1d] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Quando configurado, o Telegram envia o cabeçalho <code className="text-slate-400">X-Telegram-Bot-Api-Secret-Token</code> em todas as requisições para blindar contra acessos não autorizados.
                  </p>
                </div>

                {/* Webhook Feedback Message */}
                {webhookStatusMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                      webhookStatusMsg.success
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                        : 'bg-rose-950/40 text-rose-300 border-rose-800'
                    }`}
                  >
                    {webhookStatusMsg.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{webhookStatusMsg.text}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-800/80">
                  <button
                    disabled={webhookLoading}
                    onClick={handleSetWebhook}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-amber-950/40 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    {webhookLoading ? 'Configurando...' : 'Ativar Webhook em Tempo Real'}
                  </button>

                  <button
                    disabled={webhookLoading}
                    onClick={fetchWebhookInfo}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Activity className="w-4 h-4 text-amber-400" />
                    Consultar Status no Telegram API
                  </button>

                  {systemStatus?.webhook_mode && (
                    <button
                      disabled={webhookLoading}
                      onClick={handleDeleteWebhook}
                      className="px-3.5 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Desativar Webhook (Voltar ao Polling)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleTestWebhookPing}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs font-medium ml-auto"
                  >
                    Testar Rota Local
                  </button>
                </div>

                {/* Live Webhook Info & Diagnostic Panel */}
                {webhookInfo && (
                  <div className="bg-[#090f1d] border border-slate-800 rounded-xl p-4 space-y-3 mt-3">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        Diagnóstico em Tempo Real (Telegram API)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Última checagem: {new Date().toLocaleTimeString()}
                      </span>
                    </div>

                    {webhookInfo.error ? (
                      <div className="text-xs text-rose-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{webhookInfo.error}</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 bg-slate-900/70 rounded-lg border border-slate-800 space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            URL Ativa no Telegram:
                          </span>
                          <div className="font-mono text-amber-300 text-[11px] truncate">
                            {webhookInfo.info?.url ? webhookInfo.info.url : '(Nenhuma - Operando em Long Polling)'}
                          </div>
                        </div>

                        <div className="p-2.5 bg-slate-900/70 rounded-lg border border-slate-800 space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            Atualizações Pendentes no Telegram:
                          </span>
                          <div className="font-semibold text-white">
                            {webhookInfo.info?.pending_update_count ?? 0} updates na fila
                          </div>
                        </div>

                        <div className="p-2.5 bg-slate-900/70 rounded-lg border border-slate-800 space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            IP Detectado pelo Telegram:
                          </span>
                          <div className="font-mono text-slate-300">
                            {webhookInfo.info?.ip_address || 'Padrão / Não reportado'}
                          </div>
                        </div>

                        <div className="p-2.5 bg-slate-900/70 rounded-lg border border-slate-800 space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            Certificado Customizado:
                          </span>
                          <div className="text-slate-300">
                            {webhookInfo.info?.has_custom_certificate ? 'Sim' : 'Não (SSL/TLS Público Padrão)'}
                          </div>
                        </div>

                        {webhookInfo.info?.last_error_message && (
                          <div className="col-span-full p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg text-rose-300 space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-xs text-rose-200">
                              <AlertTriangle className="w-4 h-4 text-rose-400" />
                              Último Erro Reportado pelo Telegram:
                            </div>
                            <div className="text-xs font-mono">{webhookInfo.info.last_error_message}</div>
                            {webhookInfo.info.last_error_date && (
                              <div className="text-[10px] text-rose-400">
                                Data do erro: {new Date(webhookInfo.info.last_error_date * 1000).toLocaleString('pt-BR')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Webhook Guidelines Box */}
                <div className="p-3.5 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2 text-xs text-amber-200/90">
                  <div className="font-bold text-amber-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Requisitos e Benefícios do Modo Webhook
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px] leading-relaxed">
                    <li>
                      <strong>Latência Zero:</strong> Cada mensagem, check-in ou comando enviado no Telegram é disparado imediatamente para o seu servidor.
                    </li>
                    <li>
                      <strong>Eficiência de Recursos:</strong> Não consome conexões permanentes abertas, ideal para hospedagens em nuvem (Cloud Run, VPS, Docker, Render).
                    </li>
                    <li>
                      <strong>HTTPS Obrigatório:</strong> O Telegram só aceita URLs seguras com certificado SSL/TLS válido (porta 443, 80, 88 ou 8443).
                    </li>
                    <li>
                      <strong>Ambiente Local/Testes:</strong> Em testes locais sem IP público, você pode utilizar um túnel HTTPS como Cloudflare Tunnel ou ngrok (<code className="text-amber-300">ngrok http 3000</code>).
                    </li>
                  </ul>
                </div>
              </div>

              {/* Step-by-Step Server Setup Guide */}
              <div className="bg-[#0e1627] border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  Instruções para Hospedagem em Servidor (VPS / Docker / Cloud)
                </h3>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="p-3 bg-[#090f1d] rounded-xl border border-slate-800/80">
                    <div className="font-bold text-rose-400 mb-1">1. Obter Token no @BotFather</div>
                    Envie <code className="text-amber-300">/newbot</code> para o BotFather no Telegram. Escolha o nome e o username terminado em <code className="text-amber-300">_bot</code>.
                  </div>

                  <div className="p-3 bg-[#090f1d] rounded-xl border border-slate-800/80">
                    <div className="font-bold text-rose-400 mb-1">2. Configurar o Arquivo .env</div>
                    Defina <code className="text-amber-300">TELEGRAM_BOT_TOKEN</code> e garanta que <code className="text-amber-300">OWNER_ID=6918626496</code>.
                  </div>

                  <div className="p-3 bg-[#090f1d] rounded-xl border border-slate-800/80">
                    <div className="font-bold text-rose-400 mb-1">3. Adicionar o Bot ao Grupo & Fixar Mensagem</div>
                    Adicione o bot como administrador do seu grupo do Telegram. No grupo, digite <code className="text-amber-300">/checkin</code> e fixe a mensagem com o botão <strong className="text-emerald-400">✅ FAZER CHECK-IN</strong>.
                  </div>

                  <div className="p-3 bg-[#090f1d] rounded-xl border border-slate-800/80">
                    <div className="font-bold text-rose-400 mb-1">4. Limitação de Chat Privado do Telegram</div>
                    Lembre-se: O Telegram impede que bots enviem mensagens a usuários que nunca clicaram em <strong className="text-amber-300">Iniciar</strong> no privado do bot. Oriente seus membros a iniciarem o bot pelo menos uma vez.
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Confirmation Modal */}
      {confirmDialog && confirmDialog.open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1627] border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white">{confirmDialog.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-950/50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Channel Modal */}
      {addChannelModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0e1627] border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">Cadastrar Novo Canal Oficial</h3>
              <button
                onClick={() => setAddChannelModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome do Canal *</label>
                <input
                  type="text"
                  required
                  value={newChannel.name}
                  onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                  placeholder="Ex: TV Brasil Play"
                  className="w-full px-3 py-2 bg-[#090f1d] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Descrição Curta *</label>
                <textarea
                  rows={2}
                  required
                  value={newChannel.description}
                  onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                  placeholder="Descrição institucional oficial do canal..."
                  className="w-full px-3 py-2 bg-[#090f1d] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Categoria *</label>
                  <select
                    required
                    value={newChannel.category_id}
                    onChange={(e) => setNewChannel({ ...newChannel, category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#090f1d] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tipo de Conteúdo</label>
                  <select
                    value={newChannel.content_type}
                    onChange={(e: any) => setNewChannel({ ...newChannel, content_type: e.target.value })}
                    className="w-full px-3 py-2 bg-[#090f1d] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="live">TV ao Vivo Oficial</option>
                    <option value="vod">Streaming / VOD</option>
                    <option value="news">Notícias Institucionais</option>
                    <option value="culture">Cultural / Educativo</option>
                    <option value="sports">Esportes Autorizados</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Link Oficial Autorizado (HTTPS) *
                </label>
                <input
                  type="url"
                  required
                  value={newChannel.official_url}
                  onChange={(e) => setNewChannel({ ...newChannel, official_url: e.target.value })}
                  placeholder="https://pluto.tv/ ou https://tvbrasil.ebc.com.br/"
                  className="w-full px-3 py-2 bg-[#090f1d] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500 font-mono"
                />
                <span className="text-[11px] text-amber-400 mt-1 block">
                  🛡️ Proibido encurtadores, listas M3U ou links não autorizados.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Fonte Oficial / Entidade *</label>
                  <input
                    type="text"
                    required
                    value={newChannel.official_source}
                    onChange={(e) => setNewChannel({ ...newChannel, official_source: e.target.value })}
                    placeholder="Ex: Empresa Brasil de Comunicação"
                    className="w-full px-3 py-2 bg-[#090f1d] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Regiões Disponíveis</label>
                  <input
                    type="text"
                    value={newChannel.available_regions}
                    onChange={(e) => setNewChannel({ ...newChannel, available_regions: e.target.value })}
                    placeholder="BR, Global"
                    className="w-full px-3 py-2 bg-[#090f1d] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="admin_auth_check"
                    checked={newChannel.admin_authorized}
                    onChange={(e) =>
                      setNewChannel({
                        ...newChannel,
                        admin_authorized: e.target.checked,
                        status: e.target.checked ? 'active' : 'inactive',
                      })
                    }
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <label htmlFor="admin_auth_check" className="font-semibold text-slate-200 cursor-pointer">
                    Confirmo que verifiquei a gratuidade e autorização oficial do link
                  </label>
                </div>
                <p className="text-[11px] text-slate-400">
                  Canais não confirmados são salvos como desativados e não aparecem aos usuários até validação.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddChannelModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  Salvar Canal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grant Access Modal */}
      {grantModal && grantModal.open && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1627] border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white">Liberar Acesso</h3>
            <p className="text-xs text-slate-300">
              Usuário: <strong>{grantModal.user?.first_name}</strong> (ID: {grantModal.user?.id})
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Selecione a Duração:</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 7, 15, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setGrantDays(d)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      grantDays === d
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {d} {d === 1 ? 'Dia' : 'Dias'}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <label className="block text-xs text-slate-400 mb-1">Ou digite quantidade de dias:</label>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={grantDays}
                  onChange={(e) => setGrantDays(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-[#090f1d] border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setGrantModal(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await fetch(`/api/users/${grantModal.user.id}/grant`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      days: grantDays,
                      adminId: '6918626496',
                      adminName: 'Proprietário Absoluto',
                    }),
                  });
                  setGrantModal(null);
                  fetchData();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
              >
                Confirmar Liberação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User History Modal */}
      {userHistoryModal && selectedUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1627] border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">
                  Histórico de Acesso: {selectedUser.user?.first_name}
                </h3>
                <span className="text-xs text-amber-300 font-mono">ID: {selectedUser.user?.id}</span>
              </div>
              <button
                onClick={() => setUserHistoryModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
              {selectedUser.history?.length === 0 ? (
                <div className="text-slate-500 text-center py-6">Nenhum acesso anterior registrado.</div>
              ) : (
                selectedUser.history?.map((h: any) => (
                  <div key={h.id} className="p-3 bg-[#090f1d] border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{h.duration_days} Dias</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          h.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {h.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Início: {formatDateBR(h.start_date)} • Fim: {formatDateBR(h.expiration_date)}
                    </div>
                    <div className="text-[10px] text-slate-500">Concedido por: {h.granted_by_name}</div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setUserHistoryModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup JSON Preview Modal */}
      {previewBackupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1627] border border-slate-700 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Inspeção do Arquivo de Backup: {previewBackupModal.filename}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Tabelas: users, channels, logs • Formato: JSON UTF-8
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewBackupModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs bg-[#090f1d] p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-4 text-slate-300">
                <span>
                  Usuários: <strong className="text-white">{previewBackupModal.payload?.stats?.users_count ?? previewBackupModal.payload?.tables?.users?.length ?? 0}</strong>
                </span>
                <span>
                  Canais: <strong className="text-white">{previewBackupModal.payload?.stats?.channels_count ?? previewBackupModal.payload?.tables?.channels?.length ?? 0}</strong>
                </span>
                <span>
                  Logs: <strong className="text-white">{previewBackupModal.payload?.stats?.logs_count ?? previewBackupModal.payload?.tables?.logs?.length ?? 0}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(previewBackupModal.payload, null, 2));
                    setCopiedBackupJson(true);
                    setTimeout(() => setCopiedBackupJson(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  {copiedBackupJson ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar JSON</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDownloadBackup(previewBackupModal.filename)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Arquivo</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-[#070b14] p-4">
              <pre className="font-mono text-[11px] text-amber-200/90 whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(previewBackupModal.payload, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setPreviewBackupModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
