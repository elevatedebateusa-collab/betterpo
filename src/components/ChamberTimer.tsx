import { SelectionGroup } from '@/components/ui/selection-group';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Minus, 
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
    <div className={`transition-all duration-200 relative ${
      mode === 'recess'
        ? 'text-amber-900'
        : isExpired
        ? 'text-rose-900'
        : isGrace
        ? 'text-amber-900'
        : 'text-slate-900'
    }`}>
      {/* Top Banner: Senator [Full Name] or Floor Clear */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-base font-serif-editorial font-bold text-slate-900 tracking-tight">
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
              className="text-[11px] text-slate-400 hover:text-rose-600 font-mono transition-colors"
              title="Clear speaker"
            >
              (Clear)
            </button>
          )}
        </div>

        {/* Gavel Cues Visual Indicators & Sound Toggle */}
        <div className="flex items-center gap-2">
          {gavelCueFlash !== null && (
            <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-mono font-bold animate-bounce shadow-sm">
              <span>{gavelCueFlash} Tap{gavelCueFlash > 1 ? 's' : ''}</span>
            </span>
          )}

          {isGrace && (
            <span className="px-2 py-0.5 rounded bg-amber-500 text-white text-xs font-mono font-bold animate-pulse shadow-sm">
              <span>Grace ({duration === 190 ? secondsLeft : 10 + secondsLeft}s)</span>
            </span>
          )}

          {isExpired && (
            <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-mono font-bold shadow-sm">
              <span>Gavel Down</span>
            </span>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              soundEnabled
                ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                : 'bg-white border-slate-200 text-slate-400'
            }`}
            title={soundEnabled ? 'Mute Audio Signals' : 'Enable Gavel Sounds'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Clock: Crisp Minimalist Stopwatch */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <div className={`font-mono text-4xl sm:text-5xl font-black tracking-tight leading-none py-1 ${
            mode === 'recess' ? 'text-amber-600' : isExpired ? 'text-rose-600' : isGrace ? 'text-amber-600' : 'text-slate-900'
          }`}>
            {formatTime(secondsLeft)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 justify-center sm:justify-start font-mono">
            <span className="font-bold text-slate-700">
              {mode.toUpperCase()} ({Math.floor(duration / 60)}:{duration % 60 < 10 ? '0' : ''}{duration % 60})
            </span>
            <span>•</span>
            <span className={isRunning ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
              {isRunning ? 'Running' : 'Standby'}
            </span>
          </div>
        </div>

        {/* PO Controls */}
        {isPO && (
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <button
                onClick={togglePlay}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg font-mono font-bold text-xs transition-all shadow-sm ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> <span>Start</span>
                  </>
                )}
              </button>

              <button
                onClick={() => resetClock()}
                className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 transition-all"
                title="Reset Clock to Duration"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <button
                  onClick={() => adjustSeconds(-15)}
                  className="px-2 py-1 text-[11px] font-mono font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-r border-slate-200"
                  title="Minus 15s"
                >
                  <Minus className="w-3 h-3 inline" />15s
                </button>
                <button
                  onClick={() => adjustSeconds(15)}
                  className="px-2 py-1 text-[11px] font-mono font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  title="Add 15s"
                >
                  <Plus className="w-3 h-3 inline" />15s
                </button>
              </div>
            </div>

            {/* Presets Grid */}
            <SelectionGroup
              aria-label="Timer preset"
              value={mode === 'recess' ? 'recess' : mode === 'speech' && duration === 190 ? 'speech' : mode === 'question' && duration === 30 ? 'question' : ''}
              onValueChange={handlePresetSelection} onReselect={handlePresetSelection} size="xs"
              className="grid grid-cols-2 sm:grid-cols-4 gap-1" itemClassName="min-w-0 px-1.5"
              options={[
                { value: 'speech', label: '3:10 Spk' },
                { value: 'question', label: '0:30 CX', title: 'Questioning' },
                { value: 'recess', label: '5m Recess' },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChamberTimer;
