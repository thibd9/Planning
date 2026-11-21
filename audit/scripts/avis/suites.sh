#!/bin/bash
# Rejoue toutes les suites et garde la sortie complète de chacune (contrôle par contrôle).
S=/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad
cd $S; export NODE_OPTIONS="-r $S/servi.js"; mkdir -p avis/suites; : > avis/suites.log
un() { timeout ${3:-600} env $2 node $1.js > "avis/suites/$4$1.log" 2>&1; echo "$4$1: $(tail -2 avis/suites/$4$1.log | tr '\n' ' ' | cut -c1-300)" >> avis/suites.log; }
for l in e2e6 lot2 lot3 lot5 lot6 lot7 lot8 lot9 lot10 lot11 lot12 lot13 lot14 lot15 lot15b lot16 lot17 lot18 lot19 lot20 lot21 lot22 grille champs; do un $l "" 600 ""; done
un lot23 "PLIE=1" 600 ""; un lot24 "PLIE=1" 600 ""
for l in e2e6 lot5 lot11 lot13 lot17 lot19 lot20 lot21; do un $l "MODE=sombre" 600 "sombre-"; done
un lot12 "MOBILE=1" 600 "tel-"; un lot20 "MOBILE=1" 600 "tel-"; un mobile2 "" 600 ""
echo FIN >> avis/suites.log
