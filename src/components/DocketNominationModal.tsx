import { SelectionGroup } from '@/components/ui/selection-group';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import React, { useState } from 'react';
import { 
  X, 
  ChevronUp, 
  ChevronDown, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Layers, 
} from 'lucide-react';
import type { Representative, Room } from '../lib/supabase';

export interface PoolBillItem {
  id: string;
  billNumber: string;
  title: string;
  authorSchool?: string;
}

export interface DocketSlate {
  id: string;
  name: string;
  nominator?: string;
  billIds: string[];
  ayes: number;
  nays: number;
}

interface DocketNominationModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  representatives: Representative[];
  onAdoptDocket: (
    orderedBills: Array<{ billNumber: string; title: string; authorSchool?: string }>
  ) => Promise<void>;
}

export const DocketNominationModal: React.FC<DocketNominationModalProps> = ({
  isOpen,
  onClose,
  representatives,
  onAdoptDocket,
}) => {
  const [step, setStep] = useState<'pool' | 'nominate' | 'vote'>('pool');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showBulkPaste, setShowBulkPaste] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>('');

  // Step 1: Pool of Bills available for the tournament
  const [poolBills, setPoolBills] = useState<PoolBillItem[]>([
    { id: 'pool_1', billNumber: 'Bill 1', title: '', authorSchool: '' },
    { id: 'pool_2', billNumber: 'Bill 2', title: '', authorSchool: '' },
    { id: 'pool_3', billNumber: 'Bill 3', title: '', authorSchool: '' },
  ]);

  // Step 2 & 3: Nominated Dockets and Vote Tallies
  const [slates, setSlates] = useState<DocketSlate[]>([]);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Quorum Calculations
  const presentSenators = representatives.filter((r) => r.is_present !== false && r.active).length;
  const majorityThreshold = Math.floor(presentSenators / 2) + 1;

  // --- STEP 1: POOL MANAGEMENT ---
  const handleAddPoolBill = () => {
    const nextNum = poolBills.length + 1;
    const newBill: PoolBillItem = {
      id: `pool_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      billNumber: `Bill ${nextNum}`,
      title: '',
      authorSchool: '',
    };
    setPoolBills((prev) => [...prev, newBill]);
  };

  const handleRemovePoolBill = (id: string) => {
    if (poolBills.length <= 1) return;
    setPoolBills((prev) => prev.filter((b) => b.id !== id));
  };

  const handleUpdatePoolBill = (id: string, field: keyof PoolBillItem, val: string) => {
    setPoolBills((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: val } : b))
    );
  };

  const handleApplyBulkPaste = () => {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const parsed: PoolBillItem[] = lines.map((line, idx) => {
      let bNum = `Bill ${idx + 1}`;
      let title = line;
      // If line starts with "Bill 1:" or "Item 1 -"
      const match = line.match(/^(bill\s*\d+|res\s*\d+|item\s*\d+)[:.-]?\s*(.*)/i);
      if (match) {
        bNum = match[1].trim();
        title = match[2].trim() || line;
      }
      return {
        id: `pool_bulk_${Date.now()}_${idx}`,
        billNumber: bNum,
        title,
        authorSchool: '',
      };
    });

    setPoolBills(parsed);
    setShowBulkPaste(false);
    setBulkText('');
  };

  const validPoolBills = poolBills.filter((b) => b.title.trim().length > 0);

  // Transition to Step 2
  const handleProceedToNominate = () => {
    if (validPoolBills.length === 0) return;

    // Initialize slates if empty
    if (slates.length === 0) {
      const allIds = validPoolBills.map((b) => b.id);
      const defaultSlate1: DocketSlate = {
        id: 'slate_1',
        name: 'Docket Slate 1',
        nominator: '',
        billIds: [...allIds],
        ayes: 0,
        nays: 0,
      };

      // Create a second reversed/scrambled slate proposal if >1 bill
      const alternativeIds = allIds.length > 1 ? [allIds[1], allIds[0], ...allIds.slice(2)] : [...allIds];
      const defaultSlate2: DocketSlate = {
        id: 'slate_2',
        name: 'Docket Slate 2',
        nominator: '',
        billIds: alternativeIds,
        ayes: 0,
        nays: 0,
      };

      setSlates([defaultSlate1, defaultSlate2]);
    } else {
      // Re-sync missing bills if pool changed
      setSlates((prev) =>
        prev.map((slate) => {
          const validIdsSet = new Set(validPoolBills.map((b) => b.id));
          const existing = slate.billIds.filter((id) => validIdsSet.has(id));
          const missing = validPoolBills.filter((b) => !existing.includes(b.id)).map((b) => b.id);
          return {
            ...slate,
            billIds: [...existing, ...missing],
          };
        })
      );
    }

    setStep('nominate');
  };

  // --- STEP 2: SLATE MANAGEMENT ---
  const handleAddSlate = () => {
    const nextNum = slates.length + 1;
    const newSlate: DocketSlate = {
      id: `slate_${Date.now()}`,
      name: `Docket Slate ${nextNum}`,
      nominator: '',
      billIds: validPoolBills.map((b) => b.id),
      ayes: 0,
      nays: 0,
    };
    setSlates((prev) => [...prev, newSlate]);
  };

  const handleRemoveSlate = (slateId: string) => {
    if (slates.length <= 1) return;
    setSlates((prev) => prev.filter((s) => s.id !== slateId));
  };

  const handleUpdateSlateName = (slateId: string, name: string) => {
    setSlates((prev) =>
      prev.map((s) => (s.id === slateId ? { ...s, name } : s))
    );
  };

  const handleMoveBillInSlate = (slateId: string, billId: string, direction: 'up' | 'down') => {
    setSlates((prev) =>
      prev.map((slate) => {
        if (slate.id !== slateId) return slate;
        const idx = slate.billIds.indexOf(billId);
        if (idx === -1) return slate;
        if (direction === 'up' && idx === 0) return slate;
        if (direction === 'down' && idx === slate.billIds.length - 1) return slate;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        const newIds = [...slate.billIds];
        const temp = newIds[idx];
        newIds[idx] = newIds[targetIdx];
        newIds[targetIdx] = temp;

        return { ...slate, billIds: newIds };
      })
    );
  };

  // Transition to Step 3
  const handleProceedToVote = () => {
    if (slates.length === 0) return;
    setStep('vote');
  };

  // --- STEP 3: VOTING MANAGEMENT ---
  const handleAdjustVote = (slateId: string, type: 'ayes' | 'nays', delta: number) => {
    setSlates((prev) =>
      prev.map((s) => {
        if (s.id !== slateId) return s;
        const current = s[type];
        const next = Math.max(0, Math.min(presentSenators, current + delta));
        return { ...s, [type]: next };
      })
    );
  };

  const handleSetVoteDirect = (slateId: string, type: 'ayes' | 'nays', val: number) => {
    setSlates((prev) =>
      prev.map((s) => {
        if (s.id !== slateId) return s;
        return { ...s, [type]: Math.max(0, Math.min(presentSenators, val)) };
      })
    );
  };

  const handleUnanimousConsent = (slateId: string) => {
    setSlates((prev) =>
      prev.map((s) => (s.id === slateId ? { ...s, ayes: presentSenators, nays: 0 } : s))
    );
    setSelectedWinnerId(slateId);
  };

  // Compute Winning Slate
  // If user explicitly picked one, use that. Otherwise, pick the highest Ayes >= majorityThreshold.
  const activeWinner = (() => {
    if (selectedWinnerId) {
      const found = slates.find((s) => s.id === selectedWinnerId);
      if (found) return found;
    }

    // Check passed majority
    const passed = slates.filter((s) => s.ayes >= majorityThreshold);
    if (passed.length > 0) {
      // Pick highest ayes
      return [...passed].sort((a, b) => b.ayes - a.ayes)[0];
    }

    // Fallback to highest vote overall if any votes cast
    const withVotes = slates.filter((s) => s.ayes > 0);
    if (withVotes.length > 0) {
      return [...withVotes].sort((a, b) => b.ayes - a.ayes)[0];
    }

    return slates[0] || null;
  })();

  const handleFinalAdopt = async () => {
    if (!activeWinner) return;

    // Resolve bill objects in order
    const billMap = new Map<string, PoolBillItem>();
    validPoolBills.forEach((b) => billMap.set(b.id, b));

    const orderedBills: Array<{ billNumber: string; title: string; authorSchool?: string }> = [];
    activeWinner.billIds.forEach((id) => {
      const b = billMap.get(id);
      if (b) {
        orderedBills.push({
          billNumber: b.billNumber,
          title: b.title,
          authorSchool: b.authorSchool,
        });
      }
    });

    setIsSubmitting(true);
    try {
      await onAdoptDocket(orderedBills);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in font-sans">
      <Tabs value={step} activationMode="manual" onValueChange={value => {
        if (value === 'pool') setStep('pool');
        else if (value === 'nominate') handleProceedToNominate();
        else if (value === 'vote') handleProceedToVote();
      }} className="bg-white border border-[#CBD5E1] rounded-2xl w-full max-w-3xl p-5 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-serif-editorial font-bold text-slate-900 text-lg tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#006948]" />
              Docket Nominations & Voting
            </h3>
            <p className="font-mono text-xs text-slate-500">
              Establish tournament legislation sequence via chamber parliamentary vote
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Stepper Tabs */}
        <TabsList aria-label="Docket setup step" size="sm" className="grid grid-cols-3 mb-4 gap-1 w-full">
          <TabsTrigger value="pool" disabled={isSubmitting} className="min-w-0 whitespace-normal"><span>1</span> Legislation Pool</TabsTrigger>
          <TabsTrigger value="nominate" disabled={isSubmitting || validPoolBills.length === 0} className="min-w-0 whitespace-normal"><span>2</span> Nominate Dockets</TabsTrigger>
          <TabsTrigger value="vote" disabled={isSubmitting || slates.length === 0 || validPoolBills.length === 0} className="min-w-0 whitespace-normal"><span>3</span> Chamber Vote</TabsTrigger>
        </TabsList>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 pb-1 space-y-4">
          
          {/* ========================================================
              STEP 1: TOURNAMENT LEGISLATION POOL
              ======================================================== */}
          <TabsContent value="pool" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Session Legislation Items</h4>
                  <p className="text-xs text-slate-500">
                    Input all bills and resolutions available for this session.
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setShowBulkPaste(!showBulkPaste)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
                  >
                    {showBulkPaste ? 'Back to Form' : 'Bulk Paste Titles'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddPoolBill}
                    className="px-3 py-1.5 rounded-lg bg-[#006948] hover:bg-[#005137] text-white font-bold transition-all shadow-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Bill</span>
                  </button>
                </div>
              </div>

              {/* Bulk Paste Box */}
              {showBulkPaste ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <label className="block text-xs font-mono font-bold text-slate-700">
                    Paste Legislation Titles (one per line):
                  </label>
                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`Bill 1: A Resolution to Expand High-Speed Passenger Rail\nBill 2: An Act to Reform Capital Gains Taxation\nBill 3: A Bill to Protect Whistleblowers in AI Safety`}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkPaste(false)}
                      className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-mono text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyBulkPaste}
                      disabled={!bulkText.trim()}
                      className="px-4 py-1.5 rounded-lg bg-[#006948] hover:bg-[#005137] text-white font-mono font-bold text-xs disabled:opacity-50"
                    >
                      Parse Bills ({bulkText.split('\n').filter((l) => l.trim()).length})
                    </button>
                  </div>
                </div>
              ) : (
                /* Individual Bill Input Rows */
                <div className="space-y-2">
                  {poolBills.map((bill, index) => (
                    <div
                      key={bill.id}
                      className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/90 shadow-2xs"
                    >
                      <input
                        type="text"
                        value={bill.billNumber}
                        onChange={(e) => handleUpdatePoolBill(bill.id, 'billNumber', e.target.value)}
                        placeholder={`Bill ${index + 1}`}
                        className="w-24 sm:w-28 font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#006948]"
                      />
                      <input
                        type="text"
                        value={bill.title}
                        onChange={(e) => handleUpdatePoolBill(bill.id, 'title', e.target.value)}
                        placeholder="e.g. A Bill to Reform Corporate Taxation..."
                        className="flex-1 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#006948]"
                      />
                      <input
                        type="text"
                        value={bill.authorSchool || ''}
                        onChange={(e) => handleUpdatePoolBill(bill.id, 'authorSchool', e.target.value)}
                        placeholder="School (Optional)"
                        className="w-28 sm:w-36 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#006948] hidden sm:block"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePoolBill(bill.id)}
                        disabled={poolBills.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30"
                        title="Delete bill"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

          {/* ========================================================
              STEP 2: NOMINATE DOCKET SLATES & REORDER BILLS
              ======================================================== */}
          <TabsContent value="nominate" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Nominated Docket Slates</h4>
                  <p className="text-xs text-slate-500">
                    Senators nominate different docket sequences. Arrange each slate's order using ▲/▼ buttons.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddSlate}
                  className="px-3.5 py-1.5 rounded-lg bg-[#006948] hover:bg-[#005137] text-white font-mono font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nominate Slate</span>
                </button>
              </div>

              {/* Slates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {slates.map((slate, sIdx) => {
                  const billMap = new Map<string, PoolBillItem>();
                  validPoolBills.forEach((b) => billMap.set(b.id, b));

                  return (
                    <div
                      key={slate.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-xs"
                    >
                      {/* Slate Header */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="shrink-0 w-6 h-6 rounded-lg bg-emerald-100 text-[#006948] font-mono text-xs font-bold flex items-center justify-center">
                            {sIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={slate.name}
                            onChange={(e) => handleUpdateSlateName(slate.id, e.target.value)}
                            placeholder={`Docket Slate ${sIdx + 1}`}
                            className="font-bold text-xs text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1 flex-1 focus:outline-none focus:border-[#006948]"
                          />
                        </div>

                        {slates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlate(slate.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Remove nomination slate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Reorderable Bills List for this Slate */}
                      <div className="space-y-1.5 flex-1 max-h-64 overflow-y-auto pr-1">
                        {slate.billIds.map((bId, bIdx) => {
                          const bill = billMap.get(bId);
                          if (!bill) return null;

                          return (
                            <div
                              key={bId}
                              className="p-2 rounded-xl bg-white border border-slate-200/90 flex items-center justify-between gap-2 shadow-2xs text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-bold text-[11px] text-[#006948] shrink-0 w-5 text-center">
                                  #{bIdx + 1}
                                </span>
                                <div className="truncate">
                                  <span className="font-bold text-slate-900 mr-1.5">
                                    {bill.billNumber}:
                                  </span>
                                  <span className="text-slate-600 truncate">
                                    {bill.title}
                                  </span>
                                </div>
                              </div>

                              {/* Up / Down Controls */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={bIdx === 0}
                                  onClick={() => handleMoveBillInSlate(slate.id, bId, 'up')}
                                  className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-20"
                                  title="Move Up"
                                >
                                  <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                                <button
                                  type="button"
                                  disabled={bIdx === slate.billIds.length - 1}
                                  onClick={() => handleMoveBillInSlate(slate.id, bId, 'down')}
                                  className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-20"
                                  title="Move Down"
                                >
                                  <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

          {/* ========================================================
              STEP 3: VOTING ON DOCKET SLATES & ADOPTING OFFICIAL ORDER
              ======================================================== */}
          <TabsContent value="vote" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Chamber Voting on Docket Slates</h4>
                  <p className="text-xs text-slate-500 font-mono">
                    {presentSenators} voting members present • Majority threshold is {majorityThreshold} Ayes
                  </p>
                </div>
              </div>

              <SelectionGroup
                aria-label="Selected docket winner" value={activeWinner?.id || ''} onValueChange={setSelectedWinnerId}
                disabled={isSubmitting}
                options={slates.map((slate, index) => ({ value: slate.id, label: slate.name || 'Docket Slate ' + (index + 1) }))}
              />

              {/* Vote Cards Grid */}
              <div className="space-y-3">
                {slates.map((slate) => {
                  const billMap = new Map<string, PoolBillItem>();
                  validPoolBills.forEach((b) => billMap.set(b.id, b));
                  const hasPassedMajority = slate.ayes >= majorityThreshold;
                  const isCurrentSelectedWinner = activeWinner?.id === slate.id;

                  return (
                    <div
                      key={slate.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCurrentSelectedWinner
                          ? 'bg-emerald-50/60 border-[#006948] ring-2 ring-[#006948]/20 shadow-sm'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">
                              {slate.name}
                            </span>
                            {hasPassedMajority && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-600 text-white">
                                ADOPTED (MAJORITY)
                              </span>
                            )}
                            {isCurrentSelectedWinner && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#006948] text-white">
                                SELECTED DOCKET
                              </span>
                            )}
                          </div>
                          {/* Bill Sequence Summary */}
                          <div className="text-xs font-mono text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-400 font-medium">Sequence:</span>
                            {slate.billIds.map((bId, bIdx) => {
                              const b = billMap.get(bId);
                              return (
                                <span key={bId} className="inline-flex items-center">
                                  <strong className="text-slate-800">{b ? b.billNumber : `#${bIdx + 1}`}</strong>
                                  {bIdx < slate.billIds.length - 1 && <span className="text-slate-400 mx-1">→</span>}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {isCurrentSelectedWinner && <Badge variant="primary" size="sm">Selected Winner</Badge>}
                      </div>

                      {/* Vote Tally Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                        <div className="flex items-center gap-4">
                          {/* Ayes Input */}
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-emerald-800">
                              Ayes (Yes):
                            </span>
                            <div className="flex items-center border border-emerald-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleAdjustVote(slate.id, 'ayes', -1)}
                                className="px-2 py-1 text-emerald-700 hover:bg-emerald-50 font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={presentSenators}
                                value={slate.ayes}
                                onChange={(e) => handleSetVoteDirect(slate.id, 'ayes', parseInt(e.target.value) || 0)}
                                className="w-12 text-center font-mono font-bold text-emerald-900 text-sm focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleAdjustVote(slate.id, 'ayes', 1)}
                                className="px-2 py-1 text-emerald-700 hover:bg-emerald-50 font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Nays Input */}
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-rose-800">
                              Nays (No):
                            </span>
                            <div className="flex items-center border border-rose-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleAdjustVote(slate.id, 'nays', -1)}
                                className="px-2 py-1 text-rose-700 hover:bg-rose-50 font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={presentSenators}
                                value={slate.nays}
                                onChange={(e) => handleSetVoteDirect(slate.id, 'nays', parseInt(e.target.value) || 0)}
                                className="w-12 text-center font-mono font-bold text-rose-900 text-sm focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleAdjustVote(slate.id, 'nays', 1)}
                                className="px-2 py-1 text-rose-700 hover:bg-rose-50 font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Quick Unanimous Consent Button */}
                        <button
                          type="button"
                          onClick={() => handleUnanimousConsent(slate.id)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono text-xs font-semibold transition-colors"
                        >
                          Unanimous Consent
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Official Winner Banner */}
              {activeWinner && (
                <div className="bg-[#006948] text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in font-sans">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-200 font-bold">
                      Winning Docket Established
                    </div>
                    <div className="text-base font-bold">
                      {activeWinner.name} will be the official chamber docket
                    </div>
                    <div className="text-xs text-emerald-100 font-mono">
                      First bill on the floor will be:{' '}
                      <strong className="text-white">
                        {validPoolBills.find((b) => b.id === activeWinner.billIds[0])?.billNumber || 'Bill 1'}:{' '}
                        {validPoolBills.find((b) => b.id === activeWinner.billIds[0])?.title || 'General Orders'}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleFinalAdopt}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-[#006948] font-mono font-bold text-xs shadow-md transition-all active:scale-[0.98] shrink-0 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Starting Round...' : 'Adopt Docket & Start Round →'}
                  </button>
                </div>
              )}
            </TabsContent>

        </div>

        {/* Modal Footer Controls */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0 font-mono text-xs">
          <div>
            {step === 'nominate' && (
              <button
                type="button"
                onClick={() => setStep('pool')}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Bills Pool</span>
              </button>
            )}

            {step === 'vote' && (
              <button
                type="button"
                onClick={() => setStep('nominate')}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Docket Slates</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>

            {step === 'pool' && (
              <button
                type="button"
                onClick={handleProceedToNominate}
                disabled={validPoolBills.length === 0}
                className="px-5 py-2.5 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>Nominate Dockets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 'nominate' && (
              <button
                type="button"
                onClick={handleProceedToVote}
                disabled={slates.length === 0}
                className="px-5 py-2.5 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>Proceed to Chamber Vote</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 'vote' && (
              <button
                type="button"
                onClick={handleFinalAdopt}
                disabled={isSubmitting || !activeWinner}
                className="px-5 py-2.5 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Starting...' : 'Adopt Docket & Start Round'}</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );
};

