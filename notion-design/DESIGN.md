# notion DESIGN.md

> Auto-generated design system — reverse-engineered via static analysis by skillui.
> Frameworks: None detected
> Colors: 20 · Fonts: 3 · Components: 6
> Icon library: not detected · State: not detected
> Primary theme: light · Dark mode toggle: no · Motion: expressive

## Visual Reference

**Match this design exactly** — study colors, fonts, spacing, and component shapes before writing any UI code.

![notion Homepage](../screenshots/homepage.png)

---

## 1. Visual Theme & Atmosphere

This is a **light-themed** interface with a cool, approachable feel. The light background emphasizes content clarity. Typography pairs **NotionInter** for display/headings with **Noto Sans Arabic** for body text, creating clear visual hierarchy through type contrast. Spacing follows a **4px base grid** (compact density), with scale: 2, 4, 6, 8, 10, 12, 14, 16px. The accent color **#0075de** anchors interactive elements (buttons, links, focus rings). Motion is expressive — spring physics, layout animations, and staggered reveals are part of the visual language.

---

## 2. Color Palette & Roles

| Token | Hex | Role | Use |
|---|---|---|---|
| color-gray-100 | `#f9f9f8` | background | Page background, darkest surface |
| color-blue-200 | `#e6f3fe` | surface | Card and panel backgrounds |
| color-black | `#000000` | text-primary | Headings and body text |
| color-gray-400 | `#a39e98` | text-muted | Captions, placeholders, secondary info |
| color-gray-800 | `#31302e` | border | Dividers, card borders, outlines |
| color-blue-600 | `#0075de` | accent | CTAs, links, focus rings, active states |
| color-red-200 | `#fdd3cd` | danger | Error states, destructive actions |
| warning | `#f4bf4f` | warning | Warning states, caution indicators |
| color-blue-400 | `#62aef0` | info | Informational highlights |
| color-gray-600 | `#615d59` | unknown | Palette color |
| color-gray-900 | `#191918` | unknown | Palette color |
| color-blue-500 | `#097fe8` | unknown | Palette color |
| color-campaigns-agents-launch-blue-200 | `#2537b1` | unknown | Palette color |
| color-gray-300 | `#dfdcd9` | unknown | Palette color |
| unknown | `#2383e2` | unknown | Palette color |
| color-gray-500 | `#78736f` | unknown | Palette color |
| color-yellow-100 | `#fff5e0` | unknown | Palette color |
| unknown | `#172b4d` | unknown | Palette color |
| color-yellow-500 | `#ffb110` | unknown | Palette color |
| color-red-500 | `#f64932` | unknown | Palette color |

### CSS Variable Tokens

```css
--border-color-regular: rgb(0 0 0/8%);
--border-radius-0: 0;
--border-radius-200: 0.25rem;
--border-radius-300: 0.3125rem;
--border-radius-400: 0.375rem;
--border-radius-500: 0.5rem;
--border-radius-600: 0.625rem;
--border-radius-700: 0.75rem;
--border-radius-800: 0.875rem;
--border-radius-900: 1rem;
--border-radius-round: 624.9375rem;
--border-width-1: var(--dimension-thickness-1);
--border-style-solid: solid;
--border-style-dashed: dashed;
--font-family-primary-sans: NotionInter;
--font-family-primary-serif: "Lyon Text";
--font-family-primary-serif-japanese: "Lyon Text";
--font-family-primary-serif-chinese-simplified: "Lyon Text";
--font-family-primary-serif-chinese-traditional: "Lyon Text";
--font-family-primary-sans-vietnamese: ui-sans-serif;
```


---

## 3. Typography Rules

**Font Stack:**
- **Noto Sans Arabic** — Heading 1, Heading 2, Heading 3
- **NotionInter** — Body, Caption
- **iA Writer Mono** — Code

**Font Sources:**

