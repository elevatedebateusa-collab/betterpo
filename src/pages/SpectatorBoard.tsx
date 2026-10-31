import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Gavel, 
  Share2, 
  Lock, 
  FileText, 
  AlertCircle, 
  Clock,
  Coffee,
  ArrowLeftRight,
  Users,
  FileEdit,
  Award,
  MessageSquare,
  Search,
  Star,
  UserCheck,
  Mic,
  ChevronUp,
  ChevronDown,
  History,
  CheckCircle2
} from 'lucide-react';
import { chamberService } from '../lib/chamberService';
import { 
  subscribeToLocalSync,
  calculateCurrentTimer
} from '../lib/supabase';
import type { 
  Room, 
  Representative, 
  Bill, 
  RoundEvent, 
  TimerBroadcastPayload 
} from '../lib/supabase';
import { sortRepresentatives } from '../lib/precedence';
import { BetterPOLoader } from '../components/BetterPOLoader';

export const SpectatorBoard: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  // Core Realtime Chamber State
  const [room, setRoom] = useState<Room | null>(null);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [roundEvents, setRoundEvents] = useState<RoundEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Recency Ladder State
  const [ladderMode, setLadderMode] = useState<'speech' | 'question'>('speech');
  const [searchFilter, setSearchFilter] = useState<string>('');
  
  // "Claim Your Name" Personal Tracking State
  const [claimedSenatorId, setClaimedSenatorId] = useState<string | null>(null);
  const [showClaimModal, setShowClaimModal] = useState<boolean>(false);

  // Chamber Audit Ledger Drawer State
  const [isLedgerOpen, setIsLedgerOpen] = useState<boolean>(false);
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Synchronized Timer State (Listening to PO broadcast)
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(190);
  const [timerDuration, setTimerDuration] = useState<number>(190);
  const [timerIsRunning, setTimerIsRunning] = useState<boolean>(false);
  const [timerMode, setTimerMode] = useState<'speech' | 'dq' | 'question' | 'recess' | 'custom'>('speech');
  const [timerSpeakerName, setTimerSpeakerName] = useState<string | null>(null);

  // Copied link toast indicator
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // 1. Core Fetch & Refresh Helper
  const refreshData = useCallback(async (isInitial = false) => {
    if (!code) return;
    try {
      if (isInitial) setLoading(true);
      const roomData = await chamberService.getRoomByCode(code);
      if (!roomData) {
        if (isInitial) setError(`Chamber "${code}" was not found.`);
        return;
      }
      setRoom(roomData);

      // Compute local timer countdown from timer_updated_at snapshot
      const timer = calculateCurrentTimer(roomData);
      setTimerSecondsLeft(timer.secondsLeft);
      setTimerDuration(timer.duration);
      setTimerIsRunning(timer.isRunning);
      setTimerMode(timer.mode);

      const [reps, roomBills, events] = await Promise.all([
        chamberService.getRepresentatives(roomData.id),
        chamberService.getBills(roomData.id),
        chamberService.getRoundEvents(roomData.id, 60),
      ]);

      setRepresentatives(reps);
      setBills(roomBills);
      setRoundEvents(events);

      if (isInitial) {
        const savedClaim = localStorage.getItem(`elevate_claimed_senator_${roomData.code}`);
        if (savedClaim) {
          setClaimedSenatorId(savedClaim);
        }
      }
    } catch (err: unknown) {
      if (isInitial) {
        setError(err instanceof Error ? err.message : 'Error loading spectator board');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [code]);

  // 2. Visibility-Aware Smart Polling (Bypass the 200 WebSocket Connection Cap)
  useEffect(() => {
    refreshData(true);

    // Poll every 4000ms ONLY when the phone screen / browser tab is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshData(false);
      }
    }, 4000);

    // Immediate fetch when user wakes their phone screen or focuses window
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Local sync fallback for offline/local multi-tab test sessions
    const cleanupLocal = subscribeToLocalSync(async (msg) => {
      if (
        msg.type === 'REPS_UPDATE' || 
        msg.type === 'BILLS_UPDATE' || 
        msg.type === 'EVENTS_UPDATE' || 
        msg.type === 'ROOMS_UPDATE'
      ) {
        refreshData(false);
      } else if (msg.type === 'TIMER_BROADCAST') {
        const data = msg.data as TimerBroadcastPayload;
        if (data && data.room_code === code) {
          setTimerSecondsLeft(data.seconds_left);
          setTimerDuration(data.duration);
          setTimerIsRunning(data.is_running);
          setTimerMode(data.mode);
          setTimerSpeakerName(data.speaker_name);
        }
      }
    });

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      cleanupLocal();
    };
  }, [code, refreshData]);

  // Local 1-second countdown ticking smoothly between 4s poll fetches
  useEffect(() => {
    if (!timerIsRunning) return;
    const tick = setInterval(() => {
      setTimerSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(tick);
  }, [timerIsRunning]);

  // Handle claiming a senator identity
  const handleClaimSenator = (id: string | null) => {
    if (!room) return;
    if (id) {
      localStorage.setItem(`elevate_claimed_senator_${room.code}`, id);
      setClaimedSenatorId(id);
    } else {
      localStorage.removeItem(`elevate_claimed_senator_${room.code}`);
      setClaimedSenatorId(null);
    }
    setShowClaimModal(false);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  // Active Bill & Speaker Resolution
  const activeBill = useMemo(() => {
    if (!room?.active_bill_id) return null;
    return bills.find((b) => b.id === room.active_bill_id) || null;
  }, [room?.active_bill_id, bills]);

  const activeSpeaker = useMemo(() => {
    if (!room?.current_speaker_id) return null;
    return representatives.find((r) => r.id === room.current_speaker_id) || null;
  }, [room?.current_speaker_id, representatives]);

  // Quorum Calculations
  const quorumStats = useMemo(() => {
    const active = representatives.filter((r) => r.active);
    const present = active.filter((r) => r.is_present !== false).length;
    const total = active.length;
    const simpleMajority = Math.floor(present / 2) + 1;
    const twoThirdsMajority = Math.ceil((2 * present) / 3);
    const isQuorumMet = present >= Math.floor(total / 2) + 1;
    return { total, present, simpleMajority, twoThirdsMajority, isQuorumMet };
  }, [representatives]);

  // Cycle Sequence & Speech Stage Analysis
  const cycleInfo = useMemo(() => {
    if (!room) return null;
    const isBroken = activeBill?.cycle_broken ?? false;
    const count = activeBill?.speech_count ?? 0;
    const lastSide = room.last_speech_side;

    let stageText = '';
    let badgeClass = '';
    let isNextNeg = false;
    let isNextAff = false;

    if (isBroken) {
      stageText = 'Cycle Broken: Chamber may recognize speeches on either side';
      badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    } else if (count === 0) {
      stageText = 'Speech #1: Authorship or Sponsorship (Affirmative)';
      badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      isNextAff = true;
    } else if (lastSide === 'author' || lastSide === 'sponsor' || lastSide === 'aff') {
      stageText = `Speech #${count + 1}: Negative Constructive`;
      badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      isNextNeg = true;
    } else {
      stageText = `Speech #${count + 1}: Affirmative Constructive`;
      badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      isNextAff = true;
    }

    return {
      isBroken,
      count,
      stageText,
      badgeClass,
      isNextNeg,
      isNextAff,
    };
  }, [room, activeBill]);

  // Pure NSDA Sorted Recency Ladder
  const sortedLadder = useMemo(() => {
    const activeReps = representatives.filter((r) => r.active);
    return sortRepresentatives(activeReps, ladderMode);
  }, [representatives, ladderMode]);

  // Filtered Ladder based on search query
  const filteredLadder = useMemo(() => {
    if (!searchFilter.trim()) return sortedLadder;
    const q = searchFilter.toLowerCase();
    return sortedLadder.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.school && r.school.toLowerCase().includes(q))
    );
  }, [sortedLadder, searchFilter]);

  // Claimed Senator Details
  const claimedSenator = useMemo(() => {
    if (!claimedSenatorId) return null;
    return sortedLadder.find((r) => r.id === claimedSenatorId) || null;
  }, [claimedSenatorId, sortedLadder]);

  // Count how many senators stand ahead of the claimed senator on the ladder
  const senatorsAheadCount = useMemo(() => {
    if (!claimedSenator) return 0;
    return sortedLadder.findIndex((r) => r.id === claimedSenator.id);
  }, [claimedSenator, sortedLadder]);

  // Format Timer Countdown
  const formatTimerClock = (totalSecs: number) => {
    const isNegative = totalSecs < 0;
    const absSecs = Math.abs(totalSecs);
    const m = Math.floor(absSecs / 60);
    const s = absSecs % 60;
    const prefix = isNegative ? '-' : '';
    return `${prefix}${m}:${s.toString().padStart(2, '0')}`;
  };

  // Timer Status Evaluation
  const isGracePeriod = timerDuration === 190
    ? (timerSecondsLeft <= 10 && timerSecondsLeft > 0)
    : (timerSecondsLeft <= 0 && timerSecondsLeft >= -10);

  const isExpired = timerDuration === 190
    ? (timerSecondsLeft <= 0)
    : (timerSecondsLeft < -10);

  if (loading) {
    return (
      <BetterPOLoader 
        isReady={false} 
        standalone={true} 
      />
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-serif-editorial font-bold text-slate-900 mb-2">Chamber Not Found</h2>
          <p className="text-xs font-mono text-slate-500 mb-6">{error || 'This chamber does not exist.'}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#0A1128] flex flex-col pb-24 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Chamber Status Alerts: Recess / Adjourned */}
      {room.status === 'recess' && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 sticky top-0 z-40 shadow-sm">
          <Coffee className="w-4 h-4" />
          <span>Chamber is currently in Recess / Caucus. Please remain on standby.</span>
        </div>
      )}

      {room.status === 'adjourned' && (
        <div className="bg-rose-600 text-white px-4 py-2 text-center text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 sticky top-0 z-40 shadow-sm">
          <Gavel className="w-4 h-4 text-white" />
          <span>This chamber session has adjourned sine die.</span>
        </div>
      )}

      {/* Top Navigation Bar: Super Minimalist Swiss Editorial Bar */}
      <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 truncate">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
            title="Return Home"
          >
            <Gavel className="w-4 h-4" />
          </button>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h1 className="font-serif-editorial font-bold text-slate-900 text-base sm:text-lg truncate max-w-[200px] sm:max-w-md">
                {room.name}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase shrink-0">
                {room.code}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Realtime Live Broadcast Indicator */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Live Sync</span>
          </div>

          {/* Claim Name Button */}
          <button
            onClick={() => setShowClaimModal(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition-all shadow-sm ${
              claimedSenator
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title="Pin your row to track your recency position"
          >
            <Star className={`w-3.5 h-3.5 ${claimedSenator ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">
              {claimedSenator ? claimedSenator.name.split(' ')[0] : 'Claim Seat'}
            </span>
          </button>

          {/* Share Link */}
          <button
            onClick={copyShareLink}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-mono font-semibold transition-colors shadow-sm"
            title="Copy Spectator Board Link"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Share'}</span>
          </button>

          {/* PO Access Direct Key */}
          <button
            onClick={() => navigate(`/room/${room.code}/po`)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-mono font-semibold transition-colors shadow-sm"
            title="Access Presiding Officer Console"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden md:inline">PO Access</span>
          </button>
        </div>
      </header>

      {/* Main Board Container */}
      <main className="max-w-5xl mx-auto px-4 py-5 w-full space-y-4">
        
        {/* ========================================================
            CHAMBER STATUS HUD: ACTIVE BILL, SPEECH STATUS & TIMER
            ======================================================== */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          
          {/* Top Row: Active Legislation Title & Chamber Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="space-y-0.5">
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Active Legislation on the Floor</span>
              </div>
              <div className="text-base sm:text-xl font-serif-editorial font-bold text-slate-900">
                {activeBill ? (
                  <span>
                    <span className="text-emerald-700">{activeBill.bill_number}:</span> {activeBill.title}
                  </span>
                ) : room.current_legislation ? (
                  room.current_legislation
                ) : (
                  'General Business / No Bill Active'
                )}
              </div>
              {activeBill?.author_school && (
                <div className="text-xs font-mono text-slate-400">
                  Author Affiliation: <span className="text-slate-600">{activeBill.author_school}</span>
                </div>
              )}
            </div>

            {/* Chamber Status Pill */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                  room.status === 'in_session'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : room.status === 'recess'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${room.status === 'in_session' ? 'bg-emerald-500 animate-pulse' : room.status === 'recess' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
                <span>{room.status.replace('_', ' ')}</span>
              </span>
            </div>
          </div>

          {/* Active Amendment Notice Banner (If Active) */}
          {room.active_amendment && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-900">
                    Floor Amendment Under Active Debate
                  </span>
                </div>
                <span className="text-[11px] font-mono text-amber-800 font-bold">
                  {room.active_amendment.speeches_count} speeches
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600">
                Proposed by: <span className="text-slate-900 font-bold">{room.active_amendment.author_name}</span>
              </div>
              <div className="text-xs text-slate-800 italic bg-white p-2 rounded-lg border border-amber-200">
                "{room.active_amendment.text}"
              </div>
            </div>
          )}

          {/* Middle Row: Speech Status & Live Synchronized Timer HUD */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            
            {/* Left Box (col-span-7): Active Speaker & Speech Stage */}
            <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Floor Recognition & Sequence</span>
                {activeBill && (
                  <span className="font-mono text-slate-600 font-semibold">
                    {activeBill.speech_count} Speeches Given
                  </span>
                )}
              </div>

              {/* Active Speaker Presentation */}
              {activeSpeaker ? (
                <div className="p-3 rounded-xl bg-white border border-emerald-300 flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0 border border-emerald-200">
                      <Mic className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                          Speaking
                        </span>
                        <h4 className="font-serif-editorial font-bold text-slate-900 text-base">
                          Senator {activeSpeaker.name}
                        </h4>
                      </div>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        {activeSpeaker.school || 'Chamber Member'} • Floor is occupied
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center gap-2.5 text-xs font-mono text-slate-500">
                  <Mic className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>The floor is currently open (awaiting speaker recognition by Presiding Officer).</span>
                </div>
              )}

              {/* Cycle Alert & Stage Pill */}
              {cycleInfo && (
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border font-bold ${cycleInfo.badgeClass}`}>
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>{cycleInfo.stageText}</span>
                  </span>

                  {cycleInfo.isBroken && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                      Override Active
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right Box (col-span-5): Live Master Synchronized Timer HUD */}
            <div className={`md:col-span-5 p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all shadow-sm ${
              isExpired
                ? 'bg-rose-50 border-rose-300 text-rose-900 animate-pulse'
                : isGracePeriod
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : timerIsRunning
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <div className="flex items-center justify-between w-full pb-1 text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Master Clock</span>
                </span>
                <span className={`font-semibold ${timerIsRunning ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {timerIsRunning ? '● Running' : 'Paused / Ready'}
                </span>
              </div>

              {/* Digital Monospace Countdown Display */}
              <div className="font-mono font-black text-4xl sm:text-5xl tracking-tight my-1 text-slate-900">
                {formatTimerClock(timerSecondsLeft)}
              </div>

              {/* Progress Bar Sync */}
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden my-1 border border-slate-200/80">
                <div 
                  className={`h-full transition-all duration-300 ${
                    isExpired ? 'bg-rose-500' : isGracePeriod ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ 
                    width: `${Math.max(0, Math.min(100, ((timerDuration - timerSecondsLeft) / (timerDuration || 190)) * 100))}%` 
                  }}
                />
              </div>

              {/* Speaker Indicator from PO Timer broadcast if not already resolved */}
              {timerSpeakerName && !activeSpeaker && (
                <div className="text-[11px] text-emerald-700 font-mono font-semibold truncate max-w-[200px] mb-1">
                  Speaker: {timerSpeakerName}
                </div>
              )}

              {/* Timer Cues & Phase Labels */}
              <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold">
                {isExpired ? (
                  <span className="text-rose-600 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Time Expired</span>
                  </span>
                ) : isGracePeriod ? (
                  <span className="text-amber-600 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Grace Period ({timerDuration === 190 ? timerSecondsLeft : 10 + timerSecondsLeft}s)</span>
                  </span>
                ) : (
                  <span className="text-slate-500">
                    {timerMode === 'speech'
                      ? 'Speech Clock (3:10)'
                      : timerMode === 'dq'
                      ? 'Direct Questioning (30s)'
                      : timerMode === 'question'
                      ? 'Cross-Examination (1:00)'
                      : timerMode === 'recess'
                      ? 'Chamber Recess'
                      : 'Timed Floor Period'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Live Quorum & Thresholds Indicator */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Chamber Quorum</div>
                <div className="font-bold text-slate-900">
                  {quorumStats.present} / {quorumStats.total} <span className="text-[10px] text-slate-400 font-normal">Present</span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Quorum Status</div>
              <div className={`font-bold flex items-center gap-1 ${quorumStats.isQuorumMet ? 'text-emerald-700' : 'text-rose-600'}`}>
                {quorumStats.isQuorumMet ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Quorum Met</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    <span>No Quorum</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Majority (&gt;50%)</div>
              <div className="font-mono font-bold text-slate-800">
                {quorumStats.simpleMajority} votes required
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">2/3 (Cloture/Motions)</div>
              <div className="font-mono font-bold text-slate-800">
                {quorumStats.twoThirdsMajority} votes required
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            "CLAIM YOUR NAME" PINNED TRACKER CARD (Spectator Safeguard)
            ======================================================== */}
        {claimedSenator && (
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-white">
                    Your Seat
                  </span>
                  <h3 className="font-serif-editorial font-bold text-slate-900 text-sm sm:text-base">
                    Senator {claimedSenator.name}
                  </h3>
                  {claimedSenator.school && (
                    <span className="text-xs font-mono text-slate-500">({claimedSenator.school})</span>
                  )}
                </div>
                <div className="text-xs font-mono text-slate-600 mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span>
                    Priority: <strong className="text-slate-900 font-bold">Rank #{claimedSenator.rank}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Speeches: <strong className="text-slate-900">{claimedSenator.speeches_count}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    {senatorsAheadCount === 0 ? (
                      <strong className="text-emerald-700">You are next in line for floor recognition!</strong>
                    ) : (
                      <span>
                        <strong className="text-slate-900">{senatorsAheadCount}</strong> ahead of you
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleClaimSenator(null)}
              className="text-xs font-mono text-slate-500 hover:text-slate-900 underline self-end sm:self-center shrink-0"
            >
              Switch Senator
            </button>
          </div>
        )}

        {/* ========================================================
            THE PURE RECENCY LADDER (Main Body)
            ======================================================== */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          
          {/* Header & Controls: Mode Switcher & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-serif-editorial font-bold text-slate-900 text-base">The Pure Recency Ladder</h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Real-time sorted precedence & recency according to official rules
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Search Filter */}
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter debater..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              {/* Speeches vs Questions Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 font-mono text-xs">
                <button
                  onClick={() => setLadderMode('speech')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                    ladderMode === 'speech'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Speeches</span>
                </button>
                <button
                  onClick={() => setLadderMode('question')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                    ladderMode === 'question'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                  <span>Questions</span>
                </button>
              </div>
            </div>
          </div>

          {/* Ladder Legend */}
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
            <span>Rank & Senator</span>
            <span>
              {ladderMode === 'speech' ? 'Precedence (Speeches) • Recency Order' : 'Precedence (Questions) • Recency Order'}
            </span>
          </div>

          {/* Sorted Representatives Ladder List */}
          <div className="space-y-1.5">
            {filteredLadder.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-mono text-xs">
                {representatives.length === 0
                  ? 'No debaters registered in this chamber yet.'
                  : 'No debaters match your filter.'}
              </div>
            ) : (
              filteredLadder.map((rep) => {
                const isSpeaking = room.current_speaker_id === rep.id;
                const isClaimed = claimedSenatorId === rep.id;
                const isPresent = rep.is_present !== false;

                return (
                  <div
                    key={rep.id}
                    onClick={() => {
                      if (!claimedSenatorId) {
                        handleClaimSenator(rep.id);
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-all border ${
                      !isPresent
                        ? 'bg-slate-50 border-slate-200 opacity-50'
                        : isSpeaking
                        ? 'bg-emerald-50 border-emerald-300 text-slate-900 shadow-sm'
                        : isClaimed
                        ? 'bg-amber-50/70 border-amber-300 text-slate-900 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      {/* Rank Badge */}
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold font-mono shrink-0 ${
                          !isPresent
                            ? 'bg-slate-200 text-slate-500'
                            : rep.rank === 1
                            ? 'bg-emerald-600 text-white font-black'
                            : rep.rank === 2
                            ? 'bg-slate-800 text-white font-bold'
                            : rep.rank === 3
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        #{rep.rank}
                      </span>

                      <div className="truncate">
                        <div className="font-serif-editorial font-bold text-slate-900 text-sm truncate flex items-center gap-2">
                          <span className={!isPresent ? 'line-through text-slate-400' : ''}>
                            {rep.name}
                          </span>

                          {/* Speaking Badge */}
                          {isSpeaking && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-600 text-white flex items-center gap-1 shadow-sm">
                              <Mic className="w-3 h-3" />
                              <span>Speaking</span>
                            </span>
                          )}

                          {/* You / Claimed Badge */}
                          {isClaimed && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500 text-white flex items-center gap-0.5 shadow-sm">
                              <Star className="w-2.5 h-2.5 fill-white" />
                              <span>You</span>
                            </span>
                          )}

                          {/* Away Status */}
                          {!isPresent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200 text-slate-600">
                              Away
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                          {rep.school || 'Independent'}
                        </div>
                      </div>
                    </div>

                    {/* Precedence Count & Global Order */}
                    <div className="text-right font-mono shrink-0 pl-2">
                      <div className="font-bold text-sm">
                        {ladderMode === 'speech' ? (
                          <span className="text-emerald-700">{rep.speeches_count} spk</span>
                        ) : (
                          <span className="text-slate-800">{rep.questions_count} Q</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {ladderMode === 'speech'
                          ? rep.last_speech_order > 0
                            ? `#${rep.last_speech_order} REC`
                            : 'Never Spoke'
                          : rep.last_question_order > 0
                          ? `#${rep.last_question_order} REC`
                          : 'Never Asked'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* ========================================================
          CHAMBER AUDIT LEDGER DRAWER / BOTTOM SHEET
          ======================================================== */}
      {/* Floating Drawer Trigger Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => setIsLedgerOpen(!isLedgerOpen)}
            className="flex items-center gap-2.5 text-xs font-mono font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <History className="w-4 h-4 text-emerald-600" />
            <span>Round History & Audit Ledger</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] border border-slate-200">
              {roundEvents.length} events
            </span>
            {isLedgerOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
          </button>

          <div className="text-[11px] font-mono text-slate-400 hidden sm:block">
            Read-only transparency for debaters
          </div>
        </div>

        {/* Collapsible Ledger Panel */}
        {isLedgerOpen && (
          <div className="max-w-5xl mx-auto mt-3 pt-3 border-t border-slate-200 animate-fadeIn space-y-3">
            {/* Search filter in ledger */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search round history..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              <button
                onClick={() => setIsLedgerOpen(false)}
                className="text-xs font-mono text-slate-500 hover:text-slate-900 p-1"
                title="Collapse Ledger"
              >
                ✕ Close
              </button>
            </div>

            {/* Event Timeline Stream */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
              {roundEvents.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No floor calls or events recorded in this chamber yet.
                </div>
              ) : (
                roundEvents
                  .filter((e) => {
                    if (!ledgerSearch.trim()) return true;
                    const q = ledgerSearch.toLowerCase();
                    return (
                      (e.representative_name && e.representative_name.toLowerCase().includes(q)) ||
                      (e.legislation && e.legislation.toLowerCase().includes(q)) ||
                      e.event_type.toLowerCase().includes(q)
                    );
                  })
                  .map((e) => {
                    const timeStr = new Date(e.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    const isAff = e.event_type === 'speech_aff';
                    const isNeg = e.event_type === 'speech_neg';
                    const isAuthor = e.event_type === 'speech_author' || e.event_type === 'speech_sponsor';
                    const isQuestion = e.event_type === 'question';

                    return (
                      <div
                        key={e.id}
                        className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 shrink-0">
                            [{timeStr}]
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              isAff
                                ? 'bg-emerald-100 text-emerald-800'
                                : isNeg
                                ? 'bg-rose-100 text-rose-800'
                                : isAuthor
                                ? 'bg-slate-200 text-slate-800'
                                : isQuestion
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {e.event_type.replace('speech_', '').replace('_', ' ')}
                          </span>

                          <span className="font-bold text-slate-900">
                            {e.representative_name ? `Sen. ${e.representative_name}` : 'Chamber Motion'}
                          </span>

                          {e.representative_school && (
                            <span className="text-slate-400 text-[11px] hidden sm:inline">
                              ({e.representative_school})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-slate-400 text-[11px] self-end sm:self-center">
                          {e.legislation && (
                            <span className="truncate max-w-xs text-slate-600">
                              {e.legislation}
                            </span>
                          )}
                          <span className="font-bold text-slate-500">
                            #{e.sequence_number}
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          "CLAIM YOUR NAME" MODAL DIALOG
          ======================================================== */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-editorial font-bold text-slate-900 text-base">Claim Your Name</h3>
                  <p className="text-xs font-mono text-slate-400">
                    Pin your seat to track your live recency distance
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClaimModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-mono text-slate-600 leading-relaxed">
              Select your name from the roster. BetterPO will pin your personal recency statistics to the top of your screen so you know exactly when you have the floor priority.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
              {representatives.filter((r) => r.active).length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No representatives available in this chamber.
                </div>
              ) : (
                representatives
                  .filter((r) => r.active)
                  .map((rep) => {
                    const isSelected = claimedSenatorId === rep.id;
                    return (
                      <button
                        key={rep.id}
                        onClick={() => handleClaimSenator(rep.id)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-amber-50 border-amber-300 text-slate-900 font-bold shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900">{rep.name}</div>
                          <div className="text-[10px] text-slate-400">{rep.school || 'Independent'}</div>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            Selected
                          </span>
                        )}
                      </button>
                    );
                  })
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 font-mono text-xs">
              {claimedSenatorId ? (
                <button
                  type="button"
                  onClick={() => handleClaimSenator(null)}
                  className="text-rose-600 hover:underline font-semibold"
                >
                  Clear Selection
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setShowClaimModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpectatorBoard;
