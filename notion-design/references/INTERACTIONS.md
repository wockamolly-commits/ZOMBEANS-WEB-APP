# Interaction Reference

> Micro-interactions extracted from live DOM. Recreate these exactly for authentic feel.

## Coverage

| Component Type | Count | States Captured |
|----------------|-------|----------------|
| Button | 3 | default, hover, focus |
| Link | 3 | default, hover, focus |

## Transition System

These transition declarations were extracted from interactive elements:

```css
transition: background-color 0.15s;
transition: all;
```

Apply these to all interactive elements. Never invent new durations or easings.

## Button Interactions

### Button 1 — `Product`

**States:**

- Default: `../screens/states/button-1-default.png`
- Hover: `../screens/states/button-1-hover.png`
- Focus: `../screens/states/button-1-focus.png`

**On hover:**

```css
/* background-color: rgba(0, 0, 0, 0) → */ background-color: rgba(0, 0, 0, 0.05);
```

**On focus:**

```css
/* outline: rgba(255, 255, 255, 0) solid 2px → */ outline: rgb(0, 117, 222) solid 2px;
/* outline-color: rgba(255, 255, 255, 0) → */ outline-color: rgb(0, 117, 222);
```

**Transition:** `background-color 0.15s`

### Button 2 — `Solutions`

**States:**

- Default: `../screens/states/button-2-default.png`
- Hover: `../screens/states/button-2-hover.png`
- Focus: `../screens/states/button-2-focus.png`

**On hover:**

```css
/* background-color: rgba(0, 0, 0, 0) → */ background-color: rgba(0, 0, 0, 0.05);
```

**On focus:**

```css
/* outline: rgba(255, 255, 255, 0) solid 2px → */ outline: rgb(0, 117, 222) solid 2px;
/* outline-color: rgba(255, 255, 255, 0) → */ outline-color: rgb(0, 117, 222);
```

**Transition:** `background-color 0.15s`

### Button 3 — `Resources`

**States:**

- Default: `../screens/states/button-3-default.png`
- Hover: `../screens/states/button-3-hover.png`
- Focus: `../screens/states/button-3-focus.png`

**On hover:**

```css
/* background-color: rgba(0, 0, 0, 0) → */ background-color: rgba(0, 0, 0, 0.05);
```

**On focus:**

```css
/* outline: rgba(255, 255, 255, 0) solid 2px → */ outline: rgb(0, 117, 222) solid 2px;
/* outline-color: rgba(255, 255, 255, 0) → */ outline-color: rgb(0, 117, 222);
```

**Transition:** `background-color 0.15s`

## Link Interactions

### Link 1 — `Notion – Home`

**States:**

- Default: `../screens/states/link-1-default.png`
- Hover: `../screens/states/link-1-hover.png`
- Focus: `../screens/states/link-1-focus.png`

**On focus:**

```css
/* outline: rgba(255, 255, 255, 0) solid 2px → */ outline: rgb(0, 117, 222) solid 2px;
/* outline-color: rgba(255, 255, 255, 0) → */ outline-color: rgb(0, 117, 222);
/* transition: all → */ transition: outline-color 0.15s cubic-bezier(0, 0, 0.58, 1);
```

**Transition:** `all`

### Link 2 — `a`

**States:**

- Default: `../screens/states/link-2-default.png`
- Hover: `../screens/states/link-2-hover.png`
- Focus: `../screens/states/link-2-focus.png`

**Transition:** `all`

_No visible style changes detected for this element._

### Link 3 — `Capture`

**States:**

- Default: `../screens/states/link-3-default.png`
- Hover: `../screens/states/link-3-hover.png`
- Focus: `../screens/states/link-3-focus.png`

**Transition:** `all`

_No visible style changes detected for this element._

## Interaction Rules

- Accent color `#0075de` is used for focus rings, active states, and hover highlights
- Hover effects include **color transitions** — use the extracted values, not approximations
- Focus states use **outline** (not box-shadow) — always match the extracted focus ring
- Transition durations in use: `0.15s`
- Always respect `prefers-reduced-motion` — set all transitions to `0s` when enabled

