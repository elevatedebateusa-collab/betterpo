import React, { useState } from 'react';
import { UserPlus, X, AlertCircle } from 'lucide-react';

interface RosterImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (reps: Array<{ name: string; school: string }>) => Promise<void>;
}

const parseRosterInput = (text: string): Array<{ name: string; school: string }> => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      if (line.includes(' - ')) {
        const [name, ...rest] = line.split(' - ');
        return { name: name.trim(), school: rest.join(' - ').trim() };
      }
      if (line.includes('\t')) {
        const [name, ...rest] = line.split('\t');
        return { name: name.trim(), school: rest.join(' ').trim() };
      }
      const parenMatch = line.match(/^([^(]+)\(([^)]+)\)$/);
      if (parenMatch) {
        return { name: parenMatch[1].trim(), school: parenMatch[2].trim() };
      }
      if (line.includes(',')) {
        const [name, ...rest] = line.split(',');
        return { name: name.trim(), school: rest.join(',').trim() };
      }
      return { name: line, school: '' };
    })
    .filter(item => item.name.length > 0);
};

export const RosterImportModal: React.FC<RosterImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const parsed = parseRosterInput(rawText);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsed.length === 0) {
      setError('Please provide at least one valid representative name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onImport(parsed);
      setRawText('');
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
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#006948] border border-emerald-100 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base tracking-tight">Bulk Ingest Chamber Roster</h3>
              <p className="text-xs text-slate-500">Paste directly from Tabroom, SpeechWire, or sheets</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4 overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <label className="font-bold text-slate-700">
                Debater Names (One Per Line)
              </label>
              <span className="font-mono text-[#006948] font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80">
                {parsed.length} debaters detected
              </span>
            </div>
            <textarea
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Marcus Chen - Bronx Science&#10;Aria Patel - Greenhill&#10;Leo Vance - Stuyvesant&#10;Sophia Morales (Bellarmine)"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] transition-all resize-none"
            />
          </div>

          {/* Quick Preview */}
          {parsed.length > 0 && (
            <div className="flex-1 overflow-y-auto max-h-32 bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                Preview First {Math.min(parsed.length, 5)} Names:
              </div>
              {parsed.slice(0, 5).map((p, idx) => (
                <div key={idx} className="flex justify-between py-1 text-slate-700 border-b border-slate-200/40 last:border-0">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-slate-500 text-[11px] font-mono">{p.school || 'No school'}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
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
              disabled={isSubmitting || parsed.length === 0}
              className="px-5 py-2.5 rounded-full bg-[#006948] hover:bg-[#005137] text-white font-bold text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Importing...' : `Import ${parsed.length} Senators`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
