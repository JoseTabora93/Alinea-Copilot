# Theme Tokens Reference / 主题语义 Token 参考

This is the canonical list of semantic design tokens used by Alinea Copiloto's theming system.
A **Theme** (`packages/desktop/src/common/theme/types.ts`) can override any of these via its
optional `tokens` map, or via raw `css`. Built-in `Light`/`Dark` rely on the base stylesheet
below (driven by `appearance` → `data-theme`); decorative & user themes use `css`.

> **Esquema actual: Alinea — Verde Sabio (Sage Green).** Los valores reales y **única fuente de
> verdad** están en `packages/desktop/src/renderer/styles/themes/default-color-scheme.css`. Las
> tablas de abajo reflejan esa paleta. Como todo componente usa tokens semánticos (vía UnoCSS),
> **toda la app sigue estos colores automáticamente** — no hay colores hardcodeados de marca.

## 🎨 White-label / Rebranding para otro cliente

Para cambiar la marca a otro cliente, **edita un solo archivo**:
`packages/desktop/src/renderer/styles/themes/default-color-scheme.css` (bloques `:root` light y
`[data-theme='dark']`). Cambia estos grupos de tokens y **toda la UI** (botones, acentos, KB,
Command Center, sidebar, etc.) se actualiza sola, porque todo consume estos tokens:

| Cambia esto                                                   | Para…                                                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `--aou-1 … --aou-10`                                          | La rampa de marca (10 pasos): superficies tintadas, barra de agentes, acentos                 |
| `--primary` (y `--info`)                                      | Color de acción/acento principal (botones, foco, activos)                                     |
| `--brand`, `--brand-light`, `--brand-hover`                   | Acentos de marca (logo-adyacentes, hovers de marca)                                           |
| `--bg-base … --bg-10`, `--bg-hover`, `--bg-active`            | Escala de superficies/fondos neutros                                                          |
| `--text-primary`, `--text-secondary`, `--text-disabled`       | Jerarquía de texto                                                                            |
| `--border-base`, `--border-light`                             | Bordes/divisores                                                                              |
| `--message-*`, `--workspace-btn-bg`, `--color-guid-agent-bar` | Tintes de componentes específicos                                                             |
| Logo/assets                                                   | `packages/desktop/src/renderer/assets/logos/brand/*` (mark/icon/pattern) + PWA `public/pwa/*` |

**Recomendación:** mantener los grupos coherentes (p. ej. `--primary` = `--brand` = `--aou-5`). Para
probar un cliente sin tocar el base, se puede crear un **Theme** con `tokens` (ver "Authoring a theme").
Regla de oro (AGENTS.md): **nunca** hardcodear colores en componentes; usar siempre tokens/clases UnoCSS.

> 这是 AionUi 主题系统的语义 Token 权威清单。一个 **Theme** 可以通过可选的 `tokens` 映射
> 或 `css` 字段覆盖这些变量。内置 `Light`/`Dark` 依赖下面的基底样式表(由 `appearance` →
> `data-theme` 驱动);装饰主题与用户主题用 `css` 字段。

## How tokens are applied / Token 如何生效

- **Source of truth (base values):** `packages/desktop/src/renderer/styles/themes/default-color-scheme.css`
  - `:root, [data-color-scheme='default']` → light values
  - `[data-color-scheme='default'][data-theme='dark']` → dark values
- **`appearance`** (`'light' | 'dark'`) on the active theme sets `<html data-theme>` + `<body arco-theme>`, which selects the light/dark block above.
- **`theme.tokens`** (optional): `applyTheme()` writes them into `<style id="theme-tokens">:root { … }</style>`. Keys MUST include the `--` prefix, e.g. `{ "--primary": "#7c3aed" }`.
- **`theme.css`** (optional): raw decoration CSS injected as `<style id="theme-decoration">` (auto `!important`). Used by decorative presets & user themes.
- **UnoCSS bridge:** utility classes map to these vars (e.g. `bg-1` → `background: var(--bg-1)`, `text-t-secondary` → `var(--text-secondary)`), wired in `uno.config.ts`. Override a token and every utility/component using it follows.

