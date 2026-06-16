# Alinea Copiloto — Fase 2 · Blueprint de implementación (the-architect)
> Plan self-contained para construir la Fase 2 sobre el stack existente. Diseñado por the-architect el 2026-06-16 a partir de `Alinea_ROADMAP.md` + decisiones de José (interview). NO es greenfield: se construye sobre los 3 repos vivos.
>
> Baseline autorado por Claude Code (the-architect). Ver `Alinea_FASE2_Profundizacion.md` para gaps y profundización añadidos por Cursor.

## 0. Decisiones congeladas (no re-litigar)
| Tema | Decisión |
|---|---|
| Stack | **Fijo**: Core en **Rust (aioncore)**, Frontend **Electron/React/Arco**, agentes **OpenClaw**, VPS propio. NO se introduce Next.js/Supabase/Clerk. |
| Identidad/RBAC | **Roles de 1ª clase** (admin · gerencia · técnica · comercial · financiera · ingeniería = las 6 categorías OpenClaw) + **etiquetas de clasificación** (`público`/`interno`/`confidencial-<área>`) en KB y skills. El gateway propaga `{user_id, rol, project_id}` **firmado** por request. |
| Consumos | **Llaves de Alinea vía el Core** → un **ledger único** mide los 3 motores (Copilot/OpenClaw/Hermes). |
| Proyectos | **Entidad propia en el Core** (`projects`) + **WorkDrive como conector** de carpeta. RAG por proyecto. |
| Mail | **Solo borradores** (human-in-the-loop) + OAuth/IMAP, creds cifradas por usuario → **integrar Zero (mail-0/zero)** vía su MCP. |
| Knowledge/Todos/Notif. | **Huly self-host** como capa HUMANA (SSO OpenID) + **índice KB en el Core** (sqlite-vec) para el RAG de los agentes (ACL por rol). |
| Hermes | **Propone + admin aprueba** (Command Center), telemetría anonimizada. |
| Router modelos | **Auto** (el más barato que cumpla calidad) + **override** del usuario. |
| Secretos | Cifrado **por usuario** (libsodium/age, master key en env; sin KMS externo). |
| Visor DXF | Frontend (`dxf-parser`+canvas/Three.js): capas + medición (distancia **+ área + cotas**), unidades del header. |

---

## 1. Arquitectura objetivo (Fase 2)
```
Cliente (Electron/React)
  │  IPC (desktop)  +  HTTP/WS (WebUI → web-host proxy)
  ▼
AlineaCopilot-Core (Rust aioncore)  ── el cerebro de identidad, modelos y datos
  ├─ Auth multiusuario  → emite contexto FIRMADO {user_id, rol, project_id}
  ├─ Model Router  → GLM/MiniMax/Claude/Qwen  (+ agentes z.ai docs/slides)
  ├─ Prompt-cache builder  → prefijo estable + cache_control
  ├─ SQLite: users, roles, chats, projects, usage_ledger, kb_acl, secrets(cifrado)
  ├─ KB index (sqlite-vec)  → RAG por proyecto/rol  (KB3 curada + KB viva)
  ├─ usage_ledger  → mide TODA llamada LLM (los 3 motores)
  └─ Gateway de agentes remotos (wss + Ed25519 + identidad por request)
        │
        ├─► OpenClaw (VPS, servicio aparte) — 19 agentes, 45 skills, MCPs
        │       └─ MCP: dxf-takeoff, docgen, hvac, zoho(+download/upload), **zero-mail**
        └─► Hermes (VPS, servicio aparte) — supervisor, propone fixes de skills
  ── SSO (OpenID Connect) ──►  Huly (VPS/box aparte): PM, tareas, chat, NOTIFICACIONES, docs (capa humana)
```
**Invariante de oro:** la identidad (`user_id`+rol) viaja en CADA request y **filtra TODO acceso a datos**. El agente nunca asume "el usuario"; lo recibe firmado del Core.

---

## 2. EL CIMIENTO — Identidad + Segregación (§6) · construir PRIMERO
Sin esto, consumos/mail/proyectos/KB no son seguros. Es la Fase B y bloquea todo lo demás.

### 2.1 Propagación de identidad por request
- El Core, tras autenticar, emite por cada request a un agente un **token de contexto firmado** (JWT/PASETO Ed25519) con `{user_id, rol, project_id, scopes, exp}`.
- El **gateway** lo incluye en el handshake/mensaje wss a OpenClaw/Hermes. El agente **valida la firma** (clave pública del Core) y **opera solo dentro de ese scope**. Sin token válido → rechaza + audita.
- **Extender el protocolo del gateway** (`remoteAgentTypes.ts` / Core gateway) para llevar este contexto en cada invocación, no solo en el connect.

