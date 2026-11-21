# Audit de Solvéa

Audit complet de la version 62 de Solvéa, mené les 20 et 21 novembre 2026, sans modifier l'application : ce qui
fonctionne, ce qui ne fonctionne pas, et chaque défaut d'interface, d'ergonomie, de lisibilité, chaque répétition et
chaque incohérence, écran par écran. Ce dossier contient le rapport et tout le code qui a servi à le produire.

## Lire le rapport

`rapport/audit-solvea.html` est le rapport consolidé : synthèse, priorités, captures, puis les 1 244 constats rangés
page par page, avec des filtres (gravité, nature, audit, recherche). La page charge `rapport/data.json` : ouvrez-la
depuis un petit serveur local plutôt qu'en double-cliquant sur le fichier, sinon le navigateur bloque la lecture des
données.

```bash
python3 -m http.server 8080 --directory audit/rapport
```

Puis ouvrez http://localhost:8080/audit-solvea.html.

Les rapports détaillés de chaque audit sont dans `scripts/audit/<audit>/rapport.md`.

## Contenu

| Dossier | Ce qu'il contient |
|---|---|
| `rapport/` | Le rapport consolidé (page, données, dix captures). |
| `scripts/audit/brief-audit.md`, `brief-ux.md` | Les consignes données aux auditeurs. |
| `scripts/audit/A-mise-en-place/` | Connexion, création d'une pharmacie, Réglages, Équipe, Règles, comptes. |
| `scripts/audit/B-planifier/` | Tableau de bord, Construire, propositions, Mois, Gardes, Formation, Impression. |
| `scripts/audit/C-decider-suivre/` | Résoudre, signalements, Messages, Heures, Équité, Statistiques, Journal, Documents, Solvi. |
| `scripts/audit/D-equipe/` | Les cinq profils salariés : accueil, plannings, demandes, remplacements, retards, droits. |
| `scripts/audit/E-moteur/` | Le moteur de calcul comparé au Code du travail (tests Vitest dans `tests/`). |
| `scripts/audit/UX-titulaire/` | Revue d'interface de chaque page et fenêtre du titulaire, à trois tailles d'écran. |
| `scripts/audit/UX-equipe-transversal/` | Revue d'interface de l'espace équipe, des visites guidées, de Solvi et des composants. |
| `scripts/audit/F-transverse/` | Rapidité, données, cas transversaux. |
| `scripts/audit/rapport/` | Les scripts Python qui assemblent les sept rapports en un seul jeu de données. |
| `scripts/audit/suites/`, `suites.log` | Le résultat des suites de tests navigateur rejouées pendant l'audit. |
| `scripts/` | Les outils communs (`lib.js`, `servi.js`, `visite.js`), les 27 suites de tests navigateur et `preparer.sh`. |

Les captures d'écran prises pendant l'audit (près de 1 900, environ 480 Mo) ne sont pas versionnées : les scripts les
recréent dans `captures/` et `shots/` quand on les rejoue.

## Rejouer l'audit

Il faut Node 18 ou plus, Playwright avec Chromium (`npx playwright install chromium`) et Python 3.

1. Préparer, depuis la racine du dépôt :

   ```bash
   bash audit/scripts/preparer.sh
   ```

   Le script remplace, dans les scripts de ce dossier, les chemins de l'audit d'origine par ceux de votre copie,
   construit Solvéa (`npm run build:artifact`), copie la version compilée dans `audit/scripts/heberge` et installe
   axe-core pour les contrôles d'accessibilité.

2. Rejouer toutes les suites de tests navigateur (une trentaine de minutes) :

   ```bash
   bash audit/scripts/audit/suites.sh
   ```

   Le bilan s'écrit dans `audit/scripts/audit/suites.log`, le détail dans `audit/scripts/audit/suites/`.

3. Rejouer un script d'audit, par exemple :

   ```bash
   cd audit/scripts && NODE_OPTIONS="-r $PWD/servi.js" node audit/B-planifier/t01.js
   ```

4. Régénérer les données du rapport à partir des rapports détaillés :

   ```bash
   cd audit/scripts/audit/rapport && python3 construire.py && python3 ranger.py && python3 completer.py
   cp data.json ../../../rapport/data.json
   ```

À savoir :

- Les scripts ne modifient pas Solvéa : `servi.js` sert la version compilée depuis le disque à l'adresse
  http://localhost:5180/ et chaque script pilote un vrai navigateur.
- Solvéa démarre toujours sur la page de connexion et ouvre la fenêtre « Version de test » à chaque chargement.
  Pendant les tests, qui rechargent la page en cours de route, la session est gardée et la fenêtre passée d'office.
  `CONNEXION=1` et `AVIS=1` rendent le comportement d'un utilisateur ; `scripts/avis/avis.js` le contrôle :
  `AVIS=1 CONNEXION=1 NODE_OPTIONS="-r $PWD/servi.js" node avis/avis.js`.
- `PLIE=1` laisse les accordéons et les onglets dans leur état réel ; sans lui, tout est ouvert pour la lecture.
- La pharmacie d'exemple se cale sur la date de l'appareil : rejoué un autre jour, l'audit peut donner d'autres
  chiffres. Par exemple, la question « Qui travaille demain ? » posée à Solvi un samedi n'a pas de réponse, la
  pharmacie étant fermée le dimanche.