A token written without an explicit dark value inherits whatever the base dark block defines; override both `:root` and `[data-theme='dark']` in `css` if a decorative theme needs distinct dark values.

## Token catalogue / Token 清单

### Brand palette / 品牌色阶 (`--aou-*`)

A 10-step brand ramp (light→dark in light mode; the ramp **inverts** in dark mode so `--aou-1` is darkest). Used for brand-tinted surfaces, the home Agent bar, accents.

_Paleta Alinea — Verde Sabio. La rampa **se invierte** en dark (aou-1 = más oscuro)._

| Token      | Light     | Dark      | Purpose / 用途                        |
| ---------- | --------- | --------- | ------------------------------------- |
| `--aou-1`  | `#f2f3ef` | `#282d2a` | Lightest brand tint / surface wash    |
| `--aou-2`  | `#e5e7df` | `#343b37` | Brand tint (home Agent bar dark base) |
| `--aou-3`  | `#d1d5c8` | `#4a5248` | Brand tint                            |
| `--aou-4`  | `#b8beaa` | `#606a5e` | Brand tint                            |
| `--aou-5`  | `#a6ad95` | `#7a8573` | Brand mid (Verde Sabio = `--brand`)   |
| `--aou-6`  | `#8d9480` | `#a6ad95` | Brand base                            |
| `--aou-7`  | `#6e7864` | `#b8beaa` | Brand strong                          |
| `--aou-8`  | `#505947` | `#d1d5c8` | Brand strong                          |
| `--aou-9`  | `#333a2e` | `#e5e7df` | Brand darkest tint                    |
| `--aou-10` | `#1a1f17` | `#f2f3ef` | Brand extreme                         |

### Backgrounds / 背景 (`--bg-*`)

Layered surface scale — higher number = stronger/darker separation in light mode.

| Token         | Light     | Dark      | Purpose / 用途                                   |
| ------------- | --------- | --------- | ------------------------------------------------ |
| `--bg-base`   | `#ffffff` | `#1e2226` | App primary background (bg-0) — Blanco Papel     |
| `--bg-1`      | `#f2f1ec` | `#282d31` | Secondary surface — Arena Suave / sidebar (dark) |
| `--bg-2`      | `#e8e7e1` | `#333940` | Tertiary surface (nested cards, active line)     |
| `--bg-3`      | `#d8d7d1` | `#3f464e` | Borders / dividers / 边框分隔                    |
| `--bg-4`      | `#c0bfb9` | `#4d5560` | Stronger divider / muted fill                    |
| `--bg-5`      | `#a8a7a1` | `#5c6470` | Muted element                                    |
| `--bg-6`      | `#88877f` | `#6b7480` | Disabled / secondary text on fills / 禁用        |
| `--bg-8`      | `#585751` | `#8f9aa6` | Strong neutral                                   |
| `--bg-9`      | `#282d31` | `#b8c0c8` | Near-inverse neutral (Gris Profundo)             |
| `--bg-10`     | `#141719` | `#e0e4e8` | Extreme neutral                                  |
| `--bg-hover`  | `#edecea` | `#2f3438` | Hover background (between bg-1/bg-2) / 悬停      |
| `--bg-active` | `#d8d7d1` | `#3a4248` | Active / pressed background / 激活按下           |

### Text / 文字 (`--text-*`, `--color-text-1`)

| Token              | Light     | Dark      | Purpose / 用途                                                                 |
| ------------------ | --------- | --------- | ------------------------------------------------------------------------------ |
| `--text-primary`   | `#1a1f17` | `#f2f3ef` | Primary text / 主要文字                                                        |
| `--color-text-1`   | `#1a1f17` | `#f2f3ef` | Arco primary text — kept aligned with `--text-primary`                         |
| `--text-secondary` | `#454d3f` | `#b8c0c8` | Secondary text / 次要文字                                                      |
| `--text-disabled`  | `#c0bfb9` | `#5c6470` | Disabled text / 禁用文字                                                       |
| `--text-0`         | `#1a1f17` | `#f2f3ef` | "Pure black" text — flips in dark / 纯黑文字 · ⚠️ legacy; use `--text-primary` |
| `--text-white`     | `#ffffff` | `#ffffff` | Always-white text (on colored fills) / 纯白文字                                |

