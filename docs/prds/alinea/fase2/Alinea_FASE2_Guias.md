# Alinea Copiloto — Fase 2 · Guía de construcción (v2, how-to + qué probar)

> Instrucciones **al 100%** para construir cada feature de Fase 2 + su criterio de aceptación
> "no superficial". Complemento ejecutable de `Alinea_FASE2_Blueprint.md`.
> Stack fijo (Rust/Electron-React/OpenClaw/Hermes/Zero; capa humana nativa con BlockNote+dnd-kit; Huly opcional). Lenguaje: español.
>
> Cada bloque: **Construir (qué + dónde) → Cómo se comunica → Probar (aceptación)**.

---

## 0. Flujo de trabajo (3 repos + VPS)
- **Ramas/PRs:** nada directo a `main`. Una rama por feature, PR por repo. Escanear secretos antes de pushear.
- **Repos:** `AlineaCopilot-Core` (Rust) · `Alinea-Copilot` (frontend) · `Alinea-OpenClaw` (skills/MCP). Infra (Hermes/Zero; Huly opcional) = compose versionado en `Alinea-OpenClaw/infra/`.
- **Deploy OpenClaw:** `deploy-v4.sh` (re-sync + rebuild). MCPs: scripts `apply_*.sh`.
- **Regla de oro:** un feature **no** está hecho hasta pasar su **criterio de aceptación** (§ "Checklist no-superficial"). Todo entregable → repo + carpeta (nunca solo en el chat).

---

## 1. Identidad por request + ciclo de vida (Core + gateway) — PRIMERO

**Construir (Core):**
1. Tras autenticar, emitir por request a un agente un token firmado Ed25519 `{user_id, rol[], project_id?, scopes, exp(5–15min), jti}` (PASETO/JWT). Clave privada en Core; pública en OpenClaw/Hermes.
2. **Revocación:** denylist de `jti` **o** `cred_version` por usuario (al desactivar/cambiar rol → invalida tokens previos).
3. **Refresh:** endpoint que renueva el token de una tarea en vuelo **solo si** el usuario sigue vigente y con permiso.
4. **Gateway:** incluir el token en **cada** mensaje wss (extender `remoteAgentTypes` + handler). El agente valida firma → opera scoped → sin token válido = rechaza + `audit_log`.

**Cómo se comunica:** UI → Core (auth) → gateway (token por mensaje) → OpenClaw/Hermes (valida).

**Probar:**
- Request con token manipulado/expirado → **rechazado + auditado**.
- Desactivar a un usuario a mitad de una tarea larga → la siguiente renovación **falla** y la tarea **aborta**.
- Cambiar el rol de un usuario → pierde acceso a lo del rol viejo en el **siguiente** request.

---

## 2. RBAC de 3 ejes + ACL (Core) — junto con tests de CI

**Construir (Core):**
1. Tablas `roles` (admin·gerencia·tecnica·comercial·financiera·ingenieria), `user_roles`, `groups`/`group_members` (opcional).
2. `acl_policy(etiqueta → roles)` y **`resource_acl(resource_id, principal{user|role|group}, perm)`**.
3. Función central `can_access(principal, resource) = etiqueta_ok(rol) AND (es_dueño OR es_miembro) AND en_scope(project_id)`. **Toda** lectura (RAG, archivos, mail, proyectos) pasa por aquí.
4. Etiquetar docs KB y skills (`público|interno|confidencial-<área>`).

**Probar (matriz automatizada en CI — bloquea merge):**
- `gerencia` recupera `confidencial-gerencia` ✅; `tecnica` ❌ (deny+audit).
- **Horizontal:** `tecnica A` **no** ve proyecto/buzón/doc de `tecnica B` sin membership.
- Una celda que pase de **deny→allow** **rompe el CI**.

---

## 3. RAG compuesto (Core) — uno solo para los 3 motores

