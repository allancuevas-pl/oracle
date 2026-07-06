---
name: Oracle
description: Deal intelligence platform for Property Lions — brass on black, built for high-stakes commercial property.
colors:
  brass: "#D4AF37"
  brass-light: "#DEB87B"
  brass-deep: "#483A20"
  cream: "#F9F3E6"
  porcelain: "#FDFBF7"
  ink: "#0A0A0A"
  void: "#050505"
  sale-green: "#34D399"
  lease-blue: "#60A5FA"
  alert-red: "#F87171"
  caution-amber: "#FBBF24"
typography:
  display:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  secondary:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: '"Schibsted Grotesk", system-ui, sans-serif'
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.brass-light}"
    textColor: "{colors.ink}"
  icon-button:
    backgroundColor: "#0F0F0E"
    rounded: "{rounded.md}"
    size: "32px"
  input:
    backgroundColor: "#111111"
    textColor: "{colors.cream}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "#0F0F0E"
    rounded: "{rounded.xl}"
    padding: "20px"
  chip:
    rounded: "{rounded.full}"
    typography: "{typography.label}"
    padding: "2px 8px"
  table-header:
    textColor: "{colors.cream}"
    typography: "{typography.label}"
---

# Design System: Oracle

## 1. Overview

**Creative North Star: "The Private Deal Room"**

Oracle is the room where the deal actually happens: low light, the door closed, the numbers on the table, and one brass detail catching the light. The interface is discreet by default. The surface is near-black and almost silent, secondary information recedes into the dark, and the single accent (a brass gold) is spent sparingly, the way real wealth understates itself. Nothing shouts. Restraint is the signal of seriousness; the platform handles eight-figure commercial property decisions and should feel like it.

Density is high and deliberate. This is an operator's tool, not a marketing surface: dense tables of comps, feasibility numbers, lease evidence, and pipeline stages. Information earns its space through proximity and weight, not through boxes and chrome. Surfaces are built from faint white overlays on the black rather than solid grey cards, so depth reads as light pooling in a dark room, never as plastic UI layers. Numbers are first-class citizens, set in tabular figures so they align down every column.

What Oracle is not: it is not a bright SaaS dashboard, not a neon "fintech" gradient, not a glassmorphic toy. It rejects pure black (`#000`) and pure white (`#fff`) for warm, tinted near-blacks and creams. It rejects decorative color. The brass is a scalpel, not a paintbrush.

**Key Characteristics:**
- Near-black canvas, brass accent spent sparingly, cream text in tiered opacities.
- High information density; tables and figures over cards and chrome.
- Depth from tonal light (white-opacity overlays), not heavy shadows.
- Tabular numerals everywhere figures appear.
- One typeface (Schibsted Grotesk) carrying the whole interface.
- Quiet by default; the only "glow" is brass under a primary action.

## 2. Colors

A single brass accent over a warm near-black, with cream text stepped through opacity tiers for hierarchy. Status hues appear only as functional signals, never decoration.

### Primary
- **Brass** (`#D4AF37`): The one accent. Primary buttons, active states, the active sort arrow, key figures, brand marks. It is rare on purpose, never a fill for large areas.
- **Brass Light** (`#DEB87B`): The hover/lift state of brass. Primary buttons brighten to this on hover.
- **Brass Deep** (`#483A20`): Low-chroma brass for hairline borders and table-row hover tints (`brand-900`), where the gold should be felt, not seen.

### Neutral
- **Ink** (`#0A0A0A`): The base canvas. The warm near-black every screen sits on. Never `#000`.
- **Void** (`#050505`): A deeper black for headers, the client portal shell, and modal scrims, used to push a layer behind Ink.
- **Cream** (`#F9F3E6`): The primary text color (`brand-100`), almost always rendered through an opacity tier, never `#fff`. Full strength for headings, /70 for body, /50 for secondary, /40 for muted.
- **Porcelain** (`#FDFBF7`): The brightest near-white (`brand-50`), reserved for the highest-emphasis headings.

### Tertiary (functional status only)
- **Sale Green** (`#34D399`): Sale comps, verified badges, approvals. Used at ~10% fill with the full-strength text (`bg-emerald-500/10 text-emerald-400`).
- **Lease Blue** (`#60A5FA`): Lease comps, informational tags.
- **Alert Red** (`#F87171`): Destructive actions, declines, access-denied.
- **Caution Amber** (`#FBBF24`): Warnings, incentives, staleness flags.

