import React from 'react';
import { 
  ArrowLeftRight, 
  AlertTriangle, 
  FileText, 
  RotateCcw,
  Vote,
  Paperclip
} from 'lucide-react';
import type { Bill, Room } from '../lib/supabase';

interface CycleSequenceMonitorProps {
  room: Room;
  activeBill: Bill | null;
  onToggleBreakCycle: () => void;
  onOpenDocket: () => void;
  onMoveToPreviousQuestion?: () => void;
}

export const CycleSequenceMonitor: React.FC<CycleSequenceMonitorProps> = ({
  room,
  activeBill,
  onToggleBreakCycle,
  onOpenDocket,
  onMoveToPreviousQuestion,
}) => {
  const speechCountOnBill = activeBill?.speech_count ?? 0;
  const isCycleBroken = activeBill?.cycle_broken ?? false;
  const lastSide = room.last_speech_side;

  let expectedSide: 'author_sponsor' | 'aff' | 'neg' | 'any';
  let sideDescription: string;
  let sideBadgeClass: string;

  if (isCycleBroken) {
    expectedSide = 'any';
    sideDescription = 'Cycle Broken: Chamber may recognize speeches on either side';
    sideBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (speechCountOnBill === 0) {
    expectedSide = 'author_sponsor';
    sideDescription = 'Speech #1: Authorship or Sponsorship';
    sideBadgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
  } else if (lastSide === 'author' || lastSide === 'sponsor' || lastSide === 'aff') {
    expectedSide = 'neg';
    sideDescription = 'Next Expected: Negative Speech';
    sideBadgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
  } else {
    expectedSide = 'aff';
    sideDescription = 'Next Expected: Affirmative Speech';
    sideBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-600">
            Speech & Cycle Sequence Monitor
          </h3>
        </div>

        <button
          onClick={onOpenDocket}
          className="text-xs font-mono font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors"
        >
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span>Docket Bills</span>
        </button>
      </div>

      {/* Active Bill Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
        <div className="space-y-0.5 truncate">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Paperclip className="w-3 h-3 text-slate-400 rotate-45" />
            <span>Active Floor Legislation</span>
          </div>
          <div className="font-serif-editorial font-bold text-slate-900 text-sm truncate">
            {activeBill ? (
              <span>
                <span className="text-emerald-700">{activeBill.bill_number}:</span> {activeBill.title}
              </span>
            ) : room.current_legislation ? (
              room.current_legislation
            ) : (
              'No active bill selected from docket'
            )}
          </div>
          {activeBill?.author_school && (
            <div className="text-[11px] font-mono text-slate-400">
              Author School: {activeBill.author_school}
            </div>
          )}
        </div>

        {/* Speeches on Bill Pill */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-center shadow-sm">
            <div className="text-[9px] text-slate-400 font-mono font-bold uppercase">Speeches</div>
            <div className="text-xs font-mono font-black text-slate-800">
              {speechCountOnBill}
            </div>
          </div>
        </div>
      </div>

      {/* Cycle Indicator & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-0.5">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[11px] font-bold ${sideBadgeClass}`}>
            {expectedSide === 'any' ? (
              <AlertTriangle className="w-3 h-3 text-amber-600" />
            ) : expectedSide === 'neg' ? (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
            <span>{sideDescription}</span>
          </span>
        </div>

        {/* Action Controls: Previous Question (PQ) & Break Cycle Override */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Previous Question (PQ) Action */}
          <button
            onClick={onMoveToPreviousQuestion}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs shadow-sm transition-all"
            title="Move to Previous Question: Vote on bill and advance docket"
          >
            <Vote className="w-3 h-3 text-emerald-400" />
            <span>PQ (Close Debate)</span>
          </button>

          <button
            onClick={onToggleBreakCycle}
            disabled={!activeBill}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-semibold transition-all border disabled:opacity-40 ${
              isCycleBroken
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title={isCycleBroken ? 'Restore Strict Alternating Cycle' : 'Override cycle when no opposite senator rises'}
          >
            {isCycleBroken ? (
              <>
                <RotateCcw className="w-3 h-3" />
                <span>Restore Cycle</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Break Cycle</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CycleSequenceMonitor;
