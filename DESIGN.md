# DESIGN.md — Pith Visual Design System

> This document defines the visual language of Pith. It covers tokens, components, motion, copy, and anti-patterns. It does **not** define what appears in each study mode — that is a functional concern defined in mode specs. This document answers: *how does it look and feel*, not *what is shown*.

---

## 0. North Star

Pith is a serious tool for serious students. It respects their intelligence and their time. The interface disappears so the material can breathe. Every visual decision should pass one test: **does this help the user think, or does it compete with thinking?**

**Personality in three words:** Focused. Technical. Unassuming.

The closest product references in spirit: Vercel's dashboard (cold precision), Obsidian (dark, dense, structural), Discord (modern dark UI that doesn't feel like a dev tool). The departure from all of them: Pith has warmth in its accent and restraint in its chrome. It doesn't perform sophistication — it earns it.

---

## 1. Personality & Voice

### Visual personality

| Axis | Position |
|------|----------|
| Formal ↔ Casual | 65% formal |
| Cold ↔ Warm | 40% warm (accent provides warmth, base is cold) |
| Dense ↔ Airy | 45% dense — functional, not spacious for its own sake |
| Flat ↔ Rich | 85% flat — elevation via lightness, not shadow or depth |
| Minimal ↔ Expressive | 70% minimal — one expressive element per screen maximum |

### What Pith is not

- It is not a motivational tool. It does not cheer you on by default.
- It is not a productivity aesthetic (no calligraphy fonts, no warm linen textures, no "your learning journey").
- It is not a dev tool (no monospace everywhere, no terminal aesthetic, no acid-green accents).
- It is not a children's educational app (no cartoons, no confetti by default, no gamification drip).

---

## 2. Color System

### 2.1 Dark Mode (primary)

The base is a cold blue-gray — technical and focused, like a well-lit workstation at night. Layers are differentiated by lightness delta, never by shadow.

```css
/* Backgrounds — each layer is visibly but subtly lighter */
--bg-base:     #111318;   /* Page background */
--bg-surface:  #181c24;   /* Cards, sidebars, panels */
--bg-elevated: #1e2330;   /* Modals, command palette, floating elements */
--bg-overlay:  rgba(0, 0, 0, 0.65);  /* Modal backdrop */

/* Borders */
--border-subtle:  rgba(255, 255, 255, 0.06);  /* Dividers, row separators */
--border-default: rgba(255, 255, 255, 0.10);  /* Interactive elements, inputs */
--border-focus:   rgba(255, 255, 255, 0.22);  /* Focused state */

/* Text */
--text-primary:   #e4e7f0;   /* Main content */
--text-secondary: #8892a4;   /* Supporting labels, metadata */
--text-tertiary:  #545e72;   /* Timestamps, hints, disabled text */
--text-inverse:   #111318;   /* Text placed on accent-colored backgrounds */
```

### 2.2 Accent — Teal (#18c4aa)

Chosen deliberately: teal is warm enough to avoid sterile-tech syndrome, cold enough to pair with the blue-gray base, and unused by every major study app. It reads as "modern tool" without reading as "another startup."

```css
--accent:        #18c4aa;
--accent-hover:  #15b09a;
--accent-active: #12987f;
--accent-muted:  rgba(24, 196, 170, 0.12);  /* Selected states, active rows */
--accent-subtle: rgba(24, 196, 170, 0.06);  /* Very light tints */
```

**Usage rules:**
- Primary buttons, active navigation items, focus rings on inputs, progress fill, highlighted text selections
- Never on body text (use --text-primary)
- Never as a large background fill for whole panels
- One dominant accent usage per screen — if everything is teal, nothing is

### 2.3 Light Mode (afterthought — not a full parallel system)

Light mode uses a warm cream base to evoke paper and reduce eye strain. The teal accent carries over unchanged — it looks richer on cream than it does on pure white.

```css
/* Light mode overrides — all others inherit from dark tokens */
--bg-base:     #faf8f5;   /* Warm cream — the paper */
--bg-surface:  #ffffff;   /* Cards, inputs */
--bg-elevated: #f0ede8;   /* Modals, slightly recessed panels */

--border-subtle:  rgba(0, 0, 0, 0.06);
--border-default: rgba(0, 0, 0, 0.12);
--border-focus:   rgba(0, 0, 0, 0.28);

--text-primary:   #1a1c24;
--text-secondary: #5a6070;
--text-tertiary:  #909aab;
--text-inverse:   #1a1c24;  /* Same as primary — accent is dark enough */
```

