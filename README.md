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
étapes : la pharmacie (nom, horaires, fermeture le midi éventuelle), l'équipe (titulaire principal avec
son identifiant et son mot de passe, pharmaciens adjoints, préparateurs, autres postes), puis une
vérification avant de créer. Un tutoriel guidé présente ensuite chaque espace ; il se relance depuis le
bouton « Tutoriel ». Une équipe d'exemple (« Pharmacie des Tilleuls », fictive) peut être chargée depuis
l'accueil : identifiants `helene.marchetti`, `karim.benali` ou `camille.roussel`, mot de passe `demo`.

## Connexion, rôles et pharmacies

Chacun se connecte avec un **identifiant et un mot de passe** et arrive dans un espace différent :

| Espace | Qui | Ce qu'on y voit |
| --- | --- | --- |
| **Responsable** | Le titulaire principal, et les personnes à qui il donne l'accès | Mon planning, tableau de bord, résoudre, construire, gardes, messages, équipe, équité, règles, journal, réglages |
| **Pharmacien** | Titulaires secondaires et adjoints sans droit de gestion | Mon planning, planning publié de l'équipe, mes gardes, messages |
| **Équipe** | Préparateurs, apprentis, étudiants, rayonnistes | Mon planning, planning publié de l'équipe, messages |