**Construir (Core):**
1. Índice **único** `sqlite-vec` con metadatos `{etiqueta, owner, project_id, source, version}`.
2. Importers: **KB3** (inmutable, re-import al re-hornear), **KB viva** (editable), **project_docs**.
3. Endpoint/MCP **`kb_search(query, identidad)`** que filtra por `can_access` (§2) y devuelve resultados **con fuente/cita** + `version`.
4. **Consumidores:** Copilot llama directo; **OpenClaw/Hermes** llaman `kb_search` por el gateway **con la identidad firmada**.
5. **Invalidación:** al editar un doc → re-embedding (cambia `version`); la clave de prompt-cache usa `version`.

**Cómo se comunica:** los **3 motores** → mismo `kb_search` → mismo índice → ACL por request.

**Probar:**
- La **misma** consulta desde Copilot, OpenClaw y Hermes devuelve **lo mismo** para un rol con acceso, y **menos/nada** para uno sin acceso.
- Editar un doc en la UI → la siguiente búsqueda lo refleja **sin re-hornear**.
- Las respuestas citan **fuente**; un rol sin permiso **no** ve esa fuente.

---

## 4. Router de modelos + caching + z.ai Agents (Core)

**Construir:**
1. Adaptadores `zai`(GLM chat + **Agents API** slides/docs), `minimax`, `claude`, `openrouter(qwen)`.
2. `route(subtask, quality_pref) → (provider, model)` (tabla declarativa por tipo; **failover** al siguiente si cae/rate-limit/basura).
3. Override `económico ⇄ máxima` en `IProvider`/UI por chat/proyecto.
4. Prompt-builder: ordena `[estable]→[volátil]`, marca `cache_control` (Claude) / prefijo idéntico (GLM/MiniMax), clave de cache con `version` (§3). Cachear **solo** prefijos reutilizados.
5. z.ai Agents **async**: job→poll→artefacto (timeouts/errores) + plantillas Alinea por tipo de doc.

**Probar:**
- Extracción larga → MiniMax; razonamiento crítico → Claude; slide → z.ai Agents.
- Repetir turno con mismo prefijo → `cache_read > 0` (no write). Editar KB → cache-miss controlado.
- Provider caído → **failover** registrado. Override "económico" cambia el modelo.
- Un slide z.ai sale **diseñado** (plantilla Alinea), no texto plano.

---

## 5. Command Center (frontend)

**Construir:** montar `RemoteAgentManagement.tsx` (quitar redirect `?tab=remote→local`). Vistas: agentes/gateways (OpenClaw, Hermes) + **salud en vivo (WS)**, aprobación de devices, **uso por agente** (§11), logs, y **cola de fixes de Hermes** (aprobar/rechazar). Solo-admin. i18n.

**Probar:** admin ve OpenClaw+Hermes vivos; member no entra; aprobar device y aprobar un fix de skill funciona end-to-end; cada acción queda auditada.

---

## 6. Hermes — chat + supervisor

**Construir (a) Chat — Opción A (selector de arriba, ver Blueprint §8.4):**
1. **Backend (Claude):** registrar Hermes como `RemoteAgentConfig` (wss+Ed25519) **y exponerlo en `/api/agents` como agente seleccionable tipo `acp`** (el gateway como adaptador ACP), con `id`/`name`/`avatar`. Cablear el **send path** (crear conversación + stream) con **identidad firmada por request** (§1).
2. **Frontend:** **nada** si se expone como `acp` → Hermes aparece **solo** en el pill bar de arriba (`AgentPillBar`), junto a Copilot/custom. (Si se expone como `openclaw-gateway`/`remote`, agregar ese tipo a `SUPPORTED_NEW_CONVERSATION_AGENT_TYPES` **solo** cuando el send path funcione.) Hermes usa `kb_search` (§3) scoped por identidad.

> ⚠️ **NO** usar un "espacio" que solo rellena el prompt: la selección real es el **pill bar de arriba**. Lo mismo aplica a OpenClaw (migrarlo del espacio al selector cuando esté cableado).

**Construir (b) Supervisor:**
3. Pipeline: telemetría **anonimizada** → propuesta de fix (diff de skill) → cola en Command Center → **admin aprueba** → **commit/PR a `Alinea-OpenClaw`** (la fuente que hornea) + aplica en runtime + **canary/tests por skill** → rollback = revert.

