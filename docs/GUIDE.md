<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../src/assets/solvea-logo-ciel-sombre.svg">
  <source media="(prefers-color-scheme: light)" srcset="../src/assets/solvea-logo-ciel.svg">
  <img src="../src/assets/solvea-logo-ciel.svg" alt="Solvéa" width="220">
</picture>

# Solvéa Planning : le guide détaillé

[Retour à la présentation](../README.md) · [Bilan UX et UI](BILAN-UX-UI.md)

**Le planning d'équipe d'une pharmacie d'officine.**
Construire la semaine, comprendre chaque arbitrage, absorber un imprévu en dérangeant le moins de monde possible.

> [!NOTE]
> Solvéa est une **aide à la décision**, pas une garantie de conformité. Son cœur est un moteur de règles
> vérifiable : il propose, explique, et ne publie jamais rien sans validation humaine.
> Toutes les données restent dans le navigateur de l'appareil.

## Sommaire

1. [Démarrer](#démarrer)
2. [Découvrir sans rien saisir](#découvrir-sans-rien-saisir)
3. [Ce que fait Solvéa](#ce-que-fait-solvéa)
4. [Un espace et une couleur par profil](#un-espace-et-une-couleur-par-profil)
5. [Solvi, l'aide et les visites guidées](#solvi-laide-et-les-visites-guidées)
6. [Sur téléphone](#sur-téléphone)
7. [Accessibilité](#accessibilité)
8. [Vérifications](#vérifications)
9. [Architecture](#architecture)
10. [Limites à connaître](#limites-à-connaître)
11. [Suite envisagée](#suite-envisagée)

---

## Démarrer

Node 20 ou plus récent.

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

L'application s'ouvre sur la page de connexion. Deux chemins partent de là :

| Bouton | Ce qu'il fait |
| --- | --- |
| **Créer ma pharmacie** | Trois étapes : la pharmacie et ses horaires, l'équipe, une vérification. |
| **Comment ça marche ?** | Ouvre les visites guidées et l'environnement de test, sur une pharmacie d'exemple fictive. |

---

## Découvrir sans rien saisir

### Quatre visites guidées

Chaque visite **raconte une histoire**, chapitre après chapitre. Au début d'un chapitre, une annonce dit ce
qu'on va y faire, dans la peau de qui, et où l'on en est dans le plan.

| Visite | Durée | Ce qu'elle raconte |
| --- | --- | --- |
| **Titulaire** | 30 min, 55 étapes | La vie d'un planning, de la création de la pharmacie au bilan du mois. |
| **Pharmacien** | 7 min | L'espace d'un pharmacien adjoint : planning, demandes, gardes, compte. |
| **Équipe** | 7 min | L'espace d'un préparateur : planning, demandes, collègues, compte. |
| **Journée type** | 8 min, 13 étapes | Une journée du matin au soir, avec ceux qui la vivent. |

Les chapitres de la visite du titulaire suivent l'ordre où les choses se vivent :

1. **Installer la pharmacie** : équipe, fiche d'une personne, marques d'un animateur, horaires, règles.
2. **Recueillir les souhaits** : les préférences du mois, vues par un préparateur.
3. **Construire et publier** : la grille, les propositions, les contrôles, les gardes, la publication.
4. **L'équipe reçoit son planning** : ce que voient un préparateur et un pharmacien adjoint.
5. **Les demandes de l'équipe** : congé, remplacement, la décision du titulaire.
6. **Les imprévus** : absence du matin, appel à l'équipe, retard, décision à deux titulaires.
7. **Le bilan du mois** : heures, équité, journal et paie, documents.
8. **Au quotidien** : tableau de bord, raccourcis, aide, compte.

### L'environnement de test

Dans la barre du haut, l'étiquette « Espace … » ouvre un petit menu : on y passe d'un regard à l'autre sans
se reconnecter (titulaire principal, second titulaire, pharmacien adjoint, préparateur, animateur, apprenti,
étudiant), on y lance les tutoriels, on y remet les données d'exemple à neuf. Aucune barre ne s'ajoute à la
page. Les personnes, les marques et la pharmacie de l'exemple sont inventées.

---

## Ce que fait Solvéa

### 1. Installer

- **L'équipe** : chaque personne a sa fiche (contrat, compétences et diplômes, compte de connexion).
- **Les marques d'un animateur** : on prend une marque dans le **répertoire de la pharmacie**, ou on écrit
  son nom si elle n'y est pas encore. Elle rejoint alors le répertoire. Pour chaque marque, on touche les
  familles de produits concernées.
- **La pharmacie** : son nom et, si on le souhaite, sa **surface en mètres carrés**, à la création comme
  dans les réglages.
- **Les horaires d'ouverture** : jour par jour, avec deux petits boutons à icône (coupure du midi,
  fermeture) dont une bulle dit le rôle au survol.
- **Les règles** : durées, repos, pauses, délais. Chaque fiche indique sa source et sa version.
- **Qui prépare le planning** : « avec l'équipe » ou « vous seul ». Sous le choix, Solvéa écrit ce que
  cela change réellement, pour l'équipe et pour le titulaire.

### 2. Construire

- **La semaine entière tient dans la largeur**, du lundi au dimanche, sans défilement, à toute taille
  d'écran. Quand la place manque, les tuiles se resserrent par paliers.
- **Deux sortes de pauses** : la **pause déjeuner**, qui coupe le poste et n'est pas comptée dans le temps
  de travail, et les **pauses courtes** (dix à vingt minutes), qui se lisent sur le planning sans changer
  le décompte des heures. « Une par demi-journée » les propose d'un geste ; un poste type peut les porter.
  Elles figurent dans la journée, dans « Mon planning » et sur la feuille imprimée (« déj. » et « p. »).
- **Tâche d'un poste** : comptoir, réception, administratif. « Planifier une formation » et « Planifier un
  inventaire » ouvrent leur propre fenêtre (intitulé, lieu, participants).
- **Postes types** : des cartes à la couleur du moment de la journée, avec pictogramme, horaires et durée.
  Un clic remplit le poste.
- **Trois propositions comparables** : équité d'abord, préférences d'abord, contrats d'abord. Les règles
  passent toujours avant. Quand le titulaire prépare seul, il n'y a pas de préférences : la deuxième
  proposition devient **« Habitudes d'abord »** (la semaine telle qu'il la publie d'ordinaire, complétée
  par le calcul), et l'indicateur « Fidèle à vos habitudes » remplace « Préférences suivies ».
- **Les contrôles, en mots** : « Complet », « Manque du monde », « Pharmacien à prévoir ».

> [!IMPORTANT]
> Un titulaire est un pharmacien. Quand il est en poste, il ne manque aucun pharmacien, pause comprise.
> Si la pharmacie reste ouverte après son départ, la grille écrit « Pharmacien à prévoir · après 16 h 30 »
> et le message dit quoi faire : prolonger le poste, ou poser un autre pharmacien.

### 3. Publier, au mois

| Étape | Ce qui se passe |
| --- | --- |
| **L'échéance** | Le planning d'un mois se transmet N jours avant le 1er (14 par défaut). |
| **Le rappel** | M jours avant l'échéance (7 par défaut), une note apparaît sur le tableau de bord. |
| **Le relais** | Passé l'échéance, Solvéa prépare en brouillon les semaines restées vides. |
| **La publication** | « Publier le mois » publie les semaines prêtes et nomme celles qui restent à corriger. |

Le relais reprend les **habitudes** de la pharmacie : pour chaque personne et chaque jour, sa journée la
plus fréquente sur les huit dernières semaines publiées. Deux garde-fous :

- un planning **commencé à la main passe toujours avant** : il n'est jamais touché ;
- **rien n'est publié sans le titulaire** : il relit, corrige, puis publie.

### Imprimer

Le bouton d'impression ouvre un **aperçu** : la feuille telle qu'elle sortira, en A4 paysage.

| Réglage | Choix |
| --- | --- |
| **Période** | La semaine sur une page, ou le mois, semaine après semaine. |
| **Encre** | Couleur (la teinte dit le moment de la journée) ou noir et blanc (heures en gras, absences en italique dans un cadre pointillé, jours fermés hachurés). |
| **Personnes** | Toute l'équipe, ou mes seuls postes. |

La feuille porte le nom de la pharmacie, la période, la date d'impression et l'état du planning : publié,
ou « brouillon, non publié ». L'équipe n'imprime que ce qui est publié, et l'absence d'un collègue s'y lit
« Absent », jamais par sa nature. Une grande équipe passe sur plusieurs pages sans perdre personne.

### 4. Décider

Un titulaire ne tranche pas par oui ou par non. Chaque demande (absence, horaires, remplacement) ouvre une
**fenêtre de décision** en trois temps :

1. **La demande** : son objet, ses dates, sa raison, son urgence.
2. **Ce qu'elle implique** : les postes déjà planifiés, le comptoir sans pharmacien ou sous l'effectif,
   qui d'autre est absent, qui peut reprendre le poste.
3. **La décision** : plusieurs issues possibles, avec le message que la personne recevra.

| Demande | Décisions possibles |
| --- | --- |
| **Remplacement** | Prévenir l'équipe · confier le poste à quelqu'un · refuser avec la raison |
| **Absence** | Accepter · refuser avec la raison |
| **Horaires** | Simple préférence · préférence prioritaire · indisponibilité reconnue · refuser |

Dans tous les cas, « En parler d'abord » ouvre la conversation avec la personne, sans rien décider.

### 5. Les imprévus

- **« Retard ou absence »**, dans la barre du haut de tous les écrans. Pour soi : les titulaires sont
  prévenus aussitôt (notification et message). Un titulaire le fait aussi **pour quelqu'un d'autre** :
  le retard est noté, l'absence enregistrée et ses postes passent à couvrir.
- **Prévenir d'un retard en deux gestes**, sous son prochain poste : on touche la durée, l'heure
  d'arrivée se calcule, on envoie. L'avis se corrige ou s'annule.
- **L'appel à l'équipe** : tous ceux qui peuvent tenir un poste sont prévenus ensemble ; celui qui a le
  moins dépanné passe d'abord.
- **Accident du travail ou de trajet** : il se signale comme une absence, avec les faits utiles à la
  déclaration (où, quand, ce qui s'est passé, un témoin). La fenêtre rappelle la suite dans l'ordre :
  médecin, déclaration, feuille d'accident.

> [!IMPORTANT]
> Un accident du travail se déclare à la caisse d'assurance maladie dans les 48 heures, dimanches et
> jours fériés non comptés. Solvéa calcule cette date, l'affiche en tête du tableau de bord et la
> rappelle jusqu'à ce que le titulaire note « C'est fait ». Solvéa ne déclare rien lui-même.

### 6. Suivre

- **Compteur d'heures** : « Faire rattraper » ou « Faire récupérer » ouvre le planning de la personne. Un
  clic sur une plage libre y place les heures ; Solvéa propose aussi des créneaux sans règle enfreinte.
- **Équité** : samedis, fermetures, gardes, dépannages, face à la part de chacun.
- **Journal et fiche navette** : chaque décision est tracée ; la fiche du mois s'exporte.
- **Documents** : plannings publiés, absences, justificatifs (visibles des seuls titulaires).

### 7. Gardes, formations, inventaires

- **Gardes** : chaque ligne se lit en trois temps (la garde et son état, le jour et les heures, sa forme
  et la personne).
- **Formations** : interne ou externe, avec leur **lieu**. Les participants le lisent dans leur espace.
- **Inventaires** : une date, un horaire, les personnes mobilisées.

### 8. Messages et rendez-vous

Un fil pour toute l'équipe, des conversations privées, et des **rendez-vous** demandés depuis la
messagerie, proposés quand les deux personnes sont en poste, puis fixés dans l'agenda de chacun.

Un rendez-vous fixé se lit partout où on en a besoin : dans la grille de la semaine (une pastille sous
le poste, comme les missions), dans « Mon planning », et sur l'accueil. **Les titulaires ont eux aussi
leur planning** : « Mon planning » figure dans leur menu, et le tableau de bord porte un bloc « Mon
agenda » (prochain poste, rendez-vous à venir) à côté de ce qu'il faut faire en premier.

### Et les coûts ?

> [!NOTE]
> Solvéa ne connaît pas les salaires : **aucun montant n'est affiché par défaut**. Une option des réglages
> affiche des coûts estimés, calculés sur les seuls taux horaires que le titulaire saisit dans les fiches.
> Une personne sans taux n'est pas comptée. Ce n'est jamais un calcul de paie.

---

## Un espace et une couleur par profil

Chaque profil a son **accueil** : une bannière à sa couleur (portrait, rôle, pharmacie), ce qui attend sa
réponse, son prochain poste, puis ce qui est propre à son métier.

| Profil | Couleur de base | Ce qui lui est propre |
| --- | --- | --- |
| Titulaire principal | Bleu ciel | Tableau de bord, toutes les décisions |
| Autre titulaire | Bleu marine | Mêmes écrans ; ses décisions attendent un accord |
| Pharmacien adjoint | Bleu-vert | Ses gardes, ses missions |
| Préparateur | Indigo | Ses compétences, ses postes |
| Animateur | Framboise | Les marques qu'il présente, en cartes : nom, initiales, familles de produits |
| Apprenti | Vert | Son alternance |
| Étudiant | Ambre | Ses études et ses horaires |
| Rayonniste | Terracotta | Les rayons qui lui sont confiés |

La couleur de base distingue les espaces d'un coup d'œil. Chacun peut en choisir une autre dans
« Mon compte » : dix couleurs, en clair comme en sombre.

Le **tableau de bord du titulaire** suit une hiérarchie simple : la bannière accueille, **un seul bloc**
dit quoi faire en premier (c'est le seul bouton plein de la page), les notes tiennent sur une ligne, le
détail vient dessous, en retrait.

---

## Solvi, l'aide et les visites guidées

**Solvi** est la mascotte de l'aide. Il n'apparaît que dans l'aide (le bouton « Aide », l'assistant, la
page d'aide) et dans les visites guidées. Une brume légère le détache de ce qui passe dessous.

Solvi est vivant sans être agité : il respire, ses yeux suivent ce qu'il montre, il s'écrase un peu en se
posant, hoche la tête quand il prend la parole, et de lui-même jette un coup d'œil ou penche la tête. Tout
cela s'arrête si l'appareil demande moins de mouvement.

Pendant une visite, **on lit, puis on regarde**, et une seule chose bouge à la fois :

1. le projecteur se pose sur le bloc concerné ;
2. Solvi range sa bulle, vole s'y poser d'un seul trait, puis l'ouvre ;
3. il **explique le geste** (« Saisissez le prénom de votre collaborateur ») et annonce à part ce qu'il
   saisit lui-même : « Pour l'exemple, j'écris… » ;
4. on a le temps de lire ; le pointeur part de Solvi, glisse jusqu'au bouton et agit.

| Commande | Effet |
| --- | --- |
| **Pause** (ou barre d'espace) | Tout s'arrête là où il en est ; « Reprendre » repart. |
| **Continuer** (ou flèche droite) | Passe à la suite sans attendre la fin du temps de lecture. |
| **Rythme** : posé, normal, vif | Change seulement le temps laissé pour lire et regarder. |
| **Passer** | Va à l'étape suivante sans voir la fin de la démonstration. |

Quand l'histoire passe d'une personne à une autre, l'interface prend la couleur de son profil et un
bandeau dit qui l'on est devenu.

L'**aide** répertorie chaque fonction : une réponse, un bouton pour y aller, un tutoriel.

### Parler à Solvi

On lui écrit comme on parle. Il répond d'après des règles, sur l'appareil : ce n'est pas une
intelligence artificielle qui improvise, et rien de ce qu'on lui écrit ne quitte le navigateur.

| Il comprend | Exemples |
| --- | --- |
| **Les fautes de frappe et les raccourcis** | « qui travail demian », « bjr qui bosse dem1 ? », « mes rdv » |
| **Les dates, dites de toutes les façons** | « samedi », « lundi prochain », « le 24 », « 24/11 », « ce week-end », « hier » |
| **Les personnes, par leur prénom** | « Quand travaille … ? », « … est là samedi ? », « Où est … ? » |
| **La suite d'une question** | « Qui travaille demain ? » puis « et samedi ? », « et … ? », ou simplement « oui » |
| **L'humeur** | un mot gentil, une fatigue, une colère : il répond à ce qui est dit, puis propose quelque chose d'utile |

| Il sait répondre | D'après |
| --- | --- |
| Ma journée, mon prochain poste, ma pause, mes jours sans poste, mes heures de la semaine | le planning publié |
| Qui travaille, qui ouvre, qui ferme, quel pharmacien est là, avec qui je travaille | le planning du jour demandé |
| Mes rendez-vous, mes gardes, mes demandes et leur réponse | l'agenda et les demandes |
| Ce qui attend un titulaire : décisions, retards, accidents à déclarer, échéance du mois | les décisions en cours |
| Les horaires de la pharmacie, les jours fériés, l'équipe, le vocabulaire (« c'est quoi une astreinte ? ») | les réglages et le lexique |
| Une durée (« de 8 h 30 à 16 h 30, ça fait combien ? ») ou un calcul (« 151,67 / 4 ») | une calculette |

Il agit aussi : « je suis en retard », « je suis malade » ou « je me suis blessé » ouvrent la bonne
fenêtre ; « ouvre les gardes » y emmène. Il garde ses limites : aucun conseil médical, aucun avis
juridique, et il renvoie vers une personne quand il ne sait pas.

---

## Sur téléphone

- **Une barre du bas** avec quatre rubriques fixes et un bouton « Menu », qui ouvre toutes les rubriques
  dans un volet. Rien ne défile horizontalement pour naviguer.
- **Le planning tient en largeur** : la semaine entière, les deux heures l'une sous l'autre, la personne
  reconnue à ses initiales.
- **En-têtes, barres d'outils et fenêtres** resserrés ; les boutons se partagent la largeur.

Quelques tableaux denses (postes types, points forts de l'équipe, frise des congés) gardent un défilement
interne sur un petit écran.

---

## Accessibilité

- **Contrastes** : tout texte tient au moins 4,5:1 sur son fond, tout contour de champ au moins 3:1, dans
  les dix couleurs, en clair comme en sombre.
- **Champs** : tous portent le style de la plateforme. Aucun ne garde l'aspect du navigateur, même sur un
  appareil réglé à l'inverse de l'application.
- **Jamais la couleur seule** : chaque état a aussi un pictogramme, un libellé ou une forme.
- **Clavier** : fenêtres, menus et visites se pilotent au clavier ; le focus est toujours visible.
- **Mouvement** : les animations s'arrêtent si l'appareil demande de les réduire.

> [!WARNING]
> Ce n'est pas une déclaration de conformité. Un audit RGAA complet demande des contrôles manuels,
> notamment avec des lecteurs d'écran, qui restent à faire.

---

## Vérifications

| Niveau | Ce qui est vérifié |
| --- | --- |
| **Tests unitaires** | 137 tests sur le moteur : règles, génération, présence du pharmacien, rattrapage, rendez-vous, retard, échéance du mois, accident du travail, et l'assistant (fautes de frappe, dates, personnes, fil de la conversation). |
| **Parcours automatisés** | Chaque fonction est rejouée dans un navigateur, avec un audit d'accessibilité automatique (axe-core, WCAG 2.1 A et AA) sur chaque écran, en clair, en sombre et sur téléphone. |
| **Visites guidées** | Les quatre visites sont déroulées en entier par un script. |
| **Champs** | Un relevé de tous les champs de saisie, avec un appareil réglé à l'inverse de l'application. |

---

## Architecture

React 18, TypeScript strict, Vite, zustand. Aucun serveur.

```
src/
  domain/    types, temps (jours fériés, changement d'heure), fiches de règles, profils
  engine/    contrôles, génération, diagnostic, réparation, gardes, équité, paie, publication,
             échéance du mois, rattrapage, rendez-vous, retard, accident du travail
  data/      jeu de démonstration, repères de calendrier
  store/     état de l'application (sauvegarde locale, annulation)
  ui/        écrans et composants
```

- **Règles en données.** Chaque règle est une fiche avec source, date d'effet, version et niveau de
  vérification. Modifier une valeur crée une version, tracée au journal.
- **Impératif et souple ne se compensent pas.** Le générateur classe les solutions sur trois niveaux :
  règles impératives, effectif attendu, objectifs souples. Une préférence ne rachète jamais une règle.
- **Moteur pur, testé.** `src/engine` ne dépend ni de React ni du navigateur.

---

## Limites à connaître

> [!CAUTION]
> Les fiches de règles marquées « à valider » viennent de sources secondaires. À faire relire par un
> avocat en droit social et un spécialiste de la paie officinale avant tout usage réel.

**Sans serveur**

- Les données sont enregistrées dans le navigateur : pas de partage entre postes. Connexion, messages,
  notifications et demandes fonctionnent entre les personnes qui utilisent le même appareil.
- Aucun courriel ni SMS ne part. Un retard signalé s'affiche dans l'application des titulaires, sur
  cet appareil.
- Le rappel de l'échéance et le relais par Solvéa se font à l'ouverture de l'application par un titulaire.
- Les justificatifs et documents restent dans le navigateur (600 Ko par fichier, 3 Mo au total). Un vrai
  dépôt de documents de santé demande un hébergement adapté.

**Ce que Solvéa ne calcule pas**

- Pas de pointage : la fiche navette exporte du prévu, pas du réalisé.
- Le compteur d'heures est indicatif : ni majoration ni repos compensateur.
- Les coûts ne sont jamais une paie, et les montants des indemnités de garde ne sont pas renseignés.
- Les onze jours fériés nationaux sont calculés ; ceux d'Alsace-Moselle et de l'outre-mer ne le sont pas.

**Ce qui reste une aide**

- Le planning préparé d'après les habitudes est un brouillon : il reprend ce qui s'est fait, il ne juge
  pas si c'était bien. Il reste à relire.
- Le générateur est une recherche locale : de bonnes semaines en moins de deux secondes pour une dizaine
  de personnes, sans preuve d'optimalité.
- L'assistant répond d'après des règles et une trentaine de fiches. Une question formulée autrement peut
  ne pas être comprise : il le dit, et renvoie vers l'aide ou vers une personne. Il ne donne ni conseil
  médical, ni conseil juridique.
- Les points forts de l'équipe reposent sur ce qui a été noté dans l'application. Ce n'est pas une
  évaluation.
- La durée de conservation d'un justificatif relève des obligations du titulaire : l'application ne
  supprime rien toute seule.

---

## Suite envisagée

1. **Serveur et comptes**, hébergés dans l'Union européenne : vraie authentification, messages et
   notifications reçus sur le téléphone de chacun, relais du planning sans ouvrir l'application.
2. **Pointage simple** (code ou QR code, ni photo ni biométrie) pour distinguer prévu, réalisé, validé.
3. **Échanges de postes** entre collègues, validés automatiquement s'ils respectent règles et équité.
4. **Autres conventions collectives** : le noyau est générique, seules les fiches de règles changent.