No texture in light mode. The warm cream is the character; adding noise on top would oversell it.

### 2.4 Semantic / State Colors

State colors are tinted toward the accent base to feel like they belong to the same system, rather than being generic traffic-light colors.

```css
/* Success — green shifted slightly toward teal */
--success:       #1dc990;
--success-muted: rgba(29, 201, 144, 0.12);

/* Error — red-orange (warm, not alarming) */
--error:         #f0584a;
--error-muted:   rgba(240, 88, 74, 0.12);

/* Warning — amber */
--warning:       #e8a030;
--warning-muted: rgba(232, 160, 48, 0.12);

/* Info — accent itself, with muted variant */
--info:          #18c4aa;
--info-muted:    rgba(24, 196, 170, 0.12);
```

**Accessibility rule:** color is never the *only* differentiator for a state. Every feedback state must include an icon, a label, or both. Color is the reinforcement, not the signal.

---

## 3. Typography

### 3.1 Typeface

**Primary font: DM Sans** (SIL OFL — already available)

DM Sans is a humanist geometric sans-serif designed for digital reading. It is approachable without being playful, modern without being a "dev font." It works at 11px and at 40px. Space Grotesk was considered and rejected — it has too much personality for body text and reads as a development tool, which alienates the student audience.

```css
--font-sans: 'DM Sans', system-ui, -apple-system, sans-serif;
```

No secondary display font for v1. One font, differentiated by size, weight, and spacing. If a display moment arises (landing screen, session-complete), use DM Sans Bold with increased letter-spacing rather than switching typefaces.

### 3.2 Type Scale

```css
--text-xs:   11px;  /* line-height: 1.45; letter-spacing: 0.4px  — labels, captions */
--text-sm:   13px;  /* line-height: 1.5;  letter-spacing: 0.1px  — supporting text */
--text-base: 15px;  /* line-height: 1.65; letter-spacing: 0       — body text */
--text-md:   17px;  /* line-height: 1.5;  letter-spacing: -0.1px  — card headings, emphasis */
--text-lg:   20px;  /* line-height: 1.4;  letter-spacing: -0.2px  — section headings */
--text-xl:   24px;  /* line-height: 1.35; letter-spacing: -0.3px  — screen headings */
--text-2xl:  32px;  /* line-height: 1.2;  letter-spacing: -0.5px  — hero headings */
--text-3xl:  40px;  /* line-height: 1.1;  letter-spacing: -0.8px  — display, rare */
```

Body text at 15px (not 16px) deliberately: marginally denser, feels like a tool rather than a web article.

### 3.3 Weights

```
400 Regular   → Body text, paragraph content, input values
500 Medium    → UI labels, navigation items, secondary headings
600 SemiBold  → Button text, primary headings, strong emphasis
700 Bold      → Display moments only (session complete, hero, mode name on hub)
```

**Rules:**
- Never use Regular for buttons — minimum Medium
- Never Bold for body text — reserve it for display
- Avoid italic except for genuine quotation or citation in content

### 3.4 Prose reading context

In reading-heavy screens (Slow Mode reader, RSVP explanation text, block content):

```css
/* Applied to the content container, not globally */
font-size: var(--text-base);    /* 15px */
line-height: 1.75;              /* More generous in reading contexts */
max-width: 68ch;                /* Column width — optimal readability */
color: var(--text-primary);
```

The 68ch max-width applies to reading contexts only. Hub screens, dashboards, and mode-selection panels use full-width layouts with their own internal structure.

---

## 4. Spacing & Layout

### 4.1 Scale

Base unit: **4px**. All spacing values are multiples.

```
4px   — xs  — icon-to-label gap, tight list item padding
8px   — sm  — small internal padding, badge padding
12px  — md  — standard internal element padding
16px  — lg  — default card padding, section gap
20px  — xl  — generous element spacing
24px  — 2xl — section padding, between content groups
32px  — 3xl — between major sections
48px  — 4xl — screen-level vertical rhythm
64px  — 5xl — rare — top-of-screen breathing room on hub
```

