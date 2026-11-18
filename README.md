# Solvéa — planning d'équipe pour pharmacie d'officine

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="src/assets/solvea-logo-ciel-sombre.svg">
  <source media="(prefers-color-scheme: light)" srcset="src/assets/solvea-logo-ciel.svg">
  <img src="src/assets/solvea-logo-ciel.svg" alt="Solvéa" width="220">
</picture>

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

La page de connexion est sobre : des formes en dégradé, fixes, le logo centré au-dessus du formulaire, et
deux boutons sous « Première visite ? » : « Créer ma pharmacie » et « Comment ça marche ? ». Ce dernier
ouvre la fenêtre « Découvrir Solvéa » : une visite guidée **par rôle**, jouée sur une pharmacie d'exemple
(la « Grande Pharmacie de la Pinède », fictive) posée à côté des vraies, sans rien effacer.

- **Titulaire — Tout Solvéa, de zéro** (52 étapes, environ 25 minutes au rythme posé) : la visite suit **l'ordre du menu**, sans changer de
  personnage en cours de route. **Préparer** (création, équipe, fiche d'une personne, horaires et
  effectif, qui prépare le planning, règles), **Planifier** (grille, poste posé à la main, trois
  propositions, contrôles, journée, retards, mois, publication, impression, formation, inventaire,
  gardes), **Suivre** (demande de remplacement, validation, urgence médicale, congés et horaires, refus
  motivé, absence imprévue, appel à l'équipe, accord entre titulaires, messages, compteur d'heures),
  **Bilan** (équité, journal et paie, documents, absences et justificatifs), **Au quotidien** (tableau
  de bord, « Créer », cloche, plusieurs pharmacies, assistant, mot de passe, compte), puis un dernier
  chapitre **Vu par l'équipe**.
- **Pharmacien adjoint** (14 étapes) et **Préparateur, animateur, apprenti…** (13 étapes) : seulement ce
  qui sert à la personne — son planning, celui de l'équipe, ses demandes, l'appel à l'équipe, ses gardes
  pour un pharmacien, son suivi, les messages, l'assistant, son compte. Rien de la gestion.
- **Une journée type** (13 étapes, tous les rôles) : huit semaines d'historique, un arrêt à couvrir, des
  demandes en attente ; on suit la titulaire et son équipe.

**Solvi**, la mascotte de l'aide, accompagne la visite et tient l'assistant. Il prend la couleur du
thème, flotte sur place, cligne des yeux, et change d'humeur selon ce qu'il fait : un clin d'œil quand il
clique, concentré quand il écrit, pensif pendant un calcul, émerveillé devant un résultat, perplexe quand
il n'a pas compris une question. Quinze humeurs sont dessinées (neutre, heureux, content, excité, surpris,
intrigué, réfléchi, satisfait, confiant, concentré, inquiet, triste, fatigué, confus, joyeux).

Pendant une visite, **on lit, puis on regarde** — un clic par étape :

