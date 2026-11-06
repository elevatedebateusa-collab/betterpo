import React, { useState, useEffect, useRef } from 'react';
import { 
  RotateCcw, 
  Volume2, 
  VolumeX 
} from 'lucide-react';
import { 
  supabase, 
  isSupabaseConfigured, 
  broadcastTimerState, 
  subscribeToLocalSync 
} from '../lib/supabase';
import type { TimerBroadcastPayload } from '../lib/supabase';
import { chamberService } from '../lib/chamberService';

function extractLastName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (trimmed.includes(',')) {
    return trimmed.split(',')[0].trim();
  }
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

export interface TimerAutoStartConfig {
  mode: 'speech' | 'question' | 'dq';
  duration: number;
  questionerName?: string | null;
}

interface ChamberTimerProps {
  roomCode: string;
  roomId?: string;
  isPO?: boolean;
  speakerId?: string | null;
  speakerName?: string | null;
  questionerName?: string | null;
  onClearSpeaker?: () => void;
  autoStartTrigger?: number; // increments when an action is awarded
  autoStartConfig?: TimerAutoStartConfig;
  onRecessChange?: (isRecess: boolean) => void;
}

export const ChamberTimer: React.FC<ChamberTimerProps> = ({
  roomCode,
  roomId,
  isPO = false,
  speakerId = null,
  speakerName = null,
  questionerName = null,
  onClearSpeaker,
  autoStartTrigger = 0,
  autoStartConfig,
  onRecessChange,
}) => {
  const [duration, setDuration] = useState<number>(190); // 3:10 default (3:00 speech + 10s grace)
  const [secondsLeft, setSecondsLeft] = useState<number>(190);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [mode, setMode] = useState<'speech' | 'dq' | 'question' | 'recess' | 'custom'>('speech');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [gavelCueFlash, setGavelCueFlash] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Gavel alert tracker flags to prevent duplicate pings
  const pinged1MinRef = useRef<boolean>(false);
  const pinged30SecRef = useRef<boolean>(false);
  const pingedGraceRef = useRef<boolean>(false);
  const pingedExpiredRef = useRef<boolean>(false);

  // Auto-start timer when action (speech or question) is awarded
  useEffect(() => {
    if (autoStartTrigger > 0 && isPO) {
      const targetMode = autoStartConfig?.mode || 'speech';
      const targetDuration = autoStartConfig?.duration || (targetMode === 'speech' ? 190 : 30);

      setDuration(targetDuration);
      setSecondsLeft(targetDuration);
      setIsRunning(true);
      setMode(targetMode);
      resetGavelRefs();
      broadcast(targetDuration, true, targetDuration, targetMode, autoStartConfig?.questionerName);
      if (roomId) {
        chamberService.updateRoomTimer(roomId, 'running', targetDuration, targetDuration, targetMode);
      }
    }
  }, [autoStartTrigger, autoStartConfig, isPO, roomId]);

  const resetGavelRefs = () => {
    pinged1MinRef.current = false;
    pinged30SecRef.current = false;
    pingedGraceRef.current = false;
    pingedExpiredRef.current = false;
  };

  // Synthesize Realistic Wooden Gavel Tap
  const playGavelSound = (taps: number) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      setGavelCueFlash(taps);
      setTimeout(() => setGavelCueFlash(null), taps * 240 + 200);

      for (let i = 0; i < taps; i++) {
        const offset = i * 0.22;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(175, ctx.currentTime + offset);
        osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + offset + 0.12);

        gain.gain.setValueAtTime(0.75, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.18);
      }
    } catch (e) {
      console.warn('Audio playback not initialized:', e);
    }
  };

  // Broadcast timer state
  const broadcast = (
    secs: number,
    running: boolean,
    dur: number,
    timerMode: typeof mode,
    qName?: string | null
  ) => {
    const activeQName = qName !== undefined
      ? qName
      : (autoStartConfig?.questionerName || questionerName || null);

    const payload: TimerBroadcastPayload = {
      room_code: roomCode,
      seconds_left: secs,
      duration: dur,
      is_running: running,
      speaker_id: speakerId,
      speaker_name: speakerName,
      questioner_name: timerMode === 'question' || timerMode === 'dq' ? activeQName : null,
      mode: timerMode,
      timestamp: Date.now(),
    };
    broadcastTimerState(payload);
  };

  // Timer Tick Interval (PO master clock)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isPO && isRunning) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          const next = prev - 1;

          if (mode === 'speech') {
            const oneMinTarget = duration === 190 ? 70 : 60;
            const thirtySecTarget = duration === 190 ? 40 : 30;
            const graceTarget = duration === 190 ? 10 : 0;
            const expiredTarget = duration === 190 ? 0 : -10;

            if (next === oneMinTarget && !pinged1MinRef.current) {
              playGavelSound(1);
              pinged1MinRef.current = true;
            }
            if (next === thirtySecTarget && !pinged30SecRef.current) {
              playGavelSound(2);
              pinged30SecRef.current = true;
            }
            if (next === graceTarget && !pingedGraceRef.current) {
              playGavelSound(3);
              pingedGraceRef.current = true;
            }
            if (next === expiredTarget && !pingedExpiredRef.current) {
              playGavelSound(4);
              pingedExpiredRef.current = true;
            }
          } else if (mode === 'dq' || mode === 'question') {
            if (next === 0 && !pingedGraceRef.current) {
              playGavelSound(2);
              pingedGraceRef.current = true;
            }
          } else if (mode === 'recess') {
            if (next === 0 && !pingedGraceRef.current) {
              playGavelSound(3);
              pingedGraceRef.current = true;
            }
          }

          return next;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPO, isRunning, duration, mode, speakerId, speakerName, soundEnabled]);

  // Subscribe to Realtime Timer Broadcasts (For Spectators)
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const channel = supabase.channel(`timer_${roomCode}`);
      channel
        .on('broadcast', { event: 'timer_ping' }, ({ payload }) => {
          if (!isPO) {
            const data = payload as TimerBroadcastPayload;
            setSecondsLeft(data.seconds_left);
            setDuration(data.duration);
            setIsRunning(data.is_running);
            setMode(data.mode);

            if (data.mode === 'speech') {
              const dur = data.duration || 190;
              const oneMinTarget = dur === 190 ? 70 : 60;
              const thirtySecTarget = dur === 190 ? 40 : 30;
              const graceTarget = dur === 190 ? 10 : 0;
              const expiredTarget = dur === 190 ? 0 : -10;

              if (data.seconds_left === oneMinTarget && !pinged1MinRef.current) {
                playGavelSound(1);
                pinged1MinRef.current = true;
              }
              if (data.seconds_left === thirtySecTarget && !pinged30SecRef.current) {
                playGavelSound(2);
                pinged30SecRef.current = true;
              }
              if (data.seconds_left === graceTarget && !pingedGraceRef.current) {
                playGavelSound(3);
                pingedGraceRef.current = true;
              }
              if (data.seconds_left === expiredTarget && !pingedExpiredRef.current) {
                playGavelSound(4);
                pingedExpiredRef.current = true;
              }
            }
          }
        })
        .subscribe();

      return () => {
        if (supabase) supabase.removeChannel(channel);
      };
    } else {
      const cleanup = subscribeToLocalSync((msg) => {
        if (msg.type === 'TIMER_BROADCAST') {
          const data = msg.data as TimerBroadcastPayload;
          if (data.room_code === roomCode && !isPO) {
            setSecondsLeft(data.seconds_left);
            setDuration(data.duration);
            setIsRunning(data.is_running);
            setMode(data.mode);
          }
        }
      });
      return cleanup;
    }
  }, [roomCode, isPO]);

  // Controls
  const togglePlay = () => {
    const next = !isRunning;
    setIsRunning(next);
    broadcast(secondsLeft, next, duration, mode);
    if (roomId) {
      chamberService.updateRoomTimer(roomId, next ? 'running' : 'paused', secondsLeft, duration, mode);
    }
  };

  const resetClock = (targetSecs?: number) => {
    const target = targetSecs !== undefined ? targetSecs : duration;
    setIsRunning(false);
    setSecondsLeft(target);
    resetGavelRefs();
    broadcast(target, false, duration, mode);
    if (roomId) {
      chamberService.updateRoomTimer(roomId, 'reset', target, duration, mode);
    }
  };

  const applyPreset = (secs: number, timerMode: typeof mode) => {
    setDuration(secs);
    setMode(timerMode);
    setIsRunning(false);
    setSecondsLeft(secs);
    resetGavelRefs();
    if (timerMode === 'recess') {
      onRecessChange?.(true);
    } else {
      onRecessChange?.(false);
    }
    broadcast(secs, false, secs, timerMode);
    if (roomId) {
      chamberService.updateRoomTimer(roomId, 'reset', secs, secs, timerMode);
    }
  };

  const handlePresetSelection = (value: string) => {
    if (value === 'speech') applyPreset(190, 'speech');
    else if (value === 'author') applyPreset(120, 'question');
    else if (value === 'question') applyPreset(30, 'question');
    else if (value === 'recess') applyPreset(300, 'recess');
  };

  const adjustSeconds = (delta: number) => {
    const next = secondsLeft + delta;
    setSecondsLeft(next);
    broadcast(next, isRunning, duration, mode);
    if (roomId) {
      chamberService.updateRoomTimer(roomId, isRunning ? 'running' : 'paused', next, duration, mode);
    }
  };

  const formatTime = (secs: number) => {
    const isNegative = secs < 0;
    const abs = Math.abs(secs);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    const formatted = `${m}:${s < 10 ? '0' : ''}${s}`;
    return isNegative ? `-${formatted}` : formatted;
  };

  const isGrace = duration === 190
    ? (secondsLeft <= 10 && secondsLeft > 0 && mode === 'speech')
    : (secondsLeft <= 0 && secondsLeft >= -10 && mode === 'speech');

  const isExpired = duration === 190
    ? (secondsLeft <= 0 && mode === 'speech')
    : (secondsLeft < -10 && mode === 'speech');

  return (
    <div className="space-y-3 font-sans">
      {/* Top row: Status label, segmented preset tabs, and plain mute button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-zinc-500 truncate">
            {mode === 'recess'
              ? 'Chamber in Recess'
              : mode === 'question'
              ? (autoStartConfig?.questionerName || questionerName
                  ? `Question: ${extractLastName(autoStartConfig?.questionerName || questionerName)}`
                  : speakerName
                  ? `CX: ${extractLastName(speakerName)}`
                  : 'Floor Clear')
              : speakerName
              ? (speakerName.startsWith('Senator ') ? speakerName : `Senator ${speakerName}`)
              : 'Floor Clear'}
          </span>
          {speakerName && isPO && mode !== 'recess' && (
            <button
              onClick={onClearSpeaker}
              className="text-[11px] text-zinc-400 hover:text-rose-600 font-mono transition-colors"
              title="Clear speaker"
            >
              (Clear)
            </button>
          )}

          {/* Gavel Cues & State Alerts */}
          {gavelCueFlash !== null && (
            <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[10px] font-mono font-medium">
              {gavelCueFlash} Tap{gavelCueFlash > 1 ? 's' : ''}
            </span>
          )}
          {isGrace && (
            <span className="px-1.5 py-0.2 rounded border border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-mono font-medium">
              Grace ({duration === 190 ? secondsLeft : 10 + secondsLeft}s)
            </span>
          )}
          {isExpired && (
            <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[10px] font-mono font-medium">
              Gavel Down
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Segmented Preset Tabs: 3:10 Spk | 0:30 CX | 5m Recess */}
          <div className="bg-zinc-100 p-0.5 rounded border border-zinc-200 text-[11px] font-mono inline-flex">
            <button
              type="button"
              onClick={() => handlePresetSelection('speech')}
              className={`px-2 py-0.5 rounded-sm transition-colors ${
                mode === 'speech' && duration === 190
                  ? 'bg-white text-zinc-900 font-medium'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              3:10 Spk
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelection('question')}
              className={`px-2 py-0.5 rounded-sm transition-colors ${
                mode === 'question' && duration === 30
                  ? 'bg-white text-zinc-900 font-medium'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              0:30 CX
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelection('recess')}
              className={`px-2 py-0.5 rounded-sm transition-colors ${
                mode === 'recess'
                  ? 'bg-white text-zinc-900 font-medium'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              5m Recess
            </button>
          </div>

          {/* Plain Mute Button (no green fill) */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="rounded border border-zinc-200 p-1 text-zinc-600 hover:bg-zinc-50 transition-colors"
            title={soundEnabled ? 'Mute Audio Signals' : 'Enable Gavel Sounds'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-zinc-400" />}
          </button>
        </div>
      </div>

      {/* Middle row: Clean clock on the left, horizontal button group on the right */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className={`text-4xl font-mono font-semibold tabular-nums tracking-tight ${
          mode === 'recess' ? 'text-amber-600' : isExpired ? 'text-rose-600' : isGrace ? 'text-amber-600' : 'text-zinc-950'
        }`}>
          {formatTime(secondsLeft)}
        </div>

        {/* PO Controls Horizontal Button Group */}
        {isPO && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={togglePlay}
              className={`h-8 px-3 rounded text-xs font-medium transition-colors ${
                isRunning
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white'
              }`}
            >
              {isRunning ? 'Pause' : 'Start'}
            </button>

            <button
              onClick={() => resetClock()}
              className="h-8 w-8 rounded border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 text-zinc-700 transition-colors"
              title="Reset Clock to Duration"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="inline-flex rounded border border-zinc-200 bg-white overflow-hidden text-xs font-mono h-8">
              <button
                onClick={() => adjustSeconds(-15)}
                className="px-2 hover:bg-zinc-50 text-zinc-700 border-r border-zinc-200 transition-colors"
                title="Minus 15s"
              >
                -15s
              </button>
              <button
                onClick={() => adjustSeconds(15)}
                className="px-2 hover:bg-zinc-50 text-zinc-700 transition-colors"
                title="Add 15s"
              >
                +15s
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChamberTimer;
