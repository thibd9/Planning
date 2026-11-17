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

Node 20 ou plus récent. L'application démarre **vierge**, sur l'écran « Créer mon officine », en trois
étapes : la pharmacie (nom, horaires, fermeture le midi éventuelle), l'équipe (titulaire, pharmaciens
adjoints, préparateurs, autres postes), puis une vérification avant de créer. Un tutoriel guidé présente
ensuite chaque espace ; il se relance depuis le bouton « Tutoriel ». Une équipe d'exemple (« Pharmacie des
Tilleuls », fictive) peut être chargée depuis l'accueil pour explorer sans rien saisir.

## Connexion et espaces par rôle

Chaque personne se connecte à son profil et arrive dans un espace différent :

| Espace | Qui | Ce qu'on y voit |
| --- | --- | --- |
| **Responsable** | Le titulaire qui a créé l'officine, et les personnes à qui il donne l'accès | Toute la gestion : résoudre, construire, gardes, équipe, équité, règles, journal, réglages |
| **Pharmacien** | Cotitulaires et adjoints sans droit de gestion | Mon planning, planning publié de l'équipe, mes gardes |
| **Équipe** | Préparateurs, apprentis, étudiants, rayonnistes | Mon planning, planning publié de l'équipe |

Le créateur de l'officine en est le **responsable**, non salarié. Un second titulaire n'a aucun droit de
gestion tant que le responsable ne le lui accorde pas, dans la fiche de la personne (« Droits d'accès »).
Chacun peut imprimer son planning, choisir la couleur de son thème et la taille du texte, et définir un
code d'accès dans « Mon compte ».

**Limite importante** : sans serveur, cette connexion sépare les espaces sur un appareil partagé ; ce n'est
pas une protection des données. Un vrai contrôle d'accès demande des comptes côté serveur.

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
   temps plein ou temps partiel, titulaire hors décompte, repos après la garde. Pour chaque garde, les
   pharmaciens sont comparés (disponibilité, charge déjà portée, postes à déplacer, coût) ; les gardes
   libres se répartissent équitablement en un clic, avec la raison de chaque choix ; un tour de garde
   régulier se crée en série ; un calendrier sur douze mois et un récapitulatif mensuel complètent le tout.

### Besoins personnels : jamais de motif

Le modèle de données ne contient **aucun champ « motif » ni texte libre** sur un besoin. Garde d'enfant,
pratique religieuse, soin, transport ou cours du soir passent par le même formulaire : une contrainte
d'horaire, sans raison. Trois statuts ne sont jamais confondus — indisponibilité reconnue (impérative),
préférence prioritaire (plafonnée de la même façon pour tous), simple préférence. Un droit ou un
aménagement validé n'entre pas dans le plafond. Un calendrier de repères de toutes traditions aide le
salarié à retrouver une date ; son choix n'est pas enregistré.

## Accessibilité

L'interface est conçue pour le RGAA (niveau AA des WCAG 2.1) :

- **Contrastes** : tout texte tient au moins 4,5:1 sur son fond, tout contour de champ, de bouton ou de
  repère graphique au moins 3:1, dans chacun des cinq thèmes de couleur. Les dégradés pastel ne portent
  que du texte foncé.
- **Jamais la couleur seule** : chaque état a aussi un pictogramme, un libellé ou une forme (coche,
  « Sélectionnée », bordure épaissie, texte lu par les lecteurs d'écran).
- **Clavier** : tout est atteignable et utilisable au clavier, le focus est toujours visible, un lien
  d'évitement mène au contenu, les fenêtres et le tutoriel retiennent le focus et se ferment avec Échap.
  Le glisser-déposer a une alternative : chaque tuile s'ouvre et se modifie.
- **Formulaires** : libellés reliés aux champs, champs obligatoires annoncés, erreurs listées en tête,
  reliées à leur champ et recevant le focus.
- **Structure** : un titre de page par écran, niveaux de titres sans saut, zones de navigation et de
  contenu repérées, grille du planning exposée comme un tableau.

Un audit automatique (axe-core, règles WCAG 2.1 A et AA) ne relève aucun défaut sur les 29 écrans,
fenêtres et thèmes vérifiés. **Ce n'est pas une déclaration de conformité** : un audit RGAA complet demande des
contrôles manuels, notamment avec des lecteurs d'écran, qui restent à faire.

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
  compte, pas de serveur, pas de partage entre postes, une seule officine. L'« espace salarié » est une vue de démonstration,
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
