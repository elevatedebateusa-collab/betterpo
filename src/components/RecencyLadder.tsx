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
    <div className="rounded-xl bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col h-full min-h-0 overflow-hidden font-sans">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white">
        <span className="font-mono font-bold text-xs text-slate-800 uppercase tracking-wider">
          RECENCY LADDER
        </span>

        {/* Tab Toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 font-mono text-[10.5px]">
          <button
            onClick={() => setMode('speech')}
            className={`px-2.5 py-0.5 rounded font-semibold transition-all ${
              mode === 'speech'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Speeches
          </button>
          <button
            onClick={() => setMode('question')}
            className={`px-2.5 py-0.5 rounded font-semibold transition-all ${
              mode === 'question'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Questions
          </button>
        </div>
      </div>

      {/* Table Column Headers */}
      <div className="px-3 py-1.5 grid grid-cols-12 gap-1 border-b border-slate-100 font-mono text-[9px] text-slate-400 uppercase tracking-wider bg-slate-50/50">
        <div className="col-span-2">Rank</div>
        <div className="col-span-4">Senator</div>
        <div className="col-span-2 text-center">{mode === 'speech' ? 'Speeches' : 'Questions'}</div>
        <div className="col-span-3 text-right">Recency</div>
        <div className="col-span-1 text-center">Stand</div>
      </div>

      {/* Scrollable Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 font-mono text-xs bg-white">
        {sortedReps.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-mono text-xs">
            No active representatives on the floor.
          </div>
        ) : (
          sortedReps.map((rep) => {
            const isStanding = standingIds.has(rep.id);
            const isSpeaking = currentSpeakerId === rep.id;
            const isPresent = rep.is_present !== false;
            const isTopRank = rep.rank === 1;

            return (
              <div
                key={rep.id}
                onClick={() => onSelectRep?.(rep)}
                className={`px-3 py-2 grid grid-cols-12 gap-1 items-center transition-colors cursor-pointer ${
                  !isPresent
                    ? 'opacity-40 bg-slate-50 line-through'
                    : isSpeaking
                    ? 'bg-amber-50/80 border-l-2 border-amber-500 font-semibold text-slate-900'
                    : isTopRank
                    ? 'bg-emerald-50/60 border-l-2 border-emerald-500 font-semibold'
                    : isStanding
                    ? 'bg-slate-100/80 hover:bg-slate-100'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                {/* Rank */}
                <div className={`col-span-2 font-mono text-[11px] ${isTopRank ? 'text-emerald-700 font-bold' : isSpeaking ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>
                  #{rep.rank}
                </div>

                {/* Senator Name & School */}
                <div className="col-span-4 truncate">
                  <div className="font-serif-editorial font-bold text-slate-900 truncate text-[12.5px]">
                    {rep.name}
                  </div>
                  {rep.school && (
                    <div className="font-mono text-[9px] text-slate-400 truncate">
                      {rep.school}
                    </div>
                  )}
                </div>

                {/* Count Badge */}
                <div className="col-span-2 text-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      mode === 'speech'
                        ? rep.speeches_count === 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                        : rep.questions_count === 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {mode === 'speech' ? rep.speeches_count : rep.questions_count}
                  </span>
                </div>

                {/* Recency Order */}
                <div className="col-span-3 text-right font-mono text-[10px] truncate">
                  {mode === 'speech' ? (
                    rep.speeches_count === 0 && rep.last_speech_order > 0 ? (
                      <span className="text-[#006948] font-bold">#{rep.last_speech_order} (Init)</span>
                    ) : rep.last_speech_order > 0 ? (
                      <span className="text-slate-600 font-semibold">#{rep.last_speech_order}</span>
                    ) : (
                      <span className="text-slate-400 font-medium">Never</span>
                    )
                  ) : (
                    rep.questions_count === 0 && rep.last_question_order > 0 ? (
                      <span className="text-[#006948] font-bold">#{rep.last_question_order} (Init)</span>
                    ) : rep.last_question_order > 0 ? (
                      <span className="text-slate-600 font-semibold">#{rep.last_question_order}</span>
                    ) : (
                      <span className="text-slate-400 font-medium">Never</span>
                    )
                  )}
                </div>

                {/* Stand Indicator */}
                <div className="col-span-1 text-center font-mono text-[10px]">
                  {isSpeaking ? (
                    <span className="font-bold text-amber-600">SPK</span>
                  ) : isStanding ? (
                    <span className="font-bold text-slate-900">STD</span>
                  ) : (
                    <span className="text-slate-300">-</span>
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
