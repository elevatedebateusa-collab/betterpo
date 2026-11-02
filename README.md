# Elevate Chamber 🏛️
### Real-Time Presiding Officer (PO) Platform & Docket Suite for Congressional Debate

**Elevate Chamber** is a full-stack, zero-cost, real-time parliamentary tracking platform designed specifically for elected Presiding Officers (POs), competitors, and parliamentarians in Congressional Debate (NSDA, NCFL, UK TOC, State Leagues).

Built with **React (Vite)**, **TypeScript**, **Tailwind CSS**, and **Supabase Realtime**.

---

## ⚡ Core Systems & New Capabilities

### 1. Active Bill & Docket Tracker
- **Database Table (`public.bills`)**: Tracks docket items with `bill_number` (e.g. "Bill 1", "A Resolution to..."), `title`, `author_school`, `speech_count`, `cycle_broken`, and `status` (`active`, `passed`, `failed`, `tabled`, `upcoming`).
- **Docket Manager**: Full modal to add bills, review the chamber docket, set active bills on the floor with one click, and record legislative votes (Passed, Failed, Tabled).
- Automatically updates `rooms.current_legislation` and syncs live across competitor boards.

### 2. Speech & Cycle Sequence Monitor
- **NSDA Parliamentary Cycle Progression**:
  - Automatically identifies whether an **Authorship/Sponsorship**, **Negative**, or **Affirmative** speech is next expected in order.
  - Dynamically displays the live expected side with visual color badges (Purple for 1st Speech, Red for Negative, Green for Affirmative).
- **"Break Cycle" Override Logic**:
  - When no opposite speaker stands, PO can click **"Break Cycle"** to record that the chamber voted to break the cycle.
  - Surfaces a prominent `⚠️ Cycle Broken (Consecutive Speeches Permitted)` warning and records the cycle break on the active bill and in session ledgers.

### 3. Synchronized Timer with Gavel Cues & Recess Controls
- **Parliamentary Gavel Cue Signals**:
  - **1 Gavel Tap**: at 1:00 remaining (2:00 mark)
  - **2 Gavel Taps**: at 0:30 remaining (2:30 mark)
  - **3 Gavel Taps**: at 0:00 (Time expired / 10s Grace period begins)
  - **Continuous Gavel Strike**: at -0:10 (Grace period expired - Senator must forfeit the floor)
  - Realistic wooden gavel strike audio synthesized via the browser's Web Audio API with synchronized visual tap counter flashes.
- **Recess / Caucus Mode**:
  - Dedicated 5:00 caucus / recess timer.
  - Puts the chamber in `'recess'` status and displays a live countdown banner on all spectator boards so competitors know when to return.

### 4. "Who's Standing?" Spatial Tap-Grid & Precedence Engine
- Fixed alphabetical order tiles so the PO builds muscle memory without cards shifting.
- Tap standing senators to instantly calculate priority:
  $$\text{Score} = (\text{speeches\_count} \times 10{,}000) + \text{last\_speech\_order}$$
- The senator who legally holds the floor highlights in bright **emerald green** (`★ Next Up`); other standing senators illuminate in **vivid sapphire**.

### 5. Spectator / Competitor View (`/room/:code`)
- Mobile-responsive, live-updating board synced via Supabase Realtime (`representatives`, `rooms`, `bills`, `round_events`).
- Shows the Absolute Recency Ladder, current floor speaker, live clock, and active bill cycle status.

---

## 🛠️ Project Directory Structure

```
├── supabase/
│   └── schema.sql                # Complete Supabase PostgreSQL schema with rooms, reps, bills, round_events
├── src/
│   ├── components/
│   │   ├── ChamberTimer.tsx      # Gavel cues (1, 2, 3 taps) & Recess controls
│   │   ├── CycleSequenceMonitor.tsx # Speech & cycle monitor with Break Cycle override
│   │   ├── DocketTracker.tsx     # Active bill & docket modal with voting outcomes
│   │   ├── FloorGrid.tsx         # Fixed spatial muscle-memory tap-grid
│   │   ├── RecencyLadder.tsx     # The Absolute Recency Ladder (Speeches & Questions)
│   │   └── RosterImportModal.tsx # Bulk roster ingestion
│   ├── lib/
│   │   ├── precedence.ts         # Pure mathematical scoring & tiebreakers
│   │   ├── supabase.ts           # Supabase client + local BroadcastChannel fallback
│   │   └── chamberService.ts     # Room CRUD, bills, floor actions & CSV export
│   ├── pages/
│   │   ├── ChamberHome.tsx       # Landing page, chamber creation & spectator join
│   │   ├── PODashboard.tsx       # PO 2-column controller (~65% Floor left, ~35% Ladder/Monitors right)
│   │   └── SpectatorBoard.tsx    # Live spectator view synced via Realtime
│   ├── App.tsx                   # Client-side router configuration
│   └── index.css                 # Tailwind CSS styles & custom scrollbars
├── .env.example
└── README.md
```

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run Vite dev server
npm run dev
```

Run [`supabase/schema.sql`](./supabase/schema.sql) in your Supabase SQL Editor to provision the database and realtime replication.

## Shared selection controls

Reusable UI primitives live in `src/components/ui`, matching the source layout
and the `@/components/ui` alias used by shadcn. `components.json` points the CLI
to this directory so new primitives do not get mixed into chamber logic.
The project retains Tailwind 3 and TypeScript; no Tailwind migration is required.

- `tabs.tsx`: the supplied Radix tab component, including default, button, and
  underline variants; use `TabsContent` for associated panels.
- `selection-group.tsx`: the same styling with Radix radio semantics for one
  active setting, mode, filter, or preset. Options support descriptions, icons,
  disabled states, and keyboard navigation. Timer presets use `onReselect` to
  preserve resetting the currently selected preset.
- `badge.tsx`: the supplied badges, with Tailwind 3-compatible utilities and
  color fallbacks.

Use `SelectionGroup` for grouped choices and `Tabs` for navigation between
panels. Keep searchable or long roster dropdowns, independent checkboxes,
and multi-selection seating charts appropriate to their existing interaction.
Both component families use the site's existing green, navy, and Lato buttons.
