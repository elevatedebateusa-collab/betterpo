import { SelectionGroup } from '@/components/ui/selection-group';
import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Room, ChamberSettings } from '../lib/supabase';

interface ChamberSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onSaveSettings: (settings: ChamberSettings) => Promise<void>;
}

export const ChamberSettingsModal: React.FC<ChamberSettingsModalProps> = ({
  isOpen,
  onClose,
  room,
  onSaveSettings
}) => {
  const [cxMode, setCxMode] = useState<'direct' | 'standard'>(room.settings?.cx_mode || 'direct');
  const [gracePeriod, setGracePeriod] = useState<number>(room.settings?.grace_period ?? 10);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings({
        cx_mode: cxMode,
        author_cx_duration: 30,
        regular_cx_duration: 30,
        grace_period: gracePeriod
      });
      onClose();
    } catch (err) {
      console.error('Failed to update chamber settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-lg bg-white border border-[#CBD5E1] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-serif-editorial">
              Chamber Rules & Timing Settings
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Configure Cross-Ex format, timers, and grace periods
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* CX Mode Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block font-mono">
              Cross-Examination Format
            </label>
            <SelectionGroup
              aria-label="Cross-examination format" value={cxMode} onValueChange={setCxMode}
              className="grid grid-cols-2" itemClassName="h-full py-3"
              options={[
                { value: 'direct', label: 'Direct Questioning', description: '30-second questioning segments between debaters.' },
                { value: 'standard', label: 'Standard (1-Question)', description: 'One question per recognition, without follow-ups.' },
              ]}
            />
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-900">
            Questioning timer: <strong>30 seconds</strong> per question.
          </div>

          {/* Grace Period */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 uppercase tracking-wider block font-mono">
                Speech Grace Period
              </label>
              <span className="text-[#006948] font-mono font-bold text-xs">{gracePeriod} seconds</span>
            </div>
            <SelectionGroup
              aria-label="Speech grace period" value={String(gracePeriod)}
              onValueChange={value => setGracePeriod(Number(value))}
              className="grid grid-cols-2 sm:grid-cols-4"
              options={[
                { value: '0', label: '0s · Strict' },
                { value: '5', label: '5s' },
                { value: '10', label: '10s · Standard' },
                { value: '15', label: '15s' },
              ]}
            />
          </div>

          {/* Info footer */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-[11px] text-slate-600">
            Changes take effect immediately and sync in real time to all connected competitor and spectator screens.
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[#006948] hover:bg-[#005137] text-white font-bold text-xs font-mono shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Save Rules Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
