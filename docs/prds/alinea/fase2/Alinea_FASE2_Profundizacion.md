# Alinea Copiloto — Fase 2 · Profundización + Gaps (revisión Cursor)

> Complemento crítico a `Alinea_FASE2_Blueprint.md` y `Alinea_FASE2_Guias.md`.
> Los baselines están **muy bien**; esto NO los reemplaza — los **explota más** y marca
> lo que el blueprint **asume resuelto y no lo está** (gaps reales, varios riesgosos).
> Formato por gap: **Problema → Por qué importa → Recomendación → Dudas**.
>
> Convención: 🔴 crítico (bloquea correctitud/seguridad) · 🟠 importante · 🟡 mejora.

---

## 1. Gaps ESTRUCTURALES críticos (esto sí faltaba)

### 1.1 🔴 RBAC por rol **no alcanza** — falta ownership / membership de proyecto
**Problema.** El blueprint segrega por **rol + etiqueta** (`confidencial-gerencia`, etc.). Pero **dos usuarios con el mismo rol** (p. ej. dos `tecnica`) compartirían todo lo etiquetado para ese rol. Un técnico vería el proyecto/los docs de **otro** técnico. El correo y los proyectos son **por usuario/equipo**, no por rol.

**Por qué importa.** Es el caso real de fuga más probable y el blueprint no lo cubre: la confidencialidad no es solo vertical (gerencia↔técnico) sino **horizontal** (técnico↔técnico, proyecto↔proyecto).

**Recomendación.** Modelo de acceso de **3 ejes combinados** (AND):
1. **Rol/etiqueta** (lo que ya hay): `acl_policy(etiqueta→roles)`.
2. **Ownership/membership**: `resource_acl(resource_id, principal{user|role|group}, perm)` — cada proyecto/doc/buzón tiene dueño y miembros explícitos.
3. **Scope de proyecto activo**: el `project_id` del token limita aún más (un request dentro de Proyecto X no toca recursos de Proyecto Y aunque el rol lo permita).

Regla efectiva: `acceso = etiqueta_ok(rol) AND (es_dueño OR es_miembro) AND en_scope(project_id)`.

**Dudas.** ¿Existen "equipos/grupos" además de roles? ¿Un doc puede ser de un usuario sin proyecto (privado)? ¿Quién puede compartir un recurso y con quién?

---

### 1.2 🔴 Ciclo de vida del token de identidad (revocación / refresh / tareas largas)
**Problema.** El token firmado lleva `exp`, pero el blueprint no define: (a) **revocación** cuando se desactiva un usuario o se le cambia el rol **a mitad de sesión**; (b) **refresh** para **tareas de agente largas** (una corrida de OpenClaw puede durar más que el `exp`); (c) clock skew.

**Por qué importa.** Sin revocación, un usuario desactivado/desescalado sigue operando hasta que expire el token. Sin refresh, las tareas largas se caen a mitad o (peor) se incentiva un `exp` largo que agrava (a).

**Recomendación.**
- `exp` **corto** (p. ej. 5–15 min) + **lista de revocación** (`jti` denylist en el Core, chequeada por el gateway) o versión de credenciales (`cred_version` en el user; si cambia, invalida tokens previos).
- **Refresh para tareas en vuelo**: el gateway renueva el token de contexto contra el Core mientras la tarea siga activa **y** el usuario siga vigente; si el usuario se desactiva, la siguiente renovación falla → la tarea se aborta + audita.
- Revalidar rol/permiso en cada renovación (no confiar en el snapshot del token viejo).

**Dudas.** ¿`exp` corto + refresh, o sesión con `cred_version`? ¿Qué pasa con una tarea larga si el usuario pierde el permiso a mitad — abortar o terminar con el scope viejo?

---

### 1.3 🔴 Enforcement de presupuesto **pre-flight** (no solo post-hoc)
**Problema.** §3.8/§9 mide el consumo **después** de cada llamada (`usage_event`). Un límite **hard** que solo se evalúa post-hoc **no impide** sobrepasarse: la llamada cara ya se hizo.

**Por qué importa.** El "hard bloquea" del criterio de aceptación es ineficaz si se chequea tarde; un solo prompt grande puede saltarse el tope.

**Recomendación.** Control **pre-flight**: antes de cada llamada, estimar costo (tokens estimados × precio) y **rechazar** si excede el saldo; **reconciliar** con el costo real al terminar. Para tareas multi-paso (agentes), chequear el presupuesto **entre pasos**. Considerar **reservas** (hold) para tareas largas.

**Dudas.** ¿Tope por request, por día y por mes? ¿Quién puede subir el tope (admin)? ¿Soft = avisa y deja seguir; hard = corta a mitad de tarea o solo impide empezar?

---

