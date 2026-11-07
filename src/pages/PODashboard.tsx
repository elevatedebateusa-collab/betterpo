import { SelectionGroup } from '@/components/ui/selection-group';
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
    autoStart?: boolean;
  }>({ mode: 'speech', duration: 190, autoStart: false });
  const [currentTimerSeconds, setCurrentTimerSeconds] = useState<number>(190);
  const [currentTimerMode, setCurrentTimerMode] = useState<string>('speech');
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

  // Active questioner resolution (the senator currently questioning the speaker on the floor)
  const activeQuestioner = useMemo(() => {
    const isQuestionMode = currentTimerMode === 'question' || timerConfig.mode === 'question';
    const qName = timerConfig.questionerName;
    if (qName && isQuestionMode) {
      const found = representatives.find(
        (r) => r.name === qName || extractLastName(r.name) === extractLastName(qName)
      );
      if (found) return found;
      return {
        id: 'q_active',
        room_id: room?.id || '',
        name: qName,
        school: '',
        speeches_count: 0,
        questions_count: 0,
        last_speech_order: 0,
        last_question_order: 0,
        active: true,
        is_present: true,
        created_at: '',
      } as Representative;
    }

    if (activeSpeaker && isQuestionMode && roundEvents.length > 0 && roundEvents[0].event_type === 'question') {
      const found = representatives.find((r) => r.id === roundEvents[0].representative_id);
      if (found) return found;
    }

    return null;
  }, [timerConfig, currentTimerMode, representatives, roundEvents, activeSpeaker, room]);

  // Dynamically analyze all speeches on the active bill to determine exact Aff/Neg numbers
  const speechAnalysis = useMemo(() => {
    return analyzeBillSpeeches(roundEvents, activeBill?.id);
  }, [roundEvents, activeBill?.id]);

  // Active speech label on active bill (e.g. "Speech #1: Authorship (Affirmative)")
  const currentSpeechText = useMemo(() => {
    if (!activeSpeaker) return null;
    if (speechAnalysis.speeches.length > 0) {
      const speakerSpeech = [...speechAnalysis.speeches].reverse().find(
        (s) => s.representativeId === activeSpeaker.id
      );
      if (speakerSpeech) return speakerSpeech.fullLabel;
      return speechAnalysis.speeches[speechAnalysis.speeches.length - 1].fullLabel;
    }
    return 'Speech #1: Authorship (Affirmative)';
  }, [activeSpeaker, speechAnalysis]);

  const formatTimerClock = (totalSecs: number) => {
    const isNegative = totalSecs < 0;
    const absSecs = Math.abs(totalSecs);
    const m = Math.floor(absSecs / 60);
    const s = absSecs % 60;
    const prefix = isNegative ? '-' : '';
    return `${prefix}${m}:${s.toString().padStart(2, '0')}`;
  };

  // Determine next expected speech based on true counts
  const { nextSpeechDisplay, nextSpeechSide } = useMemo(() => {
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

  const handleClearSpeaker = async () => {
    if (!room) return;
    setRoom((prev) => prev ? { ...prev, current_speaker_id: null } : prev);
    await chamberService.updateRoom(room.id, { current_speaker_id: null });
    showToast('Floor yielded / speaker cleared');
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
      const docketSummary = created.map((b) => b.title || b.bill_number).join(' → ');
      try {
        await chamberService.logCustomEvent(
          room.id,
          '00000000-0000-0000-0000-000000000000',
          'motion_vote',
          `Docket Order Adopted: ${docketSummary}`
        );
      } catch {
        // silent logging fallback
      }
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
      console.warn('Docket adoption error:', err);
      setShowDocketNominationModal(false);
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

        setTimerConfig({
          mode: 'speech',
          duration: 190,
          questionerName: null,
          autoStart: false,
        });
        setTimerAutoTrigger((prev) => prev + 1);
      } else if (eventType === 'question') {
        // Every question starts a fresh 30-second CX timer immediately
        const cxDuration = 30;

        setTimerConfig({
          mode: 'question',
          duration: cxDuration,
          questionerName: rep.name,
          autoStart: true,
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
      showToast('Settings saved');
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
        <div className="max-w-md w-full bg-white border border-[#CBD5E1] rounded-2xl p-6 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-po-ui font-bold text-[#0A1128] mb-2">Chamber Not Found</h2>
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
            <h2 className="text-2xl font-po-ui font-bold text-[#0A1128] mb-1">Presiding Officer Passcode</h2>
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
        onOpenNominationModal={() => {
          setShowDocketModal(false);
          setShowDocketNominationModal(true);
        }}
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
          TOP NAVIGATION BAR
          ======================================================== */}
      <header className="border-b border-slate-200/60 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 h-14 flex items-center justify-between gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        {/* Left: Brand & Chamber Code */}
        <div className="flex items-center gap-3">
          <div 
            onClick={() => navigate('/')}
            className="flex items-center cursor-pointer group"
          >
            <span className="font-po-ui font-bold text-[17px] tracking-tight lowercase text-slate-900 group-hover:opacity-80 transition-opacity select-none">
              better<span className="font-extrabold text-emerald-500" style={{ color: '#10b981' }}>po</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-mono transition-colors cursor-pointer"
            title="Click to copy room link"
          >
            <span className="text-slate-400 font-medium">Code:</span>
            <span className="font-bold text-slate-900 tracking-wider uppercase">{room?.code || code}</span>
            {copiedCode && <span className="text-[10px] text-[#006948] font-bold">Copied!</span>}
          </button>
        </div>

        {/* Right: Exactly Requested Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-xs">
          <button
            onClick={() => setShowDocketModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
            title="Manage Chamber Docket"
          >
            <span>Docket ({bills.length})</span>
          </button>

          <button
            onClick={() => setShowRosterModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
            title="Add Debaters to Roster"
          >
            <span>Add Debaters</span>
          </button>

          {/* Move to Previous Question Button */}
          <button
            onClick={() => {
              setVoteModalMotionName('Previous Question (Close Debate)');
              setVoteModalThreshold('two_thirds');
              setIsPQFlow(true);
              setShowVoteModal(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            title="Move to Previous Question (Close Debate & Vote on Legislation)"
          >
            <span>Move to Previous Question</span>
          </button>

          <button
            onClick={() => setShowAmendmentModal(true)}
            className={`px-3.5 py-1.5 rounded-xl border transition-colors ${
              room.active_amendment
                ? 'bg-amber-50 text-amber-900 border-amber-400 font-bold'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="Floor Amendment Workflow"
          >
            <span>Amendment</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
            title="Settings & Rules"
          >
            <span>Settings</span>
          </button>

          <button
            onClick={() => chamberService.exportSessionCSV(room, representatives, roundEvents, bills)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
            title="Export CSV"
          >
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* ========================================================
          ACTIVE BILL HEADLINE & NEXT SPEECH TRACKER
          ======================================================== */}
      <section className="bg-white border-b border-slate-200/60 px-4 sm:px-6 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <h1 className="text-lg sm:text-xl font-bold font-po-ui text-slate-900 tracking-tight">
            {activeBill
              ? (activeBill.title || activeBill.bill_number)
              : (room.current_legislation
                  ? room.current_legislation.replace(/^(bill\s*\d+|res\s*\d+)[:.-]?\s*/i, '')
                  : 'General Orders / Open Floor')}
          </h1>

          <div className="flex items-center gap-1.5 pl-3 sm:pl-4 border-l border-slate-200">
            <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
              Next Speech:
            </span>
            <span className={`text-xs font-mono font-bold ${
              nextSpeechSide === 'aff' ? 'text-[#006948]' : 'text-rose-700'
            }`}>
              {nextSpeechDisplay}
            </span>
          </div>
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
          DOCKET NOMINATION REMINDER BANNER
          Reminds the PO to open the floor for docket nominations
          before beginning debate when no docket has been adopted yet.
          ======================================================== */}
      {bills.length === 0 && (
        <section className="bg-emerald-50/70 border-b border-emerald-200/80 px-4 sm:px-6 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] animate-fade-in">
          <div className="max-w-[1680px] mx-auto flex items-center justify-between gap-4">
            <span className="font-po-ui font-semibold text-sm sm:text-base text-slate-900">
              Open the floor for docket nominations
            </span>

            <button
              type="button"
              onClick={() => setShowDocketNominationModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-mono font-bold text-xs shadow-xs transition-all active:scale-[0.98] cursor-pointer shrink-0"
            >
              <span>Start Docket Nominations</span>
            </button>
          </div>
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
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            {/* Floor Grid Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-po-ui font-bold text-slate-900 tracking-tight">
                  {room.name}
                </h2>
                <p className="text-[11px] font-mono text-slate-500">
                  Tap standing senators to calculate precedence • {representatives.length} Total Senators
                </p>
              </div>

              {/* Mode Toggle for Floor Evaluation */}
              <SelectionGroup
                aria-label="Floor recognition mode" value={floorMode} onValueChange={setFloorMode}
                className="self-start sm:self-auto"
                options={[{ value: 'speech', label: 'Speech Calls' }, { value: 'question', label: 'Question Calls' }]}
              />
            </div>

            {/* The Spatial Floor Grid Component */}
            <div className="min-h-[460px]">
              <FloorGrid
                representatives={representatives}
                standingIds={standingIds}
                currentSpeakerId={room.current_speaker_id}
                onToggleStanding={handleToggleStanding}
                onClearStanding={handleClearStanding}
                onToggleActive={(rep) =>
                  chamberService.toggleRepresentativeActive(rep.id, rep.active !== false)
                }
                onTogglePresence={handleTogglePresence}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                mode={floorMode}
                roomId={room.id}
              />
            </div>
          </div>

          {/* Bento Card 2: Chronological Chamber Audit Log */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-po-ui font-bold text-slate-900">
                  Chamber Floor Audit Log
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  ({roundEvents.length} Calls Recorded)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndo}
                  disabled={roundEvents.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-30 text-rose-700 border border-rose-200 font-mono text-xs font-semibold transition-colors"
                  title="Undo most recent call"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo Last</span>
                </button>
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
                    className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px] shadow-xs">
                        #{e.sequence_number}
                      </span>
                      <span className="font-bold text-slate-900">
                        {e.representative_name}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        e.event_type === 'speech_aff' || e.event_type === 'speech_author'
                          ? 'text-[#006948]'
                          : e.event_type === 'speech_neg'
                          ? 'text-rose-700'
                          : 'text-slate-700'
                      }`}>
                        {(() => {
                          const speechInfo = speechAnalysis.speeches.find((s) => s.eventId === e.id);
                          if (speechInfo) return speechInfo.label;
                          if (e.event_type === 'question') return 'Question';
                          return e.event_type.replace('speech_', '');
                        })()}
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
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            {/* Embedded Synchronized Timer */}
            <ChamberTimer
              roomCode={room.code}
              roomId={room.id}
              isPO={true}
              floorMode={floorMode}
              speakerId={activeSpeaker?.id || null}
              speakerName={activeSpeaker?.name || null}
              onClearSpeaker={handleClearSpeaker}
              autoStartTrigger={timerAutoTrigger}
              autoStartConfig={timerConfig}
              questionerName={timerConfig.mode === 'question' ? timerConfig.questionerName : null}
              onRecessChange={(isRecess) =>
                handleStatusChange(isRecess ? 'recess' : 'in_session')
              }
              onTimerTick={(secs, mode) => {
                setCurrentTimerSeconds(secs);
                setCurrentTimerMode(mode);
              }}
            />
          </div>

          {/* Bento Card 4: Speaker Card (when speaking) OR Precedence Queue (when idle) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            {activeSpeaker ? (
              <div className="space-y-3">
                {/* Speaker Card: Matches user screenshot */}
                <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center min-h-[88px] space-y-1 shadow-xs">
                  <h4 className="font-bold text-slate-900 text-lg sm:text-xl leading-snug">
                    {activeSpeaker.name.startsWith('Senator') ? activeSpeaker.name : `Senator ${activeSpeaker.name}`}
                  </h4>
                  {currentSpeechText && (
                    <p className="font-mono text-xs sm:text-sm font-semibold text-emerald-800">
                      {currentSpeechText}
                    </p>
                  )}
                  {/* Plain text count: NOT in a box */}
                  <div className="text-xs font-mono text-slate-400 pt-0.5">
                    {activeSpeaker.speeches_count} sp • {activeSpeaker.questions_count} q
                    {activeSpeaker.school && ` • ${activeSpeaker.school}`}
                  </div>
                </div>

                {/* If they are getting questioned, questioner card appears directly beneath (matches user screenshot) */}
                {activeQuestioner && (
                  <div className="animate-fade-in p-3.5 sm:p-4 rounded-xl bg-sky-50/95 border-2 border-sky-300 text-slate-900 shadow-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-800 mb-0.5">
                        Being Questioned By
                      </div>
                      <div className="font-bold text-base sm:text-lg text-slate-900 truncate">
                        {activeQuestioner.name.startsWith('Senator') ? activeQuestioner.name : `Senator ${activeQuestioner.name}`}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-700">
                        Question Time
                      </div>
                      <div className="font-mono font-black text-xl sm:text-2xl text-sky-950 tracking-tight leading-none mt-0.5">
                        {formatTimerClock(currentTimerSeconds)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Standing candidate if senators stand while speaker is on floor (e.g. for CX) */}
                {winner && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                      <span>Standing in Chamber</span>
                      <span className="text-slate-700 font-semibold">{extractLastName(winner.name)}</span>
                    </div>

                    {floorMode === 'question' ? (
                      <button
                        onClick={() => handleAwardAction(winner, 'question')}
                        className="w-full py-2.5 px-4 rounded-xl font-bold bg-[#006948] hover:bg-[#005137] text-white shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-xs font-mono"
                      >
                        Give Question (30s CX)
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-0.5 font-mono text-xs">
                        <button
                          onClick={() => handleAwardAction(winner, 'speech_aff')}
                          className="py-2.5 px-3 rounded-xl font-bold bg-emerald-50 hover:bg-emerald-100 text-[#006948] border border-emerald-300/80 shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-[11px]"
                        >
                          Give {getOrdinal(speechAnalysis.nextExpectedAffNumber)} Aff
                        </button>
                        <button
                          onClick={() => handleAwardAction(winner, 'speech_neg')}
                          className="py-2.5 px-3 rounded-xl font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300/80 shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-[11px]"
                        >
                          Give {getOrdinal(speechAnalysis.nextExpectedNegNumber)} Neg
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider">
                    Precedence & Recency Queue
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Mode: <strong className="text-slate-700 capitalize">{floorMode}</strong>
                  </span>
                </div>

                {/* Target Winner / Highest Precedence */}
                {winner ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/60 shadow-xs space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight truncate" title={winner.name}>
                          {extractLastName(winner.name)}
                        </span>
                      </div>
                      {winner.school && (
                        <span className="shrink-0 text-xs font-mono text-slate-500 font-medium">
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
                    {floorMode === 'question' ? (
                      <div className="space-y-2 pt-1 font-mono text-xs">
                        <button
                          onClick={() => handleAwardAction(winner, 'question')}
                          className="w-full py-2.5 px-4 rounded-xl font-bold bg-[#006948] hover:bg-[#005137] text-white shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-xs"
                        >
                          Give Question (30s CX)
                        </button>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleAwardAction(winner, 'speech_aff')}
                            className="py-2 px-2 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all text-[10px] uppercase"
                          >
                            {getOrdinal(speechAnalysis.nextExpectedAffNumber)} Aff
                          </button>
                          <button
                            onClick={() => handleAwardAction(winner, 'speech_neg')}
                            className="py-2 px-2 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all text-[10px] uppercase"
                          >
                            {getOrdinal(speechAnalysis.nextExpectedNegNumber)} Neg
                          </button>
                          <button
                            onClick={() => handleAwardAction(winner, 'speech_author')}
                            className="py-2 px-2 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all text-[10px] uppercase"
                          >
                            Author
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                        <button
                          onClick={() => handleAwardAction(winner, 'speech_aff')}
                          className="py-2.5 px-3 rounded-xl font-bold bg-emerald-50 hover:bg-emerald-100 text-[#006948] border border-emerald-300/80 shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-[11px]"
                        >
                          Give {getOrdinal(speechAnalysis.nextExpectedAffNumber)} Aff
                        </button>
                        <button
                          onClick={() => handleAwardAction(winner, 'speech_neg')}
                          className="py-2.5 px-3 rounded-xl font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300/80 shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-[11px]"
                        >
                          Give {getOrdinal(speechAnalysis.nextExpectedNegNumber)} Neg
                        </button>
                        <button
                          onClick={() => handleAwardAction(winner, 'speech_author')}
                          className="py-2.5 px-3 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-[11px] whitespace-nowrap"
                        >
                          Author / Sponsor
                        </button>
                        <button
                          onClick={() => handleAwardAction(winner, 'question')}
                          className="py-2.5 px-3 rounded-xl font-bold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300/80 shadow-xs transition-all active:scale-[0.98] flex items-center justify-center uppercase tracking-wider text-[11px]"
                        >
                          Give Question (30s)
                        </button>
                      </div>
                    )}
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
              </>
            )}
          </div>

          {/* Bento Card: Absolute Recency Ladder */}
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
    </div>
  );
};

export default PODashboard;
