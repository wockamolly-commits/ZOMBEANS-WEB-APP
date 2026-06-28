# Animation Reference

> Cinematic motion design extracted from live DOM. Follow these specs exactly to recreate the experience.

## Motion Technology Stack

| Library | Type | Notes |
|---------|------|-------|
| **Web Animations API (36 active)** | animation |  |

## Scroll Journey

The page is **6,484px** tall. Each frame below shows what the user sees at that scroll depth.

> **Use these screenshots to understand WHAT animates, WHEN it animates, and HOW it moves.**

### 0% — Top / Hero
Scroll position: 0px

![Scroll 0%](../screens/scroll/scroll-000.png)

### 17% — Opening Section
Scroll position: 949px

![Scroll 17%](../screens/scroll/scroll-017.png)

### 33% — First Feature Section
Scroll position: 1,843px

![Scroll 33%](../screens/scroll/scroll-033.png)

### 50% — Mid-Page
Scroll position: 2,792px

![Scroll 50%](../screens/scroll/scroll-050.png)

### 67% — Lower Content
Scroll position: 3,741px

![Scroll 67%](../screens/scroll/scroll-067.png)

### 83% — Near Footer
Scroll position: 4,635px

![Scroll 83%](../screens/scroll/scroll-083.png)

### 100% — Bottom / Footer
Scroll position: 5,584px

![Scroll 100%](../screens/scroll/scroll-100.png)

## Video Elements

| # | Role | Autoplay | Loop | Muted | Size | First Frame |
|---|------|----------|------|-------|------|-------------|
| 1 | background | — | ✓ | ✓ | 958×599 | [view](../screens/scroll/video-1-frame.png) |

**Video 1 first frame:**

![Video 1 Frame](../screens/scroll/video-1-frame.png)

- **Source:** `https://videos.ctfassets.net/spoqsaf9291f/1EL7UZIXfcqngxsNSbL8tR/291f61f56f29dd8e788deaec8561d882/web-homepage-hero-1920`

## Scroll Animation Patterns

| Pattern | Library | Element Count | Duration | Delay | Easing |
|---------|---------|---------------|----------|-------|--------|
| parallax / sticky scroll | CSS | 4 | — | — | — |

### CSS Implementation

## CSS Keyframes (39 extracted)

### `@keyframes fadeIn`

Duration: `0s` · Easing: `linear` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.appear-instantly`, `.fade-in-fastest`, `.fade-in-fast`, `.fade-in-slow`

```css
@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

> Opacity fade

### `@keyframes fadeOut`

Duration: `0.25s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.fade-out-fast`, `.fade-out-slow`

```css
@keyframes fadeOut {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
```

> Opacity fade

### `@keyframes scaleIn`

Duration: `0.25s` · Easing: `ease-in` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.scale-in-fast`

```css
@keyframes scaleIn {
  0% {
    transform: scale(0.975);
  }
  100% {
    transform: scale(1);
  }
}
```

> Transform/motion animation

### `@keyframes scaleOut`

Duration: `0.25s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.scale-out-fast`

```css
@keyframes scaleOut {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(0.975);
  }
}
```

> Transform/motion animation

### `@keyframes popIn`

Duration: `0.15s` · Easing: `cubic-bezier(0.175, 0.885, 0.32, 1.275)` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.pop-in`

```css
@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(0.75);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
```

> Fade + motion enter animation

### `@keyframes rotate`

Duration: `1s` · Easing: `linear` · Delay: `0s` · Iteration: `infinite` · Fill: `none`

Used by: `.loading-spinner`

```css
@keyframes rotate {
  0% {
    transform: rotate(0deg) translateZ(0px);
  }
  100% {
    transform: rotate(1turn) translateZ(0px);
  }
}
```

> Transform/motion animation

### `@keyframes globalNavigation_slideDown__fiX_y`

