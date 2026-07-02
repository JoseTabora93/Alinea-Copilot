#!/usr/bin/env bash
# deploy_pull.sh — deploy de la imagen Alinea Copiloto construida en CI (GHCR)
# hacia el contenedor `alinea-prod` en Box A (5.75.234.147).
#
# Reemplaza el flujo de build on-box: aquí solo se hace `docker pull` +
# swap del contenedor, conservando el volumen de datos `alinea-prod-data`.
# Incluye healthcheck post-swap y rollback automático a la imagen previa
# si el healthcheck falla.
#
# DRY-RUN POR DEFECTO: imprime lo que haría, no ejecuta nada destructivo.
# Para ejecutar de verdad: DEPLOY_APPLY=1 ./deploy_pull.sh [tag]
#
# Uso:
#   ./deploy_pull.sh                    # dry-run, usa tag "latest"
#   ./deploy_pull.sh core-abc1234_ui-def5678   # dry-run, tag específico
#   DEPLOY_APPLY=1 ./deploy_pull.sh     # ejecuta de verdad, tag "latest"
#
# Este script está pensado para correr EN el box (Box A). No se ejecuta
# desde este workflow/repo automáticamente — es una herramienta manual
# hasta que se decida automatizar el paso de deploy (fuera de alcance D2).

set -euo pipefail

REGISTRY="ghcr.io"
IMAGE_REPO="josetabora93/alinea-copiloto"
TAG="${1:-latest}"
IMAGE="${REGISTRY}/${IMAGE_REPO}:${TAG}"

CONTAINER_NAME="alinea-prod"
VOLUME_NAME="alinea-prod-data"
HOST_PORT="3001"
HEALTH_URL="http://127.0.0.1:${HOST_PORT}/"
HEALTH_RETRIES=15
HEALTH_INTERVAL=2

DRY_RUN=1
if [ "${DEPLOY_APPLY:-0}" = "1" ]; then
  DRY_RUN=0
fi

log() { echo "[deploy_pull] $*"; }

run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "  DRY-RUN would run: $*"
  else
    log "running: $*"
    eval "$@"
  fi
}

log "Imagen objetivo: ${IMAGE}"
log "Modo: $([ "$DRY_RUN" = "1" ] && echo 'DRY-RUN (nada se ejecuta)' || echo 'APLICANDO CAMBIOS')"

# --- 0. Verificar que el contenedor y volumen actuales existen ---
if ! docker inspect "${CONTAINER_NAME}" >/dev/null 2>&1; then
  log "ADVERTENCIA: no existe un contenedor '${CONTAINER_NAME}' corriendo. ¿Primera instalación? Este script asume un swap sobre uno existente."
fi

PREVIOUS_IMAGE=""
if docker inspect "${CONTAINER_NAME}" >/dev/null 2>&1; then
  PREVIOUS_IMAGE=$(docker inspect --format '{{.Config.Image}}' "${CONTAINER_NAME}")
  log "Imagen actualmente corriendo en ${CONTAINER_NAME}: ${PREVIOUS_IMAGE}"
fi

if ! docker volume inspect "${VOLUME_NAME}" >/dev/null 2>&1; then
  log "ADVERTENCIA: el volumen '${VOLUME_NAME}' no existe todavía. Se creará automáticamente al levantar el contenedor nuevo (docker lo crea on-demand), pero verifica que sea el nombre correcto antes de aplicar."
fi

# --- 1. Pull de la nueva imagen ---
run "docker pull ${IMAGE}"

# --- 2. Swap: parar+renombrar el viejo, levantar el nuevo con el mismo volumen ---
OLD_BACKUP_NAME="${CONTAINER_NAME}-rollback-$(date +%Y%m%d%H%M%S)"

run "docker stop ${CONTAINER_NAME} || true"
run "docker rename ${CONTAINER_NAME} ${OLD_BACKUP_NAME} || true"

run "docker run -d --name ${CONTAINER_NAME} \\
  --restart unless-stopped \\
  -p 127.0.0.1:${HOST_PORT}:3000 \\
  -v ${VOLUME_NAME}:/data \\
  --env-file /opt/alinea/ingelmec/deploy/.env \\
  ${IMAGE}"

# --- 3. Healthcheck post-swap ---
log "Esperando healthcheck en ${HEALTH_URL} (hasta $((HEALTH_RETRIES * HEALTH_INTERVAL))s)..."

HEALTH_OK=0
if [ "$DRY_RUN" = "1" ]; then
  echo "  DRY-RUN would poll: curl -fsS ${HEALTH_URL} up to ${HEALTH_RETRIES} times"
  HEALTH_OK=1
else
  for i in $(seq 1 "${HEALTH_RETRIES}"); do
    if curl -fsS -o /dev/null "${HEALTH_URL}"; then
      HEALTH_OK=1
      log "Healthcheck OK en intento ${i}."
      break
    fi
    sleep "${HEALTH_INTERVAL}"
  done
fi

# --- 4. Rollback si falla el healthcheck ---
if [ "${HEALTH_OK}" != "1" ]; then
  log "HEALTHCHECK FALLÓ. Iniciando rollback a la imagen previa..."
  run "docker stop ${CONTAINER_NAME} || true"
  run "docker rm ${CONTAINER_NAME} || true"
  if [ -n "${PREVIOUS_IMAGE}" ]; then
    run "docker rename ${OLD_BACKUP_NAME} ${CONTAINER_NAME}"
    run "docker start ${CONTAINER_NAME}"
    log "Rollback aplicado. ${CONTAINER_NAME} corriendo de nuevo con ${PREVIOUS_IMAGE}."
  else
    log "No había imagen previa registrada — no se puede hacer rollback automático. Revisa manualmente."
  fi
  echo "RESULTADO: FALLÓ el deploy, rollback ejecutado (o requerido manual si no había previa)." >&2
  exit 1
fi

# --- 5. Limpieza del backup si todo salió bien ---
log "Deploy exitoso. Contenedor de respaldo conservado como '${OLD_BACKUP_NAME}' (bórralo manualmente tras confirmar estabilidad)."
run "# docker rm ${OLD_BACKUP_NAME}   # <- descomentar manualmente cuando quieras limpiar el respaldo"

log "RESULTADO: LISTO. ${CONTAINER_NAME} corriendo con ${IMAGE}."