- un **projecteur** éclaire ce dont on parle ; rien ne bouge tant que la fiche d'explication est ouverte ;
- « Suivant » referme la fiche et joue **toute la démonstration de l'étape** : un pointeur se déplace,
  clique, coche, choisit dans une liste ou tape au clavier. À chaque geste, Solvi dit dans une bulle
  **quoi faire et à quoi cela sert** (« Cliquez sur “Ajouter une personne” — ce bouton ouvre la fiche
  d'une nouvelle personne »), laisse le temps de lire, agit, puis laisse voir le résultat ;
- le **rythme** est posé par défaut (environ sept secondes par geste) et se règle depuis la bulle :
  posé, normal ou vif ;
- un geste dont la cible est introuvable est signalé dans la console : une étape ne se vide plus en
  silence (la fenêtre des trois propositions et celle de la publication s'ouvrent bien) ;
- le projecteur suit la fenêtre ou le bloc où se passe le geste ; « Passer » saute la démonstration ;
- le **sommaire** saute d'un chapitre à l'autre ; **lecture automatique** et flèches du clavier restent
  disponibles, ainsi que « Revenir à l'étape » si l'on est parti explorer.

### Aide : chaque tâche a sa réponse et son tutoriel

« Aide et tutoriels » (dans le menu, et le « ? » de la barre du haut) répertorie toutes les fonctions
utiles au rôle connecté, rangées par thème. Une recherche filtre en même temps les fiches et le lexique.
Chaque fiche donne la réponse en deux lignes, le bouton qui mène à l'écran, et **« Voir le tutoriel »** :
la visite guidée ne joue alors que les étapes de cette tâche (une à quatre), sur la pharmacie d'exemple,
puis ramène à sa propre pharmacie et à la page d'aide. Le **lexique** définit le vocabulaire (brouillon,
publié, tour de rôle, indisponibilité reconnue, fiche navette…).

La même fenêtre permet d'entrer librement dans la peau de quatre personnes :

| Regard | Personne | Identifiant | Ce qu'elle voit |
| --- | --- | --- | --- |
| Titulaire 1 | Caroline Tellier, titulaire principale | `caroline.tellier` | Toute la gestion, et les accords à donner |
| Titulaire 2 | Pierre Fiandino, titulaire secondaire | `pierre.fiandino` | Les mêmes écrans ; ses décisions attendent l'accord de Caroline |
| Pharmacien | Igor Le Russe, adjoint | `igor.lerusse` | Son planning, le planning publié, ses gardes, ses messages |
| Préparateur | Nicolas Le Syndicaliste, préparateur | `nicolas.lesyndicaliste` | Ses horaires, ses demandes, les remplacements, ses messages |

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
- **Menu du titulaire, dans l'ordre du travail** : tableau de bord, puis **1 Préparer** (équipe, réglages,
  règles), **2 Planifier** (construire, gardes), **3 Suivre** (résoudre, messages, heures), **4 Bilan**
  (équité, journal et paie). Le titulaire suit l'activité de son équipe : pas d'espace personnel dans son
  menu (ses propres horaires restent accessibles depuis le menu du compte). Le tableau de bord montre
  l'équipe du jour et « Où en est le planning » : préférences, brouillon, contrôles, publication.