**Probar:**
- **Chat:** Hermes aparece como **pill seleccionable arriba**; al seleccionarlo y enviar, la conversación va a Hermes y responde, **scoped** a la identidad del usuario.
- **Supervisor:** inyectar un error recurrente → Hermes propone fix → aparece en Command Center → aprobar → cambia el skill **y persiste tras `deploy-v4.sh`** (porque fue PR al repo) → rollback disponible.
- Hermes **no** ve contenido confidencial (solo agregados).

---

## 7. Agentic Mail (Zero + OpenClaw)

**Construir:**
1. **Fase 1 (simple):** skill/MCP IMAP/SMTP por usuario (creds cifradas, §1/§blueprint 5.3).
2. **Fase 2 (full):** desplegar **Zero** (Postgres) + conectar OpenClaw a su **MCP**; mapear **`Zero account ↔ user_id`** (el wrapper opera **siempre** sobre la cuenta del token).
3. Skill `mail`: triage/priorización → insights de contacto (al RAG) → **borradores** (nunca auto-envía).

**Probar:** OpenClaw lista prioridades del buzón del **usuario correcto**, redacta 3 borradores; el usuario aprueba/edita/envía; un **segundo usuario no ve** ese buzón (test de aislamiento).

---

## 8. Proyectos + WorkDrive (Core + frontend)

**Construir (Core):** tabla `projects(id, owner, members[], rol_scope, name, desc, contexto, folder_ref{local|workdrive})` + `project_chats` + `project_docs`. Los `project_docs` se indexan en el RAG (§3, scoped al proyecto).
**Construir (frontend):** módulo `/projects` (lista/crea, vista de proyecto con docs+chats+contexto). **Unificar** "Work in a project" (`GuidWorkspaceFootnote.tsx`) para usar `/api/fs/*` en WebUI (no el diálogo nativo).
**Construir (conector):** carpeta del proyecto ↔ Zoho WorkDrive vía MCP `zoho_workdrive_*`. Estrategia **anti-conflicto con TrueSync** (carpeta del agente separada o lock).

**Probar:** crear proyecto → adjuntar 2 docs → un chat **nuevo del proyecto** los **cita** sin re-subir (RAG); mapear carpeta WorkDrive → el agente baja/sube ahí; un **técnico no ve** el proyecto de gerencia (sin membership).

---

## 9. Conocimiento (BlockNote) + Tareas (dnd-kit) + KB viva ↔ RAG (frontend + Core)

> Capa humana **nativa dentro de Alinea** (Huly descartado por defecto; opcional más adelante).

