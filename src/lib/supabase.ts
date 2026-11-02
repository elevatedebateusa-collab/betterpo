import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
export type RoomStatus = 'in_session' | 'recess' | 'adjourned';
export type TimerStatus = 'running' | 'paused' | 'reset';
export type TimerMode = 'speech' | 'dq' | 'question' | 'recess' | 'custom';
export type AmendmentStage = 'pending_second' | 'debate' | 'previous_question' | 'final_vote';
export type EventType = 
  | 'speech_aff' 
  | 'speech_neg' 
  | 'speech_author' 
  | 'speech_sponsor' 
  | 'question' 
  | 'motion_vote' 
  | 'amendment_action';
export type BillStatus = 'active' | 'passed' | 'failed' | 'tabled' | 'upcoming';

export interface ChamberSettings {
  cx_mode: 'standard' | 'direct'; // Standard (1 question per speaker) vs Direct (30s blocks)
  author_cx_duration: number; // 60s vs 120s (2:00 default)
  regular_cx_duration?: number; // 60s vs 120s
  grace_period: number; // default 10s
}

export interface AmendmentState {
  id: string;
  bill_id: string;
  author_id: string;
  author_name: string;
  text: string;
  speeches_count: number;
  last_speech_side: 'aff' | 'neg' | null;
  created_at: string;
  stage?: AmendmentStage;
}

export interface Bill {
  id: string;
  room_id: string;
  bill_number: string;
  title: string;
  author_school: string;
  speech_count: number;
  cycle_broken: boolean;
  status: BillStatus;
  created_at: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  po_passcode: string;
  status: RoomStatus;
  current_legislation: string;
  current_speaker_id: string | null;
  active_bill_id: string | null;
  last_speech_side: 'aff' | 'neg' | 'author' | 'sponsor' | null;
  recess_end_time: string | null;
  settings: ChamberSettings;
  active_amendment: AmendmentState | null;
  global_speech_sequence: number;
  global_question_sequence: number;
  timer_status?: TimerStatus;
  timer_remaining_seconds?: number;
  timer_duration?: number;
  timer_updated_at?: string;
  timer_mode?: TimerMode;
  created_at: string;
}

export interface PlatformMetrics {
  id: string;
  total_rooms_all_time: number;
  total_debaters_all_time: number;
  total_speeches_all_time: number;
  last_updated: string;
}

export function calculateCurrentTimer(room: Room | null | undefined): {
  secondsLeft: number;
  isRunning: boolean;
  duration: number;
  mode: TimerMode;
} {
  if (!room) {
    return { secondsLeft: 190, isRunning: false, duration: 190, mode: 'speech' };
  }

  const status = room.timer_status || 'paused';
  const remaining = room.timer_remaining_seconds ?? 190;
  const duration = room.timer_duration ?? 190;
  const mode = (room.timer_mode as TimerMode) || 'speech';

  if (status !== 'running' || !room.timer_updated_at) {
    return {
      secondsLeft: remaining,
      isRunning: false,
      duration,
      mode,
    };
  }

  const elapsedSeconds = Math.floor((Date.now() - new Date(room.timer_updated_at).getTime()) / 1000);
  const currentLeft = Math.max(0, remaining - elapsedSeconds);

  return {
    secondsLeft: currentLeft,
    isRunning: currentLeft > 0,
    duration,
    mode,
  };
}

export interface Representative {
  id: string;
  room_id: string;
  name: string;
  school: string;
  speeches_count: number;
  last_speech_order: number;
  questions_count: number;
  last_question_order: number;
  active: boolean;
  is_present: boolean;
}

export interface RoundEvent {
  id: string;
  room_id: string;
  representative_id: string;
  bill_id?: string | null;
  event_type: EventType;
  sequence_number: number;
  legislation: string;
  created_at: string;
  representative_name?: string;
  representative_school?: string;
}

export interface TimerBroadcastPayload {
  room_code: string;
  seconds_left: number;
  duration: number;
  is_running: boolean;
  speaker_id: string | null;
  speaker_name: string | null;
  questioner_name?: string | null;
  mode: 'speech' | 'dq' | 'question' | 'recess' | 'custom';
  timestamp: number;
}

export const DEFAULT_CHAMBER_SETTINGS: ChamberSettings = {
  cx_mode: 'direct',
  author_cx_duration: 30,
  regular_cx_duration: 30,
  grace_period: 10,
};

// Default Production Cloud Endpoints for Elevate Chamber
const DEFAULT_SUPABASE_URL = 'https://mzzjuzrfgbyttictyewi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_gBW1bTH8v5jKTg_E5gFq6Q_s4XUvNfR';

