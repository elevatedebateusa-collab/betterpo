import React, { useState } from 'react';
import type { Representative } from '../lib/supabase';
import { sortRepresentatives } from '../lib/precedence';

interface RecencyLadderProps {
  representatives: Representative[];
  standingIds?: Set<string>;
  currentSpeakerId?: string | null;
  onSelectRep?: (rep: Representative) => void;
  activeMode?: 'speech' | 'question';
  onModeChange?: (mode: 'speech' | 'question') => void;
}

export const RecencyLadder: React.FC<RecencyLadderProps> = ({
  representatives,
  standingIds = new Set(),
  currentSpeakerId = null,
  onSelectRep,
  activeMode = 'speech',
  onModeChange,
}) => {
  const [localMode, setLocalMode] = useState<'speech' | 'question'>('speech');
  const mode = onModeChange ? activeMode : localMode;
  const setMode = onModeChange || setLocalMode;

  const sortedReps = sortRepresentatives(
    representatives.filter((r) => r.active),
    mode
  );

  return (
    <div className="flex flex-col h-full min-h-0 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-1.5">
        <span className="font-mono font-semibold text-xs text-zinc-500 uppercase tracking-wider">
          RECENCY LADDER
        </span>

        {/* Tab Toggle */}
        <div className="bg-zinc-100 p-0.5 rounded border border-zinc-200 text-xs inline-flex shrink-0">
          <button
            type="button"
            onClick={() => setMode('speech')}
            className={`px-2 py-0.5 text-xs transition-colors ${
              mode === 'speech'
                ? 'bg-white text-zinc-900 rounded-sm font-medium'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Speeches
          </button>
          <button
            type="button"
            onClick={() => setMode('question')}
            className={`px-2 py-0.5 text-xs transition-colors ${
              mode === 'question'
                ? 'bg-white text-zinc-900 rounded-sm font-medium'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Questions
          </button>
        </div>
      </div>

      {/* Table Column Headers */}
      <div className="px-1.5 py-1 grid grid-cols-12 gap-1 text-[11px] font-mono uppercase text-zinc-400 border-b border-zinc-200 pb-1.5">
        <div className="col-span-2">Rank</div>
        <div className="col-span-4">Senator</div>
        <div className="col-span-2 text-center">{mode === 'speech' ? 'Speeches' : 'Questions'}</div>
        <div className="col-span-3 text-right">Recency</div>
        <div className="col-span-1 text-center">Stand</div>
      </div>

      {/* Scrollable Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 font-mono text-xs">
        {sortedReps.length === 0 ? (
          <div className="py-8 text-center text-zinc-400 font-mono text-xs">
            No active representatives on the floor.
          </div>
        ) : (
          sortedReps.map((rep) => {
            const isStanding = standingIds.has(rep.id);
            const isSpeaking = currentSpeakerId === rep.id;
            const isPresent = rep.is_present !== false;

            return (
              <div
                key={rep.id}
                onClick={() => onSelectRep?.(rep)}
                className={`px-1.5 py-1.5 grid grid-cols-12 gap-1 items-center border-b border-zinc-100 font-mono tabular-nums text-xs transition-colors cursor-pointer ${
                  !isPresent
                    ? 'opacity-40 bg-zinc-50 line-through'
                    : isSpeaking
                    ? 'bg-amber-50/80 font-medium text-zinc-900'
                    : isStanding
                    ? 'bg-zinc-100 font-medium'
                    : 'hover:bg-zinc-50 text-zinc-600'
                }`}
              >
                {/* Rank */}
                <div className={`col-span-2 font-mono tabular-nums text-xs ${isSpeaking ? 'text-amber-700 font-bold' : 'text-zinc-400'}`}>
                  #{rep.rank}
                </div>

                {/* Senator Name & School */}
                <div className="col-span-4 truncate">
                  <div className="font-semibold text-zinc-900 truncate text-xs">
                    {rep.name}
                  </div>
                  {rep.school && (
                    <div className="font-mono text-[10px] text-zinc-400 truncate">
                      {rep.school}
                    </div>
                  )}
                </div>

                {/* Count */}
                <div className="col-span-2 text-center tabular-nums text-xs text-zinc-700 font-medium">
                  {mode === 'speech' ? rep.speeches_count : rep.questions_count}
                </div>

                {/* Recency Order */}
                <div className="col-span-3 text-right font-mono tabular-nums text-xs text-zinc-500 truncate">
                  {mode === 'speech' ? (
                    rep.speeches_count === 0 && rep.last_speech_order > 0 ? (
                      <span className="text-zinc-700 font-medium">#{rep.last_speech_order} (Init)</span>
                    ) : rep.last_speech_order > 0 ? (
                      <span className="text-zinc-600">#{rep.last_speech_order}</span>
                    ) : (
                      <span className="text-zinc-400">Never</span>
                    )
                  ) : (
                    rep.questions_count === 0 && rep.last_question_order > 0 ? (
                      <span className="text-zinc-700 font-medium">#{rep.last_question_order} (Init)</span>
                    ) : rep.last_question_order > 0 ? (
                      <span className="text-zinc-600">#{rep.last_question_order}</span>
                    ) : (
                      <span className="text-zinc-400">Never</span>
                    )
                  )}
                </div>

                {/* Stand Indicator */}
                <div className="col-span-1 text-center font-mono text-[10px]">
                  {isSpeaking ? (
                    <span className="font-bold text-amber-600">SPK</span>
                  ) : isStanding ? (
                    <span className="font-bold text-zinc-900">STD</span>
                  ) : (
                    <span className="text-zinc-300">-</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RecencyLadder;
