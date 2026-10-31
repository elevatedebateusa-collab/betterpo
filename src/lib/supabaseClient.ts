import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Room, Representative, RoundAction, TimerBroadcastPayload } from '../types/database';

// Safe fallbacks to prevent any crash during initialization
const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_KEY = 'placeholder-anon-key';

// Check environment variables via Vite import.meta.env (NEVER process.env in client Vite)
const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';
const localUrl = typeof window !== 'undefined' ? localStorage.getItem('elevate_supabase_url') || '' : '';
const localKey = typeof window !== 'undefined' ? localStorage.getItem('elevate_supabase_anon_key') || '' : '';

export const SUPABASE_URL = localUrl || envUrl || FALLBACK_URL;
export const SUPABASE_ANON_KEY = localKey || envKey || FALLBACK_KEY;

export const isSupabaseConfigured = Boolean(
  (localUrl || envUrl) && 
  (localKey || envKey) && 
  (localUrl || envUrl).startsWith('http') && 
  !(localUrl || envUrl).includes('your-project') &&
  !(localUrl || envUrl).includes('placeholder')
);

let initializedSupabase: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  try {
    initializedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (err) {
    console.warn('[Elevate Chamber] Failed to initialize Supabase client. Running in local fallback mode.', err);
    initializedSupabase = null;
  }
} else {
  console.info('[Elevate Chamber] Running in zero-cost local mode (LocalStorage & BroadcastChannel). Supabase URL/Key not configured.');
}

export const supabase: SupabaseClient | null = initializedSupabase;
export default supabase;

// ==========================================
// LOCAL STORAGE & BROADCASTCHANNEL FALLBACK
// (For zero-friction instant demo / offline support)
// ==========================================
const LOCAL_STORAGE_ROOMS_KEY = 'elevate_local_rooms';
const LOCAL_STORAGE_REPS_KEY = 'elevate_local_reps';
const LOCAL_STORAGE_ACTIONS_KEY = 'elevate_local_actions';

// BroadcastChannel for instant cross-tab real-time sync in local mode
const localChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('elevate_chamber_sync')
  : null;

export function getLocalRooms(): Room[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ROOMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalRooms(rooms: Room[]) {
  localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(rooms));
  localChannel?.postMessage({ type: 'ROOMS_UPDATED', payload: rooms });
}

export function getLocalReps(roomId?: string): Representative[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REPS_KEY);
    const all: Representative[] = raw ? JSON.parse(raw) : [];
    return roomId ? all.filter(r => r.room_id === roomId) : all;
  } catch {
    return [];
  }
}

export function saveLocalReps(reps: Representative[]) {
  localStorage.setItem(LOCAL_STORAGE_REPS_KEY, JSON.stringify(reps));
  localChannel?.postMessage({ type: 'REPS_UPDATED', payload: reps });
}

export function getLocalActions(roomId?: string): RoundAction[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ACTIONS_KEY);
    const all: RoundAction[] = raw ? JSON.parse(raw) : [];
    return roomId ? all.filter(a => a.room_id === roomId) : all;
  } catch {
    return [];
  }
}

export function saveLocalActions(actions: RoundAction[]) {
  localStorage.setItem(LOCAL_STORAGE_ACTIONS_KEY, JSON.stringify(actions));
  localChannel?.postMessage({ type: 'ACTIONS_UPDATED', payload: actions });
}

export function broadcastTimerLocally(payload: TimerBroadcastPayload) {
  localChannel?.postMessage({ type: 'TIMER_BROADCAST', payload });
}

export function onLocalBroadcast(callback: (msg: { type: string; payload: unknown }) => void) {
  if (!localChannel) return () => {};
  const handler = (e: MessageEvent) => {
    callback(e.data);
  };
  localChannel.addEventListener('message', handler);
  return () => {
    localChannel.removeEventListener('message', handler);
  };
}
