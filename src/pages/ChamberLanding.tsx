import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Gavel, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  RefreshCw, 
  ListOrdered, 
  ChevronLeft, 
  Radio, 
  Users,
  Copy,
  Check,
  Share2,
  Play
} from 'lucide-react';
import { chamberService } from '../lib/chamberService';
import { parseTabroomRecencyList, type ParsedSenator } from '../lib/rosterParser';
import { BetterPOLogoSvg } from '../components/BetterPOLogoSvg';
import { GavelTappingLoader } from '../components/GavelTappingLoader';

export const ChamberLanding: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Animation Stage:
  // 'initial': Starts centered, gavel slams & reveals wordmark (0.0s - 2.2s)
  // 'settled_title': Logo slides up smoothly to title position (2.3s)
  // 'options_visible': Options fade & slide in directly beneath the logo title (2.7s)
  const [animStage, setAnimStage] = useState<'initial' | 'settled_title' | 'options_visible'>('initial');

  // Active Screen: 'none' (Role Selection Cards), 'po' (PO Setup), 'spectator' (Join Flow)
  const [selectedRole, setSelectedRole] = useState<'none' | 'po' | 'spectator'>('none');

  // Room Ready State (Intermediate screen showing large Room Code for competitors)
  const [createdChamberInfo, setCreatedChamberInfo] = useState<{
    code: string;
    pin: string;
    chamberName: string;
    debaterCount: number;
    firstBillTitle: string;
    confirmedRoster: Array<{ name: string; school: string; recency: number }>;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Competitor / Spectator Join State
  const [joinCode, setJoinCode] = useState<string>('');
  const [isCheckingRoom, setIsCheckingRoom] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Presiding Officer Setup State
  const [chamberName, setChamberName] = useState<string>('');
  const [adminPin, setAdminPin] = useState<string>('');
  const [docketBills, setDocketBills] = useState<string[]>(['']);
  const [rosterText, setRosterText] = useState<string>('');
  const [senatorsList, setSenatorsList] = useState<ParsedSenator[]>([]);
  const [isCreatingChamber, setIsCreatingChamber] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Choreography sequence
  useEffect(() => {
    // 1. Audio thud right at gavel impact (at 0.60s)
    const audioTimer = setTimeout(() => {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(120, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.14);
          gain.gain.setValueAtTime(0.35, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
        }
      } catch {
        // audio silent fallback
      }
    }, 600);

    // 2. Logo slides out quickly and settles, then glides up to title position at 1.8s
    const moveTimer = setTimeout(() => {
      setAnimStage('settled_title');
    }, 1800);

    // 3. Options pop in cleanly underneath the logo title at 2.2s
    const popOptionsTimer = setTimeout(() => {
      setAnimStage('options_visible');
    }, 2200);

    return () => {
      clearTimeout(audioTimer);
      clearTimeout(moveTimer);
      clearTimeout(popOptionsTimer);
    };
  }, []);

  const generateRandomPin = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const handleAddBillSlot = () => {
    setDocketBills((prev) => [...prev, '']);
  };

  const handleRemoveBillSlot = (index: number) => {
    setDocketBills((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateBill = (index: number, value: string) => {
    setDocketBills((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // Handle Roster Parsing & Editing
  const handleRosterTextChange = (text: string) => {
    setRosterText(text);
    const parsed = parseTabroomRecencyList(text);
    setSenatorsList(parsed);
  };

  const handleUpdateSenatorRecency = (id: string, newRecency: number) => {
    setSenatorsList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, recency: newRecency } : s))
    );
  };

  const handleUpdateSenatorName = (id: string, newName: string) => {
    setSenatorsList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: newName } : s))
    );
  };

  const handleUpdateSenatorSchool = (id: string, newSchool: string) => {
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
      id: `senator_manual_${Date.now()}`,
      name: '',
      school: '',
      recency: nextRecency,
    };
    setSenatorsList((prev) => [...prev, newSen]);
  };

  const handleAutoNumberSenators = () => {
    setSenatorsList((prev) =>
      prev.map((s, idx) => ({ ...s, recency: idx + 1 }))
    );
  };

  const handleSortSenatorsByRecency = () => {
    setSenatorsList((prev) => [...prev].sort((a, b) => a.recency - b.recency));
  };

  // Handle Spectator Join
  const handleSpectatorJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setIsCheckingRoom(true);
    setJoinError(null);

    try {
      const cleanCode = joinCode.trim().toUpperCase();
      const room = await chamberService.getRoomByCode(cleanCode);

      if (!room) {
        setJoinError(`Chamber code "${cleanCode}" was not found. Please verify with your PO.`);
        setIsCheckingRoom(false);
        return;
      }

      navigate(`/room/${room.code}`);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Error locating chamber');
      setIsCheckingRoom(false);
    }
  };

  // Handle PO Chamber Creation
  const handlePOCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chamberName.trim()) {
      setCreateError('Please provide a name or tournament for this chamber.');
      return;
    }

    setIsCreatingChamber(true);
    setCreateError(null);

    try {
      const pin = adminPin.trim() || generateRandomPin();
      const code = generateRandomPin();

      let validSenators = senatorsList
        .filter((s) => s.name.trim().length > 0)
        .map((s, idx) => ({
          name: s.name.trim(),
          school: s.school.trim(),
          initialRecency: s.recency !== undefined && !isNaN(s.recency) ? s.recency : idx + 1,
        }));

      if (validSenators.length === 0 && rosterText.trim().length > 0) {
        const parsed = parseTabroomRecencyList(rosterText);
        validSenators = parsed.map((s, idx) => ({
          name: s.name.trim(),
          school: s.school.trim(),
          initialRecency: s.recency !== undefined && !isNaN(s.recency) ? s.recency : idx + 1,
        }));
      }

      const { room } = await chamberService.createRoom(
        chamberName.trim(),
        code,
        pin,
        validSenators
      );

      const validBills = docketBills
        .map((b) => b.trim())
        .filter((b) => b.length > 0);

      for (let i = 0; i < validBills.length; i++) {
        const bTitle = validBills[i];
        const bNum = `Bill ${i + 1}`;

        const newBill = await chamberService.addBill(room.id, bNum, bTitle, '');
        if (i === 0) {
          await chamberService.setActiveBill(room, newBill);
        }
      }

      setCreatedChamberInfo({
        code: room.code,
        pin,
        chamberName: room.name,
        debaterCount: validSenators.length,
        firstBillTitle: validBills[0] || 'General Orders',
        confirmedRoster: [...validSenators]
          .sort((a, b) => a.initialRecency - b.initialRecency)
          .map((s) => ({ name: s.name, school: s.school, recency: s.initialRecency })),
      });
      setIsCreatingChamber(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Error creating chamber');
      setIsCreatingChamber(false);
    }
  };

  const handleStartRound = () => {
    if (!createdChamberInfo) return;
    navigate(`/room/${createdChamberInfo.code}/po#${createdChamberInfo.pin}`);
  };

  const isLogoMovedUp = animStage === 'settled_title' || animStage === 'options_visible';
  const areOptionsVisible = animStage === 'options_visible';

  return (
    <div className="min-h-screen bg-white text-[#161d1b] font-sans flex flex-col justify-between selection:bg-[#68dba9]/30 selection:text-[#002114] relative overflow-x-hidden">
      
      {/* Top Subtle Ambient Bar */}
      <header className="w-full h-14 px-6 md:px-12 flex items-center justify-between border-b border-[#CBD5E1]/60 bg-white/70 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div 
            onClick={() => {
              setSelectedRole('none');
              setCreatedChamberInfo(null);
            }}
            className="flex items-center cursor-pointer group"
          >
            <span className="font-mono font-bold text-sm tracking-wider uppercase text-[#0A1128] group-hover:opacity-80 transition-opacity">
              better<span className="text-[#006948]">po</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 z-10 w-full max-w-4xl mx-auto">
        
        {/* ========================================================
            THE LOGO HERO THAT MOVES UP SMOOTHLY TO BECOME THE TITLE
            ======================================================== */}
        <div 
          className={`w-full max-w-[560px] mx-auto flex justify-center items-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isLogoMovedUp
              ? 'translate-y-0 scale-95 mb-6'
              : 'translate-y-16 sm:translate-y-20 scale-105 mb-0'
          }`}
        >
          <BetterPOLogoSvg
            theme="light"
            className="w-full max-w-[520px] h-auto mx-auto block overflow-visible"
          />
        </div>

        {/* ========================================================
            OPTIONS POP IN DIRECTLY BENEATH THE LOGO TITLE
            ======================================================== */}
        <div 
          className={`w-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            areOptionsVisible
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-8 pointer-events-none'
          }`}
        >
          <div className="w-full">
            
            {/* SCREEN 1: ROLE SELECTION CARDS (HIGH-END MODERN ACADEMIC) */}
            {selectedRole === 'none' && (
              <div className="space-y-6 animate-fadeIn max-w-3xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Card 1: Presiding Officer */}
                  <div 
                    onClick={() => setSelectedRole('po')}
                    className="group relative rounded-[28px] p-8 sm:p-9 bg-white border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_45px_rgba(0,0,0,0.07)] transition-all duration-300 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-14 h-14 rounded-2xl bg-[#ebf8f2] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                        <Gavel className="w-6 h-6 text-[#006948]" />
                      </div>

                      <h3 className="font-bold text-2xl text-slate-900 tracking-tight">
                        Presiding Officer
                      </h3>
                      <p className="text-slate-500 text-sm leading-relaxed mt-2.5">
                        Create a new session, manage recognition precedence, and lead chamber debates.
                      </p>
                    </div>

                    <div className="pt-8 mt-6 border-t border-slate-100">
                      <button className="w-full py-3.5 px-6 rounded-2xl bg-[#090d16] group-hover:bg-[#006948] text-white font-sans text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-colors active:scale-[0.99]">
                        <span>CREATE A ROUND</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Competitor */}
                  <div 
                    onClick={() => setSelectedRole('spectator')}
                    className="group relative rounded-[28px] p-8 sm:p-9 bg-white border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_45px_rgba(0,0,0,0.07)] transition-all duration-300 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-14 h-14 rounded-2xl bg-[#eef3f7] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                        <Users className="w-6 h-6 text-slate-700" />
                      </div>

                      <h3 className="font-bold text-2xl text-slate-900 tracking-tight">
                        Competitor
                      </h3>
                      <p className="text-slate-500 text-sm leading-relaxed mt-2.5">
                        Enter room code to monitor live speaker queues, motions, and synchronized timers.
                      </p>
                    </div>

                    <div className="pt-8 mt-6 border-t border-slate-100">
                      <button className="w-full py-3.5 px-6 rounded-2xl bg-[#090d16] group-hover:bg-[#1e293b] text-white font-sans text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-colors active:scale-[0.99]">
                        <span>ENTER ROOM CODE</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* SCREEN 2: SPECTATOR JOIN FORM */}
            {selectedRole === 'spectator' && (
              <div className="max-w-md mx-auto w-full animate-fadeIn">
                <div className="bg-white border border-slate-100 rounded-[28px] p-8 sm:p-10 space-y-6 shadow-[0_10px_35px_rgba(0,0,0,0.04)] text-center">
                  <div className="flex items-center justify-start">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('none');
                        setJoinError(null);
                      }}
                      className="inline-flex items-center gap-1 font-sans text-xs text-slate-500 hover:text-slate-900 transition-colors font-medium"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                  </div>

                  <div className="w-14 h-14 rounded-2xl bg-[#eef3f7] flex items-center justify-center mx-auto text-slate-700">
                    <Radio className="w-7 h-7 text-[#006948] animate-pulse" />
                  </div>

                  <div>
                    <h2 className="font-bold text-2xl text-slate-900 tracking-tight font-sans">Join Live Chamber</h2>
                    <p className="text-slate-500 text-sm mt-1.5 leading-relaxed font-sans">Enter the room code given by your Presiding Officer</p>
                  </div>

                  {joinError && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#B91C1C] text-xs font-sans flex items-start gap-2 text-left">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <span>{joinError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSpectatorJoin} className="space-y-4 pt-2">
                    <div className="text-left">
                      <label className="block font-sans text-xs uppercase tracking-wider text-slate-700 mb-1.5 font-bold">
                        Chamber Room Code
                      </label>
                      <input
                        type="text"
                        required
                        placeholder=""
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        value={joinCode}
                        onChange={(e) => {
                          setJoinCode(e.target.value.toUpperCase());
                          setJoinError(null);
                        }}
                        maxLength={10}
                        className="w-full bg-white border-2 border-slate-200 focus:border-[#006948] rounded-2xl px-4 py-3.5 text-xl font-sans font-bold uppercase tracking-widest text-slate-900 text-center focus:outline-none transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isCheckingRoom || !joinCode.trim()}
                      className="w-full py-4 px-6 rounded-2xl bg-[#090d16] hover:bg-[#151d2e] disabled:opacity-40 text-white font-sans text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.99] shadow-xs"
                    >
                      {isCheckingRoom ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#10B981]" />
                          <span>Verifying Chamber...</span>
                        </>
                      ) : (
                        <>
                          <span>Connect to Chamber</span>
                          <ArrowRight className="w-4 h-4 text-[#10B981]" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* SCREEN 3: PRESIDING OFFICER SETUP FORM */}
            {selectedRole === 'po' && !createdChamberInfo && (
              <div className="max-w-2xl mx-auto w-full animate-fadeIn">
                {isCreatingChamber ? (
                  <div className="bg-white border border-slate-100 rounded-[28px] p-8 sm:p-14 shadow-[0_10px_35px_rgba(0,0,0,0.04)] text-center animate-fadeIn">
                    <GavelTappingLoader
                      title="Creating Chamber..."
                      subtitle="INITIALIZING DOCKET, ROSTER & NSDA PARLIAMENTARY RULES"
                    />
                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-[28px] p-8 sm:p-10 space-y-6 shadow-[0_10px_35px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-start">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('none');
                        setCreateError(null);
                        setCreatedChamberInfo(null);
                      }}
                      className="inline-flex items-center gap-1 font-sans text-xs text-slate-500 hover:text-slate-900 transition-colors font-medium"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                  </div>

                  <div>
                    <h2 className="font-bold text-2xl text-slate-900 tracking-tight font-sans">Presiding Officer Setup</h2>
                    <p className="text-slate-500 text-sm mt-1.5 leading-relaxed font-sans">Configure chamber designation, legislation sequence, and debater roster</p>
                  </div>

                  {createError && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#B91C1C] text-xs font-sans flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <form onSubmit={handlePOCreate} className="space-y-5">
                    {/* Chamber Name */}
                    <div>
                      <label className="block font-sans text-xs uppercase tracking-wider text-slate-700 mb-1.5 font-bold">
                        Tournament / Chamber Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder=""
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        value={chamberName}
                        onChange={(e) => setChamberName(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-[#006948] rounded-xl px-4 py-2.5 text-sm font-sans text-slate-900 focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Secret Admin PIN */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-sans text-xs uppercase tracking-wider text-slate-700 font-bold">
                          PO Admin Passcode (4-6 Digits)
                        </label>
                        <span className="font-sans text-[11px] text-slate-400">
                          Restricts gavel control to you (optional)
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder=""
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          value={adminPin}
                          onChange={(e) => setAdminPin(e.target.value)}
                          className="w-full bg-white border border-slate-200 focus:border-[#006948] rounded-xl px-4 py-2.5 text-sm font-sans text-slate-900 focus:outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setAdminPin(generateRandomPin())}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-sans font-semibold border border-slate-200 flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Randomize</span>
                        </button>
                      </div>
                    </div>

                    {/* Docket Order Section */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <ListOrdered className="w-4 h-4 text-[#006948]" />
                          <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800">
                            Docket Order (In Sequence)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddBillSlot}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#006948] text-slate-800 text-xs font-sans font-semibold transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Bill</span>
                        </button>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {docketBills.map((bill, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="w-16 shrink-0 font-sans text-xs font-bold text-slate-500 text-right">
                              Bill #{index + 1}:
                            </span>
                            <input
                              type="text"
                              placeholder=""
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              value={bill}
                              onChange={(e) => handleUpdateBill(index, e.target.value)}
                              className="flex-1 bg-white border border-slate-200 focus:border-[#006948] rounded-lg px-3 py-1.5 text-xs font-sans text-slate-900 focus:outline-none"
                            />
                            {docketBills.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBillSlot(index)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Roster Ingest Textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-sans text-xs uppercase tracking-wider text-slate-700 font-bold">
                          Copy and Paste Tabroom Roster
                        </label>
                        <span className="font-sans text-xs text-[#006948] font-bold">
                          {senatorsList.length} senators detected
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={rosterText}
                        onChange={(e) => handleRosterTextChange(e.target.value)}
                        placeholder=""
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full bg-white border border-slate-200 focus:border-[#006948] rounded-xl px-4 py-2.5 text-xs font-sans text-slate-900 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Interactive Recency Order Confirmation Card */}
                    {senatorsList.length > 0 && (
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800">
                                Confirm Speaker Recency Order
                              </span>
                              <span className="text-[11px] font-sans font-semibold px-2 py-0.5 rounded-md bg-[#006948]/10 text-[#006948]">
                                {senatorsList.length} Debaters
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                              Tabroom recency detected. Each speaker is assigned an initial speaking order.
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={handleAutoNumberSenators}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-sans font-semibold transition-colors"
                              title="Reset numbers to 1..N"
                            >
                              Auto-Number
                            </button>
                            <button
                              type="button"
                              onClick={handleSortSenatorsByRecency}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-sans font-semibold transition-colors"
                              title="Sort list by recency order"
                            >
                              Sort Order
                            </button>
                            <button
                              type="button"
                              onClick={handleAddSenator}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#006948] text-slate-800 text-xs font-sans font-semibold transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {senatorsList.map((senator, idx) => (
                            <div
                              key={senator.id || idx}
                              className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors"
                            >
                              {/* Number indicator */}
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="font-sans text-xs font-bold text-slate-400">#</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={senator.recency}
                                  onChange={(e) =>
                                    handleUpdateSenatorRecency(
                                      senator.id,
                                      parseInt(e.target.value, 10) || 1
                                    )
                                  }
                                  className="w-12 h-7 text-center bg-slate-50 border border-slate-200 focus:border-[#006948] rounded-md text-xs font-bold font-mono tabular-nums text-slate-900 focus:outline-none"
                                  title="Initial Recency Order"
                                />
                              </div>

                              {/* Senator Name */}
                              <input
                                type="text"
                                placeholder=""
                                value={senator.name}
                                onChange={(e) =>
                                  handleUpdateSenatorName(senator.id, e.target.value)
                                }
                                className="flex-1 min-w-[120px] h-7 bg-transparent px-2 text-xs font-sans font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none border-b border-transparent focus:border-[#006948]"
                              />

                              {/* Senator School */}
                              <input
                                type="text"
                                placeholder=""
                                value={senator.school}
                                onChange={(e) =>
                                  handleUpdateSenatorSchool(senator.id, e.target.value)
                                }
                                className="w-28 sm:w-40 h-7 bg-transparent px-2 text-xs font-sans text-slate-500 placeholder:text-slate-400 focus:outline-none border-b border-transparent focus:border-[#006948]"
                              />

                              {/* Remove action */}
                              <button
                                type="button"
                                onClick={() => handleRemoveSenator(senator.id)}
                                className="p-1 text-slate-300 hover:text-rose-600 transition-colors shrink-0"
                                title="Remove speaker"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isCreatingChamber || !chamberName.trim()}
                      className="w-full py-4 px-6 rounded-2xl bg-[#090d16] hover:bg-[#006948] disabled:opacity-40 text-white font-sans text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.99] shadow-xs"
                    >
                      <span>CREATE CHAMBER & GET ROOM CODE</span>
                      <ArrowRight className="w-4 h-4 text-[#10B981]" />
                    </button>
                  </form>
                </div>
                )}
              </div>
            )}

            {/* SCREEN 4: ROOM READY & LARGE ROOM CODE DISPLAY */}
            {selectedRole === 'po' && createdChamberInfo && (
              <div className="max-w-lg mx-auto w-full animate-fadeIn">
                <div className="bg-white border border-slate-100 rounded-[28px] p-8 sm:p-10 space-y-6 shadow-[0_10px_35px_rgba(0,0,0,0.04)] text-center">
                  <div>
                    <h2 className="font-sans text-2xl font-bold uppercase text-slate-900 tracking-tight">
                      {createdChamberInfo.chamberName}
                    </h2>
                    <p className="font-sans text-xs text-slate-500 mt-1">
                      Give this room code to all competitors and judges in your chamber
                    </p>
                  </div>

                  {/* Big Hero Room Code Card */}
                  <div className="p-8 rounded-2xl bg-[#0A1128] text-white border-2 border-[#10B981]/40 space-y-4 shadow-xl">
                    <span className="font-sans text-[11px] uppercase tracking-widest text-slate-400 font-semibold block">
                      Competitor Room Code
                    </span>

                    <div className="font-mono text-4xl sm:text-6xl font-black tracking-widest text-[#10B981] select-all">
                      {createdChamberInfo.code}
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(createdChamberInfo.code);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-sans font-semibold text-white transition-colors"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#10B981]" />
                            <span className="text-[#10B981]">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/room/${createdChamberInfo.code}`;
                          navigator.clipboard.writeText(url);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-sans font-semibold text-white transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Copy Join Link</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Strip */}
                  <div className="grid grid-cols-2 gap-3 text-left font-sans text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">Floor Roster</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {createdChamberInfo.debaterCount} Registered
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">PO Passcode (Private)</span>
                      <span className="font-bold text-[#006948] text-sm">
                        PIN: {createdChamberInfo.pin}
                      </span>
                    </div>
                  </div>

                  {/* Confirmed Recency Order Display */}
                  {createdChamberInfo.confirmedRoster && createdChamberInfo.confirmedRoster.length > 0 && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800">
                          Confirmed Starting Recency Order
                        </span>
                        <span className="text-[11px] font-sans font-bold text-[#006948]">
                          {createdChamberInfo.confirmedRoster.length} Verified
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                        Recognition priority at round start will strictly follow this official recency order:
                      </p>
                      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 font-sans text-xs">
                        {createdChamberInfo.confirmedRoster.map((sen, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200"
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <span className="w-6 h-5 rounded bg-slate-100 border border-slate-200 font-mono font-bold text-[10px] text-slate-700 flex items-center justify-center tabular-nums">
                                #{sen.recency}
                              </span>
                              <span className="font-semibold text-slate-900 truncate">
                                {sen.name}
                              </span>
                            </div>
                            {sen.school && (
                              <span className="text-[11px] text-slate-500 truncate max-w-[140px]">
                                {sen.school}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Primary "Start Round" CTA */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleStartRound}
                      className="w-full py-4 px-6 rounded-2xl bg-[#090d16] hover:bg-[#006948] text-white font-sans text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] transition-all"
                    >
                      <Play className="w-4 h-4 fill-current text-[#10B981]" />
                      <span>START ROUND</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default ChamberLanding;
