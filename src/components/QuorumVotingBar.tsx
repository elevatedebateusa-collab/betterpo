import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Vote, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  Zap
} from 'lucide-react';
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
  initialMotionName,
  initialThreshold,
  isPQFlow = false,
}) => {
  const [internalShowVoteModal, setInternalShowVoteModal] = useState<boolean>(false);
  const showVoteModal = isOpen !== undefined ? isOpen : internalShowVoteModal;

  const setShowVoteModal = (open: boolean) => {
    setInternalShowVoteModal(open);
    onOpenChange?.(open);
  };

  const [motionName, setMotionName] = useState<string>(
    initialMotionName || 'Previous Question (Close Debate)'
  );
  const [thresholdType, setThresholdType] = useState<'majority' | 'two_thirds'>(
    initialThreshold || 'two_thirds'
  );
  const [ayes, setAyes] = useState<number>(0);
  const [nays, setNays] = useState<number>(0);
  const [abstains, setAbstains] = useState<number>(0);
  const [isLogging, setIsLogging] = useState<boolean>(false);

  useEffect(() => {
    if (initialMotionName) {
      setMotionName(initialMotionName);
    }
  }, [initialMotionName]);

  useEffect(() => {
    if (initialThreshold) {
      setThresholdType(initialThreshold);
    }
  }, [initialThreshold]);

  // Quorum Calculations
  const totalSenators = representatives.length;
  const presentSenators = representatives.filter((r) => r.is_present && r.active).length;
  const awaySenators = totalSenators - presentSenators;

  // Simple Majority: > 50% of voting members present
  const simpleMajorityThreshold = Math.floor(presentSenators / 2) + 1;

  // 2/3 Majority: >= 2/3 of members present
  const twoThirdsThreshold = Math.ceil((2 * presentSenators) / 3);

  // Quorum Met Threshold (> 50% of chamber present)
  const isQuorumMet = presentSenators >= Math.floor(totalSenators / 2) + 1;

  // Realtime Vote Calculation
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
        isPQFlow
      );
      setShowVoteModal(false);
      setAyes(0);
      setNays(0);
      setAbstains(0);
    } finally {
      setIsLogging(false);
    }
  };

  const presetMotions = [
    { label: 'Previous Question (Close Debate)', threshold: 'two_thirds' as const },
    { label: 'Lay on the Table (Table Bill)', threshold: 'majority' as const },
    { label: 'Take from Table', threshold: 'majority' as const },
    { label: 'Limit or Extend Debate', threshold: 'two_thirds' as const },
    { label: 'Recess Chamber', threshold: 'majority' as const },
    { label: 'Vote on Floor Amendment', threshold: 'majority' as const },
    { label: 'Vote on Final Passage of Bill', threshold: 'majority' as const },
  ];

  return (
    <>
      {/* Live Quorum & Threshold Ledger Bar */}
      <div className="bg-parchment-card border border-pencil/30 rounded-lg p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-paper">
        {/* Quorum Stats */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${isQuorumMet ? 'bg-sage-soft text-sage-dark border border-sage/30' : 'bg-terracotta-soft text-terracotta-dark border border-terracotta/30'}`}>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-lead-light font-bold uppercase tracking-wider">Chamber Quorum</div>
              <div className="font-serif font-bold text-charcoal text-xs flex items-center gap-1.5">
                <span>{presentSenators} / {totalSenators} Present</span>
                {awaySenators > 0 && (
                  <span className="text-[10px] text-terracotta font-mono font-normal">({awaySenators} away)</span>
                )}
                {!isQuorumMet && totalSenators > 0 && (
                  <span className="text-[10px] text-terracotta-dark font-mono font-bold">⚠️ No Quorum</span>
                )}
              </div>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-pencil/20 hidden sm:block" />

          {/* Simple Majority */}
          <div>
            <div className="text-[10px] text-lead-light font-bold uppercase tracking-wider">Majority (&gt;50%)</div>
            <div className="font-bold text-sage-dark text-xs">
              {simpleMajorityThreshold} votes
            </div>
          </div>

          <div className="h-5 w-[1px] bg-pencil/20 hidden sm:block" />

          {/* 2/3 Majority */}
          <div>
            <div className="text-[10px] text-lead-light font-bold uppercase tracking-wider">2/3 Vote (PQ/Cloture)</div>
            <div className="font-bold text-pen-blue text-xs">
              {twoThirdsThreshold} votes
            </div>
          </div>
        </div>

        {/* Quick Vote Logger Trigger Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVoteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-kraft hover:bg-parchment-dark text-charcoal border border-pencil/40 font-mono text-xs font-bold transition-all shadow-paper active:translate-y-0.5"
          >
            <Vote className="w-3.5 h-3.5 text-pencil" />
            <span>Record Motion Vote</span>
          </button>
        </div>
      </div>

      {/* VOTE LOGGER MODAL */}
      {showVoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-parchment-card border-2 border-pencil/40 rounded-xl w-full max-w-lg p-5 sm:p-6 shadow-paper-lg relative">
            {/* Top Washi Tape Accent */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-28 h-5 washi-tape-buff rotate-[-1deg] shadow-xs" />

            <div className="flex items-center justify-between pb-3 mb-4 border-b border-pencil/20">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded border ${isPQFlow ? 'bg-terracotta-soft text-terracotta-dark border-terracotta/40' : 'bg-kraft/60 text-pencil border-pencil/30'}`}>
                  {isPQFlow ? <Zap className="w-4 h-4 text-terracotta" /> : <Vote className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-charcoal text-base">
                    {isPQFlow ? 'Previous Question & Docket Advance' : 'Chamber Motion Vote Record'}
                  </h3>
                  <p className="font-mono text-[11px] text-lead-light">
                    {isPQFlow
                      ? 'Conclude debate, record bill vote, and advance to next docket item'
                      : 'Audit ledger tally against live roll call quorum'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVoteModal(false)}
                className="text-lead-light hover:text-charcoal font-mono text-base p-1"
              >
                ✕
              </button>
            </div>

            {isPQFlow && (
              <div className="p-3 mb-3 rounded bg-terracotta-soft/70 border border-terracotta/40 text-terracotta-dark text-xs flex items-start gap-2.5">
                <div className="px-1.5 py-0.5 rounded bg-terracotta text-parchment font-mono font-bold text-[10px] uppercase tracking-wider shrink-0 mt-0.5">
                  PQ Motion
                </div>
                <div className="leading-relaxed font-serif">
                  Submitting this vote will conclude debate on the current legislation and immediately advance the chamber to the next bill in docket order.
                </div>
              </div>
            )}

            <form onSubmit={handleVoteSubmit} className="space-y-4 text-xs">
              {/* Presets */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-lead-light font-bold mb-1.5">
                  Preset Motions
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {presetMotions.map((m) => (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => {
                        setMotionName(m.label);
                        setThresholdType(m.threshold);
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
                        motionName === m.label
                          ? 'bg-terracotta/15 border-terracotta text-terracotta-dark font-bold shadow-xs'
                          : 'bg-parchment border-pencil/30 text-pencil hover:bg-parchment-shade'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Motion Name */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-lead-light font-bold mb-1">
                  Motion / Legislation Title
                </label>
                <input
                  type="text"
                  value={motionName}
                  onChange={(e) => setMotionName(e.target.value)}
                  required
                  placeholder="e.g. Motion for the Previous Question"
                  className="w-full bg-parchment border border-pencil/30 rounded px-3 py-2 text-charcoal font-serif text-sm focus:outline-none focus:border-terracotta shadow-inner"
                />
              </div>

              {/* Threshold Selection */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-lead-light font-bold mb-1">
                  Required Threshold
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setThresholdType('majority')}
                    className={`p-2.5 rounded border text-left transition-all ${
                      thresholdType === 'majority'
                        ? 'bg-sage-soft border-sage text-sage-dark shadow-xs ring-1 ring-sage/40'
                        : 'bg-parchment border-pencil/30 text-pencil hover:bg-parchment-shade'
                    }`}
                  >
                    <div className="font-serif font-bold text-xs">Simple Majority (&gt;50%)</div>
                    <div className="text-[10px] font-mono text-lead-light mt-0.5">
                      Needs {simpleMajorityThreshold} of {presentSenators} present
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThresholdType('two_thirds')}
                    className={`p-2.5 rounded border text-left transition-all ${
                      thresholdType === 'two_thirds'
                        ? 'bg-terracotta-soft border-terracotta text-terracotta-dark shadow-xs ring-1 ring-terracotta/40'
                        : 'bg-parchment border-pencil/30 text-pencil hover:bg-parchment-shade'
                    }`}
                  >
                    <div className="font-serif font-bold text-xs">2/3 Majority</div>
                    <div className="text-[10px] font-mono text-lead-light mt-0.5">
                      Needs {twoThirdsThreshold} of {presentSenators} present
                    </div>
                  </button>
                </div>
              </div>

              {/* Ayes / Nays / Abstains Count */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-sage-dark font-bold mb-1">
                    Ayes (Aye)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={presentSenators}
                    value={ayes}
                    onChange={(e) => setAyes(parseInt(e.target.value) || 0)}
                    className="w-full bg-parchment border border-sage/50 rounded px-3 py-2 text-center text-lg font-mono font-bold text-sage-dark focus:outline-none focus:border-sage shadow-inner"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-terracotta-dark font-bold mb-1">
                    Nays (No)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={presentSenators}
                    value={nays}
                    onChange={(e) => setNays(parseInt(e.target.value) || 0)}
                    className="w-full bg-parchment border border-terracotta/50 rounded px-3 py-2 text-center text-lg font-mono font-bold text-terracotta-dark focus:outline-none focus:border-terracotta shadow-inner"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-lead-light font-bold mb-1">
                    Abstain
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={presentSenators}
                    value={abstains}
                    onChange={(e) => setAbstains(parseInt(e.target.value) || 0)}
                    className="w-full bg-parchment border border-pencil/30 rounded px-3 py-2 text-center text-lg font-mono font-bold text-pencil focus:outline-none focus:border-pencil shadow-inner"
                  />
                </div>
              </div>

              {/* Live Outcome Indicator */}
              <div className={`p-3 rounded border-2 flex items-center justify-between ${
                votePassed
                  ? 'bg-sage-soft border-sage text-sage-dark'
                  : 'bg-terracotta-soft border-terracotta text-terracotta-dark'
              }`}>
                <div className="flex items-center gap-2">
                  {votePassed ? <CheckCircle2 className="w-5 h-5 text-sage-dark" /> : <XCircle className="w-5 h-5 text-terracotta-dark" />}
                  <div>
                    <div className="font-serif font-bold text-sm tracking-wide">
                      {votePassed ? 'MOTION ADOPTED (PASSES)' : 'MOTION FAILS'}
                    </div>
                    <div className="text-[11px] font-mono opacity-90">
                      {ayes} Ayes vs. {targetThreshold} required ({thresholdType === 'majority' ? '>50%' : '2/3'})
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-pencil/20">
                <button
                  type="button"
                  onClick={() => setShowVoteModal(false)}
                  className="px-4 py-2 rounded text-pencil hover:text-charcoal font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLogging}
                  className={`px-4 py-2 rounded font-mono font-bold text-xs transition-all shadow-paper active:translate-y-0.5 flex items-center gap-1.5 border ${
                    isPQFlow
                      ? 'bg-terracotta hover:bg-terracotta-dark text-parchment border-terracotta-dark'
                      : 'bg-sage hover:bg-sage-dark text-parchment border-sage-dark'
                  }`}
                >
                  {isLogging ? (
                    'Recording...'
                  ) : isPQFlow ? (
                    <>
                      <span>Record Vote & Advance Next Bill</span>
                      <ArrowRight className="w-4 h-4 ml-0.5" />
                    </>
                  ) : (
                    'Log Vote to Session Audit'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
