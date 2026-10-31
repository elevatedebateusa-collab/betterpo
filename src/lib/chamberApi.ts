import { supabase, isSupabaseConfigured, getLocalRooms, saveLocalRooms, getLocalReps, saveLocalReps, getLocalActions, saveLocalActions } from './supabaseClient';
import type { Room, Representative, RoundAction, ActionType } from '../types/database';

export const chamberApi = {
  // Create Room with Initial Representatives
  async createRoom(
    name: string,
    code: string,
    poPasscode: string,
    rosterEntries: Array<{ name: string; school: string }>
  ): Promise<{ room: Room; reps: Representative[] }> {
    const cleanCode = code.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      // 1. Insert room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          code: cleanCode,
          name: name.trim(),
          po_passcode: poPasscode.trim(),
          status: 'in_session',
          current_legislation: '',
          global_recency_counter: 0,
          global_question_counter: 0,
        })
        .select()
        .single();

      if (roomError || !roomData) {
        throw new Error(roomError?.message || 'Failed to create room');
      }

      // 2. Insert representatives
      const repsToInsert = rosterEntries.map((entry) => ({
        room_id: roomData.id,
        name: entry.name.trim(),
        school: entry.school.trim(),
        speeches_count: 0,
        last_speech_order: 0,
        questions_count: 0,
        last_question_order: 0,
        active: true,
      }));

      let repsData: Representative[] = [];
      if (repsToInsert.length > 0) {
        const { data: insertedReps, error: repsError } = await supabase
          .from('representatives')
          .insert(repsToInsert)
          .select();

        if (repsError) {
          throw new Error(repsError.message);
        }
        repsData = insertedReps || [];
      }

      return { room: roomData as Room, reps: repsData };
    } else {
      // Local fallback
      const roomId = 'room-' + Math.random().toString(36).substring(2, 9);
      const newRoom: Room = {
        id: roomId,
        code: cleanCode,
        name: name.trim(),
        po_passcode: poPasscode.trim(),
        created_at: new Date().toISOString(),
        status: 'in_session',
        current_legislation: '',
        active_speaker_id: null,
        active_speaker_name: null,
        global_recency_counter: 0,
        global_question_counter: 0,
      };

      const newReps: Representative[] = rosterEntries.map((entry) => ({
        id: 'rep-' + Math.random().toString(36).substring(2, 9),
        room_id: roomId,
        name: entry.name.trim(),
        school: entry.school.trim(),
        speeches_count: 0,
        last_speech_order: 0,
        questions_count: 0,
        last_question_order: 0,
        active: true,
        created_at: new Date().toISOString(),
      }));

      const existingRooms = getLocalRooms().filter(r => r.code !== cleanCode);
      saveLocalRooms([...existingRooms, newRoom]);

      const existingReps = getLocalReps().filter(r => r.room_id !== roomId);
      saveLocalReps([...existingReps, ...newReps]);

      return { room: newRoom, reps: newReps };
    }
  },

  // Fetch Room by Code
  async getRoomByCode(code: string): Promise<Room | null> {
    const cleanCode = code.trim().toLowerCase();

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
      const rooms = getLocalRooms();
      return rooms.find((r) => r.code === cleanCode) || null;
    }
  },

  // Update Room Metadata (Legislation, Status, Active Speaker, etc.)
  async updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', roomId)
        .select()
        .single();

      if (error) {
        console.error('Error updating room:', error);
        throw error;
      }
      return data as Room;
    } else {
      const rooms = getLocalRooms();
      const updatedRooms = rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r));
      saveLocalRooms(updatedRooms);
      return updatedRooms.find((r) => r.id === roomId) || null;
    }
  },

  // Get Representatives for Room
  async getRepresentatives(roomId: string): Promise<Representative[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('representatives')
        .select('*')
        .eq('room_id', roomId)
        .order('speeches_count', { ascending: true })
        .order('last_speech_order', { ascending: true });

      if (error) {
        console.error('Error fetching representatives:', error);
        return [];
      }
      return (data || []) as Representative[];
    } else {
      const reps = getLocalReps(roomId);
      return reps.sort((a, b) => {
        if (a.speeches_count !== b.speeches_count) {
          return a.speeches_count - b.speeches_count;
        }
        return a.last_speech_order - b.last_speech_order;
      });
    }
  },

  // Add Representative
  async addRepresentative(roomId: string, name: string, school: string = ''): Promise<Representative> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('representatives')
        .insert({
          room_id: roomId,
          name: name.trim(),
          school: school.trim(),
          speeches_count: 0,
          last_speech_order: 0,
          questions_count: 0,
          last_question_order: 0,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Representative;
    } else {
      const newRep: Representative = {
        id: 'rep-' + Math.random().toString(36).substring(2, 9),
        room_id: roomId,
        name: name.trim(),
        school: school.trim(),
        speeches_count: 0,
        last_speech_order: 0,
        questions_count: 0,
        last_question_order: 0,
        active: true,
        created_at: new Date().toISOString(),
      };
      const reps = getLocalReps();
      saveLocalReps([...reps, newRep]);
      return newRep;
    }
  },

  // Toggle Representative Active State
  async toggleRepActive(repId: string, currentActive: boolean): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('representatives')
        .update({ active: !currentActive })
        .eq('id', repId);

      if (error) throw error;
    } else {
      const reps = getLocalReps();
      const updated = reps.map((r) => (r.id === repId ? { ...r, active: !currentActive } : r));
      saveLocalReps(updated);
    }
  },

  // Record an Action (Speech or Question)
  async recordAction(
    room: Room,
    rep: Representative,
    actionType: ActionType,
    legislation: string
  ): Promise<{ action: RoundAction; updatedRep: Representative; updatedRoom: Room }> {
    const isSpeech = actionType.startsWith('speech_');

    const nextSpeechOrder = isSpeech ? room.global_recency_counter + 1 : rep.last_speech_order;
    const nextQuestionOrder = !isSpeech ? room.global_question_counter + 1 : rep.last_question_order;

    const updatedSpeechesCount = isSpeech ? rep.speeches_count + 1 : rep.speeches_count;
    const updatedQuestionsCount = !isSpeech ? rep.questions_count + 1 : rep.questions_count;

    if (isSupabaseConfigured && supabase) {
      // 1. Update Room counters
      const roomUpdates: Partial<Room> = {
        global_recency_counter: isSpeech ? room.global_recency_counter + 1 : room.global_recency_counter,
        global_question_counter: !isSpeech ? room.global_question_counter + 1 : room.global_question_counter,
        active_speaker_id: isSpeech ? rep.id : room.active_speaker_id,
        active_speaker_name: isSpeech ? rep.name : room.active_speaker_name,
      };

      const { data: updatedRoomData, error: roomErr } = await supabase
        .from('rooms')
        .update(roomUpdates)
        .eq('id', room.id)
        .select()
        .single();

      if (roomErr) throw roomErr;

      // 2. Update Representative counts
      const repUpdates: Partial<Representative> = {
        speeches_count: updatedSpeechesCount,
        last_speech_order: nextSpeechOrder,
        questions_count: updatedQuestionsCount,
        last_question_order: nextQuestionOrder,
      };

      const { data: updatedRepData, error: repErr } = await supabase
        .from('representatives')
        .update(repUpdates)
        .eq('id', rep.id)
        .select()
        .single();

      if (repErr) throw repErr;

      // 3. Insert Round Action
      const { data: actionData, error: actionErr } = await supabase
        .from('round_actions')
        .insert({
          room_id: room.id,
          representative_id: rep.id,
          action_type: actionType,
          speech_order_index: isSpeech ? nextSpeechOrder : nextQuestionOrder,
          legislation: legislation || room.current_legislation || '',
        })
        .select()
        .single();

      if (actionErr) throw actionErr;

      return {
        action: actionData as RoundAction,
        updatedRep: updatedRepData as Representative,
        updatedRoom: updatedRoomData as Room,
      };
    } else {
      // Local fallback
      const updatedRoom: Room = {
        ...room,
        global_recency_counter: isSpeech ? room.global_recency_counter + 1 : room.global_recency_counter,
        global_question_counter: !isSpeech ? room.global_question_counter + 1 : room.global_question_counter,
        active_speaker_id: isSpeech ? rep.id : room.active_speaker_id,
        active_speaker_name: isSpeech ? rep.name : room.active_speaker_name,
      };
      saveLocalRooms(getLocalRooms().map(r => r.id === room.id ? updatedRoom : r));

      const updatedRep: Representative = {
        ...rep,
        speeches_count: updatedSpeechesCount,
        last_speech_order: nextSpeechOrder,
        questions_count: updatedQuestionsCount,
        last_question_order: nextQuestionOrder,
      };
      saveLocalReps(getLocalReps().map(r => r.id === rep.id ? updatedRep : r));

      const newAction: RoundAction = {
        id: 'action-' + Math.random().toString(36).substring(2, 9),
        room_id: room.id,
        representative_id: rep.id,
        action_type: actionType,
        speech_order_index: isSpeech ? nextSpeechOrder : nextQuestionOrder,
        legislation: legislation || room.current_legislation || '',
        timestamp: new Date().toISOString(),
      };
      saveLocalActions([newAction, ...getLocalActions()]);

      return { action: newAction, updatedRep, updatedRoom };
    }
  },

  // Undo Last Action
  async undoLastAction(roomId: string): Promise<RoundAction | null> {
    if (isSupabaseConfigured && supabase) {
      // 1. Get latest action
      const { data: latestAction, error: fetchErr } = await supabase
        .from('round_actions')
        .select('*')
        .eq('room_id', roomId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr || !latestAction) {
        return null;
      }

      // 2. Fetch the affected representative
      const { data: rep, error: repFetchErr } = await supabase
        .from('representatives')
        .select('*')
        .eq('id', latestAction.representative_id)
        .single();

      if (!repFetchErr && rep) {
        const isSpeech = latestAction.action_type.startsWith('speech_');
        
        // Find previous speech or question order for this rep
        const { data: priorActions } = await supabase
          .from('round_actions')
          .select('*')
          .eq('representative_id', rep.id)
          .neq('id', latestAction.id)
          .order('timestamp', { ascending: false });

        let prevSpeechOrder = 0;
        let prevQuestionOrder = 0;

        if (priorActions) {
          const prevSpeech = priorActions.find(a => a.action_type.startsWith('speech_'));
          if (prevSpeech) prevSpeechOrder = prevSpeech.speech_order_index;

          const prevQ = priorActions.find(a => a.action_type === 'question');
          if (prevQ) prevQuestionOrder = prevQ.speech_order_index;
        }

        const newSpeechesCount = isSpeech ? Math.max(0, rep.speeches_count - 1) : rep.speeches_count;
        const newQuestionsCount = !isSpeech ? Math.max(0, rep.questions_count - 1) : rep.questions_count;

        await supabase
          .from('representatives')
          .update({
            speeches_count: newSpeechesCount,
            last_speech_order: isSpeech ? prevSpeechOrder : rep.last_speech_order,
            questions_count: newQuestionsCount,
            last_question_order: !isSpeech ? prevQuestionOrder : rep.last_question_order,
          })
          .eq('id', rep.id);
      }

      // 3. Delete the action
      await supabase.from('round_actions').delete().eq('id', latestAction.id);

      return latestAction as RoundAction;
    } else {
      // Local fallback
      const actions = getLocalActions(roomId).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      if (actions.length === 0) return null;

      const latestAction = actions[0];
      const remainingActions = actions.slice(1);
      saveLocalActions(remainingActions);

      const reps = getLocalReps(roomId);
      const rep = reps.find(r => r.id === latestAction.representative_id);
      if (rep) {
        const isSpeech = latestAction.action_type.startsWith('speech_');
        const repPriorActions = remainingActions.filter(a => a.representative_id === rep.id);
        const prevSpeech = repPriorActions.find(a => a.action_type.startsWith('speech_'));
        const prevQ = repPriorActions.find(a => a.action_type === 'question');

        const updatedRep: Representative = {
          ...rep,
          speeches_count: isSpeech ? Math.max(0, rep.speeches_count - 1) : rep.speeches_count,
          last_speech_order: isSpeech ? (prevSpeech ? prevSpeech.speech_order_index : 0) : rep.last_speech_order,
          questions_count: !isSpeech ? Math.max(0, rep.questions_count - 1) : rep.questions_count,
          last_question_order: !isSpeech ? (prevQ ? prevQ.speech_order_index : 0) : rep.last_question_order,
        };

        saveLocalReps(reps.map(r => r.id === rep.id ? updatedRep : r));
      }

      return latestAction;
    }
  },

  // Get Round Actions (Audit Log)
  async getRoundActions(roomId: string, limit = 50): Promise<RoundAction[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('round_actions')
        .select(`
          *,
          representatives (
            name
          )
        `)
        .eq('room_id', roomId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching round actions:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        ...row,
        representative_name: row.representatives?.name || 'Unknown',
      })) as RoundAction[];
    } else {
      const actions = getLocalActions(roomId).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      const reps = getLocalReps(roomId);
      return actions.slice(0, limit).map(action => ({
        ...action,
        representative_name: reps.find(r => r.id === action.representative_id)?.name || 'Unknown',
      }));
    }
  },

  // Export Ledger CSV
  exportLedgerCSV(room: Room, reps: Representative[], actions: RoundAction[]) {
    // 1. Roster summary sorted by precedence and recency
    const sortedReps = [...reps].sort((a, b) => {
      if (a.speeches_count !== b.speeches_count) return a.speeches_count - b.speeches_count;
      return a.last_speech_order - b.last_speech_order;
    });

    let csvContent = `data:text/csv;charset=utf-8,`;
    csvContent += `ELEVATE CHAMBER SESSION LEDGER\n`;
    csvContent += `Chamber Name,${room.name}\n`;
    csvContent += `Chamber Code,${room.code}\n`;
    csvContent += `Exported At,${new Date().toLocaleString()}\n`;
    csvContent += `Status,${room.status}\n\n`;

    csvContent += `REPRESENTATIVE STANDINGS (PRECEDENCE & RECENCY)\n`;
    csvContent += `Rank,Name,School,Speeches (Precedence),Last Speech Order (Recency),Questions,Last Question Order,Active\n`;
    sortedReps.forEach((r, idx) => {
      csvContent += `${idx + 1},"${r.name}","${r.school}",${r.speeches_count},${r.last_speech_order || 'Never'},${r.questions_count},${r.last_question_order || 'Never'},${r.active ? 'Yes' : 'No'}\n`;
    });

    csvContent += `\nFULL AUDIT LOG TIMELINE\n`;
    csvContent += `Timestamp,Order Index,Representative,Action Type,Legislation\n`;
    actions.forEach(a => {
      const formattedDate = new Date(a.timestamp).toLocaleTimeString();
      csvContent += `"${formattedDate}",${a.speech_order_index},"${a.representative_name || a.representative_id}","${a.action_type}","${a.legislation || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `elevate_chamber_${room.code}_ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