**Decision heuristic:** If two elements are conceptually related, use ≤16px between them. If they are distinct sections, use ≥24px. Never more than 48px between any two elements unless it's the top/bottom margin of an entire screen section.

### 4.2 Above-the-fold principle

The primary action and all essential context for any given screen must be visible without scrolling on a 1080p display (1920×1080). Scroll is acceptable for content (reading text, long lists of blocks), not for navigation or primary actions.

**Corollary:** Never use excessive vertical padding to "give screens room to breathe." Room to breathe is for design portfolios. Pith is a tool. The student should be able to immediately see what to do next.

**Large touch targets, not large spacing.** Big buttons (min 40px height) are good. 64px of empty space above a button is waste. Use the space for something or remove it.

### 4.3 Desktop grid

```
Platform minimum:  1024px
Primary target:    1280–1440px
Wide screen:       1920px (cap content at 1200px max-width centered)
Sidebar width:     240–280px when open
Main content:      flex: 1, min-width: 0
Page padding:      24px horizontal
```

---

## 5. Surfaces & Elevation

### 5.1 Layer model

Three meaningful layers. No more.

```
Layer 0 — Base      (#111318)  — The page itself
Layer 1 — Surface   (#181c24)  — Cards, side panels, section backgrounds
Layer 2 — Elevated  (#1e2330)  — Modals, drawers, floating toolbars, dropdowns
```

Each layer is approximately 4-5 lightness points brighter than the one below. The difference is visible but not jarring — it communicates structure, not drama.

**Shadow policy: none.** Elevation is communicated by lightness delta alone. Box shadows are not used anywhere. They add visual noise, conflict with the flat aesthetic, and look AI-generated when applied liberally.

### 5.2 Border treatment

The 1px border is the primary separation tool.

```css
/* Between base and surface (e.g. card on page background) */
border: 1px solid var(--border-subtle);

/* Interactive elements at rest */
border: 1px solid var(--border-default);

/* Focused or hovered interactive elements */
border: 1px solid var(--border-focus);

/* Active/selected item */
border: 1px solid var(--accent);
background: var(--accent-muted);
```

No glow effects. No `box-shadow: 0 0 0 3px rgba(accent, 0.3)` focus rings — replace with `outline: 2px solid var(--accent); outline-offset: 2px` for keyboard focus.

### 5.3 Border Radius

```css
--radius-sm:   3px;    /* Buttons, inputs, small chips */
--radius-md:   4px;    /* Cards, panels, dropdowns */
--radius-lg:   6px;    /* Modals, large floating elements */
--radius-pill: 100px;  /* Tags, badges, toggle pills */
```

The maximum on any structural element is 6px. Border-radius is not a personality tool in Pith — it is purely functional. Rounded-everything (16px+) is explicitly out.

---

## 6. Components

### 6.1 Buttons

Four types. Each has a clear role. Never mix roles.

**Primary — filled accent**
Used for: the one action that matters on a screen. One per screen maximum.
```
Background:    var(--accent)
Text:          var(--text-inverse)
Font:          DM Sans SemiBold 14px
Height:        40px (default), 48px (large, hero CTA)
Padding:       0 18px
Border-radius: var(--radius-sm) — 3px
Hover:         var(--accent-hover)
Active:        var(--accent-active)
No border, no shadow.
```

**Secondary — ghost / outline**
Used for: alternative actions, cancel, back, secondary paths.
```
Background:    transparent
Border:        1px solid var(--border-default)
Text:          var(--text-primary)
Hover:         background var(--bg-surface), border var(--border-focus)
Same size as Primary.
```

**Danger — filled error**
Used for: destructive actions (delete, clear session). Always has a confirmation step.
```
Background:    var(--error)
Text:          #ffffff
Otherwise identical to Primary.
```

**Text — no chrome**
Used for: inline actions, "learn more", tertiary navigation.
```
Background:    transparent
Border:        none
Text:          var(--text-secondary)
Hover:         var(--text-primary)
Height:        auto — no fixed height
Underline:     none by default, underline on hover acceptable
```

**Disabled state (all types):**
```
opacity: 0.38
cursor: not-allowed
pointer-events: none
No hover states triggered
```

