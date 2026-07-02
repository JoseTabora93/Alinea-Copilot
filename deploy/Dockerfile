# Alinea Copiloto — imagen única (Core Rust + WebUI).
# Build context = un dir que contenga: ./AlineaCopilot-Core y ./Alinea-Copilot
# (en CI, el workflow build-image.yml hace checkout de ambos repos a esa
# estructura antes de invocar `docker buildx build`).
#
# Versionado como el "Dockerfile canónico" — replica byte a byte (salvo
# comentarios) el que corre hoy on-box en /opt/alinea/ingelmec/deploy/Dockerfile
# en Box A (5.75.234.147). NO contiene secretos: todo lo sensible (Zoho,
# OpenRouter, JWT) se inyecta en runtime vía env_file/.env, nunca en build.

# ---- Stage 1: aioncore (Rust) desde el fork del Core ----
FROM rust:1.95-slim AS core-build
ENV CARGO_BUILD_JOBS=3
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
RUN apt-get update && apt-get install -y pkg-config libssl-dev git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /core
COPY AlineaCopilot-Core/ .
RUN cargo build --release --bin aioncore
# -> /core/target/release/aioncore  (linux-x64)

# ---- Stage 2: WebUI (renderer SPA + web-cli standalone) ----
FROM oven/bun:1 AS web-build
WORKDIR /app
COPY Alinea-Copilot/ .
# Colocar el binario del core donde pack-web-cli lo espera (bypassa la descarga de GitHub)
COPY --from=core-build /core/target/release/aioncore \
     resources/bundled-aioncore/linux-x64/aioncore
RUN chmod +x resources/bundled-aioncore/linux-x64/aioncore
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN bun install --frozen-lockfile
# Build del renderer SPA (out/renderer). pack-web-cli NO lo hace (packRunsRendererItself=false).
RUN bunx electron-vite build --config packages/desktop/electron.vite.config.ts
# Empaqueta web-cli (ejecutable bun + SPA + bundled-aioncore) -> dist-web-cli/staging/aionui-web
RUN apt-get update && apt-get install -y wget curl && rm -rf /var/lib/apt/lists/*
RUN node scripts/pack-web-cli.js
COPY --from=core-build /core/target/release/aioncore dist-web-cli/staging/aionui-web/bundled-aioncore/linux-x64/aioncore
RUN chmod +x dist-web-cli/staging/aionui-web/bundled-aioncore/linux-x64/aioncore

# ---- Stage 3: runtime ----
FROM oven/bun:1-slim AS runtime
RUN apt-get update && apt-get install -y ca-certificates libssl3 curl libicu76 && curl -fsSL https://d.officecli.ai/install.sh | bash && ( [ -f /root/.local/bin/officecli ] && cp /root/.local/bin/officecli /usr/local/bin/ || true ) && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=web-build /app/dist-web-cli/staging/aionui-web/ /app/
ENV AIONUI_BACKEND_BIN=/app/bundled-aioncore/linux-x64/aioncore \
    AIONUI_HOST=0.0.0.0 \
    AIONUI_ALLOW_REMOTE=1 \
    AIONUI_DATA_DIR=/data \
    AIONUI_PORT=3000 \
    NODE_ENV=production
VOLUME /data
ENV AIONUI_MULTIUSER=1
EXPOSE 3000
# El ejecutable web-cli sirve estático + proxya /api,/ws,/login,/logout al aioncore (sin --local = auth ON)
CMD ["./aionui-web", "start"]