### 2.2 RBAC + etiquetas
- Tabla `roles` (admin, gerencia, tecnica, comercial, financiera, ingenieria) y `user_roles` (un usuario puede tener varios).
- **Etiquetas de clasificación** en cada doc de KB y en cada skill: `público` | `interno` | `confidencial-gerencia` | `confidencial-financiera` | …
- Tabla `acl_policy`: mapea `etiqueta → roles permitidos`. La recuperación de KB y el set de skills disponibles **filtran por (rol del solicitante → etiquetas permitidas)**.

### 2.3 Aislamiento por capa (todo filtrado por identidad, NO por proceso)
| Capa | Aislamiento |
|---|---|
| Chats | ya particionados por `user_id` (SQLite) |
| Archivos/workspace | root por usuario (`/api/fs/*`); el agente solo ve su scope |
| KB | recuperación con ACL por rol/etiqueta |
| Memoria del agente | **namespaced por `user_id`** (sin store global mezclado) |
| Skills | disponibilidad por rol |
| Secretos | cifrados por usuario (age/libsodium), nunca compartidos |
| Contexto por request | fresco y scoped; termina sin fuga entre requests |
| Auditoría | `audit_log`: quién accedió a qué (esp. confidencial) |

### 2.4 Hermes y datos
Hermes solo ve **telemetría anonimizada/agregada** (errores de skills, ratings) — **nunca** contenido confidencial. Ejemplos para reparar skills: sintéticos o no-confidenciales.

---

## 3. Diseño por feature

### 3.1 Router de modelos + agentes z.ai (Core)
- Adaptadores: `zai` (chat GLM-5.1/5-turbo/5v + **Agents API** slides/docs), `minimax`, `claude`, `openrouter(qwen)`. (z.ai + qwen ya probados y vivos.)
- **Regla del router:** por subtarea, elegir *el más barato que cumpla la calidad*: MiniMax (extracción/borrador largo barato) · GLM-5.1 (razonamiento ingeniería) · z.ai Agents (artefacto **diseñado** server-side: slides/doc → no se queman tokens en chat) · Claude (razonamiento crítico) · Qwen/Haiku (barato).
- **Override del usuario:** toggle `económico ⇄ máxima calidad` por chat/proyecto.
- **Capa de marca:** plantillas Alinea (Sage Green, Poppins) por tipo de doc — el agente z.ai rellena → consistencia visual.

### 3.2 Prompt caching (Core)
- Ordenar prompt: `[estable: system + skills + KB/proyecto] → [volátil: turno]`. Prefijo estable primero.
- `cache_control: ephemeral` en Claude; prefijo idéntico en GLM/MiniMax (cache automático). Verificar soporte por provider en el adaptador.
- El **ledger** distingue **cache-read** (barato) vs **cache-write** para el $ real.

### 3.3 Hermes (supervisor remoto)
- `RemoteAgentConfig` (wss + Ed25519), administrado desde el **Command Center**.
- Consume telemetría (anonimizada) → **propone** fixes de skills → **admin aprueba** en el Command Center → se aplican con **rollback**. (Reusa el patrón curator/git de skills.)

### 3.4 Agentic Mail = **Zero (mail-0/zero)** + OpenClaw
- **Por qué Zero:** app self-host MIT con **MCP** (los agentes la manejan), unified inbox (Gmail/Outlook), OAuth. Es "real", no un skill IMAP fino.
- **Integración:** desplegar Zero en el VPS (Postgres propio); conectar OpenClaw a su **MCP** (triage/insights/draft). Auth por usuario (OAuth/IMAP), creds cifradas en el Core. **Solo borradores** (humano aprueba/envía).
- **Fallback ligero:** Hermes-email (IMAP/SMTP, MIT) si Zero resulta pesado para un usuario.
- **Segregación:** la cuenta de mail vive bajo el `user_id`; un usuario nunca ve el buzón de otro.