```css
@font-face {
  font-family: "NotionInter";
  src: url("https://notion.com/front-static/fonts/NotionInter-Regular.woff2") format("woff2");
  font-weight: 400;
}
@font-face {
  font-family: "NotionInter";
  src: url("https://notion.com/front-static/fonts/NotionInter-Bold.woff2") format("woff2");
  font-weight: 700;
}
@font-face {
  font-family: "Noto Sans Arabic";
  src: url("https://notion.com/front-static/fonts/noto-sans-arabic.woff2") format("woff2");
  font-weight: 100;
}
@font-face {
  font-family: "Noto Sans Hebrew";
  src: url("https://notion.com/front-static/fonts/noto-sans-hebrew.woff2") format("woff2");
  font-weight: 100;
}
@font-face {
  font-family: "Lyon Text";
  src: url("https://notion.com/_next/static/media/LyonText-Regular-Web.d7bfb4be.woff2") format("woff2");
  font-weight: 400;
}
@font-face {
  font-family: "iA Writer Mono";
  src: url("https://notion.com/_next/static/media/iAWriterMonoS-Regular.bf09337b.woff2") format("woff2");
  font-weight: 400;
}
@font-face {
  font-family: "Permanent Marker";
  src: url("https://notion.com/_next/static/media/permanent-marker.18b85f55.woff") format("woff");
  font-weight: 400;
}
```

| Role | Font | Size | Weight |
|---|---|---|---|
| Heading 1 | Noto Sans Arabic | 80px | 700 |
| Heading 2 | Noto Sans Arabic | 78px | 700 |
| Heading 3 | Noto Sans Arabic | 61px | 700 |
| Body | NotionInter | 14px | 400 |
| Caption | NotionInter | 16px | 400 |
| Code | iA Writer Mono | 14px | 400 |

**Typographic Rules:**
- Limit to 3 font families max per screen
- Use **Noto Sans Arabic** for body/UI text, **NotionInter** for display/headings
- Maintain consistent hierarchy: no more than 3-4 font sizes per screen
- Headings use bold (600-700), body uses regular (400)
- Line height: 1.5 for body text, 1.2 for headings
- Use color and opacity for secondary hierarchy, not additional font sizes


---

## 4. Component Stylings

### Layout (1)

**Footer** — `html`

### Navigation (1)

**Navigation** — `html`

### Data Input (2)

**Button** — `html`
- Animation: 

**Input** — `html`
- State: :focus, :placeholder

### Media (2)

**Image** — `html`

**Icon** — `html`



---

## 5. Layout Principles

- **Base spacing unit:** 4px
- **Spacing scale:** 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24
- **Border radius:** 4px, 8px, inherit, .25rem, .5em, 1px, 2px, 3vw, 3px, 5px, 6px, 8px 8px 0px 0px, 10px, 12px, 12px 12px 0px 0px, 13px, 14px, 14.4px, 16px, 20px, 24px, 30px, 32px, 36px, 38px, 58px, 100%, 100px, 200px, 1000px
- **Max content width:** 1079px

**Spacing as Meaning:**
| Spacing | Use |
|---|---|
| 4-8px | Tight: related items within a group |
| 12-16px | Medium: between groups |
| 24-32px | Wide: between sections |
| 48px+ | Vast: major section breaks |


---

## 6. Depth & Elevation

### Flat — subtle depth hints

- `inset 0 0 0 1px rgba(35,131,226,.57),0 0 0 2px rgba(35,131,226,.35)`
- `0 1px rgba(0,0,0,0)`
- `0 1px var(--color-border-base)`

### Raised — cards, buttons, interactive elements

- `var(--shadow-200)`
- `var(--dropdown-shadow)`
- `var(--shadow-300)`

### Floating — dropdowns, popovers, modals

- `0 0 20px 5px rgba(255,255,255,.2)`
- `0 3px 9px rgba(0,0,0,0),0 .7px 1.4625px rgba(0,0,0,0)`
- `0 3px 9px rgba(0,0,0,.03),0 .7px 1.462px rgba(0,0,0,.01)`

### Overlay — full-screen overlays, top-level dialogs

- `0 4px 18px rgba(0,0,0,.04),0 2.025px 7.84688px rgba(0,0,0,.027),0 .8px 2.925px rgba(0,0,0,.02),0 .175px 1.04062px rgba(0,0,0,.013),0 0 1px rgba(255,255,255,.6)`
- `0 4px 18px rgba(0,0,0,.04),0 2.025px 7.84688px rgba(0,0,0,.027),0 .8px 2.925px rgba(0,0,0,.02),0 .175px 1.04062px rgba(0,0,0,.013)`
- `0 8px 30px rgba(0,0,0,.25)`

### Z-Index Scale

`0, 1, 2, 3, 4, 10, 20, 50, 99, 100, 101, 102, 1000, 9999, 10001, 99999, 10000000000000000`