**Construir (frontend):**
1. **Conocimiento** `/knowledge`: integrar **BlockNote** (`@blocknote/react`, MPL-2.0; **no** paquetes XL/GPL) como editor de docs/notas; persistir el contenido (JSON/Markdown) en el Core.
2. **Tareas** `/tasks`: **board Kanban** con **dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`, MIT) + componentes Arco; persistir en el Core; incluir los **todos del agente**.
3. i18n + gating por rol en ambos.

**Construir (Core):**
4. **KB viva → RAG:** lo editado en `/knowledge` se **indexa** en el índice del Core (sqlite-vec) respetando ACL. KB3 normas quedan solo en el Core. Embeddings (modelo español; costo al ledger `system:kb-index`).
5. Endpoints `/api/knowledge/*` y `/api/tasks/*` (CRUD scoped por identidad).

**Probar:** crear un doc en `/knowledge` con BlockNote → un agente lo **cita** (RAG) **sin re-hornear**; un rol sin permiso **no** lo recupera. Crear/mover tarjetas en el board `/tasks` (drag entre columnas) persiste; un agente puede crear/leer tareas vía API; un usuario sin acceso al proyecto **no** ve esas tareas.

---

## 10. Visor DXF (frontend)

**Construir:** `'dxf'` en `PreviewContentType` + `FILE_EXTENSION_MAP`; `DxfViewer.tsx` con **parser + renderer** (`dxf-parser` + `three-dxf`/canvas) en `Preview/components/viewers/`: pan/zoom, **toggle de capas**, **medición** (distancia + área + cotas) con **escala del header** (`$INSUNITS`). Parse/render en **web worker** (DXF grandes), límite de tamaño, manejo de archivo corrupto. Branch en `PreviewPanel.tsx`. i18n.

**Probar:** abrir un IE-201, alternar capas, medir un tramo (ML) y un área (m²) **coherentes con el plano**, sin AutoCAD; un DXF grande no congela la UI; un archivo corrupto da error claro (no crash).

---

## 11. Ledger de consumos $ (Core + frontend)

**Construir (Core):**
1. `usage_event {user_id, engine, model, provider, tokens_in/out, cache_read/write, $est, project_id, ts}` en **cada** llamada LLM (3 motores, llaves de Alinea vía Core).
2. **Pre-flight:** estimar costo antes de llamar y **rechazar si excede** (reconciliar al terminar; chequear **entre pasos** de agente).
3. **Buckets de fondo:** `system:hermes`, `system:cron(→owner)`, `system:kb-index`, `system:mail-triage(→user)`.
4. Tabla de precios → `$`; agregación; límites `soft/hard`, reset mensual.

**Construir (frontend):** panel admin `/settings/usage` + "mi consumo".

**Probar:** tarea multi-motor (Copilot+OpenClaw+Hermes) → 3 `usage_event` al **mismo `user_id`** con cache-read/write distinguido; el panel **suma bien**; el límite **hard bloquea ANTES** de gastar; el `soft` avisa; el costo de Hermes/cron va a su bucket.

---

## 12. UI completa (frontend) — que la app guíe al usuario

Implementar los módulos de §13 del Blueprint (todos role-gated, i18n):
- Home con **3 agent spaces** (Copilot/OpenClaw/Hermes) + selector de modelo + override calidad.
- `/projects`, `/knowledge` (**BlockNote**), `/mail`, `/tasks` (**board dnd-kit**), `/settings/agents` (Command Center), `/settings/usage`, `/settings/users` (roles), `/settings/model` (router/override), **centro de notificaciones**, visor DXF.
- **Estados vacíos/denegado claros** (qué hacer cuando el ACL deniega). Onboarding que presente los 3 motores y los proyectos.

**Probar:** un member ve solo lo suyo; un admin ve Command Center/Consumos/Usuarios; un denegado ve un mensaje claro (no un error técnico); las notificaciones avisan "borrador listo / fix pendiente / presupuesto excedido".

---

## Checklist "NO superficial" (criterio de rechazo)
Un feature NO está hecho si:
- ❌ Rompe **segregación** (otro rol **o** usuario ve/usa algo que no debe — vertical **u horizontal**).
- ❌ El entregable de IA es **genérico** (BOM/AO sin el estándar Ingelmec — skills `bom`/`alcance`/`memoria-calculo`).
- ❌ El consumo **no se atribuye** al `user_id` real (o el hard limit no bloquea **antes** de gastar).
- ❌ Un fix de Hermes **no persiste** tras `deploy-v4.sh` (no fue PR al repo).
- ❌ Falta el **criterio de aceptación probado** (no "parece que sirve").
- ❌ Se dejó el entregable **solo en el chat** (regla: carpeta + GitHub).
- ❌ Falta **i18n** o el **estado de acceso denegado** no es claro.

## Convenciones
- **Roles:** `admin · gerencia · tecnica · comercial · financiera · ingenieria`.
- **Etiquetas KB/skills:** `público · interno · confidencial-<área>`.
- **Naming entregables:** `<PROYECTO>_<Tipo>_RevXX.xlsx` en `07. PREVENTA/REVxx/`.
- **Persistencia:** todo plan/guía/blueprint → repo (`Alinea-OpenClaw/fase2/` + este repo) + push.

## Reparto Claude / Cursor
- **Claude Code:** Core (Rust) + agentes/skills (OpenClaw/Hermes) + integración Zero (+ Huly opcional) + infra VPS. (Estas guías son las instrucciones al 100%.)
- **Cursor:** toda la UI (§12) + PRs acotados del Core (p. ej. `DELETE user`).
