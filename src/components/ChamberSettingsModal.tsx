import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Clock, 
  Users, 
  Sliders, 
  Check, 
  HelpCircle,
  Hourglass
} from 'lucide-react';
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
  const [authorCxDuration, setAuthorCxDuration] = useState<number>(room.settings?.author_cx_duration ?? 120);
  const [regularCxDuration, setRegularCxDuration] = useState<number>(room.settings?.regular_cx_duration ?? 60);
  const [gracePeriod, setGracePeriod] = useState<number>(room.settings?.grace_period ?? 10);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings({
        cx_mode: cxMode,
        author_cx_duration: authorCxDuration,
        regular_cx_duration: regularCxDuration,
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
      <div className="relative w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#006948] border border-emerald-100 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Chamber Rules & Timing Settings
              </h2>
              <p className="text-xs text-slate-500">
                Configure Cross-Ex format, timers, and grace periods
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* CX Mode Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#006948]" />
              <span>Cross-Examination Format</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCxMode('direct')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  cxMode === 'direct'
                    ? 'bg-emerald-50/60 border-[#006948] ring-1 ring-[#006948]/30 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs mb-1 text-slate-900">
                  <span>Direct Questioning</span>
                  {cxMode === 'direct' && <Check className="w-4 h-4 text-[#006948]" />}
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  30-second rapid-fire questioning segments between debaters. Standard in NSDA national circuit.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCxMode('standard')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  cxMode === 'standard'
                    ? 'bg-emerald-50/60 border-[#006948] ring-1 ring-[#006948]/30 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs mb-1 text-slate-900">
                  <span>Standard (1-Question)</span>
                  {cxMode === 'standard' && <Check className="w-4 h-4 text-[#006948]" />}
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Traditional 1-question per recognized senator. PO calls each questioner individually.
                </div>
              </button>
            </div>
          </div>

          {/* Author/Sponsor CX Duration */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Hourglass className="w-3.5 h-3.5 text-[#006948]" />
              <span>Author / Sponsor Cross-Ex Duration</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAuthorCxDuration(120)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  authorCxDuration === 120
                    ? 'bg-emerald-50/60 border-[#006948] ring-1 ring-[#006948]/30 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs mb-0.5 text-slate-900">
                  <span>2 Minutes (120s)</span>
                  {authorCxDuration === 120 && <Check className="w-3.5 h-3.5 text-[#006948]" />}
                </div>
                <div className="text-[10px] text-slate-500">
                  Standard NSDA rules for authorship & first sponsorship.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAuthorCxDuration(60)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  authorCxDuration === 60
                    ? 'bg-emerald-50/60 border-[#006948] ring-1 ring-[#006948]/30 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs mb-0.5 text-slate-900">
                  <span>1 Minute (60s)</span>
                  {authorCxDuration === 60 && <Check className="w-3.5 h-3.5 text-[#006948]" />}
                </div>
                <div className="text-[10px] text-slate-500">
                  Fast-paced or local circuit variation.
                </div>
              </button>
            </div>
          </div>

          {/* Regular Member CX Duration */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#006948]" />
              <span>Regular Speech Cross-Ex Duration</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRegularCxDuration(60)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  regularCxDuration === 60
                    ? 'bg-emerald-50/60 border-[#006948] ring-1 ring-[#006948]/30 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs mb-0.5 text-slate-900">
                  <span>1 Minute (60s)</span>
                  {regularCxDuration === 60 && <Check className="w-3.5 h-3.5 text-[#006948]" />}
                </div>
                <div className="text-[10px] text-slate-500">
                  Default across NSDA (two 30s blocks or open 1m).
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRegularCxDuration(120)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  regularCxDuration === 120
                    ? 'bg-emerald-50/60 border-[#006948] ring-1 ring-[#006948]/30 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs mb-0.5 text-slate-900">
                  <span>2 Minutes (120s)</span>
                  {regularCxDuration === 120 && <Check className="w-3.5 h-3.5 text-[#006948]" />}
                </div>
                <div className="text-[10px] text-slate-500">
                  Extended cross-examination format.
                </div>
              </button>
            </div>
          </div>

          {/* Grace Period */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#006948]" />
                <span>Speech Grace Period</span>
              </label>
              <span className="text-[#006948] font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">{gracePeriod} seconds</span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min={0}
                max={15}
                step={5}
                value={gracePeriod}
                onChange={(e) => setGracePeriod(Number(e.target.value))}
                className="w-full accent-[#006948]"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0s (Strict)</span>
              <span>5s</span>
              <span>10s (Standard NSDA)</span>
              <span>15s</span>
            </div>
          </div>

          {/* Info footer */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-start gap-2.5 text-[11px] text-slate-600">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Changes take effect immediately and sync in real time to all connected competitor and spectator screens.
            </span>
          </div>

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
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#006948] hover:bg-[#005137] text-white font-bold text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span>Save Rules Configuration</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
