import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  XCircle, 
  EyeOff, 
  Eye, 
  HelpCircle,
  MapPin,
  MapPinOff,
  UserCheck,
  LayoutGrid
} from 'lucide-react';
import type { Representative } from '../lib/supabase';
import { resolveStandingWinner } from '../lib/precedence';

interface FloorGridProps {
  representatives: Representative[];
  standingIds: Set<string>;
  onToggleStanding: (id: string) => void;
  onClearStanding: () => void;
  onToggleActive?: (rep: Representative) => void;
  onTogglePresence?: (rep: Representative) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  mode?: 'speech' | 'question';
}

export function extractLastName(fullName: string): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (trimmed.includes(',')) {
    return trimmed.split(',')[0].trim();
  }
  const parts = trimmed.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}

export const FloorGrid: React.FC<FloorGridProps> = ({
  representatives,
  standingIds,
  onToggleStanding,
  onClearStanding,
  onToggleActive,
  onTogglePresence,
  searchQuery,
  mode = 'speech',
  onSearchChange,
}) => {
  // Disambiguator map in case two debaters share the same last name (e.g. John Smith & Jane Smith -> J. Smith)
  const getCardDisplayName = useMemo(() => {
    const counts = new Map<string, number>();
    representatives.forEach((r) => {
      const l = extractLastName(r.name);
      counts.set(l, (counts.get(l) || 0) + 1);
    });

    return (fullName: string) => {
      const trimmed = fullName.trim();
      const lName = extractLastName(trimmed);
      if ((counts.get(lName) || 0) > 1) {
        const parts = trimmed.includes(',') ? trimmed.split(',').reverse() : trimmed.split(/\s+/);
        const fInitial = parts[0]?.trim()[0] || '';
        return fInitial ? `${fInitial}. ${lName}` : lName;
      }
      return lName;
    };
  }, [representatives]);

  // Sort representatives in alphabetical order by LAST name for spatial muscle memory
  const fixedAlphabeticalRoster = useMemo(() => {
    return [...representatives].sort((a, b) => {
      const lA = extractLastName(a.name);
      const lB = extractLastName(b.name);
      if (lA !== lB) return lA.localeCompare(lB);
      return a.name.localeCompare(b.name);
    });
  }, [representatives]);

  // Dynamic winner calculation among standing debaters
  const { winner, isTie, tiedCandidates } = useMemo(() => {
    return resolveStandingWinner(standingIds, representatives, mode);
  }, [standingIds, representatives, mode]);

  // Filter for display based on search query
  const displayedRoster = useMemo(() => {
    if (!searchQuery.trim()) return fixedAlphabeticalRoster;
    const q = searchQuery.toLowerCase();
    return fixedAlphabeticalRoster.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.school && r.school.toLowerCase().includes(q))
    );
  }, [fixedAlphabeticalRoster, searchQuery]);

  const standingCount = standingIds.size;

  // Density mode: 'compact' (default, smaller cards to see entire chamber) vs 'comfortable'
  const [density, setDensity] = useState<'compact' | 'comfortable'>(() => {
    try {
      const saved = localStorage.getItem('betterpo_grid_density');
      if (saved === 'compact' || saved === 'comfortable') return saved;
    } catch {}
    return 'compact';
  });

  const handleDensityChange = (newDensity: 'compact' | 'comfortable') => {
    setDensity(newDensity);
    try {
      localStorage.setItem('betterpo_grid_density', newDensity);
    } catch {}
  };

  return (
    <div className="flex flex-col h-full space-y-2.5">
      {/* Search & Selection Status Header: Super Minimalist Swiss Editorial Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-2.5 sm:px-3.5 sm:py-2 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search senator or school..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-all font-mono"
            />
          </div>

          <div className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-bold tracking-tight">
            {standingCount} STANDING
          </div>

          {/* Density Toggle Button */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 font-mono text-[10px]">
            <button
              onClick={() => handleDensityChange('compact')}
              className={`px-2 py-0.5 rounded font-semibold transition-all flex items-center gap-1 ${
                density === 'compact'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Compact Cards (Easier to see all senators at once)"
            >
              <LayoutGrid className="w-3 h-3 text-emerald-600" />
              <span>Compact</span>
            </button>
            <button
              onClick={() => handleDensityChange('comfortable')}
              className={`px-2 py-0.5 rounded font-semibold transition-all ${
                density === 'comfortable'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Comfortable Cards (Larger spacing)"
            >
              Comfortable
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {standingCount > 0 && (
            <button
              onClick={onClearStanding}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-mono text-[11px] font-semibold transition-all"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Clear (Esc)</span>
            </button>
          )}

          {isTie && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[11px] font-bold animate-pulse">
              <HelpCircle className="w-3 h-3 text-amber-600" />
              <span>Tie: {tiedCandidates.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tactile Index Cards Spatial Grid */}
      <div className={`grid ${
        density === 'compact'
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-1.5'
          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2'
      } flex-1 overflow-y-auto pr-1 pb-2`}>
        {displayedRoster.map((rep) => {
          const isPresent = rep.is_present !== false;
          const isStanding = standingIds.has(rep.id);
          const isWinner = winner?.id === rep.id;
          const isTiedWinner = isTie && tiedCandidates.some((c) => c.id === rep.id);

          return (
            <div
              key={rep.id}
              onClick={() => {
                if (!rep.active || !isPresent) return;
                onToggleStanding(rep.id);
              }}
              className={`group relative rounded-lg select-none transition-all duration-150 flex flex-col justify-between ${
                density === 'compact'
                  ? 'p-2 min-h-[48px]'
                  : 'p-2.5 min-h-[68px]'
              } ${
                !rep.active
                  ? 'bg-slate-50 border border-dashed border-slate-200 opacity-40 cursor-not-allowed'
                  : !isPresent
                  ? 'bg-slate-100/70 border border-slate-200 opacity-50 cursor-not-allowed'
                  : isWinner
                  ? 'bg-emerald-50/90 border-2 border-emerald-500 shadow-sm cursor-pointer z-10'
                  : isTiedWinner
                  ? 'bg-amber-50 border-2 border-amber-400 shadow-sm cursor-pointer z-10'
                  : isStanding
                  ? 'bg-slate-900 text-white border-2 border-slate-900 shadow-sm cursor-pointer'
                  : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-[0_2px_4px_rgba(0,0,0,0.03)] cursor-pointer'
              }`}
            >
              {/* Corner Ribbon for Winner Tile */}
              {isWinner && (
                <div className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white font-mono text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                  <Sparkles className="w-2 h-2 fill-current" />
                  <span>NEXT</span>
                </div>
              )}

              {/* Header: Senator Name (Last Name Only for high visibility) & Standing Badge */}
              <div className="flex items-start justify-between gap-1">
                <div className="truncate pr-1">
                  <div 
                    title={rep.name}
                    className={`font-serif-editorial font-bold text-sm sm:text-[14px] leading-tight truncate transition-colors ${
                    !isPresent
                      ? 'text-slate-400 line-through'
                      : isWinner
                      ? 'text-emerald-950 font-extrabold'
                      : isStanding
                      ? 'text-white font-extrabold'
                      : 'text-slate-900 group-hover:text-emerald-700'
                  }`}>
                    {getCardDisplayName(rep.name)}
                  </div>
                  {density === 'comfortable' && (
                    <div className={`font-mono text-[9.5px] truncate leading-none mt-1 ${
                      isStanding ? 'text-slate-300' : 'text-slate-400'
                    }`}>
                      {rep.school || 'Independent'}
                    </div>
                  )}
                </div>

                {isWinner ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-200 shrink-0 mt-0.5" />
                ) : isTiedWinner ? (
                  <span className="px-1 py-0.2 rounded bg-amber-500 text-white font-mono text-[8px] font-bold shrink-0">
                    Tie
                  </span>
                ) : isStanding ? (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white font-mono text-[8px] font-bold tracking-wider shrink-0 flex items-center gap-0.5">
                    <UserCheck className="w-2 h-2" />
                    STAND
                  </span>
                ) : !isPresent ? (
                  <span className="px-1 py-0.2 rounded bg-slate-200 text-slate-500 font-mono text-[8px] font-bold shrink-0">
                    AWAY
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-200 shrink-0 mt-0.5 group-hover:bg-slate-300" />
                )}
              </div>

              {/* Counts Badge & Priority Note */}
              <div className={`flex items-center justify-between pt-1 font-mono text-[9px] border-t border-slate-100 mt-1 ${
                isWinner
                  ? 'border-emerald-200 text-emerald-900'
                  : isStanding
                  ? 'border-slate-800 text-slate-300'
                  : 'text-slate-500'
              }`}>
                <div className="flex items-center gap-1">
                  {density === 'compact' && rep.school && (
                    <span className={`text-[8.5px] truncate max-w-[65px] leading-none ${
                      isStanding ? 'text-slate-400' : 'text-slate-400'
                    }`}>
                      {rep.school}
                    </span>
                  )}
                  <span
                    className={`px-1 py-0.2 rounded font-bold ${
                      isWinner
                        ? 'bg-emerald-600 text-white'
                        : isStanding
                        ? 'bg-slate-800 text-emerald-400'
                        : rep.speeches_count === 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {mode === 'speech' ? `${rep.speeches_count} SP` : `${rep.questions_count} Q`}
                  </span>
                </div>

                <div className="text-[9px] font-medium tracking-tight">
                  {mode === 'speech'
                    ? rep.last_speech_order > 0
                      ? `#${rep.last_speech_order} REC`
                      : 'NEVER'
                    : rep.last_question_order > 0
                    ? `#${rep.last_question_order} REC`
                    : 'NEVER'}
                </div>
              </div>

              {/* Action Buttons: Presence Toggle & Active Toggle */}
              <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                {onTogglePresence && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePresence(rep);
                    }}
                    className={`p-0.5 rounded text-[10px] transition-colors shadow-sm ${
                      isPresent
                        ? 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900'
                        : 'bg-rose-600 text-white font-bold'
                    }`}
                    title={isPresent ? 'Mark Away / Stepped Out' : 'Mark In Chamber'}
                  >
                    {isPresent ? <MapPin className="w-2.5 h-2.5" /> : <MapPinOff className="w-2.5 h-2.5" />}
                  </button>
                )}

                {onToggleActive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleActive(rep);
                    }}
                    className="p-0.5 rounded bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors shadow-sm"
                    title={rep.active ? 'Mark Senator Inactive' : 'Mark Senator Active'}
                  >
                    {rep.active ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5 text-emerald-600" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