### 6.2 Inputs & Form Elements

```
Background:    var(--bg-base)      /* Sunken into the page — not a card */
Border:        1px solid var(--border-default)
Border-radius: var(--radius-sm) — 3px
Height:        40px
Padding:       0 12px
Font:          DM Sans Regular 15px, var(--text-primary)
Placeholder:   var(--text-tertiary)

Focus:
  border-color: var(--accent)
  /* No glow ring. Border change is the signal. */

Error:
  border-color: var(--error)

Label: DM Sans Medium 13px, var(--text-secondary), 6px above input
Helper text: DM Sans Regular 12px, var(--text-tertiary), 4px below input
Error text:  DM Sans Regular 12px, var(--error), 4px below input — with error icon
```

### 6.3 Cards

Cards are surfaces, not decorative elements.

```
Background:    var(--bg-surface)
Border:        1px solid var(--border-subtle)
Border-radius: var(--radius-md) — 4px
Padding:       16px default / 24px content-heavy
No shadow.

Interactive card (clickable):
  cursor: pointer
  Hover: border-color var(--border-default), background lightness +2%
  Active: background lightness +4%

Selected card:
  border-color: var(--accent)
  background: var(--accent-subtle)
```

### 6.4 Badges & Tags

Used for: mode labels, concept maturity levels, content type, status.

```
Height:        22px
Padding:       0 8px
Border-radius: var(--radius-pill) — full pill
Font:          DM Sans Medium 11px, letter-spacing 0.3px
Text:          uppercase for category labels, sentence case for status

Variants:
  Default:   background var(--bg-elevated), text var(--text-secondary)
  Accent:    background var(--accent-muted), text var(--accent)
  Success:   background var(--success-muted), text var(--success)
  Error:     background var(--error-muted), text var(--error)
  Warning:   background var(--warning-muted), text var(--warning)
```

### 6.5 Progress Indicators

**Fractional count (default):**
```
Format: "Block 3 of 8" or "3 / 8"
Font:   DM Sans Medium 13px, var(--text-tertiary)
Position: top-right corner of the study chrome, not centered/dominant
```

**Mode phase stepper:**
For multi-step flows (upload → configure → study), use a horizontal step indicator:
```
A series of 3–5 dashes or dots showing phase sequence.
Active:    var(--accent), filled
Complete:  var(--text-secondary), filled
Upcoming:  var(--border-default), empty
No percentage numbers on the stepper.
```

**Linear progress bar:**
Used **only** for long-running async operations (LLM generation, file processing).
```
Height:        2px
Background:    var(--border-subtle)
Fill:          var(--accent)
Border-radius: 1px
Placement:     top of the content area or inline below a status message
NEVER:         inside a button, never as decorative chrome around a card
```

**Session summary (end of session — always shown):**
After completing any study session, show a clean stats panel:
- Time elapsed
- Blocks / items covered  
- Questions answered
- Correct rate

No animations on these numbers except a simple fade-in. No confetti, no celebration by default.

---

## 7. Motion & Animation

### 7.1 Principles

Animation must justify its presence. The question is not "does this look cool?" but "does this make the transition clearer?" If the answer is no, it doesn't animate.

No animation competes with reading or learning. In study screens (RSVP, Slow reader, questions), reduce or eliminate transition animation on content changes — new content appears, it doesn't perform.

### 7.2 Duration & Easing

```css
/* Micro — hover, focus, state change */
--duration-micro:  100ms;
--ease-micro:      ease-out;

/* Transition — modal open, panel slide, page change */
--duration-short:  160ms;
--ease-enter:      cubic-bezier(0.16, 1, 0.3, 1);   /* Quick out, smooth settle */
--ease-exit:       ease-in;

/* Reveal — content appearing, section expansion */
--duration-reveal: 220ms;
--ease-reveal:     cubic-bezier(0.0, 0.0, 0.2, 1);
```

### 7.3 Standard Patterns

**Content entering:**
```css
/* Element appears from slightly below */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
animation: fadeInUp var(--duration-reveal) var(--ease-reveal);
```

**Modal / overlay appearing:**
```css
/* Backdrop: fade from 0 to var(--bg-overlay) */
/* Content: fade + translateY(-8px) → 0 (from slightly above, more "floating" feel) */
```

