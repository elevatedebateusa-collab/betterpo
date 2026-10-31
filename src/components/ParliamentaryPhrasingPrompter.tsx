import React, { useState } from 'react';
import { 
  Volume2, 
  Copy, 
  Check, 
  ChevronUp, 
  ChevronDown, 
  Sparkles,
  Users,
  Mic,
  Vote,
  Compass
} from 'lucide-react';
import type { Room, Representative, Bill } from '../lib/supabase';

interface ParliamentaryPhrasingPrompterProps {
  room: Room;
  representatives: Representative[];
  bills: Bill[];
  currentSpeakerId?: string | null;
  mode?: 'speech' | 'question';
}

type PhrasingCategory = 'recognize' | 'cross_ex' | 'vote' | 'open_floor' | 'amendment';

export const ParliamentaryPhrasingPrompter: React.FC<ParliamentaryPhrasingPrompterProps> = ({
  room,
  representatives,
  bills,
  currentSpeakerId,
  mode = 'speech',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PhrasingCategory | null>(null);
  const [copied, setCopied] = useState(false);

  // Active Context calculations
  const activeBill = bills.find((b) => b.id === room.active_bill_id) || bills[0];
  const activeSpeaker = representatives.find((r) => r.id === currentSpeakerId);
  const activeAmendment = room.active_amendment;
  const isDirectCX = room.settings?.cx_mode === 'direct';

  // Determine auto/recommended phase
  const autoCategory: PhrasingCategory = activeAmendment
    ? 'amendment'
    : currentSpeakerId
    ? 'recognize'
    : mode === 'question'
    ? 'cross_ex'
    : 'open_floor';

  const currentTab = selectedCategory || autoCategory;

  // Generate scripts dynamically based on names & current state
  const getScriptData = (tab: PhrasingCategory): { title: string; script: string; tip: string } => {
    const speakerName = activeSpeaker ? `Senator ${activeSpeaker.name.split(' ').pop() || activeSpeaker.name}` : 'Senator [Name]';
    const school = activeSpeaker?.school ? ` of ${activeSpeaker.school}` : '';
    const billRef = activeBill ? activeBill.bill_number : 'the item on the floor';

    switch (tab) {
      case 'recognize':
        return {
          title: 'Recognizing Speaker',
          script: `“The chair recognizes ${speakerName}${school} to speak on ${billRef}. You have three minutes, and the floor is yours.”`,
          tip: 'Deliver with gavel tap as speaker reaches the podium. Begin the 3-minute timer on their first word.',
        };
      case 'cross_ex':
        return {
          title: 'Calling Questioners (Cross-Examination)',
          script: isDirectCX
            ? `“The speaker has concluded. The speaker will now stand open for direct cross-examination in thirty-second blocks. Questioners, please rise.”`
            : `“The speaker will now stand open for one-question cross-examination. All those wishing to question the speaker, please rise.”`,
          tip: isDirectCX 
            ? 'Track individual 30-second blocks. Tap once at 25s, twice at 30s.'
            : 'Award single questions following questioning precedence & recency.',
        };
      case 'vote':
        return {
          title: 'Taking a Vote (Previous Question / Passage)',
          script: `“The question now recurs on the passage of ${billRef}. All those in favor, please raise your placards... [pause & tally] All those opposed, same sign... [pause & tally] The ayes [or nays] have it, and the bill [passes / fails].”`,
          tip: 'Call for division if voice vote or quick show of hands is ambiguous. Verify against Simple Majority or 2/3 Quorum.',
        };
      case 'amendment':
        return {
          title: 'Floor Amendment Debate',
          script: activeAmendment
            ? `“The chair is in receipt of a floor amendment submitted by Senator ${activeAmendment.author_name}. The clerk has distributed copies. The chair recognizes the author for a three-minute authorship speech.”`
            : `“The question recurs on the adoption of the amendment. All in favor raise placards... All opposed... The amendment is [adopted / rejected], and debate resumes on the main legislation.”`,
          tip: 'Amendments take precedence over the main motion. Speeches given on amendments count toward overall speaker precedence.',
        };
      case 'open_floor':
      default:
        return {
          title: 'Calling Orders of the Day / Open Floor',
          script: `“The floor is now open for debate. For what purpose does the senator rise?”`,
          tip: 'Wait for senators to state their intent (e.g. “To introduce a motion to recess”, “To speak in the affirmative”).',
        };
    }
  };

  const { title, script, tip } = getScriptData(currentTab);

  const handleCopy = () => {
    navigator.clipboard.writeText(script.replace(/^“|”$/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all">
      {/* Header bar / tab selector */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950/70 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-400">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-white tracking-wide uppercase">
            Parliamentary Phrasing Prompter
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 font-mono">
            NSDA / Robert's Rules
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Category Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedCategory('recognize')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                currentTab === 'recognize'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Recognizing Speaker"
            >
              <Mic className="w-3 h-3" />
              <span className="hidden md:inline">Speaker</span>
            </button>

            <button
              onClick={() => setSelectedCategory('cross_ex')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                currentTab === 'cross_ex'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Calling Questioners"
            >
              <Users className="w-3 h-3" />
              <span className="hidden md:inline">Cross-Ex</span>
            </button>

            <button
              onClick={() => setSelectedCategory('vote')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                currentTab === 'vote'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Taking Votes"
            >
              <Vote className="w-3 h-3" />
              <span className="hidden md:inline">Vote</span>
            </button>

            <button
              onClick={() => setSelectedCategory('open_floor')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                currentTab === 'open_floor'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Open Floor"
            >
              <Compass className="w-3 h-3" />
              <span className="hidden md:inline">Floor</span>
            </button>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            title={isCollapsed ? 'Expand Prompter' : 'Collapse Prompter'}
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Prompter Body */}
      {!isCollapsed && (
        <div className="p-3 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {title}
              </span>
            </div>
            <p className="text-xs text-white font-medium italic leading-relaxed selection:bg-amber-500 selection:text-slate-950">
              {script}
            </p>
            <div className="text-[10px] text-slate-400">
              Tip: {tip}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Phrasing'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

