#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${ZE_TOUR_DEPLOY_HOST:-joshua}"
REMOTE_ROOT="${ZE_TOUR_DEPLOY_ROOT:-/var/www/ze-tour}"
DOMAIN="zetour.bonamy.fr"
RELEASE="$(date -u +%Y%m%dT%H%M%SZ)"
REMOTE_RELEASE="$REMOTE_ROOT/releases/$RELEASE"
NGINX_SITE="/etc/nginx/sites-available/$DOMAIN.conf"

cd "$ROOT_DIR"
npm run build

ssh "$HOST" "sudo mkdir -p '$REMOTE_RELEASE' && sudo chown -R \"\$(id -un):\$(id -gn)\" '$REMOTE_ROOT'"
COPYFILE_DISABLE=1 tar -czf - -C "$ROOT_DIR/dist/client" . | ssh "$HOST" "tar -xzf - -C '$REMOTE_RELEASE' && ln -sfn '$REMOTE_RELEASE' '$REMOTE_ROOT/current'"

if ! ssh "$HOST" "test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem"; then
  scp "$ROOT_DIR/deploy/joshua/nginx-bootstrap.conf" "$HOST:/tmp/$DOMAIN.bootstrap.conf"
  ssh "$HOST" "sudo install -m 0644 '/tmp/$DOMAIN.bootstrap.conf' '$NGINX_SITE' && sudo ln -sfn '$NGINX_SITE' '/etc/nginx/sites-enabled/$DOMAIN.conf' && sudo /usr/sbin/nginx -t && sudo systemctl reload nginx && sudo certbot certonly --webroot -w '$REMOTE_ROOT/current' -d '$DOMAIN' --non-interactive --agree-tos --register-unsafely-without-email && rm -f '/tmp/$DOMAIN.bootstrap.conf'"
fi

scp "$ROOT_DIR/deploy/joshua/nginx.conf" "$HOST:/tmp/$DOMAIN.conf"
ssh "$HOST" "sudo install -m 0644 '/tmp/$DOMAIN.conf' '$NGINX_SITE' && sudo ln -sfn '$NGINX_SITE' '/etc/nginx/sites-enabled/$DOMAIN.conf' && sudo /usr/sbin/nginx -t && sudo systemctl reload nginx && rm -f '/tmp/$DOMAIN.conf'"

echo "Deployed: https://$DOMAIN"
