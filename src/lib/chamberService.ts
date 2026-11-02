import { 
  supabase, 
  isSupabaseConfigured, 
  getStoredRooms, 
  saveStoredRooms, 
  getStoredReps, 
  saveStoredReps, 
  getStoredBills,
  saveStoredBills,
  getStoredEvents, 
  saveStoredEvents,
  DEFAULT_CHAMBER_SETTINGS
} from './supabase';
import type { 
  Room, 
  Representative, 
  Bill, 
  RoundEvent, 
  EventType, 
  ChamberSettings,
  AmendmentState,
  TimerStatus,
  TimerMode,
  PlatformMetrics 
} from './supabase';
import { sortRepresentatives } from './precedence';

export const chamberService = {
  // Create Room & Initial Roster
  async createRoom(
    name: string,
    code: string,
    poPasscode: string,
    rosterEntries: Array<{ name: string; school: string; initialRecency?: number }>
  ): Promise<{ room: Room; representatives: Representative[] }> {
    const cleanCode = code.trim().toUpperCase();

    if (isSupabaseConfigured && supabase) {
      // 1. Insert room with sequence offset matching roster count
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          code: cleanCode,
          name: name.trim(),
          po_passcode: poPasscode.trim(),
          status: 'in_session',
          current_legislation: '',
          current_speaker_id: null,
          active_bill_id: null,
          last_speech_side: null,
          recess_end_time: null,
          settings: DEFAULT_CHAMBER_SETTINGS,
          active_amendment: null,
          global_speech_sequence: rosterEntries.length,
          global_question_sequence: rosterEntries.length,
        })
        .select()
        .single();

      if (roomError || !roomData) {
        throw new Error(roomError?.message || 'Failed to create room in database');
      }

      // 2. Insert initial representatives with accurate starting recency orders
      const repsToInsert = rosterEntries.map((entry, index) => {
        const recencyNum = entry.initialRecency !== undefined && !isNaN(entry.initialRecency)
          ? entry.initialRecency
          : index + 1;
        return {
          room_id: roomData.id,
          name: entry.name.trim(),
          school: entry.school.trim(),
          speeches_count: 0,
          last_speech_order: recencyNum,
          questions_count: 0,
          last_question_order: recencyNum,
          active: true,
          is_present: true,
        };
      });

      let insertedReps: Representative[] = [];
      if (repsToInsert.length > 0) {
        const { data: repsData, error: repsError } = await supabase
          .from('representatives')
          .insert(repsToInsert)
          .select();

        if (repsError) throw repsError;
        insertedReps = (repsData || []) as Representative[];
      }

      return { room: roomData as Room, representatives: insertedReps };
    } else {
      // Local storage fallback
      const roomId = 'room_' + Math.random().toString(36).substring(2, 9);
      const newRoom: Room = {
        id: roomId,
        code: cleanCode,
        name: name.trim(),
        po_passcode: poPasscode.trim(),
        status: 'in_session',
        current_legislation: '',
        current_speaker_id: null,
        active_bill_id: null,
        last_speech_side: null,
        recess_end_time: null,
        settings: DEFAULT_CHAMBER_SETTINGS,
        active_amendment: null,
        global_speech_sequence: rosterEntries.length,
        global_question_sequence: rosterEntries.length,
        created_at: new Date().toISOString(),
      };

      const newReps: Representative[] = rosterEntries.map((entry, index) => {
        const recencyNum = entry.initialRecency !== undefined && !isNaN(entry.initialRecency)
          ? entry.initialRecency
          : index + 1;
        return {
          id: 'rep_' + Math.random().toString(36).substring(2, 9),
          room_id: roomId,
          name: entry.name.trim(),
          school: entry.school.trim(),
          speeches_count: 0,
          last_speech_order: recencyNum,
          questions_count: 0,
          last_question_order: recencyNum,
          active: true,
          is_present: true,
        };
      });

      const existingRooms = getStoredRooms().filter((r) => r.code !== cleanCode);
      saveStoredRooms([...existingRooms, newRoom]);

      const existingReps = getStoredReps().filter((r) => r.room_id !== roomId);
      saveStoredReps([...existingReps, ...newReps]);

      return { room: newRoom, representatives: newReps };
    }
  },

  // Fetch Room by Code
  async getRoomByCode(code: string): Promise<Room | null> {
    const cleanCode = code.trim().toUpperCase();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (error) {
        console.error('Error fetching room:', error);
        return null;
      }
      return data as Room | null;
    } else {
      const rooms = getStoredRooms();
      return rooms.find((r) => r.code.toUpperCase() === cleanCode) || null;
    }
  },

  // Update Room Metadata (Legislation, Status, Speaker, Settings, Amendment)
  async updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', roomId)
        .select()
        .single();

      if (error) throw error;
      return data as Room;
    } else {
      const rooms = getStoredRooms();
      const updated = rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r));
      saveStoredRooms(updated);
      return updated.find((r) => r.id === roomId) || null;
    }
  },

  // Update Chamber Settings
  async updateChamberSettings(roomId: string, settings: ChamberSettings): Promise<Room | null> {
    return this.updateRoom(roomId, { settings });
  },

  // Update Chamber Timer (Zero continuous writes: only on Start, Pause, Reset, Preset)
  async updateRoomTimer(
    roomId: string,
    timerStatus: TimerStatus,
    remainingSeconds: number,
    duration: number,
    mode: TimerMode
  ): Promise<Room | null> {
    return this.updateRoom(roomId, {
      timer_status: timerStatus,
      timer_remaining_seconds: remainingSeconds,
      timer_duration: duration,
      timer_updated_at: new Date().toISOString(),
      timer_mode: mode,
    });
  },

  // Fetch Permanent Platform Metrics
  async getPlatformMetrics(): Promise<PlatformMetrics | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('platform_metrics')
        .select('*')
        .eq('id', 'global')
        .maybeSingle();

      if (error) {
        console.error('Error fetching platform metrics:', error);
        return null;
      }
      return data as PlatformMetrics | null;
    } else {
      const rooms = getStoredRooms();
      const reps = getStoredReps();
      const events = getStoredEvents();
      const speechCount = events.filter((e) => e.event_type.startsWith('speech_')).length;

      return {
        id: 'global',
        total_rooms_all_time: rooms.length,
        total_debaters_all_time: reps.length,
        total_speeches_all_time: speechCount,
        last_updated: new Date().toISOString(),
      };
    }
  },

  // ==========================================
  // DOCKET / BILLS MANAGEMENT
  // ==========================================
  getDocketOrder(roomId: string): string[] {
    try {
      const raw = localStorage.getItem(`betterpo_docket_order_${roomId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  },

  saveDocketOrder(roomId: string, billIds: string[]): void {
    try {
      localStorage.setItem(`betterpo_docket_order_${roomId}`, JSON.stringify(billIds));
    } catch (err) {
      console.error('Failed to save docket order:', err);
    }
  },

  sortBillsByDocketOrder(bills: Bill[], roomId: string): Bill[] {
    const order = this.getDocketOrder(roomId);
    if (!order || order.length === 0) return bills;

    const billMap = new Map<string, Bill>();
    bills.forEach((b) => billMap.set(b.id, b));

    const sorted: Bill[] = [];
    const seen = new Set<string>();

    for (const id of order) {
      const bill = billMap.get(id);
      if (bill) {
        sorted.push(bill);
        seen.add(id);
      }
    }

    for (const bill of bills) {
      if (!seen.has(bill.id)) {
        sorted.push(bill);
      }
    }

    return sorted;
  },

  async getBills(roomId: string): Promise<Bill[]> {
    let rawBills: Bill[] = [];
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching bills:', error);
        rawBills = [];
      } else {
        rawBills = (data || []) as Bill[];
      }
    } else {
      rawBills = getStoredBills(roomId);
    }
    return this.sortBillsByDocketOrder(rawBills, roomId);
  },

  async addBill(
    roomId: string,
    billNumber: string,
    title: string,
    authorSchool: string = ''
  ): Promise<Bill> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('bills')
        .insert({
          room_id: roomId,
          bill_number: billNumber.trim(),
          title: title.trim(),
          author_school: authorSchool.trim(),
          speech_count: 0,
          cycle_broken: false,
          status: 'upcoming',
        })
        .select()
        .single();

      if (error) throw error;
      return data as Bill;
    } else {
      const newBill: Bill = {
        id: 'bill_' + Math.random().toString(36).substring(2, 9),
        room_id: roomId,
        bill_number: billNumber.trim(),
        title: title.trim(),
        author_school: authorSchool.trim(),
        speech_count: 0,
        cycle_broken: false,
        status: 'upcoming',
        created_at: new Date().toISOString(),
      };
      const bills = getStoredBills();
      saveStoredBills([...bills, newBill]);
      return newBill;
    }
  },

  async setDocketBills(
    roomId: string,
    billList: Array<{ billNumber: string; title: string; authorSchool?: string }>
  ): Promise<Bill[]> {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('bills').delete().eq('room_id', roomId);
      const toInsert = billList.map((b, idx) => ({
        room_id: roomId,
        bill_number: b.billNumber.trim(),
        title: b.title.trim(),
        author_school: (b.authorSchool || '').trim(),
        status: (idx === 0 ? 'active' : 'upcoming') as 'active' | 'upcoming',
        speech_count: 0,
        cycle_broken: false,
      }));

      const { data, error } = await supabase.from('bills').insert(toInsert).select();
      if (error) throw error;
      const created = (data || []) as Bill[];
      if (created.length > 0) {
        this.saveDocketOrder(roomId, created.map((b) => b.id));
        await this.setActiveBill({ id: roomId } as Room, created[0]);
      }
      return created;
    } else {
      const existing = getStoredBills().filter((b) => b.room_id !== roomId);
      const newBills: Bill[] = billList.map((b, idx) => ({
        id: 'bill_' + Math.random().toString(36).substring(2, 9),
        room_id: roomId,
        bill_number: b.billNumber.trim(),
        title: b.title.trim(),
        author_school: (b.authorSchool || '').trim(),
        full_text: '',
        status: idx === 0 ? 'active' : 'upcoming',
        speech_count: 0,
        cycle_broken: false,
        created_at: new Date(Date.now() + idx * 10).toISOString(),
      }));
      saveStoredBills([...existing, ...newBills]);
      if (newBills.length > 0) {
        this.saveDocketOrder(roomId, newBills.map((b) => b.id));
        await this.setActiveBill({ id: roomId } as Room, newBills[0]);
      }
      return newBills;
    }
  },

  async updateBill(billId: string, updates: Partial<Bill>): Promise<Bill | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('bills')
        .update(updates)
        .eq('id', billId)
        .select()
        .single();

      if (error) throw error;
      return data as Bill;
    } else {
      const bills = getStoredBills();
      const updated = bills.map((b) => (b.id === billId ? { ...b, ...updates } : b));
      saveStoredBills(updated);
      return updated.find((b) => b.id === billId) || null;
    }
  },

  async setActiveBill(room: Room, bill: Bill): Promise<{ room: Room; bill: Bill }> {
    const billLegislation = `${bill.bill_number}: ${bill.title}`;

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('bills')
        .update({ status: 'upcoming' })
        .eq('room_id', room.id)
        .eq('status', 'active');

      const { data: updatedBill, error: bErr } = await supabase
        .from('bills')
        .update({ status: 'active' })
        .eq('id', bill.id)
        .select()
        .single();

      if (bErr) throw bErr;

      const { data: updatedRoom, error: rErr } = await supabase
        .from('rooms')
        .update({
          active_bill_id: bill.id,
          current_legislation: billLegislation,
          last_speech_side: null,
          active_amendment: null, // Clear any dangling amendment
        })
        .eq('id', room.id)
        .select()
        .single();

      if (rErr) throw rErr;

      return { room: updatedRoom as Room, bill: updatedBill as Bill };
    } else {
      const bills = getStoredBills(room.id).map((b) => {
        if (b.id === bill.id) return { ...b, status: 'active' as const };
        if (b.status === 'active') return { ...b, status: 'upcoming' as const };
        return b;
      });
      saveStoredBills(bills);

      const updatedRoom: Room = {
        ...room,
        active_bill_id: bill.id,
        current_legislation: billLegislation,
        last_speech_side: null,
        active_amendment: null,
      };
      saveStoredRooms(getStoredRooms().map((r) => (r.id === room.id ? updatedRoom : r)));

      return { room: updatedRoom, bill: { ...bill, status: 'active' } };
    }
  },

  async toggleBreakCycle(billId: string, currentBroken: boolean): Promise<Bill | null> {
    return this.updateBill(billId, { cycle_broken: !currentBroken });
  },

  // ==========================================
  // REPRESENTATIVES & PRESENCE MANAGEMENT
  // ==========================================
  async getRepresentatives(roomId: string): Promise<Representative[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('representatives')
        .select('*')
        .eq('room_id', roomId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching representatives:', error);
        return [];
      }
      return (data || []) as Representative[];
    } else {
      const reps = getStoredReps(roomId);
      return reps.sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  async addRepresentatives(
    roomId: string,
    entries: Array<{ name: string; school: string; initialRecency?: number }>
  ): Promise<Representative[]> {
    if (isSupabaseConfigured && supabase) {
      const toInsert = entries.map((e, index) => {
        const recencyNum = e.initialRecency !== undefined && !isNaN(e.initialRecency)
          ? e.initialRecency
          : index + 1;
        return {
          room_id: roomId,
          name: e.name.trim(),
          school: e.school.trim(),
          speeches_count: 0,
          last_speech_order: recencyNum,
          questions_count: 0,
          last_question_order: recencyNum,
          active: true,
          is_present: true,
        };
      });

      const { data, error } = await supabase
        .from('representatives')
        .insert(toInsert)
        .select();

      if (error) throw error;
      return (data || []) as Representative[];
    } else {
      const newReps: Representative[] = entries.map((e, index) => {
        const recencyNum = e.initialRecency !== undefined && !isNaN(e.initialRecency)
          ? e.initialRecency
          : index + 1;
        return {
          id: 'rep_' + Math.random().toString(36).substring(2, 9),
          room_id: roomId,
          name: e.name.trim(),
          school: e.school.trim(),
          speeches_count: 0,
          last_speech_order: recencyNum,
          questions_count: 0,
          last_question_order: recencyNum,
          active: true,
          is_present: true,
        };
      });

      const existing = getStoredReps();
      saveStoredReps([...existing, ...newReps]);
      return newReps;
    }
  },

  async updateRepresentativeRecency(repId: string, recency: number): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('representatives')
        .update({ last_speech_order: recency, last_question_order: recency })
        .eq('id', repId);
      if (error) throw error;
    } else {
      const stored = getStoredReps();
      const updated = stored.map((r) =>
        r.id === repId ? { ...r, last_speech_order: recency, last_question_order: recency } : r
      );
      saveStoredReps(updated);
    }
  },

  async toggleRepresentativeActive(repId: string, currentActive: boolean): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('representatives')
        .update({ active: !currentActive })
        .eq('id', repId);

      if (error) throw error;
    } else {
      const reps = getStoredReps();
      saveStoredReps(reps.map((r) => (r.id === repId ? { ...r, active: !currentActive } : r)));
    }
  },

  async toggleRepresentativePresence(repId: string, currentPresent: boolean): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('representatives')
        .update({ is_present: !currentPresent })
        .eq('id', repId);

      if (error) throw error;
    } else {
      const reps = getStoredReps();
      saveStoredReps(reps.map((r) => (r.id === repId ? { ...r, is_present: !currentPresent } : r)));
    }
  },

  // ==========================================
  // AMENDMENT WORKFLOW
  // ==========================================
  async startAmendment(
    room: Room,
    billId: string,
    authorId: string,
    authorName: string,
    amendmentText: string
  ): Promise<Room> {
    const amendment: AmendmentState = {
      id: 'amd_' + Math.random().toString(36).substring(2, 9),
      bill_id: billId,
      author_id: authorId,
      author_name: authorName,
      text: amendmentText.trim(),
      speeches_count: 0,
      last_speech_side: null,
      created_at: new Date().toISOString(),
    };

    const updatedRoom = await this.updateRoom(room.id, {
      active_amendment: amendment,
    });

    // Log to round events
    await this.logCustomEvent(
      room.id,
      authorId,
      'amendment_action',
      `Floor Amendment Introduced by ${authorName}: "${amendmentText.trim()}"`
    );

    return updatedRoom || { ...room, active_amendment: amendment };
  },

  async concludeAmendment(
    room: Room,
    passed: boolean,
    voteDetails?: string
  ): Promise<Room> {
    const amd = room.active_amendment;
    const resultText = passed ? 'ADOPTED' : 'REJECTED';
    const detailMsg = voteDetails ? ` (${voteDetails})` : '';

    if (amd) {
      await this.logCustomEvent(
        room.id,
        amd.author_id,
        'amendment_action',
        `Floor Amendment ${resultText}${detailMsg}: "${amd.text}"`
      );

      // If adopted, update the bill's title/notes in DB if desired
      if (passed && room.active_bill_id) {
        const bills = await this.getBills(room.id);
        const bill = bills.find(b => b.id === room.active_bill_id);
        if (bill) {
          await this.updateBill(bill.id, {
            title: `${bill.title} [As Amended]`,
          });
        }
      }
    }

    const updatedRoom = await this.updateRoom(room.id, {
      active_amendment: null,
    });

    return updatedRoom || { ...room, active_amendment: null };
  },

  // ==========================================
  // VOTING & MOTIONS LOGGING
  // ==========================================
  async logMotionVote(
    roomId: string,
    motionName: string,
    ayes: number,
    nays: number,
    abstains: number = 0,
    thresholdType: 'majority' | 'two_thirds',
    passed: boolean
  ): Promise<RoundEvent> {
    const totalVotes = ayes + nays;
    const requiredThreshold = thresholdType === 'majority' ? 'Simple Majority (>50%)' : '2/3 Majority';
    const description = `VOTE on "${motionName}": Ayes: ${ayes}, Nays: ${nays}, Abstains: ${abstains} (Total: ${totalVotes}) [${requiredThreshold}] → ${
      passed ? 'PASSED / ADOPTED' : 'FAILED'
    }`;

    return this.logCustomEvent(roomId, '00000000-0000-0000-0000-000000000000', 'motion_vote', description);
  },

  async logCustomEvent(
    roomId: string,
    representativeId: string,
    eventType: EventType,
    description: string
  ): Promise<RoundEvent> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('round_events')
        .insert({
          room_id: roomId,
          representative_id: representativeId,
          event_type: eventType,
          sequence_number: 0,
          legislation: description,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...(data as RoundEvent),
        representative_name: 'Chamber Action',
      };
    } else {
      const newEvent: RoundEvent = {
        id: 'event_' + Math.random().toString(36).substring(2, 9),
        room_id: roomId,
        representative_id: representativeId,
        event_type: eventType,
        sequence_number: 0,
        legislation: description,
        created_at: new Date().toISOString(),
        representative_name: 'Chamber Action',
      };
      saveStoredEvents([newEvent, ...getStoredEvents(roomId)]);
      return newEvent;
    }
  },

  // ==========================================
  // FLOOR ACTION AWARD & CYCLE TRACKING
  // ==========================================
  async awardFloorAction(
    room: Room,
    rep: Representative,
    eventType: EventType,
    legislation: string
  ): Promise<{ room: Room; representative: Representative; event: RoundEvent }> {
    const isSpeech = eventType.startsWith('speech_');
    const nextSeq = isSpeech
      ? room.global_speech_sequence + 1
      : room.global_question_sequence + 1;

    const newSpeechesCount = isSpeech ? rep.speeches_count + 1 : rep.speeches_count;
    const newLastSpeechOrder = isSpeech ? nextSeq : rep.last_speech_order;

    const newQuestionsCount = !isSpeech ? rep.questions_count + 1 : rep.questions_count;
    const newLastQuestionOrder = !isSpeech ? nextSeq : rep.last_question_order;

    // Determine speech side for the cycle monitor
    let side: Room['last_speech_side'] = room.last_speech_side;
    if (eventType === 'speech_aff') side = 'aff';
    else if (eventType === 'speech_neg') side = 'neg';
    else if (eventType === 'speech_author') side = 'author';
    else if (eventType === 'speech_sponsor') side = 'sponsor';

    // If an amendment is actively on the floor and this is a speech, update amendment speech count
    let updatedAmd = room.active_amendment;
    if (updatedAmd && isSpeech) {
      updatedAmd = {
        ...updatedAmd,
        speeches_count: updatedAmd.speeches_count + 1,
        last_speech_side: eventType === 'speech_neg' ? 'neg' : 'aff',
      };
    }

    if (isSupabaseConfigured && supabase) {
      // 1. Update Room sequence & current speaker & last side
      const roomUpdates: Partial<Room> = {
        global_speech_sequence: isSpeech ? nextSeq : room.global_speech_sequence,
        global_question_sequence: !isSpeech ? nextSeq : room.global_question_sequence,
        current_speaker_id: isSpeech ? rep.id : room.current_speaker_id,
        current_legislation: legislation || room.current_legislation,
        last_speech_side: isSpeech ? side : room.last_speech_side,
        active_amendment: updatedAmd,
      };

      const { data: updatedRoom, error: roomErr } = await supabase
        .from('rooms')
        .update(roomUpdates)
        .eq('id', room.id)
        .select()
        .single();

      if (roomErr) throw roomErr;

      // 2. Increment active bill speech count if applicable (and not on amendment)
      if (room.active_bill_id && isSpeech && !room.active_amendment) {
        const { data: billData } = await supabase
          .from('bills')
          .select('speech_count')
          .eq('id', room.active_bill_id)
          .single();

        if (billData) {
          await supabase
            .from('bills')
            .update({ speech_count: billData.speech_count + 1 })
            .eq('id', room.active_bill_id);
        }
      }

      // 3. Update Representative
      const repUpdates: Partial<Representative> = {
        speeches_count: newSpeechesCount,
        last_speech_order: newLastSpeechOrder,
        questions_count: newQuestionsCount,
        last_question_order: newLastQuestionOrder,
      };

      const { data: updatedRep, error: repErr } = await supabase
        .from('representatives')
        .update(repUpdates)
        .eq('id', rep.id)
        .select()
        .single();

      if (repErr) throw repErr;

      // 4. Insert Round Event
      const { data: eventData, error: eventErr } = await supabase
        .from('round_events')
        .insert({
          room_id: room.id,
          representative_id: rep.id,
          bill_id: room.active_bill_id || null,
          event_type: eventType,
          sequence_number: nextSeq,
          legislation: room.active_amendment
            ? `[Amendment to ${room.current_legislation}] ${legislation || ''}`
            : legislation || room.current_legislation || '',
        })
        .select()
        .single();

      if (eventErr) throw eventErr;

      return {
        room: updatedRoom as Room,
        representative: updatedRep as Representative,
        event: {
          ...(eventData as RoundEvent),
          representative_name: rep.name,
          representative_school: rep.school,
        },
      };
    } else {
      // Local fallback
      const updatedRoom: Room = {
        ...room,
        global_speech_sequence: isSpeech ? nextSeq : room.global_speech_sequence,
        global_question_sequence: !isSpeech ? nextSeq : room.global_question_sequence,
        current_speaker_id: isSpeech ? rep.id : room.current_speaker_id,
        current_legislation: legislation || room.current_legislation,
        last_speech_side: isSpeech ? side : room.last_speech_side,
        active_amendment: updatedAmd,
      };
      saveStoredRooms(getStoredRooms().map((r) => (r.id === room.id ? updatedRoom : r)));

      if (room.active_bill_id && isSpeech && !room.active_amendment) {
        const bills = getStoredBills(room.id);
        const bill = bills.find((b) => b.id === room.active_bill_id);
        if (bill) {
          saveStoredBills(
            bills.map((b) => (b.id === bill.id ? { ...b, speech_count: b.speech_count + 1 } : b))
          );
        }
      }

      const updatedRep: Representative = {
        ...rep,
        speeches_count: newSpeechesCount,
        last_speech_order: newLastSpeechOrder,
        questions_count: newQuestionsCount,
        last_question_order: newLastQuestionOrder,
      };
      saveStoredReps(getStoredReps().map((r) => (r.id === rep.id ? updatedRep : r)));

      const newEvent: RoundEvent = {
        id: 'event_' + Math.random().toString(36).substring(2, 9),
        room_id: room.id,
        representative_id: rep.id,
        bill_id: room.active_bill_id || null,
        event_type: eventType,
        sequence_number: nextSeq,
        legislation: room.active_amendment
          ? `[Amendment to ${room.current_legislation}] ${legislation || ''}`
          : legislation || room.current_legislation || '',
        created_at: new Date().toISOString(),
        representative_name: rep.name,
        representative_school: rep.school,
      };
      saveStoredEvents([newEvent, ...getStoredEvents()]);

      return { room: updatedRoom, representative: updatedRep, event: newEvent };
    }
  },

  // Undo Last Call
  async undoLastFloorAction(roomId: string): Promise<RoundEvent | null> {
    if (isSupabaseConfigured && supabase) {
      // 1. Fetch latest event
      const { data: latestEvent, error: fetchErr } = await supabase
        .from('round_events')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr || !latestEvent) return null;

      // 2. Fetch Representative if valid rep
      if (latestEvent.representative_id && latestEvent.representative_id !== '00000000-0000-0000-0000-000000000000') {
        const { data: rep } = await supabase
          .from('representatives')
          .select('*')
          .eq('id', latestEvent.representative_id)
          .maybeSingle();

        if (rep) {
          const isSpeech = latestEvent.event_type.startsWith('speech_');

          const { data: pastEvents } = await supabase
            .from('round_events')
            .select('*')
            .eq('representative_id', rep.id)
            .neq('id', latestEvent.id)
            .order('created_at', { ascending: false });

          let prevSpeechOrder = 0;
          let prevQuestionOrder = 0;

          if (pastEvents) {
            const priorSpeech = pastEvents.find((e) => e.event_type.startsWith('speech_'));
            if (priorSpeech) prevSpeechOrder = priorSpeech.sequence_number;

            const priorQ = pastEvents.find((e) => e.event_type === 'question');
            if (priorQ) prevQuestionOrder = priorQ.sequence_number;
          }

          await supabase
            .from('representatives')
            .update({
              speeches_count: isSpeech ? Math.max(0, rep.speeches_count - 1) : rep.speeches_count,
              last_speech_order: isSpeech ? prevSpeechOrder : rep.last_speech_order,
              questions_count: !isSpeech ? Math.max(0, rep.questions_count - 1) : rep.questions_count,
              last_question_order: !isSpeech ? prevQuestionOrder : rep.last_question_order,
            })
            .eq('id', rep.id);
        }
      }

      // 3. Roll back bill speech count if applicable
      if (latestEvent.bill_id && latestEvent.event_type.startsWith('speech_')) {
        const { data: billData } = await supabase
          .from('bills')
          .select('speech_count')
          .eq('id', latestEvent.bill_id)
          .single();

        if (billData) {
          await supabase
            .from('bills')
            .update({ speech_count: Math.max(0, billData.speech_count - 1) })
            .eq('id', latestEvent.bill_id);
        }
      }

      // 4. Delete latest round event
      await supabase.from('round_events').delete().eq('id', latestEvent.id);

      return latestEvent as RoundEvent;
    } else {
      // Local fallback
      const allEvents = getStoredEvents(roomId).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      if (allEvents.length === 0) return null;

      const latestEvent = allEvents[0];
      const remaining = allEvents.slice(1);
      saveStoredEvents(remaining);

      const reps = getStoredReps(roomId);
      const rep = reps.find((r) => r.id === latestEvent.representative_id);
      if (rep) {
        const isSpeech = latestEvent.event_type.startsWith('speech_');
        const past = remaining.filter((e) => e.representative_id === rep.id);
        const priorSpeech = past.find((e) => e.event_type.startsWith('speech_'));
        const priorQ = past.find((e) => e.event_type === 'question');

        const updatedRep: Representative = {
          ...rep,
          speeches_count: isSpeech ? Math.max(0, rep.speeches_count - 1) : rep.speeches_count,
          last_speech_order: isSpeech ? (priorSpeech ? priorSpeech.sequence_number : 0) : rep.last_speech_order,
          questions_count: !isSpeech ? Math.max(0, rep.questions_count - 1) : rep.questions_count,
          last_question_order: !isSpeech ? (priorQ ? priorQ.sequence_number : 0) : rep.last_question_order,
        };

        saveStoredReps(reps.map((r) => (r.id === rep.id ? updatedRep : r)));
      }

      if (latestEvent.bill_id && latestEvent.event_type.startsWith('speech_')) {
        const bills = getStoredBills(roomId);
        const bill = bills.find((b) => b.id === latestEvent.bill_id);
        if (bill) {
          saveStoredBills(
            bills.map((b) =>
              b.id === bill.id ? { ...b, speech_count: Math.max(0, b.speech_count - 1) } : b
            )
          );
        }
      }

      return latestEvent;
    }
  },

  // Get Round Events (Audit Ledger)
  async getRoundEvents(roomId: string, limit = 50): Promise<RoundEvent[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('round_events')
        .select(`
          *,
          representatives (
            name,
            school
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching round events:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        ...row,
        representative_name: row.representative_id === '00000000-0000-0000-0000-000000000000'
          ? 'Chamber Action'
          : row.representatives?.name || 'Unknown',
        representative_school: row.representatives?.school || '',
      })) as RoundEvent[];
    } else {
      const events = getStoredEvents(roomId).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const reps = getStoredReps(roomId);
      return events.slice(0, limit).map((e) => {
        const found = reps.find((r) => r.id === e.representative_id);
        return {
          ...e,
          representative_name: e.representative_id === '00000000-0000-0000-0000-000000000000'
            ? 'Chamber Action'
            : found?.name || 'Unknown',
          representative_school: found?.school || '',
        };
      });
    }
  },

  // Export Session CSV for Parliamentarians
  exportSessionCSV(room: Room, reps: Representative[], events: RoundEvent[], bills: Bill[] = []) {
    const sortedSpeeches = sortRepresentatives(reps, 'speech');
    const sortedQuestions = sortRepresentatives(reps, 'question');

    let csv = `ELEVATE CHAMBER - OFFICIAL PARLIAMENTARY AUDIT LEDGER\n`;
    csv += `Chamber Name,"${room.name}"\n`;
    csv += `Chamber Code,${room.code}\n`;
    csv += `Status,${room.status}\n`;
    csv += `Current Legislation,"${room.current_legislation || 'None'}"\n`;
    csv += `Export Timestamp,"${new Date().toISOString()}"\n\n`;

    if (bills.length > 0) {
      csv += `--- DOCKET & BILLS SUMMARY ---\n`;
      csv += `Bill Number,Title,Author School,Speeches Delivered,Cycle Broken,Status\n`;
      bills.forEach((b) => {
        csv += `"${b.bill_number}","${b.title}","${b.author_school}",${b.speech_count},${b.cycle_broken ? 'Yes' : 'No'},"${b.status}"\n`;
      });
      csv += `\n`;
    }

    csv += `--- SPEECH PRECEDENCE & RECENCY STANDINGS ---\n`;
    csv += `Rank,Score,Representative,School,Speeches Given,Last Speech Order,Active,Present\n`;
    sortedSpeeches.forEach((r) => {
      csv += `${r.rank},${r.score},"${r.name}","${r.school}",${r.speeches_count},${r.last_speech_order || 'Never'},${r.active ? 'Yes' : 'No'},${r.is_present ? 'In Chamber' : 'Away'}\n`;
    });

    csv += `\n--- QUESTIONING STANDINGS ---\n`;
    csv += `Rank,Score,Representative,School,Questions Given,Last Question Order,Active,Present\n`;
    sortedQuestions.forEach((r) => {
      csv += `${r.rank},${r.score},"${r.name}","${r.school}",${r.questions_count},${r.last_question_order || 'Never'},${r.active ? 'Yes' : 'No'},${r.is_present ? 'In Chamber' : 'Away'}\n`;
    });

    csv += `\n--- COMPLETE CHRONOLOGICAL AUDIT TIMELINE ---\n`;
    csv += `Timestamp,Sequence Number,Representative,School,Action Type,Legislation\n`;
    events.forEach((e) => {
      csv += `"${new Date(e.created_at).toLocaleTimeString()}",${e.sequence_number},"${e.representative_name || e.representative_id}","${e.representative_school || ''}","${e.event_type}","${e.legislation || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ElevateChamber_${room.code}_Ledger.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
