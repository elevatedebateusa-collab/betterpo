import { SelectionGroup } from '@/components/ui/selection-group';
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Representative } from '../lib/supabase';

interface QuorumVotingBarProps {
  representatives: Representative[];
  onLogVote: (
    motionName: string,
    ayes: number,
    nays: number,
    abstains: number,
    threshold: 'majority' | 'two_thirds',
    passed: boolean,
    advanceNextBill?: boolean
  ) => Promise<void>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialMotionName?: string;
  initialThreshold?: 'majority' | 'two_thirds';
  isPQFlow?: boolean;
}

export const QuorumVotingBar: React.FC<QuorumVotingBarProps> = ({
  representatives,
  onLogVote,
  isOpen,
  onOpenChange,
  initialMotionName = '',
  initialThreshold = 'majority',
  isPQFlow = false,
}) => {
  const [motionName, setMotionName] = useState<string>(initialMotionName || '');
  const [thresholdType, setThresholdType] = useState<'majority' | 'two_thirds'>(initialThreshold);
  const [ayes, setAyes] = useState<number>(0);
  const [nays, setNays] = useState<number>(0);
  const [abstains, setAbstains] = useState<number>(0);
  const [advanceNextBill, setAdvanceNextBill] = useState<boolean>(isPQFlow);
  const [isLogging, setIsLogging] = useState<boolean>(false);

  useEffect(() => {
    if (initialMotionName !== undefined) {
      setMotionName(initialMotionName);
    }
  }, [initialMotionName]);

  useEffect(() => {
    if (initialThreshold) {
      setThresholdType(initialThreshold);
    }
  }, [initialThreshold]);

  useEffect(() => {
    setAdvanceNextBill(isPQFlow);
  }, [isPQFlow]);

  // Quorum Calculations
  const presentSenators = representatives.filter((r) => r.is_present !== false && r.active).length;

  // Simple Majority: > 50% of voting members present
  const simpleMajorityThreshold = Math.floor(presentSenators / 2) + 1;

  // 2/3 Majority: >= 2/3 of members present
  const twoThirdsThreshold = Math.ceil((2 * presentSenators) / 3);

  // Target requirement
  const targetThreshold = thresholdType === 'majority' ? simpleMajorityThreshold : twoThirdsThreshold;
  const votePassed = ayes >= targetThreshold;

  const handleVoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motionName.trim()) return;

    setIsLogging(true);
    try {
      await onLogVote(
        motionName.trim(),
        ayes,
        nays,
        abstains,
        thresholdType,
        votePassed,
        advanceNextBill
      );
      onOpenChange?.(false);
      setMotionName('');
      setAyes(0);
      setNays(0);
      setAbstains(0);
    } finally {
      setIsLogging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white border border-[#CBD5E1] rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
          <div>
            <h3 className="font-serif-editorial font-bold text-slate-900 text-base tracking-tight">
              Chamber Motion Vote
            </h3>
            <p className="font-mono text-[11px] text-slate-500">
              Live tally against {presentSenators} present voting senators
            </p>
          </div>
          <button
            onClick={() => onOpenChange?.(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        <form onSubmit={handleVoteSubmit} className="space-y-4 text-xs">
          {/* Motion Name */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">
              Motion / Legislation Title
            </label>
            <input
              type="text"
              value={motionName}
              onChange={(e) => {
                const val = e.target.value;
                setMotionName(val);
                if (val.toLowerCase().includes('previous question')) {
                  setThresholdType('two_thirds');
                  setAdvanceNextBill(true);
                }
              }}
              required
              placeholder="e.g. Previous Question, Recess, Lay on the Table..."
              className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#006948] focus:ring-2 focus:ring-[#006948]/20 transition-all font-sans text-sm"
              autoFocus
            />
          </div>

          {/* Required Threshold Selection */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">
              Majority Needed
            </label>
            <SelectionGroup
              aria-label="Required voting majority" value={thresholdType} onValueChange={setThresholdType}
              className="grid grid-cols-2" itemClassName="h-full py-3"
              options={[
                { value: 'majority', label: 'Simple Majority (>50%)', description: <>Requires {simpleMajorityThreshold} of {presentSenators} present</> },
                { value: 'two_thirds', label: '2/3 Majority', description: <>Requires {twoThirdsThreshold} of {presentSenators} present</> },
              ]}
            />
          </div>

          {/* Ayes / Nays / Abstain */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-600 font-bold mb-1.5">
              Vote Tally
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <span className="block text-[11px] font-mono font-bold text-emerald-800 mb-1">
                  Ayes (Yes)
                </span>
                <input
                  type="number"
                  min="0"
                  max={presentSenators}
                  value={ayes}
                  onChange={(e) => setAyes(parseInt(e.target.value) || 0)}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 text-center text-lg font-mono font-bold text-emerald-900 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div>
                <span className="block text-[11px] font-mono font-bold text-rose-800 mb-1">
                  Nays (No)
                </span>
                <input
                  type="number"
                  min="0"
                  max={presentSenators}
                  value={nays}
                  onChange={(e) => setNays(parseInt(e.target.value) || 0)}
                  className="w-full bg-rose-50/40 border border-rose-200 rounded-xl px-3 py-2 text-center text-lg font-mono font-bold text-rose-900 focus:bg-white focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 transition-all"
                />
              </div>

              <div>
                <span className="block text-[11px] font-mono font-bold text-slate-600 mb-1">
                  Abstain
                </span>
                <input
                  type="number"
                  min="0"
                  max={presentSenators}
                  value={abstains}
                  onChange={(e) => setAbstains(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center text-lg font-mono font-bold text-slate-700 focus:bg-white focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Advance to next bill checkbox */}
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={advanceNextBill}
              onChange={(e) => setAdvanceNextBill(e.target.checked)}
              className="w-4 h-4 rounded text-[#006948] focus:ring-[#006948] accent-[#006948]"
            />
            <span className="font-mono text-xs text-slate-700">
              Conclude current legislation & advance to next bill on docket
            </span>
          </label>

          {/* Realtime Outcome Banner */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            votePassed
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}>
            <div>
              <div className="font-serif-editorial font-bold text-sm tracking-wide">
                {votePassed ? 'MOTION ADOPTED (PASSES)' : 'MOTION FAILS'}
              </div>
              <div className="text-[11px] font-mono text-slate-600">
                {ayes} Ayes vs. {targetThreshold} required ({thresholdType === 'majority' ? '>50%' : '2/3'})
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onOpenChange?.(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-mono text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLogging}
              className="px-5 py-2.5 rounded-xl font-mono font-bold text-xs bg-[#006948] hover:bg-[#005137] text-white shadow-xs active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isLogging ? (
                'Recording...'
              ) : advanceNextBill ? (
                'Record Vote & Advance Next Bill'
              ) : (
                'Record Motion Vote'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