- **Menu de l'équipe** : « Mon planning » (mes horaires, en semaine ou en calendrier), « Mes demandes »
  et « Mon suivi » (compteur d'heures, compteurs de présence, part des contraintes), puis le planning de
  l'équipe et les messages.
- **Mes demandes** s'ouvre sur trois cartes, une par chose possible, avec qui répond : **Mes
  préférences** (ce qui m'arrange le mois prochain, sans réponse à attendre), **Absence ou horaire** (le
  titulaire répond), **Me faire remplacer** (le titulaire, puis un collègue volontaire). Chaque demande
  affiche ses étapes — envoyée, réponse du titulaire, au planning — et une phrase qui dit où elle en est.
  Pour un remplacement, les postes sont séparés en deux groupes : moins de 7 jours (urgent, sur
  volontariat) et 7 jours ou plus (délai normal).
- **Assistant Solvéa** : un bouton flottant au logo ouvre une conversation. On pose sa question (« Qui
  travaille demain ? », « Mon prochain poste ? », « Que dois-je décider ? », « Qui est absent ? », « Les
  heures à régulariser ? ») : il lit le planning, répond avec les noms et les horaires, et propose le bouton
  qui mène au bon écran. Pour le reste, il s'appuie sur une trentaine de fiches d'aide, filtrées selon le
  rôle. C'est un moteur de règles intégré, pas un modèle de langage : il ne comprend que les formulations
  prévues, et rien n'est envoyé hors de l'appareil.
- **Imprimer** : chacun peut imprimer son planning, le planning de l'équipe et ses gardes ; le titulaire
  imprime la semaine depuis « Construire ».
- **Une couleur par poste**, la même dans tous les thèmes : titulaire, pharmacien adjoint, préparateur,
  animateur, apprenti, étudiant, rayonniste.
- **Trois niveaux de boutons** : principal (plein), secondaire (teinté, toujours visible), discret
  (neutre). Une seule action principale par écran ou par fenêtre.
- **Mon planning et le planning global.** Dans « Construire » et « Planning de l'équipe », « Mes postes »
  ne garde que ma ligne ; depuis « Mon planning », le bouton « Planning de l'équipe » ouvre le planning
  global.
- **Postes séparés** : animateurs, apprentis, étudiants et rayonnistes ont chacun leur groupe, dans la
  création de la pharmacie, la liste de l'équipe, la grille de la semaine et la vue mois.

**Limite importante** : sans serveur, cette connexion sépare les espaces sur un appareil partagé ; ce n'est
pas une protection des données, et seule une empreinte non cryptographique du mot de passe est conservée.
Comptes, messages et plannings ne quittent pas l'appareil : ils ne sont pas partagés entre deux postes.
Un vrai contrôle d'accès et une vraie messagerie demandent un serveur.

## Ce que fait cette première version

| Espace | Question | Contenu |
| --- | --- | --- |
| **Tableau de bord** | Où en est la pharmacie ? | Décisions en attente, couverture pharmacien de la semaine, équipe du jour, prochains horaires, messages, mes pharmacies |
| **Résoudre** | Que décider aujourd'hui ? | Cinq onglets, un sujet à la fois : absences (bouton « Tout régler » avec les options conseillées, ou un volet par jour avec options comparées), remplacements, demandes, gardes, plannings à publier |
| **Construire** | Comment couvrir la semaine ? | Grille à l'échelle du temps, contrôles immédiats, trois propositions (équité, préférences, coût), brouillon puis publication |
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

### Préférences du mois et vue mois

Dans le modèle **collaboratif** (réglable dans « Réglages », l'autre modèle étant le **classique**, où le
responsable construit seul), chacun pose ses préférences pour le mois à venir avant une date limite (le
20 du mois précédent, réglable) :

- une forme par jour — matin, journée, après-midi ou repos — posée d'un clic, sans jamais de raison ;
- « M'assister » remplit les jours vides d'après les habitudes des huit dernières semaines ;
- un jour où l'équipe annoncée ne suffit pas porte la mention « Manque le matin » ou « Manque
  l'ap.-midi » ; en le touchant, on voit qui s'est positionné et « Je peux venir » comble le créneau.

Le calcul traite une préférence pour ce qu'elle est : elle ne passe jamais devant une règle impérative
ni devant l'effectif attendu.

Côté responsable, « Construire » a une **vue mois** qui se lit comme la grille de la semaine :

- une ligne par personne, rangée par poste ; une case par jour du mois, avec **l'horaire écrit dedans**
  (« 8h30 / 16h30 ») et la couleur du moment de la journée ; congé, arrêt et formation sont écrits en mots ;
- la **légende en haut**, en mots ;
- en tête, chaque semaine avec son état (publiée, brouillon, à construire) : un clic l'ouvre ;
- une ligne « Équipe au complet ? » : une coche, ou le nombre de personnes qui manquent au comptoir ;
- pour chacun, « 126 h sur 140 h » : les heures planifiées face au contrat, compté seulement sur les
  semaines déjà construites, absences déduites ;
- les **semaines passées sont rangées** (bouton « Semaines passées ») et une semaine sans planning tient
  en une colonne « À construire » : la grille tient sans défiler et les cases sont plus grandes ;
- les préférences ne s'affichent que si on coche « Afficher les préférences » (un point rouge signale un
  poste qui s'en écarte) ;
- le mois en cours s'ouvre sur la semaine d'aujourd'hui.

« Corriger automatiquement » recalcule d'un coup les semaines encore en brouillon en suivant les
préférences, et dit combien ont été suivies ; les semaines publiées ne bougent pas.

### Demander à un collègue, refuser avec une raison

- **Demander à un collègue précis.** Dans « Me faire remplacer », on choisit « Toute l'équipe » ou un
  collègue. Pour chacun, le calcul relit les règles et compte ses heures de la semaine : au-delà du plafond
  de l'officine, il est marqué « Impossible », avec la raison, et ne peut pas être choisi. Le collègue
  répond « J'accepte » ou « Je ne peux pas » ; le titulaire valide dans tous les cas. Si le collègue ne
  peut pas, la demande s'ouvre à toute l'équipe d'un clic.
- **Refuser proprement.** Quand le titulaire refuse un congé, un horaire ou un remplacement, une fenêtre
  propose une raison dans une liste (effectif insuffisant, période de forte activité, délai trop court…),
  un mot facultatif, et l'aperçu du message que la personne recevra. Le refus sans message reste possible.
  La raison est inscrite au journal.
- **Répondre non à un appel.** La personne sollicitée peut de même donner une raison, toujours
  facultative ; dire non ne change pas son rang dans le tour de rôle.
- **Régler une absence sans pilote automatique.** « Voir et choisir la solution » montre, jour par jour,
  l'option conseillée déjà cochée, les autres options avec ce qu'elles changent (qui, quels horaires, quel
  coût), et « Je règle ce jour à la main », qui ouvre ensuite le planning. Rien n'est appliqué avant accord.

### Gardes de nuit, de jour, de 24 heures

Chaque garde dit son moment, d'après ses horaires : « Garde de nuit · volets fermés », « Garde de jour ·
volets ouverts », « Astreinte de nuit ». À la création, « Quand ? » propose nuit, jour (dimanche ou jour
férié) ou 24 heures et règle les horaires. La fiche d'une garde est découpée en blocs numérotés ; dans la
vue mois, une garde se voit dans la case du jour.

### Réglages et règles

- **Postes types en couleur.** Chaque poste type peut recevoir une couleur ; un poste du planning qui
  reprend ses horaires la porte, dans la semaine comme dans le mois. « Ajouter un poste type » ouvre une
  fenêtre : modèle de départ, horaires, pause, jours, couleur, avec l'aperçu de la tuile.
- **Qui prépare le planning ?** Les deux façons de faire sont décrites en trois étapes chacune, avec un
  exemple de date limite pour les préférences.
- **Règles rangées par question** (« Combien d'heures au maximum ? », « Quel repos garantir ? », « Qui
  doit être présent ? »…) : une ligne par règle, avec son seuil et son état (obligatoire ou alerte) ; la
  description, la source et le réglage se déplient. Filtres : obligatoires, réglables, à faire valider.
- **Contrôles du planning** : tuiles groupées par gravité, le constat, le détail et la règle sur des
  lignes séparées.

### Messages, équité, documents, déconnexion

- **Messages.** On arrive sur la conversation qui a du nouveau. Les conversations non lues sont en tête,
  en couleur, avec un aperçu du dernier message et une pastille ; dans le fil, un trait « Nouveau message »
  marque ce qui n'avait pas été lu.
- **Équité.** La page répond d'abord à la question (« La charge est-elle bien répartie ? ») : combien sont
  à l'équilibre, qui a porté plus, qui a porté moins. Puis un compteur à la fois (samedis, fermetures,
  gardes, dépannages…), une ligne par personne : ce qu'elle a fait, sa part attendue, l'écart en mots.
