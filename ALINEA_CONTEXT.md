# ALINEA COPILOTO — Project Context & Roadmap

> Documento de contexto para agentes AI (Claude Code, Cursor).
> Última actualización: Junio 2026.
> Generado a partir de la sesión de trabajo con Cursor Cloud Agent.

---

## 1. Qué es este proyecto

**Alinea Copiloto** es un fork de [AionUI](https://github.com/aionui/aionui) — una plataforma de chat con agentes AI (Hermes, OpenClaw) que se distribuye como:

- App Electron de escritorio (Windows, macOS, Linux)
- WebUI accesible por browser (modo servidor)
- App móvil con login por QR

**Empresa propietaria**: Ingelmec  
**Dominio target**: `copilot.ingelmec.ai`  
**Repositorios**:
- Frontend: `github.com/JoseTabora93/Alinea-Copilot` (Electron + Vite + React + Bun)
- Backend: `github.com/JoseTabora93/AlineaCopilot-Core` (Rust, Axum, SQLite)

**Stack técnico**:

| Capa | Tecnología |
|---|---|
| Desktop | Electron 37 |
| Renderer | React 19, Vite 6, UnoCSS, Arco Design |
| Proceso principal | Node.js / Electron main |
| Backend | Rust 1.95.0, Axum 0.8, SQLite (sqlx) |
| Runtime | Bun 1.3.14 |
| Tests | Vitest 4 (frontend), cargo test (backend) |
| Toolchain | `just push` para pre-push checks |

---

## 2. Rebranding aplicado (COMPLETADO)

Se realizó el rebranding completo de **AionUI → Alinea Copiloto** en la rama `cursor/rebranding-alinea-copiloto-1031`.

### Paleta de marca Alinea

```css
--primary:   #A6AD95   /* Verde Sabio */
--bg-dark:   #282D31   /* Gris Profundo (sidebar) */
--bg-light:  #F2F1EC   /* Arena Suave (superficie) */
--bg-white:  #FFFFFF   /* Blanco Papel */
```

**Tipografía**: Poppins (300/400/500/600) vía Google Fonts.

### Archivos modificados en el rebranding

| Archivo | Cambio |
|---|---|
| `package.json` | `name`, `description`, `productName` → Alinea Copiloto |
| `public/manifest.webmanifest` | `name`, `short_name`, `theme_color` |
| `packages/desktop/src/common/utils/appConfig.ts` | Fallback `'Alinea Copiloto'` |
| `packages/desktop/src/renderer/index.html` | `<title>`, metas, Poppins font link |
| `packages/desktop/src/renderer/styles/themes/default-color-scheme.css` | Paleta completa Sage Green (reemplaza escala púrpura AOU) |
| `packages/desktop/src/renderer/styles/arco-override.css` | Font-family Poppins, overlay colors |
| `packages/desktop/src/renderer/styles/themes/base.css` | `font-family: Poppins` |
| `packages/desktop/src/renderer/styles/markdown.css` | `.aionui-markdown` → `.alinea-markdown` |
| `packages/desktop/src/renderer/assets/logo.svg` | Logo placeholder: "ALINEA" + punto cuadrado Verde Sabio |
| `packages/desktop/src/renderer/components/base/AionModal.tsx` | CSS classes `.aionui-modal` → `.alinea-modal` |
| `packages/desktop/src/renderer/components/base/AionSteps.tsx` | `.aionui-steps` → `.alinea-steps` |
| `packages/desktop/src/renderer/components/base/ModalWrapper.tsx` | `.alinea-modal-*` |
| `packages/desktop/src/renderer/utils/workspace/workspaceEvents.ts` | Events `alinea-workspace-*` |
| `packages/desktop/src/common/api/ClientFactory.ts` | `HTTP-Referer: alinea.ai`, `X-Title: Alinea Copiloto` |
| `locales/en-US/common.json` + `zh-CN/common.json` | Tray menu, mensajes de error del backend |
| `uno.config.ts` | `fontFamily.sans: Poppins` |

### Reglas de CSS que NO cambiaron

- `.aionui-markdown` class → renombrada a `.alinea-markdown`
- Keys de localStorage `__aionui_theme` → **NO cambiar** (rompe preferencias existentes)
- Rutas de filesystem `~/.aionui*` → **NO cambiar** (rompe datos existentes)
- Nombre de paquete interno `@aionui/web-host` → **pendiente, análisis hecho** (ver sección 5)

---

## 3. Arquitectura del sistema

### Dos procesos separados (NUNCA mezclar APIs)

```
Main Process          Renderer Process
packages/desktop/     packages/desktop/
  src/process/          src/renderer/

NO DOM APIs           NO Node.js APIs
```

### Comunicación cross-process

```
Renderer → ipcBridge → httpBridge → aioncore (REST/WS)
         ↘ preload/main.ts (IPC) → Electron-only ops
```

### Base de datos

- **Motor**: SQLite via `sqlx` + `rusqlite` (en aioncore)
- **Archivo**: `<dataDir>/aionui.db`
- **Schema version**: v26 (migrations hasta `012_assistant_data_unification.sql`)
- **Migrations location**: `crates/aionui-db/migrations/`

### Tablas clave

| Tabla | Propósito |
|---|---|
| `users` | Cuentas de usuario (password_hash, jwt_secret, role, is_active) |
| `conversations` | Sesiones de chat (`user_id` FK) |
| `messages` | Mensajes (cascade vía `conversation_id`) |
| `system_settings` | Config global (una fila, id=1) |
| `providers` | API keys de IA (global, NO por usuario) |
| `mcp_servers` | Servidores MCP (global, NO por usuario) |
| `assistants` | Agentes/asistentes (global, NO por usuario) |
| `teams` | Equipos de agentes AI (NO equipos humanos) |

### Regla de tenant

> El modelo de aislamiento es **un servidor = una empresa**. Los `providers`, `mcp_servers`, `assistants` y `system_settings` son **recursos compartidos globalmente**. NUNCA agregar `user_id` a estas tablas.

---

## 4. Multi-usuario — BLOQUE 1 (IMPLEMENTADO, pendiente PR)

### Estado actual

El código fue implementado en la rama `feat/multiuser` del repo `AlineaCopilot-Core`. El push está pendiente por permisos de GitHub (requiere `GITHUB_TOKEN` inyectado en nueva sesión).

**Patch disponible** en: `Alinea-Copilot/alinea-core-multiuser.patch` (rama `cursor/rebranding-alinea-copiloto-1031`)

Para aplicar en nueva sesión:
```bash
git clone https://github.com/JoseTabora93/AlineaCopilot-Core.git
cd AlineaCopilot-Core
git checkout -b feat/multiuser
# Descargar patch desde Alinea-Copilot repo y aplicar:
git apply alinea-core-multiuser.patch
git push -u origin feat/multiuser
```

### Qué implementa BLOQUE 1

#### Migration 013 (`crates/aionui-db/migrations/013_multiuser.sql`)

```sql
ALTER TABLE users ADD COLUMN role         TEXT    NOT NULL DEFAULT 'member';
ALTER TABLE users ADD COLUMN is_active    INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN display_name TEXT;
UPDATE users SET role = 'admin' WHERE id = 'system_default_user';
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
ALTER TABLE system_settings ADD COLUMN registration_mode   TEXT DEFAULT 'invite_only';
ALTER TABLE system_settings ADD COLUMN registration_domain TEXT;
```

#### Cambios en el modelo `User`

```rust
pub role: String,         // "admin" | "member"
pub is_active: bool,      // false = cuenta suspendida
pub display_name: Option<String>,
```

#### Nuevos métodos en `IUserRepository`

```rust
async fn create_user_full(username, password_hash, email, display_name, role) -> User;
async fn set_active(user_id, is_active) -> ();
async fn set_role(user_id, role) -> ();
async fn set_display_name(user_id, display_name) -> ();
```

#### Fix crítico en `ensure_system_user` (database.rs)

```rust
// Ahora inserta role='admin' explícitamente en DBs frescas
"INSERT OR IGNORE INTO users
 (id, username, password_hash, role, is_active, created_at, updated_at)
 VALUES ('system_default_user', 'admin', '', 'admin', 1, ?, ?)"
```

#### Middleware (`auth/middleware.rs`)

- `CurrentUser` ahora incluye campo `role: String`
- `auth_middleware`: rechaza `is_active=false` con 403
- `require_admin_middleware`: 403 si `role != "admin"`
- Modo `--local` (Electron desktop) inyecta `role='admin'` → bypasea auth

#### Endpoints nuevos

```
GET    /api/admin/users                     → lista todos los usuarios (admin only)
POST   /api/admin/users                     → crear usuario (invite-only path)
PATCH  /api/admin/users/:id                 → actualizar role/is_active/display_name
POST   /api/admin/users/:id/reset-password  → admin fuerza reset de password

POST   /api/auth/register    → auto-registro gobernado por registration_mode:
                               - "invite_only" (default) → 403
                               - "domain_allowlist" → valida @dominio
                               - "open" → cualquiera puede registrarse
```

#### `PublicUser` ampliado

```rust
pub struct PublicUser {
    pub id: String,
    pub username: String,
    pub role: String,
    pub is_active: bool,
    pub display_name: Option<String>,
}
```

#### `AuthRouterState` — campo nuevo

```rust
pub settings_repo: Arc<dyn ISettingsRepository>,  // para leer registration_mode
```

### Pendiente del BLOQUE 1 (Frontend)

El panel de administración en React todavía NO está construido:

```
pages/admin/
  UsersPage.tsx          ← tabla: listar, crear, suspender usuarios
  InviteUserModal.tsx    ← crear usuario (admin invita)
  EditUserModal.tsx      ← cambiar rol, resetear password
pages/profile/
  MyProfile.tsx          ← el usuario cambia su propio perfil
```

---

## 5. Renombrar `@aionui/web-host` (ANALIZADO, NO ejecutado)

### Archivos afectados (10 archivos, ~15 cambios)

| Archivo | Cambio |
|---|---|
| `packages/web-host/package.json` | `"name": "@alinea/web-host"` |
| `packages/desktop/package.json` | dependency → `@alinea/web-host` |
| `packages/web-cli/package.json` | dependency → `@alinea/web-host` |
| `package.json` (raíz) | dependency → `@alinea/web-host` |
| `packages/desktop/electron.vite.config.ts` | 3 referencias |
| `packages/desktop/src/index.ts` | 2 imports |
| `packages/desktop/src/process/utils/webuiConfig.ts` | 1 import |
| `scripts/resetpass.ts` | 1 import |
| `scripts/webui.ts` | 1 import |
| `packages/web-cli/src/index.ts` | 2 imports |

Después de los cambios: `bun install` (regenera lockfile).

---

## 6. Modelo de Deployment

### Visión target

```
Opción A: copilot.ingelmec.ai
  → Servidor tuyo, todos los usuarios en una instancia

Opción B: cliente.ingelmec.ai (por cliente)
  → Cada cliente tiene su propia instancia aislada
  → Mismo Docker image, diferente docker-compose.yml
```

### Stack de deployment (pendiente implementar)

```yaml
# docker-compose.yml (por crear)
services:
  alinea:
    image: ghcr.io/josetabora93/alinea-copiloto:latest
    volumes:
      - ./data:/data
    environment:
      - ALINEA_DATA_DIR=/data
      - ALINEA_ALLOW_REMOTE=1

  caddy:
    image: caddy:2  # SSL automático con Let's Encrypt
    ports: [80, 443]
```

---

## 7. Integraciones futuras planificadas

### 7.1 CAD/DXF Viewer — `mlightcad/cad-viewer` (BAJO esfuerzo)

**Qué hace**: Renderiza archivos DXF, DWG, STEP, IGES en el browser.

**Integración**: Nuevo viewer en el sistema de Preview existente:

```
packages/desktop/src/renderer/pages/conversation/Preview/components/viewers/
  ├── PDFViewer.tsx   (existe)
  ├── ImageViewer.tsx (existe)
  └── CadViewer.tsx   ← NUEVO (npm install del paquete)
```

Registrar extensiones: `.dxf`, `.dwg`, `.step`, `.iges`, `.stl`

### 7.2 PDF Studio — `OpenAEC-Foundation/open-pdf-studio` (MEDIO esfuerzo)

**Qué hace**: Visor/editor de PDFs con herramientas de medición y anotación para planos de ingeniería AEC.

**Integración**: Similar al CAD viewer, nuevo componente `PdfStudio.tsx` en el sistema de viewers. Se activa automáticamente para PDFs detectados como planos técnicos.

### 7.3 Mail Plugin — `cloudflare/agentic-inbox` (MEDIO esfuerzo)

**Licencia**: Apache 2.0 — comercializable.

**Integración**: Nuevo plugin en `aionui-channel/src/plugins/email/` (mismo patrón que Telegram, Lark, DingTalk).

```
aionui-channel/src/plugins/email/
  ├── mod.rs    ← IMAP connection config
  ├── inbox.rs  ← leer emails (crate: lettre o async-imap)
  └── reply.rs  ← enviar respuesta con AI draft
```

Nueva tabla DB: `email_accounts` (config por usuario) + `email_messages`

### 7.4 Editor tipo Notion (ALTO esfuerzo)

**AppFlowy es AGPL-3.0** — NO usar para producto comercial.

**Alternativa recomendada**: `Novel` (MIT, basado en Tiptap) para v1; migrar a `BlockSuite` (MIT) para colaboración en tiempo real.

**Integración**:

```
pages/docs/
  DocsPage.tsx       ← lista de documentos por usuario
  DocEditor.tsx      ← editor de bloques (Novel/Tiptap)
  DocList.tsx        ← sidebar de documentos

Nueva tabla: documents (id, user_id, title, content JSON, updated_at)
Nuevos endpoints: /api/docs/* en nuevo crate aionui-docs
```

**Feature diferenciador**: El `/` comando dentro del editor invoca al agente AI directamente desde el documento.

---

## 8. Monitoreo y Analytics (ANALIZADO, no implementado)

### Datos ya disponibles en la DB (sin schema changes)

```sql
-- Uso por agente y usuario
SELECT u.username, c.agent_type, COUNT(*) as sessions
FROM conversations c
JOIN users u ON c.user_id = u.id
GROUP BY u.id, c.agent_type;

-- Herramientas MCP más usadas
SELECT json_extract(m.content, '$.tool_name') as tool, COUNT(*) as uses
FROM messages m
WHERE m.role = 'tool'
GROUP BY tool ORDER BY uses DESC;
```

### Endpoint sugerido

```
GET /api/admin/analytics/usage
    ?from=YYYY-MM-DD&to=YYYY-MM-DD&agent=hermes

→ { users: [{username, agent, sessions, messages, top_tools}],
    summary: {most_active_user, most_used_agent, total_sessions} }
```

---

## 9. Flujo OpenClaw + Medición de Planos

### Caso de uso: "Mide el plano de este proyecto"

#### Si el archivo es DXF (flujo ideal — exacto al 100%)

```
1. Ingeniero sube archivo.dxf al chat
2. CadViewer.tsx abre el plano en el panel Preview
3. Ingeniero: "Mide todos los ejes del nivel 1"
4. OpenClaw → MCP Tool: dxf_parse_entities()
   DXF es texto plano → el agente lee coordenadas directamente
5. Extrae LINE/DIMENSION entities con etiquetas
6. Calcula distancias matemáticamente (sin visión, sin error)
7. Retorna tabla de mediciones exactas
```

#### Si el archivo es PDF (visión — aprox ±2-5% error)

```
1. Ingeniero sube plano.pdf
2. PdfStudio.tsx abre con herramientas de medición
3. Ingeniero: "Mide los ejes"
4. OpenClaw → MCP Tool: pdf_extract_page_as_image()
5. Vision model detecta escala en carátula
6. Identifica ejes por texto + mide pixels
7. Aplica factor de escala
8. Retorna mediciones aproximadas
```

#### MCP Tools necesarios

| Tool | Input | Output | Precisión |
|---|---|---|---|
| `dxf_parse_entities()` | archivo .dxf | Coordenadas + labels | Exacto |
| `dxf_calculate_distance()` | 2 puntos o layer names | Distancia en mm/m | Exacto |
| `pdf_measure()` | PDF + escala | Mediciones aproximadas | ±2-5% |
| `pdf_extract_titleblock()` | PDF | Escala, norte, nombre | Variable |

---

## 10. Orden de implementación recomendado

```
COMPLETADO ✓
  Rebranding Alinea Copiloto (colores, fuente, nombre)
  CSS classes .aionui- → .alinea-
  HTTP headers → alinea.ai
  Multi-usuario BLOQUE 1 (código listo, push pendiente)

EN PROGRESO
  Push de feat/multiuser al Core repo (necesita GITHUB_TOKEN)
  Panel de admin frontend (UsersPage, InviteUserModal)

PRÓXIMO — ALTA PRIORIDAD
  Panel admin React (BLOQUE 1 frontend)
  Docker + deploy en copilot.ingelmec.ai
  CAD Viewer (quick win, 1-2 días)

SIGUIENTES
  MCP Tool dxf_parse (máximo valor para ingeniería)
  PDF Studio integration (open-pdf-studio)
  Editor tipo Notion (Novel/Tiptap)
  Mail plugin (email como canal de agentes)
  Panel de analytics/monitoreo

FUTURO
  SSO / OIDC (Google Workspace, Microsoft Entra)
  Migración SQLite → PostgreSQL (si escala a >50 usuarios concurrentes)
  Rename @aionui/web-host → @alinea/web-host
```

---

## 11. Comandos útiles

```bash
# Frontend — desarrollo
cd /workspace  # repo: Alinea-Copilot
bun install
bun run dev
bun run lint          # 0 errores, ~787 warnings pre-existentes (normales)
bunx tsc --noEmit     # typecheck
bun run test          # 1376 tests, deben pasar todos

# Frontend — antes de push
just push             # lint → format → typecheck → test → git push

# Backend — desarrollo
cd /workspace/AlineaCopilot-Core
cargo build --release
cargo clippy --all-targets -- -D warnings  # debe ser 0 warnings
cargo test -p aionui-db -p aionui-auth
cargo fmt

# Aplicar patch de multiuser en nueva sesión
git clone https://github.com/JoseTabora93/AlineaCopilot-Core.git
cd AlineaCopilot-Core && git checkout -b feat/multiuser
# Obtener patch:
curl -L "https://raw.githubusercontent.com/JoseTabora93/Alinea-Copilot/cursor/rebranding-alinea-copiloto-1031/alinea-core-multiuser.patch" -o multiuser.patch
git apply multiuser.patch
git push -u origin feat/multiuser
```

---

## 12. Convenciones del proyecto (resumen)

- **Componentes**: PascalCase (`Button.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Hooks**: `useTheme.ts`
- **CSS**: UnoCSS utilities + CSS Modules para estilos complejos
- **Colores**: Solo tokens semánticos de `uno.config.ts` o CSS variables — nunca hardcoded
- **UI components**: Solo `@arco-design/web-react` — nunca `<button>`, `<input>` raw
- **Icons**: Solo `@icon-park/react`
- **i18n**: Todos los textos visibles al usuario via claves i18n — nunca strings hardcoded
- **TypeScript**: strict mode, no `any`, prefer `type` over `interface`
- **Commits**: `feat(scope): subject` en inglés
- **NUNCA** agregar AI signatures en commits (Co-Authored-By, Generated with, etc.)
