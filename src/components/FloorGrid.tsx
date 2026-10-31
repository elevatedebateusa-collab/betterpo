import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  LayoutGrid,
  RotateCcw
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
  roomId?: string;
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
  roomId,
}) => {
  // Storage key for custom spatial room seating layout
  const storageKey = useMemo(() => {
    return roomId ? `betterpo_floor_layout_${roomId}` : 'betterpo_floor_layout_default';
  }, [roomId]);

  // Persisted custom spatial order of senator IDs
  const [customOrderIds, setCustomOrderIds] = useState<string[]>(() => {
    try {
      const key = roomId ? `betterpo_floor_layout_${roomId}` : 'betterpo_floor_layout_default';
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Keep custom order in sync when room changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCustomOrderIds(parsed);
          return;
        }
      }
    } catch {}
    setCustomOrderIds([]);
  }, [storageKey]);

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

  // Sort representatives in alphabetical order by LAST name for default baseline
  const fixedAlphabeticalRoster = useMemo(() => {
    return [...representatives].sort((a, b) => {
      const lA = extractLastName(a.name);
      const lB = extractLastName(b.name);
      if (lA !== lB) return lA.localeCompare(lB);
      return a.name.localeCompare(b.name);
    });
  }, [representatives]);

  // Derive full ordered roster: respects custom spatial room seating if saved, otherwise defaults to alphabetical
  const orderedRepresentatives = useMemo(() => {
    if (!customOrderIds || customOrderIds.length === 0) {
      return fixedAlphabeticalRoster;
    }

    const currentRepsMap = new Map<string, Representative>();
    representatives.forEach((r) => currentRepsMap.set(r.id, r));

    const result: Representative[] = [];
    const seenIds = new Set<string>();

    // 1. Place debaters according to custom saved layout
    for (const id of customOrderIds) {
      const rep = currentRepsMap.get(id);
      if (rep) {
        result.push(rep);
        seenIds.add(id);
      }
    }

    // 2. Append any new debaters not yet in custom layout in alphabetical order
    for (const rep of fixedAlphabeticalRoster) {
      if (!seenIds.has(rep.id)) {
        result.push(rep);
      }
    }

    return result;
  }, [representatives, customOrderIds, fixedAlphabeticalRoster]);

  // Dynamic winner calculation among standing debaters
  const { winner, isTie, tiedCandidates } = useMemo(() => {
    return resolveStandingWinner(standingIds, representatives, mode);
  }, [standingIds, representatives, mode]);

  // Filter for display based on search query
  const displayedRoster = useMemo(() => {
    if (!searchQuery.trim()) return orderedRepresentatives;
    const q = searchQuery.toLowerCase();
    return orderedRepresentatives.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.school && r.school.toLowerCase().includes(q))
    );
  }, [orderedRepresentatives, searchQuery]);

  const standingCount = standingIds.size;
  const hasCustomLayout = customOrderIds.length > 0;

  // Swap seats in the spatial room layout and persist
  const handleSwapPositions = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const currentIds = orderedRepresentatives.map((r) => r.id);
    const sourceIdx = currentIds.indexOf(sourceId);
    const targetIdx = currentIds.indexOf(targetId);

    if (sourceIdx === -1 || targetIdx === -1) return;

    const newOrder = [...currentIds];
    newOrder[sourceIdx] = targetId;
    newOrder[targetIdx] = sourceId;

    setCustomOrderIds(newOrder);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newOrder));
    } catch (err) {
      console.error('Failed to save chamber seating layout:', err);
    }
  };

  const handleResetLayout = () => {
    setCustomOrderIds([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

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

  // Click-and-hold drag & rearrange states
  const [draggedRep, setDraggedRep] = useState<Representative | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dragCursor, setDragCursor] = useState<{ x: number; y: number } | null>(null);
  const [cardDimensions, setCardDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropTargetIdRef = useRef<string | null>(null);
  const justDraggedRef = useRef(false);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  // Escape key cancels active drag
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingRef.current) {
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        setIsDragging(false);
        setDraggedRep(null);
        setDropTargetId(null);
        dropTargetIdRef.current = null;
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 150);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pointer down handler: initiates click-and-hold to rearrange
  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, rep: Representative) => {
    // Only primary button and when not actively filtering by search
    if (e.button !== 0 || searchQuery.trim()) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const targetCard = e.currentTarget;
    const rect = targetCard.getBoundingClientRect();

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    const startDrag = () => {
      isDraggingRef.current = true;
      setIsDragging(true);
      setDraggedRep(rep);
      setCardDimensions({ width: rect.width, height: rect.height });
      setDragCursor({ x: startX, y: startY });
      justDraggedRef.current = true;
    };

    // Hold threshold: 200ms
    holdTimerRef.current = setTimeout(() => {
      startDrag();
    }, 200);

    const onGlobalPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;
      const dist = Math.hypot(dx, dy);

      // If user moved > 8px before 200ms timer fired, begin drag immediately
      if (!isDraggingRef.current && dist > 8) {
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        startDrag();
      }

      if (isDraggingRef.current) {
        setDragCursor({ x: moveEv.clientX, y: moveEv.clientY });

        // Hit-test target card under cursor
        const el = document.elementFromPoint(moveEv.clientX, moveEv.clientY);
        const cardEl = el?.closest('[data-rep-id]');
        const targetId = cardEl?.getAttribute('data-rep-id') || null;

        if (targetId && targetId !== rep.id) {
          setDropTargetId(targetId);
          dropTargetIdRef.current = targetId;
        } else {
          setDropTargetId(null);
          dropTargetIdRef.current = null;
        }
      }
    };

    const onGlobalPointerUp = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      window.removeEventListener('pointermove', onGlobalPointerMove);
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointercancel', onGlobalPointerUp);

      if (isDraggingRef.current) {
        const sourceId = rep.id;
        const targetId = dropTargetIdRef.current;

        if (targetId && targetId !== sourceId) {
          handleSwapPositions(sourceId, targetId);
        }

        setIsDragging(false);
        setDraggedRep(null);
        setDropTargetId(null);
        dropTargetIdRef.current = null;

        // Keep justDraggedRef true for 120ms so any click event is ignored
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 120);
      }
    };

    window.addEventListener('pointermove', onGlobalPointerMove);
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);
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
              className={`px-2 py-0.5 rounded font-semibold transition-all ${
                density === 'compact'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Compact Cards (Easier to see all senators at once)"
            >
              Compact
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

          {hasCustomLayout && (
            <button
              onClick={handleResetLayout}
              className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Reset chamber seating order to alphabetical"
            >
              Reset Seating
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {standingCount > 0 && (
            <button
              onClick={onClearStanding}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-mono text-[11px] font-semibold transition-all"
            >
              Clear (Esc)
            </button>
          )}

          {isTie && (
            <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[11px] font-bold animate-pulse">
              Tie: {tiedCandidates.length}
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
          const isBeingDragged = draggedRep?.id === rep.id;
          const isCurrentDropTarget = dropTargetId === rep.id;

          return (
            <div
              key={rep.id}
              data-rep-id={rep.id}
              onPointerDown={(e) => handleCardPointerDown(e, rep)}
              onDragStart={(e) => e.preventDefault()}
              onClick={() => {
                if (justDraggedRef.current) return;
                if (!rep.active || !isPresent) return;
                onToggleStanding(rep.id);
              }}
              className={`group relative rounded-lg select-none transition-all duration-150 flex flex-col justify-between ${
                density === 'compact'
                  ? 'p-2 min-h-[48px]'
                  : 'p-2.5 min-h-[68px]'
              } ${
                isBeingDragged
                  ? 'opacity-25 border-2 border-dashed border-emerald-500 scale-95 shadow-inner'
                  : isCurrentDropTarget
                  ? 'ring-2 ring-emerald-500 bg-emerald-50/80 scale-[1.02] shadow-md z-20'
                  : !rep.active
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
                <div className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white font-mono text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                  NEXT
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
                  null
                ) : isTiedWinner ? (
                  <span className="px-1 py-0.2 rounded bg-amber-500 text-white font-mono text-[8px] font-bold shrink-0">
                    Tie
                  </span>
                ) : isStanding ? (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white font-mono text-[8px] font-bold tracking-wider shrink-0">
                    STAND
                  </span>
                ) : !isPresent ? (
                  <span className="px-1 py-0.2 rounded bg-slate-200 text-slate-500 font-mono text-[8px] font-bold shrink-0">
                    AWAY
                  </span>
                ) : null}
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

      {/* Floating Drag Preview Clone attached to cursor */}
      {isDragging && draggedRep && dragCursor && cardDimensions && (
        <div
          style={{
            position: 'fixed',
            left: dragCursor.x - cardDimensions.width / 2,
            top: dragCursor.y - cardDimensions.height / 2,
            width: cardDimensions.width,
            height: cardDimensions.height,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className={`rounded-lg shadow-2xl border-2 border-emerald-600 bg-white/95 backdrop-blur-xs scale-105 transition-transform flex flex-col justify-between select-none ${
            density === 'compact' ? 'p-2 min-h-[48px]' : 'p-2.5 min-h-[68px]'
          }`}
        >
          <div className="flex items-start justify-between gap-1">
            <div className="truncate pr-1">
              <div className="font-serif-editorial font-bold text-sm sm:text-[14px] leading-tight truncate text-emerald-950">
                {getCardDisplayName(draggedRep.name)}
              </div>
              {density === 'comfortable' && (
                <div className="font-mono text-[9.5px] truncate leading-none mt-1 text-slate-500">
                  {draggedRep.school || 'Independent'}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 font-mono text-[9px] border-t border-slate-100 mt-1 text-slate-600">
            <span className="px-1 py-0.2 rounded font-bold bg-slate-100 text-slate-700">
              {mode === 'speech' ? `${draggedRep.speeches_count} SP` : `${draggedRep.questions_count} Q`}
            </span>
            <span className="text-[8.5px] font-medium text-emerald-700 font-mono">
              Moving Seating...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
