import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  RotateCcw, 
  Share2, 
  Download, 
  UserPlus, 
  Lock, 
  FileText, 
  KeyRound, 
  AlertCircle, 
  Sparkles, 
  Award,
  BookOpen,
  Settings,
  FileEdit,
  Vote,
  Clock,
  Mic,
  ArrowRight
} from 'lucide-react';
import { chamberService } from '../lib/chamberService';
import { 
  supabase, 
  isSupabaseConfigured, 
  subscribeToLocalSync 
} from '../lib/supabase';
import type { Room, Representative, Bill, RoundEvent, EventType, ChamberSettings } from '../lib/supabase';
import { resolveStandingWinner, formatPriorityReason, sortRepresentatives } from '../lib/precedence';
import { ChamberTimer } from '../components/ChamberTimer';
import { FloorGrid, extractLastName } from '../components/FloorGrid';
import { RecencyLadder } from '../components/RecencyLadder';
import { RosterImportModal } from '../components/RosterImportModal';
import { DocketTracker } from '../components/DocketTracker';
import { QuorumVotingBar } from '../components/QuorumVotingBar';
import { AmendmentWorkflowModal } from '../components/AmendmentWorkflowModal';
import { ChamberSettingsModal } from '../components/ChamberSettingsModal';
import { BetterPOLoader } from '../components/BetterPOLoader';