---

## 7. Animation & Motion

This project uses **expressive motion**. Animations are an integral part of the experience.

### CSS Animations

- `@keyframes fadeIn`
- `@keyframes fadeOut`
- `@keyframes scaleIn`
- `@keyframes scaleOut`
- `@keyframes popIn`
- `@keyframes rotate`
- `@keyframes loadingDots_pulse__d8LYi`
- `@keyframes popover_popoverFadeIn__WkJed`

### Animated Components

- **Button**: 

### Motion Guidelines

- Duration: 150-300ms for micro-interactions, 300-500ms for page transitions
- Easing: `ease-out` for enters, `ease-in` for exits
- Always respect `prefers-reduced-motion`


---

## 8. Do's and Don'ts

### Do's

- Use `#0075de` for interactive elements (buttons, links, focus rings)
- Use `#f9f9f8` as the primary page background
- Pair **Noto Sans Arabic** (body) with **NotionInter** (display) — these are the only allowed fonts
- Follow the **4px** spacing grid for all margins, padding, and gaps
- Use the defined shadow tokens for elevation — see Section 6
- Use border-radius from the scale: 4px, 8px, inherit, .25rem, .5em
- Reuse existing components from Section 4 before creating new ones

### Don'ts

- Don't introduce colors outside this palette — extend the design tokens first
- Don't introduce additional font families beyond Noto Sans Arabic and NotionInter and iA Writer Mono
- Don't use arbitrary spacing values — stick to multiples of 4px
- Don't create custom box-shadow values outside the system tokens
- Don't use arbitrary border-radius values — pick from the defined scale
- Don't duplicate component patterns — check Section 4 first
- Don't use backdrop-blur or blur effects

### Anti-Patterns (detected from codebase)

- No blur or backdrop-blur effects
- No zebra striping on tables/lists


---

## 9. Responsive Behavior

| Name | Value | Source |
|---|---|---|
| xs | 374px | css |
| xs | 375px | css |
| xs | 400px | css |
| xs | 440px | css |
| xs | 480px | css |
| sm | 534px | css |
| sm | 599px | css |
| sm | 600px | css |
| md | 668px | css |
| md | 700px | css |
| md | 712px | css |
| md | 768px | css |
| lg | 769px | css |
| lg | 839px | css |
| lg | 840px | css |
| lg | 900px | css |
| lg | 908px | css |
| lg | 919px | css |
| lg | 940px | css |
| lg | 941px | css |
| lg | 942px | css |
| lg | 1024px | css |
| xl | 1032px | css |
| xl | 1079px | css |
| xl | 1080px | css |
| xl | 1120px | css |
| xl | 1156px | css |
| xl | 1200px | css |
| xl | 1280px | css |
| 2xl | 1300px | css |
| 2xl | 1440px | css |
| 2xl | 1600px | css |
| 2xl | 1800px | css |
| 2xl | 1900px | css |

**Approach:** Use `@media (min-width: ...)` queries matching the breakpoints above.


---

## 10. Agent Prompt Guide

Use these as starting points when building new UI:

### Build a Card

```
Background: #e6f3fe
Border: 1px solid #31302e
Radius: 13px
Padding: 16px
Font: Noto Sans Arabic
Use shadow tokens from Section 6.
```

### Build a Button

```
Primary: bg #0075de, text white
Ghost: bg transparent, border #31302e
Padding: 8px 16px
Radius: 13px
Hover: opacity 0.9 or lighter shade
Focus: ring with #0075de
```

### Build a Page Layout

```
Background: #f9f9f8
Max-width: 1079px, centered
Grid: 4px base
Responsive: mobile-first, breakpoints from Section 9
```

### Build a Stats Card

```
Surface: #e6f3fe
Label: #a39e98 (muted, 12px, uppercase)
Value: #000000 (primary, 24-32px, bold)
Status: use success/warning/danger from Section 2
```

### Build a Form

```
Input bg: #f9f9f8
Input border: 1px solid #31302e
Focus: border-color #0075de
Label: #a39e98 12px
Spacing: 16px between fields
Radius: 13px
```

### General Component

```
1. Read DESIGN.md Sections 2-6 for tokens
2. Colors: only from palette
3. Font: Noto Sans Arabic, type scale from Section 3
4. Spacing: 4px grid
5. Components: match patterns from Section 4
6. Elevation: shadow tokens
```