- **Titulaire principal ou secondaire.** Celui qui crée la pharmacie en est le titulaire principal, non
  salarié. Un titulaire secondaire n'a aucun droit de gestion tant que le principal ne le lui accorde pas,
  dans la fiche de la personne (« Droits d'accès »).
- **Comptes de l'équipe.** Chaque fiche donne l'identifiant de la personne et un mot de passe provisoire à
  lui transmettre ; elle le remplace dans « Mon compte ». Le titulaire principal peut en régénérer un.
- **Mot de passe oublié.** Un membre demande un nouveau mot de passe provisoire au titulaire principal ;
  le titulaire principal redéfinit le sien avec la clé de secours affichée dans « Mon compte ». Une remise
  à zéro complète de l'appareil est possible depuis le même écran (saisir EFFACER).
- **Plusieurs pharmacies.** Le titulaire principal ajoute autant de pharmacies qu'il veut, chacune avec son
  équipe, ses plannings et ses règles, et passe de l'une à l'autre depuis le menu latéral ou le menu du compte.
- **En haut à droite** : Mon compte, Paramètres (couleur du thème, taille du texte), ajout d'une pharmacie
  et déconnexion. « Mon planning » est toujours le premier lien du menu.

**Limite importante** : sans serveur, cette connexion sépare les espaces sur un appareil partagé ; ce n'est
pas une protection des données, et seule une empreinte non cryptographique du mot de passe est conservée.
Comptes, messages et plannings ne quittent pas l'appareil : ils ne sont pas partagés entre deux postes.
Un vrai contrôle d'accès et une vraie messagerie demandent un serveur.

## Ce que fait cette première version

| Espace | Question | Contenu |
| --- | --- | --- |
| **Tableau de bord** | Où en est la pharmacie ? | Décisions en attente, couverture pharmacien de la semaine, équipe du jour, prochains horaires, messages, mes pharmacies |
| **Résoudre** | Que décider aujourd'hui ? | Absences à couvrir avec options comparées, demandes de remplacement, demandes à arbitrer, gardes, plannings à publier |
| **Construire** | Comment couvrir la semaine ? | Grille à l'échelle du temps, contrôles immédiats, trois propositions (équité, souhaits, coût), brouillon puis publication |
| **Gardes** | De la garde à la paie | Affectation, délai de 15 jours, interventions, repos à protéger, variables pour le comptable |
| **Mon planning** | Quand est-ce que je travaille ? | Aujourd'hui, demain et la suite en un coup d'œil (ordinateur et téléphone), planning publié, changements avant → après, demandes, remplacements, part des contraintes |
| **Messages** | Qui prévenir ? | Fil de toute l'équipe et conversations privées |

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

### Demandes de remplacement

Depuis « Mon planning », chacun demande à être remplacé sur un poste publié, sans donner de raison. Les
collègues qui ont la qualification voulue voient la demande et se proposent ; un pharmacien ne se remplace
que par un pharmacien. Le responsable valide dans « Résoudre », où chaque volontaire est relu par le moteur
(repos, durées, chevauchement, absence) avant que le bouton de validation n'apparaisse. Tant que rien
n'est validé, le poste reste celui du demandeur ; à la validation, les deux personnes sont prévenues.

### Besoins personnels : jamais de motif

Le modèle de données ne contient **aucun champ « motif » ni texte libre** sur un besoin. Garde d'enfant,
pratique religieuse, soin, transport ou cours du soir passent par le même formulaire : une contrainte
d'horaire, sans raison. Trois statuts ne sont jamais confondus — indisponibilité reconnue (impérative),
préférence prioritaire (plafonnée de la même façon pour tous), simple préférence. Un droit ou un
aménagement validé n'entre pas dans le plafond. Un calendrier de repères de toutes traditions aide le
salarié à retrouver une date ; son choix n'est pas enregistré.

Des **préréglages** remplissent le formulaire en un clic — Chabbat (finir plus tôt le vendredi, ne pas
travailler le samedi), prière du vendredi, office du dimanche, rupture du jeûne, sortie d'école, mercredi,
cours du soir — et s'ajustent ensuite librement. Le nom du préréglage n'est **jamais enregistré** : seules
partent des contraintes d'horaire (« finir avant 16 h le vendredi »), et c'est tout ce que le responsable
voit. La religion est une donnée sensible (RGPD, article 9) qu'un employeur n'a pas à détenir ; ne pas la
stocker protège le salarié comme le titulaire. Une indisponibilité peut aussi porter sur une plage horaire
précise (de 12 h à 14 h 30, par exemple).

## Accessibilité

L'interface est conçue pour le RGAA (niveau AA des WCAG 2.1) :

- **Contrastes** : tout texte tient au moins 4,5:1 sur son fond, tout contour de champ, de bouton ou de
  repère graphique au moins 3:1, dans chacun des quatre thèmes (bleu-vert par défaut, bleu, vert,
  ardoise). L'interface tient dans une seule famille de couleurs ; l'état (urgent, validé) reste lisible
  par un libellé.
- **Jamais la couleur seule** : chaque état a aussi un pictogramme, un libellé ou une forme (coche,
  « Sélectionnée », bordure épaissie, texte lu par les lecteurs d'écran).
- **Clavier** : tout est atteignable et utilisable au clavier, le focus est toujours visible, un lien
  d'évitement mène au contenu, les fenêtres et le tutoriel retiennent le focus et se ferment avec Échap.
  Le glisser-déposer a une alternative : chaque tuile s'ouvre et se modifie.
- **Formulaires** : libellés reliés aux champs, champs obligatoires annoncés, erreurs listées en tête,
  reliées à leur champ et recevant le focus.
- **Structure** : un titre de page par écran, niveaux de titres sans saut, zones de navigation et de
  contenu repérées, grille du planning exposée comme un tableau.

Un audit automatique (axe-core, règles WCAG 2.1 A et AA) ne relève aucun défaut sur les 31 écrans,
fenêtres et thèmes vérifiés, ordinateur et téléphone. **Ce n'est pas une déclaration de conformité** : un audit RGAA complet demande des
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
  serveur, donc pas de partage entre postes. Connexion, messages et demandes de remplacement fonctionnent
  entre les personnes qui utilisent le même appareil ; ils ne sont ni envoyés ni synchronisés ailleurs.
- **Heures prévues seulement.** Pas de pointage : la fiche navette exporte du prévu, pas du réalisé.
- **Générateur heuristique.** La recherche locale donne de bonnes semaines en moins de deux secondes
  pour une dizaine de personnes ; elle ne prouve pas l'optimalité.

## Suite envisagée

1. Serveur et comptes (hébergement dans l'Union européenne) : vraie authentification, messages et
   remplacements reçus sur le téléphone de chacun, notifications.
2. Pointage simple (code ou QR code — ni photo ni biométrie) pour distinguer prévu, réalisé, validé.
3. Échanges de postes à deux sens entre collègues, validés automatiquement s'ils respectent règles,
   couverture et équité.
4. Simulation de résistance avant publication ; salle de confidentialité et rendez-vous.
5. Autres conventions collectives : le noyau est générique, seules les fiches de règles changent.
