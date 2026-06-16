# Alinea Copiloto — Fase 2 · Guía de construcción (how-to + qué probar)
> Complemento operativo de `Alinea_FASE2_Blueprint.md`. Para cada feature: pasos concretos, patrón a seguir, y la verificación de "100% funcionando" (no superficial). Lenguaje: español. Stack fijo (Rust/Electron-React/OpenClaw).
>
> Baseline autorado por Claude Code (the-architect). Ver `Alinea_FASE2_Profundizacion.md` para gaps y profundización añadidos por Cursor.

## 0. Flujo de trabajo (3 repos)
- **Ramas y PRs:** nada directo a `main`. Cada feature en su rama; PR por repo. Escanear secretos antes de pushear (regla [[push-todo-github]]).
- **Repos:** `AlineaCopilot-Core` (Rust, lo estructural) · `Alinea-Copilot` (frontend React) · `Alinea-OpenClaw` (skills/MCP). Infra (Zero/Huly/Hermes) = compose en el VPS, versionado en `Alinea-OpenClaw/infra/`.
- **Deploy OpenClaw:** `deploy-v4.sh` (re-sync + rebuild). MCPs: scripts `apply_*.sh` por MCP (ej. el patrón de `patches/` de Fase 1).
- **Regla de oro:** cada feature **se prueba con su criterio de aceptación** antes de cerrar el PR. Ver §"Checklist no-superficial".

---

## 1. Identidad + segregación (CIMIENTO — primero)
**Construir (Core):**
1. Al autenticar, generar un **token de contexto** firmado Ed25519: `{user_id, rol[], project_id?, scopes, exp}` (PASETO o JWT). Clave privada en el Core; pública distribuida a OpenClaw/Hermes.
2. **Gateway:** incluir ese token en **cada** mensaje a un agente (no solo en connect). Extender `remoteAgentTypes` + el handler del gateway.
3. **Agente (OpenClaw):** middleware que **valida la firma**, extrae `{user_id, rol}`, y **scopea TODO** (archivos, KB, memoria, mail) a esa identidad. Sin token válido → error + audit.
4. **RBAC:** tablas `roles`, `user_roles`, `acl_policy(etiqueta→roles)`. Etiquetar docs de KB y skills.

**Probar:** tabla de tests por par (rol, recurso): `gerencia` recupera `confidencial-gerencia` ✅, `tecnica` lo recupera ❌ (denegado+auditado). Request con token manipulado → rechazado. Memoria de user A no aparece en contexto de user B.

---

## 2. Router de modelos + caching (Core)
**Construir:** adaptadores `zai`/`minimax`/`claude`/`openrouter`; función `route(subtask, quality_pref) → (provider, model)` con la regla "más barato que cumpla". Override `económico/máxima` en `IProvider`/UI. Prompt-builder que ordena `[estable]→[volátil]` y marca `cache_control` donde el provider lo soporte.
**Probar:** una extracción larga va a MiniMax; un razonamiento crítico a Claude; un slide a z.ai Agents. Repetir un turno con el mismo prefijo → `cache_read > 0` (no write). El override "económico" cambia el modelo elegido.

---

## 3. Command Center (frontend)
**Construir:** montar `RemoteAgentManagement.tsx` (quitar el redirect `?tab=remote→local`); vistas: agentes/gateways + salud, aprobación de devices, uso por agente (de §8), logs, y panel de **fixes de Hermes** pendientes. Gating solo-admin.
**Probar:** un admin ve OpenClaw+Hermes con estado vivo; un member no accede; aprobar/rechazar un device y un fix de skill funciona end-to-end.

---

## 4. Hermes (supervisor)
**Construir:** Hermes como `RemoteAgentConfig` (wss+Ed25519). Pipeline: telemetría anonimizada → propuesta de fix (diff de skill) → cola en Command Center → admin aprueba → aplica con commit/rollback (patrón curator/git).
**Probar:** inyectar un error recurrente de skill → Hermes propone un fix → aparece en Command Center → aprobar → el skill cambia y hay rollback. Verificar que Hermes **no** ve contenido confidencial (solo agregados).

---

