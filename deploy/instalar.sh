#!/usr/bin/env bash
# Instala (o actualiza) el Vendedor IA en un servidor Ubuntu (RackNerd, IONOS, Oracle Cloud o cualquier VPS).
# Uso, desde la carpeta del proyecto:   sudo bash deploy/instalar.sh
# Volver a ejecutarlo actualiza el programa y conserva tu configuración y tus datos.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Ejecútalo con sudo: sudo bash deploy/instalar.sh"; exit 1; fi

SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR=/opt/vendedor-ia
DATA_DIR=/var/lib/vendedor-ia
ENV_FILE=/etc/vendedor-ia.env
SERVICE=vendedor-ia

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

# ---------- Memoria extra (los servidores gratis traen 1 GB) ----------
if [[ ! -f /swapfile ]] && (( $(awk '/MemTotal/ {print $2}' /proc/meminfo) < 2000000 )); then
  say "Creando 2 GB de memoria de intercambio"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- Programas ----------
say "Instalando Node.js y Caddy (servidor web con HTTPS automático)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https rsync
# fail2ban bloquea a quien intenta adivinar la contraseña de SSH (muchos servidores reciben estos ataques)
apt-get install -y fail2ban && systemctl enable --now fail2ban
if ! command -v node >/dev/null || (( $(node -p 'process.versions.node.split(".")[0]') < 20 )); then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# ---------- Firewall interno (las imágenes Ubuntu de Oracle bloquean todo menos SSH) ----------
if command -v iptables >/dev/null; then
  for port in 80 443; do
    iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
  done
  command -v netfilter-persistent >/dev/null && netfilter-persistent save || true
fi
command -v ufw >/dev/null && ufw status | grep -q active && { ufw allow 80/tcp; ufw allow 443/tcp; } || true

# ---------- Programa ----------
say "Copiando el programa a $APP_DIR"
id -u vendedor >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin vendedor
mkdir -p "$APP_DIR" "$DATA_DIR"
rsync -a --delete --exclude node_modules --exclude data --exclude .env --exclude .git "$SRC_DIR"/ "$APP_DIR"/
(cd "$APP_DIR" && npm ci --omit=dev --no-audit --no-fund)
chown -R vendedor:vendedor "$DATA_DIR"

# ---------- Configuración (solo la primera vez) ----------
if [[ ! -f $ENV_FILE ]]; then
  say "Configuración inicial"
  read -rp "Dominio para el bot (ej. bot.maurg.shop): " DOMAIN
  read -rp "Clave de API de Anthropic (sk-ant-...): " API_KEY
  read -rsp "Contraseña para entrar al panel: " ADMIN_PASS; echo
  VERIFY=$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 24)
  cat > "$ENV_FILE" <<EOF
# Configuración del Vendedor IA. Después de editar: sudo systemctl restart $SERVICE
ANTHROPIC_API_KEY=$API_KEY
# Modelo económico (unos centavos por cada cientos de mensajes). Para respuestas más elaboradas: claude-opus-5-5
AI_MODEL=claude-haiku-5-5
AI_EFFORT=low
PORT=3000
PUBLIC_URL=https://$DOMAIN
ADMIN_PASSWORD=$ADMIN_PASS
DATA_DIR=$DATA_DIR

# Meta: el token de verificación ya está generado; cópialo en la configuración del webhook.
META_VERIFY_TOKEN=$VERIFY
META_APP_SECRET=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
FACEBOOK_PAGE_TOKEN=
INSTAGRAM_ACCESS_TOKEN=
EOF
  chmod 600 "$ENV_FILE"
  printf '%s {\n\treverse_proxy localhost:3000\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile
fi

# ---------- Servicio (arranca solo al prender el servidor y se reinicia si falla) ----------
cat > /etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=Vendedor IA
After=network-online.target
Wants=network-online.target

[Service]
User=vendedor
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now $SERVICE
systemctl restart $SERVICE
systemctl reload caddy 2>/dev/null || systemctl restart caddy

URL=$(grep '^PUBLIC_URL=' "$ENV_FILE" | cut -d= -f2-)
VERIFY=$(grep '^META_VERIFY_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
say "¡Listo!"
cat <<EOF
  Panel:              $URL   (usuario: admin)
  Webhook de Meta:    $URL/webhook/meta
  Token del webhook:  $VERIFY
  Privacidad:         $URL/privacidad
  Eliminar datos:     $URL/eliminar-datos

  Editar configuración:  sudo nano $ENV_FILE   y luego   sudo systemctl restart $SERVICE
  Ver registros:         sudo journalctl -u $SERVICE -f
EOF
