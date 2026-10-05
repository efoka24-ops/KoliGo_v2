#!/usr/bin/env bash
# Deploie le backend PHP par FTP. Le docroot du site est la racine FTP :
#   public_html/*  -> /          (index.php, .htaccess)
#   app/**         -> /app/      (protege par app/.htaccess)
#
# Usage :
#   FTP_HOST=ftp-12.camoo.net FTP_USER=... FTP_PASS=... \
#     deploy/ftp-deploy.sh [--env /chemin/vers/env.php] [--setup]
#
# --env    envoie ce fichier comme app/.env.php (jamais versionne)
# --setup  envoie aussi _setup.php, a appeler une fois puis qui se supprime
set -euo pipefail

: "${FTP_HOST:?FTP_HOST requis}" "${FTP_USER:?FTP_USER requis}" "${FTP_PASS:?FTP_PASS requis}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE=""
SETUP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENV_FILE="$2"; shift 2 ;;
    --setup) SETUP=1; shift ;;
    *) echo "option inconnue: $1" >&2; exit 2 ;;
  esac
done

put() { # put <local> <remote>
  curl -sS --fail --ftp-create-dirs --user "$FTP_USER:$FTP_PASS" -T "$1" "ftp://$FTP_HOST/$2"
  echo "  -> $2"
}

cd "$ROOT"
put public_html/index.php index.php
put public_html/.htaccess .htaccess
[ "$SETUP" = 1 ] && put public_html/_setup.php _setup.php
put landing/index.html landing/index.html   # l'APK (landing/koligo-*.apk) est envoye a part : trop lourd pour etre re-pousse a chaque deploiement

# Tout app/ sauf secrets locaux et donnees runtime.
while IFS= read -r f; do
  put "$f" "$f"
done < <(find app -type f ! -name '.env' ! -name '.env.php' ! -name '*.sqlite' ! -path 'app/storage/*' | sort)

[ -n "$ENV_FILE" ] && put "$ENV_FILE" app/.env.php
echo "Deploiement termine."