### Named Rules
**The Scarce Brass Rule.** Brass touches no more than ~10% of any screen. One primary action, the active state, a key figure. If two brass elements compete for attention in the same view, one of them is wrong.

**The No-Pure Rule.** `#000` and `#fff` are forbidden. The canvas is warm Ink (`#0A0A0A`), text is warm Cream (`#F9F3E6`). Pure values read cheap and cold against the brass.

**The Opacity-Ladder Rule.** Text hierarchy is built from Cream at stepped opacities, not from different colors: heading (full / porcelain), body (`/70`), secondary (`/50`), muted (`/40`). Never take readable text below `/40` on Ink.

## 3. Typography

**Display / Body / Label Font:** Schibsted Grotesk (with `system-ui` fallback during font swap).

**Character:** One contemporary grotesque carries the entire UI: editorial enough to feel considered, neutral enough to stay legible at the small sizes a dense data tool demands. There is no second family. Hierarchy comes from size, weight, opacity, and letter-spacing, never from a font switch.

### Hierarchy
- **Display** (Semibold 600, 1.5rem / 24px, line-height 1.2, tracking -0.01em): Page titles only ("Comps", "Properties"). Paired with a brass eyebrow label above it.
- **Title** (Semibold 600, 1rem / 16px, line-height 1.35): Section headers inside a screen, modal titles, record names.
- **Body** (Regular 400, 0.875rem / 14px, line-height 1.5): The workhorse. Table cells, field values, descriptions. The dense-UI baseline; do not drop body below 14px.
- **Secondary** (Regular 400, 0.75rem / 12px): Supporting detail, metadata, helper text.
- **Label** (Semibold 600, 0.625rem / 10px, uppercase, tracking 0.08em): The signature micro-label. Table headers, eyebrows, chips, status tags. Always uppercase, always letter-spaced, never below 10px.

### Named Rules
**The Tabular Rule.** Every surface that shows numbers (tables, feaso figures, comp evidence) sets `font-variant-numeric: tabular-nums` so digits align down the column. Misaligned figures read as amateur in a numbers business.

**The Eyebrow Rule.** Page and section titles are introduced by a brass uppercase Label eyebrow above the title (e.g. a 10px tracked "CONFIGURATION" over "Settings"). The eyebrow orients; the title names.

**The 10px Floor Rule.** No text below 10px, ever. The 9px experiment is dead. Micro-labels live at 10px with weight and tracking doing the work.

## 4. Elevation

Oracle is **flat by default and lit by tone**. Depth is built almost entirely from translucent white overlays on the Ink canvas (`bg-white/[0.01]` through `bg-white/[0.05]`), so a "raised" surface reads as a faint pool of light, not a grey card with a drop shadow. Borders are hairline white at low opacity (`border-white/[0.06]`). This keeps the room dark and the hierarchy quiet.

Shadows are rare and reserved for things that genuinely float above the page, plus one signature glow.

### Shadow Vocabulary
- **Floating panel** (`box-shadow: 0 24px 80px rgba(0,0,0,0.7)`): Modals and the bulk-action bar that hover over the canvas. Deep, soft, near-black.
- **Brass glow** (`box-shadow: 0 0 15px rgba(212,175,55,0.15)`): The signature. A faint gold halo under primary buttons only. It is the single warmest light in the room.
- **Status glow** (`box-shadow: 0 0 8px rgba(<status>,0.6)`): Tiny colored halos on live status dots (pipeline stages), never on large surfaces.

### Named Rules
**The Flat-Room Rule.** Surfaces are flat at rest. If you reach for a drop shadow to separate two elements, use a tonal overlay or a hairline border instead. Shadow is for floating, not for grouping.

**The One-Glow Rule.** The brass glow belongs to the primary action and nothing else. Spreading it onto cards or inputs cheapens it.

## 5. Components

### Buttons
- **Shape:** Gently rounded (6px, `rounded-md`).
- **Primary:** Brass fill (`#D4AF37`) with Ink text (`#0A0A0A`), Semibold, ~10px/16px padding, carrying the brass glow. On hover it brightens to Brass Light (`#DEB87B`), lifts `scale(1.02)`, and presses to `scale(0.95)` on active. This is the loudest element in the system and should appear once per view.
- **Icon button:** 32px square (`rounded-md`), faint overlay surface (`bg-white/[0.02]`, `border-white/[0.06]`), muted icon that brightens on hover. Three variants: default, primary (brass-tinted), danger (red on hover). This is the workhorse action affordance in record headers.
- **Ghost / text:** No fill; muted Cream that brightens to brass on hover. For tertiary actions and "Load more".

