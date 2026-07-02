# Alinea Copiloto — build en CI, deploy en Box A

Este directorio contiene el Dockerfile canónico, el script de deploy y el
mapa de lo que vive hoy en `/opt/alinea/ingelmec/deploy/` en Box A
(`5.75.234.147`). El objetivo: **cero build on-box**. La imagen se construye
en GitHub Actions y se publica a GHCR; Box A solo hace `docker pull` + swap.

## Cómo construye CI

Workflow: [`.github/workflows/build-image.yml`](../.github/workflows/build-image.yml).

Triggers:
- `push` a `main` de este repo (Alinea-Copilot).
- `workflow_dispatch` manual, con inputs opcionales `core_ref` y
  `frontend_ref` para construir combinaciones puntuales de ambos repos
  (por ejemplo, probar una rama del Core contra el frontend en `main`).
  También se puede disparar sobre una rama de feature (ej. `feat/ci-ghcr`)
  para validar el pipeline antes de mergear.

Pasos del job (`build-and-push`):
1. `actions/checkout` de `JoseTabora93/Alinea-Copilot` (este repo, con
   `deploy/Dockerfile`) en `build/Alinea-Copilot`.
2. `actions/checkout` de `JoseTabora93/AlineaCopilot-Core` en
   `build/AlineaCopilot-Core`.
3. Copia `deploy/Dockerfile` a la raíz del contexto de build (`build/`),
   igual que en `docker-compose.yml` on-box (`dockerfile: ../Dockerfile`).
4. `docker/setup-qemu-action` + `docker/setup-buildx-action`.
5. Login a GHCR con `GITHUB_TOKEN` (no requiere PAT — ambos repos son
   públicos y `packages: write` alcanza para pushear a GHCR bajo la cuenta
   del actor).
6. Build con `docker/build-push-action`, usando:
   - `cache-from/cache-to: type=gha` — cachea **capas de Docker** entre
     corridas. Esto cubre el stage `core-build` (compilación de Rust)
     mientras `AlineaCopilot-Core/` no cambie de contenido — buildx detecta
     que el `COPY AlineaCopilot-Core/ .` es idéntico y reusa la capa
     completa de `cargo build --release`, evitando recompilar desde cero.
   - `actions/cache` adicional sobre `~/.cargo/registry` y `~/.cargo/git`
     del runner, como red de respaldo si en el futuro el Dockerfile pasa a
     usar `RUN --mount=type=cache` para cargo (hoy no lo usa, para mantener
     el Dockerfile **byte a byte igual** al canónico on-box).
7. Push de dos tags: `latest` y `core-<sha-corto>_ui-<sha-corto>` (SHAs
   cortos de HEAD de cada repo en el momento del build).

## Cómo se despliega (Box A)

El deploy en Box A **no cambia con este cambio** salvo por el origen de la
imagen (antes: build local; ahora: pull de GHCR). Pasos:

```bash
# En Box A, como root, dentro de /opt/alinea/ingelmec/deploy/ (o donde
# se copie este script):
./deploy_pull.sh                          # dry-run con tag "latest"
DEPLOY_APPLY=1 ./deploy_pull.sh           # ejecuta de verdad
DEPLOY_APPLY=1 ./deploy_pull.sh core-abc1234_ui-def5678   # tag específico
```

`deploy_pull.sh` (ver script en este mismo directorio):
1. `docker pull` de la imagen (tag `latest` por defecto, o el que se pase).
2. Para el contenedor `alinea-prod` actual y lo renombra a
   `alinea-prod-rollback-<timestamp>` (no lo borra todavía).
3. Levanta un nuevo `alinea-prod` con la imagen nueva, **reutilizando el
   volumen `alinea-prod-data`** (los datos persisten) y el mismo mapeo de
   puertos `127.0.0.1:3001->3000`.
4. Healthcheck: hace poll a `http://127.0.0.1:3001/` hasta 15 veces (2s de
   intervalo) esperando una respuesta 2xx/3xx.
5. Si el healthcheck falla: rollback automático — borra el contenedor
   nuevo, restaura el contenedor viejo (renombrándolo de vuelta) y lo
   arranca. Si tiene éxito: dice qué hacer con el respaldo (`docker rm`
   manual, no automático, para dar margen de observación).
