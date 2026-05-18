# Oracle Platform - UI & Layout Standards

This document establishes the structural and visual standards for the Oracle application. Future modules and components MUST adhere to these rules to maintain a consistent, institutional-grade experience.

## 1. Global Page Layout (List Views)
**Rule: Full-Width, Edge-to-Edge Canvas**
All main list/table pages (e.g., `Client Briefs`, `Properties`, `Tasks`) must span the full width of the available viewport alongside the sidebar. 
*   **DO NOT** use max-width containers (like `max-w-7xl mx-auto`).
*   **DO** use consistent padding: `<div className="p-6 lg:p-8 space-y-6">`
*   **WHY:** A premium dashboard utilizes all available horizontal real estate, avoiding awkward "dead space" on the left and right margins on large monitors.

## 2. The Workspace Shell (Detail Views)
**Rule: 3-Column HubSpot Style (`RecordWorkspace.jsx`)**
When viewing an individual record (like a specific Brief or Property), the layout must use the `RecordWorkspace` component.
*   **Header:** Sticky top header with Title, Back Button, Status Controls (right-aligned), and Action Buttons.
*   **Left Column (25%):** Static record criteria and uneditable data metrics.
*   **Center Column (50%):** The core interactive feature (e.g., The Pipeline, Match Feed).
*   **Right Column (25%):** The "Pulse" log, timeline, and private notes.

## 3. Data Tables
**Rule: Dark, Minimalist Headers**
*   Table headers should use uppercase, subtle tracking, and slight opacity: `text-xs text-brand-100/50 uppercase bg-[#0A0A0A]/50`
*   Table bodies should have subtle hover states (`hover:bg-brand-900/10`) to indicate interactivity without being overwhelming.

## 4. Typography & Empty States
*   **Missing Data:** Never use a hardcoded dash (`-`) for missing data in the detail views. Always use a subtle italicized fallback: `<span className="text-brand-100/30 italic">Not specified</span>`.
*   **Primary Actions:** Primary buttons (like "Add Property") should use the gold brand color (`bg-brand-500 text-brand-950`) and feature a micro-animation on interaction (`hover:scale-[1.02] active:scale-95`).

## 5. Form Modals
*   **Rule:** Create and Edit operations should happen in a centered overlay modal (`max-w-2xl bg-[#0A0A0A]`) rather than routing the user to a completely new page. This preserves context.

## List Views (Tables)
- **Search Bar**: All list views (Briefs, Properties, etc.) MUST include a search bar at the top of the table for consistency. It should span roughly one-third of the width or have a fixed max-width, with the total record count displayed on the right edge.
