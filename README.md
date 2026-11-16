# Relève — planning d'équipe pour pharmacie d'officine

Relève aide une titulaire à construire le planning de son équipe, à comprendre chaque arbitrage
et à absorber un imprévu en dérangeant le moins de monde possible.

Le cœur de l'application est un **moteur de contraintes vérifiable**, pas une IA conversationnelle :
il propose, explique, et ne publie jamais rien sans validation humaine.

## Lancer l'application

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

Node 20 ou plus récent. L'application s'ouvre sur un jeu de démonstration (« Pharmacie des Tilleuls »,
équipe fictive) calé sur la date du jour.

## Ce que fait cette première version

| Espace | Question | Contenu |
| --- | --- | --- |
| **Résoudre** | Que décider aujourd'hui ? | Absences à couvrir avec options comparées, demandes à arbitrer, gardes, plannings à publier |
| **Construire** | Comment couvrir la semaine ? | Grille à l'échelle du temps, contrôles immédiats, trois propositions (équité, souhaits, coût), brouillon puis publication |
| **Gardes** | De la garde à la paie | Affectation, délai de 15 jours, interventions, repos à protéger, variables pour le comptable |
| **Mon planning** | Quand est-ce que je travaille ? | Espace salarié : planning publié, changements avant → après, demandes, part des contraintes |

Et en référentiel : équipe et compétences, mémoire d'équité, fiches de règles, journal de preuve,
fiche navette, réglages de l'officine.

### Les trois fonctions signatures

1. **Réparation qui annonce ses conséquences.** Après une absence, chaque option précise les personnes
   touchées, le coût, les validations à obtenir et les règles contrôlées. Deux scénarios sont comparés
   sur une mesure (minutes d'ouverture sans pharmacien, effectif manquant), pas sur une impression.
2. **Diagnostic « avec ces conditions, c'est impossible ».** Quatre cas distincts : impossibilité
   démontrée, données manquantes, solution non trouvée dans le temps de calcul, créneau encore découvert.
   Aucun levier proposé ne consiste à assouplir une obligation légale.
3. **Parcours complet de la garde.** Ventilation par jour et par mois, nuit de changement d'heure,
   temps plein ou temps partiel, titulaire hors décompte, repos après la garde.

### Besoins personnels : jamais de motif

Le modèle de données ne contient **aucun champ « motif » ni texte libre** sur un besoin. Garde d'enfant,
pratique religieuse, soin, transport ou cours du soir passent par le même formulaire : une contrainte
d'horaire, sans raison. Trois statuts ne sont jamais confondus — indisponibilité reconnue (impérative),
préférence prioritaire (plafonnée de la même façon pour tous), simple préférence. Un droit ou un
aménagement validé n'entre pas dans le plafond. Un calendrier de repères de toutes traditions aide le
salarié à retrouver une date ; son choix n'est pas enregistré.

## Architecture

```
src/
  domain/    types, temps (jours fériés, changement d'heure), fiches de règles
  engine/    contrôles, génération, diagnostic, réparation, gardes, équité, paie, publication
  data/      jeu de démonstration, repères de calendrier
  store/     état de l'application (sauvegarde locale, annulation)
  ui/        écrans et composants
```

- **Règles en données.** Chaque règle est une fiche avec source, date d'effet, version et niveau de
  vérification (`src/domain/rules.ts`). Modifier une valeur crée une version, tracée au journal.
- **Impératif et souple ne se compensent pas.** Le générateur classe les solutions sur trois niveaux :
  règles impératives, effectif attendu, objectifs souples. Une préférence ne rachète jamais une règle.
- **Moteur pur, testé.** `src/engine` ne dépend ni de React ni du navigateur (`src/engine/engine.test.ts`).

## Limites à connaître

- **Aide à la conformité, pas une garantie.** Les fiches marquées « à valider » viennent de sources
  secondaires. À faire relire par un avocat en droit social et un spécialiste de la paie officinale
  avant tout usage réel. Les montants des indemnités de garde ne sont pas renseignés.
- **Données sur l'appareil.** Cette version enregistre dans le navigateur (`localStorage`) : pas de
  compte, pas de serveur, pas de partage entre postes. L'« espace salarié » est une vue de démonstration,
  pas un accès sécurisé.
- **Heures prévues seulement.** Pas de pointage : la fiche navette exporte du prévu, pas du réalisé.
- **Générateur heuristique.** La recherche locale donne de bonnes semaines en moins de deux secondes
  pour une dizaine de personnes ; elle ne prouve pas l'optimalité.

## Suite envisagée

1. Serveur et comptes (hébergement dans l'Union européenne), accès salarié réel, notifications.
2. Pointage simple (code ou QR code — ni photo ni biométrie) pour distinguer prévu, réalisé, validé.
3. Échanges entre collègues validés automatiquement s'ils respectent règles, couverture et équité.
4. Simulation de résistance avant publication ; salle de confidentialité et rendez-vous.
5. Autres conventions collectives : le noyau est générique, seules les fiches de règles changent.