export const PODashboard: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  // Core Chamber State
  const [room, setRoom] = useState<Room | null>(null);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [roundEvents, setRoundEvents] = useState<RoundEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Interactive Standing Floor State
  const [standingIds, setStandingIds] = useState<Set<string>>(new Set());
  const [floorMode, setFloorMode] = useState<'speech' | 'question'>('speech');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Controls
  const [showRosterModal, setShowRosterModal] = useState<boolean>(false);
  const [showDocketModal, setShowDocketModal] = useState<boolean>(false);
  const [showAmendmentModal, setShowAmendmentModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAuditLogFull, setShowAuditLogFull] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [timerAutoTrigger, setTimerAutoTrigger] = useState<number>(0);

  // Vote Calculator & Previous Question (PQ) State
  const [showVoteModal, setShowVoteModal] = useState<boolean>(false);
  const [voteModalMotionName, setVoteModalMotionName] = useState<string>('Previous Question (Close Debate)');
  const [voteModalThreshold, setVoteModalThreshold] = useState<'majority' | 'two_thirds'>('two_thirds');
  const [isPQFlow, setIsPQFlow] = useState<boolean>(false);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Initial Chamber Load & Auth Verification
  const loadData = useCallback(async () => {
    if (!code) return;
    try {
      setLoading(true);
      const roomData = await chamberService.getRoomByCode(code);
      if (!roomData) {
        setError(`Chamber "${code}" not found.`);
        setLoading(false);
        return;
      }

      setRoom(roomData);

      // Verify Passcode from localStorage or URL hash
      const savedPass = localStorage.getItem(`elevate_po_passcode_${roomData.code}`) || 
                        localStorage.getItem(`elevate_po_pin_${roomData.code}`);
      const hashPass = window.location.hash.replace('#', '');
      if (
        savedPass?.trim() === roomData.po_passcode.trim() ||
        hashPass.trim() === roomData.po_passcode.trim()
      ) {
        setIsAuthenticated(true);
      }

      const [reps, roomBills, events] = await Promise.all([
        chamberService.getRepresentatives(roomData.id),
        chamberService.getBills(roomData.id),
        chamberService.getRoundEvents(roomData.id, 50),
      ]);

      setRepresentatives(reps);
      setBills(roomBills);
      setRoundEvents(events);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading chamber.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Real-time Subscriptions
  useEffect(() => {
    if (!room?.id) return;

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`po_channel_${room.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'representatives', filter: `room_id=eq.${room.id}` },
          async () => {
            const updated = await chamberService.getRepresentatives(room.id);
            setRepresentatives(updated);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bills', filter: `room_id=eq.${room.id}` },
          async () => {
            const updatedBills = await chamberService.getBills(room.id);
            setBills(updatedBills);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'round_events', filter: `room_id=eq.${room.id}` },
          async () => {
            const updatedEvents = await chamberService.getRoundEvents(room.id, 50);
            setRoundEvents(updatedEvents);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
          (payload) => {
            setRoom(payload.new as Room);
          }
        )
        .subscribe();

      return () => {
        if (supabase) {
          supabase.removeChannel(channel);
        }
      };
    } else {
      // Local fallback broadcast channel
      const cleanup = subscribeToLocalSync(async () => {
        const [updatedRoom, updatedReps, updatedBills, updatedEvents] = await Promise.all([
          chamberService.getRoomByCode(room.code),
          chamberService.getRepresentatives(room.id),
          chamberService.getBills(room.id),
          chamberService.getRoundEvents(room.id, 50),
        ]);
        if (updatedRoom) {
          setRoom(updatedRoom);
        }
        setRepresentatives(updatedReps);
        setBills(updatedBills);
        setRoundEvents(updatedEvents);
      });

      return () => cleanup();
    }
  }, [room?.id, room?.code]);

  // Keyboard shortcut: Escape to clear standing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStandingIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Standing Resolution: Calculates legal precedence among standing senators
  const { winner, isTie, tiedCandidates } = useMemo(() => {
    return resolveStandingWinner(standingIds, representatives, floorMode);
  }, [standingIds, representatives, floorMode]);

  // Sorted Queue of all currently standing senators
  const standingQueue = useMemo(() => {
    if (standingIds.size === 0) return [];
    const standingReps = representatives.filter((r) => standingIds.has(r.id));
    return sortRepresentatives(standingReps, floorMode);
  }, [standingIds, representatives, floorMode]);

  // Active Bill Resolution
  const activeBill = useMemo(() => {
    if (!room?.active_bill_id) return null;
    return bills.find((b) => b.id === room.active_bill_id) || null;
  }, [room?.active_bill_id, bills]);

  // Active speaker resolution
  const activeSpeaker = useMemo(() => {
    if (!room?.current_speaker_id) return null;
    return representatives.find((r) => r.id === room.current_speaker_id) || null;
  }, [room?.current_speaker_id, representatives]);

  // Quorum & Presence Metrics
  const presentCount = useMemo(() => {
    return representatives.filter((r) => r.is_present !== false).length;
  }, [representatives]);

  // Expected Next Side for Speeches
  const expectedNextSide = useMemo(() => {
    if (!room?.last_speech_side) return 'Authorship / Sponsorship';
    return room.last_speech_side === 'aff' ? 'Negative' : 'Affirmative';
  }, [room?.last_speech_side]);

  // Toggle standing state for a debater
  const handleToggleStanding = (id: string) => {
    setStandingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearStanding = () => {
    setStandingIds(new Set());
  };

  // Passcode verification
  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;

    if (passcodeInput.trim() === room.po_passcode.trim()) {
      setIsAuthenticated(true);
      setAuthError(null);
      localStorage.setItem(`elevate_po_passcode_${room.code}`, passcodeInput.trim());
    } else {
      setAuthError('Incorrect PO passcode. Please check tournament master key.');
    }
  };

  // Status changes
  const handleStatusChange = async (status: Room['status']) => {
    if (!room) return;
    const updated = await chamberService.updateRoom(room.id, { status });
    if (updated) {
      setRoom(updated);
      showToast(`Chamber status set to ${status.replace('_', ' ').toUpperCase()}`);
    }
  };

  // Docket updates
  const handleAddBill = async (billNumber: string, title: string, fullText?: string) => {
    if (!room) return;
    const newBill = await chamberService.addBill(room.id, billNumber, title, fullText || '');
    setBills((prev) => [...prev, newBill]);
    showToast(`Added ${newBill.bill_number}: ${newBill.title}`);
  };

  const handleSetActiveBill = async (bill: Bill) => {
    if (!room) return;
    const { room: updatedRoom, bill: updatedBill } = await chamberService.setActiveBill(room, bill);
    setRoom(updatedRoom);
    setBills((prev) => prev.map((b) => (b.id === bill.id ? updatedBill : b)));
    showToast(`Active Bill set to ${bill.bill_number}`);
  };

  const handleUpdateBillStatus = async (billId: string, status: Bill['status']) => {
    const updated = await chamberService.updateBill(billId, { status });
    if (updated) {
      setBills((prev) => prev.map((b) => (b.id === billId ? updated : b)));
      showToast(`Bill status updated to ${status}`);
    }
  };

  const handleToggleBreakCycle = async (bill: Bill) => {
    if (!room) return;
    const updated = await chamberService.toggleBreakCycle(bill.id, !bill.cycle_broken);
    if (updated) {
      setBills((prev) => prev.map((b) => (b.id === bill.id ? updated : b)));
      showToast(`Cycle override ${!bill.cycle_broken ? 'Enabled' : 'Disabled'}`);
    }
  };

  // Floor Recognition Action
  const handleAwardAction = async (rep: Representative, eventType: EventType) => {
    if (!room) return;
    try {
      const isSpeech = eventType.startsWith('speech_');
      const targetLegislation = activeBill 
        ? `${activeBill.bill_number}: ${activeBill.title}` 
        : room.current_legislation || 'General Orders';

      const result = await chamberService.awardFloorAction(
        room,
        rep,
        eventType,
        targetLegislation
      );

      setRoom(result.room);

      const [updatedReps, events] = await Promise.all([
        chamberService.getRepresentatives(room.id),
        chamberService.getRoundEvents(room.id, 50),
      ]);

      setRepresentatives(updatedReps);
      setRoundEvents(events);
      setStandingIds(new Set());

      if (isSpeech) {
        setTimerAutoTrigger((prev) => prev + 1);
      }

      showToast(`Recognized ${rep.name} for ${eventType.replace('speech_', '').toUpperCase()}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error awarding action');
    }
  };

  // Rollback / Undo
  const handleUndo = async () => {
    if (!room) return;
    try {
      const reverted = await chamberService.undoLastFloorAction(room.id);
      if (reverted) {
        const [updatedRoom, updatedReps, events] = await Promise.all([
          chamberService.getRoomByCode(room.code),
          chamberService.getRepresentatives(room.id),
          chamberService.getRoundEvents(room.id, 50),
        ]);
        if (updatedRoom) setRoom(updatedRoom);
        setRepresentatives(updatedReps);
        setRoundEvents(events);
        showToast('Reverted most recent floor call');
      } else {
        showToast('No recent actions to revert');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error reverting action');
    }
  };

  // Bulk Ingest Roster
  const handleImportRoster = async (entries: Array<{ name: string; school: string }>) => {
    if (!room) return;
    const added = await chamberService.addRepresentatives(room.id, entries);
    setRepresentatives((prev) => [...prev, ...added]);
    showToast(`Added ${added.length} debaters to roster`);
  };

  // Toggle Presence / Quorum
  const handleTogglePresence = async (rep: Representative) => {
    const currentPresence = rep.is_present !== false;
    await chamberService.toggleRepresentativePresence(rep.id, currentPresence);
    setRepresentatives((prev) =>
      prev.map((r) => (r.id === rep.id ? { ...r, is_present: !currentPresence } : r))
    );
    showToast(`${rep.name} marked ${!currentPresence ? 'In Chamber' : 'Away'}`);
  };

  // Amendment Actions
  const handleStartAmendment = async (authorId: string, authorName: string, text: string) => {
    if (!room) return;
    const targetBillId = room.active_bill_id || (bills[0]?.id) || 'general';
    const updated = await chamberService.startAmendment(room, targetBillId, authorId, authorName, text);
    if (updated) {
      setRoom(updated);
      showToast(`Floor Amendment introduced by ${authorName}`);
    }
  };

  const handleConcludeAmendment = async (passed: boolean, motionNotes?: string) => {
    if (!room) return;
    const updated = await chamberService.concludeAmendment(room, passed, motionNotes);
    if (updated) {
      setRoom(updated);
      showToast(`Amendment ${passed ? 'Adopted' : 'Rejected'}`);
      const [reps, roomBills, events] = await Promise.all([
        chamberService.getRepresentatives(room.id),
        chamberService.getBills(room.id),
        chamberService.getRoundEvents(room.id, 50),
      ]);
      setRepresentatives(reps);
      setBills(roomBills);
      setRoundEvents(events);
    }
  };

  // Previous Question Action Initiator
  const handleMoveToPreviousQuestion = () => {
    if (activeBill) {
      setVoteModalMotionName(`Previous Question & Passage on ${activeBill.bill_number}: ${activeBill.title}`);
    } else if (room?.current_legislation) {
      setVoteModalMotionName(`Previous Question & Passage on ${room.current_legislation}`);
    } else {
      setVoteModalMotionName('Previous Question (Close Debate)');
    }
    setVoteModalThreshold('two_thirds');
    setIsPQFlow(true);
    setShowVoteModal(true);
  };

  // Motion Vote Logging & Previous Question Docket Progression
  const handleSaveMotionVote = async (
    title: string,
    ayes: number,
    nays: number,
    abstains: number,
    threshold: 'majority' | 'two_thirds',
    passed: boolean,
    advanceNextBill?: boolean
  ) => {
    if (!room) return;
    await chamberService.logMotionVote(room.id, title, ayes, nays, abstains, threshold, passed);

    if (advanceNextBill) {
      const currentBill = activeBill || bills.find((b) => b.id === room.active_bill_id);
      if (currentBill) {
        const newStatus: Bill['status'] = passed ? 'passed' : 'failed';
        await chamberService.updateBill(currentBill.id, { status: newStatus });

        const updatedBills = bills.map((b) =>
          b.id === currentBill.id ? { ...b, status: newStatus } : b
        );
        setBills(updatedBills);

        const nextBill = updatedBills.find(
          (b) => b.id !== currentBill.id && (b.status === 'upcoming' || (b.status !== 'passed' && b.status !== 'failed'))
        );

        if (nextBill) {
          const { room: updatedRoom, bill: activatedBill } = await chamberService.setActiveBill(room, nextBill);
          setRoom(updatedRoom);
          setBills((prev) =>
            prev.map((b) => (b.id === nextBill.id ? activatedBill : b))
          );
          showToast(`Vote recorded (${passed ? 'PASSED' : 'FAILED'}). Concluded ${currentBill.bill_number} and advanced to ${nextBill.bill_number}!`);
        } else {
          const updatedRoom = await chamberService.updateRoom(room.id, {
            active_bill_id: null,
            current_legislation: 'Docket Complete - All Bills Concluded',
            last_speech_side: null,
          });
          if (updatedRoom) setRoom(updatedRoom);
          showToast(`Vote recorded (${passed ? 'PASSED' : 'FAILED'}). All bills on docket completed!`);
        }
      }
      setIsPQFlow(false);
    } else {
      showToast(`Vote recorded: ${title} (${passed ? 'PASSED' : 'FAILED'})`);
    }

    const events = await chamberService.getRoundEvents(room.id, 50);
    setRoundEvents(events);
  };

  // Chamber Settings Update
  const handleSaveChamberSettings = async (settings: ChamberSettings) => {
    if (!room) return;
    const updated = await chamberService.updateChamberSettings(room.id, settings);
    if (updated) {
      setRoom(updated);
      showToast('Chamber settings updated & synchronized');
    }
  };

  // Copy Links
  const copySpectatorLink = () => {
    const url = `${window.location.origin}/room/${room?.code}`;
    navigator.clipboard.writeText(url);
    showToast('Copied Spectator Link to clipboard!');
  };

  const copyPOKeyLink = () => {
    const url = `${window.location.origin}/room/${room?.code}/po#${room?.po_passcode}`;
    navigator.clipboard.writeText(url);
    showToast('Copied Direct PO Key Link to clipboard!');
  };

  // Loading Screen
  if (loading) {
    return <BetterPOLoader isReady={false} standalone={true} />;
  }

  // Error Screen
  if (error || !room) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#CBD5E1] rounded-2xl p-6 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-serif-editorial font-bold text-[#0A1128] mb-2">Chamber Not Found</h2>
          <p className="text-xs font-mono text-slate-500 mb-6">{error || 'This chamber does not exist.'}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2.5 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-mono font-bold text-xs transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Passcode Auth Wall
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#CBD5E1] rounded-2xl p-6 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#006948] border border-emerald-200 mx-auto flex items-center justify-center mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-serif-editorial font-bold text-[#0A1128] mb-1">Presiding Officer Passcode</h2>
            <p className="text-xs font-mono text-slate-500">
              Enter passcode for <span className="font-semibold text-slate-800">{room.name}</span> ({room.code})
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleVerifyPasscode} className="space-y-4">
            <input
              type="password"
              placeholder="Enter PO Passcode"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              autoFocus
              className="w-full bg-slate-50 border border-[#CBD5E1] rounded-xl px-4 py-3 text-sm text-center text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-[#006948]/30 focus:bg-white"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-mono font-bold text-xs transition-colors shadow-sm"
            >
              Unlock PO Controls
            </button>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate(`/room/${room.code}`)}
                className="text-xs font-mono text-slate-500 hover:text-slate-900 underline"
              >
                Join as Competitor / Spectator instead
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#161d1b] flex flex-col font-sans selection:bg-[#68dba9]/30 selection:text-[#002114]">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-12 right-6 z-50 bg-[#0A1128] text-white font-mono text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce border border-slate-700">
          <Sparkles className="w-4 h-4 text-[#10B981]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Roster Ingest Modal */}
      <RosterImportModal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        onImport={handleImportRoster}
      />

      {/* Docket & Bills Modal */}
      <DocketTracker
        isOpen={showDocketModal}
        onClose={() => setShowDocketModal(false)}
        room={room}
        bills={bills}
        onAddBill={handleAddBill}
        onSetActiveBill={handleSetActiveBill}
        onUpdateBillStatus={handleUpdateBillStatus}
        onToggleBreakCycle={handleToggleBreakCycle}
      />

      {/* Amendment Workflow Modal */}
      <AmendmentWorkflowModal
        isOpen={showAmendmentModal}
        onClose={() => setShowAmendmentModal(false)}
        room={room}
        bills={bills}
        representatives={representatives}
        onStartAmendment={handleStartAmendment}
        onConcludeAmendment={handleConcludeAmendment}
      />

      {/* Chamber Rules & Settings Modal */}
      <ChamberSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        room={room}
        onSaveSettings={handleSaveChamberSettings}
      />

      {/* Voting & Quorum Live Calculator Modal */}
      <QuorumVotingBar
        representatives={representatives}
        onLogVote={handleSaveMotionVote}
        isOpen={showVoteModal}
        onOpenChange={setShowVoteModal}
        initialMotionName={voteModalMotionName}
        initialThreshold={voteModalThreshold}
        isPQFlow={isPQFlow}
      />

      {/* ========================================================
          TOP NAVIGATION BAR: GAVELOS MASTER CONTROLLER HEADER
          ======================================================== */}
      <header className="border-b border-[#CBD5E1]/80 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 h-16 flex items-center justify-between gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        {/* Left: Brand & Chamber Identifier */}
        <div className="flex items-center gap-3">
          <div 
            onClick={() => navigate('/')}
            className="flex items-center cursor-pointer group"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm tracking-wider uppercase text-[#0A1128] group-hover:opacity-80 transition-opacity">
                  better<span className="text-[#006948]">po</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#eef5f1] text-[#006948] font-bold border border-[#68dba9]/30">
                  PO Master Controller
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500 truncate max-w-[200px] sm:max-w-xs">
                Chamber {room.code} • {room.name}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Quick Action Pills */}
        <div className="hidden md:flex items-center gap-1.5 font-mono text-xs">
          <button
            onClick={() => setShowDocketModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-[#CBD5E1] transition-colors"
            title="Manage Chamber Docket"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#006948]" />
            <span>Docket ({bills.length})</span>
          </button>

          <button
            onClick={() => setShowRosterModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-[#CBD5E1] transition-colors"
            title="Add Debaters to Roster"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#006948]" />
            <span>Add Debaters</span>
          </button>

          <button
            onClick={() => setShowAmendmentModal(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
              room.active_amendment
                ? 'bg-amber-50 text-amber-900 border-amber-400 font-bold animate-pulse'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-[#CBD5E1]'
            }`}
            title="Floor Amendment Workflow"
          >
            <FileEdit className={`w-3.5 h-3.5 ${room.active_amendment ? 'text-amber-600' : 'text-slate-500'}`} />
            <span>Amendment</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-[#CBD5E1] transition-colors"
            title="Settings & Rules"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
          </button>

          <button
            onClick={copySpectatorLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-[#CBD5E1] transition-colors"
            title="Share Spectator Link"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Share</span>
          </button>

          <button
            onClick={copyPOKeyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-[#CBD5E1] transition-colors"
            title="Copy Direct PO Link with Passcode Key"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#006948]" />
            <span>PO Key</span>
          </button>

          <button
            onClick={() => chamberService.exportSessionCSV(room, representatives, roundEvents, bills)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-[#CBD5E1] transition-colors"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export</span>
          </button>
        </div>

        {/* Right: Live Session Status Pill & Controls */}
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#eef5f1] border border-[#68dba9]/40 text-[#006948] font-mono text-xs font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
            <span className="capitalize">{room.status.replace('_', ' ')}</span>
          </div>

          {/* Quick Undo Last Call */}
          <button
            onClick={handleUndo}
            disabled={roundEvents.length === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 disabled:opacity-30 text-rose-700 border border-rose-200 font-mono text-xs font-bold transition-colors"
            title="Undo most recent call"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Undo</span>
          </button>
        </div>
      </header>

      {/* ========================================================
          SUBHEADER RIBBON: HIGH-CLARITY TELEMETRY BANNER
          ======================================================== */}
      <section className="bg-white border-b border-[#CBD5E1]/80 px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
        {/* Left: Active Item on Floor */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-[#006948] text-white font-mono text-[10px] font-black uppercase tracking-wider">
              Current Item
            </span>
            <span className="font-serif-editorial font-bold text-slate-900 text-sm sm:text-base">
              {activeBill ? `${activeBill.bill_number}: ${activeBill.title}` : room.current_legislation || 'General Orders / Open Floor'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 pl-2 border-l border-slate-200">
            <span>Next Speech:</span>
            <span className="font-bold text-[#006948] uppercase">
              {expectedNextSide}
            </span>
          </div>
        </div>

        {/* Right: Dynamic Standing Counts & Quorum Badges */}
        <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
          <div className="px-2.5 py-1 rounded-md bg-[#eef5f1] border border-[#68dba9]/40 text-[#006948] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006948]" />
            <span>{standingIds.size} Standing</span>
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600 font-semibold">
            <span>{representatives.length - standingIds.size} Seated</span>
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600 font-semibold">
            <span>Quorum: {presentCount}/{representatives.length}</span>
          </div>

          {activeSpeaker && (
            <div className="px-2.5 py-1 rounded-md bg-emerald-100/70 border border-emerald-300 text-emerald-900 font-bold flex items-center gap-1 animate-pulse">
              <Mic className="w-3 h-3 text-[#006948]" />
              <span>Speaking: {activeSpeaker.name}</span>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================
          ACTIVE AMENDMENT WARNING BANNER (IF APPLICABLE)
          ======================================================== */}
      {room.active_amendment && (
        <section className="bg-amber-50 border-b border-amber-300 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-white uppercase tracking-wider">
              Amendment Pending
            </span>
            <span className="text-xs font-mono font-bold text-amber-900">
              Author: Senator {room.active_amendment.author_name}
            </span>
            <span className="text-xs text-amber-800 italic font-medium truncate max-w-lg">
              "{room.active_amendment.text}"
            </span>
          </div>
          <button
            onClick={() => setShowAmendmentModal(true)}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold text-xs shadow-xs"
          >
            Conclude / Vote
          </button>
        </section>
      )}

      {/* ========================================================
          MAIN BENTO GRID CONTROLLER
          Left Column (Col 1-8, ~65%): Floor Grid + Audit Log
          Right Column (Col 9-12, ~35%): Timer + Precedence Queue + Motions Tray
          ======================================================== */}
      <main className="flex-1 max-w-[1680px] w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ========================================================
            LEFT COLUMN: THE CHAMBER FLOOR & AUDIT HISTORY
            ======================================================== */}
        <section className="lg:col-span-8 space-y-5 flex flex-col">
          
          {/* Bento Card 1: Chamber Seating & Floor Grid */}
          <div className="bg-white border border-[#CBD5E1]/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-4">
            {/* Floor Grid Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-3 w-3 rounded-full bg-[#10B981] animate-pulse" />
                <div>
                  <h2 className="text-base font-serif-editorial font-bold text-slate-900 tracking-tight">
                    Chamber Seating & Floor Grid
                  </h2>
                  <p className="text-[11px] font-mono text-slate-500">
                    Tap standing senators to calculate precedence • {representatives.length} Total Senators
                  </p>
                </div>
              </div>

              {/* Mode Toggle for Floor Evaluation */}
              <div className="flex items-center bg-slate-50 border border-[#CBD5E1] rounded-xl p-0.5 font-mono text-xs self-start sm:self-auto">
                <button
                  onClick={() => setFloorMode('speech')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    floorMode === 'speech'
                      ? 'bg-white text-[#006948] shadow-xs border border-slate-200/60'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Speech Calls
                </button>
                <button
                  onClick={() => setFloorMode('question')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    floorMode === 'question'
                      ? 'bg-white text-[#006948] shadow-xs border border-slate-200/60'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Question Calls
                </button>
              </div>
            </div>

            {/* The Spatial Floor Grid Component */}
            <div className="min-h-[460px]">
              <FloorGrid
                representatives={representatives}
                standingIds={standingIds}
                onToggleStanding={handleToggleStanding}
                onClearStanding={handleClearStanding}
                onToggleActive={(rep) =>
                  chamberService.toggleRepresentativeActive(rep.id, rep.active)
                }
                onTogglePresence={handleTogglePresence}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                mode={floorMode}
              />
            </div>
          </div>

          {/* Bento Card 2: Chronological Chamber Audit Log */}
          <div className="bg-white border border-[#CBD5E1]/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#006948]" />
                <h3 className="text-sm font-serif-editorial font-bold text-slate-900">
                  Chamber Floor Audit Log
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  ({roundEvents.length} Calls Recorded)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {roundEvents.length > 5 && (
                  <button
                    onClick={() => setShowAuditLogFull(!showAuditLogFull)}
                    className="text-xs font-mono text-[#006948] hover:underline font-bold"
                  >
                    {showAuditLogFull ? 'Collapse' : 'View All'}
                  </button>
                )}
              </div>
            </div>

            {/* Audit Log Entries */}
            <div className={`space-y-1.5 font-mono text-xs ${showAuditLogFull ? 'max-h-96' : 'max-h-52'} overflow-y-auto pr-1`}>
              {roundEvents.length === 0 ? (
                <div className="py-6 text-center text-slate-400 font-mono text-xs">
                  No floor recognitions recorded yet. Recognize a speaker or questioner above.
                </div>
              ) : (
                roundEvents.slice(0, showAuditLogFull ? roundEvents.length : 6).map((e) => (
                  <div
                    key={e.id}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px] shadow-xs">
                        #{e.sequence_number}
                      </span>
                      <span className="font-bold text-slate-900">
                        {e.representative_name}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        e.event_type === 'speech_aff' || e.event_type === 'speech_author'
                          ? 'bg-emerald-100 text-[#006948]'
                          : e.event_type === 'speech_neg'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-800'
                      }`}>
                        {e.event_type.replace('speech_', '')}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      {new Date(e.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ========================================================
            RIGHT COLUMN: TIMER, PRECEDENCE QUEUE & QUICK MOTIONS TRAY
            ======================================================== */}
        <section className="lg:col-span-4 space-y-5 flex flex-col">
          
          {/* Bento Card 3: Master Speech Timer Card */}
          <div className="bg-white border border-[#CBD5E1]/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#006948]" />
                Master Chamber Clock
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#eef5f1] text-[#006948] border border-[#68dba9]/30">
                NSDA Sync
              </span>
            </div>

            {/* Embedded Synchronized Timer */}
            <ChamberTimer
              roomCode={room.code}
              roomId={room.id}
              isPO={true}
              speakerId={activeSpeaker?.id || null}
              speakerName={activeSpeaker?.name || null}
              onClearSpeaker={() =>
                chamberService.updateRoom(room.id, { current_speaker_id: null })
              }
              autoStartTrigger={timerAutoTrigger}
              onRecessChange={(isRecess) =>
                handleStatusChange(isRecess ? 'recess' : 'in_session')
              }
            />
          </div>

          {/* Bento Card 4: Recency & Precedence Queue Rankings Card */}
          <div className="bg-white border border-[#CBD5E1]/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#006948]" />
                Precedence & Recency Queue
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Mode: <strong className="text-slate-700 capitalize">{floorMode}</strong>
              </span>
            </div>

            {/* Target Winner / Highest Precedence */}
            {winner ? (
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-50 text-[#006948] border border-emerald-200/80 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Award className="w-3 h-3 text-[#006948]" />
                      Rank #1 • Award Floor
                    </span>
                    <span className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight truncate" title={winner.name}>
                      {extractLastName(winner.name)}
                    </span>
                  </div>
                  {winner.school && (
                    <span className="shrink-0 text-xs font-mono text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80">
                      {winner.school}
                    </span>
                  )}
                </div>

                <div className="text-xs font-mono text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/60 flex items-center justify-between">
                  <span>{formatPriorityReason(winner, floorMode)}</span>
                  <span className="text-slate-400 text-[11px] font-medium">{winner.speeches_count} Speeches • {winner.questions_count} Questions</span>
                </div>

                {isTie && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-mono flex items-center gap-2">
                    <span className="shrink-0">⚠️</span>
                    <span>Tied precedence with {tiedCandidates.length - 1} other standing debater(s). Resolving alphabetically.</span>
                  </div>
                )}

                {/* Instant Award Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                  <button
                    onClick={() => handleAwardAction(winner, 'speech_aff')}
                    className="py-2.5 px-3 rounded-xl font-bold bg-[#006948] hover:bg-[#005137] text-white shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-[11px]"
                  >
                    Give Aff
                  </button>
                  <button
                    onClick={() => handleAwardAction(winner, 'speech_neg')}
                    className="py-2.5 px-3 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-[11px]"
                  >
                    Give Neg
                  </button>
                  <button
                    onClick={() => handleAwardAction(winner, 'speech_author')}
                    className="py-2.5 px-3 rounded-xl font-bold bg-[#090d16] hover:bg-slate-800 text-white shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-[11px] whitespace-nowrap"
                  >
                    Author / Sponsor
                  </button>
                  <button
                    onClick={() => handleAwardAction(winner, 'question')}
                    className="py-2.5 px-3 rounded-xl font-bold bg-slate-700 hover:bg-slate-800 text-white shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-[11px]"
                  >
                    Give Question
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono text-xs text-slate-500">
                Tap 1 or more standing senators on the floor to rank them by precedence.
              </div>
            )}

            {/* Standing Queue Runner-ups (If multiple senators are standing) */}
            {standingQueue.length > 1 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                  Remaining Standing Queue ({standingQueue.length - 1})
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                  {standingQueue.slice(1).map((rep, idx) => (
                    <div
                      key={rep.id}
                      className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded bg-white border border-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                          #{idx + 2}
                        </span>
                        <span className="font-bold text-slate-800 truncate" title={rep.name}>{extractLastName(rep.name)}</span>
                        <span className="text-[10px] text-slate-400">
                          ({rep.speeches_count} sp, {rep.questions_count} q)
                        </span>
                      </div>
                      <button
                        onClick={() => handleAwardAction(rep, floorMode === 'speech' ? 'speech_aff' : 'question')}
                        className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold"
                      >
                        Recognize
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bento Card 5: Quick Floor Motions Reference Tray */}
          <div className="bg-white border border-[#CBD5E1]/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Vote className="w-4 h-4 text-[#006948]" />
                Floor Motions Tray
              </span>
              <span className="text-[10px] font-mono text-slate-400">One-Tap Action</span>
            </div>

            <div className="grid grid-cols-1 gap-2 font-mono text-xs">
              {/* Motion 1: Previous Question */}
              <div 
                onClick={handleMoveToPreviousQuestion}
                className="p-3 rounded-xl border border-slate-200 hover:border-[#006948] bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 group-hover:text-[#006948] transition-colors">
                      Previous Question
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#006948] text-white">
                      2/3 VOTE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Closes debate on current bill & auto-advances docket
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#006948] transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Motion 2: Floor Amendment */}
              <div 
                onClick={() => setShowAmendmentModal(true)}
                className="p-3 rounded-xl border border-slate-200 hover:border-[#006948] bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 group-hover:text-[#006948] transition-colors">
                      Floor Amendment
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white">
                      MAJORITY
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Submit germane amendment & isolate amendment speeches
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#006948] transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Motion 3: Recess 5m */}
              <div 
                onClick={() => handleStatusChange('recess')}
                className="p-3 rounded-xl border border-slate-200 hover:border-[#006948] bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 group-hover:text-[#006948] transition-colors">
                      Recess / Stand at Ease
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-700 text-white">
                      MAJORITY
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pause active round timer for caucus or chamber break
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#006948] transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </div>

          {/* Bento Card 6: Absolute Recency Ladder */}
          <div className="bg-white border border-[#CBD5E1]/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] space-y-3">
            <RecencyLadder
              representatives={representatives}
              standingIds={standingIds}
              currentSpeakerId={room.current_speaker_id}
              activeMode={floorMode}
              onModeChange={setFloorMode}
              onSelectRep={(rep) => handleToggleStanding(rep.id)}
            />
          </div>
        </section>
      </main>

      {/* ========================================================
          BOTTOM SHORTCUTS FOOTER
          ======================================================== */}
      <footer className="h-11 border-t border-[#CBD5E1]/80 bg-white flex items-center justify-between px-4 sm:px-6 text-[11px] font-mono text-slate-500 sticky bottom-0 z-20">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 font-bold font-mono">Esc</kbd>
            <span>Clear Standing</span>
          </span>
          <span className="hidden sm:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 font-bold font-mono">Tap</kbd>
            <span>Toggle Senator</span>
          </span>
          <span className="hidden md:flex items-center gap-1 text-slate-400">
            • Robert's Rules of Order • NSDA Parliamentary Rules
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span className="font-bold text-[#006948]">Chamber Synchronized</span>
        </div>
      </footer>
    </div>
  );
};

export default PODashboard;