### 1.4 🔴 Atribución de consumo de trabajo **no iniciado por un usuario**
**Problema.** El ledger asume `user_id` por evento. Pero **Hermes (supervisor)**, los **cron jobs**, el **indexado de KB/embeddings** y el **triage de mail programado** generan llamadas LLM **sin un usuario solicitante directo**.

**Por qué importa.** Si se atribuyen mal (o se pierden), el $ por usuario miente y el costo de fondo queda invisible.

**Recomendación.** Buckets de atribución: `user`, `system:hermes`, `system:cron(job_id→owner)`, `system:kb-index`, `system:mail-triage(user_id)`. Los cron/mail se imputan al **dueño** del job; Hermes/KB-index van a un bucket **sistema** reportado aparte.

**Dudas.** ¿El costo "sistema" se prorratea entre usuarios o se reporta como overhead de la org?

---

### 1.5 🔴 Persistencia de los fixes de Hermes vs. `deploy-v4.sh` (re-sync)
**Problema.** Hermes aplica fixes a skills "con commit/rollback", pero el deploy de OpenClaw es **`deploy-v4.sh` (re-sync + rebuild)** desde la fuente (`openclaw-agent/workspace/`). Un fix **hot-aplicado** al contenedor se **pierde** en el próximo deploy si no aterriza en la **fuente de verdad** (el repo).

**Por qué importa.** Sin esto, Hermes "arregla" algo que se revierte solo en el siguiente rebuild → bug fantasma recurrente.

**Recomendación.** El fix aprobado debe generar un **commit/PR a `Alinea-OpenClaw`** (la fuente que hornea), no solo un parche en runtime. Pipeline: propuesta → aprueba admin → **PR al repo** (+ aplica en runtime para efecto inmediato) → CI/canary → merge. Rollback = revert del commit.

**Dudas.** ¿Hermes abre PR automático al repo o deja el diff para que un humano lo commitee? ¿Hay tests por skill que el fix deba pasar antes de aplicar?

---

### 1.6 🟠 SSO de Huly: el Core probablemente **no es un OIDC Provider** hoy
**Problema.** §3.5/§7 asume "SSO OpenID Connect contra el Auth del Core". Ser **IdP OIDC** (no cliente) es trabajo no trivial: endpoints `/.well-known/openid-configuration`, `authorize`, `token`, `userinfo`, JWKS, consent. aioncore hoy es auth propio, no un IdP.

**Por qué importa.** Es un supuesto grande escondido en una línea; puede ser tan costoso como una feature entera y bloquea la Fase D (Huly login único).

**Recomendación.** Decidir entre: (a) implementar un **OIDC Provider mínimo** en el Core; (b) meter un **IdP dedicado** (Keycloak/Zitadel/Authelia) como fuente de identidad para Alinea **y** Huly; (c) arrancar Huly con su login propio + provisioning de usuarios por API (sin SSO) y dejar SSO para después. Opción (b) o (c) reducen riesgo.

**Dudas.** ¿SSO es bloqueante para Fase D o aceptamos provisioning sin SSO al inicio?

---

## 2. Profundización por feature

### 2.1 Router de modelos — calidad, failover y costo del cache (🟠)
El blueprint dice "el más barato que **cumpla la calidad**" pero **no define cómo se mide la calidad** ni el **failover**.
- **Cómo decidir calidad/ruta:** empezar con una **tabla declarativa por tipo de subtarea** (extracción→MiniMax, razonamiento ingeniería→GLM-5.1, artefacto diseñado→z.ai Agents, crítico→Claude) en vez de un clasificador. Evolucionar con **evals offline** (golden set por tipo de entregable) antes de cambiar defaults.
- **Failover/retry:** si el provider está caído / rate-limited / responde basura → **reintento en el siguiente modelo** de la cadena, con backoff. Registrar el fallback (afecta consumo).
- **Cache no siempre conviene:** `cache-write` tiene **premium**; cachear un prefijo que **no se reutiliza** cuesta **más**. El builder debe cachear solo prefijos **estables y reutilizados** (system/skills/KB/proyecto), no el turno volátil.

### 2.2 Prompt caching — invalidación por cambio de contenido (🟠)
El TTL maneja el tiempo, **no** los cambios de contenido. Si editas un doc de KB/proyecto, el prefijo cacheado queda **stale**.
- **Recomendación:** la **clave de cache** debe incluir una **versión del contenido** (hash/`kb_version`/`project_docs_version`). Al cambiar la KB/proyecto, cambia la clave → cache-miss controlado (no servir contexto viejo). Coordinar con el índice sqlite-vec (misma versión).

