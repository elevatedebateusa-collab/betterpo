import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Gavel, 
  Users, 
  Eye, 
  PlusCircle, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  FileSpreadsheet, 
  Database, 
  History, 
  Copy,
  Check
} from 'lucide-react';
import { chamberService } from '../lib/chamberService';
import { isSupabaseConfigured, SUPABASE_URL } from '../lib/supabase';

export const ChamberHome: React.FC = () => {
  const navigate = useNavigate();

  // Create Chamber Form State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [chamberName, setChamberName] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [poPasscode, setPoPasscode] = useState<string>('');
  const [rosterRaw, setRosterRaw] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Join Room State
  const [joinCode, setJoinCode] = useState<string>('');
  const [recentRooms, setRecentRooms] = useState<Array<{ code: string; name: string; isPO?: boolean }>>([]);

  // Supabase Settings Modal
  const [showDbModal, setShowDbModal] = useState<boolean>(false);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customKey, setCustomKey] = useState<string>('');
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Generate clean room code e.g. "CH-8492"
  const generateRoomCode = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `CH-${num}`;
  };

  const generatePasscode = () => {
    return 'po-' + Math.floor(1000 + Math.random() * 9000);
  };

  useEffect(() => {
    setRoomCode(generateRoomCode());
    setPoPasscode(generatePasscode());

    try {
      const stored = localStorage.getItem('elevate_recent_chambers');
      if (stored) {
        setRecentRooms(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const parseRoster = (raw: string) => {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        if (line.includes(' - ')) {
          const [name, school] = line.split(' - ');
          return { name: name.trim(), school: (school || '').trim() };
        } else if (line.includes('(') && line.includes(')')) {
          const match = line.match(/^(.*?)\((.*?)\)/);
          if (match) return { name: match[1].trim(), school: match[2].trim() };
        } else if (line.includes(',')) {
          const [name, school] = line.split(',');
          return { name: name.trim(), school: (school || '').trim() };
        }
        return { name: line.trim(), school: '' };
      });
  };

  const parsedRoster = parseRoster(rosterRaw);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chamberName.trim() || !roomCode.trim() || !poPasscode.trim()) {
      setErrorMessage('Please fill in all chamber information.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { room } = await chamberService.createRoom(
        chamberName,
        roomCode,
        poPasscode,
        parsedRoster
      );

      // Save PO authorization locally
      localStorage.setItem(`elevate_po_passcode_${room.code}`, poPasscode.trim());

      // Save to recent
      const updated = [
        { code: room.code, name: room.name, isPO: true },
        ...recentRooms.filter((r) => r.code !== room.code),
      ].slice(0, 5);
      localStorage.setItem('elevate_recent_chambers', JSON.stringify(updated));

      setShowCreateModal(false);
      navigate(`/room/${room.code}/po`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create chamber room');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCode.trim().toUpperCase();
    if (!clean) return;

    const updated = [
      { code: clean, name: `Chamber ${clean}`, isPO: false },
      ...recentRooms.filter((r) => r.code !== clean),
    ].slice(0, 5);
    localStorage.setItem('elevate_recent_chambers', JSON.stringify(updated));

    navigate(`/room/${clean}`);
  };

  const handleSaveCustomDb = () => {
    if (customUrl) localStorage.setItem('elevate_supabase_url', customUrl.trim());
    if (customKey) localStorage.setItem('elevate_supabase_anon_key', customKey.trim());
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent">
                Elevate Chamber
              </div>
              <div className="text-[10px] uppercase font-semibold tracking-wider text-amber-400/90 -mt-1">
                Congressional Debate PO Platform
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDbModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-colors"
              title="Database & Sync Status"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSupabaseConfigured ? 'Live Supabase' : 'Zero-Config Mode'}</span>
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-12 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            "Who's Standing?" Spatial Tap-Grid & Exact Precedence / Recency
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6">
            Run Congressional Debate with{' '}
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              absolute precision.
            </span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Eliminate disputes and paper tally mistakes. Tap standing debaters on your fixed spatial grid to instantly calculate
            the rightful floor winner according to NSDA rules, manage synced timers, and broadcast live recency ladders to competitors.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full mb-12">
          {/* Create Chamber Card (PO) */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 hover:border-amber-500/50 transition-all duration-300 shadow-xl shadow-slate-950 flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Gavel className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Presiding Officer</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Start a chamber, ingest your roster, tap standing senators on the spatial grid, and trigger synchronized 3:00 speech & questioning timers.
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Create Chamber Room
            </button>
          </div>

          {/* Join Chamber Card (Competitor / Spectator) */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 hover:border-slate-700 transition-all duration-300 shadow-xl shadow-slate-950 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-5">
                <Eye className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Competitors & Parliamentarians</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Follow the live recognition order and Absolute Recency Ladder from your phone or laptop. Always know who holds precedence and view the official clock.
              </p>
            </div>

            <form onSubmit={handleJoin} className="space-y-3">
              <input
                type="text"
                placeholder="Enter Chamber Code (e.g. CH-8492)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 uppercase font-mono tracking-wider"
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white border border-slate-700 active:scale-[0.98] transition-all"
              >
                Join Chamber Board
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Recent Chambers */}
        {recentRooms.length > 0 && (
          <div className="max-w-4xl mx-auto w-full mb-12">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              <History className="w-3.5 h-3.5" />
              Recent Chambers
            </div>
            <div className="flex flex-wrap gap-2">
              {recentRooms.map((room) => (
                <button
                  key={room.code}
                  onClick={() => navigate(room.isPO ? `/room/${room.code}/po` : `/room/${room.code}`)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
                >
                  <span className="font-mono text-amber-400 font-bold">{room.code}</span>
                  <span>{room.name}</span>
                  {room.isPO && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                      PO
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3 Pillars Grid */}
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto w-full border-t border-slate-800/80 pt-10">
          <div className="flex gap-3.5">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 h-fit">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Spatial Tap-Grid</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fixed alphabetical tiles allow rapid tapping without cards shifting, calculating the legal winner instantly.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 h-fit">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Synchronized Timers</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                3:00 speech and 1:00 DQ clocks with automatic 10s grace alerts and synthesized Web Audio gavel pings.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 h-fit">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Absolute Recency Ladder</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Score formula: (Speeches × 10,000) + Order Index. Transparent, unambiguous recognition hierarchy.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>Elevate Chamber • Professional Congressional Debate PO Platform</p>
      </footer>

      {/* CREATE CHAMBER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Gavel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Create Chamber Room</h3>
                  <p className="text-xs text-slate-400">Setup your roster and PO passcode</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Chamber Name
                </label>
                <input
                  type="text"
                  value={chamberName}
                  onChange={(e) => setChamberName(e.target.value)}
                  placeholder="e.g. Prelims Chamber 3"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Chamber Code (Share with Room)
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    required
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-amber-400 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    PO Passcode (Secret Key)
                  </label>
                  <input
                    type="text"
                    value={poPasscode}
                    onChange={(e) => setPoPasscode(e.target.value)}
                    required
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-sky-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Roster Ingestion (One per line)
                  </label>
                  <span className="text-[11px] text-amber-400 font-bold">
                    {parsedRoster.length} senators recognized
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  Format: <code className="text-slate-300">First Last - School</code> or <code className="text-slate-300">First Last</code>
                </p>
                <textarea
                  rows={6}
                  value={rosterRaw}
                  onChange={(e) => setRosterRaw(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Launch PO Controller'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATABASE / CONFIG MODAL */}
      {showDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Backend & Realtime Status</h3>
              </div>
              <button onClick={() => setShowDbModal(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 flex items-start gap-3">
                <span className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <div>
                  <div className="font-semibold text-slate-200">
                    {isSupabaseConfigured ? 'Connected to Supabase Project' : 'Running in Zero-Config Local Broadcast Mode'}
                  </div>
                  <p className="text-slate-400 mt-0.5">
                    {isSupabaseConfigured
                      ? `Project endpoint: ${SUPABASE_URL}`
                      : 'Local storage & Web BroadcastChannel enabled. You can test and operate all features seamlessly across browser tabs.'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Connect Live Supabase (Optional)
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white mb-2"
                />
                <input
                  type="text"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white mb-2"
                />
                <button
                  onClick={handleSaveCustomDb}
                  className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
                >
                  Save & Connect Supabase
                </button>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-300">Supabase SQL Schema</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`-- Run schema from supabase/schema.sql in your Supabase SQL Editor`);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedSql ? 'Copied' : 'Copy SQL Location'}
                  </button>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  The complete SQL migration script with Row Level Security (RLS) and Realtime publication is available in <code className="text-amber-300">supabase/schema.sql</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ChamberLanding = ChamberHome;
export default ChamberHome;
