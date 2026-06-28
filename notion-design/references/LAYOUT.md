# Layout Reference

> Auto-extracted from live DOM. Use this to understand how the site is structured spatially.

## Spacing System

**Base grid:** 4px

**Scale:** `2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30` px

| Spacing | Semantic Use |
|---------|-------------|
| 4px | Tight — within a component |
| 8px | Medium — between sibling items |
| 16px | Wide — between sections |
| 32px | Vast — major section breaks |

## Flex Layouts

| Element | Direction | Justify | Align | Gap | Children |
|---------|-----------|---------|-------|-----|----------|
| `nav.footer_footerInner__MQQSo` | row | — | — | 24px | 2 |
| `div.flex.flex-col` | column | center | center | 12px | 2 |
| `div.flex.flex-col` | row | center | center | 12px | 2 |
| `section#_R_4n59bm_.bentos_bentoSection__5jULI` | column | — | — | 32px | 2 |
| `section#_R_4n59bmH1_.bentos_bentoSection__5jULI` | column | — | — | 32px | 2 |
| `div.flex.flex-row` | row | center | center | 0px | 7 |
| `ul.flex.flex-col` | column | start | stretch | 0px | 7 |
| `ul.flex.flex-col` | column | start | stretch | 0px | 5 |
| `ul.flex.flex-col` | column | start | stretch | 0px | 8 |
| `ul.flex.flex-col` | column | start | stretch | 0px | 5 |
| `section.homepageBentoCarousel_root__XEVDN` | column | — | — | 32px | 2 |
| `div.flex.flex-col` | column | start | stretch | 16px | 4 |
| `div.flex.flex-col` | column | start | stretch | 8px | 2 |
| `div.flex.flex-col` | row | start | stretch | 8px | 5 |

## Grid Layouts

| Element | Template Columns | Gap | Children |
|---------|-----------------|-----|----------|
| `nav.globalNavigation_globalNavigation__7c1YP` | `1440px` | — | 1 |
| `div.heroGrid_heroGrid__v65U8` | `[full-bleed-start] 30px [full-start] 64px [content` | — | 5 |
| `div.globalNavigation_container__x43sE` | `328.375px 703.25px 328.375px` | 16px | 3 |
| `div.socialProofV2_cards__SRQPo` | `393.594px 393.609px 393.594px` | 24px | 3 |

## Structural Containers

### `<main>` (`main.layout_main__LAl4b.layout_withoutPadding__qQ631`)

```
display:          block
children:         4
```

### `<footer>` (`footer.surface.surfaceBase`)

```
display:          block
children:         1
```

### `<nav>` (`nav.footer_footerInner__MQQSo`)

```
display:          flex
flex-direction:   row
justify-content:  —
align-items:      —
gap:              24px
padding:          80px 125px
max-width:        1502px
children:         2
```

### `<section>` (`section#_R_1bmH1_`)

```
display:          block
children:         2
```

### `<nav>` (`nav.globalNavigation_globalNavigation__7c1YP`)

```
display:          grid
grid-template-columns: 1440px
children:         1
```

### `<section>` 

```
display:          block
children:         2
```

### `<header>` (`header.homepageHeroTeamsAndAgents_contentHeader__8R13o`)

```
display:          block
children:         3
```

### `<section>` (`section#_R_4n59bm_.bentos_bentoSection__5jULI`)

```
display:          flex
flex-direction:   column
justify-content:  —
align-items:      —
gap:              32px
children:         2
```

### `<section>` (`section#_R_4n59bmH1_.bentos_bentoSection__5jULI`)

```
display:          flex
flex-direction:   column
justify-content:  —
align-items:      —
gap:              32px
children:         2
```

### `<section>` (`section.homepageBentoCarousel_root__XEVDN`)

```
display:          flex
flex-direction:   column
justify-content:  —
align-items:      —
gap:              32px
children:         2
```

### `<section>` (`section#_R_in59bm_`)

```
display:          block
children:         1
```

### `<section>` (`section.bentoCarousel_bentoCarousel__QXKNe`)

```
display:          block
children:         1
```

## Layout Rules

- **Container max-width:** `1502px` — always center with `margin: auto`
- Primary layout system: **Flexbox**
- Secondary layout system: **CSS Grid** (used for card grids and multi-column layouts)
- Every spacing value must be a multiple of **4px**
- Never use arbitrary margin/padding values outside the spacing scale

