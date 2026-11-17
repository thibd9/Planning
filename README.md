# Solvéa — planning d'équipe pour pharmacie d'officine

<img src="src/assets/solvea-logo-ciel.svg" alt="Solvéa" width="220">

Solvéa aide une titulaire à construire le planning de son équipe, à comprendre chaque arbitrage
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

Node 20 ou plus récent. L'application s'ouvre sur la **page de connexion** : une vitrine animée à gauche, le formulaire
à droite, puis « Créer ma pharmacie » et l'**environnement de test** juste dessous. « Créer ma pharmacie »
lance trois étapes : la pharmacie (nom, horaires, fermeture le midi éventuelle), l'équipe, dans l'ordre : vous, titulaire
principal, avec votre identifiant et votre mot de passe ; les autres titulaires s'il y en a ; les pharmaciens
adjoints ; les préparateurs ; les autres postes,
puis une vérification avant de créer. Un tutoriel guidé présente ensuite chaque espace.

## Tutoriels et environnement d'exemple

La page de connexion présente Solvéa en trois étapes (« Comment ça marche »). Son bouton « Voir la
démonstration » ouvre la fenêtre « Découvrir Solvéa » : deux visites guidées, jouées sur une pharmacie
d'exemple (la « Pharmacie des Tilleuls », fictive) posée à côté des vraies, sans rien effacer.