### 2.3 Agentic Mail / Zero — verificar realidad de integración (🟠)
- **¿Zero expone MCP server propio?** Confirmar (el blueprint lo asume). Si no, se integra por su API/DB y se construye un MCP wrapper.
- **Multi-tenant en Zero:** Zero tiene su **propia** auth/cuentas. Hay que mapear `Zero account ↔ Alinea user_id` y garantizar que el MCP **siempre** opera sobre la cuenta del `user_id` del token (no la primera cuenta). Riesgo real de fuga si el wrapper no scopea.
- **Push vs poll:** triage en tiempo real necesita **webhooks/IDLE**; definir si es on-demand, cron, o push.
- **Recomendación de fase:** arrancar con el **fallback IMAP/SMTP (Hermes-email)** por usuario (más simple, multi-tenant trivial) y subir a Zero cuando el hierro (§6) y el mapeo multi-tenant estén resueltos.

### 2.4 Huly + índice KB — embeddings, conflictos y embed en la app (🟠)
- **Embeddings:** elegir modelo (local vs API), **idioma español**, costo y dimensión (afecta sqlite-vec). El embeddings también **consume** → al ledger (bucket `system:kb-index`).
- **Fuente de verdad / conflictos:** si un doc vive en Huly **y** se indexa en el Core, definir quién manda y cómo se resuelven ediciones concurrentes. El sync debe ser **idempotente** y respetar ACL en cada lado.
- **Embed en Electron/WebUI:** ¿Huly va **iframe/embed** dentro de Alinea o como app aparte enlazada? El embed con SSO en Electron tiene fricciones (cookies/CSP). Definirlo.
- **KB3 inmutable:** versionar su importación (re-import al cambiar KB3 horneada) sin duplicar entradas.

### 2.5 Proyectos + WorkDrive — sync bidireccional y membership (🟠)
- **TrueSync vs MCP:** el usuario ya usa **WorkDrive TrueSync** local. Si el agente escribe vía el **MCP WorkDrive** y el usuario edita vía TrueSync, hay **conflicto de versiones**. Definir estrategia (lock, "última gana", o carpeta del agente separada).
- **Indexado de project_docs:** ¿cuándo se (re)indexan para el RAG — al adjuntar, al cambiar, on-demand? Evitar duplicar con la KB global.
- **Membership de proyecto:** ver §1.1 — un proyecto necesita dueño + miembros, no solo `rol_scope`.

### 2.6 Visor DXF — `dxf-parser` **no renderiza** (🟠)
- `dxf-parser` solo **parsea** a JSON; **no dibuja**. Falta un **renderer**: `three-dxf` o un canvas 2D propio sobre el parse. Considerar `@mlightcad/dxf-*` u opciones más completas.
- **Cobertura de entidades:** LINE/LWPOLYLINE/CIRCLE/ARC/TEXT/MTEXT/DIMENSION/INSERT(blocks)/HATCH; los **bloques/`INSERT`** y **xrefs** son los que más rompen. Definir alcance mínimo.
- **Performance/DoS:** DXF grandes (planos MEP) → **web worker** para parse + render diferido; límite de tamaño; manejo de archivos corruptos (no colgar la UI).
- **Medición:** snapping a endpoints/intersecciones y **escala correcta** (unidades del header `$INSUNITS`) para que ML/m² sean reales.

### 2.7 Command Center — health en tiempo real y RBAC de aprobación (🟡)
- **Health en vivo** por WS (no polling): estado del gateway, latencia, tareas activas, tasa de error.
- **¿Quién aprueba fixes de Hermes?** ¿solo `admin` o también un rol "lead"? Auditar cada aprobación/acción.
- **Acciones:** reiniciar gateway / recargar skills / revocar device — todas auditadas.

---

## 3. Gaps transversales (operación) que faltaban