### 3.5 Knowledge/Todos/Notificaciones = **Huly** (humano) + **índice KB del Core** (agentes)
- **Huly self-host** (CockroachDB+MongoDB+Elasticsearch+Redpanda, ~16 GB) como la app **humana**: proyectos, tareas, chat, **notificaciones**, docs. **SSO OpenID Connect** con el Auth del Core → un solo login.
- **Índice KB del Core (sqlite-vec):** lo que los **agentes** consultan (RAG). Importa la **KB3 curada** (normas, inmutable) + **docs vivos** (de proyectos/Huly). **ACL por rol/etiqueta**. Editar la KB viva NO re-hornea Docker.
- **Conector Huly↔Core:** un sync (webhooks de Huly + jobs del Core) que indexa los docs de Huly que los agentes deben ver, respetando permisos. La KB3 normas quedan solo en el Core (no se suben a Huly).
- **Nota de hierro:** Huly necesita su propio ~16 GB → **subir el VPS** o un box dedicado (ver §6).

### 3.6 Proyectos persistentes + carpetas WorkDrive
- Tabla `projects` (id, owner, `rol_scope`, name, desc, **instrucciones/contexto**, `folder_ref{local|workdrive}`). Los **chats** pertenecen a un proyecto. Los **docs** del proyecto alimentan el **RAG del proyecto** (como Claude Projects).
- **WorkDrive como conector:** la carpeta del proyecto puede mapear a Zoho WorkDrive vía el MCP **`zoho_workdrive_download/upload`** (¡ya construido en Fase 1!). El agente lee/escribe ahí.
- **Unificar el picker:** "Work in a project" usa el mismo `/api/fs/*` en WebUI (hoy el diálogo nativo solo sirve en desktop).
- Scope por rol: un técnico no ve el proyecto de gerencia.

### 3.7 Visor DXF (frontend)
- `'dxf'` en `PreviewContentType` + `FILE_EXTENSION_MAP`; `DxfViewer.tsx` (`dxf-parser` + canvas/Three.js) en `Preview/components/viewers/`: pan/zoom, **toggle de capas**, **medición** (distancia + área + cotas), unidades del header. Ramifica en `PreviewPanel.tsx`.
- Complementa `dxf-takeoff`: el visor es para el HUMANO; el MCP mide para el agente.

### 3.8 Ledger de consumos $ (Core)
- **Regla:** toda llamada LLM emite `usage_event {user_id, engine, model, provider, tokens_in/out, cache_read/write, $est, project_id, ts}`.
  - Copilot (aionrs): el Core ya ve el stream → evento directo.
  - OpenClaw/Hermes: usan **llaves de Alinea vía el Core** → el Core mide directo (decisión §4.6).
- Tabla de precios por modelo (config) → `$`. Agregación por usuario/modelo/motor/fecha → panel admin + "mi consumo". **Límites $** por usuario (soft avisa / hard bloquea), reset mensual.

### 3.9 Command Center (frontend)
- Montar `RemoteAgentManagement.tsx` (hoy huérfano) → centro de control: lista de agentes/gateways (OpenClaw, Hermes), salud/health, **aprobación de devices** (handshake), **uso por agente** (§3.8), logs/errores, y **aprobación de fixes de skills de Hermes** (§3.3). Solo admin (gating por rol).

---

## 4. Orden de build (numerado, por dependencias)
> Regla: **identidad primero**; cada feature cuelga de ella.

**Fase A — Cierre en vuelo**
1. ✅ #10 (rebrand) + #11 (SW auto-update) — *mergeados*.
2. **Core PR #2 `DELETE /api/admin/users/{id}`** — resolver conflicto Rust + confirmar permiso de escritura + merge.
3. Iconos SO (`.icns`/`.ico`/PWA/tray) desde el PNG Alinea HD.

**Fase B — Cimientos (identidad + modelos)**
4. 🔐 **Identidad por request** (Core emite contexto firmado) + **extender el protocolo del gateway** para propagarlo. *(Core + gateway)*
5. **RBAC + etiquetas + ACL** (tablas roles/user_roles/acl_policy; filtrado de KB y skills). *(Core)*
6. **Router de modelos** (adaptadores zai/minimax/claude/qwen + regla + override). *(Core + Frontend selector)*
7. **Prompt caching** (orden del prompt + cache_control + medición). *(Core)*
8. **Montar Command Center** (base, sin Hermes aún). *(Frontend)*

**Fase C — Agentes**
9. **Hermes** wiring como agente remoto + supervisor (propone fixes → admin aprueba). *(Hermes + Core gateway + Command Center)*
10. **Agentic Mail = Zero** (deploy + MCP + OAuth por usuario + borradores). *(VPS + OpenClaw MCP + Core creds)*

