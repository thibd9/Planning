#!/bin/bash
# Prépare les scripts d'audit pour cette copie du dépôt :
# 1. les chemins écrits pendant l'audit pointent vers ce dossier et vers ce dépôt ;
# 2. la version compilée de Solvéa est construite et copiée dans « heberge », que servi.js sert aux navigateurs de test ;
# 3. axe-core (contrôles d'accessibilité) est installé.
# Usage, depuis la racine du dépôt : bash audit/scripts/preparer.sh
set -e
ICI="$(cd "$(dirname "$0")" && pwd)"
DEPOT="$(cd "$ICI/../.." && pwd)"
TRAVAIL='/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad'
SOURCES='/home/user/releve-planning'

# Les chemins absolus de l'audit d'origine sont remplacés par ceux de cette copie.
grep -rlF -e "$TRAVAIL" -e "$SOURCES" "$ICI" --include='*.js' --include='*.ts' --include='*.sh' --include='*.py' \
  | grep -v '/preparer.sh$' \
  | while read -r f; do sed -i -e "s#$TRAVAIL#$ICI#g" -e "s#$SOURCES#$DEPOT#g" "$f"; done

# Version compilée de Solvéa, servie sans serveur par servi.js (http://localhost:5180/).
(cd "$DEPOT" && npm run build:artifact)
rm -rf "$ICI/heberge/assets" && cp -r "$DEPOT/dist-artifact/assets" "$ICI/heberge/assets"

# Contrôles d'accessibilité.
(cd "$ICI/axe" && npm ci --silent)

mkdir -p "$ICI/shots" "$ICI/x" "$ICI/audit/suites"
echo "Prêt. Exemple : cd $ICI && NODE_OPTIONS=\"-r $ICI/servi.js\" node e2e6.js"
