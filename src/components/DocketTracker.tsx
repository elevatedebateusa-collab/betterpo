import { SelectionGroup } from '@/components/ui/selection-group';
import React, { useState } from 'react';
import { 
  X, 
  ChevronUp, 
  ChevronDown, 
  GripVertical 
} from 'lucide-react';
import type { Bill, Room } from '../lib/supabase';

interface DocketTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  bills: Bill[];
  onAddBill: (billNumber: string, title: string, authorSchool: string) => Promise<void>;
  onSetActiveBill: (bill: Bill) => Promise<void>;
  onUpdateBillStatus: (billId: string, status: Bill['status']) => Promise<void>;
  onToggleBreakCycle: (bill: Bill) => Promise<void>;
  onReorderBills?: (reorderedBills: Bill[]) => Promise<void> | void;
}

export const DocketTracker: React.FC<DocketTrackerProps> = ({
  isOpen,
  onClose,
  room,
  bills,
  onAddBill,
  onSetActiveBill,
  onUpdateBillStatus,
  onToggleBreakCycle,
  onReorderBills,
}) => {
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [billNumber, setBillNumber] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [authorSchool, setAuthorSchool] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'passed' | 'failed' | 'tabled'>('all');
  const [draggedBillId, setDraggedBillId] = useState<string | null>(null);
  const [dragOverBillId, setDragOverBillId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billNumber.trim() || !title.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddBill(billNumber, title, authorSchool);
      setBillNumber('');
      setTitle('');
      setAuthorSchool('');
      setShowAddForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveUp = (billId: string) => {
    const idx = bills.findIndex((b) => b.id === billId);
    if (idx <= 0) return;
    const newBills = [...bills];
    const temp = newBills[idx];
    newBills[idx] = newBills[idx - 1];
    newBills[idx - 1] = temp;
    if (onReorderBills) onReorderBills(newBills);
  };

  const handleMoveDown = (billId: string) => {
    const idx = bills.findIndex((b) => b.id === billId);
    if (idx === -1 || idx >= bills.length - 1) return;
    const newBills = [...bills];
    const temp = newBills[idx];
    newBills[idx] = newBills[idx + 1];
    newBills[idx + 1] = temp;
    if (onReorderBills) onReorderBills(newBills);
  };

  const handleDragStart = (e: React.DragEvent, billId: string) => {
    e.dataTransfer.setData('text/plain', billId);
    setDraggedBillId(billId);
  };

  const handleDragOver = (e: React.DragEvent, billId: string) => {
    e.preventDefault();
    if (draggedBillId !== billId) {
      setDragOverBillId(billId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetBillId: string) => {
    e.preventDefault();
    setDragOverBillId(null);
    if (!draggedBillId || draggedBillId === targetBillId) {
      setDraggedBillId(null);
      return;
    }

    const fromIdx = bills.findIndex((b) => b.id === draggedBillId);
    const toIdx = bills.findIndex((b) => b.id === targetBillId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedBillId(null);
      return;
    }

    const newBills = [...bills];
    const [moved] = newBills.splice(fromIdx, 1);
    newBills.splice(toIdx, 0, moved);
    setDraggedBillId(null);
    if (onReorderBills) onReorderBills(newBills);
  };

  const handleDragEnd = () => {
    setDraggedBillId(null);
    setDragOverBillId(null);
  };

  const filteredBills = bills.filter((b) => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white border border-[#CBD5E1] rounded-2xl w-full max-w-2xl p-6 sm:p-7 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-[#0A1128] text-lg tracking-tight">Chamber Docket & Bills Tracker</h3>
            <p className="text-xs text-slate-500">Arrange docket order, view voting outcomes, and advance legislation</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Action Controls & Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3">
          {/* Status Filters */}
          <SelectionGroup
            aria-label="Bill status filter" value={filter} onValueChange={setFilter}
            itemClassName="capitalize" className="flex-wrap"
            options={(['all', 'active', 'upcoming', 'passed', 'failed', 'tabled'] as const).map(status => ({ value: status, label: status }))}
          />

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-semibold text-xs shadow-xs transition-colors active:scale-[0.98]"
          >
            <span>Add Bill to Docket</span>
          </button>
        </div>

        {/* Informational Banner */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 mb-3 text-[11px] text-slate-600 flex items-center justify-between gap-2 font-mono">
          <span>Drag bills or click ▲▼ to change docket order. Reordering does not affect the bill currently on the floor.</span>
        </div>

        {/* Add Bill Form */}
        {showAddForm && (
          <form onSubmit={handleAdd} className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 mb-4 space-y-3.5 animate-fade-in text-xs shadow-xs">
            <div className="font-bold text-slate-900 text-sm">New Docket Item</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bill Number</label>
                <input
                  type="text"
                  placeholder=""
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] transition-colors"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bill Title</label>
                <input
                  type="text"
                  placeholder=""
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Author / School Affiliation (Optional)</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder=""
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={authorSchool}
                  onChange={(e) => setAuthorSchool(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] transition-colors"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg bg-[#006948] hover:bg-[#005137] text-white font-semibold transition-colors shadow-xs disabled:opacity-50 active:scale-[0.98]"
                  >
                    Save to Docket
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Bills List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredBills.length === 0 ? (
            <div className="py-14 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <p className="text-slate-700 font-medium text-xs">No bills found in this docket category.</p>
              <p className="text-slate-400 text-[11px]">Click &quot;Add Bill to Docket&quot; above to introduce new legislation.</p>
            </div>
          ) : (
            filteredBills.map((bill) => {
              const docketIndex = bills.findIndex((b) => b.id === bill.id);
              const isFloorActive = room.active_bill_id === bill.id;
              const isBeingDragged = draggedBillId === bill.id;
              const isOver = dragOverBillId === bill.id;

              return (
                <div
                  key={bill.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, bill.id)}
                  onDragOver={(e) => handleDragOver(e, bill.id)}
                  onDrop={(e) => handleDrop(e, bill.id)}
                  onDragEnd={handleDragEnd}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isBeingDragged
                      ? 'opacity-30 border-2 border-dashed border-[#006948] scale-98'
                      : isOver
                      ? 'ring-2 ring-[#006948] bg-emerald-50/70 scale-[1.01] shadow-md'
                      : isFloorActive
                      ? 'bg-emerald-50/60 border-[#006948] ring-1 ring-[#006948]/30 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-start gap-2.5">
                      {/* Drag Handle & Order Stepper */}
                      <div className="flex flex-col items-center justify-center shrink-0 pr-2 border-r border-slate-100 select-none">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(bill.id)}
                          disabled={docketIndex <= 0}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 transition-colors"
                          title="Move bill up in docket order"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <div
                          className="flex items-center gap-0.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 py-0.5"
                          title="Click and drag to reorder docket"
                        >
                          <GripVertical className="w-3 h-3 text-slate-300" />
                          <span className="font-mono text-[10.5px] font-bold text-slate-600">
                            #{docketIndex + 1}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(bill.id)}
                          disabled={docketIndex === -1 || docketIndex >= bills.length - 1}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 transition-colors"
                          title="Move bill down in docket order"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Bill Content */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#006948] text-sm font-serif-editorial">
                            {bill.bill_number}
                          </span>

                          {isFloorActive ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider bg-emerald-100 text-[#006948] border border-emerald-300/80">
                              Active On Floor
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider ${
                                bill.status === 'passed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : bill.status === 'failed'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : bill.status === 'tabled'
                                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                  : 'bg-sky-50 text-sky-700 border border-sky-200'
                              }`}
                            >
                              {bill.status}
                            </span>
                          )}

                          {bill.cycle_broken && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Cycle Broken
                            </span>
                          )}
                        </div>

                        <div className="font-bold text-slate-900 text-sm">
                          {bill.title}
                        </div>
                        {bill.author_school && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            Affiliation: {bill.author_school}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-xs font-mono text-slate-500 shrink-0 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60 self-start sm:self-auto">
                      <span className="text-slate-900 font-bold">{bill.speech_count}</span> speeches given
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      {!isFloorActive && bill.status !== 'passed' && bill.status !== 'failed' && (
                        <button
                          onClick={() => onSetActiveBill(bill)}
                          className="px-3 py-1.5 rounded-lg font-semibold bg-[#006948] hover:bg-[#005137] text-white transition-colors shadow-xs active:scale-[0.98] text-xs"
                          title="Place this bill directly onto the chamber floor"
                        >
                          Set as Active Floor Bill
                        </button>
                      )}

                      {/* Break / Restore Cycle */}
                      <button
                        onClick={() => onToggleBreakCycle(bill)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          bill.cycle_broken
                            ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {bill.cycle_broken ? 'Restore Cycle' : 'Break Cycle'}
                      </button>
                    </div>

                    {/* Voting Outcomes */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onUpdateBillStatus(bill.id, 'passed')}
                        className={`px-2.5 py-1 rounded-lg font-semibold text-xs border transition-colors ${
                          bill.status === 'passed'
                            ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                            : 'bg-emerald-50 hover:bg-[#006948] text-[#006948] hover:text-white border border-emerald-200'
                        }`}
                        title="Mark Bill as Passed by Chamber"
                      >
                        Passed
                      </button>
                      <button
                        onClick={() => onUpdateBillStatus(bill.id, 'failed')}
                        className={`px-2.5 py-1 rounded-lg font-semibold text-xs border transition-colors ${
                          bill.status === 'failed'
                            ? 'bg-rose-600 text-white border-rose-600 font-bold'
                            : 'bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200'
                        }`}
                        title="Mark Bill as Failed / Voted Down"
                      >
                        Failed
                      </button>
                      <button
                        onClick={() => onUpdateBillStatus(bill.id, 'tabled')}
                        className={`px-2.5 py-1 rounded-lg font-semibold text-xs border transition-colors ${
                          bill.status === 'tabled'
                            ? 'bg-slate-700 text-white border-slate-700 font-bold'
                            : 'bg-slate-100 hover:bg-slate-700 text-slate-600 hover:text-white border border-slate-200'
                        }`}
                        title="Table Bill"
                      >
                        Tabled
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