**Page / screen transition:**
```css
/* Outgoing: fade to 0 in 100ms */
/* Incoming: fade from 0 in 160ms, slight translateX(8px) → 0 if forward navigation */
```

**Hover on interactive elements (buttons, cards, nav items):**
```css
transition: background-color var(--duration-micro) var(--ease-micro),
            border-color     var(--duration-micro) var(--ease-micro),
            color            var(--duration-micro) var(--ease-micro);
/* No transform on hover — Pith doesn't "pop" buttons on hover */
```

### 7.4 What does NOT animate

- Layout dimension changes (no width/height transitions — causes reflow jank)
- Content inside RSVP reading view (new word/chunk appears immediately)
- Question choices appearing (immediate — loading animations before an MCQ option is distracting)
- Any operation behind a full loading state (the spinner is already communicating)

### 7.5 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Icons

### 8.1 Library

**Lucide** — the only icon library used in Pith. No mixing with Heroicons, Bootstrap Icons, Material Icons, Phosphor, Font Awesome, or custom SVGs from different visual languages.

Lucide filled variant where available for primary actions; Lucide standard (stroke) for secondary UI.

### 8.2 Sizes

```
16px — Inline with text, tight UI (badges, table cells, input adornments)
20px — Standard standalone icon (nav items, buttons with icon, list item actions)
24px — Large interactive (primary action icons, empty state icons)
32px — Illustrative (feature icons in hub cards, mode selection)
```

### 8.3 Color Usage

```
Decorative / structural:  var(--text-tertiary)
Supporting / secondary:   var(--text-secondary)
Interactive (default):    var(--text-secondary)
Interactive (hover):      var(--text-primary)
Active / selected:        var(--accent)
State indicators:         var(--success) / var(--error) / var(--warning)
```

Icons do not inherit color from their parent text by default — color is explicit.

### 8.4 Icon + Label Pairing

When an icon accompanies a label, gap is 6px. Icon and label share the same color. Never show an icon without a label (or tooltip) in interactive contexts — icon-only buttons must have `aria-label` and a visible tooltip on hover.

---

## 9. Focus Mode & Gamification

### 9.1 Focus Mode (default)

Focus Mode is **on by default** for all study sessions. This is not a setting the user toggles per session — it is the baseline state of the application.

In Focus Mode:
- Zero gamification elements are shown during a session
- No streak counter, no XP bar, no level indicator, no coin display
- No celebratory micro-animations during session (correct answers animate only with a color change, not with particles or sounds)
- Progress shown only as fractional count ("3 / 8")
- No animated mascot or illustrated tutor persona
- At session end: a clean stats summary is always shown — time, coverage, accuracy. It is the *only* feedback moment.

### 9.2 Celebration Mode (opt-in)

Users who want motivational elements can enable Celebration Mode in settings. When active:
- End-of-session confetti on good performance (>80% correct)
- Emoji may appear in session completion messages
- Streak counter visible in the sidebar
- Animated progress fill on the summary card

Celebration Mode elements are **never shown to users who have not opted in**. This is a design constraint, not a nice-to-have. It determines how we build these features — they must be off by default at the code level.

### 9.3 End-of-Session Summary (always shown, both modes)

```
Layout: centered card, --bg-surface, no shadow
Title: "Session complete" — DM Sans SemiBold 20px
Stats grid (2×2):
  - Time studied
  - Blocks covered
  - Questions answered
  - Correct rate (% with color: --success if >70%, --warning if 50–70%, --error if <50%)
CTA: primary button "Back to hub" / "Continue to [next mode]"
```

---

## 10. Background Texture

A very subtle SVG noise texture on --bg-base in dark mode. Purpose: prevents the pure-flat-dark aesthetic from reading as "default dark theme" and adds just enough texture to feel considered.

```css
/* Applied to body or #app in dark mode only */
background-image: url("data:image/svg+xml,..."); /* SVG feTurbulence noise filter */
background-repeat: repeat;
opacity: 0.03; /* Very subtle — if you can clearly see it, reduce it */
mix-blend-mode: overlay;
pointer-events: none;
```

**Rules:**
- Maximum noise opacity: 0.04. If it's visible at arm's length from the monitor, it's too much.
- Dark mode only. Light mode uses the warm cream — no texture.
- Applied only to base background, not to surfaces, cards, or any interactive element.
- Not animated, not gradient-masked, not colored.