- **Tout Solvéa, de zéro** (39 étapes, six chapitres) : la pharmacie vient d'être créée, sans équipe ni
  planning. On installe (création, horaires, modèle de planification, équipe, fiche, règles), on construit
  (souhaits du mois, grille, proposition, contrôles, vue mois, journée, publication), on passe côté équipe
  (mon planning, calendrier, planning de l'équipe, demandes, remplacement), on traite les imprévus
  (demande triée par urgence, volontaire, validation, congés, absence imprévue, appel à l'équipe), les
  temps forts (gardes, formation, inventaire), puis on pilote (accord entre titulaires, compteur d'heures,
  suivi, équité, messages, journal et paie, tableau de bord, barre du haut, compte).
- **Une journée type** (13 étapes) : huit semaines d'historique, un arrêt à couvrir, des demandes en
  attente ; on suit la titulaire et son équipe.

Pendant une visite :

- un **projecteur** éclaire ce dont on parle, et l'écran défile pour l'amener au centre ;
- quand l'étape comporte une action, un **repère de clic** se pose sur le bouton, puis l'action se fait
  sous les yeux (l'équipe arrive personne par personne, la grille se remplit, la demande est acceptée) ;
- la fiche d'explication se range dans le coin où elle cache le moins ;
- le **sommaire** saute d'un chapitre à l'autre, et l'écran se met en place tout seul ;
- **lecture automatique**, flèches du clavier, et « Revenir à l'étape » si l'on est parti explorer.

La même fenêtre permet d'entrer librement dans la peau de quatre personnes :

| Regard | Personne | Identifiant | Ce qu'elle voit |
| --- | --- | --- | --- |
| Titulaire 1 | Hélène Marchetti, titulaire principale | `helene.marchetti` | Toute la gestion, et les accords à donner |
| Titulaire 2 | Antoine Mercier, titulaire secondaire | `antoine.mercier` | Les mêmes écrans ; ses décisions attendent l'accord d'Hélène |
| Pharmacien | Karim Benali, adjoint | `karim.benali` | Son planning, le planning publié, ses gardes, ses messages |
| Préparateur | Camille Roussel, préparatrice | `camille.roussel` | Ses horaires, ses demandes, les remplacements, ses messages |

Mot de passe commun : `demo`. Une fois dans l'exemple, un bandeau permet de changer de regard en un clic.

## Connexion, rôles et pharmacies

Chacun se connecte avec un **identifiant et un mot de passe** et arrive dans un espace différent :

| Espace | Qui | Ce qu'on y voit |
| --- | --- | --- |
| **Responsable** | Les titulaires, et les adjoints à qui le titulaire principal donne l'accès | Mon planning, tableau de bord, résoudre, messages, construire, gardes, équité, équipe, réglages, règles, journal |
| **Pharmacien** | Adjoints sans droit de gestion | Mon planning, planning publié de l'équipe, mes gardes, messages |
| **Équipe** | Préparateurs, apprentis, étudiants, rayonnistes | Mon planning, planning publié de l'équipe, messages |

- **Deux icônes.** Le titulaire principal porte la couronne, le titulaire secondaire la médaille.
- **Titulaire principal ou secondaire.** Celui qui crée la pharmacie en est le titulaire principal, non
  salarié. Un titulaire secondaire a les mêmes écrans, mais chacune de ses décisions (publier, régler une
  absence, valider un remplacement, confier une garde, planifier une formation ou un inventaire, ajouter ou
  retirer une personne) attend l'accord du titulaire principal, dans « Résoudre », onglet « Accords ». Tant
  que l'accord n'est pas donné, rien n'est appliqué ; un refus n'applique rien. Les brouillons de planning
  et la saisie des fiches restent libres.
- **Comptes de l'équipe.** Chaque fiche donne l'identifiant de la personne et un mot de passe provisoire à
  lui transmettre ; elle le remplace dans « Mon compte ». Le titulaire principal peut en régénérer un.
- **Plusieurs titulaires sur un même appareil.** Depuis la page de connexion, un autre titulaire crée sa
  propre pharmacie sans voir celles des autres ; chacun a sa clé de secours. Un identifiant ne sert qu'à
  une personne, et un changement de mot de passe vaut pour toutes ses pharmacies.
- **Mot de passe oublié.** Un membre demande un nouveau mot de passe provisoire au titulaire principal ;
  le titulaire principal redéfinit le sien avec la clé de secours affichée dans « Mon compte ». Une remise
  à zéro complète de l'appareil est possible depuis le même écran (saisir EFFACER) : pharmacies, comptes,
  préférences et session sont effacés.
- **Plusieurs pharmacies.** Le titulaire principal ajoute autant de pharmacies qu'il veut, chacune avec son
  équipe, ses plannings et ses règles, et passe de l'une à l'autre depuis le menu latéral ou le menu du compte.
- **Barre du haut** : la date, « Créer » (planning, garde, formation, inventaire, personne, absence,
  message), la cloche, les messages, le tutoriel, puis le compte. La cloche donne une ligne par demande de
  remplacement, la plus urgente en tête : un clic mène droit à la demande, mise en avant.
- **Menu personnel**, le même pour tous : « Mon planning » (mes horaires, rien d'autre), « Mes souhaits »
  (le mois à venir), « Mes demandes » (absences, contraintes, remplacements), « Mon suivi » (compteur
  d'heures, compteurs de présence, part des contraintes).
- **Mon planning et le planning global.** Dans « Construire » et « Planning de l'équipe », « Mes postes »
  ne garde que ma ligne ; depuis « Mon planning », « Toute l'équipe » ouvre le planning global.

**Limite importante** : sans serveur, cette connexion sépare les espaces sur un appareil partagé ; ce n'est
pas une protection des données, et seule une empreinte non cryptographique du mot de passe est conservée.
Comptes, messages et plannings ne quittent pas l'appareil : ils ne sont pas partagés entre deux postes.
Un vrai contrôle d'accès et une vraie messagerie demandent un serveur.

## Ce que fait cette première version

| Espace | Question | Contenu |
| --- | --- | --- |
| **Tableau de bord** | Où en est la pharmacie ? | Décisions en attente, couverture pharmacien de la semaine, équipe du jour, prochains horaires, messages, mes pharmacies |
| **Résoudre** | Que décider aujourd'hui ? | Cinq onglets, un sujet à la fois : absences (bouton « Tout régler » avec les options conseillées, ou un volet par jour avec options comparées), remplacements, demandes, gardes, plannings à publier |
| **Construire** | Comment couvrir la semaine ? | Grille à l'échelle du temps, contrôles immédiats, trois propositions (équité, souhaits, coût), brouillon puis publication |
| **Gardes** | Affecter, prévenir, payer | Ajout d'une garde avec le pharmacien à qui la confier et sa notification immédiate, délai de 15 jours, interventions, repos à protéger, variables pour le comptable |
| **Mon planning** | Quand est-ce que je travaille ? | Aujourd'hui, demain et la suite en un coup d'œil ; vue **Semaine** (horaire écrit en grand, puis frise graduée de 8 h à 20 h avec la pause hachurée) ou vue **Calendrier** du mois, en grandes cases sur toute la largeur ; changements avant → après, demandes, remplacements, part des contraintes |
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

### Une journée en détail : pauses et retards

Un clic sur un jour (en-tête de « Construire », case du calendrier, ligne de « Mon planning ») ouvre la
journée : toute l'équipe sur une même frise, de l'ouverture à la fermeture. Le responsable y règle la pause
déjeuner de chacun, voit aussitôt si un pharmacien manque pendant une pause, et note un retard, un départ
anticipé ou une absence non prévue. Les autres lisent la journée publiée.

### Compétences et diplômes

Chaque fiche coche ce que la personne sait faire, par famille : actes et diplômes (vaccination, tests,
entretiens, orthopédie, contention, préparations, gestes d'urgence), conseil (phytothérapie, aromathérapie,
homéopathie, micronutrition, dermatologie, beauté, parapharmacie, puériculture, vétérinaire, maintien à
domicile, diabète, sevrage tabagique) et organisation (commandes, tiers payant, merchandising).

### Suivi de présence

Chaque fiche porte ses compteurs sur douze mois : retards (nombre et minutes), départs anticipés, absences
non prévues, jours de congé, d'arrêt et de formation, remplacements assurés. La personne voit les siens
dans « Mon suivi ». Ce sont des dates et des durées : aucune raison n'est demandée ni conservée.

### Inventaires

Depuis « Créer », un inventaire se fixe en trois champs : date, heures, participants. Chacun reçoit un
poste « Inventaire » dans son planning, visible aussitôt même sur une semaine déjà publiée, et un avis dans
son espace. Au-delà de six heures, une pause est posée d'office.

### Formations

Le responsable planifie une formation depuis « Créer » dans la barre du haut : un intitulé, des dates, des
participants. Chacun est prévenu dans son espace et retrouve la formation dans son planning et son
calendrier ; les postes prévus ces jours-là passent dans « Résoudre », avec des options de remplacement.
Pour quelques heures de formation pendant un poste, la tâche « Formation » se choisit sur le poste.

### Souhaits du mois et vue mois

Dans le modèle **collaboratif** (réglable dans « Réglages », l'autre modèle étant le **classique**, où le
responsable construit seul), chacun pose ses souhaits pour le mois à venir avant une date limite (le 20 du
mois précédent, réglable) :

- une forme par jour — matin, journée, après-midi ou repos — posée d'un clic, sans jamais de raison ;
- « M'assister » remplit les jours vides d'après les habitudes des huit dernières semaines ;
- sous chaque jour, l'effectif annoncé par l'équipe (matin et après-midi) face au seuil de la pharmacie ;
  s'il manque quelqu'un, « Je peux venir » comble le créneau.

Le calcul traite un souhait comme une simple préférence : il ne passe jamais devant une règle impérative
ni devant l'effectif attendu. Côté responsable, « Construire » a une **vue mois** : une lettre par jour et
par personne, l'objectif d'équipe par jour (au moment le plus tendu), les heures de chacun face à son
contrat, les souhaits déjà posés, qui a répondu et combien de jours restent. « Corriger avec l'IA Solvéa »
recalcule d'un coup les semaines encore en brouillon en suivant les souhaits, et dit combien ont été
suivis ; les semaines publiées ne bougent pas.

### Absence à couvrir : l'appel à l'équipe et le tour de rôle

Pour qu'une absence urgente ne retombe pas toujours sur les mêmes et que personne ne soit mis à l'écart :

1. **tous** ceux qui peuvent tenir le poste sans enfreindre une règle sont prévenus en même temps, avec le
   même message ;
2. entre volontaires, le poste revient à celui qui a **le moins dépanné** sur trois mois, au prorata de son
   contrat (« À son tour ») ; le responsable peut choisir un autre volontaire, c'est alors tracé « hors
   tour » au journal ;
3. répondre « je ne peux pas » ne coûte rien : seuls les dépannages réellement assurés comptent ;
4. ceux qui ne sont pas sollicités le sont pour une raison de règle (repos, absence, qualification),
   affichée au responsable ; chaque personne voit son propre rang ;
5. les volontaires non retenus reçoivent un message qui dit pourquoi, et gardent leur rang.

À moins de sept jours, un changement d'horaire demande l'accord de la personne : seul un volontaire peut
être désigné. Les dépannages assurés ont leur compteur dans « Équité » et dans « Mon suivi ».

### Demandes de remplacement, par niveau d'urgence

Depuis « Mes demandes », chacun demande à être remplacé sur un poste publié et choisit un niveau :
**prévu** (poste à 7 jours ou plus), **urgent** (moins de 7 jours) ou **urgence médicale**. Aucune raison
n'est à écrire. Pour une urgence médicale, un **justificatif** peut être joint (photo réduite sur
l'appareil, ou PDF de 600 Ko au plus) : seuls les titulaires le voient, et son contenu est effacé dès que
la demande est réglée. La consigne affichée demande le volet destiné à l'employeur, qui ne mentionne pas
le diagnostic.

1. Le titulaire reçoit la demande, triée par urgence, et répond **oui ou non**.
2. S'il accepte, tous les collègues qui peuvent tenir le poste sont prévenus ; un pharmacien ne se
   remplace que par un pharmacien.
3. Un collègue se propose ; le moteur relit les règles (repos, durées, chevauchement, absence) et annonce
   les **heures en plus** sur son contrat.
4. Le titulaire valide ; les deux personnes sont prévenues, et le compteur d'heures du remplaçant suit.

Le seuil de 7 jours vient du délai de prévenance : « sept jours » (Code du travail, art. L3121-47), « au
moins sept jours ouvrés » à temps partiel (art. L3123-31), jamais moins de trois jours ouvrés par accord
(art. L3123-24), lus sur code.travail.gouv.fr. Ces articles encadrent ce que l'employeur doit au salarié ;
ils n'interdisent pas un échange accepté par tous. C'est pourquoi une demande plus proche reste possible,
mais comme demande urgente : elle passe d'abord par le titulaire, et seul un volontaire reprend le poste.

### Compteur d'heures et régularisation

« Heures » compare, pour chaque salarié, les heures planifiées et publiées à son contrat (absences
approuvées déduites). Le titulaire régularise à la main — payer, faire récupérer, faire rattraper,
solder — ou clique sur « Laisser l'IA Solvéa faire » : chaque écart d'au moins une heure est résorbé sur la
première semaine non publiée, par demi-heures et sans dépasser 8 h d'écart au contrat, et le brouillon de
cette semaine est recalculé. Chacun voit son propre compteur dans « Mon suivi ».

« IA Solvéa » désigne le moteur de calcul de l'application (règles impératives, puis optimisation) : il
tourne sur l'appareil, n'envoie aucune donnée et n'est pas un modèle de langage. Le bouton porte le logo.

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

- **Contrastes** : tout texte tient au moins 4,5:1 sur son fond, tout contour de champ au moins 3:1, dans
  chacun des dix thèmes (bleu ciel par défaut, bleu marine, indigo, violet, framboise, terracotta, ambre,
  émeraude, bleu-vert, ardoise), en **mode clair comme en mode sombre**. Le logo suit la couleur du thème.
- **Surfaces translucides** : cartes à 76 %, menu latéral à 68 %, fenêtres à 90 % d'opacité. Les contrôles
  automatiques ne savent pas mesurer un texte posé sur un fond translucide ; le contraste des couleurs de
  texte a donc été calculé à part, sur le fond le plus défavorable, pour les dix thèmes et les deux modes :
  5,6:1 au minimum.
- **Repères de couleur dans les plannings**, les mêmes dans la grille, la frise et le calendrier : jaune
  pour le matin, orange pour la journée, bleu pour la journée longue, violet pour le soir, indigo pour la
  garde, vert d'eau pour le congé, rouge doux pour l'arrêt, turquoise pour la formation. L'horaire est toujours écrit dans la tuile : la couleur aide, elle n'est jamais seule.
- **Sans contours colorés** : boutons et cartes n'ont pas de bordure de couleur. Un élément choisi se lit à
  son fond teinté, à une coche ou à un libellé ; seuls les champs de saisie gardent un filet neutre.
- **Aides au survol** : un jour à problème dans la ligne « Couverture » porte une pastille pleine ; au
  survol ou au clavier, une bulle sombre dit le problème, les plages concernées et quoi faire.
- **Jamais la couleur seule** : chaque état a aussi un pictogramme, un libellé ou une forme (coche,
  « Sélectionnée », « aujourd'hui », texte lu par les lecteurs d'écran).
- **Clavier** : tout est atteignable et utilisable au clavier, le focus est toujours visible, un lien
  d'évitement mène au contenu, les fenêtres et le tutoriel retiennent le focus et se ferment avec Échap.
  Le glisser-déposer a une alternative : chaque tuile s'ouvre et se modifie.
- **Formulaires** : libellés reliés aux champs, champs obligatoires annoncés, erreurs listées en tête,
  reliées à leur champ et recevant le focus.
- **Structure** : un titre de page par écran, niveaux de titres sans saut, zones de navigation et de
  contenu repérées, grille du planning exposée comme un tableau.

Un audit automatique (axe-core, règles WCAG 2.1 A et AA) ne relève aucun défaut sur les 105 écrans et
fenêtres du parcours complet, ordinateur et téléphone, ni sur les vingt écrans principaux rejoués dans
chacun des dix thèmes, en clair et en sombre. **Ce n'est pas une déclaration de conformité** : un audit RGAA complet demande des
contrôles manuels, notamment avec des lecteurs d'écran, qui restent à faire.

## Crédits

Photo de la page de connexion : « Salvator interior », par Newklear007, placée dans le domaine public
(CC0 1.0), Wikimedia Commons — https://commons.wikimedia.org/w/index.php?curid=150126922.

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
- **Notifications dans l'application.** Prévenir un pharmacien d'une garde dépose un avis dans son espace,
  avec accusé de lecture ; aucun courriel ni SMS ne part, faute de serveur.
- **Données sur l'appareil.** Cette version enregistre dans le navigateur (`localStorage`) : pas de
  serveur, donc pas de partage entre postes. Connexion, messages et demandes de remplacement fonctionnent
  entre les personnes qui utilisent le même appareil ; ils ne sont ni envoyés ni synchronisés ailleurs.
- **Heures prévues seulement.** Pas de pointage : la fiche navette exporte du prévu, pas du réalisé. Les
  retards sont notés à la main par le responsable ; ils ne modifient pas les heures payées.
- **Compteur d'heures indicatif.** Il ne calcule ni majoration ni repos compensateur, et part du premier
  planning publié dans l'application. Le choix entre paiement et récupération relève de la convention
  collective : à faire valider par l'expert-comptable.
- **Justificatifs sur l'appareil.** Faute de serveur, un justificatif joint reste dans le navigateur où il
  a été déposé : il n'est pas transmis à un autre poste. Un vrai dépôt de documents de santé demande un
  hébergement adapté.
- **Surfaces translucides.** Les cartes laissent passer le fond animé. Les couleurs de texte n'ont pas
  changé, et le contraste a été recalculé sur le fond le plus défavorable (voir « Accessibilité »).
- **Mouvement.** Les fonds animés, les entrées d'écran et les visites guidées s'arrêtent de bouger si
  l'appareil demande de réduire les animations.
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