// Credentials - Vite uses import.meta.env, never process.env
const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';
const localUrl = typeof window !== 'undefined' ? localStorage.getItem('elevate_supabase_url') || '' : '';
const localKey = typeof window !== 'undefined' ? localStorage.getItem('elevate_supabase_anon_key') || '' : '';

const rawUrl = envUrl || localUrl || DEFAULT_SUPABASE_URL;
const rawKey = envKey || localKey || DEFAULT_SUPABASE_ANON_KEY;

// Clean and normalize base URL (strip trailing slashes and /rest/v1 if included)
export const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = rawKey.trim();

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL.startsWith('http') && 
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_URL.includes('placeholder')
);

let initializedSupabase: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  try {
    initializedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 15,
        },
      },
    });
  } catch (err) {
    console.warn('[Elevate Chamber] Failed to initialize Supabase client:', err);
    initializedSupabase = null;
  }
} else {
  console.info('[Elevate Chamber] Supabase not connected. Operating in zero-friction local storage + BroadcastChannel mode.');
}

export const supabase: SupabaseClient | null = initializedSupabase;
export default supabase;

// ==========================================
// ZERO-CONFIG LOCAL FALLBACK & BROADCASTCHANNEL
// ==========================================
const STORAGE_ROOMS = 'elevate_chambers';
const STORAGE_REPS = 'elevate_senators';
const STORAGE_BILLS = 'elevate_docket_bills';
const STORAGE_EVENTS = 'elevate_round_events';

const localSyncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('elevate_chamber_realtime_channel')
  : null;

export function getStoredRooms(): Room[] {
  try {
    const raw = localStorage.getItem(STORAGE_ROOMS);
    if (!raw) return [];
    const rooms: Room[] = JSON.parse(raw);
    return rooms.map(r => ({
      ...r,
      settings: r.settings || DEFAULT_CHAMBER_SETTINGS,
      active_amendment: r.active_amendment || null,
    }));
  } catch {
    return [];
  }
}

export function saveStoredRooms(rooms: Room[]) {
  localStorage.setItem(STORAGE_ROOMS, JSON.stringify(rooms));
  localSyncChannel?.postMessage({ type: 'ROOMS_UPDATE', data: rooms });
}

export function getStoredReps(roomId?: string): Representative[] {
  try {
    const raw = localStorage.getItem(STORAGE_REPS);
    const all: Representative[] = raw ? JSON.parse(raw) : [];
    const normalized = all.map(r => ({
      ...r,
      is_present: r.is_present !== undefined ? r.is_present : true,
    }));
    return roomId ? normalized.filter(r => r.room_id === roomId) : normalized;
  } catch {
    return [];
  }
}

export function saveStoredReps(reps: Representative[]) {
  localStorage.setItem(STORAGE_REPS, JSON.stringify(reps));
  localSyncChannel?.postMessage({ type: 'REPS_UPDATE', data: reps });
}

export function getStoredBills(roomId?: string): Bill[] {
  try {
    const raw = localStorage.getItem(STORAGE_BILLS);
    const all: Bill[] = raw ? JSON.parse(raw) : [];
    return roomId ? all.filter(b => b.room_id === roomId) : all;
  } catch {
    return [];
  }
}

export function saveStoredBills(bills: Bill[]) {
  localStorage.setItem(STORAGE_BILLS, JSON.stringify(bills));
  localSyncChannel?.postMessage({ type: 'BILLS_UPDATE', data: bills });
}

export function getStoredEvents(roomId?: string): RoundEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_EVENTS);
    const all: RoundEvent[] = raw ? JSON.parse(raw) : [];
    return roomId ? all.filter(e => e.room_id === roomId) : all;
  } catch {
    return [];
  }
}

export function saveStoredEvents(events: RoundEvent[]) {
  localStorage.setItem(STORAGE_EVENTS, JSON.stringify(events));
  localSyncChannel?.postMessage({ type: 'EVENTS_UPDATE', data: events });
}

export function broadcastTimerState(payload: TimerBroadcastPayload) {
  if (isSupabaseConfigured && supabase) {
    const channel = supabase.channel(`timer_${payload.room_code}`);
    channel.send({
      type: 'broadcast',
      event: 'timer_ping',
      payload,
    });
  } else {
    localSyncChannel?.postMessage({ type: 'TIMER_BROADCAST', data: payload });
  }
}

export function subscribeToLocalSync(callback: (msg: { type: string; data: unknown }) => void) {
  if (!localSyncChannel) return () => {};
  const handler = (e: MessageEvent) => callback(e.data);
  localSyncChannel.addEventListener('message', handler);
  return () => localSyncChannel.removeEventListener('message', handler);
}