---

## 11. Gradients

Gradients are high-risk. They are the most common AI slop signal. The rule is simple:

**Permitted:**
- One subtle radial ambient glow on the home screen / mode hub background only:
  ```css
  background: radial-gradient(ellipse 70% 50% at 50% -5%,
    rgba(24, 196, 170, 0.06) 0%,
    transparent 70%
  );
  ```
- A gradient overlay on session-complete celebration screens (Celebration Mode only)

**Forbidden:**
- Gradients on buttons — ever
- Gradient borders or "glowing" borders
- Gradient text on anything other than an optional hero display title (and only if it serves the content, not decoration)
- Linear gradient stripes as decorative dividers or backgrounds
- Glassmorphism `backdrop-filter: blur` on any element the user interacts with
- Multiple gradients layered on the same screen

If you find yourself adding a gradient to make a screen "feel more alive," the problem is probably something else — likely hierarchy, contrast, or missing an accent element. Fix the root cause.

---

## 12. Copywriting Principles

UI copy is design material. It is subject to the same discipline as color or spacing.

### 12.1 Case and punctuation

- **Sentence case everywhere.** "Start studying" not "Start Studying." Exception: proper nouns, mode names used as labels (RSVP, Slow Mode, Cloze).
- No period at end of button labels or headings.
- Periods in body copy, descriptions, helper text, and error messages.
- No exclamation marks in UI strings. The app does not shout.

### 12.2 Actions

- Active voice. "Save block" not "Block saved" for a button.
- Name what happens, not what it is: "Start session" not "Session start."
- Consistent naming throughout a flow: the button says "Generate blocks" → the loading state says "Generating blocks..." → the success state says "Blocks ready."
- Never "Submit" — always name the specific action.

### 12.3 Empty states

Empty states are invitations, not apologies.

```
Bad:  "No documents found."
Good: "No documents yet — upload one to start studying."
      [Upload document →]

Bad:  "You haven't studied anything today."
Good: "Pick up where you left off."
      [Continue last session →]
```

### 12.4 Error messages

Name what happened and what to do.

```
Bad:  "An error occurred."
Bad:  "Something went wrong. Please try again."
Good: "Couldn't reach the API — check your API key in settings."
Good: "File is too large (max 20 MB). Try compressing your PDF first."
```

### 12.5 Loading states

Show progress text, not just a spinner.

```
Bad:  [spinner]
Good: "Generating questions for Block 3..."
Good: "Analyzing document structure..."
Good: "This usually takes 15–30 seconds."
```

### 12.6 Forbidden copy patterns

- "Start your learning journey" — never
- "Let's go!" / "You've got this!" — never (Celebration Mode may be an exception, sparingly)
- Emoji in UI strings — only in Celebration Mode opt-in states
- "Click here" — always name the action or element: "Upload your document"
- Passive "X was done" construction on buttons
- Filler meta-instructions: "To get started, first..."

---

## 13. Anti-patterns — What Pith Is Not

These are active design constraints. If a PR or design decision produces any of these, it should be revised.

| Anti-pattern | Why it fails | The Pith alternative |
|---|---|---|
| `box-shadow: 0 4px 20px rgba(0,0,0,0.4)` everywhere | Reads as default Tailwind dark UI — no personality | 1px border + lightness delta for elevation |
| `border-radius: 12px` on cards and buttons | Soft-tech / consumer app aesthetic | 3–4px — technical, intentional |
| Generic SVG illustrations of people studying at desks | AI-generated content vibe, adds nothing functional | Empty states with clear text + action |
| Emoji in default UI (`🚀 Start studying 🎉`) | Undermines the serious/tool positioning | Plain verb labels; emoji only in opt-in Celebration Mode |
| Loading spinners on every micro-interaction | Fragmented, anxious feel | Optimistic UI where possible; text + bar for real waits |
| Multiple icon libraries mixed together | Visual incoherence — sizes, weights, styles clash | Lucide only |
| Streaks / XP bars / coin counters visible by default | Gamification drip pattern — patronizing to serious students | All gamification opt-in; session stats at end are sufficient |
| Nested modals (modal inside modal) | Navigation crisis — user loses context | Drawers / expanded panels for secondary flows; never stack modals |
| `background: linear-gradient(135deg, #accent 0%, #accent2 100%)` on buttons | AI slop pattern #1 — overdone everywhere | Flat accent fill — the color is strong enough |
| 64px+ padding sections with no content | "Airy" design that doesn't fit on screen | Above-the-fold first; cut whitespace before cutting content |
| Four different font families on one screen | Incoherence | DM Sans only — differentiate via weight and size |
| Status communicated by color alone | Accessibility failure | Color + icon + text label always |

