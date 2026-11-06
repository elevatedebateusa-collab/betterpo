import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  RotateCcw, 
  Lock, 
  AlertCircle 
} from 'lucide-react';
import { chamberService } from '../lib/chamberService';
import { 
  supabase, 
  isSupabaseConfigured, 
  subscribeToLocalSync 
} from '../lib/supabase';
import type { Room, Representative, Bill, RoundEvent, EventType, ChamberSettings } from '../lib/supabase';
import { resolveStandingWinner, formatPriorityReason, sortRepresentatives, getOrdinal, analyzeBillSpeeches } from '../lib/precedence';
import { ChamberTimer } from '../components/ChamberTimer';
import { FloorGrid, extractLastName } from '../components/FloorGrid';
import { RecencyLadder } from '../components/RecencyLadder';
import { RosterImportModal } from '../components/RosterImportModal';
import { DocketTracker } from '../components/DocketTracker';
import { QuorumVotingBar } from '../components/QuorumVotingBar';
import { AmendmentWorkflowModal } from '../components/AmendmentWorkflowModal';
import { ChamberSettingsModal } from '../components/ChamberSettingsModal';
import { DocketNominationModal } from '../components/DocketNominationModal';
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
  const [showDocketNominationModal, setShowDocketNominationModal] = useState<boolean>(false);
  const [showAmendmentModal, setShowAmendmentModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAuditLogFull, setShowAuditLogFull] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [timerAutoTrigger, setTimerAutoTrigger] = useState<number>(0);
  const [timerConfig, setTimerConfig] = useState<{
    mode: 'speech' | 'question' | 'dq';
    duration: number;
    questionerName?: string | null;
  }>({ mode: 'speech', duration: 190 });
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Vote Calculator & Previous Question (PQ) State
  const [showVoteModal, setShowVoteModal] = useState<boolean>(false);
  const [voteModalMotionName, setVoteModalMotionName] = useState<string>('Previous Question (Close Debate)');
  const [voteModalThreshold, setVoteModalThreshold] = useState<'one_third' | 'majority' | 'two_thirds'>('two_thirds');
  const [isPQFlow, setIsPQFlow] = useState<boolean>(false);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyCode = () => {
    const codeToCopy = room?.code || code;
    if (!codeToCopy) return;
    const url = `${window.location.origin}/room/${codeToCopy}`;
    navigator.clipboard.writeText(url).catch(() => {
      navigator.clipboard.writeText(codeToCopy);
    });
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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

  // Dynamically analyze all speeches on the active bill to determine exact Aff/Neg numbers
  const speechAnalysis = useMemo(() => {
    return analyzeBillSpeeches(roundEvents, activeBill?.id);
  }, [roundEvents, activeBill?.id]);

  // Determine next expected speech based on true counts
  const { nextSpeechDisplay } = useMemo(() => {
    if (speechAnalysis.totalSpeeches === 0) {
      return {
        nextSpeechDisplay: '1st Aff (Authorship)',
        nextSpeechSide: 'aff' as const,
        affCount: 0,
        negCount: 0,
      };
    }

    const side = speechAnalysis.nextExpectedSide;
    const num = side === 'aff' ? speechAnalysis.nextExpectedAffNumber : speechAnalysis.nextExpectedNegNumber;
    const display = `${getOrdinal(num)} ${side === 'aff' ? 'Aff' : 'Neg'}`;

    return {
      nextSpeechDisplay: display,
      nextSpeechSide: side,
      affCount: speechAnalysis.affCount,
      negCount: speechAnalysis.negCount,
    };
  }, [speechAnalysis]);

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
    const updated = [...bills, newBill];
    setBills(updated);

    const currentOrder = chamberService.getDocketOrder(room.id);
    if (!currentOrder.includes(newBill.id)) {
      chamberService.saveDocketOrder(room.id, [...currentOrder, newBill.id]);
    }

    // If there is currently no active bill on the floor, place this newly added first bill on the floor
    if (!room.active_bill_id && bills.length === 0) {
      const { room: updatedRoom } = await chamberService.setActiveBill(room, newBill);
      setRoom(updatedRoom);
      showToast(`Added ${newBill.bill_number} and placed on the floor`);
    } else {
      showToast(`Added ${newBill.bill_number}: ${newBill.title}`);
    }
  };

  const handleSetActiveBill = async (bill: Bill) => {
    if (!room) return;
    const { room: updatedRoom, bill: updatedBill } = await chamberService.setActiveBill(room, bill);
    setRoom(updatedRoom);
    setBills((prev) => prev.map((b) => (b.id === bill.id ? updatedBill : b)));
    setStandingIds(new Set());
    setTimerConfig({ mode: 'speech', duration: 190, questionerName: null });
    showToast(`Active Bill set to ${bill.bill_number} (Floor Cleared)`);
  };

  const handleReorderBills = async (reorderedBills: Bill[]) => {
    setBills(reorderedBills);
    if (!room) return;
    const billIds = reorderedBills.map((b) => b.id);
    chamberService.saveDocketOrder(room.id, billIds);
    showToast('Docket order updated');
  };

  const handleAdoptDocket = async (orderedBills: Array<{ billNumber: string; title: string; authorSchool?: string }>) => {
    if (!room) return;
    try {
      const created = await chamberService.setDocketBills(room.id, orderedBills);
      if (created.length > 0) {
        await chamberService.setActiveBill(room, created[0]);
      }
      const docketSummary = created.map((b) => b.bill_number).join(' → ');
      await chamberService.logCustomEvent(
        room.id,
        '00000000-0000-0000-0000-000000000000',
        'motion_vote',
        `Docket Order Adopted: ${docketSummary}`
      );
      const [updatedRoom, freshBills, events] = await Promise.all([
        chamberService.getRoomByCode(room.code),
        chamberService.getBills(room.id),
        chamberService.getRoundEvents(room.id, 50),
      ]);
      if (updatedRoom) setRoom(updatedRoom);
      setBills(freshBills);
      setRoundEvents(events);
      setStandingIds(new Set());
      setTimerConfig({ mode: 'speech', duration: 190, questionerName: null });
      setShowDocketNominationModal(false);
      showToast(`Round started with docket: ${docketSummary}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error adopting docket');
    }
  };

  const handleUpdateBillStatus = async (billId: string, status: Bill['status']) => {
    const updated = await chamberService.updateBill(billId, { status });
    if (updated) {
      const updatedBills = bills.map((b) => (b.id === billId ? updated : b));
      setBills(updatedBills);
      showToast(`Bill status updated to ${status.toUpperCase()}`);

      // If the concluded bill was currently on the floor and is now passed or failed, advance to next bill in docket order
      if (room && room.active_bill_id === billId && (status === 'passed' || status === 'failed')) {
        const sortedDocket = chamberService.sortBillsByDocketOrder(updatedBills, room.id);
        const nextBill = sortedDocket.find(
          (b) => b.id !== billId && b.status !== 'passed' && b.status !== 'failed' && b.status !== 'tabled'
        );

        if (nextBill) {
          const { room: updatedRoom, bill: activatedBill } = await chamberService.setActiveBill(room, nextBill);
          setRoom(updatedRoom);
          setBills((prev) => prev.map((b) => (b.id === nextBill.id ? activatedBill : b)));
          setStandingIds(new Set());
          setTimerConfig({ mode: 'speech', duration: 190, questionerName: null });
          showToast(`Advanced floor to next bill on docket: ${nextBill.bill_number}`);
        } else {
          const updatedRoom = await chamberService.updateRoom(room.id, {
            active_bill_id: null,
            current_legislation: 'Docket Complete - All Bills Concluded',
            last_speech_side: null,
            current_speaker_id: null,
            active_amendment: null,
            timer_status: 'reset',
            timer_remaining_seconds: 190,
            timer_duration: 190,
            timer_mode: 'speech',
          });
          if (updatedRoom) setRoom(updatedRoom);
          setStandingIds(new Set());
          setTimerConfig({ mode: 'speech', duration: 190, questionerName: null });
          showToast('All bills on docket completed!');
        }
      }
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
        const nextNum = eventType === 'speech_neg'
          ? speechAnalysis.nextExpectedNegNumber
          : speechAnalysis.nextExpectedAffNumber;
        const sideLabel = eventType === 'speech_neg'
          ? 'Negative'
          : eventType === 'speech_author'
          ? 'Authorship'
          : 'Affirmative';
        showToast(`Recognized ${rep.name} for ${getOrdinal(nextNum)} ${sideLabel}`);
      } else if (eventType === 'question') {
        // Every question starts a fresh 30-second CX timer automatically.
        const cxDuration = 30;

        setTimerConfig({
          mode: 'question',
          duration: cxDuration,
          questionerName: rep.name,
        });
        setTimerAutoTrigger((prev) => prev + 1);
        showToast(
          `Recognized ${rep.name} for QUESTION (30-second CX)`
        );
      } else {
        showToast(`Recognized ${rep.name} for ${eventType.replace('speech_', '').toUpperCase()}`);
      }
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
  const handleImportRoster = async (entries: Array<{ name: string; school: string; initialRecency?: number }>) => {
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

  const handleAmendmentVoteRequest = (title: string, threshold: 'one_third' | 'two_thirds' | 'majority') => {
    setVoteModalMotionName(title);
    setVoteModalThreshold(threshold);
    setIsPQFlow(false);
    setShowVoteModal(true);
  };

  // Motion Vote Logging & Previous Question Docket Progression
  const handleSaveMotionVote = async (
    title: string,
    ayes: number,
    nays: number,
    abstains: number,
    threshold: 'one_third' | 'majority' | 'two_thirds',
    passed: boolean,
    advanceNextBill?: boolean
  ) => {
    if (!room) return;
    await chamberService.logMotionVote(room.id, title, ayes, nays, abstains, threshold, passed);

    // Amendment procedure: consideration (1/3), debate, previous question
    // (2/3), then adoption by simple majority.
    if (room.active_amendment && title.includes('Amendment')) {
      if (passed && threshold === 'one_third') {
        const updated = await chamberService.setAmendmentStage(room, 'debate');
        setRoom(updated);
        showToast('Amendment is properly before the chamber; debate may begin.');
      } else if (passed && threshold === 'two_thirds') {
        const updated = await chamberService.setAmendmentStage(room, 'previous_question');
        setRoom(updated);
        showToast('Previous question passed on the amendment. Proceed to the final vote.');
      } else if (threshold === 'majority') {
        await handleConcludeAmendment(passed, `${ayes}-${nays}-${abstains}`);
      }
      const amendmentEvents = await chamberService.getRoundEvents(room.id, 50);
      setRoundEvents(amendmentEvents);
      return;
    }

    if (advanceNextBill) {
      const currentBill = activeBill || bills.find((b) => b.id === room.active_bill_id);
      if (currentBill) {
        const newStatus: Bill['status'] = passed ? 'passed' : 'failed';
        await chamberService.updateBill(currentBill.id, { status: newStatus });

        const updatedBills = bills.map((b) =>
          b.id === currentBill.id ? { ...b, status: newStatus } : b
        );
        setBills(updatedBills);

        const sortedDocket = chamberService.sortBillsByDocketOrder(updatedBills, room.id);
        const nextBill = sortedDocket.find(
          (b) => b.id !== currentBill.id && b.status !== 'passed' && b.status !== 'failed' && b.status !== 'tabled'
        );

        if (nextBill) {
          const { room: updatedRoom, bill: activatedBill } = await chamberService.setActiveBill(room, nextBill);
          setRoom(updatedRoom);
          setBills((prev) =>
            prev.map((b) => (b.id === nextBill.id ? activatedBill : b))
          );
          setStandingIds(new Set());
          setTimerConfig({ mode: 'speech', duration: 190, questionerName: null });
          showToast(`Vote recorded (${passed ? 'PASSED' : 'VOTED DOWN'}). Concluded ${currentBill.bill_number} and advanced to ${nextBill.bill_number}!`);
        } else {
          const updatedRoom = await chamberService.updateRoom(room.id, {
            active_bill_id: null,
            current_legislation: 'Docket Complete - All Bills Concluded',
            last_speech_side: null,
            current_speaker_id: null,
            active_amendment: null,
            timer_status: 'reset',
            timer_remaining_seconds: 190,
            timer_duration: 190,
            timer_mode: 'speech',
          });
          if (updatedRoom) setRoom(updatedRoom);
          setStandingIds(new Set());
          setTimerConfig({ mode: 'speech', duration: 190, questionerName: null });
          showToast(`Vote recorded (${passed ? 'PASSED' : 'VOTED DOWN'}). All bills on docket completed!`);
        }
      } else {
        const sortedDocket = chamberService.sortBillsByDocketOrder(bills, room.id);
        const nextBill = sortedDocket.find(
          (b) => b.status !== 'passed' && b.status !== 'failed' && b.status !== 'tabled'
        );
        if (nextBill) {
          const { room: updatedRoom, bill: activatedBill } = await chamberService.setActiveBill(room, nextBill);
          setRoom(updatedRoom);
          setBills((prev) =>
            prev.map((b) => (b.id === nextBill.id ? activatedBill : b))
          );
          setStandingIds(new Set());
          setTimerConfig({ mode: 'speech', duration: 190, questionerName: null });
          showToast(`Advanced floor to ${nextBill.bill_number}!`);
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

  // Loading Screen
  if (loading) {
    return <BetterPOLoader isReady={false} standalone={true} />;
  }

  // Error Screen
  if (error || !room) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded p-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-zinc-950 mb-2">Chamber Not Found</h2>
          <p className="text-xs font-mono text-zinc-500 mb-6">{error || 'This chamber does not exist.'}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full h-9 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-mono font-medium text-xs transition-colors"
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
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded p-6">
          <div className="text-center mb-6">
            <div className="w-10 h-10 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 mx-auto flex items-center justify-center mb-3">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-zinc-950 mb-1">Presiding Officer Passcode</h2>
            <p className="text-xs font-mono text-zinc-500">
              Enter passcode for <span className="font-semibold text-zinc-800">{room.name}</span> ({room.code})
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs text-center">
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
              className="w-full bg-white border border-zinc-200 rounded px-3 py-2 text-sm text-center text-zinc-900 placeholder-zinc-400 font-mono focus:outline-none focus:border-zinc-400"
            />
            <button
              type="submit"
              className="w-full h-9 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-mono font-medium text-xs transition-colors"
            >
              Unlock PO Controls
            </button>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => navigate(`/room/${room.code}`)}
                className="text-xs font-mono text-zinc-500 hover:text-zinc-900 underline"
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
    <div className="min-h-screen bg-white text-zinc-950 flex flex-col font-sans selection:bg-zinc-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white font-mono text-xs px-3 py-2 rounded border border-zinc-700 flex items-center gap-2">
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
        onReorderBills={handleReorderBills}
      />

      {/* Docket Nomination & Voting Modal */}
      {room && (
        <DocketNominationModal
          isOpen={showDocketNominationModal}
          onClose={() => setShowDocketNominationModal(false)}
          room={room}
          representatives={representatives}
          onAdoptDocket={handleAdoptDocket}
        />
      )}

      {/* Amendment Workflow Modal */}
      <AmendmentWorkflowModal
        isOpen={showAmendmentModal}
        onClose={() => setShowAmendmentModal(false)}
        room={room}
        bills={bills}
        representatives={representatives}
        onStartAmendment={handleStartAmendment}
        onConcludeAmendment={handleConcludeAmendment}
        onRequestVote={handleAmendmentVoteRequest}
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
          TOP NAVIGATION BAR (ROW 1)
          ======================================================== */}
      <header className="h-11 px-4 bg-white border-b border-zinc-200 flex items-center justify-between sticky top-0 z-30 font-sans">
        {/* Left: Solid BETTERPO logo + compact monospace room code badge */}
        <div className="flex items-center gap-3">
          <div 
            onClick={() => navigate('/')}
            className="flex items-center cursor-pointer group"
          >
            <span className="font-mono text-sm uppercase font-semibold text-zinc-950 tracking-tight group-hover:opacity-80 transition-opacity">
              betterpo
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="px-2 py-0.5 text-xs font-mono bg-zinc-100 border border-zinc-200 rounded text-zinc-700 flex items-center gap-1.5 tabular-nums transition-colors hover:bg-zinc-200/60 cursor-pointer"
            title="Click to copy room link"
          >
            <span className="text-zinc-400">Code:</span>
            <span className="font-semibold text-zinc-900 uppercase">{room?.code || code}</span>
            {copiedCode && <span className="text-[10px] text-zinc-900 font-bold">Copied!</span>}
          </button>
        </div>

        {/* Right: Compact utility buttons */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button
            onClick={() => setShowDocketModal(true)}
            className="h-7 px-2.5 text-xs font-medium rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors"
            title="Manage Chamber Docket"
          >
            Docket ({bills.length})
          </button>

          <button
            onClick={() => setShowRosterModal(true)}
            className="h-7 px-2.5 text-xs font-medium rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors"
            title="Add Debaters to Roster"
          >
            Add Debaters
          </button>

          <button
            onClick={() => {
              setVoteModalMotionName('');
              setVoteModalThreshold('majority');
              setIsPQFlow(false);
              setShowVoteModal(true);
            }}
            className="h-7 px-2.5 text-xs font-medium rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors"
            title="Vote on Floor Motion"
          >
            Motion
          </button>

          <button
            onClick={() => setShowAmendmentModal(true)}
            className={`h-7 px-2.5 text-xs font-medium rounded border transition-colors ${
              room.active_amendment
                ? 'border-amber-300 bg-amber-50 text-amber-900 font-semibold'
                : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
            }`}
            title="Floor Amendment Workflow"
          >
            Amendment
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="h-7 px-2.5 text-xs font-medium rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors"
            title="Settings & Rules"
          >
            Settings
          </button>

          <button
            onClick={() => chamberService.exportSessionCSV(room, representatives, roundEvents, bills)}
            className="h-7 px-2.5 text-xs font-medium rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors"
            title="Export CSV"
          >
            Export
          </button>
        </div>
      </header>

      {/* ========================================================
          CONSOLIDATED CONTEXT BAR (ROW 2)
          ======================================================== */}
      <section className="h-10 px-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs font-sans">
        {/* Left side: General Orders / Open Floor, a / divider, Next Speech */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-zinc-900 truncate max-w-xs sm:max-w-md">
            {activeBill ? `${activeBill.bill_number}: ${activeBill.title}` : room.current_legislation || 'General Orders / Open Floor'}
          </span>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-500 font-mono text-xs">Next Speech:</span>
          <span className="px-1.5 py-0.5 rounded border border-zinc-300 bg-white text-zinc-800 font-medium font-mono text-[11px] tabular-nums shrink-0">
            {nextSpeechDisplay}
          </span>
        </div>

        {/* Right side: Inline docket status text + CTA button (when docket open) */}
        {bills.length === 0 ? (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-zinc-500 hidden sm:inline">Chamber docket is currently open for nominations.</span>
            <button
              onClick={() => setShowDocketNominationModal(true)}
              className="h-7 px-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-colors"
            >
              Open the floor for docket nomination
            </button>
          </div>
        ) : null}
      </section>

      {/* ACTIVE AMENDMENT BAR (IF APPLICABLE) */}
      {room.active_amendment && (
        <section className="h-9 px-4 bg-amber-50/80 border-b border-amber-200 flex items-center justify-between text-xs font-sans">
          <div className="flex items-center gap-2 truncate">
            <span className="px-1.5 py-0.2 rounded border border-amber-300 bg-amber-100 text-amber-900 font-mono text-[10px] font-semibold uppercase">
              Amendment Pending
            </span>
            <span className="font-semibold text-amber-950 font-mono">
              Senator {room.active_amendment.author_name}
            </span>
            <span className="text-amber-800 truncate italic">
              "{room.active_amendment.text}"
            </span>
          </div>
          <button
            onClick={() => setShowAmendmentModal(true)}
            className="h-6 px-2 text-xs rounded bg-amber-700 hover:bg-amber-800 text-white font-medium transition-colors shrink-0"
          >
            Conclude / Vote
          </button>
        </section>
      )}

      {/* ========================================================
          EDGE-TO-EDGE SPLIT WORKSPACE
          ======================================================== */}
      <main className="grid grid-cols-1 lg:grid-cols-[1fr_380px] divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 bg-white min-h-[calc(100vh-5.25rem)]">
        
        {/* ========================================================
            LEFT PANE: CHAMBER FLOOR & AUDIT HISTORY
            ======================================================== */}
        <section className="flex flex-col min-w-0">
          {/* Chamber Header & Floor Grid Mode */}
          <div className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between gap-3 bg-zinc-50/50">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-xs font-semibold text-zinc-900 truncate">
                {room.name}
              </h2>
              <span className="text-xs font-mono text-zinc-400 tabular-nums">
                • {representatives.length} Senators
              </span>
            </div>

            {/* Segmented Toggles: Speech Calls / Question Calls */}
            <div className="bg-zinc-100 p-0.5 rounded border border-zinc-200 text-xs inline-flex shrink-0">
              <button
                type="button"
                onClick={() => setFloorMode('speech')}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  floorMode === 'speech'
                    ? 'bg-white text-zinc-900 rounded-sm font-medium'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Speech Calls
              </button>
              <button
                type="button"
                onClick={() => setFloorMode('question')}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  floorMode === 'question'
                    ? 'bg-white text-zinc-900 rounded-sm font-medium'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Question Calls
              </button>
            </div>
          </div>

          {/* Spatial Floor Grid */}
          <div className="flex-1 min-h-[460px]">
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
              roomId={room.id}
            />
          </div>

          {/* Chronological Chamber Audit Log */}
          <div className="border-t border-zinc-200 bg-white">
            <div className="px-4 py-2 bg-zinc-50/50 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-zinc-900">
                  Chamber Floor Audit Log
                </h3>
                <span className="text-xs font-mono tabular-nums text-zinc-400">
                  ({roundEvents.length} Calls Recorded)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndo}
                  disabled={roundEvents.length === 0}
                  className="h-6 px-2 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-30 text-zinc-700 font-mono text-xs font-medium transition-colors flex items-center gap-1"
                  title="Undo most recent call"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo Last</span>
                </button>
                {roundEvents.length > 5 && (
                  <button
                    onClick={() => setShowAuditLogFull(!showAuditLogFull)}
                    className="text-xs font-mono text-zinc-600 hover:text-zinc-900 font-medium"
                  >
                    {showAuditLogFull ? 'Collapse' : 'View All'}
                  </button>
                )}
              </div>
            </div>

            <div className={`divide-y divide-zinc-100 font-mono text-xs ${showAuditLogFull ? 'max-h-96' : 'max-h-52'} overflow-y-auto`}>
              {roundEvents.length === 0 ? (
                <div className="py-4 text-center text-zinc-400 font-mono text-xs">
                  No floor recognitions recorded yet.
                </div>
              ) : (
                roundEvents.slice(0, showAuditLogFull ? roundEvents.length : 6).map((e) => (
                  <div
                    key={e.id}
                    className="px-4 py-2 flex items-center justify-between hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-[10px] tabular-nums">
                        #{e.sequence_number}
                      </span>
                      <span className="font-semibold text-zinc-900">
                        {e.representative_name}
                      </span>
                      <span className="text-zinc-300">•</span>
                      <span className="px-1.5 py-0.2 rounded border border-zinc-200 bg-zinc-100 text-zinc-800 text-[10px] font-medium uppercase tracking-wider">
                        {(() => {
                          const speechInfo = speechAnalysis.speeches.find((s) => s.eventId === e.id);
                          if (speechInfo) return speechInfo.label;
                          if (e.event_type === 'question') return 'Question';
                          return e.event_type.replace('speech_', '');
                        })()}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-400 tabular-nums">
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
            RIGHT SIDEBAR: STACKED HAIRLINE SECTIONS (Section A, B, C)
            ======================================================== */}
        <aside className="w-full lg:w-[380px] flex flex-col divide-y divide-zinc-200 bg-white min-w-0">
          
          {/* Section A: Timer (p-4) */}
          <div className="p-4">
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
              autoStartConfig={timerConfig}
              questionerName={timerConfig.mode === 'question' ? timerConfig.questionerName : null}
              onRecessChange={(isRecess) =>
                handleStatusChange(isRecess ? 'recess' : 'in_session')
              }
            />
          </div>

          {/* Section B: Precedence & Recency Queue (p-4) */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                Precedence & Recency Queue
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Mode: <strong className="text-zinc-700 capitalize font-medium">{floorMode}</strong>
              </span>
            </div>

            {winner ? (
              <div className="p-3 rounded border border-zinc-200 bg-zinc-50/50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-base text-zinc-950 truncate" title={winner.name}>
                    {extractLastName(winner.name)}
                  </span>
                  {winner.school && (
                    <span className="text-xs font-mono text-zinc-500 bg-white px-2 py-0.5 rounded border border-zinc-200">
                      {winner.school}
                    </span>
                  )}
                </div>

                <div className="text-xs font-mono text-zinc-600 bg-white p-2 rounded border border-zinc-200 flex items-center justify-between">
                  <span>{formatPriorityReason(winner, floorMode)}</span>
                  <span className="text-zinc-400 text-[11px] tabular-nums font-medium">
                    {winner.speeches_count} Speeches • {winner.questions_count} Questions
                  </span>
                </div>

                {isTie && (
                  <div className="p-2 rounded border border-amber-300 bg-amber-50 text-amber-900 text-xs font-mono">
                    Tied precedence with {tiedCandidates.length - 1} other standing debater(s). Resolving alphabetically.
                  </div>
                )}

                {/* Instant Award Action Buttons */}
                {floorMode === 'question' ? (
                  <div className="space-y-1.5 pt-0.5 font-mono text-xs">
                    <button
                      onClick={() => handleAwardAction(winner, 'question')}
                      className="w-full h-8 px-3 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs uppercase transition-colors"
                    >
                      Give Question (30s CX)
                    </button>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => handleAwardAction(winner, 'speech_aff')}
                        className="h-7 px-2 rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors text-[10px] uppercase font-medium"
                      >
                        {getOrdinal(speechAnalysis.nextExpectedAffNumber)} Aff
                      </button>
                      <button
                        onClick={() => handleAwardAction(winner, 'speech_neg')}
                        className="h-7 px-2 rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors text-[10px] uppercase font-medium"
                      >
                        {getOrdinal(speechAnalysis.nextExpectedNegNumber)} Neg
                      </button>
                      <button
                        onClick={() => handleAwardAction(winner, 'speech_author')}
                        className="h-7 px-2 rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors text-[10px] uppercase font-medium"
                      >
                        Author
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5 font-mono text-xs">
                    <button
                      onClick={() => handleAwardAction(winner, 'speech_aff')}
                      className="h-8 px-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition-colors text-[11px] uppercase"
                    >
                      Give {getOrdinal(speechAnalysis.nextExpectedAffNumber)} Aff
                    </button>
                    <button
                      onClick={() => handleAwardAction(winner, 'speech_neg')}
                      className="h-8 px-2.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition-colors text-[11px] uppercase"
                    >
                      Give {getOrdinal(speechAnalysis.nextExpectedNegNumber)} Neg
                    </button>
                    <button
                      onClick={() => handleAwardAction(winner, 'speech_author')}
                      className="h-8 px-2.5 rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-medium transition-colors text-[11px] uppercase whitespace-nowrap"
                    >
                      Author / Sponsor
                    </button>
                    <button
                      onClick={() => handleAwardAction(winner, 'question')}
                      className="h-8 px-2.5 rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-medium transition-colors text-[11px] uppercase"
                    >
                      Give Question (30s)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 py-2">No senators standing.</p>
            )}

            {/* Standing Queue Runner-ups */}
            {standingQueue.length > 1 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-mono text-zinc-400 uppercase font-medium tracking-wider">
                  Remaining Standing Queue ({standingQueue.length - 1})
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                  {standingQueue.slice(1).map((rep, idx) => (
                    <div
                      key={rep.id}
                      className="p-1.5 rounded border border-zinc-200 bg-zinc-50/50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded bg-white border border-zinc-200 text-zinc-600 font-bold text-[10px] flex items-center justify-center tabular-nums">
                          #{idx + 2}
                        </span>
                        <span className="font-semibold text-zinc-800 truncate" title={rep.name}>{extractLastName(rep.name)}</span>
                        <span className="text-[10px] text-zinc-400 tabular-nums">
                          ({rep.speeches_count} sp, {rep.questions_count} q)
                        </span>
                      </div>
                      <button
                        onClick={() => handleAwardAction(rep, floorMode === 'speech' ? 'speech_aff' : 'question')}
                        className="h-6 px-2 rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-[11px] font-medium transition-colors"
                      >
                        Recognize
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section C: Recency Ladder (p-4 flex-1) */}
          <div className="p-4 flex-1 min-h-0 flex flex-col">
            <RecencyLadder
              representatives={representatives}
              standingIds={standingIds}
              currentSpeakerId={room.current_speaker_id}
              activeMode={floorMode}
              onModeChange={setFloorMode}
              onSelectRep={(rep) => handleToggleStanding(rep.id)}
            />
          </div>
        </aside>
      </main>
    </div>
  );
};

export default PODashboard;
