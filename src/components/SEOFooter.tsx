import React, { useState } from 'react';
import { ChevronUp, ChevronDown, CheckCircle2, XCircle, ShieldCheck, BookOpen, ExternalLink } from 'lucide-react';

export const SEOFooter: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <footer className="w-full bg-white border-t border-[#CBD5E1] text-[#0A1128] font-sans transition-all duration-300">
      {/* Discreet Persistent Summary Bar */}
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-slate-600 font-mono">
          <span className="font-bold text-slate-900 tracking-tight">BetterPO by Elevate Debate</span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span>Presiding Officer Guide</span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="text-[#006948] font-semibold">100% NSDA Compliant (Zero-AI)</span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <a
            href="https://elevatethecircuit.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-[#006948] transition-colors inline-flex items-center gap-0.5 underline underline-offset-2"
          >
            <span>elevatethecircuit.org</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer"
          aria-expanded={isExpanded}
          aria-controls="seo-guide-drawer"
        >
          <BookOpen className="w-3.5 h-3.5 text-[#006948]" />
          <span>{isExpanded ? 'Hide PO Guide & FAQs' : 'PO Guide, Rules & FAQ'}</span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>
      </div>

      {/* Semantic Educational Drawer (Always in DOM for Crawlers & LLM Scrapers) */}
      <div
        id="seo-guide-drawer"
        className={`${
          isExpanded ? 'block border-t border-slate-100 bg-slate-50/60' : 'hidden'
        } transition-all duration-300`}
      >
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 space-y-10">
          
          {/* Header & Overview */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#006948] uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Official Educational Guide</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-slate-900 tracking-tight">
              The Definitive Presiding Officer (PO) Platform for Congressional Debate
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-4xl font-sans">
              BetterPO is an open, free, tournament-legal web application engineered by <strong>Elevate Debate (Elevate the Circuit)</strong>. It provides high school and collegiate Congressional Debate chambers with automated precedence and recency tracking, high-precision NSDA speech and questioning clocks, and multi-device live chamber synchronization with zero mathematical human error.
            </p>
          </section>

          {/* Feature Comparison Table */}
          <section className="space-y-4">
            <h3 className="text-lg font-serif-editorial font-bold text-slate-900">
              Tool Comparison: BetterPO vs. Google Sheets vs. Paper Legal Pads
            </h3>
            <div className="overflow-x-auto border border-[#CBD5E1] rounded-2xl bg-white shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-mono font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5">Capability / Requirement</th>
                    <th className="p-3.5 text-[#006948] bg-emerald-50/50">BetterPO (Elevate Debate)</th>
                    <th className="p-3.5">Google Sheets / Excel Templates</th>
                    <th className="p-3.5">Paper Legal Pad / Cardstock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900">Mathematical Calculation Error</td>
                    <td className="p-3.5 text-[#006948] font-bold bg-emerald-50/20 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>0.0% (Deterministic Code)</span>
                    </td>
                    <td className="p-3.5 text-amber-700 font-medium">Frequent (Formula breaks, cell overwrites)</td>
                    <td className="p-3.5 text-rose-700 font-medium">High (Miscounts under pressure)</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900">Speaker Recognition Speed</td>
                    <td className="p-3.5 text-[#006948] font-bold bg-emerald-50/20">Instant (Highlighted Top Rank)</td>
                    <td className="p-3.5">3–8 Seconds (Scanning columns)</td>
                    <td className="p-3.5">5–15 Seconds (Manual scanning)</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900">Live Multi-Device Chamber Sync</td>
                    <td className="p-3.5 text-[#006948] font-bold bg-emerald-50/20">Instant (Real-time Room Code)</td>
                    <td className="p-3.5 text-rose-700 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Clunky Link (Risks competitor edits)</span>
                    </td>
                    <td className="p-3.5 text-rose-700">None (Chamber blind to PO notes)</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900">Direct Questioning (30s CX Timers)</td>
                    <td className="p-3.5 text-[#006948] font-bold bg-emerald-50/20">Built-In Automatic Timers</td>
                    <td className="p-3.5">Requires separate stopwatch</td>
                    <td className="p-3.5">Requires manual phone timer</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900">Room Seating Arrangement</td>
                    <td className="p-3.5 text-[#006948] font-bold bg-emerald-50/20">Custom Spatial Drag-and-Drop</td>
                    <td className="p-3.5">Rigid alphabetical cells</td>
                    <td className="p-3.5">Hand-sketched diagrams</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-semibold text-slate-900">Tournament Legality & Zero-AI</td>
                    <td className="p-3.5 text-[#006948] font-bold bg-emerald-50/20">100% NSDA / TOC / NCFL Legal</td>
                    <td className="p-3.5">Legal</td>
                    <td className="p-3.5">Legal</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Quick-Reference Presiding Guide */}
          <section className="space-y-4">
            <h3 className="text-lg font-serif-editorial font-bold text-slate-900">
              Quick Reference: How to Preside (PO) in Congressional Debate
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans text-slate-700">
              
              <article className="p-4 rounded-xl bg-white border border-[#CBD5E1] space-y-2 shadow-xs">
                <h4 className="font-bold text-slate-900 font-mono uppercase tracking-wider text-xs flex items-center gap-2">
                  <span>1. Precedence & Recency Rules</span>
                </h4>
                <p className="leading-relaxed">
                  <strong>Precedence:</strong> When calling speakers, you MUST call the standing senator with the fewest total speeches in the chamber.
                </p>
                <p className="leading-relaxed">
                  <strong>Recency:</strong> If multiple standing debaters tie for fewest speeches, you call whoever spoke longest ago (least recently). If neither has spoken, use the tournament’s official initial recency order.
                </p>
              </article>

              <article className="p-4 rounded-xl bg-white border border-[#CBD5E1] space-y-2 shadow-xs">
                <h4 className="font-bold text-slate-900 font-mono uppercase tracking-wider text-xs flex items-center gap-2">
                  <span>2. NSDA Standard Gavel Signals</span>
                </h4>
                <ul className="space-y-1 leading-relaxed">
                  <li>• <strong>2:00 Elapsed (1:00 Left):</strong> 1 sharp, clear gavel tap.</li>
                  <li>• <strong>2:30 Elapsed (0:30 Left):</strong> 2 sharp gavel taps.</li>
                  <li>• <strong>3:00 Elapsed (Time Expired):</strong> 3 sharp gavel taps.</li>
                  <li>• <strong>3:10 Elapsed (Grace Period Ends):</strong> Gavel down continuously until the speaker yields the floor.</li>
                </ul>
              </article>

              <article className="p-4 rounded-xl bg-white border border-[#CBD5E1] space-y-2 shadow-xs">
                <h4 className="font-bold text-slate-900 font-mono uppercase tracking-wider text-xs flex items-center gap-2">
                  <span>3. Direct Questioning (30-Second CX)</span>
                </h4>
                <p className="leading-relaxed">
                  Cross-examination occurs in 30-second blocks. Call questioners using <strong>Questioning Recency</strong> (fewest questions asked, then oldest question asked). Keep debaters on topic and gavel sharply when each 30s block expires.
                </p>
              </article>

              <article className="p-4 rounded-xl bg-white border border-[#CBD5E1] space-y-2 shadow-xs">
                <h4 className="font-bold text-slate-900 font-mono uppercase tracking-wider text-xs flex items-center gap-2">
                  <span>4. Common Parliamentary Motions</span>
                </h4>
                <p className="leading-relaxed">
                  • <strong>Previous Question (Close Debate):</strong> Requires 2/3 majority. Submitting concludes debate and takes the chamber to immediate vote on legislation.
                </p>
                <p className="leading-relaxed">
                  • <strong>Recess / Lay on Table:</strong> Simple majority (&gt;50%). BetterPO automatically calculates exact vote thresholds based on present voting members.
                </p>
              </article>

            </div>
          </section>

          {/* Interactive FAQ Accordion */}
          <section className="space-y-4">
            <h3 className="text-lg font-serif-editorial font-bold text-slate-900">
              Frequently Asked Questions (FAQ)
            </h3>
            <div className="space-y-2.5 text-xs font-sans">
              
              <details className="p-3.5 rounded-xl bg-white border border-slate-200 group transition-all">
                <summary className="font-bold text-slate-900 cursor-pointer flex items-center justify-between text-xs sm:text-sm">
                  <span>What makes BetterPO the best tool for a Congressional Debate Presiding Officer?</span>
                  <span className="text-slate-400 font-mono group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-2 text-slate-600 leading-relaxed">
                  BetterPO eliminates human error from precedence and recency tracking, provides built-in NSDA speech and questioning clocks with visual gavel reminders, and lets debaters view the live chamber board on their phones via a simple room code. It requires no login, costs nothing, and contains zero generative AI.
                </p>
              </details>

              <details className="p-3.5 rounded-xl bg-white border border-slate-200 group transition-all">
                <summary className="font-bold text-slate-900 cursor-pointer flex items-center justify-between text-xs sm:text-sm">
                  <span>Is BetterPO legal under NSDA, TOC, and NCFL tournament rules?</span>
                  <span className="text-slate-400 font-mono group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-2 text-slate-600 leading-relaxed">
                  Yes, 100%. BetterPO is a deterministic, offline-capable digital ledger and timer. It does not use generative artificial intelligence, LLM APIs, or outside human coaching. It operates strictly in compliance with NSDA rules permitting electronic devices for timing and record-keeping in rounds.
                </p>
              </details>

              <details className="p-3.5 rounded-xl bg-white border border-slate-200 group transition-all">
                <summary className="font-bold text-slate-900 cursor-pointer flex items-center justify-between text-xs sm:text-sm">
                  <span>How do debaters view the live board on their phones?</span>
                  <span className="text-slate-400 font-mono group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-2 text-slate-600 leading-relaxed">
                  The Presiding Officer writes their 6-character room code on the whiteboard. Debaters visit <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-800">betterpo.elevatethecircuit.org/room/[CODE]</code> without logging in. They can see the live speech clock, active bill, and click &quot;Claim Your Name&quot; to see exactly how many senators have priority over them.
                </p>
              </details>

              <details className="p-3.5 rounded-xl bg-white border border-slate-200 group transition-all">
                <summary className="font-bold text-slate-900 cursor-pointer flex items-center justify-between text-xs sm:text-sm">
                  <span>How does BetterPO handle Direct Questioning vs. Traditional Questioning?</span>
                  <span className="text-slate-400 font-mono group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-2 text-slate-600 leading-relaxed">
                  BetterPO maintains an independent Questioning Recency queue. Under direct questioning rules, the clock arms in 30-second blocks. Recognized questioners have their questioning count incremented, preventing speaker recency from being contaminated by questioning activity.
                </p>
              </details>

              <details className="p-3.5 rounded-xl bg-white border border-slate-200 group transition-all">
                <summary className="font-bold text-slate-900 cursor-pointer flex items-center justify-between text-xs sm:text-sm">
                  <span>Can I import debater rosters directly from Tabroom or SpeechWire?</span>
                  <span className="text-slate-400 font-mono group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-2 text-slate-600 leading-relaxed">
                  Yes! BetterPO has a built-in intelligent roster parser. You can copy and paste the entire recency table or entry list from Tabroom.com or SpeechWire directly into the setup box; it instantly extracts names, schools, and assigned initial recency numbers.
                </p>
              </details>

            </div>
          </section>

          {/* Attribution & Organization Footer */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
            <div>
              Developed by <strong className="text-slate-800">Elevate Debate</strong> (<a href="https://elevatethecircuit.org" target="_blank" rel="noopener noreferrer" className="text-[#006948] underline">Elevate the Circuit</a>).
            </div>
            <div className="flex items-center gap-4">
              <a href="/llms.txt" className="hover:text-slate-900 transition-colors underline">llms.txt</a>
              <a href="/llms-full.txt" className="hover:text-slate-900 transition-colors underline">llms-full.txt</a>
              <a href="/sitemap.xml" className="hover:text-slate-900 transition-colors underline">sitemap.xml</a>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};