## 5. Agentic Mail = Zero (mail-0/zero)
**Construir:** desplegar Zero en el VPS (`docker-compose.prod.yaml` + Postgres). Conectar cuentas por **OAuth** (Gmail/Outlook/Zoho) o IMAP; creds **cifradas por usuario** en el Core. Exponer Zero a OpenClaw vía su **MCP** (`MCP.md`/`AGENT.md`). Skill `mail` que: triage → insights de contacto (a CRM/KB) → **borradores** (nunca auto-envía).
**Probar:** OpenClaw lista prioridades del buzón del usuario, redacta 3 borradores; el usuario aprueba/edita/envía; un segundo usuario **no** ve ese buzón. Fallback Hermes-email (IMAP) si Zero pesa.

---

## 6. Proyectos + carpetas WorkDrive
**Construir (Core):** tabla `projects` (+ `project_chats`, `project_docs`). RAG: los `project_docs` se indexan (sqlite-vec) y entran como contexto en los chats del proyecto. **Conector WorkDrive:** la carpeta del proyecto usa el MCP `zoho_workdrive_download/upload` (ya existe) para leer/escribir.
**Frontend:** unificar "Work in a project" para usar `/api/fs/*` en WebUI (no el diálogo nativo). Vista de proyecto (docs+chats+contexto).
**Probar:** crear proyecto → adjuntar 2 docs → un chat nuevo del proyecto los cita sin re-subir; mapear una carpeta WorkDrive → el agente baja/sube ahí; un técnico no ve el proyecto de gerencia.

---

## 7. Huly (humano) + índice KB del Core (agentes)
**Construir:** Huly self-host (`setup.sh` + compose; OpenID Connect contra el Auth del Core = un solo login). **Índice KB del Core (sqlite-vec):** importer de la KB3 (inmutable) + docs vivos; ACL por rol/etiqueta. **Conector Huly↔Core:** webhooks de Huly + job del Core que indexa los docs que los agentes deben ver (respetando permisos). La KB3 normas **no** se suben a Huly.
**Probar:** login único (Alinea→Huly por SSO); un agente cita una norma de KB3 con fuente; editar un doc vivo en la UI lo deja consultable sin re-hornear; un rol sin permiso no lo recupera. ⚠️ Requiere el VPS subido (16GB para Huly).

---

## 8. Visor DXF (frontend)
**Construir:** `'dxf'` en `PreviewContentType` + `FILE_EXTENSION_MAP`; `DxfViewer.tsx` (`dxf-parser` + canvas/Three.js): pan/zoom, toggle de capas, herramienta de medición (distancia, área, cota), unidades del header. Branch en `PreviewPanel.tsx`.
**Probar:** abrir IE-201, alternar capas, medir un tramo (ML) y un área (m²) coherentes con el plano; sin AutoCAD.

---

## 9. Ledger de consumos $ (Core)
**Construir:** emitir `usage_event` en cada llamada LLM (los 3 motores usan llaves de Alinea vía Core → medición directa). Tabla de precios → `$`. Agregación por usuario/modelo/motor/fecha. Límites $ (soft/hard) con reset mensual. Panel admin + "mi consumo".
**Probar:** una tarea multi-motor genera 3 eventos al mismo `user_id` con cache-read/write; el panel suma bien; el límite hard bloquea y el soft avisa.

---

## Checklist "NO superficial" (criterio de rechazo)
Un feature NO se da por hecho si:
- ❌ No respeta la **segregación** (otro rol/usuario puede ver/usar algo que no debe).
- ❌ El entregable de IA es **genérico** (BOM/AO sin el detalle del estándar Ingelmec — ver skills `bom`/`alcance`/`memoria-calculo`).
- ❌ El consumo **no se atribuye** al `user_id` real.
- ❌ Falta el **criterio de aceptación** probado (no "parece que sirve").
- ❌ Se dejó el entregable **solo en el chat** (regla: carpeta + GitHub siempre).

## Convenciones
- **Roles:** `admin · gerencia · tecnica · comercial · financiera · ingenieria`.
- **Etiquetas KB/skills:** `público · interno · confidencial-<área>`.
- **Naming entregables:** `<PROYECTO>_<Tipo>_RevXX.xlsx` en `07. PREVENTA/REVxx/`.
- **Persistencia:** todo plan/guía/blueprint → repo (`Alinea-OpenClaw/fase2/`) + `~/Downloads` + push.