6. **Es dry-run por defecto.** Solo actúa con `DEPLOY_APPLY=1`. Este
   subagente NO lo ejecutó contra Box A — queda como herramienta manual
   para José/Fable, o para automatizar después si se decide (fuera de
   alcance de esta tarea D2).

El nginx existente en Box A (`copilot.ingelmec.ai` → `127.0.0.1:3001`) y
los servicios `hermes-*` / `ingelmec-kb-mcp` **no se tocan** por este
cambio — el contrato de puerto/volumen se mantiene idéntico.

## Mapa de `/opt/alinea/ingelmec/deploy/` en Box A (sin secretos)

Verificado por lectura SSH (`ssh root@5.75.234.147`, solo lectura, sin
escrituras ni reinicios). Contenido relevante:

| Archivo/dir | Qué es |
|---|---|
| `Dockerfile` | El canónico — ahora versionado aquí en `deploy/Dockerfile`, idéntico. |
| `docker-compose.yml` | Stack completo: `alinea-core` (build `./build` + `../Dockerfile`) + `mcp-zoho`, `mcp-dxf-takeoff`, `mcp-docgen`. Puerto `127.0.0.1:3001:3000`. Volumen `alinea-data` (nota: el contenedor real corriendo se llama `alinea-prod` y su volumen `alinea-prod-data` — nombres de la instancia productiva, distintos de los defaults del compose de plantilla). |
| `build/` | Contiene los checkouts locales `AlineaCopilot-Core/` y `Alinea-Copilot/` que usaba el build on-box (ya no se usan tras este cambio — la imagen viene de GHCR). |
| `nginx-copilot-ingelmec.conf` | Vhost para `copilot.ingelmec.ai` en el nginx existente del host (coexiste con Hermes, no toca su :443). Proxy a `127.0.0.1:3001`, WebSocket habilitado, `client_max_body_size 100M`. |
| `Caddyfile` / `Caddyfile.tpl` | Alternativa para un VPS limpio sin nginx previo (no es el caso de Box A). |
| `provision.sh` | Script de aprovisionamiento por cliente (`./provision.sh <slug> [dominio]`): clona ambos repos, `docker compose build && up`, configura nginx+certbot o Caddy según corresponda. Sigue siendo útil para nuevas instalaciones desde cero; para Box A el flujo diario pasa a ser `deploy_pull.sh`. |
| `.env.example` | Plantilla de secrets (`OPENROUTER_API_KEY`, `ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN`, `TELEGRAM_BOT_TOKEN`, `AIONUI_JWT_SECRET`) — vacía, sin valores reales. |
| `.env`, `.env.zoho`, `.gbrain_secrets`, `.openrouter_keys`, `.zoho_wd_creds.json` | **Secrets reales — NO leídos, NO copiados, NO versionados.** Permanecen solo en el box. |
| `mcp/` | Directorios de build de los MCPs internos (`zoho`, `dxf_takeoff`, `docgen`) — fuera de alcance de esta tarea (D2 es solo la imagen `alinea-copiloto`). |
| `openclaw-agent/` | Workspace de OpenClaw, fuera de alcance de esta tarea. |
| `*.log` (build*.log, test.log, etc.) | Logs históricos de builds on-box anteriores — no versionados. |

## Runtime actual verificado (2026-07-02)

- Contenedor: `alinea-prod`
- Imagen corriendo: `alinea-copiloto:fase2.1`
- Puerto: `127.0.0.1:3001->3000/tcp`
- Volumen: `alinea-prod-data`
- Healthcheck manual (`curl 127.0.0.1:3001/`): `200 OK`

## Seguridad / alcance

- Acceso a Box A durante esta tarea fue **estrictamente de solo lectura**
  (`cat`, `ls`, `docker ps/images/volume ls`, `curl` de healthcheck). No se
  escribió, reinició ni tocó ningún archivo, contenedor, ni servicio.
- El Dockerfile en este directorio fue escaneado antes de commitear
  (`grep` de patrones de tokens/secrets/passwords) — no contiene ninguno.
  Todo lo sensible se inyecta en runtime vía `--env-file`/`.env`, nunca en
  build ni en la imagen.
- `deploy_pull.sh` no fue ejecutado contra Box A por este subagente — es
  dry-run por defecto y requiere `DEPLOY_APPLY=1` explícito para actuar.
