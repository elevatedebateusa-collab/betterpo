import { SelectionGroup } from '@/components/ui/selection-group';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Shield, 
  Lock, 
  Activity, 
  Users, 
  Mic, 
  DoorOpen, 
  Download, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  ArrowUpRight, 
  BarChart3, 
  LogOut,
  AlertCircle
} from 'lucide-react';
import { 
  supabase, 
  isSupabaseConfigured, 
  getStoredRooms, 
  getStoredReps, 
  getStoredEvents 
} from '../lib/supabase';
import type { Room, Representative, RoundEvent, PlatformMetrics } from '../lib/supabase';
import { chamberService } from '../lib/chamberService';

interface ChamberRowMetric {
  room: Room;
  debaterCount: number;
  speechCount: number;
  questionCount: number;
  lastActive: string;
}

export const AdminMetricsView: React.FC = () => {
  // -------------------------------------------------------------
  // Authentication State
  // -------------------------------------------------------------
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('elevate_admin_authorized') === 'true';
  });
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Platform Telemetry Data
  // -------------------------------------------------------------
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [roundEvents, setRoundEvents] = useState<RoundEvent[]>([]);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetrics | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_session' | 'recess' | 'adjourned'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Master Passcode Resolution
  const expectedPasscode = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_PASSCODE) || 'elevate-admin-2026';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (passcodeInput.trim() === expectedPasscode.trim()) {
      sessionStorage.setItem('elevate_admin_authorized', 'true');
      setIsAuthenticated(true);
    } else {
      setAuthError('Access denied: Invalid administrative passcode.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('elevate_admin_authorized');
    setIsAuthenticated(false);
    setPasscodeInput('');
  };

  // -------------------------------------------------------------
  // Data Fetching Query Engine
  // -------------------------------------------------------------
  const fetchMetricsData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);

    try {
      if (isSupabaseConfigured && supabase) {
        // Fetch Platform-Wide Rooms
        const { data: fetchedRooms, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .order('created_at', { ascending: false });

        if (roomsError) throw roomsError;

        // Fetch All Representatives
        const { data: fetchedReps, error: repsError } = await supabase
          .from('representatives')
          .select('*');

        if (repsError) throw repsError;

        // Fetch Round Events (Speeches, Questions, Votes)
        const { data: fetchedEvents, error: eventsError } = await supabase
          .from('round_events')
          .select('*')
          .order('created_at', { ascending: false });

        if (eventsError) throw eventsError;

        setRooms((fetchedRooms || []) as Room[]);
        setRepresentatives((fetchedReps || []) as Representative[]);
        setRoundEvents((fetchedEvents || []) as RoundEvent[]);

        // Fetch Lifetime Platform Metrics
        const pMetrics = await chamberService.getPlatformMetrics();
        setPlatformMetrics(pMetrics);
      } else {
        // Zero-Config Local / Broadcast Mode Fallback
        const localRooms = getStoredRooms();
        const localReps = getStoredReps();
        const localEvents = getStoredEvents();

        setRooms(localRooms);
        setRepresentatives(localReps);
        setRoundEvents(localEvents);

        const pMetrics = await chamberService.getPlatformMetrics();
        setPlatformMetrics(pMetrics);
      }
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('[AdminMetricsView] Failed to compute telemetry queries:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMetricsData();

      // Poll every 15 seconds to stream live session updates
      const interval = setInterval(() => {
        fetchMetricsData(true);
      }, 15000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchMetricsData]);

  // -------------------------------------------------------------
  // Aggregate Metrics Calculations
  // -------------------------------------------------------------
  const now = useMemo(() => new Date().getTime(), [lastRefreshedAt]);

  const activeRoomsNow = useMemo(() => {
    return rooms.filter((r) => r.status === 'in_session');
  }, [rooms]);

  const rooms24h = useMemo(() => {
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    return rooms.filter((r) => new Date(r.created_at).getTime() >= oneDayAgo).length;
  }, [rooms, now]);

  const rooms7d = useMemo(() => {
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    return rooms.filter((r) => new Date(r.created_at).getTime() >= sevenDaysAgo).length;
  }, [rooms, now]);

  const allTimeRooms = useMemo(() => {
    return Math.max(rooms.length, platformMetrics?.total_rooms_all_time ?? 0);
  }, [rooms, platformMetrics]);

  const allTimeDebaters = useMemo(() => {
    return Math.max(representatives.length, platformMetrics?.total_debaters_all_time ?? 0);
  }, [representatives, platformMetrics]);

  const totalSpeechesLogged = useMemo(() => {
    const count = roundEvents.filter((e) => 
      e.event_type.startsWith('speech_') ||
      ['speech_aff', 'speech_neg', 'speech_author', 'speech_sponsor'].includes(e.event_type)
    ).length;
    return Math.max(count, platformMetrics?.total_speeches_all_time ?? 0);
  }, [roundEvents, platformMetrics]);

  const totalQuestionsLogged = useMemo(() => {
    return roundEvents.filter((e) => e.event_type === 'question').length;
  }, [roundEvents]);

  // Peak Concurrent Presence: Active present debaters inside in_session rooms
  const peakConcurrentPresence = useMemo(() => {
    const activeRoomIds = new Set(activeRoomsNow.map((r) => r.id));
    const activeReps = representatives.filter(
      (rep) => activeRoomIds.has(rep.room_id) && (rep.is_present ?? true)
    );
    // Add estimated 1 PO and 1 Scorer per active chamber
    return activeReps.length + activeRoomsNow.length * 2;
  }, [activeRoomsNow, representatives]);

  // Aggregate stats per room
  const chamberMetricsList = useMemo<ChamberRowMetric[]>(() => {
    return rooms.map((room) => {
      const roomReps = representatives.filter((r) => r.room_id === room.id);
      const roomEvents = roundEvents.filter((e) => e.room_id === room.id);
      const speeches = roomEvents.filter((e) => e.event_type.startsWith('speech_')).length;
      const questions = roomEvents.filter((e) => e.event_type === 'question').length;

      const latestEventTime = roomEvents.length > 0 ? roomEvents[0].created_at : room.created_at;

      return {
        room,
        debaterCount: roomReps.length,
        speechCount: speeches,
        questionCount: questions,
        lastActive: latestEventTime
      };
    });
  }, [rooms, representatives, roundEvents]);

  // Filtered rows for data table
  const filteredChambers = useMemo(() => {
    return chamberMetricsList.filter(({ room }) => {
      const matchesQuery = 
        room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.code.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [chamberMetricsList, searchQuery, statusFilter]);

  // -------------------------------------------------------------
  // CSV Export Utility
  // -------------------------------------------------------------
  const handleExportCSV = () => {
    const headers = [
      'Room ID',
      'Chamber Name',
      'Room Code',
      'PO Passcode',
      'Status',
      'Total Debaters',
      'Total Speeches',
      'Total Questions',
      'Active Legislation',
      'Created At',
      'Last Active'
    ];

    const rows = chamberMetricsList.map(({ room, debaterCount, speechCount, questionCount, lastActive }) => [
      `"${room.id}"`,
      `"${(room.name || '').replace(/"/g, '""')}"`,
      `"${room.code}"`,
      `"${room.po_passcode}"`,
      `"${room.status}"`,
      debaterCount,
      speechCount,
      questionCount,
      `"${(room.current_legislation || '').replace(/"/g, '""')}"`,
      `"${room.created_at}"`,
      `"${lastActive}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `elevate_chamber_admin_metrics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // -------------------------------------------------------------
  // Minimalist Login Gate
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070809] text-white flex flex-col items-center justify-center p-4 selection:bg-white/20 font-sans">
        <div className="w-full max-w-sm bg-[#0D0F12] border border-white/[0.08] rounded-2xl p-7 sm:p-8 shadow-2xl relative overflow-hidden">
          
          {/* Subtle Top Glow Accent */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-emerald-400 shadow-inner">
              <Shield className="w-6 h-6 stroke-[1.75]" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono tracking-widest uppercase text-neutral-400">
                <Lock className="w-3 h-3 text-emerald-400" />
                Administrative Gate
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white pt-1">
                Elevate Chamber Telemetry
              </h1>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Enter master administrative credentials to access platform usage and analytics.
              </p>
            </div>

            {authError && (
              <div className="w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="w-full space-y-3.5 pt-2">
              <div className="relative text-left">
                <label className="block text-[11px] font-mono font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">
                  Admin Passcode
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder="Enter master passcode..."
                  className="w-full bg-[#13161B] border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-neutral-600 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
              >
                <span>Authorize & View Metrics</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </form>

            <div className="pt-2 text-[11px] text-neutral-500 font-mono">
              Protected Endpoint • Elevate Chamber v2.4.0
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Authenticated Admin Dashboard (Linear / Swiss Dark Aesthetic)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#070809] text-white flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200 font-sans">
      
      {/* Top Telemetry Header */}
      <header className="sticky top-0 z-40 bg-[#070809]/85 backdrop-blur-md border-b border-white/[0.08] px-6 md:px-10 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* Identity & Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold tracking-tight text-white">
                    Elevate Chamber
                  </span>
                  <span className="text-neutral-500 font-mono text-xs">/</span>
                  <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
                    Administrative Telemetry
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE CLUSTER ONLINE</span>
            </div>
          </div>

          {/* Quick Actions & Controls */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto text-xs font-mono">
            <button
              onClick={() => fetchMetricsData(false)}
              disabled={refreshing}
              title="Refresh telemetry queries"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-neutral-300 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 font-bold transition-all shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Metrics CSV</span>
            </button>

            <div className="h-4 w-[1px] bg-white/[0.1] mx-1" />

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/10 border border-white/[0.08] hover:border-rose-500/30 text-neutral-400 hover:text-rose-300 transition-colors"
              title="End admin session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock Console</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-6 md:px-10 py-8 space-y-8 flex-1">
        
        {/* Section Title & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/[0.06] pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              System Telemetry & Platform Utilization
            </h1>
            <p className="text-xs text-neutral-400 font-mono mt-1">
              Real-time aggregation across {isSupabaseConfigured ? 'Supabase Cluster' : 'Local Sandbox Mode'} • Last synchronized at {lastRefreshedAt.toLocaleTimeString()}
            </p>
          </div>

          <div className="text-[11px] font-mono text-neutral-500">
            {rooms.length} Total Chambers Indexed
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* 1. Metric Cards Bento Grid (4 Columns)                    */}
        {/* --------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Bento Card 1: Active Chambers Now */}
          <div className="bg-[#0D0F12] border border-white/[0.08] rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm group hover:border-white/[0.15] transition-colors">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <DoorOpen className="w-4 h-4 text-emerald-400" />
                Active Chambers
              </span>
              <span className="px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                LIVE
              </span>
            </div>

            <div className="space-y-1">
              <div className="font-mono tabular-nums text-4xl font-extrabold text-white tracking-tight">
                {loading ? '—' : activeRoomsNow.length}
              </div>
              <div className="text-xs text-neutral-400 font-mono">
                Currently <strong className="text-white">in session</strong> on floor
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>Past 24h: <strong className="text-neutral-300">+{rooms24h}</strong></span>
              <span>Past 7d: <strong className="text-neutral-300">+{rooms7d}</strong></span>
            </div>
          </div>

          {/* Bento Card 2: Peak Concurrent Presence */}
          <div className="bg-[#0D0F12] border border-white/[0.08] rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm group hover:border-white/[0.15] transition-colors">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-400" />
                Live Floor Presence
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                CONCURRENT
              </span>
            </div>

            <div className="space-y-1">
              <div className="font-mono tabular-nums text-4xl font-extrabold text-white tracking-tight">
                {loading ? '—' : peakConcurrentPresence}
              </div>
              <div className="text-xs text-neutral-400 font-mono">
                Active senators, POs & scorers
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>Total Roster:</span>
              <span className="text-neutral-300 font-bold">{representatives.length} debaters</span>
            </div>
          </div>

          {/* Bento Card 3: Total Speeches Logged */}
          <div className="bg-[#0D0F12] border border-white/[0.08] rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm group hover:border-white/[0.15] transition-colors">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-amber-400" />
                Speeches Delivered
              </span>
              <span className="text-[10px] text-amber-400/80 font-mono">
                AFF / NEG
              </span>
            </div>

            <div className="space-y-1">
              <div className="font-mono tabular-nums text-4xl font-extrabold text-white tracking-tight">
                {loading ? '—' : totalSpeechesLogged}
              </div>
              <div className="text-xs text-neutral-400 font-mono">
                Official round floor addresses
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>Questions queued:</span>
              <span className="text-neutral-300 font-bold">{totalQuestionsLogged} CX questions</span>
            </div>
          </div>

          {/* Bento Card 4: Historical Velocity & Events */}
          <div className="bg-[#0D0F12] border border-white/[0.08] rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm group hover:border-white/[0.15] transition-colors">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-violet-400" />
                Audit Log Entries
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                ALL-TIME
              </span>
            </div>

            <div className="space-y-1">
              <div className="font-mono tabular-nums text-4xl font-extrabold text-white tracking-tight">
                {loading ? '—' : roundEvents.length}
              </div>
              <div className="text-xs text-neutral-400 font-mono">
                Immutable parliamentary events
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>All-time chambers:</span>
              <span className="text-neutral-300 font-bold">{allTimeRooms} created</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>All-time debaters:</span>
              <span className="text-neutral-300 font-bold">{allTimeDebaters} debaters</span>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* 2. High-Density Usage Breakdown Table                     */}
        {/* --------------------------------------------------------- */}
        <div className="bg-[#0D0F12] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl space-y-4 p-5 sm:p-6">
          
          {/* Table Controls Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
            
            {/* Filter Pills */}
            <SelectionGroup
              aria-label="Chamber status filter" value={statusFilter} onValueChange={setStatusFilter}
              className="selection-group--dark" itemClassName="capitalize"
              options={(['all', 'in_session', 'recess', 'adjourned'] as const).map(status => ({ value: status, label: status === 'in_session' ? 'Live Session' : status }))}
            />

            {/* Search Box */}
            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chamber name or code..."
                className="w-full bg-[#13161B] border border-white/[0.08] focus:border-white/[0.2] rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-400">
                  <th className="py-3 px-3">Chamber & Tournament</th>
                  <th className="py-3 px-3">Room Code</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Debaters</th>
                  <th className="py-3 px-3 text-center">Speeches</th>
                  <th className="py-3 px-3 text-center">Questions</th>
                  <th className="py-3 px-3">Created</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-500">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>Querying platform telemetry metrics...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredChambers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-500">
                      No chambers found matching the active query criteria.
                    </td>
                  </tr>
                ) : (
                  filteredChambers.map(({ room, debaterCount, speechCount, questionCount }) => {
                    const isLive = room.status === 'in_session';
                    const isRecess = room.status === 'recess';

                    return (
                      <tr 
                        key={room.id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        {/* Chamber Name */}
                        <td className="py-3.5 px-3">
                          <div className="font-sans font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                            {room.name || 'Untitled Chamber'}
                          </div>
                          {room.current_legislation && (
                            <div className="text-[11px] text-neutral-400 font-mono truncate max-w-xs mt-0.5">
                              Bill: {room.current_legislation}
                            </div>
                          )}
                        </td>

                        {/* Room Code */}
                        <td className="py-3.5 px-3">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-extrabold text-emerald-400 tracking-wider">
                              {room.code}
                            </span>
                            <button
                              onClick={() => handleCopyCode(room.code)}
                              className="text-neutral-500 hover:text-white transition-colors"
                              title="Copy Room Code"
                            >
                              {copiedCode === room.code ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Status Pill */}
                        <td className="py-3.5 px-3">
                          {isLive ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              LIVE
                            </span>
                          ) : isRecess ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold tracking-wider">
                              RECESS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-white/[0.05] text-neutral-400 border border-white/[0.1] text-[10px] font-bold tracking-wider">
                              ADJOURNED
                            </span>
                          )}
                        </td>

                        {/* Debaters */}
                        <td className="py-3.5 px-3 text-center text-neutral-300 font-semibold tabular-nums">
                          {debaterCount}
                        </td>

                        {/* Speeches */}
                        <td className="py-3.5 px-3 text-center tabular-nums">
                          <span className={speechCount > 0 ? 'text-amber-400 font-bold' : 'text-neutral-500'}>
                            {speechCount}
                          </span>
                        </td>

                        {/* Questions */}
                        <td className="py-3.5 px-3 text-center tabular-nums text-neutral-400">
                          {questionCount}
                        </td>

                        {/* Created At */}
                        <td className="py-3.5 px-3 text-neutral-400 text-[11px] whitespace-nowrap">
                          {new Date(room.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/room/${room.code}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-neutral-300 hover:text-white transition-colors"
                              title="Inspect Live Spectator Screen"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`/room/${room.code}/po#${room.po_passcode}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 transition-colors"
                              title="Open PO Controller directly with saved passcode"
                            >
                              <span>PO Console</span>
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-neutral-500">
            <div>
              Showing {filteredChambers.length} of {rooms.length} recorded chambers
            </div>
            <div className="flex items-center gap-3">
              <span>● Supabase Storage Sync</span>
              <span>● Realtime Events</span>
            </div>
          </div>
        </div>
      </main>

      {/* Obsidian Footer */}
      <footer className="border-t border-white/[0.08] py-4 px-6 md:px-10 text-center font-mono text-xs text-neutral-500">
        Elevate Chamber Administrative Intelligence • Restricted Operator View
      </footer>
    </div>
  );
};
