import React, { useState } from 'react';
import { 
  Plus, 
  Play, 
  X, 
  AlertTriangle,
  RotateCcw,
  BookOpen
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
}

export const DocketTracker: React.FC<DocketTrackerProps> = ({
  isOpen,
  onClose,
  bills,
  onAddBill,
  onSetActiveBill,
  onUpdateBillStatus,
  onToggleBreakCycle,
}) => {
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [billNumber, setBillNumber] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [authorSchool, setAuthorSchool] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'passed' | 'failed' | 'tabled'>('all');

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

  const filteredBills = bills.filter((b) => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white border border-[#CBD5E1] rounded-2xl w-full max-w-2xl p-6 sm:p-7 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006948] border border-emerald-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-[#0A1128] text-lg tracking-tight">Chamber Docket & Bills Tracker</h3>
              <p className="text-xs text-slate-500">Manage docket legislation, voting outcomes, and cycle breaks</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Action Controls & Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
          {/* Status Filters */}
          <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs gap-1">
            {(['all', 'active', 'upcoming', 'passed', 'failed', 'tabled'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilter(st)}
                className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition-colors ${
                  filter === st
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-semibold text-xs shadow-xs transition-colors active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Bill to Docket</span>
          </button>
        </div>

        {/* Add Bill Form */}
        {showAddForm && (
          <form onSubmit={handleAdd} className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 mb-5 space-y-3.5 animate-fade-in text-xs shadow-xs">
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
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredBills.length === 0 ? (
            <div className="py-14 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <BookOpen className="w-5 h-5 stroke-[1.5]" />
              </div>
              <p className="text-slate-700 font-medium text-xs">No bills found in this docket category.</p>
              <p className="text-slate-400 text-[11px]">Click &quot;Add Bill to Docket&quot; above to introduce new legislation.</p>
            </div>
          ) : (
            filteredBills.map((bill) => {
              const isActive = bill.status === 'active';

              return (
                <div
                  key={bill.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    isActive
                      ? 'bg-emerald-50/50 border-[#006948] ring-1 ring-[#006948]/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 mb-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#006948] text-sm">
                          {bill.bill_number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            bill.status === 'active'
                              ? 'bg-emerald-100 text-[#006948] border border-emerald-300/60'
                              : bill.status === 'passed'
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
                        {bill.cycle_broken && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
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

                    <div className="text-right text-xs font-mono text-slate-500 shrink-0 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                      <span className="text-slate-900 font-bold">{bill.speech_count}</span> speeches given
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      {!isActive && (
                        <button
                          onClick={() => onSetActiveBill(bill)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-[#006948] hover:bg-[#005137] text-white transition-colors shadow-xs active:scale-[0.98] text-xs"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Set as Active Floor Bill
                        </button>
                      )}

                      {/* Break / Restore Cycle */}
                      <button
                        onClick={() => onToggleBreakCycle(bill)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          bill.cycle_broken
                            ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        {bill.cycle_broken ? 'Restore Cycle' : 'Break Cycle'}
                      </button>
                    </div>

                    {/* Voting Outcomes */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onUpdateBillStatus(bill.id, 'passed')}
                        className="px-2.5 py-1 rounded-lg font-semibold text-xs bg-emerald-50 hover:bg-[#006948] text-[#006948] hover:text-white border border-emerald-200 transition-colors"
                        title="Mark Bill as Passed by Chamber"
                      >
                        Passed
                      </button>
                      <button
                        onClick={() => onUpdateBillStatus(bill.id, 'failed')}
                        className="px-2.5 py-1 rounded-lg font-semibold text-xs bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 transition-colors"
                        title="Mark Bill as Failed"
                      >
                        Failed
                      </button>
                      <button
                        onClick={() => onUpdateBillStatus(bill.id, 'tabled')}
                        className="px-2.5 py-1 rounded-lg font-semibold text-xs bg-slate-100 hover:bg-slate-700 text-slate-600 hover:text-white border border-slate-200 transition-colors"
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