| # | Gap | Por qué importa | Recomendación |
|---|---|---|---|
| 3.1 🔴 | **Migración a multiusuario** | Hoy hay modo `--local`/single-user y data existente (chats/users). No hay plan de migración. | Script de migración: backfill `user_id`/owner en chats/archivos existentes; flag de corte `AIONUI_MULTIUSER`; plan de rollback. |
| 3.2 🔴 | **Suite de tests de segregación (seguridad) en CI** | El acceptance "manual por par (rol,recurso)" no escala ni previene regresiones. | **Matriz automatizada** (user×rol×recurso×acción) como test suite que **corre en CI** y **bloquea merge** si una celda "deny" pasa a "allow". |
| 3.3 🟠 | **Paridad Desktop vs WebUI** | Mail/Huly/proyectos/ledger son server-side; el Electron desktop también debe hablar con el VPS y propagar identidad. | Definir que desktop usa el mismo Core/gateway remoto; identidad firmada también en IPC→Core→gateway. |
| 3.4 🟠 | **Sistema de notificaciones in-app** | Resultados asíncronos (borradores de mail listos, fix de Hermes pendiente, presupuesto excedido) necesitan avisar al usuario. Huly notifica lo humano, no lo de Alinea. | Canal de notificaciones del Core (WS) + UI; o delegar a Huly si aplica. Definir qué eventos notifican. |
| 3.5 🟠 | **Rotación de la master key + backups/DR** | "master key en env" sin rotación = compromiso total de secretos; falta DR de SQLite + Postgres(Zero) + DBs de Huly + índice KB. | **Envelope encryption** (DEK por usuario cifrada con la master KEK) para rotar sin re-cifrar todo; rutina de backup/restore probada de todas las DBs. |
| 3.6 🟠 | **Guardrails de salida (no solo ACL de entrada)** | El ACL filtra lo que el agente **recupera**, pero el agente podría **filtrar** datos en su respuesta a un usuario de menor privilegio (prompt injection / contexto cruzado). | Verificación de salida (clasificación/etiqueta del contenido vs. rol del destinatario) + minimización: pasar al modelo solo lo permitido para ese request. |
| 3.7 🟡 | **Observabilidad de flujos multi-agente** | Depurar una tarea que cruza Core→OpenClaw→MCP→Hermes es difícil sin trazas. | `trace_id` por tarea propagado a agentes/MCPs; logs correlacionados; métricas por motor. |
| 3.8 🟡 | **i18n de la UI nueva** | AGENTS.md exige i18n; Command Center, DXF, Proyectos, Consumos deben estar localizados. | Claves i18n desde el inicio en cada módulo nuevo (en-US + zh-CN mínimo). |
| 3.9 🟡 | **z.ai Agents API: integración real** | Los Agents (slides/docs) suelen ser **asíncronos** (job → poll → artefacto). | Adaptador con manejo de job async, descarga de artefacto, timeouts, errores y costo al ledger. |
| 3.10 🟡 | **Rate limiting / abuso por usuario** | El tope en $ no frena bursts ni abuso; faltan límites de tasa. | Rate limit por usuario/endpoint además del presupuesto $. |

---

## 4. Ajustes sugeridos al "Orden de build" (§4 del Blueprint)

Insertar/explicitar (sin romper la secuencia):

- **En Fase B (cimientos):**
  - Paso 4 → añadir **revocación + refresh de token** (§1.2) como parte de "identidad por request".
  - Paso 5 → el modelo de acceso debe ser **rol+etiqueta AND ownership/membership AND project-scope** (§1.1), no solo rol/etiqueta.
  - Nuevo paso 5.b → **suite de tests de segregación en CI** (§3.2) **junto con** el RBAC (no después).
  - Nuevo paso 0 de fundaciones → **plan/script de migración a multiusuario** (§3.1) antes de cortar a multiuser.
- **Antes de Fase D (Huly):** decidir **estrategia de SSO/IdP** (§1.6) — puede volverse su propia mini-fase.
- **En Fase E (ledger):** mover el **enforcement pre-flight** (§1.3) y los **buckets de atribución** (§1.4) a la definición del ledger, no como extra.
- **Transversal (todas las fases):** notificaciones (§3.4), guardrails de salida (§3.6), i18n (§3.8), observabilidad (§3.7).

---

## 5. Preguntas que el Blueprint asume resueltas (y conviene confirmar)

1. **Acceso horizontal:** ¿hay equipos/grupos y ownership de recursos, o todo es por rol? (§1.1)
2. **Token:** ¿`exp` corto + refresh + revocación, o sesión con `cred_version`? ¿tareas largas vs. cambio de permiso? (§1.2)
3. **Presupuesto:** ¿enforcement pre-flight + reservas? ¿topes por request/día/mes? (§1.3)
4. **Costo de fondo:** ¿cómo se imputa Hermes / cron / KB-index? (§1.4)
5. **Hermes fixes:** ¿PR automático a `Alinea-OpenClaw` + tests por skill antes de aplicar? (§1.5)
6. **SSO Huly:** ¿OIDC Provider en el Core, IdP dedicado, o provisioning sin SSO al inicio? (§1.6)
7. **Zero:** ¿expone MCP? ¿cómo se mapea cuenta Zero ↔ `user_id` sin fuga? ¿o arrancamos con IMAP fallback? (§2.3)
8. **WorkDrive:** ¿cómo se evita el conflicto MCP ↔ TrueSync? (§2.5)
9. **DXF:** ¿qué renderer y qué cobertura de entidades mínima? (§2.6)
10. **Migración:** ¿plan para data existente y corte single→multi-user? (§3.1)

---

> **Resumen para José:** los baselines están bien y la dirección es correcta. Lo que **faltaba** y es
> riesgoso vive en §1 (acceso horizontal, ciclo de vida del token, presupuesto pre-flight, atribución de
> costo de fondo, persistencia de fixes de Hermes, realidad del SSO de Huly). Recomiendo **bloquear §1.1
> y §1.2 antes de tocar mail/proyectos/KB**, porque definen si la segregación realmente funciona.
