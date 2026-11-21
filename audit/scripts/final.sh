#!/bin/bash
# Rejoue une liste de visites sur un dossier servi. Usage : final.sh <dossier> <journal> <carte>...
S=/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad
cd $S; H=$1; J=$2; shift 2; : > $J
for c in "$@"; do HEBERGE=$H NODE_OPTIONS="-r $S/servi2.js" PLIE=1 RAPIDE=1 CARTE="$c" timeout 5400 node visite.js > "$S/x/fin-$c.log" 2>&1; echo "$c: $(grep -E 'étapes, ' "$S/x/fin-$c.log" | tail -1) | $(grep -c '^ *[0-9]* !!' "$S/x/fin-$c.log") signalée(s) | $(grep -c 'geste sauté' "$S/x/fin-$c.log") geste(s) sauté(s) $(grep -m1 -E 'ARRÊT|Error' "$S/x/fin-$c.log" | cut -c1-120)" >> $J; done
echo FIN >> $J