### Semantic state / 语义状态

| Token       | Light     | Dark      | Purpose / 用途                                                                          |
| ----------- | --------- | --------- | --------------------------------------------------------------------------------------- |
| `--primary` | `#a6ad95` | `#b8beaa` | Primary action / accent — **Verde Sabio** / 主色                                        |
| `--success` | `#00b42a` | `#23c343` | Success / 成功                                                                          |
| `--warning` | `#ff7d00` | `#ff9a2e` | Warning / 警告                                                                          |
| `--danger`  | `#f53f3f` | `#f76560` | Error / destructive / 危险                                                              |
| `--info`    | `#a6ad95` | `#b8beaa` | Informational (= primary) / 信息 · ⚠️ **currently unused** — components use `--primary` |

### Borders / 边框

| Token              | Light         | Dark      | Purpose / 用途                                                                               |
| ------------------ | ------------- | --------- | -------------------------------------------------------------------------------------------- |
| `--border-base`    | `#d8d7d1`     | `#3f464e` | Default border / 基础边框                                                                    |
| `--border-light`   | `#e8e7e1`     | `#333940` | Subtle border / 浅色边框                                                                     |
| `--border-special` | `var(--bg-3)` | `#4d5560` | Emphasized/special border / 特殊边框 · ⚠️ **currently unused** (legacy; use `--border-base`) |

### Brand accents / 品牌强调

| Token           | Light     | Dark      | Purpose / 用途                           |
| --------------- | --------- | --------- | ---------------------------------------- |
| `--brand`       | `#a6ad95` | `#a6ad95` | Brand color — **Verde Sabio**            |
| `--brand-light` | `#f2f3ef` | `#343b37` | Brand-tinted background / 品牌浅(深)背景 |
| `--brand-hover` | `#b8beaa` | `#7a8573` | Brand hover / 品牌悬停                   |

### Fills & inverse / 填充与反色

| Token                   | Light     | Dark                     | Purpose / 用途                             |
| ----------------------- | --------- | ------------------------ | ------------------------------------------ |
| `--fill`                | `#f7f7f4` | `#1e2226`                | Generic fill / 填充                        |
| `--fill-0`              | `#ffffff` | `rgba(255,255,255,0.08)` | Fill level 0 (translucent in dark) / 填充0 |
| `--fill-white-to-black` | `#ffffff` | `#000000`                | Surface that flips white↔black by mode     |
| `--dialog-fill-0`       | `#ffffff` | `#3f464e`                | Dialog/modal fill / 对话框填充             |
| `--inverse`             | `#ffffff` | `#f2f3ef`                | Inverse (black/white switch) / 反色        |

### Component-specific / 组件专用

| Token                    | Light     | Dark           | Purpose / 用途                                         |
| ------------------------ | --------- | -------------- | ------------------------------------------------------ |
| `--message-user-bg`      | `#edf0e8` | `#2a3230`      | User chat bubble background (sage tint) / 用户消息气泡 |
| `--message-tips-bg`      | `#f0f2ec` | `#252d2b`      | Tip/notice background / 提示信息背景                   |
| `--workspace-btn-bg`     | `#eeede8` | `#2a2f33`      | Workspace button background / 工作区按钮               |
| `--color-guid-agent-bar` | `#edf0e8` | `var(--aou-2)` | Home Agent-selector bar background / 首页 Agent 选择条 |

### Arco `--color-*` aliases / Arco 别名

Arco Design components read their own `--color-*` variables (e.g. `--color-bg-1`, `--color-primary`,
`--color-primary-light-1..3`, `--color-border`, `--color-fill`). The built-in/decorative presets map
these to the semantic tokens above (see `presets/default.css` and `styles/arco-override.css`). A full
token theme that wants Arco components to follow it should also set the relevant `--color-*` aliases.

## How tokens are consumed in the codebase / 代码里如何使用