Duration: `0.3s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `forwards`

Used by: `.globalNavigation_mobileSubmenu__ndil4`

```css
@keyframes globalNavigation_slideDown__fiX_y {
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0px);
  }
}
```

> Fade + motion enter animation

### `@keyframes modal_backgroundFadeOut__jw_M8`

Duration: `0.25s` · Easing: `ease-out` · Delay: `0s` · Iteration: `1` · Fill: `none`

Used by: `.modal_modalScrimFadeOut__IlFXO`

```css
@keyframes modal_backgroundFadeOut__jw_M8 {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
```

> Opacity fade

### `@keyframes loadingDots_pulse__d8LYi`

```css
@keyframes loadingDots_pulse__d8LYi {
  0% {
    opacity: 0.2;
  }
  100% {
    opacity: 0.75;
  }
}
```

> Opacity fade

### `@keyframes globalNavigation_navShadowScrolled__pZKcg`

```css
@keyframes globalNavigation_navShadowScrolled__pZKcg {
  0% {
    box-shadow: rgba(0, 0, 0, 0) 0px 1px;
  }
  100% {
    box-shadow: 0 1px var(--color-border-base);
  }
}
```

> Shadow pulse/glow effect

### `@keyframes globalNavigation_fadeIn__BTvkx`

```css
@keyframes globalNavigation_fadeIn__BTvkx {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

> Opacity fade

### `@keyframes globalNavigation_fadeOut__UET7A`

```css
@keyframes globalNavigation_fadeOut__UET7A {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
```

> Opacity fade

### `@keyframes globalNavigation_navTokensHeroExit__nkR7m`

```css
@keyframes globalNavigation_navTokensHeroExit__nkR7m {
  0% {
    --color-text-normal: var(--color-gray-200);
    --color-background-base-hover: var(--color-alpha-white-100);
    --color-border-base: var(--color-alpha-white-200);
    --color-button-primary-text: var(--color-white);
    --color-button-primary-background: var(--color-campaigns-agents-launch-blue-400);
    --color-button-primary-background-hover: var(--color-campaigns-agents-launch-blue-300);
    --color-button-primary-background-focus: var(--color-campaigns-agents-launch-blue-300);
    --color-button-primary-background-active: var(--color-campaigns-agents-launch-blue-300);
    --color-button-ghost-text: var(--color-white);
    --color-button-ghost-background-hover: var(--color-alpha-white-200);
    --color-button-ghost-background-focus: var(--color-alpha-white-200);
    --color-button-ghost-background-active: var(--color-alpha-white-200);
    --color-text-muted: var(--color-white);
  }
  100% {
    --color-text-normal: inherit;
    --color-background-base-hover: inherit;
    --color-border-base: inherit;
    --color-button-primary-text: inherit;
    --color-button-primary-background: inherit;
    --color-button-primary-background-hover: inherit;
    --color-button-primary-background-focus: inherit;
    --color-button-primary-background-active: inherit;
    --color-button-ghost-text: inherit;
    --color-button-ghost-background-hover: inherit;
    --color-button-ghost-background-focus: inherit;
    --color-button-ghost-background-active: inherit;
    --color-text-muted: inherit;
  }
}
```

> Background color/gradient shift · Border animation

### `@keyframes globalNavigation_navBgVarHeroExit__Kk6M2`

```css
@keyframes globalNavigation_navBgVarHeroExit__Kk6M2 {
  0% {
    --campaign-nav-bg: var(--color-campaigns-agents-launch-blue-900);
  }
  100% {
    --campaign-nav-bg: var(--color-background-base);
  }
}
```

### `@keyframes globalNavigation_logoFillHeroExit__liWYo`

```css
@keyframes globalNavigation_logoFillHeroExit__liWYo {
  0% {
    --notion-logo-fill: var(--color-campaigns-agents-launch-blue-900);
  }
  100% {
    --notion-logo-fill: var(--color-black);
  }
}
```

### `@keyframes globalNavigation_navBgScrolled__qcb4e`

```css
@keyframes globalNavigation_navBgScrolled__qcb4e {
  0% {
    --campaign-nav-bg: transparent;
  }
  100% {
    --campaign-nav-bg: var(--color-campaigns-agents-launch-blue-900);
  }
}
```

### `@keyframes globalNavigation_thinkTogetherNavTokensHeroExit__P9vdt`

```css
@keyframes globalNavigation_thinkTogetherNavTokensHeroExit__P9vdt {
  0% {
    --color-text-normal: var(--color-gray-200);
    --color-text-muted: var(--color-alpha-white-700);
    --color-background-base-hover: var(--color-alpha-white-100);
    --color-border-base: var(--color-alpha-white-200);
    --color-button-primary-text: var(--color-white);
    --color-button-primary-background: var(--color-blue-500);
    --color-button-primary-background-hover: var(--color-blue-400);
    --color-button-primary-background-focus: var(--color-blue-400);
    --color-button-primary-background-active: var(--color-blue-400);
    --color-button-ghost-text: var(--color-white);
    --color-button-ghost-background: var(--color-transparent);
    --color-button-ghost-background-hover: var(--color-alpha-white-100);
    --color-button-ghost-background-focus: var(--color-alpha-white-100);
    --color-button-ghost-background-active: var(--color-alpha-white-200);
  }
  100% {
    --color-text-normal: inherit;
    --color-text-muted: inherit;
    --color-background-base-hover: inherit;
    --color-border-base: inherit;
    --color-button-primary-text: inherit;
    --color-button-primary-background: inherit;
    --color-button-primary-background-hover: inherit;
    --color-button-primary-background-focus: inherit;
    --color-button-primary-background-active: inherit;
    --color-button-ghost-text: inherit;
    --color-button-ghost-background: inherit;
    --color-button-ghost-background-hover: inherit;
    --color-button-ghost-background-focus: inherit;
    --color-button-ghost-background-active: inherit;
  }
}
```

> Background color/gradient shift · Border animation

### `@keyframes globalNavigation_thinkTogetherNavBgHeroExit__vSKro`

```css
@keyframes globalNavigation_thinkTogetherNavBgHeroExit__vSKro {
  0% {
    --hero-nav-bg: var(--color-gray-900);
  }
  100% {
    --hero-nav-bg: var(--color-white);
  }
}
```

### `@keyframes globalNavigation_thinkTogetherLogoFillHeroExit__33UgN`

```css
@keyframes globalNavigation_thinkTogetherLogoFillHeroExit__33UgN {
  0% {
    --notion-logo-fill: var(--color-gray-900);
  }
  100% {
    --notion-logo-fill: var(--color-black);
  }
}
```

### `@keyframes globalNavigation_thinkTogetherNavBgScrolled__HeD6_`

```css
@keyframes globalNavigation_thinkTogetherNavBgScrolled__HeD6_ {
  0% {
    --hero-nav-bg: transparent;
  }
  100% {
    --hero-nav-bg: var(--color-gray-900);
  }
}
```

### `@keyframes globalNavigation_devPlatformNavTokensHeroExit__wdo2n`

```css
@keyframes globalNavigation_devPlatformNavTokensHeroExit__wdo2n {
  0% {
    --color-interaction-focus-ring: var(--color-campaigns-dev-platform-dos-alpha-white);
    --color-text-normal: var(--color-white);
    --color-text-muted: var(--color-alpha-white-700);
    --color-border-base: var(--color-alpha-white-200);
    --color-background-base-hover: var(--color-alpha-white-100);
    --color-button-primary-text: var(--color-campaigns-dev-platform-dos-blue);
    --color-button-primary-background: var(--color-campaigns-dev-platform-dos-white);
    --color-button-primary-background-hover: var(--color-campaigns-dev-platform-dos-alpha-white);
    --color-button-primary-background-focus: var(--color-campaigns-dev-platform-dos-alpha-white);
    --color-button-primary-background-active: var(--color-campaigns-dev-platform-dos-alpha-white);
    --color-button-ghost-text: var(--color-white);
    --color-button-ghost-background-hover: var(--color-alpha-white-200);
    --color-button-ghost-background-focus: var(--color-alpha-white-200);
    --color-button-ghost-background-active: var(--color-alpha-white-200);
    --color-nav-text: var(--color-white);
    --color-nav-bracket: var(--color-campaigns-dev-platform-dos-alpha-gray);
    --color-nav-letter-hint: var(--color-campaigns-dev-platform-dos-alpha-white);
  }
  100% {
    --color-interaction-focus-ring: var(--color-campaigns-dev-platform-dos-alpha-blue);
    --color-text-normal: var(--color-campaigns-dev-platform-dos-alpha-blue);
    --color-text-muted: var(--color-campaigns-dev-platform-dos-alpha-blue);
    --color-border-base: inherit;
    --color-background-base-hover: inherit;
    --color-button-primary-text: var(--color-white);
    --color-button-primary-background: var(--color-campaigns-dev-platform-dos-blue);
    --color-button-primary-background-hover: var(--color-campaigns-dev-platform-dos-black);
    --color-button-primary-background-focus: var(--color-campaigns-dev-platform-dos-black);
    --color-button-primary-background-active: var(--color-campaigns-dev-platform-dos-black);
    --color-button-ghost-text: inherit;
    --color-button-ghost-background-hover: inherit;
    --color-button-ghost-background-focus: inherit;
    --color-button-ghost-background-active: inherit;
    --color-nav-text: var(--color-campaigns-dev-platform-dos-blue);
    --color-nav-bracket: var(--color-campaigns-dev-platform-dos-alpha-blue);
    --color-nav-letter-hint: var(--color-campaigns-dev-platform-dos-blue);
  }
}
```

> Background color/gradient shift · Border animation

### `@keyframes globalNavigation_devPlatformNavBgHeroExit__Pir6F`

```css
@keyframes globalNavigation_devPlatformNavBgHeroExit__Pir6F {
  0% {
    --dev-platform-nav-bg: transparent;
  }
  100% {
    --dev-platform-nav-bg: var(--color-background-base);
  }
}
```

### `@keyframes globalNavigation_devPlatformNavBgScrolled__1YsK_`

```css
@keyframes globalNavigation_devPlatformNavBgScrolled__1YsK_ {
  0% {
    --dev-platform-nav-bg: transparent;
  }
  100% {
    --dev-platform-nav-bg: var(--color-campaigns-dev-platform-dos-blue);
  }
}
```

### `@keyframes homepageLogoWall_revealStickyBar__Glf7s`

```css
@keyframes homepageLogoWall_revealStickyBar__Glf7s {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
```

> Opacity fade

### `@keyframes Agent_agentEnter__D6zdB`

```css
@keyframes Agent_agentEnter__D6zdB {
  0% {
    translate: var(--translate-agent-start);
    transform: rotate(var(--rotate-agent-start));
  }
  100% {
    translate: 0px;
    transform: rotate(0deg);
  }
}
```

> Transform/motion animation

### `@keyframes Agent_agentScroll__R_Ymn`

```css
@keyframes Agent_agentScroll__R_Ymn {
  0% {
    translate: 0px;
    transform: rotate(0deg);
  }
  100% {
    translate: var(--translate-agent-end);
    transform: rotate(var(--rotate-agent-end));
  }
}
```

> Transform/motion animation

### `@keyframes Agent_agentTaskEnter__ZpDY1`

```css
@keyframes Agent_agentTaskEnter__ZpDY1 {
  0% {
    translate: var(--translate-task-start);
    transform: rotate(var(--rotate-task-start));
  }
  100% {
    translate: var(--translate-task);
    transform: rotate(var(--rotate-task));
  }
}
```

> Transform/motion animation

### `@keyframes Agent_agentTaskScroll__bimxl`

```css
@keyframes Agent_agentTaskScroll__bimxl {
  0% {
    translate: 0px;
    transform: rotate(0deg);
  }
  100% {
    translate: var(--translate-task-end);
    transform: rotate(var(--rotate-task-end));
  }
}
```

> Transform/motion animation

### `@keyframes Agent_agentMarkEnter__54wKq`

```css
@keyframes Agent_agentMarkEnter__54wKq {
  0% {
    translate: var(--translate-mark-start);
    transform: rotate(var(--rotate-mark-start));
  }
  100% {
    translate: var(--translate-mark);
    transform: rotate(var(--rotate-mark));
  }
}
```

> Transform/motion animation

### `@keyframes Agent_agentMarkScroll__8jDZS`

```css
@keyframes Agent_agentMarkScroll__8jDZS {
  0% {
    translate: 0px;
    transform: rotate(0deg);
  }
  100% {
    translate: var(--translate-mark-end);
    transform: rotate(var(--rotate-mark-end));
  }
}
```

> Transform/motion animation

### `@keyframes Agent_notifCountScroll__2TpV_`

```css
@keyframes Agent_notifCountScroll__2TpV_ {
  0% {
    --notif-step: 0;
  }
  100% {
    --notif-step: 7;
  }
}
```

### `@keyframes Agent_notifCountScrollFast__Ty0lv`

```css
@keyframes Agent_notifCountScrollFast__Ty0lv {
  0% {
    --notif-step: 0;
  }
  100% {
    --notif-step: 14;
  }
}
```

### `@keyframes Illustrations_rotate__NJalO`

```css
@keyframes Illustrations_rotate__NJalO {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(var(--rotate-end));
  }
}
```

> Transform/motion animation

### `@keyframes Illustrations_rotateEnter__XYlPM`

```css
@keyframes Illustrations_rotateEnter__XYlPM {
  0% {
    transform: rotate(var(--rotate-start));
  }
  100% {
    transform: rotate(0deg);
  }
}
```

> Transform/motion animation

### `@keyframes HomepageHeroAgents_flicker-on__xJ_1J`

```css
@keyframes HomepageHeroAgents_flicker-on__xJ_1J {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

> Opacity fade

### `@keyframes HomepageHeroAgents_flicker__k9DWp`

```css
@keyframes HomepageHeroAgents_flicker__k9DWp {
  0%, 100% {
    opacity: 1;
  }
  12%, 13.2% {
    opacity: 1;
  }
  12.2% {
    opacity: 0.7;
  }
  12.5% {
    opacity: 0.92;
  }
  12.7% {
    opacity: 0.65;
  }
  13% {
    opacity: 0.9;
  }
  32%, 32.8% {
    opacity: 1;
  }
  32.3% {
    opacity: 0.75;
  }
  32.5% {
    opacity: 0.88;
  }
  55%, 56.5% {
    opacity: 1;
  }
  55.2% {
    opacity: 0.8;
  }
  55.5% {
    opacity: 0.6;
  }
  55.8% {
    opacity: 0.85;
  }
  56% {
    opacity: 0.7;
  }
  56.3% {
    opacity: 0.92;
  }
  77%, 77.6% {
    opacity: 1;
  }
  77.2% {
    opacity: 0.68;
  }
  77.4% {
    opacity: 0.9;
  }
  92%, 92.5% {
    opacity: 1;
  }
  92.2% {
    opacity: 0.78;
  }
}
```

> Opacity fade

### `@keyframes HomepageHeroAgents_fade-in__HBybG`

```css
@keyframes HomepageHeroAgents_fade-in__HBybG {
  0% {
    opacity: var(--opacity-start);
  }
  100% {
    opacity: var(--opacity-end);
  }
}
```

> Opacity fade

### `@keyframes homepage_bodyBgHeroExit__Ur0t_`

```css
@keyframes homepage_bodyBgHeroExit__Ur0t_ {
  0% {
    background-color: var(--color-gray-900);
  }
  100% {
    background-color: rgba(0, 0, 0, 0);
  }
}
```

> Background color/gradient shift · Text color shift

### `@keyframes Marquee_marqueeFrames__WsEH6`

```css
@keyframes Marquee_marqueeFrames__WsEH6 {
  0% {
    transform: translateX(0px);
  }
  100% {
    transform: translateX(calc(-50% - var(--marquee-item-gap) / 2));
  }
}
```

> Transform/motion animation

## Motion Tokens (CSS Variables)

### Duration Tokens

```css
--motion-duration-100: 100ms;
--motion-duration-150: 150ms;
--motion-duration-200: 200ms;
--motion-duration-250: 250ms;
--motion-duration-300: 300ms;
--motion-global-fade-out-duration: 200ms;
--motion-global-transform-duration: 300ms;
--motion-global-fade-in-duration: 150ms;
```

### Easing Tokens

```css
--motion-timing-function-ease-in-out-quint: cubic-bezier(0.86,0,0.07,1);
--motion-timing-function-ease-in-out-quart: cubic-bezier(0.76,0,0.24,1);
--motion-timing-function-ease-in-out-quad: cubic-bezier(0.45,0,0.55,1);
--motion-timing-function-ease-in-out-cubic: cubic-bezier(0.645,0.045,0.355,1);
--motion-timing-function-ease-in-out-linear: cubic-bezier(0.5,0,0.5,1);
--motion-timing-function-ease-in: cubic-bezier(0.42,0,1,1);
--motion-timing-function-ease-out: cubic-bezier(0,0,0.58,1);
--motion-timing-function-linear: cubic-bezier(0,0,1,1);
--motion-global-transform-timing-function: cubic-bezier(0.86,0,0.07,1);
--motion-global-fade-out-timing-function: cubic-bezier(0.42,0,1,1);
--motion-global-fade-in-timing-function: cubic-bezier(0,0,0.58,1);
```

## Global Transition Declarations

These `transition` values were extracted from CSS rules across the site:

```css
transition: background 0.15s;
transition: transform 0.3s;
transition: box-shadow var(--motion-global-fade-out-duration) var(--motion-global-fade-out-timing-function);
transition: background-color 0.15s;
transition: opacity 0.25s ease-out, transform 0.25s ease-out, visibility 0.25s ease-out;
transition: opacity 0.15s ease-in 50ms, transform 0.15s ease-in, visibility 0.15s ease-in;
transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
transition: transform 175ms ease-in 0.15s;
transition: opacity 0.4s ease-out;
transition: opacity 0.15s ease-in;
transition: background 75ms linear;
transition: opacity 0.15s ease-in-out;
```

## How to Recreate This Motion Design

### Step 1 — Install Dependencies

```bash
```

### Step 2 — Scroll-Reveal Pattern

Elements that animate into view follow this pattern:

```css
/* Initial hidden state */
.reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 100ms cubic-bezier(0.86,0,0.07,1),
              transform 100ms cubic-bezier(0.86,0,0.07,1);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

### Step 3 — Key Motion Principles

- **Video backgrounds** — use `<video autoplay loop muted playsinline>` for background videos. Always include a poster image fallback
- **Duration scale:** `100ms` · `150ms` · `200ms` · `250ms` · `300ms` · `0.15s` · `0.3s` · `0.25s` — use these values, never invent new durations
- **Always add** `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`

### Step 4 — Scroll Journey Reference

Match what happens at each scroll position:

- **0%** (`0px`) → `screens/scroll/scroll-000.png`
- **17%** (`949px`) → `screens/scroll/scroll-017.png`
- **33%** (`1843px`) → `screens/scroll/scroll-033.png`
- **50%** (`2792px`) → `screens/scroll/scroll-050.png`
- **67%** (`3741px`) → `screens/scroll/scroll-067.png`
- **83%** (`4635px`) → `screens/scroll/scroll-083.png`
- **100%** (`5584px`) → `screens/scroll/scroll-100.png`