**Fase D — Knowledge / Proyectos / Docs**
11. **Proyectos** (entidad Core + RAG por proyecto) + **unificar picker WebUI** + **WorkDrive conector** (reusa `zoho_workdrive_*`). *(Core + Frontend)*
12. **Huly self-host + SSO** (capa humana) + **índice KB del Core (sqlite-vec)** + **conector Huly↔Core** con ACL. *(VPS + Core + Frontend embed/links)*
13. **Visor DXF** con medición. *(Frontend)*

**Fase E — Gobernanza**
14. **Ledger $** por usuario across 3 motores + **límites**. *(Core + Frontend panel)*
15. Dashboards (Zoho Analytics push/embed) — opcional.

---

## 5. Archivos clave por repo (dónde tocar)
**AlineaCopilot-Core (Rust)** — el grueso de §2, §3.1/3.2/3.6/3.8: auth/roles, emisor de contexto firmado, gateway (propagación identidad), router de modelos, prompt-builder con cache, SQLite (projects, usage_ledger, acl, kb_index sqlite-vec, secrets cifrados), endpoints `/api/*`.
**Alinea-Copilot (Frontend)** — `RemoteAgentManagement.tsx` (Command Center), `IProvider`/`modelPlatforms` (router UI + override), `PreviewContentType`/`fileUtils.ts`/`DxfViewer.tsx` (visor DXF), `GuidWorkspaceFootnote.tsx` (unificar picker), módulos nuevos (Proyectos, KB/Huly embed, panel consumos), gating por rol.
**Alinea-OpenClaw** — MCP **zero-mail** + uso del MCP `zoho_workdrive_*`; skills scopeadas por rol; recibe el contexto firmado y opera dentro del scope.
**VPS/infra** — deploy de **Zero** y **Huly** (compose aparte), **subir RAM** (Huly 16GB), Hermes como servicio.

---

## 6. Hierro (obligatorio para Fase 2)
El VPS actual (4 vCPU / 7.6 GB, compartido con OpenClaw+Hermes+MCPs) **NO alcanza** para sumar Huly (16 GB) + Zero (Postgres). **Decisión:** subir a un box grande (≥8 vCPU / 32 GB) **o** un box dedicado para Huly. Sin esto, Fase D no es viable. (Consistente con el plan de escalado de modelos/consumos.)

---

## 7. Criterios de "100% funcionando" (acceptance por feature)
- **Identidad:** un request sin contexto firmado válido es **rechazado + auditado**; un técnico **no** recupera un doc `confidencial-gerencia` ni ve un skill de gerencia (test automatizado por rol).
- **Consumos:** una tarea que usa Copilot+OpenClaw+Hermes produce **3 usage_events** atribuidos al mismo `user_id`, con cache-read/write distinguido; el panel suma el $ correcto; el límite hard **bloquea**.
- **Proyectos:** crear proyecto → adjuntar docs → un chat nuevo del proyecto usa esos docs como contexto (RAG) sin re-subirlos; la carpeta WorkDrive lee/escribe vía el MCP.
- **Mail (Zero):** OpenClaw hace triage del buzón del usuario, genera **borradores** (no envía), y un usuario **nunca** ve el buzón de otro.
- **KB:** la KB3 (normas) es consultable por agentes con cita; editar un doc vivo desde la UI **no** requiere re-hornear; un rol sin permiso **no** lo recupera.
- **Hermes:** propone un fix de skill → aparece en el Command Center → admin aprueba → se aplica con rollback disponible.
- **DXF:** el técnico abre un DXF en el visor, alterna capas y **mide** distancia/área/cota sin AutoCAD.
- **Segregación (transversal):** suite de tests "un usuario/rol NO puede ver/usar X de otro" en KB, archivos, memoria, mail, proyectos.

---

## 8. Reparto Claude (yo) / Cursor
- **Claude (yo):** diseño/arquitectura, el Core (Rust) en lo estructural (identidad, gateway, router, ledger, KB index), skills/MCP de OpenClaw, integración Zero/Huly, criterios de prueba.
- **Cursor:** ejecución de UI en el frontend React (Command Center, visor DXF, módulos Proyectos/KB/consumos), y los PRs del Core que sean acotados (PR #2 delete-user).
- Coordinación por PRs en los 3 repos (ver `Alinea_FASE2_Guias.md`).

> **Siguiente paso:** ver `Alinea_FASE2_Guias.md` (cómo construir cada feature + qué probar). Este blueprint + las guías se versionan en `Alinea-OpenClaw/fase2/` y `~/Downloads`.