---

## 14. Brand Mark

### 14.1 Direction

Geometric minimal symbol + wordmark "Pith" in DM Sans SemiBold. The symbol should abstractly evoke *essence*, *core*, or *distillation* — the etymological meaning of the word. Ideas to explore: a condensed inner point within a circle, an abstracted cross-section, a diamond, a refined leaf form.

### 14.2 Rules

- Symbol color: `var(--accent)` (#18c4aa) in all modes
- Wordmark: DM Sans SemiBold, --text-primary in dark mode, #1a1c24 in light mode
- No gradient in the logomark — ever
- Minimum size: 16px symbol height (for favicon / small usage)
- Clear space: minimum equal to the symbol height on all sides

### 14.3 Status

Pedro has an existing preliminary mark. Once reviewed, specific proportions, SVG paths, and usage variations will be documented here.

---

## Appendix A: CSS Custom Properties Reference

Full token set to be placed in `:root` and `[data-theme="light"]`:

```css
:root {
  /* === Backgrounds === */
  --bg-base:     #111318;
  --bg-surface:  #181c24;
  --bg-elevated: #1e2330;
  --bg-overlay:  rgba(0, 0, 0, 0.65);

  /* === Borders === */
  --border-subtle:  rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-focus:   rgba(255, 255, 255, 0.22);

  /* === Text === */
  --text-primary:   #e4e7f0;
  --text-secondary: #8892a4;
  --text-tertiary:  #545e72;
  --text-inverse:   #111318;

  /* === Accent (Teal) === */
  --accent:        #18c4aa;
  --accent-hover:  #15b09a;
  --accent-active: #12987f;
  --accent-muted:  rgba(24, 196, 170, 0.12);
  --accent-subtle: rgba(24, 196, 170, 0.06);

  /* === Semantic === */
  --success:       #1dc990;
  --success-muted: rgba(29, 201, 144, 0.12);
  --error:         #f0584a;
  --error-muted:   rgba(240, 88, 74, 0.12);
  --warning:       #e8a030;
  --warning-muted: rgba(232, 160, 48, 0.12);

  /* === Typography === */
  --font-sans: 'DM Sans', system-ui, -apple-system, sans-serif;

  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 15px;
  --text-md:   17px;
  --text-lg:   20px;
  --text-xl:   24px;
  --text-2xl:  32px;
  --text-3xl:  40px;

  /* === Spacing === */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  /* === Border Radius === */
  --radius-sm:   3px;
  --radius-md:   4px;
  --radius-lg:   6px;
  --radius-pill: 100px;

  /* === Motion === */
  --duration-micro:  100ms;
  --duration-short:  160ms;
  --duration-reveal: 220ms;
  --ease-micro:      ease-out;
  --ease-enter:      cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit:       ease-in;
  --ease-reveal:     cubic-bezier(0.0, 0.0, 0.2, 1);
}

[data-theme="light"] {
  --bg-base:     #faf8f5;
  --bg-surface:  #ffffff;
  --bg-elevated: #f0ede8;
  --bg-overlay:  rgba(0, 0, 0, 0.40);

  --border-subtle:  rgba(0, 0, 0, 0.06);
  --border-default: rgba(0, 0, 0, 0.12);
  --border-focus:   rgba(0, 0, 0, 0.28);

  --text-primary:   #1a1c24;
  --text-secondary: #5a6070;
  --text-tertiary:  #909aab;
  --text-inverse:   #1a1c24;

  /* Accent and semantic colors are unchanged in light mode */
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

*DESIGN.md — Pith, v1.0. Compiled June 2026. Update when color system, typeface, or component patterns change. Keep in sync with application-overview.md when new modes introduce new component types.*