Most components do **not** write `var(--token)` directly — they use **UnoCSS utility classes**
(wired in `uno.config.ts`). So a low raw-`var()` count does NOT mean a token is unused. Mapping:

| Token(s)                                                     | UnoCSS class(es)                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `--bg-base`, `--bg-1..10`                                    | `bg-base`/`bg-1`…`bg-10` and `border-base`/`border-1`…`border-10` |
| `--bg-hover`, `--bg-active`                                  | `bg-hover`, `bg-active`                                           |
| `--text-primary`                                             | `text-t-primary`                                                  |
| `--text-secondary`                                           | `text-t-secondary`                                                |
| `--bg-6` (as tertiary text)                                  | `text-t-tertiary`                                                 |
| `--text-disabled`                                            | `text-t-disabled`                                                 |
| `--primary`/`--success`/`--warning`/`--danger`/`--info`      | `bg-primary`/`text-primary`/`border-primary`, …                   |
| `--border-base`, `--border-light`                            | `border-b-base`, `border-b-light`                                 |
| `--brand`, `--brand-light`, `--brand-hover`                  | `bg-brand`, `bg-brand-light`, `bg-brand-hover`                    |
| `--aou-1..10`                                                | `bg-aou-1`…, `text-aou-1`…, `border-aou-1`…                       |
| `--message-user-bg`/`--message-tips-bg`/`--workspace-btn-bg` | `bg-message-user`/`bg-message-tips`/`bg-workspace-btn`            |
| `--fill`, `--inverse`                                        | `bg-fill`/`text-fill`, `bg-inverse`/`text-inverse`                |
| `--color-text-1..4` (Arco)                                   | `text-1`…`text-4` (custom rule)                                   |

Override a token (via `tokens` or `css`) and every utility/component using it follows automatically.

## Actual usage at a glance / 实际用量

Measured across `packages/desktop/src/renderer` (raw `var()` + UnoCSS class references):

- **Heavy** — used everywhere: `--text-primary`, `--text-secondary`, `--color-text-1`, `--bg-1`, `--bg-2`, `--bg-3`, `--bg-base`, `--bg-6` (as tertiary text), `--border-base`, `--fill`, `--primary`, `--success`/`--warning`/`--danger`.
- **Moderate** — real but scoped scenarios: `--aou-1..10` (brand surfaces, home Agent bar), `--bg-4/5/8/9/10` (neutral ramp, scrollbars, disabled/high-contrast), `--bg-hover`/`--bg-active` (interaction states), `--message-user-bg`/`--message-tips-bg`/`--workspace-btn-bg` (chat & workspace), `--brand`/`--brand-light`/`--brand-hover`, `--inverse`, `--dialog-fill-0`, `--text-white`, `--text-disabled`, `--border-light`, `--fill-white-to-black`, `--color-guid-agent-bar`.
- **Currently unused (legacy, kept for compatibility — see ⚠️ rows above):** `--info` (components use `--primary`), `--text-0` (use `--text-primary`), `--border-special` (use `--border-base`). Safe to prune in a future cleanup; harmless to leave.

> A theme author only needs to set the tokens relevant to the surfaces they care about; unset tokens fall back to the base stylesheet values.

## Authoring a theme / 编写主题

**Token-based (structured):**

```json
{
  "id": "violet",
  "name": "Violet",
  "appearance": "light",
  "builtin": false,
  "created_at": 0,
  "updated_at": 0,
  "tokens": {
    "--primary": "#7c3aed",
    "--bg-1": "#faf5ff",
    "--text-primary": "#2e1065",
    "--color-primary": "#7c3aed"
  }
}
```

**CSS-based (escape hatch — fonts, background images, pseudo-elements):**

```json
{
  "id": "my-skin",
  "name": "My Skin",
  "appearance": "dark",
  "builtin": false,
  "created_at": 0,
  "updated_at": 0,
  "css": ":root{ --primary: #ff85a2; } body{ font-family: 'Varela Round'; }"
}
```

User themes created in **Settings → Appearance → 手动添加** are always CSS-based (`tokens` omitted).
