# Audit fonctionnel de Solvéa : consignes communes

Solvéa est un outil de planification d'équipe pour pharmacie d'officine (React 18, TypeScript, zustand, sans serveur :
toutes les données sont dans le localStorage du navigateur, clé `releve.v3`). Écris tout en français.

## La demande du client (mot pour mot)
« Je veux un Audit complet et sois le plus pragmatique possible, je veux tous les détails de ce qui fonctionne et de ce
qui ne fonctionne pas. » Et avant : « ne modifie rien, juste audite-moi la solution, le parcours, les incohérences, les
répétitions ».

## RÈGLE ABSOLUE : tu ne modifies rien
- N'écris, ne modifie, ne supprime AUCUN fichier de /home/user/releve-planning (ni src, ni dist, ni dist-artifact, ni
  package.json). Pas de `git` en écriture (pas de commit, stash, checkout, reset). Pas de `npm install`, pas de build.
- Ne touche pas aux dossiers servis `$S/heberge*` ni aux scripts existants de `$S` (tu peux les lire et les copier).
- Tout ce que tu crées va dans TON dossier : `$S/audit/<ton-code>/` (scripts, captures, journaux, rapport).
S = /tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad

## Comment tester (dans un vrai navigateur, comme un utilisateur)
- La version publiée est servie, sans serveur, par le préchargement `$S/servi.js` : lance tes scripts Node avec
  `NODE_OPTIONS="-r $S/servi.js" node ton-script.js` et ouvre `http://localhost:5180/`. Chromium et Playwright sont
  installés (`require('playwright')`). NE PAS définir PLIE : par défaut, ce préchargement ouvre d'office tous les
  accordéons et rend visibles tous les panneaux d'onglets (pratique pour lire, mais trompeur pour juger un onglet :
  pour tester la navigation par onglets ou accordéons comme un utilisateur, lance avec `PLIE=1`).
- Entrer dans l'exemple sous un profil : lis `$S/lib.js` (fonction `ouvrir({ role, w, h, mode })`). Profils
  (`role`) : 0 Caroline, titulaire principale ; 1 Pierre, titulaire secondaire ; 2 Igor, pharmacien ; 3 Nicolas,
  préparateur ; 4 Sarah, animatrice ; 5 Manon, apprentie ; 6 Yanis, étudiant. Changer de profil en cours de route :
  bouton `#bt-ouvrir` puis `.bandeau-test button` par son texte (voir `$S/mobile2.js`).
- Lire les données : `JSON.parse(localStorage.getItem('releve.v3'))`, puis `.officines[.courante]` (personnes, shifts,
  semaines, absences, besoins, remplacements, souhaits, repos, gardes, messages, notifications, journal…).
- Navigation : `[data-tour="nav-<vue>"]` dans la barre latérale (sur téléphone, cliquer via `evaluate(() => el.click())`).
- Pour savoir CE QUE FAIT un écran ou un bouton, lis son composant dans /home/user/releve-planning/src/ui/views/ et
  src/ui/components/ (et src/store/store.ts pour les actions). L'aide intégrée (src/ui/bot.ts, 59 fiches) décrit chaque
  fonction : sers-t'en comme cahier des charges et vérifie que l'application fait ce que la fiche promet.
- Teste aussi ce qui peut casser : saisies vides ou incohérentes (fin avant début, nombres négatifs, dates passées),
  doubles clics, annuler/rétablir, rechargement de la page (les données restent-elles ?), retour en arrière,
  états vides, profil qui n'a pas le droit, petit écran (390×800), portable (1280×760), grand écran (1920×1080),
  thème sombre (`mode: 'sombre'` dans `ouvrir`). Note les erreurs de la console (`page.on('pageerror')`).
- Les captures : `$S/audit/<ton-code>/captures/…png`. REGARDE celles qui servent de preuve (outil Read) avant
  d'affirmer quoi que ce soit.
- La machine est partagée avec d'autres auditeurs : un délai dépassé n'est pas forcément un défaut. Avant de conclure
  « ne fonctionne pas », rejoue le cas au moins une fois. Ne qualifie jamais de défaut ce que tu n'as pas reproduit.

## Ce que tu rends
Un fichier `$S/audit/<ton-code>/rapport.md`, puis un court résumé en réponse finale. Le rapport contient :
1. Un tableau, une ligne par fonction ou par scénario testé :
   `| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |`
   - Résultat : **Fonctionne** / **Partiel** / **Ne fonctionne pas** / **Non testable** (dire pourquoi).
   - Gravité (pour Partiel ou Ne fonctionne pas) : **Bloquant** (empêche une tâche essentielle ou perd des données),
     **Majeur** (résultat faux ou trompeur, contournement pénible), **Mineur** (gêne réelle mais limitée),
     **Cosmétique** (affichage, libellé).
   - Constat précis : ce que tu as fait, ce que tu attendais, ce que tu as obtenu (avec les valeurs). Pour un défaut,
     les étapes de reproduction.
   - Preuve : chemin de la capture ou extrait de texte, de données ou de console.
2. Une liste des **incohérences** (deux écrans qui se contredisent, un libellé qui ment, un chiffre qui ne correspond
   pas) et des **répétitions** inutiles que tu as rencontrées dans ton domaine, avec l'endroit exact.
3. Ce que tu n'as pas pu tester, et pourquoi.
Sois factuel et exhaustif sur ton domaine ; pas de jugement de goût sur le design, pas de proposition de code.
Écriture : français, pas de tiret cadratin, pas d'émoji.