### Chips / Tags
- **Style:** Pill (`rounded-full`), Label typography (10px uppercase, tracked), ~2px/8px padding.
- **Status variant:** Functional hue at ~10% fill with full-strength text (`bg-emerald-500/10 text-emerald-400`). Sale = green, Lease = blue.
- **Source variant:** Neutral faint surface (`bg-white/[0.03] border-white/[0.05]`) with muted text, for provenance ("Curated", "Arealytics").

### Cards / Containers
- **Corner:** 12px (`rounded-xl`).
- **Background:** A faint overlay (`bg-white/[0.02]`), not a solid grey. Hover lifts to `bg-white/[0.04]`.
- **Border:** Hairline white (`border-white/[0.06]`).
- **Shadow:** None at rest (see Elevation).
- **Padding:** 20px (`lg`). Use cards only when content is genuinely a distinct, actionable object. Prefer spacing and dividers for grouping. Never nest a card in a card.

### Inputs / Fields
- **Style:** Dark well (`#111` or `bg-white/[0.03]`), hairline border, 6px radius, 8px/12px padding.
- **Focus:** Border shifts to brass at 50% (`focus:border-brand-500/50`) with a faint brass ring (`focus:ring-1 focus:ring-brand-500/20`). No heavy glow.
- **Placeholder:** Cream at `/35`, softer than entered body text.

### Tables
- **Header:** Label typography (10px uppercase, tracked), muted Cream, on a Void tint (`bg-[#0A0A0A]/50`). Sortable headers show a brass arrow when active and a faint arrow on hover.
- **Rows:** Body text, `tabular-nums`, hover tint `bg-brand-900/10` (deep brass, barely there). Hairline row dividers (`border-white/[0.03]`).
- **Empty cell:** A muted italic em dash (`—`), never blank.

### Navigation
- Left sidebar on Ink. Items are muted Cream Labels that brighten on hover; the active item carries a brass tint. The client portal uses a stripped top bar instead of the full sidebar.

### Loading (signature system)
- **PageLoader** for whole records/views (centered brass spinner). **SkeletonTable** for list/table loads (content-shaped pulse bars, no layout shift). **Spinner** for inline sections.
- **Row entrance:** Lists reveal with a capped stagger (`rowEntrance`), ease-out-quint, finishing in ~0.3s no matter the row count. Loading is consistent across every screen.

## 6. Do's and Don'ts

### Do:
- **Do** keep brass to ≤10% of any screen; one primary action per view.
- **Do** build text hierarchy from Cream at stepped opacities (heading / `/70` / `/50` / `/40`), and keep readable text at `/40` or brighter on Ink.
- **Do** set `tabular-nums` on anything showing figures.
- **Do** introduce titles with a brass uppercase eyebrow Label.
- **Do** create depth with tonal overlays (`bg-white/[0.02]`) and hairline borders (`border-white/[0.06]`), not drop shadows.
- **Do** use Schibsted Grotesk for everything; let size, weight, opacity, and tracking carry hierarchy.
- **Do** reserve the brass glow for primary buttons alone.

### Don't:
- **Don't** use `#000` or `#fff`. Canvas is Ink (`#0A0A0A`), text is Cream (`#F9F3E6`).
- **Don't** drop any text below 10px, or readable text below `/40` opacity on Ink.
- **Don't** use a colored `border-left`/`border-right` stripe as an accent on cards, rows, or alerts. Use full hairline borders, background tints, or leading icons.
- **Don't** use gradient text (`background-clip: text`) or decorative gradients. Emphasis comes from weight, size, and the single brass.
- **Don't** lean on glassmorphism (decorative blur/glass cards). Surfaces are flat tonal overlays.
- **Don't** reach for a modal as the first answer; exhaust inline and progressive disclosure first.
- **Don't** repeat identical icon-heading-text card grids; vary structure and prefer tables for dense data.
- **Don't** introduce a second typeface or a generic default (Inter, Roboto, system-only). The interface is Schibsted Grotesk.
- **Don't** spend brass on large fills or multiple competing accents in one view. Its rarity is the point.