- **Mes documents.** Pour chacun : ses plannings publiés rangés par mois, ses absences et arrêts avec leur
  état, et les fichiers qu'il dépose (arrêt de travail, attestation de formation, contrat), partagés ou
  non avec les titulaires. Le titulaire retrouve les documents reçus de l'équipe.
- **Justificatifs conservés, historique des absences.** Un justificatif joint à une demande n'est plus
  effacé : une fois la demande tranchée, il est rangé dans les documents de la personne, visible d'elle
  et des seuls titulaires (pas d'une personne à qui la gestion est déléguée). Dans « Documents », l'onglet
  « Absences de l'équipe » réunit arrêts, congés, formations, remplacements demandés et absences non
  prévues, par mois, avec un filtre par personne et par nature et les totaux des douze derniers mois ;
  « Joindre » y rattache la pièce qu'on a reçue en main propre. Une demande annulée par la personne
  emporte son justificatif.
- **Sur qui compter.** En haut de « Équipe », les titulaires voient ce que chacun apporte d'après les
  faits des douze derniers mois : toujours à l'heure, dépanne l'équipe, répond aux appels, prend sa part
  des samedis et fermetures. Ni note ni classement (ordre alphabétique) ; **les arrêts, les congés et les
  absences n'entrent jamais en compte**. Chacun voit ses propres points forts dans « Mon suivi ».
- **Décisions annoncées.** Dès qu'une décision est prise — congé accepté ou refusé, demande de
  remplacement, remplacement validé, absence réglée, contrainte d'horaires, publication, garde confiée,
  formation, inventaire, accord entre titulaires — une annonce part sous la cloche aux personnes
  concernées et à tous les titulaires, avec **ce que cela change dans les plannings** (« Igor : en poste →
  repos le 21 », « 3 postes à couvrir »). « Vu » la range ; le tableau de bord garde les six dernières.
- **Espaces par rôle.** La barre du haut porte un badge de rôle avec son icône et sa couleur (titulaire,
  pharmacien, préparateur…).
- **Jours fériés.** Marqués dans la grille, la vue mois, « Mes semaines » et le calendrier des
  préférences ; « Réglages » liste ceux des douze prochains mois.
- **Grille : des alertes en mots.** La ligne « Équipe au complet ? » écrit « Complet », « Pharmacien
  absent », « Aucun pharmacien », « Manque du monde » ou « Rien de posé ». **Titulaires et adjoints
  comptent tous comme pharmaciens** (le groupe le rappelle) : une plage sans pharmacien dit donc ce qui la
  crée — « 12 h 30 – 13 h 30, pause de Caroline », « après le départ de Caroline ». Les contrôles et la
  vue d'une journée reprennent la même explication.
- **Mes semaines.** Une tuile par jour, colorée selon le moment de la journée, avec la pause et la durée.
- **Menu du titulaire.** Les rubriques n'ont plus de numéro : des titres plus grands, et un fil qui les
  relie dans l'ordre du travail (préparer, planifier, suivre, bilan).
- **Demandes de remplacement.** Une carte par demande, sur fond blanc, entourée à la couleur de son
  urgence (rouge pour le médical, orange pour l'urgent).
- **Déconnexion sans perte.** Tout est enregistré au fur et à mesure. Avant de se déconnecter, une fenêtre
  rappelle ce qui reste en cours (accords à donner, postes à couvrir, demandes, plannings en brouillon,
  messages non lus) avec un accès direct, et le navigateur demande confirmation si une fenêtre de saisie
  est ouverte.
- **Assistant.** Il répond aussi à « Quels sont mes droits ? » avec les règles actives et leurs seuils.

### Fiche d'une personne

Chaque rubrique a son titre et son icône : poste et contrat, compétences et diplômes, droits d'accès,
suivi sur 12 mois, compte de connexion, volontariat, besoins personnels, absences à venir. Les vingt-deux
compétences sont rangées en trois familles (actes et habilitations, conseil, organisation), chacune avec
son icône et son compteur ; on touche une compétence pour l'ajouter ou la retirer.

### Journal et fiche navette

Le **journal** est rangé par jour, du plus récent au plus ancien : l'heure, la nature de l'événement
(publication, modification, absence, garde…) avec sa couleur, le détail, les changements avant/après, les
accords recueillis et les règles appliquées. Trois chiffres en tête, et un filtre par nature.

La **fiche navette** se parcourt mois par mois : quatre totaux (salariés, heures prévues, heures en plus
des contrats, jours d'absence), puis une ligne par salarié — heures prévues, heures complémentaires et
supplémentaires à 25 % et 50 % en pastilles de couleur, absences, variables de garde — et le total du
mois. Un bandeau rappelle que ce sont des heures prévues, pas pointées. L'export pour le comptable reste
un fichier CSV.

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
**prévu** (poste à 7 jours ou plus), **urgent** (moins de 7 jours) ou **urgence médicale**. Un **motif**
est obligatoire (santé, famille, administratif, formation, transport, autre), visible des seuls
titulaires ; la précision libre est effacée une fois la demande réglée. Pour une urgence médicale, un
**justificatif** peut être joint (photo réduite sur l'appareil, ou PDF de 600 Ko au plus) : seuls les
titulaires le voient, et il est conservé dans les documents une fois la demande réglée. La consigne affichée demande le volet destiné à l'employeur, qui ne mentionne pas
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

L'objectif affiché est clair : **le moins d'heures en plus possible**. La page ouvre sur trois totaux
(heures en plus, heures en moins, personnes à jour) et une alerte dès qu'un contrat est dépassé ; la
cloche signale les compteurs à régulariser. « Heures » compare, pour chaque salarié, les heures planifiées et publiées à son contrat (absences
approuvées déduites). Le titulaire régularise à la main — payer, faire récupérer, faire rattraper,
solder — ou clique sur « Régulariser automatiquement » : chaque écart d'au moins une heure est résorbé sur
la première semaine non publiée, par demi-heures et sans dépasser 8 h d'écart au contrat, et le brouillon
de cette semaine est recalculé. Chacun voit son propre compteur dans « Mon suivi ».

Les calculs automatiques (proposition de planning, correction du mois, régularisation) sont faits par le
moteur de l'application, sur l'appareil : règles impératives d'abord, optimisation ensuite.

### Demandes : toujours une raison, visible des seuls titulaires

Une demande d'absence ou d'horaires porte **toujours sa raison** : une catégorie choisie dans une liste
(congés et repos, famille, santé, études, démarche administrative, raison personnelle) et, si la personne
le souhaite, une précision. Seuls les titulaires la voient ; les collègues ne voient que des horaires.
Quand le titulaire saisit lui-même un besoin, la raison est facultative. Trois statuts ne sont jamais
confondus — indisponibilité reconnue (impérative), préférence prioritaire (plafonnée de la même façon
pour tous), simple préférence. Un droit ou un aménagement validé n'entre pas dans le plafond. Les
**préférences du mois**, elles, ne sont pas des demandes : aucune raison n'y est attachée.

**Deux demandes sur les mêmes dates.** Chaque demande d'absence montre qui d'autre est absent ou
demande à l'être en même temps, dans l'ordre d'arrivée, et une frise « Absences de l'équipe » (dix
semaines, une ligne par personne, demandes en pointillés) accompagne les décisions. L'annonce d'une
décision rappelle la demande restée en attente sur ces dates. L'équipe voit la même frise dans « Mes
demandes », sans la nature des absences ni les demandes des autres.

Des **préréglages** remplissent le formulaire en un clic — Chabbat (finir plus tôt le vendredi, ne pas
travailler le samedi), prière du vendredi, office du dimanche, rupture du jeûne, sortie d'école, mercredi,
cours du soir — et s'ajustent ensuite librement. Le nom du préréglage n'est **jamais enregistré** : il
présélectionne seulement une raison générale (« famille », « études », « raison personnelle »). La
religion et la santé sont des données sensibles (RGPD, article 9) : la liste des raisons reste donc
volontairement générale, et la précision est facultative. Une indisponibilité peut aussi porter sur une plage horaire
précise (de 12 h à 14 h 30, par exemple).

## Accessibilité

L'interface est conçue pour le RGAA (niveau AA des WCAG 2.1) :

- **Contrastes** : tout texte tient au moins 4,5:1 sur son fond, tout contour de champ au moins 3:1, dans
  chacun des dix thèmes (bleu ciel par défaut, bleu marine, indigo, violet, framboise, terracotta, ambre,
  émeraude, bleu-vert, ardoise), en **mode clair comme en mode sombre**. Le logo suit la couleur du thème.
- **Surfaces pleines** : plus aucun flou d'arrière-plan ; cartes et fenêtres sont opaques (94 % au moins),
  ce qui rend l'application fluide et les contrastes mesurables tels quels.
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

Un audit automatique (axe-core, règles WCAG 2.1 A et AA) ne relève aucun défaut :

- sur les 34 écrans et fenêtres du parcours de vérification (44 contrôles de fonctionnement), en clair et
  en sombre ;
- sur 32 écrans rejoués dans chacun des dix thèmes, en clair et en sombre (640 écrans), **sur la version
  hébergée elle-même** — c'est là qu'un défaut du mode sombre était passé inaperçu ;
- sur 12 écrans à la largeur d'un téléphone.

Les quatre visites guidées sont déroulées en entier par un script : chaque étape a son projecteur, aucune
erreur. **Ce n'est pas une déclaration de conformité** : un audit RGAA complet demande des contrôles
manuels, notamment avec des lecteurs d'écran, qui restent à faire.

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
  L'assistant, les gardes, la demande à un collègue et les refus ont leurs tests (`src/ui/bot.test.ts`) :
  70 tests au total.

## Limites à connaître

- **Aide à la conformité, pas une garantie.** Les fiches marquées « à valider » viennent de sources
  secondaires. À faire relire par un avocat en droit social et un spécialiste de la paie officinale
  avant tout usage réel. Les montants des indemnités de garde ne sont pas renseignés.
- **Notifications dans l'application.** Les annonces de décision et les avis de garde s'affichent dans
  l'espace de chacun ; aucun courriel ni SMS ne part, faute de serveur.
- **Points forts.** Ils reposent sur ce qui a été noté dans l'application (retards, départs anticipés,
  dépannages, réponses aux appels) : un retard jamais saisi ne se voit pas. Ce n'est pas une évaluation.
- **Conservation des justificatifs.** La durée de conservation d'un justificatif d'absence relève de vos
  obligations (paie, RGPD) : l'application ne supprime rien toute seule, c'est au titulaire de le faire.
- **Jours fériés.** Les onze jours fériés nationaux sont calculés (dont les dates mobiles de Pâques) ; les jours propres à l'Alsace-Moselle
  ou à l'outre-mer ne le sont pas.
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
- **Mouvement.** Aucune animation décorative ne tourne en continu. Les entrées d'écran et les visites
  guidées s'arrêtent de bouger si l'appareil demande de réduire les animations.
- **Documents sur l'appareil.** Les fichiers déposés restent dans le navigateur, 600 Ko par fichier et
  3 Mo au total : ils ne sont ni sauvegardés ni transmis à un autre poste. Un vrai coffre de documents,
  surtout pour des arrêts de travail, demande un hébergement adapté.
- **Solvi, assistant à règles.** Solvi calcule sur le planning (qui travaille, qui est absent, prochain
  poste, droits), connaît une trentaine de fiches d'aide (les mêmes que la rubrique « Aide ») et tient une
  conversation courante : saluer, remercier, dire qui il est, plaisanter. Il dit ses limites (aucun conseil
  médical, pas de conseil juridique ou de paie) et, quand il ne sait pas, le dit avec le sourire puis
  renvoie vers l'aide ou vers une personne : le contact de support indiqué dans « Réglages », à défaut
  le titulaire. Ce n'est pas une intelligence artificielle qui improvise : répondre à n'importe quelle
  question demanderait un serveur et un modèle de langage, donc l'envoi des questions hors de l'appareil. Une question formulée autrement peut ne pas être comprise : il le dit et propose des
  suggestions. Il ne rédige rien et n'apprend pas.
- **Impression.** L'impression passe par le navigateur. Dans l'aperçu hébergé sur claude.ai, la fenêtre
  d'impression peut être bloquée : l'application le signale au lieu de rester muette.
- **Couleur d'un poste type.** Elle s'applique aux postes qui reprennent exactement ses horaires ; un
  poste modifié à la main retrouve la couleur de son moment de la journée.
- **Demande à un collègue.** Faute de serveur, le collègue ne la reçoit que sur le même appareil.
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
