import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Room, Representative, Bill } from '../lib/supabase';

interface AmendmentWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  bills: Bill[];
  representatives: Representative[];
  onStartAmendment: (authorId: string, authorName: string, text: string) => Promise<void>;
  onConcludeAmendment: (passed: boolean, motionNotes?: string) => Promise<void>;
  onRequestVote: (title: string, threshold: 'one_third' | 'two_thirds' | 'majority') => void;
}

export const AmendmentWorkflowModal: React.FC<AmendmentWorkflowModalProps> = ({
  isOpen,
  onClose,
  room,
  bills,
  representatives,
  onStartAmendment,
  onConcludeAmendment,
  onRequestVote,
}) => {
  const [authorId, setAuthorId] = useState('');
  const [amendmentText, setAmendmentText] = useState('');
  const [voteNotes, setVoteNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const activeAmendment = room.active_amendment;
  const amendmentStage = activeAmendment?.stage || 'debate';
  const activeBill = bills.find((b) => b.status === 'active') || null;
  const presentReps = representatives.filter((r) => r.is_present);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorId || !amendmentText.trim()) return;

    const rep = representatives.find((r) => r.id === authorId);
    if (!rep) return;

    setSubmitting(true);
    try {
      await onStartAmendment(authorId, rep.name, amendmentText.trim());
      setAuthorId('');
      setAmendmentText('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleConclude = async (passed: boolean) => {
    setSubmitting(true);
    try {
      await onConcludeAmendment(passed, voteNotes.trim() || undefined);
      setVoteNotes('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-xl bg-white border border-[#CBD5E1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-serif-editorial flex items-center gap-2">
              Floor Amendment Workflow
              {activeAmendment && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-100 text-amber-800 border border-amber-300">
                  ACTIVE
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              {activeBill ? `Target: ${activeBill.bill_number} - ${activeBill.title}` : 'No active bill set'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {activeAmendment ? (
            /* ACTIVE AMENDMENT STATE */
            <div className="space-y-5">
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-amber-900 font-bold text-sm">
                    Floor Amendment Pending Consideration
                  </div>
                  <div className="text-xs text-amber-800 font-mono">
                    {activeAmendment.speeches_count} speeches given
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3.5 border border-amber-200/80 space-y-1.5 shadow-xs">
                  <div className="text-xs text-slate-500 font-mono">
                    Author: <span className="text-slate-900 font-bold">{activeAmendment.author_name}</span>
                  </div>
                  <div className="text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                    &ldquo;{activeAmendment.text}&rdquo;
                  </div>
                </div>

                <p className="text-xs text-amber-800 leading-normal">
                  {amendmentStage === 'pending_second' ? 'The motion to consider this amendment requires a one-third vote before debate begins.' : amendmentStage === 'debate' ? 'Debate is restricted to this amendment. Use the normal speech controls; each recognized speech is recorded as amendment debate.' : amendmentStage === 'previous_question' ? 'Previous question has been moved. A two-thirds vote is required before the amendment is put to a final vote.' : 'Previous question passed. The amendment now requires a simple majority vote.'}
                </p>

                {amendmentStage === 'pending_second' && <button type="button" disabled={submitting} onClick={() => onRequestVote('Motion to Consider Amendment (1/3)', 'one_third')} className="w-full px-4 py-3 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-bold text-xs disabled:opacity-50">Record 1/3 Vote to Consider Amendment</button>}
                {amendmentStage === 'debate' && <button type="button" disabled={submitting} onClick={() => onRequestVote('Previous Question on Amendment (2/3)', 'two_thirds')} className="w-full px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs disabled:opacity-50">Move to Previous Question (2/3)</button>}
                {amendmentStage === 'previous_question' && <button type="button" disabled={submitting} onClick={() => onRequestVote('Adoption of Amendment (Simple Majority)', 'majority')} className="w-full px-4 py-3 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-bold text-xs disabled:opacity-50">Vote on Amendment (Simple Majority)</button>}
              </div>

              {/* Vote notes input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Vote Outcome Notes / Tally (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 14-8 or Voice Vote with unanimous consent"
                  value={voteNotes}
                  onChange={(e) => setVoteNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948]"
                />
              </div>

              {/* Conclude Actions */}
              {activeAmendment.stage === 'final_vote' && <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleConclude(true)}
                  className="px-4 py-3 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-bold text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 text-center"
                >
                  Adopt Amendment (Passed)
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleConclude(false)}
                  className="px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 text-center"
                >
                  Reject Amendment (Failed)
                </button>
              </div>}
            </div>
          ) : (
            /* NEW AMENDMENT CREATION */
            <form onSubmit={handleStart} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Amendment Author (Senator)</span>
                  <span className="text-[11px] text-slate-400 font-mono font-normal">{presentReps.length} senators present</span>
                </label>
                <select
                  required
                  value={authorId}
                  onChange={(e) => setAuthorId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948]"
                >
                  <option value="">Select author...</option>
                  {presentReps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name} {rep.school ? `(${rep.school})` : ''} — {rep.speeches_count} spk
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Amendment Text / Changes
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder='e.g., "Amend Section 2, Line 15 to strike the words \"five years\" and insert \"two years\"."'
                  value={amendmentText}
                  onChange={(e) => setAmendmentText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] resize-none font-mono"
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">
                  NSDA Parliamentary Rule Reminder:
                </div>
                <p className="leading-relaxed">
                  Floor amendments must be germane and in writing. Upon introducing, the chair immediately entertains debate on the amendment starting with the amendment author or first sponsor.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !authorId || !amendmentText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-bold text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Introduce Floor Amendment
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
