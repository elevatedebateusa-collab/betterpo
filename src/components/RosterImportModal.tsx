import React, { useState } from 'react';
import { X } from 'lucide-react';
import { parseTabroomRecencyList, type ParsedSenator } from '../lib/rosterParser';

interface RosterImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (reps: Array<{ name: string; school: string; initialRecency?: number }>) => Promise<void>;
}

export const RosterImportModal: React.FC<RosterImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [rawText, setRawText] = useState('');
  const [senatorsList, setSenatorsList] = useState<ParsedSenator[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setRawText(text);
    const parsed = parseTabroomRecencyList(text);
    setSenatorsList(parsed);
  };

  const handleUpdateRecency = (id: string, newRecency: number) => {
    setSenatorsList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, recency: newRecency } : s))
    );
  };

  const handleUpdateName = (id: string, newName: string) => {
    setSenatorsList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: newName } : s))
    );
  };

  const handleUpdateSchool = (id: string, newSchool: string) => {
    setSenatorsList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, school: newSchool } : s))
    );
  };

  const handleRemoveSenator = (id: string) => {
    setSenatorsList((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddSenator = () => {
    const nextRecency = senatorsList.length + 1;
    const newSen: ParsedSenator = {
      id: `senator_modal_${Date.now()}`,
      name: '',
      school: '',
      recency: nextRecency,
    };
    setSenatorsList((prev) => [...prev, newSen]);
  };

  const handleAutoNumber = () => {
    setSenatorsList((prev) =>
      prev.map((s, idx) => ({ ...s, recency: idx + 1 }))
    );
  };

  const handleSortByRecency = () => {
    setSenatorsList((prev) => [...prev].sort((a, b) => a.recency - b.recency));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = senatorsList.filter((s) => s.name.trim().length > 0);
    if (valid.length === 0 && rawText.trim().length > 0) {
      valid = parseTabroomRecencyList(rawText);
    }

    if (valid.length === 0) {
      setError('Please provide at least one valid representative name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = valid.map((s, idx) => ({
        name: s.name.trim(),
        school: s.school.trim(),
        initialRecency: s.recency !== undefined && !isNaN(s.recency) ? s.recency : idx + 1,
      }));
      await onImport(payload);
      setRawText('');
      setSenatorsList([]);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import roster';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white border border-[#CBD5E1] rounded-2xl w-full max-w-xl p-6 sm:p-7 shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base tracking-tight font-serif-editorial">Bulk Ingest Chamber Roster</h3>
            <p className="text-xs text-slate-500 font-mono">Paste directly from Tabroom, SpeechWire, or recency charts</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4 overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <label className="font-bold text-slate-700">
                Debater Names (One Per Line)
              </label>
              <span className="font-mono text-[#006948] font-bold text-xs">
                {senatorsList.length} debaters detected
              </span>
            </div>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder=""
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-sans text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] transition-all resize-none"
            />
          </div>

          {/* Recency Confirmation & Edit List */}
          {senatorsList.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <div className="text-[11px] uppercase font-bold tracking-wider text-slate-700">
                  Confirm Assigned Recency Order:
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAutoNumber}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
                  >
                    1..N
                  </button>
                  <button
                    type="button"
                    onClick={handleSortByRecency}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Sort
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSenator}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {senatorsList.map((sen, idx) => (
                  <div
                    key={sen.id || idx}
                    className="flex items-center gap-2 p-1.5 rounded-xl bg-white border border-slate-200/80"
                  >
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-bold text-slate-400 font-sans">#</span>
                      <input
                        type="number"
                        min={1}
                        value={sen.recency}
                        onChange={(e) =>
                          handleUpdateRecency(sen.id, parseInt(e.target.value, 10) || 1)
                        }
                        className="w-10 h-6 text-center bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold tabular-nums text-slate-900 focus:outline-none focus:border-[#006948]"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder=""
                      value={sen.name}
                      onChange={(e) => handleUpdateName(sen.id, e.target.value)}
                      className="flex-1 min-w-[100px] h-6 bg-transparent px-1.5 text-xs font-sans font-semibold text-slate-900 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder=""
                      value={sen.school}
                      onChange={(e) => handleUpdateSchool(sen.id, e.target.value)}
                      className="w-24 sm:w-36 h-6 bg-transparent px-1.5 text-[11px] font-sans text-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSenator(sen.id)}
                      className="px-1 text-slate-300 hover:text-rose-600 font-mono text-xs transition-colors shrink-0"
                      title="Remove debater"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-sans"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (senatorsList.length === 0 && !rawText.trim())}
              className="px-5 py-2.5 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-bold text-xs uppercase tracking-wider font-sans shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Importing...' : `Confirm Recency & Import (${senatorsList.length || 'All'})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
