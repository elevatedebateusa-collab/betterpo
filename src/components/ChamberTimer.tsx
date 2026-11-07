import { SelectionGroup } from '@/components/ui/selection-group';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Minus} from 'lucide-react';
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
  autoStart?: boolean;
}

interface ChamberTimerProps {
  roomCode: string;
  roomId?: string;
  isPO?: boolean;
  floorMode?: 'speech' | 'question';
  speakerId?: string | null;
  speakerName?: string | null;
  questionerName?: string | null;
  onClearSpeaker?: () => void;
  autoStartTrigger?: number; // increments when an action is awarded
  autoStartConfig?: TimerAutoStartConfig;
  onRecessChange?: (isRecess: boolean) => void;
  onTimerTick?: (secondsLeft: number, mode: string) => void;
}

export const ChamberTimer: React.FC<ChamberTimerProps> = ({
  roomCode,
  roomId,
  isPO = false,
  floorMode,
  speakerId = null,
  speakerName = null,
  questionerName = null,
  onClearSpeaker,
  autoStartTrigger = 0,
  autoStartConfig,
  onRecessChange,
  onTimerTick,
}) => {
  const [duration, setDuration] = useState<number>(190); // 3:10 default (3:00 speech + 10s grace)
  const [secondsLeft, setSecondsLeft] = useState<number>(190);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [mode, setMode] = useState<'speech' | 'dq' | 'question' | 'recess' | 'custom'>('speech');

  useEffect(() => {
    onTimerTick?.(secondsLeft, mode);
  }, [secondsLeft, mode, onTimerTick]);

  // Auto-configure timer when action (speech or question) is awarded
  useEffect(() => {
    if (autoStartTrigger > 0 && isPO) {
      const targetMode = autoStartConfig?.mode || 'speech';
      const targetDuration = autoStartConfig?.duration || (targetMode === 'speech' ? 190 : 30);
      // Speech calls do not start immediately (waits for speaker to begin); question calls start immediately
      const shouldAutoRun = autoStartConfig?.autoStart !== undefined
        ? autoStartConfig.autoStart
        : targetMode === 'question';

      setDuration(targetDuration);
      setSecondsLeft(targetDuration);
      setIsRunning(shouldAutoRun);
      setMode(targetMode);
      broadcast(targetDuration, shouldAutoRun, targetDuration, targetMode, autoStartConfig?.questionerName);
      if (roomId) {
        chamberService.updateRoomTimer(
          roomId,
          shouldAutoRun ? 'running' : 'reset',
          targetDuration,
          targetDuration,
          targetMode
        );
      }
    }
  }, [autoStartTrigger, autoStartConfig, isPO, roomId]);

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

          return next;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPO, isRunning, duration, mode, speakerId, speakerName]);

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

  const prevFloorModeRef = useRef<'speech' | 'question' | undefined>(undefined);

  // Automatically switch timer to 30s when PO switches to question calls, or 3:10 for speech calls,
  // but only if the timer is not currently running (do not interrupt an active timer).
  useEffect(() => {
    if (!isPO || !floorMode) return;
    if (prevFloorModeRef.current !== undefined && prevFloorModeRef.current !== floorMode) {
      if (!isRunning) {
        if (floorMode === 'question') {
          applyPreset(30, 'question');
        } else if (floorMode === 'speech') {
          applyPreset(190, 'speech');
        }
      }
    }
    prevFloorModeRef.current = floorMode;
  }, [floorMode, isPO, isRunning]);

  const adjustSeconds = (delta: number) => {
    // In speech stopwatch mode for PO, +15s advances stopwatch elapsed time by 15s (subtracted from secondsLeft)
    const effectiveDelta = (isPO && mode === 'speech') ? -delta : delta;
    const next = secondsLeft + effectiveDelta;
    setSecondsLeft(next);
    broadcast(next, isRunning, duration, mode);
    if (roomId) {
      chamberService.updateRoomTimer(roomId, isRunning ? 'running' : 'paused', next, duration, mode);
    }
  };

  // For PO, speeches count up like a stopwatch; all other modes (and competitor views) count down like a timer
  const displaySeconds = (isPO && mode === 'speech')
    ? Math.max(0, duration - secondsLeft)
    : secondsLeft;

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
          <span className="text-base font-po-ui font-semibold text-slate-800 tracking-tight">
            {mode === 'recess'
              ? 'Recess'
              : mode === 'question'
              ? (autoStartConfig?.questionerName || questionerName
                  ? (speakerName
                      ? `CX: ${extractLastName(speakerName)} (Q: ${extractLastName(autoStartConfig?.questionerName || questionerName)})`
                      : `Question: ${extractLastName(autoStartConfig?.questionerName || questionerName)}`)
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
      </div>

      {/* Main Clock: Crisp Minimalist Stopwatch */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <div className={`font-po-ui text-5xl sm:text-6xl font-extrabold tracking-tight leading-none py-1 ${
            mode === 'recess' ? 'text-amber-600' : isExpired ? 'text-rose-600' : isGrace ? 'text-amber-600' : 'text-slate-900'
          }`}>
            {formatTime(displaySeconds)}
          </div>
        </div>

        {/* PO Controls */}
        {isPO && (
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <button
                onClick={togglePlay}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-mono font-semibold text-xs transition-all shadow-xs ${
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
                className="p-2 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 transition-all"
                title="Reset Clock to Duration"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
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
              onValueChange={handlePresetSelection}
              onReselect={handlePresetSelection}
              size="xs"
              shape="default"
              className="grid grid-cols-3 gap-1"
              itemClassName="min-w-0 px-2 justify-center text-center font-mono font-medium"
              options={[
                { value: 'speech', label: '3:10', title: 'Speech (3:10)' },
                { value: 'question', label: '0:30', title: 'Questioning (0:30)' },
                { value: 'recess', label: '5:00', title: 'Recess (5:00)' },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChamberTimer;
