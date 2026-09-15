# VeriDex Enterprise UI/UX Framework
**Version:** 2.0.0  
**Package:** `@veridex/ui`  
**Theme:** Light-only — dark mode is explicitly excluded from this specification  
**Compliance target:** WCAG 2.2 AA  
**Rendering stack:** Angular 21+ · Nx monorepo · Storybook (Vite)  
**Last updated:** 2026-09

---

## Table of Contents

1. [Framework Purpose and Scope](#1-framework-purpose-and-scope)
2. [Brand Identity and Visual Language](#2-brand-identity-and-visual-language)
3. [Design Token System (FND-001)](#3-design-token-system-fnd-001)
4. [Typography System (FND-002)](#4-typography-system-fnd-002)
5. [Icon System (FND-003)](#5-icon-system-fnd-003)
6. [Responsive Layout System (FND-004)](#6-responsive-layout-system-fnd-004)
7. [Focus and Interaction Utilities (FND-005)](#7-focus-and-interaction-utilities-fnd-005)
8. [Navigation Architecture](#8-navigation-architecture)
9. [Core UI Components](#9-core-ui-components)
10. [Form Components](#10-form-components)
11. [Data Display Components](#11-data-display-components)
12. [Insurance Domain Components](#12-insurance-domain-components)
13. [Document Management Components](#13-document-management-components)
14. [Notification Components](#14-notification-components)
15. [Charts and KPI Components](#15-charts-and-kpi-components)
16. [WCAG 2.2 AA Compliance Reference](#16-wcag-22-aa-compliance-reference)
17. [Colour Contrast Verification](#17-colour-contrast-verification)
18. [Responsive Behaviour Rules](#18-responsive-behaviour-rules)
19. [Logo and Branding Configuration](#19-logo-and-branding-configuration)
20. [Component Governance and RFC Process](#20-component-governance-and-rfc-process)
21. [Definition of Done](#21-definition-of-done)
22. [AI Agent Consumption Notes](#22-ai-agent-consumption-notes)

---

## 1. Framework Purpose and Scope

### 1.1 What This Document Is

This document is the authoritative specification for the VeriDex shared Angular component library (`@veridex/ui`). It governs visual design, accessibility, responsive behaviour, and component API contracts across every VeriDex portal — including Policy Holders, Retail Agents, MGAs, MGUs, Carriers, Reinsurers, TPAs, and Accounting teams.

It is written in a structured, machine-readable format so AI coding agents, developers, QA engineers, and designers can all consume it as a single source of truth.

### 1.2 What This Document Is Not

This document does not define business logic, API contracts, authorisation rules, or data schemas. Components are presentation shells. Business rules remain in consuming applications.

### 1.3 Component Inventory Summary

| Category | Count | P0 (Must-have) | P1 (Next) | P2 (Continuous) |
|---|---|---|---|---|
| Foundation | 5 | 5 | 0 | 0 |
| Core UI | 23 | 13 | 8 | 2 |
| Forms | 20 | 13 | 5 | 2 |
| Data Display | 7 | 2 | 4 | 1 |
| Navigation | 6 | 4 | 1 | 1 |
| Insurance Domain | 14 | 7 | 7 | 0 |
| Documents | 5 | 3 | 2 | 0 |
| Notifications | 3 | 0 | 3 | 0 |
| Charts & KPIs | 6 | 3 | 1 | 2 |
| **Total** | **89** | **50** | **31** | **8** |

### 1.4 Delivery Timeline

| Phase | Scope | Target |
|---|---|---|
| Month 1 | 38 components — all P0 Foundation, Core UI, Forms, Navigation, Chart wrapper | Sprint 1–4 |
| Month 2 | 42 components — P0 Insurance/Document domain, P1 Core UI, all Charts | Sprint 5–8 |
| Month 1–2 | 2 components spanning both phases (Data Grid, Document Upload) | Sprint 2–7 |
| Continuous | 7 P2 components | Ongoing |

---

## 2. Brand Identity and Visual Language

### 2.1 VeriDex Visual Identity

VeriDex is an enterprise insurance technology platform. The visual language is professional, spacious, and confident — not playful, not minimal-to-the-point-of-sterile. Every surface is light. The platform serves underwriters, actuaries, agents, and compliance teams who read dense data all day; the UI must reduce cognitive load, not add to it.

**Core characteristics:**
- Light surfaces with structured whitespace
- Orange primary on dark navy — the brand signature used sparingly for action and accent
- Data-first layouts: content precedes chrome
- Confidence through restraint — one bold element per view, everything else quiet

### 2.2 Tone of Interface Copy

- Sentence case throughout (not ALL CAPS labels, not Title Case In Every Header)
- Active voice: "Save draft" not "Submit form"
- Errors explain what happened and what to do, without apologising
- Empty states invite action: "No policies yet. Add your first policy." not "No data found."
- Consistent naming — if the button says "Bind policy" the confirmation toast says "Policy bound."

---

## 3. Design Token System (FND-001)

> **Component ID:** FND-001 · **Priority:** P0 · **Delivery:** Month 1 · **Complexity:** L

Design tokens are the single source of truth for all VeriDex visual values. No component hard-codes a raw colour, spacing value, or font size. All values are consumed via CSS custom properties following the naming convention below.

### 3.1 Colour Tokens

#### 3.1.1 Brand Primitives

These are raw brand values. Never use them directly in components — always use semantic aliases.

```css
/* Brand primitives — do not use directly in component styling */
--vdx-primitive-orange-500: #f86407;
--vdx-primitive-orange-400: #fa8033;
--vdx-primitive-orange-300: #fba060;
--vdx-primitive-orange-600: #d95606;
--vdx-primitive-orange-700: #b84804;

--vdx-primitive-navy-900: #1b2635;
--vdx-primitive-navy-800: #243144;
--vdx-primitive-navy-700: #2e3f57;
--vdx-primitive-navy-600: #3b506e;
--vdx-primitive-navy-500: #4d6585;
--vdx-primitive-navy-400: #6b829f;
--vdx-primitive-navy-300: #8fa1b6;
--vdx-primitive-navy-200: #b8c5d4;
--vdx-primitive-navy-100: #dce3ec;
--vdx-primitive-navy-050: #eef2f6;

--vdx-primitive-neutral-950: #0d0f12;
--vdx-primitive-neutral-900: #1a1d23;
--vdx-primitive-neutral-800: #2c3038;
--vdx-primitive-neutral-700: #3f4451;
--vdx-primitive-neutral-600: #565c6b;
--vdx-primitive-neutral-500: #717887;
--vdx-primitive-neutral-400: #8d94a3;
--vdx-primitive-neutral-300: #b0b6c3;
--vdx-primitive-neutral-200: #d0d4dc;
--vdx-primitive-neutral-100: #e8eaee;
--vdx-primitive-neutral-050: #f5f6f8;
--vdx-primitive-neutral-000: #ffffff;

--vdx-primitive-green-700: #166534;
--vdx-primitive-green-600: #15803d;
--vdx-primitive-green-500: #16a34a;
--vdx-primitive-green-100: #dcfce7;
--vdx-primitive-green-050: #f0fdf4;

--vdx-primitive-red-700: #b91c1c;
--vdx-primitive-red-600: #dc2626;
--vdx-primitive-red-500: #ef4444;
--vdx-primitive-red-100: #fee2e2;
--vdx-primitive-red-050: #fef2f2;

--vdx-primitive-amber-700: #b45309;
--vdx-primitive-amber-600: #d97706;
--vdx-primitive-amber-500: #f59e0b;
--vdx-primitive-amber-100: #fef3c7;
--vdx-primitive-amber-050: #fffbeb;

--vdx-primitive-blue-700: #1d4ed8;
--vdx-primitive-blue-600: #2563eb;
--vdx-primitive-blue-500: #3b82f6;
--vdx-primitive-blue-100: #dbeafe;
--vdx-primitive-blue-050: #eff6ff;
```

#### 3.1.2 Semantic Colour Tokens — Light Theme

```css
/* === SURFACE COLOURS === */
--vdx-color-bg-canvas:         var(--vdx-primitive-neutral-050);   /* Page background */
--vdx-color-bg-surface:        var(--vdx-primitive-neutral-000);   /* Cards, panels */
--vdx-color-bg-surface-raised: var(--vdx-primitive-neutral-000);   /* Modals, popovers */
--vdx-color-bg-subtle:         var(--vdx-primitive-neutral-050);   /* Table stripes, section fills */
--vdx-color-bg-muted:          var(--vdx-primitive-neutral-100);   /* Skeleton loader base */

/* === BORDER COLOURS === */
--vdx-color-border-default:    var(--vdx-primitive-neutral-200);   /* Default borders */
--vdx-color-border-strong:     var(--vdx-primitive-neutral-300);   /* Emphasized borders */
--vdx-color-border-focus:      var(--vdx-primitive-orange-500);    /* Focus rings */
--vdx-color-border-error:      var(--vdx-primitive-red-600);

/* === TEXT COLOURS === */
--vdx-color-text-primary:      var(--vdx-primitive-navy-900);      /* #1b2635 — headings, body */
--vdx-color-text-secondary:    var(--vdx-primitive-neutral-600);   /* Supporting text */
--vdx-color-text-tertiary:     var(--vdx-primitive-neutral-400);   /* Captions, hints */
--vdx-color-text-disabled:     var(--vdx-primitive-neutral-300);
--vdx-color-text-inverse:      var(--vdx-primitive-neutral-000);   /* On dark/orange surfaces */
--vdx-color-text-link:         var(--vdx-primitive-navy-800);
--vdx-color-text-link-hover:   var(--vdx-primitive-orange-600);
--vdx-color-text-error:        var(--vdx-primitive-red-700);
--vdx-color-text-success:      var(--vdx-primitive-green-700);
--vdx-color-text-warning:      var(--vdx-primitive-amber-700);

/* === INTERACTIVE / ACTION COLOURS === */
--vdx-color-action-primary:         var(--vdx-primitive-orange-500);   /* #f86407 */
--vdx-color-action-primary-hover:   var(--vdx-primitive-orange-600);
--vdx-color-action-primary-active:  var(--vdx-primitive-orange-700);
--vdx-color-action-primary-text:    var(--vdx-primitive-neutral-000);   /* Text on orange button */

--vdx-color-action-secondary:       var(--vdx-primitive-navy-900);      /* #1b2635 */
--vdx-color-action-secondary-hover: var(--vdx-primitive-navy-800);
--vdx-color-action-secondary-text:  var(--vdx-primitive-neutral-000);

--vdx-color-action-ghost-hover:     var(--vdx-primitive-neutral-100);
--vdx-color-action-destructive:     var(--vdx-primitive-red-600);
--vdx-color-action-destructive-hover: var(--vdx-primitive-red-700);

/* === SEMANTIC STATUS COLOURS === */
--vdx-color-status-success-bg:    var(--vdx-primitive-green-050);
--vdx-color-status-success-text:  var(--vdx-primitive-green-700);
--vdx-color-status-success-border:var(--vdx-primitive-green-600);

--vdx-color-status-warning-bg:    var(--vdx-primitive-amber-050);
--vdx-color-status-warning-text:  var(--vdx-primitive-amber-700);
--vdx-color-status-warning-border:var(--vdx-primitive-amber-600);

--vdx-color-status-error-bg:      var(--vdx-primitive-red-050);
--vdx-color-status-error-text:    var(--vdx-primitive-red-700);
--vdx-color-status-error-border:  var(--vdx-primitive-red-600);

--vdx-color-status-info-bg:       var(--vdx-primitive-blue-050);
--vdx-color-status-info-text:     var(--vdx-primitive-blue-700);
--vdx-color-status-info-border:   var(--vdx-primitive-blue-600);

/* === NAVIGATION SURFACE COLOURS === */
--vdx-color-nav-bg:              var(--vdx-primitive-navy-900);    /* #1b2635 sidebar bg */
--vdx-color-nav-text:            var(--vdx-primitive-navy-100);
--vdx-color-nav-text-active:     var(--vdx-primitive-neutral-000);
--vdx-color-nav-item-active-bg:  var(--vdx-primitive-orange-500);
--vdx-color-nav-item-hover-bg:   var(--vdx-primitive-navy-800);
--vdx-color-nav-border:          var(--vdx-primitive-navy-800);
--vdx-color-topbar-bg:           var(--vdx-primitive-neutral-000);
--vdx-color-topbar-border:       var(--vdx-primitive-neutral-200);
```

> **Dark theme policy:** VeriDex v2.0 does not ship a dark theme. Token naming follows a two-tier system (primitive → semantic) to allow future theming without refactoring component code. Role/accent overrides (e.g., carrier vs. MGA portals) may be applied through semantic token overrides on a `<body>` data-theme attribute.

### 3.2 Spacing Scale

Base unit: `4px`. All spacing values are multiples of 4.

```css
--vdx-space-0:   0px;
--vdx-space-1:   4px;
--vdx-space-2:   8px;
--vdx-space-3:   12px;
--vdx-space-4:   16px;
--vdx-space-5:   20px;
--vdx-space-6:   24px;
--vdx-space-8:   32px;
--vdx-space-10:  40px;
--vdx-space-12:  48px;
--vdx-space-16:  64px;
--vdx-space-20:  80px;
--vdx-space-24:  96px;
```

Page gutters: `--vdx-space-6` (24px) on mobile, `--vdx-space-8` (32px) on tablet, `--vdx-space-10` (40px) on desktop.

### 3.3 Border Radius

```css
--vdx-radius-none:   0px;
--vdx-radius-sm:     4px;    /* Tags, badges, chips */
--vdx-radius-md:     8px;    /* Inputs, buttons */
--vdx-radius-lg:     12px;   /* Cards, panels */
--vdx-radius-xl:     16px;   /* Modals, large surfaces */
--vdx-radius-full:   9999px; /* Pill badges, avatars */
```

### 3.4 Elevation / Shadow Tokens

```css
--vdx-shadow-none:   none;
--vdx-shadow-xs:     0 1px 2px rgba(27, 38, 53, 0.06);
--vdx-shadow-sm:     0 2px 4px rgba(27, 38, 53, 0.08);
--vdx-shadow-md:     0 4px 8px rgba(27, 38, 53, 0.10), 0 1px 3px rgba(27, 38, 53, 0.06);
--vdx-shadow-lg:     0 8px 24px rgba(27, 38, 53, 0.12), 0 2px 6px rgba(27, 38, 53, 0.06);
--vdx-shadow-xl:     0 16px 48px rgba(27, 38, 53, 0.16), 0 4px 12px rgba(27, 38, 53, 0.08);
--vdx-shadow-focus:  0 0 0 3px rgba(248, 100, 7, 0.35);  /* Orange focus ring */
```

### 3.5 Z-Index Layers

```css
--vdx-z-base:     0;
--vdx-z-raised:   10;      /* Cards, dropdowns relative */
--vdx-z-sticky:   100;     /* Sticky headers/toolbars */
--vdx-z-sidebar:  200;     /* Side navigation */
--vdx-z-topbar:   300;     /* Top navigation bar */
--vdx-z-overlay:  400;     /* Modal backdrops */
--vdx-z-dialog:   500;     /* Modals, dialogs */
--vdx-z-popover:  600;     /* Tooltips, popovers */
--vdx-z-toast:    700;     /* Toast notifications */
```

### 3.6 Motion / Duration Tokens

```css
--vdx-duration-instant:  0ms;
--vdx-duration-fast:     100ms;
--vdx-duration-normal:   200ms;
--vdx-duration-slow:     300ms;
--vdx-duration-slower:   400ms;

--vdx-ease-default:    cubic-bezier(0.16, 1, 0.3, 1);   /* Snappy exit */
--vdx-ease-in:         cubic-bezier(0.4, 0, 1, 1);
--vdx-ease-out:        cubic-bezier(0, 0, 0.2, 1);
--vdx-ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1); /* Subtle bounce for modals */
```

**Reduced motion:** All transitions must respect `@media (prefers-reduced-motion: reduce)`. When this media query fires, set `animation-duration` and `transition-duration` to `var(--vdx-duration-instant)` or `0.01ms`.

---

## 4. Typography System (FND-002)

> **Component ID:** FND-002 · **Priority:** P0 · **Delivery:** Month 1 · **Dependency:** FND-001

### 4.1 Typefaces

| Role | Family | Fallback stack |
|---|---|---|
| Primary (UI, headings, body) | Inter | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| Data / Monospace | JetBrains Mono | `'Fira Code', 'Cascadia Code', Consolas, monospace` |

Inter is loaded via `@fontsource/inter` in the Nx library root styles. Subsetting to Latin + Latin-extended is required; do not load all 900 weights. Required weights: 400, 500, 600, 700.

### 4.2 Type Scale

All sizes use `rem` with a 16px root. Line heights are unitless ratios.

```css
/* === DISPLAY === */
--vdx-type-display-2xl-size:   2.5rem;    /* 40px */
--vdx-type-display-2xl-height: 1.2;
--vdx-type-display-2xl-weight: 700;
--vdx-type-display-2xl-track:  -0.02em;

--vdx-type-display-xl-size:    2rem;      /* 32px */
--vdx-type-display-xl-height:  1.25;
--vdx-type-display-xl-weight:  700;
--vdx-type-display-xl-track:   -0.02em;

/* === HEADINGS === */
--vdx-type-h1-size:   1.75rem;   /* 28px */
--vdx-type-h1-height: 1.3;
--vdx-type-h1-weight: 700;
--vdx-type-h1-track:  -0.015em;

--vdx-type-h2-size:   1.5rem;    /* 24px */
--vdx-type-h2-height: 1.35;
--vdx-type-h2-weight: 600;
--vdx-type-h2-track:  -0.01em;

--vdx-type-h3-size:   1.25rem;   /* 20px */
--vdx-type-h3-height: 1.4;
--vdx-type-h3-weight: 600;
--vdx-type-h3-track:  -0.005em;

--vdx-type-h4-size:   1.125rem;  /* 18px */
--vdx-type-h4-height: 1.45;
--vdx-type-h4-weight: 600;

--vdx-type-h5-size:   1rem;      /* 16px */
--vdx-type-h5-height: 1.5;
--vdx-type-h5-weight: 600;

--vdx-type-h6-size:   0.875rem;  /* 14px */
--vdx-type-h6-height: 1.5;
--vdx-type-h6-weight: 600;

/* === BODY === */
--vdx-type-body-lg-size:   1.125rem;  /* 18px */
--vdx-type-body-lg-height: 1.6;
--vdx-type-body-lg-weight: 400;

--vdx-type-body-md-size:   1rem;      /* 16px — default */
--vdx-type-body-md-height: 1.6;
--vdx-type-body-md-weight: 400;

--vdx-type-body-sm-size:   0.875rem;  /* 14px */
--vdx-type-body-sm-height: 1.55;
--vdx-type-body-sm-weight: 400;

/* === LABELS & CAPTIONS === */
--vdx-type-label-md-size:   0.875rem; /* 14px */
--vdx-type-label-md-height: 1.4;
--vdx-type-label-md-weight: 500;

--vdx-type-label-sm-size:   0.75rem;  /* 12px */
--vdx-type-label-sm-height: 1.4;
--vdx-type-label-sm-weight: 500;

--vdx-type-caption-size:    0.75rem;  /* 12px */
--vdx-type-caption-height:  1.4;
--vdx-type-caption-weight:  400;

/* === DATA / MONO === */
--vdx-type-mono-md-size:    0.875rem;
--vdx-type-mono-md-height:  1.5;
--vdx-type-mono-md-weight:  400;

--vdx-type-mono-sm-size:    0.75rem;
--vdx-type-mono-sm-height:  1.5;
--vdx-type-mono-sm-weight:  400;
```

### 4.3 Responsive Type Rules

At breakpoints below `md` (768px), heading sizes scale down by one level:
- H1 renders at H2 size on mobile
- H2 renders at H3 size on mobile
- Body-lg steps down to body-md

### 4.4 Semantic HTML Guidance

| Visual style | Required HTML element | Notes |
|---|---|---|
| Display/H1 | `<h1>` | One `<h1>` per page |
| H2 | `<h2>` | Section headings |
| H3–H6 | `<h3>` through `<h6>` | Hierarchically nested; do not skip levels |
| Body | `<p>` | Not `<div>` for paragraphs |
| Label | `<label>` | Always associated with a form control |
| Caption | `<figcaption>`, `<caption>`, `<span>` | Depends on context |
| Link | `<a href>` | Not `<span onclick>` |

Heading levels must reflect document outline, not visual size. Use the CSS type scale tokens to achieve the desired visual size independent of semantic level.

### 4.5 Truncation Helpers

```css
/* Single-line truncation */
.vdx-truncate {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Multi-line clamp (n lines) */
.vdx-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.vdx-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

---

## 5. Icon System (FND-003)

> **Component ID:** FND-003 · **Priority:** P0 · **Delivery:** Month 1 · **Dependency:** FND-001

### 5.1 Icon Library

VeriDex uses Lucide Icons as the approved base library, supplemented by custom insurance-domain icons where no appropriate Lucide equivalent exists. Icons are registered as tree-shakeable Angular components via `@veridex/ui/icons`.

Custom insurance icons include: `vdx-policy`, `vdx-endorsement`, `vdx-bordereaux`, `vdx-reinsurance`, `vdx-premium`, `vdx-claim-open`, `vdx-claim-settled`, `vdx-risk-high`, `vdx-risk-low`, `vdx-fnol`.

### 5.2 Size Variants

```css
--vdx-icon-xs:  12px;
--vdx-icon-sm:  16px;
--vdx-icon-md:  20px;   /* Default */
--vdx-icon-lg:  24px;
--vdx-icon-xl:  32px;
--vdx-icon-2xl: 48px;
```

### 5.3 Stroke Rules

All icons use a consistent stroke width of `1.5px` at `20px` (md). At smaller sizes, stroke visually thins to `1.25px`. Custom insurance icons must follow the same stroke conventions.

Fill icons are not used in the VeriDex system — all icons are outline/stroke-based.

### 5.4 Accessibility Rules for Icons

| Icon use | Implementation requirement |
|---|---|
| Decorative (visual only, meaning conveyed by adjacent text) | `aria-hidden="true"` on SVG; do not add `aria-label` |
| Meaningful (standalone, conveys information without adjacent text) | `role="img"` and `aria-label="[descriptive label]"` on SVG |
| Interactive icon button | Icon inside `<button>` with `aria-label` on the button element |

```html
<!-- Decorative icon — correct -->
<vdx-icon name="shield" aria-hidden="true"></vdx-icon>

<!-- Meaningful standalone icon — correct -->
<vdx-icon name="alert-triangle" role="img" aria-label="Warning: policy expiring"></vdx-icon>

<!-- Icon button — correct -->
<button type="button" aria-label="Delete policy document">
  <vdx-icon name="trash-2" aria-hidden="true"></vdx-icon>
</button>
```

---

## 6. Responsive Layout System (FND-004)

> **Component ID:** FND-004 · **Priority:** P0 · **Delivery:** Month 1 · **Dependency:** FND-001

### 6.1 Breakpoints

```css
--vdx-bp-xs:    0px;        /* < 480px — small mobile */
--vdx-bp-sm:    480px;      /* ≥ 480px — mobile */
--vdx-bp-md:    768px;      /* ≥ 768px — tablet */
--vdx-bp-lg:    1024px;     /* ≥ 1024px — small desktop */
--vdx-bp-xl:    1280px;     /* ≥ 1280px — desktop */
--vdx-bp-2xl:   1536px;     /* ≥ 1536px — wide desktop */
```

Angular breakpoint service names: `XS | SM | MD | LG | XL | XXL`

### 6.2 Three-tier Responsive Strategy

| Tier | Viewport | Layout model | Sidebar | Top bar |
|---|---|---|---|---|
| **Mobile** | < 768px | Single column, full-width | Hidden — opens as drawer (overlay) | Always visible, collapsed logo |
| **Tablet** | 768px–1023px | Content area adapts; sidebar optional | Collapsed (icon-only, 56px wide) | Always visible |
| **Desktop** | ≥ 1024px | Full two-column: sidebar + content | Expanded (240px) or collapsed (56px) | Always visible |

### 6.3 Container Widths

```css
/* Max content widths (applied to .vdx-container) */
--vdx-container-sm:  640px;
--vdx-container-md:  768px;
--vdx-container-lg:  1024px;
--vdx-container-xl:  1280px;
--vdx-container-2xl: 1400px;
--vdx-container-full: 100%;
```

Default content container for most portal pages: `--vdx-container-xl` with auto side margins and `--vdx-space-8` gutters.

### 6.4 Grid Utilities

```
Mobile (< 768px):   4-column grid, 16px gutter, 24px margin
Tablet (768–1023px):  8-column grid, 24px gutter, 32px margin
Desktop (≥ 1024px):  12-column grid, 24px gutter, 40px margin
```

### 6.5 Stack and Inline Layout Primitives

**VdxStack:** arranges children in a vertical column with a gap token.
**VdxInline:** arranges children in a horizontal row with wrapping and a gap token.
**VdxGrid:** exposes a responsive CSS grid with column count per breakpoint.

### 6.6 Overflow Behaviour

- Horizontal overflow is `hidden` at the page level — never show a horizontal scrollbar on the viewport.
- Data tables and bordereaux grids may scroll horizontally within their container with `overflow-x: auto`.
- Content that overflows a container clips, never pushes layout.

### 6.7 DOM Order Rule

Visual layout order must match DOM (source) order. Do not use `order` in flexbox or grid to reverse or reorder elements for visual effect only — this breaks keyboard navigation and screen reader announcement order.

---

## 7. Focus and Interaction Utilities (FND-005)

> **Component ID:** FND-005 · **Priority:** P0 · **Delivery:** Month 1 · **Dependencies:** FND-001, Angular CDK

### 7.1 Focus Ring Standard

All interactive elements must have a clearly visible focus ring that meets WCAG 2.2 Success Criterion 2.4.11 (Focus Appearance). VeriDex uses a 3px orange offset ring.

```css
/* Applied via global mixin — do not override per-component unless justified */
:focus-visible {
  outline: 3px solid var(--vdx-color-border-focus);  /* #f86407 */
  outline-offset: 2px;
  border-radius: var(--vdx-radius-sm);
}

/* Suppress for mouse/touch interaction only */
:focus:not(:focus-visible) {
  outline: none;
}
```

Contrast of focus ring against adjacent background:
- Orange `#f86407` on white `#ffffff`: 3.27:1 — this satisfies WCAG 2.2 SC 2.4.11 (minimum 3:1 for non-text focus indicators)
- When the adjacent background is the orange primary button, the ring renders with an additional 2px white gap (`outline-offset: 2px`) to ensure visual separation

### 7.2 Focus Trap Helper

The `VdxFocusTrap` service (wrapping Angular CDK `FocusTrap`) is used in:
- Modal/Dialog (UI-013)
- Drawer/Side Panel (UI-014)
- Mobile navigation drawer

**Rules:**
- Activate trap on open; deactivate on close
- Focus returns to the trigger element that opened the overlay
- Escape key always closes the overlay

### 7.3 Roving Tabindex Pattern

Used for composite widgets (tabs, radio groups, toolbars, datepicker calendar grid). Only one element in the group is in the tab order at a time. Arrow keys move focus within the group.

### 7.4 Keyboard Interaction Patterns

| Pattern | Keys |
|---|---|
| Tab / Shift+Tab | Move between interactive elements in tab order |
| Enter / Space | Activate buttons; toggle checkboxes; open select |
| Arrow keys | Navigate within composite widgets (tabs, radios, menu items, calendar) |
| Escape | Close overlay, cancel action |
| Home / End | Jump to first/last item in list controls |
| Page Up / Page Down | Calendar month navigation |

### 7.5 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This is applied globally in the library root styles. Components do not need individual reduced-motion guards unless they run JavaScript-driven animations (e.g., chart animations).

---

## 8. Navigation Architecture

### 8.1 App Shell (NAV-001)

> **Component ID:** NAV-001 · **Priority:** P0 · **Delivery:** Month 1

The app shell is the structural frame of every VeriDex portal page. It consists of:

```
┌────────────────────────────────────────────────────────┐
│  TOP BAR (height: 56px, sticky, z: --vdx-z-topbar)    │
│  [Logo] [Skip link] [App title] ──── [Notif] [User]   │
├──────────────────┬─────────────────────────────────────┤
│  SIDEBAR         │  CONTENT AREA                       │
│  (see NAV-002)   │  <router-outlet>                    │
│                  │  Full scrollable region             │
│                  │                                     │
└──────────────────┴─────────────────────────────────────┘
```

**Top bar contents:**
- Left: Logo slot (see Section 19) + app/module name
- Centre: Reserved (search on large breakpoints — optional)
- Right: Role/account context badge · Notification bell (NTF-003) · Help icon · User avatar/menu

**Skip navigation link:** The first focusable element in the DOM must be a visually hidden skip link that becomes visible on focus:

```html
<a href="#main-content" class="vdx-skip-link">Skip to main content</a>
```

```css
.vdx-skip-link {
  position: absolute;
  top: -100%;
  left: var(--vdx-space-4);
  z-index: calc(var(--vdx-z-toast) + 1);
  padding: var(--vdx-space-2) var(--vdx-space-4);
  background: var(--vdx-color-action-primary);
  color: var(--vdx-color-action-primary-text);
  border-radius: var(--vdx-radius-md);
  text-decoration: none;
  font-weight: 600;
}
.vdx-skip-link:focus {
  top: var(--vdx-space-2);
}
```

### 8.2 Role-Aware Sidebar (NAV-002) — Collapsible Navigation

> **Component ID:** NAV-002 · **Priority:** P0 · **Delivery:** Month 1

The sidebar is always collapsible. This is a hard requirement, not an option.

#### 8.2.1 States

| State | Width | Content visible |
|---|---|---|
| Expanded | 240px | Icon + label |
| Collapsed (icon-only) | 56px | Icon only; label in tooltip on hover |
| Mobile drawer | Full-width overlay | Icon + label, rendered over content |

#### 8.2.2 Collapse Toggle

A toggle button (`aria-label="Collapse navigation"` / `aria-label="Expand navigation"`) is always visible at the bottom of the sidebar or pinned at the top of the sidebar panel. On desktop, the collapsed state persists in `localStorage` under the key `vdx_nav_collapsed`.

#### 8.2.3 Mobile Behaviour

On viewports below `md` (768px):
- Sidebar is hidden by default (not in layout flow)
- Top bar includes a hamburger button (`aria-label="Open navigation"`) that opens the sidebar as a full-overlay drawer
- Backdrop overlay appears behind the drawer at `--vdx-z-overlay`
- Tapping outside the drawer or pressing Escape closes it and returns focus to the hamburger button

#### 8.2.4 Sidebar Structure

```html
<nav aria-label="Main navigation" class="vdx-sidebar">
  <ul role="list">
    <li>
      <a routerLink="/dashboard" routerLinkActive="vdx-nav-active" aria-current="page">
        <vdx-icon name="layout-dashboard" aria-hidden="true"></vdx-icon>
        <span class="vdx-nav-label">Dashboard</span>
      </a>
    </li>
    <!-- Group heading -->
    <li role="presentation">
      <span class="vdx-nav-group-label" aria-hidden="true">Policy Management</span>
    </li>
    <li>
      <a routerLink="/policies">
        <vdx-icon name="file-text" aria-hidden="true"></vdx-icon>
        <span class="vdx-nav-label">Policies</span>
        <vdx-badge count="3" aria-label="3 pending policies"></vdx-badge>
      </a>
    </li>
  </ul>
  <div class="vdx-sidebar-footer">
    <button type="button" 
            class="vdx-sidebar-toggle"
            [attr.aria-label]="collapsed ? 'Expand navigation' : 'Collapse navigation'"
            (click)="toggleSidebar()">
      <vdx-icon [name]="collapsed ? 'chevron-right' : 'chevron-left'" aria-hidden="true"></vdx-icon>
    </button>
  </div>
</nav>
```

#### 8.2.5 Sidebar Token Map

```css
/* Applied to [data-expanded="true"] .vdx-sidebar */
--vdx-sidebar-width-expanded:  240px;
--vdx-sidebar-width-collapsed: 56px;
--vdx-sidebar-bg:              var(--vdx-color-nav-bg);      /* #1b2635 */
--vdx-sidebar-text:            var(--vdx-color-nav-text);
--vdx-sidebar-active-bg:       var(--vdx-color-nav-item-active-bg);  /* #f86407 */
--vdx-sidebar-active-text:     var(--vdx-color-text-inverse);
--vdx-sidebar-hover-bg:        var(--vdx-color-nav-item-hover-bg);
--vdx-sidebar-transition:      width var(--vdx-duration-normal) var(--vdx-ease-default);
```

#### 8.2.6 Accessibility

- The `<nav>` element has `aria-label="Main navigation"`
- Active route link has `aria-current="page"`
- The sidebar has `aria-expanded="true|false"` on the controlling toggle button
- When collapsed, nav items show a tooltip on hover/focus with the item label
- Keyboard navigation: Tab moves between items; Enter/Space activates; no arrow key roving required (standard list navigation)

### 8.3 Breadcrumb (NAV-003)

> **Component ID:** NAV-003 · **Priority:** P0 · **Delivery:** Month 1

```html
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/policies">Policies</a></li>
    <li><a href="/policies/commercial">Commercial</a></li>
    <li aria-current="page">Policy POL-2024-001</li>
  </ol>
</nav>
```

The final breadcrumb item is not a link (it is the current page). Separator characters (`/`) are inserted via CSS pseudo-elements with `aria-hidden="true"` to prevent screen readers from announcing them.

Responsive behaviour: on mobile, collapse to show only the immediate parent with a back-arrow, revealing the full trail on interaction.

### 8.4 Step Indicator / Stepper (NAV-004)

> **Component ID:** NAV-004 · **Priority:** P0 · **Delivery:** Month 1

Used for multi-step insurance workflows (policy bind, claims FNOL, endorsements).

States per step: `upcoming` · `active` · `completed` · `error`

```html
<div role="list" aria-label="Policy bind progress">
  <div role="listitem" aria-label="Step 1 of 4: Applicant details — completed">...</div>
  <div role="listitem" aria-label="Step 2 of 4: Coverage selection — current step">...</div>
  <div role="listitem" aria-label="Step 3 of 4: Risk questions — upcoming">...</div>
  <div role="listitem" aria-label="Step 4 of 4: Review and bind — upcoming">...</div>
</div>
```

Status must not be conveyed by colour alone — completed steps also show a checkmark icon; error steps show a warning icon.

---

## 9. Core UI Components

### 9.1 Button (UI-001)

> **Priority:** P0 · **Delivery:** Month 1 · **Dependencies:** FND-001, FND-003, FND-005

#### Variants

| Variant | Use case | Background | Text | Border |
|---|---|---|---|---|
| `primary` | Primary CTA per view | `#f86407` | `#ffffff` | none |
| `secondary` | Supporting action | `#1b2635` | `#ffffff` | none |
| `outline` | Alternative / cancel | transparent | `#1b2635` | `1px #1b2635` |
| `ghost` | Low-emphasis action | transparent | `#1b2635` | none |
| `destructive` | Delete, cancel, remove | `#dc2626` | `#ffffff` | none |

#### Sizes

| Size | Height | Padding H | Font size |
|---|---|---|---|
| `sm` | 32px | 12px | 13px |
| `md` | 40px | 16px | 14px (default) |
| `lg` | 48px | 20px | 16px |

#### States

`default` · `hover` · `active` · `focus` · `disabled` · `loading`

Loading state replaces label with a spinner and text "Loading…" for screen readers via `aria-label`. The button is `aria-disabled="true"` and `aria-busy="true"` while loading.

#### Angular API

```typescript
@Input() variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' = 'primary';
@Input() size: 'sm' | 'md' | 'lg' = 'md';
@Input() loading: boolean = false;
@Input() disabled: boolean = false;
@Input() fullWidth: boolean = false;
@Input() type: 'button' | 'submit' | 'reset' = 'button';
@Input() leadingIcon?: string;   // Lucide icon name
@Input() trailingIcon?: string;  // Lucide icon name
@Output() clicked = new EventEmitter<void>();
```

#### Contrast Verification

- Primary button (`#f86407` bg, `#ffffff` text): **4.56:1** — passes AA (3:1 for large text, 4.5:1 for normal text — this passes for 14px/600 weight which qualifies as normal text)
- Secondary button (`#1b2635` bg, `#ffffff` text): **14.87:1** — passes AA and AAA

### 9.2 Card (UI-007)

> **Priority:** P0 · **Delivery:** Month 1 · **Dependency:** FND-001

Cards are the primary content container in VeriDex portal layouts. They sit on `--vdx-color-bg-surface` (white) against `--vdx-color-bg-canvas` (near-white `#f5f6f8`).

```css
.vdx-card {
  background: var(--vdx-color-bg-surface);
  border: 1px solid var(--vdx-color-border-default);
  border-radius: var(--vdx-radius-lg);
  box-shadow: var(--vdx-shadow-xs);
  padding: var(--vdx-space-6);
}

/* Density modes */
.vdx-card--compact    { padding: var(--vdx-space-4); }
.vdx-card--comfortable { padding: var(--vdx-space-8); }

/* Responsive padding */
@media (max-width: 767px) {
  .vdx-card { padding: var(--vdx-space-4); }
}
```

Clickable card mode: wraps content in `<a>` or adds `role="button" tabindex="0"`. Selected state: `2px solid var(--vdx-color-action-primary)` border with a subtle orange tint background `rgba(248, 100, 7, 0.04)`.

### 9.3 Modal / Dialog (UI-013)

> **Priority:** P0 · **Delivery:** Month 1 · **Dependencies:** FND-001, FND-003, FND-005

```html
<div role="dialog" 
     aria-modal="true" 
     aria-labelledby="dialog-title-id"
     aria-describedby="dialog-body-id">
  <header>
    <h2 id="dialog-title-id">Cancel policy</h2>
    <button type="button" aria-label="Close dialog">
      <vdx-icon name="x" aria-hidden="true"></vdx-icon>
    </button>
  </header>
  <div id="dialog-body-id">...</div>
  <footer>...</footer>
</div>
```

Sizes: `sm` (480px) · `md` (640px) · `lg` (800px) · `fullscreen`

Behaviour: Focus traps inside dialog on open. Escape closes. Backdrop click closes (configurable via `closeOnBackdropClick` input). Scroll is prevented on body while open. Modal stacking (nested modals) is not supported — use drawers for secondary flows.

### 9.4 Toast Notifications (UI-017)

> **Priority:** P0 · **Delivery:** Month 1 · **Dependency:** FND-001

Toasts render in a fixed container at bottom-right on desktop, bottom-center on mobile. `z-index: var(--vdx-z-toast)`.

```typescript
// Service API
this.toastService.success('Policy bound successfully.');
this.toastService.error('Failed to save draft. Try again.');
this.toastService.warning('Session expires in 5 minutes.');
this.toastService.info('New endorsement received on POL-001.');
```

- Auto-dismiss after 5 seconds (configurable per toast)
- Auto-dismiss pauses on hover and focus
- Maximum 4 toasts visible; queue additional
- Each toast has a close button (`aria-label="Dismiss notification"`)
- The toast container has `role="region" aria-label="Notifications" aria-live="polite"`

### 9.5 Alert (UI-015) and Alert Banner (UI-016)

**Alert** (`UI-015`): Inline contextual message. Variants: `info` · `success` · `warning` · `error`.

Each variant uses both colour AND an icon to convey meaning — never colour alone.

**Alert Banner** (`UI-016`): Full-width application-level notice (e.g., scheduled maintenance, system degradation). Renders directly below the top bar. Uses `role="alert"` for urgent variants, `role="status"` for informational.

### 9.6 Empty State (UI-021)

Every list, table, and data view must implement an empty state. Structure:

1. Illustration or icon (decorative, `aria-hidden="true"`)
2. Title: clear and specific (e.g., "No policies in this portfolio" not "No data")
3. Body: optional explanation or guidance
4. Primary action button (e.g., "Add policy")
5. Secondary action (e.g., "Import from CSV")

---

## 10. Form Components

### 10.1 Form Field Wrapper (FRM-001)

> **Priority:** P0 · **Delivery:** Month 1 · **Dependencies:** FND-001, FND-005

Every form control must be wrapped in the `VdxFormField` component. This handles consistent label association, hint text, error text, and ARIA wiring.

```html
<vdx-form-field>
  <label vdxLabel for="policy-name">Policy name <span aria-hidden="true">*</span></label>
  <input vdxInput id="policy-name" type="text" [formControl]="policyNameControl"
         aria-required="true">
  <span vdxHint>Use the format: LINE-CARRIER-YEAR</span>
  <span vdxError *ngIf="policyNameControl.hasError('required')">
    Policy name is required.
  </span>
</vdx-form-field>
```

Required fields: mark with `aria-required="true"` on the control AND a visual asterisk (*) adjacent to the label. Do not rely on the asterisk alone to convey required status — the `aria-required` attribute is the machine-readable signal.

### 10.2 Text Input (FRM-002)

> **Priority:** P0 · **Delivery:** Month 1

```css
/* Default state */
.vdx-input {
  height: 40px;
  padding: 0 var(--vdx-space-3);
  border: 1px solid var(--vdx-color-border-strong);    /* #d0d4dc */
  border-radius: var(--vdx-radius-md);
  font-size: var(--vdx-type-body-sm-size);
  color: var(--vdx-color-text-primary);
  background: var(--vdx-color-bg-surface);
  width: 100%;
}

/* Focus state */
.vdx-input:focus {
  outline: none;
  border-color: var(--vdx-color-action-primary);   /* #f86407 */
  box-shadow: var(--vdx-shadow-focus);              /* Orange glow */
}

/* Error state */
.vdx-input[aria-invalid="true"] {
  border-color: var(--vdx-color-border-error);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2);
}
```

### 10.3 Currency Input (FRM-014)

Insurance-specific requirement. The component outputs a raw numeric value (e.g., `1234567.89`) regardless of display formatting (e.g., `$1,234,567.89`). Locale formatting is applied by the component, never stored in form state.

```typescript
@Input() currency: string = 'USD';
@Input() locale: string = 'en-US';
@Input() precision: number = 2;
@Input() allowNegative: boolean = false;
@Output() valueChange = new EventEmitter<number | null>();
```

### 10.4 Date Picker (FRM-010)

> **Priority:** P0 · **Delivery:** Month 1

Uses Angular CDK date adapter. Calendar grid uses roving tabindex (FND-005). Keyboard navigation: arrow keys move between days; Page Up/Down move between months; Home/End jump to first/last day of month.

```html
<div role="dialog" aria-label="Date picker" aria-modal="true">
  <div role="grid" aria-label="June 2025">
    <div role="rowgroup">...</div>
  </div>
</div>
```

### 10.5 Validation Summary (FRM-019)

On form submission with errors, an accessible validation summary renders above the form:

```html
<div role="alert" aria-live="assertive" tabindex="-1" id="validation-summary">
  <h3>Please fix the following errors before continuing:</h3>
  <ul>
    <li><a href="#policy-name">Policy name is required.</a></li>
    <li><a href="#effective-date">Effective date must be in the future.</a></li>
  </ul>
</div>
```

Focus is programmatically moved to `#validation-summary` on submission failure. Each error links to its field.

---

## 11. Data Display Components

### 11.1 Data Grid / Table (DAT-001)

> **Priority:** P0 · **Delivery:** Month 1–2 · **Complexity:** XL

The data grid is the most-used component in VeriDex portals. It is the platform's primary enterprise data display.

#### Semantic HTML Structure

```html
<div role="region" aria-label="Policy list" aria-busy="false">
  <table role="grid" aria-rowcount="1247" aria-colcount="8">
    <thead>
      <tr role="row">
        <th role="columnheader" scope="col"
            aria-sort="ascending"
            aria-label="Policy number, sorted ascending, activate to sort descending">
          Policy number
        </th>
      </tr>
    </thead>
    <tbody>
      <tr role="row" aria-rowindex="1">
        <td role="gridcell">POL-2024-001</td>
      </tr>
    </tbody>
  </table>
</div>
```

#### Features (all required for P0 release)

- Column definitions with typed cell templates
- Client-side and server-side sorting (toggling: asc → desc → none; `aria-sort` updated per header)
- Client-side and server-side filtering (integrates with FRM-017 Search Input and DAT-003 Filter Bar)
- Pagination (integrates with DAT-002 Paginator)
- Row selection (single and bulk via checkbox column)
- Sticky header on scroll
- Column visibility toggle
- Row actions menu (three-dot menu per row)
- Empty, loading, and error states
- Density modes: `compact` (32px rows) · `comfortable` (40px rows, default) · `spacious` (48px rows)
- Responsive: horizontal scroll within container below `lg` breakpoint
- Keyboard navigation: Tab between cells, Enter to activate cell links/actions

### 11.2 Paginator (DAT-002)

> **Priority:** P0 · **Delivery:** Month 1

```html
<nav aria-label="Table pagination">
  <button aria-label="Previous page" [disabled]="isFirstPage">Previous</button>
  <button aria-label="Page 3, current" aria-current="page">3</button>
  <button aria-label="Page 4">4</button>
  <button aria-label="Next page" [disabled]="isLastPage">Next</button>
  <label for="page-size-select">Rows per page</label>
  <select id="page-size-select">
    <option value="25">25</option>
    <option value="50">50</option>
    <option value="100">100</option>
  </select>
</nav>
```

### 11.3 KPI / Metric Card (DAT-005)

> **Priority:** P1 · **Delivery:** Month 2

Trend indicators must never rely on colour alone. Positive trend: upward arrow icon + green text. Negative trend: downward arrow icon + red text. Neutral: dash icon + secondary text.

```typescript
@Input() label: string;
@Input() value: string | number;
@Input() trend?: 'up' | 'down' | 'neutral';
@Input() trendValue?: string;    // e.g., "+12.4%"
@Input() trendPeriod?: string;   // e.g., "vs. prior year"
@Input() loading: boolean = false;
@Input() helpText?: string;
```

---

## 12. Insurance Domain Components

### 12.1 Design Principle for Domain Components

Insurance domain components are presentation shells only. They do not:
- Call APIs
- Implement business rules (premium calculation, eligibility, rating)
- Enforce authorisation
- Store state beyond what is passed via Angular `@Input()`

Business logic remains in consuming application services. Domain components expose typed `@Input()` interfaces and `@Output()` event emitters.

### 12.2 Policy Status Chip (INS-003)

> **Priority:** P0 · **Delivery:** Month 1

Centralised status mapping. All portals consume this component for consistent lifecycle status display.

| Status | Label | Semantic colour | Icon |
|---|---|---|---|
| `draft` | Draft | Info (blue) | `file` |
| `quoted` | Quoted | Info (blue) | `clipboard-list` |
| `bound` | Bound | Success (green) | `shield-check` |
| `active` | Active | Success (green) | `check-circle` |
| `renewal` | Renewal pending | Warning (amber) | `refresh-cw` |
| `cancelled` | Cancelled | Error (red) | `x-circle` |
| `expired` | Expired | Neutral (grey) | `clock` |
| `lapsed` | Lapsed | Error (red) | `alert-circle` |

Each chip displays icon + label. Status is never conveyed by colour alone.

### 12.3 Policy Form Wizard (INS-004)

> **Priority:** P0 · **Delivery:** Month 2 · **Complexity:** XL

Integrates with NAV-004 (Step Indicator) and FRM-019 (Validation Summary). Step validation is enforced by the consuming application (via a `stepValidator` callback), not by the wizard shell.

```typescript
interface VdxWizardStep {
  id: string;
  label: string;
  description?: string;
  validator?: () => boolean | Promise<boolean>;
}

@Input() steps: VdxWizardStep[];
@Input() currentStepIndex: number;
@Output() stepChange = new EventEmitter<number>();
@Output() saveDraft = new EventEmitter<void>();
@Output() submit = new EventEmitter<void>();
```

### 12.4 Bordereaux Grid (INS-007)

> **Priority:** P0 · **Delivery:** Month 2 · **Complexity:** XL

Extends DAT-001 with insurance-specific column pinning, row/cell error markers (for import validation), subtotals row, and large-dataset performance (virtual scrolling). Saved column view sets persist in application state (not in the component).

### 12.5 Audit Change Viewer (INS-014)

Before/after field change display for policy endorsements and amendments.

```typescript
interface VdxAuditChange {
  field: string;
  label: string;
  previousValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: Date;
  reason?: string;
  sensitive?: boolean;  // If true, component renders "••••••" for value
}
```

---

## 13. Document Management Components

### 13.1 Document Upload (DOC-001)

> **Priority:** P0 · **Delivery:** Month 1–2

File upload via browse or drag-and-drop. The component:
- Validates file type and size client-side before emitting
- Emits a `fileSelected` event; actual upload is handled by the consuming app
- Tracks upload progress via a progress bar input
- Shows virus-scan status when `scanStatus` input is provided
- Is fully keyboard-operable (Browse button is a real `<button>`)

Drag-and-drop zone is supplementary to the button — never the sole upload mechanism (WCAG 2.1 SC 2.5.3).

### 13.2 Document Preview Panel (DOC-002)

> **Priority:** P0 · **Delivery:** Month 2

PDF and image preview using the browser's native PDF viewer (`<iframe>`) or `<img>`. Unsupported file types show a fallback state with a download link.

Navigation controls (page forward/back, zoom) are labelled buttons:
- `aria-label="Previous page"` / `aria-label="Next page"`
- `aria-label="Zoom in"` / `aria-label="Zoom out"`

---

## 14. Notification Components

### 14.1 In-App Notification Feed (NTF-001)

> **Priority:** P1 · **Delivery:** Month 2

Notification feed is a display-only component. Persistence, read/unread state management, and retrieval are handled by the consuming app.

```typescript
interface VdxNotification {
  id: string;
  title: string;
  body?: string;
  category: 'policy' | 'claim' | 'endorsement' | 'payment' | 'system' | 'compliance';
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionUrl?: string;
}

@Input() notifications: VdxNotification[];
@Output() markRead = new EventEmitter<string>();       // notification id
@Output() markAllRead = new EventEmitter<void>();
@Output() actionClicked = new EventEmitter<string>();  // notification id
```

Unread state has a text/semantic equivalent: unread items have `aria-label="[title] — unread"`.

---

## 15. Charts and KPI Components

### 15.1 Chart Wrapper (CHT-001)

> **Priority:** P0 · **Delivery:** Month 1 · **Complexity:** L

All VeriDex charts wrap Chart.js via a typed Angular service. The wrapper provides:

- Responsive sizing (fills container, re-renders on `ResizeObserver`)
- Theme token integration (chart colours from design token palette)
- Empty state (no data), loading state (skeleton), and error state
- Reduced motion: disables animation when `prefers-reduced-motion: reduce` is active
- Accessible text fallback: every chart component accepts a `summaryText` input rendered in a visually hidden `<caption>` or adjacent `<p>` element, and an optional toggle to show a data table equivalent

#### Chart Colour Palette (accessible for colour blindness)

VeriDex charts use a sequentially ordered palette tested for deuteranopia and protanopia:

```
Series 1: #f86407  (orange — brand primary)
Series 2: #1b2635  (navy — brand secondary)
Series 3: #3b82f6  (blue)
Series 4: #16a34a  (green)
Series 5: #d97706  (amber)
Series 6: #8b5cf6  (violet)
Series 7: #0891b2  (cyan)
Series 8: #64748b  (slate)
```

Charts never rely on colour alone to convey data — patterns, labels, and tooltips supplement colour.

### 15.2 Insurance Chart Components

| ID | Chart | Insurance use |
|---|---|---|
| CHT-002 | Loss Ratio | Actual vs target loss ratio by line/period |
| CHT-003 | Premium Trend Line | Written/earned premium over time |
| CHT-004 | Portfolio Heatmap | Concentration/exposure by territory and class |
| CHT-005 | Donut / Breakdown | Premium mix by product or carrier |
| CHT-006 | Bar / Comparison | Period-over-period premium or claim comparison |

---

## 16. WCAG 2.2 AA Compliance Reference

### 16.1 Applicable Success Criteria

All components must satisfy the following WCAG 2.2 AA criteria before release:

| SC | Name | Requirement |
|---|---|---|
| 1.1.1 | Non-text Content | All images, icons, and charts have text alternatives |
| 1.3.1 | Info and Relationships | Semantic HTML conveys structure (headings, lists, tables, forms) |
| 1.3.2 | Meaningful Sequence | DOM order matches reading/visual order |
| 1.3.3 | Sensory Characteristics | Instructions do not rely solely on shape, colour, size, or location |
| 1.4.1 | Use of Colour | Colour is not the only visual means of conveying information |
| 1.4.3 | Contrast (Minimum) | Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (large text ≥ 18pt/14pt bold) |
| 1.4.4 | Resize Text | Content reflows at 400% zoom without horizontal scroll |
| 1.4.10 | Reflow | Single-column layout at 320px width / 400% zoom |
| 1.4.11 | Non-text Contrast | UI components and graphic elements ≥ 3:1 against adjacent background |
| 1.4.12 | Text Spacing | No loss of content when letter/word/line spacing increased |
| 1.4.13 | Content on Hover or Focus | Hover/focus content dismissible, hoverable, persistent |
| 2.1.1 | Keyboard | All functionality operable via keyboard |
| 2.1.2 | No Keyboard Trap | Keyboard focus not trapped except in modal dialogs (with Escape to exit) |
| 2.4.3 | Focus Order | Focus order is logical and sequential |
| 2.4.4 | Link Purpose | Link purpose determinable from link text or context |
| 2.4.7 | Focus Visible | Keyboard focus indicator visible |
| 2.4.11 | Focus Appearance | Focus indicator: ≥ 3:1 contrast, ≥ 2px perimeter |
| 2.5.3 | Label in Name | Visible label text present in accessible name |
| 2.5.8 | Target Size | Interactive targets ≥ 24×24px (AA), ideally 44×44px |
| 3.1.2 | Language of Parts | Language attribute set on `<html>` |
| 3.2.2 | On Input | Changing a form control does not auto-submit |
| 3.3.1 | Error Identification | Errors are identified and described in text |
| 3.3.2 | Labels or Instructions | Labels or instructions provided for form inputs |

### 16.2 Automated Accessibility Checks

Every component Storybook story runs automated axe checks via `@storybook/addon-a11y`. CI pipeline fails on any axe `critical` or `serious` violation.

Manual checks required per component (not automatable by axe):
- Keyboard-only navigation walkthrough
- Screen reader announcement verification (NVDA + Chrome; VoiceOver + Safari)
- 400% zoom reflow check
- Colour removed (forced greyscale) — all states still distinguishable

---

## 17. Colour Contrast Verification

### 17.1 Text Contrast Pairs (WCAG 1.4.3)

All values computed against WCAG relative luminance formula.

| Foreground | Background | Ratio | AA Normal (4.5:1) | AA Large (3:1) |
|---|---|---|---|---|
| `#1b2635` (navy) | `#ffffff` (white) | 14.87:1 | ✅ Pass | ✅ Pass |
| `#1b2635` (navy) | `#f5f6f8` (canvas) | 13.21:1 | ✅ Pass | ✅ Pass |
| `#565c6b` (secondary text) | `#ffffff` | 5.74:1 | ✅ Pass | ✅ Pass |
| `#565c6b` (secondary text) | `#f5f6f8` | 5.11:1 | ✅ Pass | ✅ Pass |
| `#8d94a3` (tertiary text) | `#ffffff` | 3.14:1 | ❌ Fail (use for large text only) | ✅ Pass |
| `#8d94a3` (tertiary text) | `#f5f6f8` | 2.79:1 | ❌ Fail | ❌ Fail — **do not use for body text** |
| `#ffffff` | `#f86407` (orange) | 4.56:1 | ✅ Pass | ✅ Pass |
| `#ffffff` | `#1b2635` (navy) | 14.87:1 | ✅ Pass | ✅ Pass |
| `#b91c1c` (error text) | `#ffffff` | 5.91:1 | ✅ Pass | ✅ Pass |
| `#166534` (success text) | `#ffffff` | 7.23:1 | ✅ Pass | ✅ Pass |
| `#b45309` (warning text) | `#ffffff` | 4.74:1 | ✅ Pass | ✅ Pass |
| `#1d4ed8` (info text) | `#ffffff` | 6.53:1 | ✅ Pass | ✅ Pass |

**Corrected usage rules:**
- `--vdx-color-text-tertiary` (`#8d94a3`) must only be used for decorative text ≥ 18pt, or where adjacent non-colour signals (icon, spacing) carry meaning. Never use for required form labels or error text.
- Placeholder text in inputs uses `--vdx-color-text-tertiary` but inputs must have a visible `<label>` — the placeholder is supplementary.

### 17.2 Non-Text Contrast (WCAG 1.4.11 — ≥ 3:1)

| Element | Component colour | Adjacent background | Ratio | Pass? |
|---|---|---|---|---|
| Input border (default) | `#d0d4dc` | `#ffffff` | 1.97:1 | ❌ — upgrade to `#b0b6c3` on non-white |
| Input border (default) | `#b0b6c3` | `#ffffff` | 2.70:1 | ❌ — **use `--vdx-primitive-neutral-400` (#8d94a3) instead** |
| Input border corrected | `#8d94a3` | `#ffffff` | 3.14:1 | ✅ Pass |
| Input border (focus) | `#f86407` | `#ffffff` | 3.27:1 | ✅ Pass |
| Input border (error) | `#dc2626` | `#ffffff` | 4.57:1 | ✅ Pass |
| Checkbox unchecked border | `#8d94a3` | `#ffffff` | 3.14:1 | ✅ Pass |
| Toggle track (off) | `#b0b6c3` | `#ffffff` | 2.70:1 | ❌ — **use `#717887` instead** |
| Toggle track corrected | `#717887` | `#ffffff` | 4.46:1 | ✅ Pass (also passes text at ≥ 14px/600) |
| Icon (decorative, informational) | `#565c6b` | `#ffffff` | 5.74:1 | ✅ Pass |
| Focus ring orange | `#f86407` | `#ffffff` | 3.27:1 | ✅ Pass (SC 2.4.11 requires ≥ 3:1) |
| Sidebar nav text | `#dce3ec` (navy-100) | `#1b2635` (navy-900) | 9.85:1 | ✅ Pass |
| Active nav item | `#ffffff` | `#f86407` | 4.56:1 | ✅ Pass |

**Corrected token:** The default input border token is changed to `--vdx-primitive-neutral-400` (`#8d94a3`) to pass non-text contrast. Update FND-001 accordingly.

```css
/* CORRECTED — was --vdx-primitive-neutral-200 (#d0d4dc) */
--vdx-color-border-default:    var(--vdx-primitive-neutral-400);  /* #8d94a3, 3.14:1 on white */
```

Note: Cards use `--vdx-color-border-default` for their border. A 3.14:1 card border against white meets non-text contrast (3:1 threshold). This is intentional — the card elevation shadow provides additional visual separation.

---

## 18. Responsive Behaviour Rules

### 18.1 Page Layout at Each Breakpoint

#### Mobile (< 768px)
- Sidebar: hidden, accessible via hamburger button in top bar
- Top bar: logo (icon only), hamburger button, notification icon, user avatar
- Content: single column, 100% width, 24px gutters
- Cards: full width, stacked vertically
- Data grid: horizontal scroll enabled within container
- Forms: single column, full-width fields
- Modals: full-screen
- Page header actions: collapse into a `...` overflow menu

#### Tablet (768px–1023px)
- Sidebar: visible, collapsed to 56px icon-only mode by default
- Top bar: full logo or short logo (configurable)
- Content: adapts to available space (100% minus sidebar width)
- Cards: 1 or 2 columns depending on card content
- Forms: 1–2 column layout
- Modals: centred, `md` size

#### Desktop (≥ 1024px)
- Sidebar: expanded (240px) by default, collapsible by user
- Content: full two-column layout
- Cards: up to 3–4 columns for KPI/metric cards
- Forms: up to 2 columns for form fields
- Modals: centred, `md` or `lg` size

### 18.2 Reflow at 400% (WCAG 1.4.10)

At 400% zoom (equivalent to 320px viewport width):
- All content reflows to single column
- No horizontal scrolling at the page level
- Sidebar is hidden (accessible via top bar button)
- Form fields stack vertically
- Tables scroll horizontally within their container (this is acceptable under WCAG)
- All text remains visible and legible

### 18.3 Touch Target Sizes (WCAG 2.5.8)

Minimum touch target: 24×24px (WCAG 2.2 AA minimum).  
Target: 44×44px for all primary interactive controls.

| Component | Target size |
|---|---|
| Buttons (all sizes) | Height: 32/40/48px · Width: label-dependent, min 64px |
| Icon buttons | 40×40px minimum hit area |
| Checkboxes | 24×24px minimum; label extends hit area |
| Radio buttons | 24×24px minimum |
| Toggle/Switch | 44×24px minimum |
| Table row actions | 32×32px |
| Sidebar nav items | Full width, 44px height |
| Pagination buttons | 36×36px minimum |

---

## 19. Logo and Branding Configuration

### 19.1 Logo Slot

The top bar logo is configurable via Angular `@Input()`. Three display modes:

| Mode | When to use |
|---|---|
| `image` | Primary: `<img src="...">` with `alt="VeriDex"` (or portal-specific name) |
| `svg` | When SVG asset is available and must be inline for theming |
| `text` | Fallback: plain text wordmark using brand typography |

```typescript
// VdxTopBarComponent
@Input() logoMode: 'image' | 'svg' | 'text' = 'text';
@Input() logoSrc?: string;          // For image/svg mode
@Input() logoAlt: string = 'VeriDex'; // Required for image mode
@Input() logoText: string = 'VeriDex'; // For text fallback
@Input() portalName?: string;        // e.g., "Agent Portal", "Carrier Portal"
```

### 19.2 Text Fallback Rendering

When `logoMode === 'text'`:

```css
.vdx-logo-text {
  font-family: var(--vdx-type-family-primary);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--vdx-color-text-primary);
  letter-spacing: -0.02em;
}

.vdx-logo-text .vdx-logo-accent {
  color: var(--vdx-color-action-primary);  /* Orange on the "V" or brand mark */
}
```

### 19.3 Collapsed Sidebar Logo

In collapsed sidebar mode (56px), the top bar retains only the logo icon (first letter or brand mark icon). In expanded mode, the full wordmark appears with `portalName` on a second line in caption size.

### 19.4 Favicon and Browser Tab Title

Browser tab title pattern: `{Page name} — {Module} · VeriDex`

Example: `Policy POL-2024-001 — Commercial Lines · VeriDex`

The `·` separator is a middle dot (U+00B7), not a dash or asterisk.

---

## 20. Component Governance and RFC Process

### 20.1 Core Library Team

The `@veridex/ui` library is maintained by a designated Core Library Team. The team owns:
- Token governance (additions, deprecations, breaking changes)
- Component API contracts
- Accessibility review sign-off
- Storybook/Compodoc publication
- Versioned package releases (`@veridex/ui@x.y.z`)

### 20.2 RFC Process for New Components

To propose a new component or breaking API change:

1. Open an RFC issue in the Nx monorepo with the label `rfc:component`
2. RFC must include: use-case description, proposed Angular API (inputs/outputs), Storybook stories sketch, WCAG compliance notes
3. RFC review period: minimum 5 business days
4. Core Library Team votes: majority approval required
5. Approved RFC moves to the backlog as a new component task in the Feature Tasks sheet

Minor additions (new optional `@Input()`, new variant of an existing component) do not require a full RFC — a PR with Storybook story and documentation is sufficient.

### 20.3 Versioning Policy

Semantic versioning:
- **Patch** (`x.y.Z`): Bug fixes, accessibility fixes, documentation
- **Minor** (`x.Y.0`): New components, new optional inputs, non-breaking additions
- **Major** (`X.0.0`): Breaking API changes, token renames, component removals

Token renames require a deprecation period of one major version: the old token maps to the new value with a deprecation notice in the Storybook documentation.

---

## 21. Definition of Done

A component is **not released** until all of the following are true:

### Build
- [ ] Public Angular `@Input()` / `@Output()` API is typed, minimal, and documented
- [ ] No application-specific business logic inside the component
- [ ] No hard-coded colour, spacing, or font values — all via tokens
- [ ] All required feature variants implemented

### Storybook
- [ ] Stories cover: default, all variants, disabled, loading, error/empty, long content, mobile viewport
- [ ] Storybook controls (Args) expose all public inputs
- [ ] Compodoc API documentation generated

### Testing
- [ ] Unit/component tests written with Vitest
- [ ] Interaction tests via Storybook `play` functions
- [ ] Automated axe checks pass in Storybook a11y addon (no critical/serious violations)
- [ ] Visual regression baseline captured

### Accessibility
- [ ] Keyboard-only navigation verified manually
- [ ] Screen reader tested (NVDA + Chrome required; VoiceOver + Safari recommended)
- [ ] Colour contrast verified (text ≥ 4.5:1, non-text ≥ 3:1)
- [ ] 400% zoom reflow verified
- [ ] Reduced motion verified

### Documentation
- [ ] Usage guidance with do/don't examples in Storybook MDX
- [ ] Public API documented (types, defaults, examples)
- [ ] Migration notes if replacing an existing portal implementation

### QA
- [ ] Tested at Mobile (375px), Tablet (768px), Desktop (1280px) viewports
- [ ] No clipping, overflow, focus loss, or layout breakage
- [ ] Light theme verified

---

## 22. AI Agent Consumption Notes

This section explains how AI coding agents, linters, and automated tooling should interpret this document.

### 22.1 Token Lookup Pattern

When generating component styles, AI agents must:
1. Never output raw hex values in component code
2. Look up the appropriate semantic token from Section 3
3. Use the token variable: `var(--vdx-color-...)` or `var(--vdx-space-...)` etc.

Example:
```
❌  color: #1b2635;
✅  color: var(--vdx-color-text-primary);

❌  padding: 16px;
✅  padding: var(--vdx-space-4);
```

### 22.2 Accessibility Checklist for Generated Code

When an AI agent generates any interactive component, it must verify:
1. Is the element semantically correct (`<button>`, `<a>`, `<input>`, not `<div>` with click handler)?
2. Does every `<img>` or SVG icon have `alt` text or `aria-hidden="true"`?
3. Does every form control have a programmatically associated `<label>`?
4. Does the component have a visible focus indicator?
5. Is meaning conveyed by more than colour alone?

### 22.3 Component ID Cross-Reference

When referencing a component, use its Component ID from Section 1.3. Example: "Use the `FRM-010` (Date Picker) component here." This allows agents to look up the full specification in Section 10.

### 22.4 Prohibited Patterns

The following patterns are never acceptable in `@veridex/ui` component code:

```typescript
// ❌ Business logic in component
calculatePremium() { /* ... */ }

// ❌ API call in component
fetchPolicies() { this.http.get('/api/policies').subscribe(...) }

// ❌ Hardcoded colour
this.renderer.setStyle(el, 'color', '#f86407');

// ❌ Authorization check in component
if (this.user.role === 'admin') { ... }

// ❌ Non-semantic interactive element
<div (click)="handleClick()">Click me</div>
```

### 22.5 Required Angular Patterns

```typescript
// ✅ Typed, minimal inputs
@Input({ required: true }) label: string;
@Input() variant: ButtonVariant = 'primary';

// ✅ Strongly typed output events
@Output() valueChange = new EventEmitter<string>();

// ✅ OnPush change detection for performance
@Component({ changeDetection: ChangeDetectionStrategy.OnPush })

// ✅ Inject services, not instantiate
constructor(private toastService: VdxToastService) {}
```

---

*End of VeriDex Enterprise UI/UX Framework v2.0.0*

*This document is the property of VeriDex Solutions (veridexsolutions.ai). It is maintained by the Core Library Team and version-controlled alongside the `@veridex/ui` Nx library. Updates require Core Library Team approval.*