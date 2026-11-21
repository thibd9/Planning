# Revue UX / UI de Solvéa : pages et fenêtres du titulaire (code UX-titulaire)

Profils : Caroline (titulaire principale, role 0), et Pierre (titulaire secondaire, role 1) pour ce qui change chez lui.
Données : l'exemple « Grande Pharmacie de la Pinède », date du jour simulée vendredi 20 novembre 2026, heure réelle du
navigateur (soirée, d'où « Bonsoir » et « Journée terminée »).
Tailles : **O** = ordinateur 1440×900, **P** = portable 1280×760, **T** = téléphone 390×800 (tactile), **S** = thème
sombre 1440×900. Toutes les captures sont dans
`/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/UX-titulaire/captures/`
(colonne « Capture » : nom du fichier dans ce dossier). Préfixes : `d-` = O, `p-` = P, `t-` = T (les `t-…-A1.png`
assemblent quatre écrans de téléphone successifs, de gauche à droite, du haut vers le bas de la page), `s-` = S,
`o-` = O avec tout déplié. Le numéro final est le palier de défilement (1 = haut de page).
Mesures : faites avec `getComputedStyle` / `getBoundingClientRect` (fichiers `mesures-*.json` du même dossier).

Gravité : **Bloquant** (empêche d'utiliser la page), **Majeur** (gêne forte, induit en erreur), **Mineur**,
**Cosmétique**.

---

## Synthèse

300 constats : 282 répartis sur 21 sections (pages et fenêtres) et 18 transversaux. **1 Bloquant**, **60 Majeurs**,
**165 Mineurs**, **74 Cosmétiques**.

Les dix plus graves :
1. **9.1 Messages au téléphone (Bloquant)** : la page fait 853 px de large pour 390 ; listes, conversation et bouton
   « Envoyer » sont hors écran, il faut faire défiler de côté pour écrire.
2. **T.9 / 4.1 / 12.1 / 12.2 Chiffres contradictoires entre pages** : pharmaciens « 1,8 / 2, sous le seuil » (Équipe)
   contre « 3,7 pour 2,1, plus qu'il n'en faut » (Réglages) ; heures en moins 45 h 30 (Heures) contre 22 h 30
   (Statistiques) ; 0 h contre 0,5 h en plus ; 1 contre 3 postes à couvrir.
3. **21.2 / 21.3 Accord du titulaire secondaire** : la demande décidée par Pierre est comptée deux fois (« Accords à
   donner » et « Demandes ») et Caroline doit donner son accord sans voir ce que la décision implique.
4. **T.10 / 4.3 / 8.3 / 10.4 Actions immédiates sans confirmation** : supprimer un poste type (sans message ni
   annulation), « Choisir » une option d'absence, « Solder », « Régulariser automatiquement ».
5. **2.1 / 3b.1 / 18.2 Absence de la titulaire** : quatre entrées, deux fenêtres différentes ; « Poser une absence »
   ouvre « Enregistrer un besoin » préréglé sur « Ne pas travailler certains jours » (raccourcis « Chabbat »…).
6. **T.1 / T.2 / T.3 Téléphone** : onglets cachés sans indice (l'onglet actif peut être invisible), textes écrasés
   en colonnes d'un mot par ligne sur une dizaine d'écrans, détail d'un élément choisi affiché plusieurs écrans plus
   bas sans y amener (Équipe, Messages, Gardes).
7. **4.4 / 6e.2 Débordements à l'ordinateur** : tableau des postes types (colonne « Travail effectif » et corbeilles
   hors cadre, on supprime une ligne sans voir son nom) et grille du mois coupés à droite même à 1440.
8. **10.1 / 10a.1 Heures** : titre « Le moins d'heures en plus possible » alors que tous les compteurs sont en moins ;
   la fenêtre « Faire rattraper » affiche 4 h, « il restera -5 h » et une proposition de 3 h pour un écart de 8 h.
9. **8.2 / 8b.1 Résoudre** : la même décision d'absence se prend à deux endroits (cartes de la page et fenêtre de
   1901 px, près de dix écrans au téléphone, qui fait d'abord régler des jours passés).
10. **T.8 / 16.7 / 2.3 Noms changeants** : Résoudre / À décider, Tableau de bord / Accueil, l'onglet « Planning » du
    téléphone ouvre Construire et non Mon planning ; Mon compte / Paramètres / Mes paramètres.

Viennent ensuite : 5.1 et 5.2 (Règles « obligatoire » mais réglable ; « Nombre de pharmaciens : 1300000 € »), 13.1
(identifiants techniques « duree.quotidienne@1.0 » dans le Journal), 2.11 (heures fausses à la lecture dans le
calendrier du téléphone), 1.9 et T.15 (couleurs sans légende), 15.1 (l'Aide renvoie la titulaire vers « Mes
demandes », qu'elle n'a pas).

---

## 1. Tableau de bord

Identité : premier écran après connexion de la titulaire ; menu « Tableau de bord » (barre latérale), onglet « Accueil »
de la barre du bas sur téléphone. Profil : titulaire (Caroline).

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 1.1 | Répétition | Le nombre de décisions est affiché quatre fois sur le même premier écran : « 7 décisions vous attendent » dans le bandeau bleu, « À DÉCIDER 7 décisions à prendre » dans la carte de droite, la pastille « 7 » de « Résoudre » dans le menu, et la pastille « 16 » de la cloche (qui recompte les mêmes décisions avec d'autres éléments). | O, P, T | Mineur | d-tableau-1.png, t-tableau-A1.png |
| 1.2 | Répétition | L'effectif du jour est dit trois fois : tuile « L'équipe aujourd'hui 7 en poste, 1 absent », titre de carte « AUJOURD'HUI AU COMPTOIR 7 personnes en poste · 1 absent », puis ligne grise « Absent : Igor L. » sous la frise. | O, P, T | Mineur | d-tableau-1.png, d-tableau-2.png |
| 1.3 | Répétition | La date du jour apparaît deux fois en haut d'écran : « ven. 20 novembre » dans la barre du haut et « VENDREDI 20 NOVEMBRE 2026 » dans le bandeau. Le nom de la pharmacie apparaît trois fois : sélecteur de la barre latérale (« Grande Pharmacie de la P… », coupé), barre du haut (« Grande Pharmacie de la Pin… », coupé) et sous-titre du bandeau (« Titulaire principal · Grande Pharmacie de la Pinède »). | O, P | Mineur | d-tableau-1.png |
| 1.4 | Cohérence | Deux cartes traitent du même sujet (le planning de décembre) avec deux boutons différents : « PLANNING DE DÉCEMBRE, En retard depuis le mar. 17 novembre » avec « Préparer décembre », et juste dessous « LE PROCHAIN PLANNING, Semaine du 7 – 13 décembre 2026 » avec « Construire ». On ne sait pas lequel utiliser. | O, P, T | Majeur | d-tableau-2.png |
| 1.5 | Cohérence | La tuile « Semaine prochaine : Publiée, à partir du 23 nov. » et la carte « LE PROCHAIN PLANNING : Semaine du 7 – 13 décembre 2026 » emploient « prochain » pour deux semaines différentes, sur le même écran. | O, P, T | Mineur | d-tableau-1.png, d-tableau-2.png |
| 1.6 | Cohérence | Un même objet porte trois noms : « 1 poste sans personne » (carte À faire en premier), « Absences à couvrir » (liste À décider) et « 3 postes à couvrir » (décision récente « Arrêt d'Igor L. »), avec des nombres différents (1 et 3) sans que l'écran dise que deux des trois sont déjà passés. | O, P, T | Majeur | d-tableau-1.png, d-tableau-3.png |
| 1.7 | Cohérence | Accord : Caroline est présentée « Titulaire principal » (bandeau et frise) ; dans la frise, Sarah est « Animateur ». Le masculin est appliqué à des femmes. | O, P, T, S | Mineur | d-tableau-1.png |
| 1.8 | Cohérence | Élision manquante : « Le plus proche : celui de Igor L. » (carte À faire en premier), alors que la décision récente écrit « Arrêt d'Igor L. ». | O, P, T | Cosmétique | d-tableau-1.png |
| 1.9 | Lisibilité des données | Frise « Aujourd'hui au comptoir » : aucune légende. Les barres sont orange, jaune ou violettes, avec une zone hachurée et un petit trait vertical, sans que rien n'explique ces couleurs (fonction ? type de poste ?), les hachures (pause) ni le trait. | O, P, T | Majeur | d-tableau-1.png |
| 1.10 | Lisibilité | Le petit trait vertical posé dans chaque barre chevauche l'heure de fin : on lit « 1\|6 h 30 » sur les barres de 8 h 30 – 16 h 30 au portable. Au téléphone les étiquettes se superposent : « 8 h 303 h » (Thomas, 8 h 30 et 13 h collés), « 14 h 1\|9 h 30 » (Inès). | P, T | Majeur | p-tableau-1.png, t-tableau-A1.png |
| 1.11 | Lisibilité | Échelle des heures de la frise en 11 px gris (« 8 h, 10 h … 20 h »), et étiquettes des barres en 11,5 px ; au téléphone les sept repères tiennent sur 200 px et se touchent. L'étiquette « Journée terminée · 23 h 28 » est posée sur le repère « 20 h », qui est barré par le pointillé de l'heure courante. | O, P, T | Mineur | d-tableau-1.png, t-tableau-A1.png |
| 1.12 | Lisibilité des données | Tuile « Pharmacien présent 95 % cette semaine » : rien ne dit 95 % de quoi (des heures d'ouverture ?), ni si c'est bien ou mal ; le clic mène à Construire sans expliquer. | O, P, T | Mineur | d-tableau-1.png |
| 1.13 | Lisibilité | Chiffres à chasse fixe très espacés dans « Mon agenda » : « 1 1 h 30 – 1 9 h 30 », « Demain : 9 h – 1 9 h » se lisent comme des chiffres séparés. À 1440 le titre « Demain : 9 h – 19 h » est coupé en deux lignes. | O, P | Cosmétique | d-tableau-2.png |
| 1.14 | Hiérarchie | Le bandeau bleu (illustration, salutation) occupe 150 px en haut d'écran pour un message déjà répété ailleurs ; au téléphone, la carte prioritaire « À faire en premier » n'apparaît qu'après le bandeau et cinq tuiles (deuxième écran). | T | Mineur | t-tableau-A1.png |
| 1.15 | Ergonomie | « 7 décisions vous attendent » dans le bandeau n'est pas cliquable (simple texte), alors que les cinq tuiles juste dessous le sont. | O, P, T | Mineur | d-tableau-1.png |
| 1.16 | Adaptation | L'assistant Solvi (bouton « Aide » fixe en bas à droite) recouvre les pastilles des lignes « Demandes de l'équipe 2 » et « Gardes 3 » (la pastille 3 est à moitié cachée) ; au téléphone, il recouvre la fin de la frise et la ligne « Absent : Igor L. ». | O, P, T | Mineur | d-tableau-1.png, p-tableau-1.png, t-tableau-A1.png |
| 1.17 | Adaptation | Au téléphone, la carte « Décisions récentes » met sa phrase d'explication dans une colonne de 90 px de large à côté du bouton « Tout marquer comme lu » : neuf lignes de deux ou trois mots. | T | Majeur | t-tableau-A2.png |
| 1.18 | Adaptation | Au téléphone, les tuiles se coupent mal : « 8 à / régulariser », « à partir du 23 / nov. », « 7 personnes / en poste / · 1 absent » (le point médian commence une ligne). Le pas à pas « Préférences / Brouillon / Contrôles / Publication » à 1440 range « À construire » sur deux lignes dans une colonne étroite et laisse 60 px vides au-dessus. | O, T | Cosmétique | t-tableau-A1.png, d-tableau-2.png |
| 1.19 | Cohérence | Vocabulaire différent pour la même action dans « Décisions récentes » : bouton « Tout marquer comme lu » pour l'ensemble, bouton « Vu » pour un élément. La même décision « Arrêt d'Igor L. enregistré » se retrouve aussi dans la cloche (« Décidé récemment ») et dans le Journal. | O, P, T | Cosmétique | d-tableau-2.png |
| 1.20 | Cohérence | La rubrique s'appelle « Tableau de bord » dans la barre latérale et « Accueil » dans la barre du bas du téléphone ; la page n'a pas de titre de page (seulement « Bonsoir Caroline »), contrairement à toutes les autres rubriques qui ont un surtitre et un titre. | T | Mineur | t-tableau-A1.png |
| 1.21 | Ergonomie | Cibles sous 40 px : boutons « Mon planning » (34 px), « Tout marquer comme lu » (34 px), « Vu » (34 px) ; liens du pied « 01 99 00 12 34 » et « support@solvea.example » (20 px de haut). | O, P | Mineur | d-tableau-2.png |
| 1.22 | Adaptation | Thème sombre : rendu correct ; les barres de la frise restent en pastels très clairs, l'écart de luminosité avec le fond sombre en fait l'élément le plus voyant de l'écran, plus que la carte prioritaire. | S | Cosmétique | s-tableau-1.png |

## 2. Mon planning

Identité : menu « Mon planning » (barre latérale) ou « Mes horaires » dans le menu du compte. Profil : titulaire
(Caroline). Sur téléphone, cette page n'a pas d'onglet dans la barre du bas (voir 2.3).

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 2.1 | Cohérence | Le bouton principal « Poser une absence » ouvre une fenêtre intitulée « Enregistrer un besoin », préréglée sur « Type de besoin : Ne pas travailler certains jours », avec des raccourcis « Chabbat, Prière du vendredi, Office du dimanche… ». Ce n'est pas le formulaire d'absence annoncé. | O, P, T | Majeur | d-moi-absence-1.png, t-moi-dialogues.png |
| 2.2 | Cohérence | Dans cette même fenêtre, l'en-tête dit « la raison est facultative quand vous l'enregistrez vous-même », l'encadré juste dessous dit « Une raison est demandée pour chaque demande. Seuls vos titulaires la voient » : deux phrases contradictoires, et la seconde s'adresse à une salariée alors que c'est la titulaire qui remplit. | O, P, T | Mineur | d-moi-absence-1.png |
| 2.3 | Cohérence | Sur téléphone, l'onglet « Planning » de la barre du bas n'ouvre pas « Mon planning » mais « Construire » (chez les salariés, le même onglet « Planning » ouvre leur planning). Quand on est sur Mon planning, aucun onglet n'est allumé : on ne sait pas où l'on est. | T | Majeur | t-moi-A1.png |
| 2.4 | Cohérence | Le bouton « Planning de l'équipe » mène à « Construire » (titre « Comment couvrir la semaine ? »), pas à une page « Planning de l'équipe ». | O, P, T | Mineur | d-moi-1.png |
| 2.5 | Cohérence | La carte « Un collègue cherche un remplaçant » affiche à la titulaire « Vous proposer n'engage à rien tant que le responsable n'a pas validé », alors que c'est elle la responsable, avec un bouton « Je me propose » grisé (texte blanc sur bleu pâle, à peine lisible) et la raison en petit (« vous travaillez déjà sur cet horaire »). La titulaire voit une carte d'action qu'elle ne peut pas utiliser. | O, P, T | Mineur | d-moi-1.png |
| 2.6 | Répétition | Le poste de demain est montré deux fois sur la même page avec le même détail (carte « PROCHAIN POSTE : Demain · journée longue 9 h – 19 h, 9 h de travail, pause déjeuner 13 h – 14 h… » et carte « 21 Samedi » de la semaine), et une troisième fois au Tableau de bord (« Mon agenda, Demain : 9 h – 19 h »). | O, P, T | Mineur | d-moi-1.png, d-moi-2.png |
| 2.7 | Répétition | Trois façons de signaler un retard ou une absence sur le même écran : « Poser une absence » (en-tête), « Prévenir d'un retard » (carte du prochain poste) et « Retard ou absence » (barre du haut), plus « Mon absence » dans le menu Créer. Les libellés diffèrent pour des actions voisines. | O, P, T | Mineur | d-moi-1.png |
| 2.8 | Lisibilité | Dans les cartes de jours, les horaires sont coupés en fin de ligne : « Pause déjeuner 14 h – / 15 h », « Pauses courtes à 10 h / 30, 15 h (15 min) », « Pause courte à 17 h 15 / (15 min) ». Au téléphone : « 9 h – 14 / h », « 12 h 30 – 13 / h 30 ». Les espaces dans les heures ne sont pas insécables. | O, P, T | Mineur | d-moi-2.png, t-moi-A1.png |
| 2.9 | Lisibilité des données | Les cartes de jours ont chacune une couleur (violet « Soir », jaune « Matin », orange « Journée », bleu « Journée longue ») et une petite barre de segments colorés en pied, sans légende en mode « Semaine » (la légende n'existe qu'en mode « Calendrier »). La barre de segments n'est expliquée nulle part. | O, P, T | Mineur | d-moi-2.png |
| 2.10 | Lisibilité | Le mot « Aujourd'hui » sous « 20 Vendredi » est bleu et souligné, comme un lien, mais n'en est pas un. | O, P | Cosmétique | d-moi-1.png |
| 2.11 | Lisibilité des données | Vue « Calendrier » au téléphone : les horaires débordent de leur case et perdent leur premier chiffre : on lit « 8 h 30 / 6 h 30 » pour 8 h 30 – 16 h 30, « 1 h 30 / 9 h 30 » pour 11 h 30 – 19 h 30 (le filet de couleur à gauche de la case recouvre le premier chiffre). Les heures affichées sont fausses à la lecture. | T | Majeur | t-moi-cal-A.png |
| 2.12 | Adaptation | Vue « Calendrier » au téléphone : « Aujourd'hui », « < » et « > » deviennent trois gros boutons pleine largeur empilés (150 px de haut) avant même la grille du mois. | T | Mineur | t-moi-cal-A.png |
| 2.13 | Hiérarchie | Le titre de rubrique change selon le mode : « Mes semaines » en mode Semaine, « Mon calendrier » en mode Calendrier, alors que c'est le même bloc avec un sélecteur. | O, P, T | Cosmétique | d-moi-1.png, d-moi-cal-1.png |
| 2.14 | Ergonomie | Fenêtre « Enregistrer un besoin » : neuf champs (dictée, raccourcis, raison, précision, type, jours, rythme, partie de journée, dates, importance, case « Droit légal ») dans une fenêtre qui défile (987 px de contenu pour 636 px visibles à 1440, 1567 px pour 573 px au téléphone). Le bouton « Enregistrer » reste grisé sans dire quel champ manque. | O, T | Mineur | d-moi-absence-1.png, d-moi-absence-2.png |
| 2.15 | Ergonomie | Cibles sous 40 px dans la fenêtre « Enregistrer un besoin » : les puces de raccourcis (« Chabbat », « Mercredi »…) et de jours (« lundi »… « dimanche ») font 34 px de haut ; la case à cocher « Droit légal » fait 22×22 px. | O | Mineur | d-moi-absence-2.png |
| 2.16 | Adaptation | Aperçu avant impression (bouton « Imprimer ») : à 1440, la légende du bas de la feuille (« Matin, Journée, Journée longue… ») est coupée par le pied de la fenêtre ; au téléphone, la feuille n'est qu'une vignette illisible et le sélecteur de semaine passe sur trois lignes. | O, T | Mineur | d-moi-imprimer.png, t-moi-dialogues.png |
| 2.17 | Cohérence | Fenêtre « Prévenir d'un retard » ouverte par la titulaire : l'en-tête dit « Les titulaires sont prévenus aussitôt » alors qu'elle est l'une d'eux ; le bouton nomme correctement « Prévenir Pierre ». Fenêtre claire par ailleurs. | O, T | Cosmétique | d-moi-retard.png |

## 3. Équipe : liste et fiche d'une personne

Identité : menu « Équipe » (groupe Préparer). Liste des personnes à gauche, fiche de la personne choisie à droite (sur
téléphone : la fiche est sous la liste). Profil : titulaire. Captures avec accordéons fermés (`d-`, `t-`) et tout
déplié (`o-`).

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 3.1 | Ergonomie | Au téléphone, toucher une personne de la liste (ex. « Inès Da Silva ») ne montre pas sa fiche : seule une coche apparaît sur la carte, la fiche est six écrans plus bas, après les 13 cartes. Rien n'indique qu'il faut descendre. | T | Majeur | t-equipe-ines-clic.png, t-equipe-A1.png |
| 3.2 | Ergonomie | À l'ordinateur, la fiche de droite n'accompagne pas le défilement : choisir quelqu'un en bas de la liste (Inès, Yanis, les remplaçants) laisse l'écran sur le milieu de la fiche (compétences), le nom de la personne choisie est hors de vue en haut. | O, P | Mineur | d-equipe-ines-2.png |
| 3.3 | Répétition | Le déficit de pharmaciens est annoncé deux fois l'un sous l'autre : carte « PHARMACIENS 1,8 / 2 équivalent temps plein, Sous le seuil » à droite du titre, puis bandeau jaune « Pharmaciens, hors titulaires : 1,8 équivalent temps plein pour 2 attendus au vu du chiffre d'affaires déclaré ». | O, P, T | Mineur | d-equipe-1.png |
| 3.4 | Cohérence | Accords au masculin pour des femmes dans toute la liste et la fiche : Caroline « Titulaire principal », Léa « Pharmacien », Inès « Préparateur », Sarah « Animateur », Manon « Apprenti » ; en-têtes de groupe « ANIMATEURS · 1 », « APPRENTIS · 1 ». | O, P, T | Mineur | d-equipe-1.png, d-equipe-2.png |
| 3.5 | Cohérence | La fonction de Caroline s'écrit de trois façons sur la même fiche : pastille « Titulaire principal », sous-titre « Titulaire principal · hors décompte salarié », champ « Fonction : Pharmacien titulaire », et « Type de contrat : Titulaire (non salarié) ». | O, P, T | Mineur | d-equipe-1.png |
| 3.6 | Hiérarchie | La fiche empile huit rubriques (Poste et contrat, Compétences et diplômes, Droits d'accès, Suivi sur 12 mois, Compte de connexion, Volontariat, Besoins personnels, Absences à venir). « Volontariat » est un accordéon pour une seule case à cocher ; les deux premières sont ouvertes d'office et poussent les autres sous la ligne de flottaison. | O, P, T | Mineur | d-equipe-3.png, o-equipe-ines-4.png |
| 3.7 | Lisibilité | Les compétences verrouillées (« Tests angine et cystite », « Entretiens pharmaceutiques » pour une préparatrice) n'ont qu'un petit cadenas ; l'explication (« réservés aux pharmaciens ») est en petit gris sous les trois blocs de compétences, loin du cadenas. | O, P | Mineur | d-equipe-ines-2.png |
| 3.8 | Lisibilité | Phrases d'aide en 12 à 13 px gris, isolées, sans lien avec ce qui les entoure : « Touchez une compétence pour l'ajouter ou la retirer » (« touchez » à l'ordinateur), « Un rendez-vous n'est planifiable que si une personne formée est en poste et la salle libre », légende des niveaux de besoin (« Indisponibilité reconnue : contrainte impérative. Préférence prioritaire… »). | O, P | Cosmétique | d-equipe-2.png, o-equipe-ines-4.png |
| 3.9 | Adaptation | Au téléphone, l'en-tête de la fiche de Caroline met « Titulaire / principal · / hors / décompte / salarié » sur cinq lignes dans une colonne de 60 px, à côté du bouton « Besoin ou absence ». La confirmation « Retirer une personne supprime aussi ses postes, ses besoins et ses absences » passe aussi sur sept lignes à côté des deux boutons. | T | Majeur | t-equipe-A1.png, t-equipe-dialogues.png |
| 3.10 | Ergonomie | « Compte de connexion » affiche en clair l'identifiant et le mot de passe provisoire (« Mot de passe provisoire : demo ») à toute personne qui regarde l'écran de la titulaire. | O, P, T | Mineur | o-equipe-ines-3.png |
| 3.11 | Lisibilité des données | « Suivi sur 12 mois » : unités mêlées dans la même rangée de tuiles (« Retards 0 », « Congés 0 j », « Arrêts 0 j », « Remplacements assurés 0 »). Le sous-titre « Points forts : Toujours à l'heure » est affiché alors que tous les compteurs sont à zéro. | O | Cosmétique | o-equipe-ines-3.png |
| 3.12 | Cohérence | Le sous-titre de la page (« La raison d'une demande n'est visible que des titulaires ») s'adresse à un salarié ; la titulaire, qui lit la page, est justement celle qui voit tout. | O, P, T | Cosmétique | d-equipe-1.png |
| 3.13 | Lisibilité | Choisir une personne change la mise en page de sa carte : la coche fait passer « 24 h (temps partiel) » à la ligne (carte d'Inès plus haute que les autres). | O | Cosmétique | d-equipe-ines-2.png |
| 3.14 | Lisibilité | Chiffres à chasse fixe et espacés dans « 1 , 8 / 2 » (carte Pharmaciens). | O, P, T | Cosmétique | d-equipe-1.png |
| 3.15 | Ergonomie | Bouton « Retirer de l'équipe » : il est rose pâle sur la fiche de Caroline (désactivé, sans dire pourquoi) et presque identique, rose pâle aussi, quand il est actif sur une autre fiche. La confirmation « Oui, retirer Inès » est bien présente. | O | Mineur | d-equipe-3.png, o-equipe-ines-4.png, d-equipe-retirer.png |
| 3.16 | Ergonomie | Cibles sous 40 px : « Nouveau mot de passe provisoire » (34 px), « Retirer de l'équipe » (34 px), « Voir les statistiques de l'équipe » (34 px), case « Volontaire… » (22 px). | O | Mineur | o-equipe-ines-3.png |

### 3a. Fenêtre « Ajouter une personne »

Identité : bouton « Ajouter une personne » en tête de la liste Équipe, ou « Créer > Une personne ». Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 3a.1 | Ergonomie | Le bouton « Ajouter » reste bleu pâle (désactivé) tant que Prénom et Nom sont vides, sans astérisque ni message : un clic ne produit rien et n'explique rien. | O, T | Mineur | d-equipe-ajouter-1.png, d-equipe-ajouter-vide.png |
| 3a.2 | Cohérence | La fenêtre propose « Fonction » et « Heures / semaine » mais pas le « Type de contrat » ni la date d'entrée, que la fiche demande ensuite ; le libellé « Heures / semaine » devient « Heures par semaine » sur la fiche. | O, T | Cosmétique | d-equipe-ajouter-1.png, d-equipe-1.png |
| 3a.3 | Lisibilité | Fenêtre claire et courte ; seule la case « Remplaçant habituel » (22×22 px) est sous la taille conseillée au doigt. | T | Cosmétique | t-equipe-dialogues.png |

### 3b. Fenêtre « Besoin ou absence » (titre affiché : « Enregistrer un besoin »)

Identité : bouton « Besoin ou absence » de la fiche d'une personne (même fenêtre que « Poser une absence » de Mon
planning). Profil : titulaire, pour une salariée (Inès).

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 3b.1 | Cohérence | Bouton « Besoin ou absence », fenêtre « Enregistrer un besoin » : l'absence n'est qu'une option cachée dans la liste « Type de besoin » (« Une absence de plusieurs jours »), préréglée sur « Ne pas travailler certains jours ». | O, P, T | Majeur | d-equipe-besoin-1.png |
| 3b.2 | Hiérarchie | Ordre des champs à l'envers de la logique : on demande la dictée en langage courant, des raccourcis (« Chabbat », « Prière du vendredi »…), puis la raison et sa précision, et seulement ensuite le « Type de besoin » qui conditionne tout le reste. | O, P, T | Majeur | d-equipe-besoin-1.png |
| 3b.3 | Cohérence | En-tête « la raison est facultative quand vous l'enregistrez vous-même » contre encadré « Une raison est demandée pour chaque demande » ; tous les champs portent « (facultatif) » sauf ceux qui comptent. | O, P, T | Mineur | d-equipe-besoin-1.png |
| 3b.4 | Ergonomie | Formulaire long dans une fenêtre qui défile (987 px de contenu pour 636 visibles à 1440 ; 1567 pour 573 au téléphone, soit près de trois écrans) ; le bouton « Comprendre » (dictée) et « Enregistrer » sont grisés sans explication. | O, T | Mineur | d-equipe-besoin-1.png, t-equipe-dialogues.png |
| 3b.5 | Ergonomie | Puces de raccourcis et de jours à 34 px de haut ; la phrase « Un raccourci pour remplir le formulaire. Le raccourci choisi n'est pas enregistré… » mêle gras et gris sur deux lignes en 12 px. | O | Mineur | d-equipe-besoin-1.png |

## 4. Réglages (onglets Pharmacie, Horaires, Comptoir, Planning, Paramètres)

Identité : menu « Réglages » (groupe Préparer). Surtitre « OFFICINE », titre = nom de la pharmacie. Cinq onglets, chacun
fait d'accordéons. Profil : titulaire. Captures par onglet : `d-officine-o1` (Pharmacie) à `d-officine-o5`
(Paramètres), même chose en `p-` et `t-` ; tout déplié : `o-officine-*`.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 4.1 | Cohérence | Diagnostic contradictoire entre deux pages : Réglages > Comptoir > « L'équipe est-elle bien dimensionnée ? » affiche « Pharmaciens : Plus qu'il n'en faut, 3,7 temps plein au contrat, pour 2,1 qu'il faut » ; la page Équipe affiche au même moment « Pharmaciens 1,8 / 2 équivalent temps plein, Sous le seuil » et un bandeau d'alerte jaune. L'une compte les titulaires, l'autre non, sans que ni l'une ni l'autre le dise clairement. | O, P, T | Majeur | o-officine-4.png, d-equipe-1.png |
| 4.2 | Répétition | Le chiffre d'affaires est demandé deux fois, sous deux noms, dans deux onglets, avec deux valeurs : onglet Comptoir « Activité annuelle hors taxes : - € » (vide) et onglet Paramètres « Chiffre d'affaires annuel HT (€) : 2900000 ». | O, P, T | Majeur | o-officine-4.png, d-officine-o5-1.png |
| 4.3 | Ergonomie | Supprimer un poste type (corbeille en bout de ligne) le retire immédiatement : pas de confirmation, pas de message, pas de bouton Annuler (essai sur « Matin » : 8 lignes deviennent 7 sans rien d'autre à l'écran). | O, P | Majeur | d-officine-poste-retire.png |
| 4.4 | Adaptation | Le tableau des postes types est plus large que sa carte, même à 1440 : la colonne « Travail effectif » et les corbeilles sont hors cadre à droite ; pour les atteindre il faut faire défiler le tableau, ce qui fait disparaître la colonne « POSTE » (nom du poste) : on supprime une ligne sans voir son nom. Au téléphone, seules les colonnes Poste et Couleur sont visibles (défilement horizontal de 898 px). | O, P, T | Majeur | d-officine-postes-liste.png, d-officine-poste-retire.png, t-officine-divers.png |
| 4.5 | Adaptation | Au téléphone, la barre des cinq onglets ne montre que « Pharmacie, Horaires, Comptoi… » ; « Planning » et « Paramètres » sont cachés à droite sans flèche ni ombre, et quand l'un d'eux est l'onglet actif, il n'apparaît pas : on ne voit pas où l'on est. | T | Majeur | t-officine-divers.png, t-officine-o3-A1.png |
| 4.6 | Ergonomie | Onglet Horaires au téléphone : les boutons de chaque jour deviennent trois icônes sans texte (couverts, deux carrés, porte) : on ne peut pas deviner « Coupure le midi », « Recopier » et « Fermer ce jour ». | T | Majeur | t-officine-o2-A1.png |
| 4.7 | Ergonomie | Onglet Horaires à l'ordinateur : trois boutons répétés sur chaque jour (« Coupure le midi », « Recopier », « Fermer ce jour »), soit 20 boutons identiques. L'aide de « Recopier » annonce deux effets différents (« reprend les horaires de la veille, ou applique ceux du jour aux autres jours ouverts ») : on ne sait pas lequel se produira. | O, P | Mineur | d-officine-o2-1.png |
| 4.8 | Répétition | Le nom et la surface de la pharmacie sont répétés : titre de page « Grande Pharmacie de la Pinède » puis accordéon « Nom de la pharmacie » qui contient un champ « Nom de la pharmacie » ; la ligne « 180 m² au total · 110 m² de surface de vente · 45 m² de réserve et de préparatoire » est à la fois sous le titre et dans le résumé de l'accordéon « L'officine en chiffres » juste dessous. | O, P, T | Mineur | d-officine-o1-1.png |
| 4.9 | Cohérence | Le menu dit « Réglages », le surtitre dit « OFFICINE », le titre est le nom de la pharmacie. Un onglet s'appelle « Paramètres » et contient « Paramètres et coûts », tandis que « Paramètres » du menu du compte mène à « Mon compte » : deux « Paramètres » différents. | O, P, T | Mineur | d-officine-o5-1.png |
| 4.10 | Cohérence | Format des heures différent du reste de l'application : « 08:30 → 19:30 » (Comptoir, Postes types) contre « 8 h 30 – 19 h 30 » partout ailleurs, y compris dans le même accordéon (« Lundi à vendredi, 8 h 30 à 19 h 30 : vous demandez 2 personnes »). | O, P, T | Mineur | d-officine-o3-1.png, o-officine-5.png |
| 4.11 | Ergonomie | Onglet Comptoir : la colonne « HORAIRE » des minimums (« 08:30 → 19:30 », « 10:00 → 12:30 »…) est du texte, non modifiable, et il n'y a ni bouton pour ajouter une plage ni pour en retirer une ; seuls les nombres de personnes se changent. | O, P, T | Mineur | d-officine-o3-1.png |
| 4.12 | Lisibilité | « Chiffre d'affaires annuel HT (€) : 2900000 » sans séparateur de milliers. | O, P, T | Mineur | d-officine-o5-1.png |
| 4.13 | Lisibilité | Textes d'aide longs et gris en 12 px : encadré « Ce que ce choix change dans l'application » (dernière phrase en 12 px gris sur fond gris), « Afficher les coûts estimés » (quatre lignes), « Solvéa fonctionne sur cet appareil, sans serveur… ». | O, P | Mineur | d-officine-o4-1.png, o-officine-6.png |
| 4.14 | Cohérence | Les postes types existants se modifient directement dans le tableau, mais un nouveau poste se crée dans une fenêtre (« Nouveau poste type ») aux champs différents (« Partir de », « Pause déjeuner 1 h », « Pauses courtes », « Couleur » en liste et en pastilles) : deux interfaces pour le même objet. | O, P, T | Mineur | d-officine-postes-liste.png, d-officine-poste-nouveau.png |
| 4.15 | Lisibilité des données | Colonne « Couleur » des postes types : une pastille de couleur (orange, violet, jaune…) à côté d'une liste qui affiche « Automatique » : la couleur vue et la valeur lue ne disent pas la même chose. | O, P | Cosmétique | d-officine-postes-liste.png |
| 4.16 | Ergonomie | « Repartir de zéro » (effacer toute l'officine) est rangé dans l'onglet « Paramètres » à côté de la valeur du point ; il demande bien une confirmation (« Tout effacer et revenir à l'écran de création ? »). Le bouton rouge pâle « Réinitialiser » ressemble aux boutons secondaires. | O | Mineur | d-officine-zero.png |
| 4.17 | Lisibilité | Au téléphone, le résumé fermé de « L'équipe est-elle bien dimensionnée ? » est coupé juste avant l'information utile : « pharmaciens : plus qu'il n'en fa… ». | T | Mineur | t-officine-o3-A1.png |
| 4.18 | Hiérarchie | L'onglet Pharmacie ne contient qu'un champ (le nom) et un accordéon fermé ; l'écran est aux trois quarts vide alors que le reste des réglages est réparti sur quatre autres onglets. | O | Cosmétique | d-officine-o1-1.png |
| 4.19 | Ergonomie | Fenêtre « Nouveau poste type » : deux commandes pour la même couleur (liste « Couleur : Orange » et huit pastilles dessous) ; l'aperçu du poste est sous la ligne de flottaison. | O, T | Cosmétique | d-officine-poste-nouveau.png |

## 5. Règles

Identité : menu « Règles » (groupe Préparer). 24 règles rangées en six questions, deux colonnes, chaque règle en
accordéon. Filtres « Toutes / Obligatoires / Réglables / À faire valider ». Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 5.1 | Cohérence | Une règle marquée du cadenas « Obligatoire » (légende : « le planning ne peut pas l'enfreindre ») a un seuil modifiable : « Durée hebdomadaire maximale » ouverte montre « Seuil [46] h, Toujours active ». Le filtre « Réglables 20 » liste aussi ces règles à cadenas. Les catégories se recouvrent (12 obligatoires + 20 réglables pour 24 règles) sans que l'écran l'explique. | O, P, T | Majeur | d-regles-Durée-maximale.png, d-regles-filtre.png |
| 5.2 | Cohérence | La règle « Nombre de pharmaciens » affiche comme valeur « 1300000 € » : un montant en euros sous un titre qui annonce un nombre de personnes ; le sens (« un pharmacien en plus par tranche de 1,3 million ») n'apparaît qu'en ouvrant la règle. | O, P, T | Majeur | d-regles-1.png, d-regles-Nombre-pharmaciens.png |
| 5.3 | Lisibilité des données | Formats de nombres incohérents : « 1300000 € » sans séparateur de milliers, « 1.5 points/h » avec un point décimal (à l'anglaise), « 25 % », « 7 jours ouvrés ». | O, P, T | Mineur | d-regles-2.png |
| 5.4 | Répétition | Valeur répétée dans le titre et dans la pastille : « Programmation des gardes communiquée 15 jours avant » + pastille « 15 jours » ; « Plafond d'heures par semaine choisi par l'officine » + « 42 h ». | O, P, T | Cosmétique | d-regles-2.png |
| 5.5 | Répétition | « Effectif minimal au comptoir » est une règle ici (sans valeur affichée) et un tableau de minimums dans Réglages > Comptoir : deux endroits pour le même réglage, sans renvoi de l'un à l'autre sur la ligne fermée. | O, P | Mineur | d-regles-2.png, d-officine-o3-1.png |
| 5.6 | Lisibilité | La pastille « À faire valider » (orange pâle, 12 px) est répétée sur 11 des 24 lignes ; à côté de la valeur, elle forme une colonne de pastilles qui noie la valeur elle-même. Le sens n'est expliqué qu'en bas de page, dans l'encadré « Une aide, pas une garantie ». | O, P, T | Mineur | d-regles-1.png, d-regles-2.png |
| 5.7 | Hiérarchie | La légende des deux icônes (cadenas rouge « Obligatoire », curseurs bleus « Alerte ») est en haut ; le mot « Alerte » n'est repris nulle part ailleurs (le filtre dit « Réglables »). Le mot « Obligatoire » est suivi d'une espace avant les deux-points coupés en deux (« Obligatoire : le planning… »). | O, P, T | Cosmétique | d-regles-1.png |
| 5.8 | Adaptation | Au téléphone, le quatrième filtre « À faire valider » est hors de l'écran à droite (barre défilante sans indice) ; une fois choisi, aucun des trois filtres visibles n'est allumé : on ne sait pas quel filtre est actif. | T | Mineur | t-regles-filtre2.png |
| 5.9 | Adaptation | Au téléphone, la valeur et la pastille passent sous le titre de chaque règle : chaque ligne fait deux étages, la page fait sept écrans de haut. | T | Mineur | t-regles-divers.png |
| 5.10 | Lisibilité | La source de chaque règle (« Convention collective IDCC 1996 · depuis le jeu. 1er janvier · version 1.0 ») est en 12 px gris clair ; « depuis le jeu. 1er janvier » sans année. | O, T | Cosmétique | d-regles-Durée-maximale.png |
| 5.11 | Ergonomie | Le bouton « Enregistrer » n'apparaît à côté du seuil qu'après avoir changé la valeur (essai : 46 devient 44) ; la pastille de la ligne (« 46 h ») et la phrase (« ne dépasse pas 46 heures ») gardent l'ancienne valeur tant qu'on n'a pas cliqué, sans autre signe qu'une modification est en attente. | O | Cosmétique | d-regles-modif.png |

## 6. Construire

Identité : menu « Construire » (groupe Planifier) ; onglet « Planning » de la barre du bas sur téléphone ; « Créer > Un
planning ». Profil : titulaire. Ouvre sur la semaine prochaine (23 – 29 novembre, publiée).

### 6a. En-tête, barre de la semaine, grille, légende et contrôles

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 6.1 | Cohérence | Trois écritures des heures sur la même rubrique : tuiles de la grille « 08:30–19:30 », vue Mois « 8h30 / 16h30 » (sans espace), fenêtres et compteurs « 8 h 30 – 19 h 30 », « 40 h / 42 h · − 2 h ». La légende de la même grille dit « fin avant 14 h 30 ». | O, P, T | Mineur | d-construire-1.png, d-construire-mois-1.png, d-construire-modifier-1.png |
| 6.2 | Hiérarchie | Trois barres de bascules empilées et dispersées : « Toute l'équipe / Mes postes » et « Semaine / Mois » sous le titre, puis « Heures / Équité » dans la barre de la semaine, mêlé aux boutons d'action. On ne devine pas que « Heures / Équité » change seulement le compteur sous chaque nom. | O, P, T | Mineur | d-construire-1.png |
| 6.3 | Ergonomie | Le bouton principal « Publier les modifications », quand il est désactivé, est bleu pâle, de la même teinte que les boutons secondaires actifs (« Recopier », « Remettre à zéro ») : on ne distingue pas ce qui est inactif. Aucun texte ne dit pourquoi il est grisé (aucune modification). | O, P, T | Mineur | d-construire-1.png |
| 6.4 | Cohérence | Le libellé et la place des boutons changent d'une semaine à l'autre : « Publier les modifications » (semaine publiée), « Publier » (brouillon) ; « Remettre à zéro » disparaît sur une semaine vide et les autres boutons se décalent. | O, P | Cosmétique | d-construire-1.png, d-construire-vide.png, d-construire-brouillon.png |
| 6.5 | Adaptation | À 1280, « Publier les modifications » passe seul sur une seconde ligne sous les autres boutons ; au téléphone, il est tronqué (« Publier les modification ») dans une grille de 2 × 2 boutons. | P, T | Mineur | p-construire-1.png, t-construire-A1.png |
| 6.6 | Répétition | Deux commandes pour ouvrir la journée sur chaque colonne : le numéro du jour et l'icône œil sous le jour (sans libellé visible), plus une troisième sur Mon planning et au Tableau de bord. | O, P | Cosmétique | d-construire-1.png |
| 6.7 | Répétition | Ligne « Équipe au complet ? » : le mot « Complet » est répété six fois sous six coches vertes. | O, P | Cosmétique | d-construire-1.png |
| 6.8 | Lisibilité des données | Petites étiquettes sous certaines tuiles (« 16 h » sous le jeudi d'Igor, « 10 h » sous le mardi de Léa, « 14 h 30 » sous le mardi de Thomas) avec une icône de stéthoscope : ce sont des missions (entretien, vaccination…), mais seule une infobulle le dit ; la légende ne mentionne pas cette icône. | O, P, T | Mineur | d-construire-1.png, d-construire-2.png |
| 6.9 | Lisibilité des données | Indisponibilité reconnue : un cadenas gris de 11 px dans le coin haut droit d'une case vide (Inès mercredi, Manon jeudi et vendredi, Yanis), quasi invisible ; la case garde un « + » actif comme les autres. | O, P, T | Mineur | d-construire-2.png |
| 6.10 | Adaptation | La garde du dimanche de Léa (tuile bleu nuit « 09:00→19:00 ») est plus large que la colonne « dim. » et déborde du cadre de la grille à droite ; au téléphone, elle est coupée (« 09:00 »). | O, T | Mineur | d-construire-2.png, t-construire-A1.png |
| 6.11 | Lisibilité | Compteur sous les noms : « 14 h 30 / 16 h · − 1 h / 30 » (Yanis) passe sur deux lignes à 1440 et est coupé par des points de suspension à 1280. Les mots « atteint » (bleu) et « − 2 h » (rouge) sont en 11 px. | O, P | Mineur | d-construire-3.png |
| 6.12 | Lisibilité des données | Légende placée sous la grille, à deux écrans du haut ; elle mêle les icônes de tâches (Comptoir, Réception, Administratif, Formation, Inventaire) qu'on ne voit jamais dans la grille (la tâche y est écrite « comptoir ») et les couleurs de postes ; « Formation » y figure deux fois (icône et couleur). | O, P, T | Mineur | d-construire-3.png |
| 6.13 | Répétition | Contrôles : quatre cartes identiques « X travaille tous les samedis du mois : l'officine en garde 1 libre. » ; la formule « l'officine en garde 1 libre » est obscure (« garde » se confond avec les gardes de nuit). Le même nombre est donné trois fois : pastille « 4 alertes », « À surveiller 4 », et quatre cartes. | O, P, T | Mineur | d-construire-3.png |
| 6.14 | Cohérence | « 4 alertes » (pastille) et « À surveiller » (titre et surtitre de chaque carte) désignent la même chose avec deux mots ; la page Règles parle d'« Alerte ». | O, P, T | Cosmétique | d-construire-3.png |
| 6.15 | Adaptation | Au téléphone, la grille garde 7 colonnes de 40 px : heures en 10 px empilées (« 08:30 / 19:30 »), sans durée ni tâche ; les en-têtes de jours sont en 10,5 px, le libellé « ÉQUIPE » en 9,5 px. Les cases de jour (« voir la journée ») font 30 × 55 px. | T | Majeur | t-construire-A1.png |
| 6.16 | Adaptation | Au téléphone, l'en-tête de la carte « Contrôles » met sa phrase « Aide à la conformité : ces contrôles signalent des écarts, ils ne valent pas certification » dans une colonne d'un mot par ligne (14 lignes) à côté des pastilles. | T | Majeur | t-construire-A1.png |
| 6.17 | Adaptation | L'assistant Solvi recouvre la dernière colonne de la grille (samedi, dimanche) à 1440 et 1280 : la tuile du samedi d'Igor « 09:00–14:00 » est à moitié cachée. | O, P, T | Mineur | d-construire-1.png, p-construire-1.png |
| 6.18 | Ergonomie | Le message « Proposition « Équité d'abord » placée dans le brouillon. Annuler » s'affiche en bas au centre, par-dessus la grille ; au téléphone il recouvre la barre du bas et la grille sur cinq lignes. | O, T | Cosmétique | d-construire-brouillon.png, t-construire-fen2.png |
| 6.19 | Lisibilité | Les champs d'heure de la fenêtre de poste s'affichent « 09:00 AM », « 02:00 PM » dans le navigateur de test (champ natif, format du navigateur) au lieu de « 9 h ». Réserve : à revérifier dans un navigateur réglé en français. | O, T | Cosmétique | d-construire-nouveau-1.png |

### 6b. Fenêtres « Nouveau poste » et « Modifier le poste »

Identité : clic sur un « + » ou sur une tuile de la grille. Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 6b.1 | Répétition | Deux façons de supprimer un poste dans la même fenêtre : bouton rouge « Supprimer » en bas à gauche et puce « Repos, retire ce poste » parmi les postes types. | O, T | Mineur | d-construire-modifier-1.png |
| 6b.2 | Lisibilité des données | La frise colorée en bas (barre bleue, zone hachurée, petits traits) n'a ni heures ni légende ; « Pauses courtes 2 : 10 h 30, 16 h 45 » se lit mal (« 2 : » ressemble à une heure). | O, T | Mineur | d-construire-modifier-1.png |
| 6b.3 | Ergonomie | Formation et Inventaire sont présentés comme des tâches parmi d'autres, mais leur flèche ouvre une autre fenêtre (« Planifier une formation ») ; rien ne le dit hors infobulle. | O, T | Mineur | d-construire-nouveau-1.png |
| 6b.4 | Adaptation | Au téléphone, la fenêtre fait près de deux écrans (1042 px de contenu pour 564 visibles pour Nouveau poste, 1255 pour Modifier) ; les puces de tâches sont chacune sur une ligne. | T | Mineur | t-construire-fen.png |
| 6b.5 | Lisibilité | Puce « POSTE TYPE » en 11,5 px majuscules suivie d'une phrase d'aide : « Un clic remplit les horaires et les pauses. « Repos » laisse la journée libre. » ; au téléphone le guillemet ouvrant « « » reste seul en fin de ligne. | O, T | Cosmétique | d-construire-nouveau-1.png, t-construire-fen.png |

### 6c. Fenêtre « Proposer un planning » (« Trois propositions pour la semaine »)

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 6c.1 | Lisibilité des données | « Écart d'équité (samedis) 1,88 / 1,87 / 1,92 » : un indicateur sans unité ni sens (on ne sait pas si plus haut est mieux) ; l'explication n'est qu'en infobulle. Les vignettes de grille sont trop petites pour être lues. | O, T | Mineur | d-construire-proposer-1.png |
| 6c.2 | Cohérence | Certaines valeurs sont soulignées en bleu (« 96 % », « 1,87 », « 0 h ») comme des liens ; ce sont les meilleures valeurs, rien ne le dit. | O | Cosmétique | d-construire-proposer-1.png |
| 6c.3 | Ergonomie | La sélection d'une proposition n'est marquée que par un petit « ✓ Sélectionnée » et un fond bleu pâle ; au téléphone, les trois cartes empilées demandent quatre écrans et le bouton « Placer dans le brouillon » ne dit pas laquelle sera placée. | O, T | Mineur | d-construire-proposer-1.png, t-construire-fen.png |

### 6d. Fenêtre de publication

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 6d.1 | Cohérence | Avant d'avoir cliqué sur « Publier », la fenêtre affiche « 46 postes envoyés à l'équipe. » au passé : on croit la publication déjà faite. | O, T | Mineur | d-construire-publier-1.png |
| 6d.2 | Ergonomie | Fenêtre courte et claire (« Aucun point bloquant », « Revenir au brouillon », « Publier ») ; après publication, le message de confirmation s'affiche en bas et la pastille devient « Publié le 20 novembre 2026 à 23 h 44 ». Rien à signaler d'autre. | O, T | Cosmétique | d-construire-publie.png |

### 6e. Vue Mois

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 6e.1 | Cohérence | Vocabulaire différent de la vue Semaine pour les mêmes actions : « Corriger automatiquement » contre « Proposer un planning », « Remettre le mois à zéro » contre « Remettre à zéro », « Publier le mois » contre « Publier les modifications » ; compteurs « 31 h sur 34 h » contre « 40 h / 42 h » ; « ÉQUIPE AU COMPLET ? » en capitales contre « Équipe au complet ? ». | O, P, T | Mineur | d-construire-mois-1.png, d-construire-1.png |
| 6e.2 | Adaptation | La grille du mois est plus large que l'écran même à 1440 : la semaine 53 (« lun 28 ») est coupée au bord droit, sans barre de défilement visible ni flèche. | O, P | Majeur | d-construire-mois-1.png |
| 6e.3 | Lisibilité des données | Cases de 34 px : heures en 11 px sur deux lignes (« 8h30 / 16h30 »), préférences abrégées en 10 px (« Ap.-m. », « Jour ») ; points rouges « Poste différent de la préférence » de 8 px au coin des cases. | O, P, T | Mineur | d-construire-mois-2.png |
| 6e.4 | Lisibilité des données | La barre colorée sous chaque nom (verte ou marron, longueur variable) n'est pas expliquée par la légende. | O, P | Mineur | d-construire-mois-1.png |
| 6e.5 | Adaptation | Au téléphone, « Corriger automatiquement » est tronqué (« Corriger automatiquemen ») et la grille ne montre que six jours. | T | Mineur | t-construire-fen2.png |

### 6f. Fenêtre « Voir la journée »

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 6f.1 | Ergonomie | Le bouton « Retirer », placé entre les heures de pause et « Noter un retard », retire la pause et non le poste ; son libellé ne le dit pas. | O, T | Mineur | d-journee-1.png |
| 6f.2 | Répétition | Chaque personne a la même information deux fois : la ligne de texte (« 7 h de travail · pause déjeuner 12 h 30 – 13 h 30 · pauses courtes à 10 h 30, 15 h ») et la frise colorée juste dessous, puis une troisième fois dans les champs d'heures de pause. | O, T | Mineur | d-journee-1.png |
| 6f.3 | Adaptation | Au téléphone, la fenêtre fait 3019 px de contenu pour 529 visibles (près de six écrans pour 8 personnes) ; sur les frises, les petits traits coupent les heures (« 8 h 3\|0 », « 16 h\|30 », « 1\|9 h 30 »). | T | Mineur | t-journee-A.png |
| 6f.4 | Lisibilité | Note de bas de fenêtre en 12 px gris (« Une pause d'au moins 20 minutes est due dès 6 heures… Un retard noté ici alimente le suivi de la personne ; aucune raison n'est demandée. »). | O | Cosmétique | d-construire-journee-1.png |

### 6g. Aperçu d'impression

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 6g.1 | Cohérence | Sur une semaine vide, l'aperçu prévient « Aucun poste n'est posé sur cette période : la feuille sortirait vide », mais la feuille montrée est remplie de « Repos » pour tout le monde (ce qui n'est pas vide, et qui est faux : rien n'a été posé). | O, T | Mineur | d-construire-impression.png |
| 6g.2 | Lisibilité | La feuille est réduite à une vignette (texte de 5 à 6 px) ; la légende du bas est coupée par le pied de la fenêtre. Au téléphone, la vignette est illisible et la période passe sur trois lignes. | O, T | Mineur | d-construire-impression.png, t-construire-fen2.png |

## 7. Gardes

Identité : menu « Gardes » (groupe Planifier) ; « Créer > Une garde ». Titre « De la garde à la paie ». Bandeau de
répartition, calendrier sur douze mois, liste des gardes à gauche et détail de la garde choisie à droite (sur
téléphone, l'un sous l'autre). Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 7.1 | Adaptation | Au téléphone, le panneau de détail de la garde déborde à droite et est coupé : pastille « Recommandé » réduite à « Reco », « Hors p », étapes « Repos réglé » et « Validée pour la paie » hors écran, avertissement « délai de prévenance non tenu : accor… », bouton « Valider pour le c… ». | T | Majeur | t-gardes-A1.png, t-gardes-A2.png |
| 7.2 | Ergonomie | Toucher une pastille du calendrier (ex. « 12 » décembre) change le détail, mais la page ne bouge pas : à l'ordinateur le détail commence sous la ligne de flottaison (on ne voit que son titre), au téléphone il est cinq écrans plus bas ; rien ne montre que quelque chose a changé. | O, T | Majeur | d-gardes-pastille12.png, t-gardes-fen.png |
| 7.3 | Cohérence | Nombre de gardes de Léa contradictoire sur le même écran : bandeau « Répartition 2026 : Léa F. 1 garde », carte de Léa dans « Qui assure la garde ? » du 29 novembre : « 0 garde en 2026 » (la garde affichée n'est pas comptée), puis « 1 garde en 2026 » sur le détail du 12 décembre. | O, P, T | Mineur | d-gardes-1.png, d-gardes-2.png, d-gardes-12-2.png |
| 7.4 | Répétition | Deux statuts côte à côte pour la même garde : « Prévue » (pastille jaune) et « À affecter » (pastille orange) sur les cartes du 12 et du 25 décembre ; le statut est aussi redit par l'étape du parcours (« Prévue, Affectée, Réalisée… ») et par la pastille cerclée ou pleine du calendrier. | O, P, T | Mineur | d-gardes-2.png |
| 7.5 | Hiérarchie | Le calendrier sur douze mois occupe 250 px pour 9 mois vides sur 12 (« Aucune garde » répété neuf fois) ; il repousse sous la ligne de flottaison la liste et le détail, qui sont le cœur de la page. | O, P | Mineur | d-gardes-1.png |
| 7.6 | Cohérence | Casse incohérente : « Volets Fermés », « Volets Ouverts », « À Domicile » (majuscules à chaque mot) sur les cartes, contre « Garde de jour · volets ouverts » et « Astreinte de nuit · à domicile » dans les titres. | O, P, T | Cosmétique | d-gardes-2.png |
| 7.7 | Lisibilité des données | Tableau « Variables pour le comptable » : la colonne « MONTANT ESTIMÉ » ne contient que « à valoriser en paie » sur chaque ligne ; les sources juridiques (« Accord du 23 mars 2000, article 4 (Légifrance) ; montants : circulaire FSPF 2026-16, non lue ») en 12 px gris alourdissent chaque ligne. Les notes de bas commencent par un point médian isolé (« · Volets ouverts : … »). | O, P | Mineur | d-gardes-3.png |
| 7.8 | Ergonomie | « Valider pour le comptable » est grisé (bleu pâle) sans explication visible (la raison, « La validation se fait après la garde », n'est qu'en infobulle). | O, P, T | Mineur | d-gardes-4.png |
| 7.9 | Ergonomie | La corbeille en haut du détail supprime la garde sans confirmation ; un message « Garde supprimée. Annuler » permet de revenir en arrière. La corbeille, isolée à droite du titre, n'a pas de libellé. | O, T | Mineur | t-gardes-fen.png |
| 7.10 | Répétition | Avertissement identique répété sur chaque carte de pharmacien (« délai de prévenance non tenu : accord à recueillir » pour Léa et pour Igor), puis une troisième fois en encadré vert ou orange en bas (« Programmation communiquée 27 jours avant la garde », « Pour respecter les 15 jours de prévenance… »). | O, P, T | Mineur | d-gardes-2.png |
| 7.11 | Lisibilité | Sous-titre de page de trois lignes, qui coince les trois boutons d'action ; « Répartir 2 gardes » est un bouton secondaire bleu pâle alors que c'est l'action qui débloque deux gardes « À affecter ». | O, P | Cosmétique | d-gardes-1.png |
| 7.12 | Lisibilité | Sélectionner une carte de la liste ajoute une coche qui fait passer le statut à la ligne (« Astreinte de nuit / Prévue ») : la carte change de hauteur. | O | Cosmétique | d-gardes-12-2.png |
| 7.13 | Hiérarchie | Au téléphone, la page empile titre, trois boutons pleine largeur, répartition, douze mois en deux colonnes, puis toute la liste : le détail de la garde choisie commence au cinquième écran. | T | Mineur | t-gardes-A1.png |

### 7a. Fenêtres « Importer le calendrier de garde », « Répartir les gardes à affecter », « Ajouter une garde »

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 7a.1 | Ergonomie | Importer : le champ montre deux lignes d'exemple (« 14/02/2027;19:30;08:30;volets fermés ») en police à chasse fixe gris foncé, qu'on prend pour un contenu déjà saisi ; le bouton « Ajouter garde » (sans article, au singulier) est grisé sans explication. | O, T | Mineur | d-gardes-importer-1.png |
| 7a.2 | Adaptation | Répartir, au téléphone : tableau à trois colonnes écrasé ; la colonne « POURQUOI » est coupée à droite (défilement horizontal de 54 px), « charge de gardes la plus faible parmi 4 pharmaciens disponibles (0 contre 1 en moyenne) » s'étale sur neuf lignes ; « Caroline / T. » sur deux lignes. | T | Mineur | t-gardes-fen.png |
| 7a.3 | Lisibilité | Répartir : la phrase de bas de fenêtre « Charge ajoutée par cette répartition : Caroline T. + 0,8 · Pierre F. + 1,3. Une nuit de 12 h compte pour 1… » est un calcul sans unité, en 13 px gris. | O | Cosmétique | d-gardes-repartir-1.png |
| 7a.4 | Lisibilité | Ajouter une garde : « Quand ? » propose « Nuit / Jour / 24 heures », puis « Forme », puis date et heures ; l'aide « Titulaires et pharmaciens. « Conseillé » : disponible et le moins chargé… » parle d'une mention « Conseillé » alors que la page dit « Recommandé ». | O, T | Cosmétique | d-gardes-ajouter-1.png, d-gardes-2.png |
| 7a.5 | Adaptation | Ajouter une garde au téléphone : les trois choix « Quand ? » occupent chacun une ligne pleine largeur ; la fenêtre défile (803 px pour 551). | T | Cosmétique | t-gardes-fen.png |

## 8. Résoudre

Identité : menu « Résoudre » (groupe Suivre, pastille 7) ; onglet « À décider » de la barre du bas sur téléphone.
Surtitre « RÉSOUDRE · VENDREDI 20 NOVEMBRE 2026 », titre « Que décider aujourd'hui ? ». Cinq onglets : Absences,
Remplacements, Demandes, Gardes, À publier. Profil : titulaire.

### 8a. Onglets

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 8.1 | Cohérence | Le menu dit « Résoudre », la barre du bas du téléphone dit « À décider », le titre dit « Que décider aujourd'hui ? », le Tableau de bord dit « À DÉCIDER » : quatre noms pour la même rubrique. | O, P, T | Mineur | d-resoudre-1.png, t-resoudre-o1-A1.png |
| 8.2 | Répétition | Onglet Absences : les trois options (« Réaffecter Pierre F. », « Proposer des heures complémentaires à Léa F. », « Faire appel à Paul L. ») sont affichées en cartes sur la page avec leur bouton « Choisir », et de nouveau dans la fenêtre « Comment régler cette absence ? » ouverte par « Voir et choisir la solution ». Le bloc rouge « À couvrir » est aussi répété mot pour mot dans la fenêtre. Deux chemins pour la même décision. | O, P, T | Majeur | d-resoudre-1.png, d-resoudre-2.png, d-res-reglage-3.png |
| 8.3 | Ergonomie | Le bouton « Choisir » d'une option non conseillée l'applique immédiatement, sans confirmation ni récapitulatif ; seul un message « Option retenue. Pensez à publier la modification pour prévenir l'équipe. Voir dans le planning / Annuler » apparaît, et la carte disparaît. La fenêtre « Comment régler… », elle, demande « Appliquer mes choix ». Deux niveaux de prudence pour la même action. | O, T | Majeur | d-res-choisir-sans-dialogue.png |
| 8.4 | Ergonomie | Le message d'action reste 9 secondes en bas au centre ; ouvert entre-temps, une fenêtre de décision a ses boutons de pied (« En parler d'abord à Nicolas », « Plus tard », « Choisissez une décision ») masqués par ce message. Au téléphone, il occupe 200 px de haut sur huit lignes. | O, T | Majeur | d-res-decider1-1.png, t-res-fen.png |
| 8.5 | Cohérence | La pastille « Conseillé » et le bouton « Choisir » plein ne sont que sur la première option ; les deux autres ont un « Choisir » bleu pâle, qui ressemble à un bouton désactivé. | O, P, T | Mineur | d-resoudre-2.png |
| 8.6 | Cohérence | « Pourquoi 9 personnes ne sont pas sollicitées » donne pour Pierre F. « Déjà en poste sur cet horaire », alors que l'option conseillée juste dessous est « Réaffecter Pierre F. » sur cet horaire. | O, P, T | Mineur | d-res-pourquoi.png, d-resoudre-2.png |
| 8.7 | Lisibilité | Note grise sous l'appel : « À moins de sept jours, un changement d'horaire demande l'accord de la personne : seul un volontaire peut être désigné. Dire non ne change le rang de personne. » : phrase juridique peu claire (« le rang de personne »). | O, P, T | Mineur | d-resoudre-1.png |
| 8.8 | Lisibilité des données | Les cartes d'options mêlent texte barré et flèche : « 8 h 30 – 16 h 30 (pause 12 h 30 – 13 h 30) → 11 h 30 – 19 h 30 (pause 14 h – 15 h) » ; « Repos → 11 h 30 – 19 h 30 », « Repos » barré. « 1 point à valider · règles respectées » est un accordéon fermé qui cache le point à valider. | O, P, T | Mineur | d-resoudre-2.png |
| 8.9 | Adaptation | Au téléphone, les onglets « Demandes », « Gardes », « À publier » sont hors écran (seuls « Absences 1 » et « Remplacements 1 » se voient, puis une coche coupée) ; une fois « Demandes » choisi, seule sa coche bleue dépasse. | T | Majeur | t-resoudre-o1-A1.png, t-resoudre-o3-A1.png |
| 8.10 | Adaptation | Onglet Demandes au téléphone : l'en-tête de la frise « Absences de l'équipe » met son texte dans une colonne de 70 px (25 lignes d'un mot) et la légende (« Congé, Arrêt, Formation, En attente ») se superpose au texte. La frise est coupée à droite et l'étiquette « Demandé » est tronquée (« Dem… »). | T | Majeur | t-resoudre-o3-A1.png |
| 8.11 | Adaptation | Onglet Absences au téléphone : la ligne de Léa F. dans l'appel coince « Aucun dépannage sur 3 mois » dans une colonne de 50 px (cinq lignes), et la pastille « À son tour » recouvre « dépannag[e] ». | T | Mineur | t-resoudre-o1-A1.png |
| 8.12 | Cohérence | Onglet Remplacements : la carte dit à la fois « Prévu » et « Demain » (deux pastilles), « Demande acceptée. Sans remplaçant confirmé, le poste reste le sien. » (acceptée par qui ?) et propose un seul bouton « Refuser » : on ne sait pas ce qui reste à décider. | O, P, T | Majeur | d-resoudre-o2-1.png |
| 8.13 | Cohérence | Onglet Demandes : les deux cartes n'ont pas le même modèle (la première a des pastilles « Congé » et « Dans 10 jours » et le nom seul en titre ; la seconde a un titre « Demande de Jules P. à arbitrer » sans pastille). Le titre de l'onglet parle de demandes, le premier bloc s'appelle « Absences de l'équipe ». | O, P | Mineur | d-resoudre-o3-1.png, d-resoudre-o3-2.png |
| 8.14 | Lisibilité | « Finir avant 18 h - vendredi » (trait d'union employé comme tiret), « J - 7 avant la limite », « J - 20 avant la limite ». | O, P, T | Cosmétique | d-resoudre-o3-2.png, d-resoudre-o4-1.png |
| 8.15 | Ergonomie | Onglet Gardes : « Affecter → » quitte Résoudre pour la page Gardes, où la garde concernée est bien choisie mais son détail est sous la ligne de flottaison ; aucun retour vers Résoudre n'est proposé. | O, T | Mineur | d-res-affecter.png |
| 8.16 | Cohérence | L'onglet « À publier » à 0 affiche « Rien à traiter ici. Aucune décision en attente dans « À publier » » : la phrase répète le nom de l'onglet ; l'onglet reste affiché à 0 alors qu'il n'a jamais de contenu dans l'exemple. | O | Cosmétique | d-resoudre-o5-1.png |

### 8b. Fenêtres de décision

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 8b.1 | Ergonomie | « Comment régler cette absence ? » : fenêtre de 1901 px de contenu pour 606 px visibles à 1440 (trois écrans), 3992 px pour 410 au téléphone (près de dix écrans). On y règle aussi le mercredi 18 et le jeudi 19 (jours passés, « Rien n'est découvert ce jour-là ») avant d'arriver au vendredi, seul jour à régler. | O, T | Majeur | d-res-reglage-1.png, d-res-reglage-3.png, t-res-fen.png |
| 8b.2 | Lisibilité | Dans cette fenêtre, le bloc rouge du vendredi réunit trois alertes en un seul paragraphe sans séparation (« …sur cette plage. Vendredi, de 13 h à 13 h 30 : 1 personne… Vendredi, de 16 h 30 à 19 h : 2 personnes… »), alors que la page les présentait en liste à puces. | O | Mineur | d-res-reglage-3.png |
| 8b.3 | Adaptation | Au téléphone, le pied de la fenêtre « 3 jours réglés par vos choix. Rien n'est appliqué avant votre accord. » tient dans une colonne de 100 px sur six lignes à côté du bouton « Annuler ». | T | Mineur | t-res-fen.png |
| 8b.4 | Cohérence | « Refuser la demande » (remplacement d'Igor) : bouton « Refuser et prévenir Igor » rose pâle avec texte rouge, d'un dessin différent du bouton rouge « Supprimer » de la fenêtre de poste ; la case « Envoyer un message à Igor » est cochée et l'aperçu « Ce que Igor recevra » (élision manquante : « Ce qu'Igor ») est clair. | O, T | Cosmétique | d-res-refus-1.png |
| 8b.5 | Ergonomie | « Décider : congé de Nicolas L. » et « Décider : demande d'horaires de Jules P. » : les choix (« Accepter la demande », « Refuser », « Accepter comme simple préférence »…) sont des cartes grises sans bouton radio visible ; le bouton du bas « Choisissez une décision » est grisé tant qu'on n'a pas cliqué une carte. | O, T | Mineur | d-res-decider1-1.png, d-res-decider2-1.png |
| 8b.6 | Répétition | Dans « Décider : congé de Nicolas L. », les deux alertes « Lundi, de 13 h à 13 h 30… » et « Lundi, de 16 h 30 à 19 h… » sont aussi sur la carte de l'onglet (« Si vous approuvez »), et le délai « Dans 10 jours » aussi. | O, T | Cosmétique | d-res-decider1-1.png, d-resoudre-o3-1.png |
| 8b.7 | Adaptation | « Décider : demande d'horaires de Jules P. » au téléphone : quatre cartes de choix empilées, 1068 px de contenu pour 488 visibles. | T | Mineur | t-res-fen.png |

## 9. Messages

Identité : menu « Messages » (groupe Suivre, pastille 1), icône bulle de la barre du haut, onglet « Messages » de la
barre du bas sur téléphone, « Créer > Un message ». Titre « Échanger avec l'équipe ». Liste des conversations à
gauche, conversation ouverte à droite. Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 9.1 | Adaptation | Au téléphone, la zone de contenu fait 853 px de large pour un écran de 390 px : chaque carte de la liste, l'aperçu des messages, le titre « NOUVEAU MESSAGE » et le bouton « Envoyer » (placé à 682 px du bord gauche) sont hors écran à droite. Il faut faire défiler la page horizontalement pour envoyer un message ; après avoir touché une conversation, la page se décale de travers (bords gauches coupés : « tres postes », « ierre Fiandino », « otre message »). | T | Bloquant | t-messages-A1.png, t-messages-fen.png |
| 9.2 | Hiérarchie | La conversation non lue (Nicolas, pastille 1) est la dernière de la liste, rangée par fonction (Titulaires, Pharmaciens, Préparateurs…) et non par date : à 1440 elle est à moitié sous la ligne de flottaison ; au téléphone elle est au deuxième écran. Elle est pourtant ouverte d'office à droite, sans qu'on voie d'où elle vient. | O, P, T | Mineur | d-messages-1.png |
| 9.3 | Ergonomie | Au téléphone, toucher une conversation ne l'ouvre pas à l'écran : la conversation est sous les 13 cartes de la liste (la page saute de 686 px sans montrer de transition). | T | Majeur | t-messages-fen.png |
| 9.4 | Répétition | « Aucun message » est répété sous dix noms sur onze. | O, P, T | Cosmétique | d-messages-1.png |
| 9.5 | Lisibilité | Le nom long est coupé dans la liste (« Nicolas Le Syn… », « Nicolas Le Syndicali… ») alors que l'en-tête de la conversation l'écrit en entier ; la ligne d'aperçu est coupée (« Vous : Bonjour à tous, le planning de la … »). | O, P | Cosmétique | d-messages-1.png, d-messages-envoye.png |
| 9.6 | Cohérence | Les personnes sont nommées en entier (« Pierre Fiandino ») dans Messages, et en abrégé (« Pierre F. ») dans tout le reste de l'application, y compris dans la bulle du message reçu (« Nicolas L. »). | O, P, T | Cosmétique | d-messages-1.png |
| 9.7 | Ergonomie | Le bouton « Envoyer » est bleu pâle (désactivé) tant que le champ est vide, et le reste dans le même ton une fois le message envoyé ; il est aligné en bas d'un champ de 70 px de haut, loin du texte. Pas de raccourci Entrée visible. | O | Cosmétique | d-messages-envoye.png |
| 9.8 | Lisibilité | Sous-titre « Pour une absence ou un horaire, préférez une demande : elle est suivie. Les messages restent sur cet appareil. » : la titulaire n'a pas de bouton « Faire une demande » (elle a « Poser une absence ») ; la phrase est écrite pour un salarié. | O, P, T | Mineur | d-messages-1.png |
| 9.9 | Adaptation | Fenêtre « Demander un rendez-vous » au téléphone : les champs « Jour » (« 11/23/ ») et « À » (« 03:0 ») sont coupés, « 30 mi[nutes] » aussi. | T | Mineur | t-messages-fen.png |
| 9.10 | Lisibilité | Fenêtre « Demander un rendez-vous » : date « 11/23/2026 » et heure « 03:00 PM » (champs natifs du navigateur de test) alors que la ligne de résumé dit « Lundi 23 novembre, 15 h – 15 h 30 ». Réserve : à revérifier dans un navigateur réglé en français. | O, T | Cosmétique | d-messages-rdv-1.png |

## 10. Heures (et fenêtre « Faire rattraper », action « Régulariser »)

Identité : menu « Heures » (groupe Suivre) ; tuile « Compteurs d'heures » du Tableau de bord. Surtitre « COMPTEUR
D'HEURES », titre « Le moins d'heures en plus possible ». Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 10.1 | Cohérence | Le titre « Le moins d'heures en plus possible » et le sous-titre (« Solvéa signale tout dépassement ») parlent d'heures en trop, alors que les huit compteurs affichés sont en moins (« 0 h en plus des contrats », « 45 h 30 en moins des contrats · 8 personnes ») et que l'action proposée est de faire travailler davantage (« Faire rattraper », « Rattrapage +8 h »). | O, P, T | Majeur | d-heures-1.png, d-heures-apres-3.png |
| 10.2 | Lisibilité des données | La période des compteurs n'est dite nulle part : « 286 h planifiées, contrat 294 h » (sur combien de semaines ? depuis quand ?). La barre sous chaque ligne (bleue ou verte, presque pleine partout) n'a pas de légende. | O, P, T | Majeur | d-heures-1.png |
| 10.3 | Cohérence | Après « Solder » ou « Régulariser automatiquement », chaque ligne passe à « À jour » alors que les chiffres affichés restent « 286 h planifiées, contrat 294 h » (8 h d'écart) ; pour Nicolas, une pastille « +8 h prévu semaine du 7 – 13 décembre 2026 » s'ajoute, pas pour Igor (soldé). | O, T | Mineur | d-heures-auto.png |
| 10.4 | Ergonomie | « Solder » s'applique au premier clic, sans fenêtre ni explication de ce que « solder » veut dire (perdre les heures dues ? les payer ?) ; seul un message « Igor L. : compteur soldé. Annuler » apparaît. « Régulariser automatiquement » modifie aussi sept compteurs d'un coup sans confirmation (message « 7 compteurs régularisés… Brouillon recalculé, rien n'est publié. Annuler »). | O, T | Majeur | d-heures-auto.png |
| 10.5 | Répétition | Les boutons « Faire rattraper » et « Solder » sont répétés sur huit lignes (16 boutons identiques) ; le nombre de compteurs est donné trois fois (« 45 h 30 … 8 personnes », « 8 compteurs à régulariser », et huit lignes orange). | O, P, T | Mineur | d-heures-1.png |
| 10.6 | Cohérence | « À jour » (Léa) est dessiné comme un bouton vert de même taille que les boutons d'action, mais n'est pas cliquable. | O, P, T | Cosmétique | d-heures-1.png |
| 10.7 | Cohérence | Le libellé du menu (« Heures »), le surtitre (« Compteur d'heures »), la tuile du Tableau de bord (« Compteurs d'heures, 8 à régulariser en plus ou en moins ») et l'aide (« Ouvrir les heures ») nomment la même page différemment. | O, P, T | Cosmétique | d-heures-1.png |
| 10.8 | Lisibilité | Signe moins typographique et heures en chasse fixe espacée : « -8 h » dans le sous-titre de la fenêtre et « −8 h » sur la page ; « 2 8 h », « 2 1 1 h » très espacés. | O, P | Cosmétique | d-heures-1.png |
| 10.9 | Adaptation | Au téléphone, chaque personne occupe 270 px (nom, deux pastilles, barre, pastille du compteur, deux boutons sur des lignes séparées) : la liste fait six écrans ; l'assistant Solvi recouvre le bouton « Solder » d'une ligne sur deux. | T | Mineur | t-heures-A1.png |
| 10.10 | Lisibilité | La note de bas de page (« Le compteur aide à décider : il ne calcule ni majoration ni repos compensateur… ») est en 12 px gris, alors qu'elle conditionne la lecture de toute la page. | O, P | Mineur | d-heures-2.png |

### 10a. Fenêtre « Faire rattraper des heures à … »

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 10a.1 | Cohérence | Valeurs incohérentes à l'ouverture : « Combien d'heures ? 4 h », « Il restera -5 h au compteur » (8 − 4 = 4, pas 5), proposition conseillée « 3 h » et alerte « 16 h 30 → 19 h 30 : 3 h en plus ». Trois nombres différents (4, 5, 3) pour une seule action. | O, T | Majeur | d-heures-rattraper-1.png |
| 10a.2 | Ergonomie | Les propositions de Solvéa à droite sont marquées « Planning déjà communiqué » (pastille orange) : l'option « Conseillé » est elle-même signalée comme un problème. | O, T | Mineur | d-heures-rattraper-1.png |
| 10a.3 | Lisibilité des données | Mini-planning cliquable par demi-heures : cases de 18 px de large à l'ordinateur, 8 px au téléphone (cibles impossibles au doigt) ; horaires coupés au téléphone (« 8 h 30 – 1… »). | O, T | Majeur | d-heures-rattraper-1.png, t-heures-fen.png |
| 10a.4 | Adaptation | Au téléphone, le titre « Solvéa propose » et sa phrase sont dans une colonne de 50 px, un mot par ligne (« Sans / règle / enfreinte / sur / les / quatre / prochaines / semaines. »). Fenêtre de 2148 px pour 483 visibles. | T | Majeur | t-heures-fen.png |
| 10a.5 | Lisibilité | Champs « Jour », « De », « À » affichés « 11/30/2026 », « 04:30 PM » (champs natifs du navigateur de test, réserve identique) ; au téléphone ils sont coupés (« 11/30/ », « 04:3 »), ce qui resterait vrai en format français de même longueur. | O, T | Mineur | d-heures-rattraper-2.png, t-heures-fen.png |
| 10a.6 | Ergonomie | Le message prérempli à Igor (« Bonjour Igor, votre compteur d'heures est à -8 h… ») est envoyé avec « Planifier et prévenir Igor » : bon retour. Mais le nombre d'heures de ce message (3 h) ne suit pas le champ « Combien d'heures ? » (4 h). | O | Mineur | d-heures-rattraper-2.png |

## 11. Équité

Identité : menu « Équité » (groupe Bilan) ; bouton « Équité » de la barre de Construire (qui ne change que le
compteur). Titre « La charge est-elle bien répartie ? ». Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 11.1 | Cohérence | Les trois tuiles du haut contredisent l'onglet affiché juste dessous : tuile « 2 ont porté plus : Caroline, Yanis » alors que Caroline est « 0,6 de moins » sur les samedis ; tuile « 3 ont porté moins : Inès, Sarah, Manon » alors que Manon est « 0,7 de plus » et Inès « À l'équilibre ». Les tuiles agrègent tous les critères sans le dire. | O, P, T | Majeur | d-equite-1.png, d-equite-2.png |
| 11.2 | Cohérence | Période : le sélecteur dit « 8 semaines », l'en-tête dit « Du lun. 21 septembre au dim. 22 novembre » (9 semaines) et le détail de Yanis dit « ses 9 semaines travaillées ». | O, P, T | Mineur | d-equite-yanis.png |
| 11.3 | Lisibilité des données | Valeurs décimales pour des samedis (« 9 pour 3,3 attendu », « 5,7 de plus », « 0,7 de plus ») sans unité ; la barre centrée (« à droite, plus que sa part ; à gauche, moins ») n'a pas de graduation, et le petit écart de Manon (0,7) a la même couleur marron que le gros écart de Yanis (5,7). | O, P, T | Mineur | d-equite-1.png |
| 11.4 | Lisibilité | « Comment c'est calculé » (lien bleu en bas de page, après le bloc Fatigue) donne « Dispersion des samedis : 1,92 ; des fermetures : 2,12 (plus c'est bas, plus c'est équilibré) » : indicateurs sans échelle, que l'on retrouve sous un autre nom dans « Proposer un planning » (« Écart d'équité (samedis) 1,88 »). | O | Mineur | d-equite-calcul.png, d-construire-proposer-1.png |
| 11.5 | Hiérarchie | Le bloc « Fatigue, semaine du 16 – 22 novembre 2026 » n'a rien à voir avec l'onglet choisi (il reste identique quel que soit l'onglet) et porte sur une seule semaine, alors que la page porte sur 8 semaines. | O, P, T | Mineur | d-equite-2.png, d-equite-Gardes.png |
| 11.6 | Lisibilité | Onglet « Demandes refusées » : un grand vide « Personne n'est concerné sur cette période », suivi de « Non concernés : Caroline, Pierre, Igor, Léa, Nicolas, Thomas, Inès, Jules, Sarah, Manon, Yanis » (les onze noms) : double message pour dire « rien ». | O | Cosmétique | d-equite-calcul.png |
| 11.7 | Adaptation | Au téléphone, la barre des six onglets ne montre que « Samedis travaillés » et « Fermetures en semaine » ; « Gar… » est coupé, les quatre autres sont cachés. | T | Mineur | t-equite-A1.png |
| 11.8 | Adaptation | Au téléphone, le bloc Fatigue met le détail (« 2 fermetures suivies d'une ouverture · 6 jours travaillés… ») dans une colonne de 120 px sur huit lignes à côté du nom. | T | Mineur | t-equite-A1.png, t-equite-A2.png |
| 11.9 | Cohérence | Accords : « Caroline T. Titulaire », « Sarah L. Animateur », « Manon G. Apprenti », « Léa F. Pharmacien » ; et « Personne n'est concerné » (accord correct mais phrase répétée). | O, P, T | Mineur | d-equite-1.png |
| 11.10 | Cohérence | Le niveau de fatigue « élevée » (rouge) et « modérée » (orange) n'est expliqué nulle part (seuils ?). | O, P, T | Mineur | d-equite-2.png |

## 12. Statistiques (onglets Composition, Compétences, Points forts, Activité)

Identité : menu « Statistiques » (groupe Bilan) ; lien « Voir les statistiques de l'équipe » de la fiche Équipe.
Titre « Que disent les chiffres de l'équipe ? ». Cinq tuiles chiffrées puis quatre onglets. Profil : titulaire.
Captures `d-stats-o1` à `d-stats-o4`, `t-stats-o1` à `t-stats-o4`.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 12.1 | Cohérence | Trois pages, trois chiffres pour les mêmes heures en moins : Statistiques « 956 h 30 planifiées pour 979 h de contrat… soit 22 h 30 de moins » (4 dernières semaines publiées) ; Heures « 45 h 30 en moins des contrats · 8 personnes » (période non dite) ; Tableau de bord « 8 à régulariser ». Les périodes ne sont pas comparables et rien ne le signale. | O, P, T | Majeur | d-stats-o4-1.png, d-heures-1.png |
| 12.2 | Cohérence | Pharmaciens : « Pharmaciens 2 · 1,8 ETP » (Composition), « 1,8 / 2 équivalent temps plein, Sous le seuil » (Équipe), « 3,7 temps plein au contrat, pour 2,1 qu'il faut, Plus qu'il n'en faut » (Réglages > Comptoir). | O, P, T | Majeur | d-stats-o1-2.png, d-equipe-1.png, o-officine-4.png |
| 12.3 | Cohérence | Points forts : Léa F. « Prend sa part : samedis et fermetures, au moins sa part sur 3 mois », alors qu'Équité affiche au même moment Léa « 1,8 de moins » sur les samedis. Périodes différentes (3 mois contre 8 semaines), rien ne l'explique. | O, P | Mineur | d-stats-o3-2.png, d-equite-2.png |
| 12.4 | Cohérence | Activité : « 2 demandes de remplacement en 12 mois : 0 pourvue, 2 en cours », alors que Résoudre > Remplacements n'en montre qu'une. | O, P | Mineur | d-stats-o4-2.png, d-resoudre-o2-1.png |
| 12.5 | Répétition | Les tuiles du haut répètent les pastilles des onglets juste dessous (« Compétences couvertes 8 sur 22 » et onglet « Compétences 8 / 22 » ; « Points forts relevés 7 » et onglet « Points forts 7 »), et « 4 reposent sur une seule personne » est redit en tête de l'onglet Compétences. | O, P, T | Mineur | d-stats-o2-1.png |
| 12.6 | Lisibilité des données | Dénominateurs qui changent d'un bloc à l'autre sans prévenir : « 2 sur 11 », « 7 sur 11 » (contrats) contre « 5 sur 9 » (temps partiel) et « 5 sur 9 » (points forts, « hors titulaires »), « Effectif 11, plus 2 remplaçants ». | O, P, T | Mineur | d-stats-o1-2.png, d-stats-o3-1.png |
| 12.7 | Lisibilité des données | Toutes les barres sont du même bleu sauf une marron (« Orthopédie (DU) », « Une seule personne ») ; les barres de « Par fonction » n'ont pas d'échelle (la barre des Préparateurs, 4, est pleine ; celle des Titulaires, 2, à moitié). | O, P | Cosmétique | d-stats-o1-2.png, d-stats-o2-2.png |
| 12.8 | Répétition | Onglet Compétences : « Contention et compression », « Préparations magistrales », « Gestes d'urgence (AFGSU) » sont listées dans « Que personne ne détient » puis une seconde fois juste dessous avec « Personne dans l'équipe » et une barre vide. | O, P, T | Mineur | d-stats-o2-1.png, d-stats-o2-2.png |
| 12.9 | Lisibilité | Le nombre est collé au titre avec une grande espace : « Reposent sur une seule personne   4 », « Que personne ne détient   14 » ; les compteurs « 4 / 7 », « 3 / 12 », « 1 / 3 » des accordéons sont en gris clair à l'opposé de leur titre. | O | Cosmétique | d-stats-o2-1.png |
| 12.10 | Hiérarchie | Activité : les deux blocs détaillés (« Les heures par personne », « Le détail par personne ») sont fermés et coincés entre deux blocs ouverts ; « Compté du 20 novembre 2025 au 20 novembre 2026. Le premier poste connu date du 21 septembre 2026. » : on annonce 12 mois mais les données couvrent 2 mois. | O, P | Mineur | d-stats-o4-2.png |
| 12.11 | Adaptation | Au téléphone, les cinq tuiles occupent un écran entier avant les onglets ; la barre d'onglets ne montre que « Composition » et « Compétences 8 / 2[2] » (pastille coupée), les deux autres onglets sont hors écran. | T | Mineur | t-stats-o2-A1.png |
| 12.12 | Cohérence | Accords : Sarah Lemoine « Animateur », Inès Da Silva « Préparateur », Léa Fontaine « Pharmacien » ; nom complet ici (« Nicolas Le Syndicaliste ») et abrégé ailleurs (« Nicolas L. »), y compris sur la même page (« 1 personne : Nicolas L. »). | O, P, T | Cosmétique | d-stats-o2-1.png, d-stats-o2-2.png |

## 13. Journal et paie (Journal « Dossier de preuve » et « Fiche navette »)

Identité : menu « Journal et paie » (groupe Bilan). Bascule « Journal / Fiche navette » en haut à droite ; le titre
change avec elle (« Dossier de preuve » ou « Fiche navette »). Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 13.1 | Lisibilité | « 24 règles appliquées » déplie une liste d'identifiants techniques : « duree.quotidienne@1.0 · duree.amplitude@1.0 · paie.heuresSupp@1.0 · pharmacie.presence@1.0 · equipe.samedisLibres@1.0… », illisibles pour une titulaire ou un inspecteur, et différents des titres de la page Règles. | O, T | Majeur | d-journal-regles.png |
| 13.2 | Ergonomie | « Exporter le dossier » n'enregistre pas de fichier : il ouvre une fenêtre « dossier-de-preuve-2026-11-20.json » avec le code JSON brut à copier (« Cette page hébergée ne peut pas enregistrer de fichier sur votre appareil : copiez le contenu, puis collez-le dans un fichier ou un tableur »). Voir la réserve en fin de rapport (comportement de la version hébergée). | O, T | Majeur | d-journal-export.png |
| 13.3 | Cohérence | Dates au format numérique « Du 18/11/2026 au 20/11/2026 », « Planning de la semaine du 30/11/2026 publié », alors que tout le reste de l'application écrit « lun. 30 novembre » ou « 30 novembre – 6 décembre 2026 ». | O, P, T | Mineur | d-journal-1.png |
| 13.4 | Cohérence | « Arrêt d'Igor L. enregistré : 3 postes à couvrir » (Journal) contre « 1 poste sans personne » (Tableau de bord) et « 1 poste à couvrir » (Résoudre) pour le même arrêt. | O, P, T | Mineur | d-journal-1.png, d-resoudre-1.png |
| 13.5 | Cohérence | Fiche navette : « 0,5 h en plus des contrats » alors que la page Heures affiche « 0 h en plus des contrats » ; « 996 h prévues au planning » alors que Statistiques affiche « 956 h 30 planifiées » ; périodes différentes non signalées. | O, P, T | Mineur | d-journal-navette-1.png, d-heures-1.png |
| 13.6 | Adaptation | Fiche navette au téléphone : seules les colonnes « SALARIÉ » et « PRÉVUES » sont visibles ; « EN PLUS », « ABSENCES » (« Arrêt · 3 j » d'Igor) et « GARDES » (indemnités de Léa) sont hors écran à droite. La ligne de Léa est haute de 300 px (le contenu caché de la colonne Gardes) et paraît vide. | T | Majeur | t-journal-navette-A.png |
| 13.7 | Lisibilité des données | Fiche navette : la colonne Gardes mêle des unités différentes sur la même ligne (« 15 points : Indemnité de sujétion… 1,5 point par heure », « 10 h Garde à volets ouverts », « 10 h Repos compensateur à positionner »). Les cases vides portent un long tiret gris. | O | Mineur | d-journal-navette-1.png |
| 13.8 | Lisibilité | Heures en chasse fixe très espacées : « 1 7 h 3 0 », « 1 4 3 , 5 h », « 1 / 1 ». La tuile « 1/1 changement lu par l'équipe » ne dit pas de quel changement il s'agit. | O, T | Cosmétique | d-journal-1.png |
| 13.9 | Cohérence | Deux segments de commande de dessin différent l'un sous l'autre (« Journal / Fiche navette » et « Tout / Publications / Absences ») ; le titre de page change selon le segment (« Dossier de preuve » / « Fiche navette ») alors que le menu dit « Journal et paie ». | O, P | Cosmétique | d-journal-1.png, d-journal-navette-1.png |
| 13.10 | Répétition | Chaque publication répète la même phrase (« 46 postes communiqués à l'équipe, 12 jours avant le début de la semaine ») et le même bouton « 24 règles appliquées ». | O, P, T | Cosmétique | d-journal-2.png |

## 14. Documents

Identité : menu « Documents » (groupe Bilan). Surtitre « BILAN », titre « Mes documents ». Cinq onglets : Plannings
publiés, Mes absences, Mes fichiers, Reçus de l'équipe, Absences de l'équipe. Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 14.1 | Cohérence | Le menu dit « Documents », le titre « Mes documents », le surtitre « BILAN » (nom du groupe du menu, alors que les autres pages ont le nom de la rubrique en surtitre). Le sous-titre « Vos anciens plannings, vos absences et les fichiers que vous déposez » ne couvre pas les deux onglets d'équipe. | O, P, T | Mineur | d-documents-o1-1.png |
| 14.2 | Répétition | L'onglet « Absences de l'équipe » reprend la frise « Absences de l'équipe » déjà affichée dans Résoudre > Demandes, avec la même légende et le même cartouche « Demandé ». | O, P | Mineur | d-documents-o5-1.png, d-resoudre-o3-1.png |
| 14.3 | Ergonomie | « Voir » d'un planning publié quitte Documents pour Construire (titre « Comment couvrir la semaine ? »), en mode modification, au lieu d'afficher le document archivé. | O | Mineur | d-documents-o1-1.png |
| 14.4 | Lisibilité des données | Liste « Plannings publiés » : 11 lignes identiques (« Semaine du …, 46 postes publiés · terminée ») sans autre information utile (date de publication, auteur, modifications) ; « terminée » est en gris de même taille que le nombre de postes. Les mois sont en minuscules en tête de groupe (« novembre 2026 ») contre « Novembre 2026 » dans Journal. | O, P, T | Cosmétique | d-documents-o1-1.png |
| 14.5 | Cohérence | Tuiles de l'onglet « Absences de l'équipe » : « 3 jours d'arrêt, 0 jour de congé », alors que la liste juste dessous montre « Nicolas L. · Congé, 5 jours » et que l'onglet est marqué « Congés 1 ». La note « Chiffres des douze derniers mois » ne dit pas que le congé à venir n'est pas compté. | O | Mineur | d-documents-o5-1.png |
| 14.6 | Adaptation | Au téléphone, seuls « Plannings publiés 11 » et « Mes absences 0 » sont visibles dans la barre d'onglets ; les trois autres, dont les deux onglets propres au titulaire, sont hors écran. Chaque ligne de planning prend 125 px (bouton « Voir » sur sa propre ligne). | T | Mineur | t-documents-o1-A1.png |
| 14.7 | Lisibilité | Onglet « Mes fichiers » : la limite « 600 Ko au plus » et la « Place utilisée : 1 Ko sur 3,0 Mo » sont en 12 px gris ; le grand cadre vide « Aucun fichier déposé. » fait 110 px. | O | Cosmétique | d-documents-o3-1.png |
| 14.8 | Cohérence | La légende de la frise met une couleur « Formation » et « Congé » au même vert pâle très proche ; les traits hachurés verticaux (jours fériés ?) ne sont pas dans la légende. | O | Mineur | d-documents-o5-1.png |

## 15. Aide

Identité : lien « Besoin d'aide ? Aide, tutoriels et lexique » en bas de la barre latérale, icône « ? » de la barre
du haut. Titre « Comment faire ? ». Recherche, choix du « Rythme de la visite », onglets « Comment faire 52 / Lexique
42 », huit catégories en pastilles, cartes de réponse. Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 15.1 | Cohérence | La titulaire voit la catégorie « Mes demandes 1 » (« Poser un congé ou une contrainte d'horaires : Dans « Mes demandes », carte « Absence ou horaire »… », bouton « Faire une demande ») : la rubrique « Mes demandes » n'existe pas dans son menu, et son bouton s'appelle « Poser une absence ». | O, P, T | Majeur | d-aide-1.png |
| 15.2 | Cohérence | La carte « Préparer le mois avant l'échéance » parle d'un bouton « Préparer le mois » ; au Tableau de bord le bouton s'appelle « Préparer décembre ». « Ouvrir « Construire » » et « Ouvrir Construire » (avec ou sans guillemets) coexistent. | O, P, T | Mineur | d-aide-2.png |
| 15.3 | Hiérarchie | Avant la première réponse, la page empile titre, recherche, « Rythme de la visite » (trois grandes cartes Posé / Normal / Vif), deux onglets et huit pastilles de catégories : à 1440, seule la première ligne de cartes est visible ; au téléphone, la première réponse est au deuxième écran. Le réglage « Rythme de la visite » concerne les tutoriels et n'a pas sa place avant la recherche. | O, T | Mineur | d-aide-1.png, t-aide-A1.png |
| 15.4 | Répétition | Chaque carte porte deux boutons (« Voir le tutoriel | 1 étape » et « Ouvrir … → ») ; « Ouvrir le tableau de bord » est répété sur quatre cartes de la catégorie Au quotidien, dont « À quoi sert le bouton « Créer » ? » (qui ne concerne pas le tableau de bord). | O, P, T | Mineur | d-aide-2.png |
| 15.5 | Lisibilité | Cartes de texte de 8 à 10 lignes en 15 px ; les guillemets ouvrants restent seuls en fin de ligne (« (l'écran « / Construire » ») ; hauteurs de cartes inégales, boutons alignés en bas avec de grands vides. | O, P, T | Cosmétique | d-aide-1.png, d-aide-2.png |
| 15.6 | Répétition | Trois accès à l'aide sur le même écran (lien de la barre latérale, « ? » de la barre du haut, bouton « Aide » de Solvi en bas à droite), plus la carte « Demander à Solvi » et la carte « Contacter le support » qui répète le pied de page « Une question sans réponse ? Support Solvéa ». | O, P | Mineur | d-aide-2.png |
| 15.7 | Adaptation | Au téléphone, la recherche est coupée (« Exemple : publier, congé, garde, heu ») ; la barre des catégories ne montre que « Au quotidien 6 », « Préparer 12 » et « Co… ». | T | Mineur | t-aide-A1.png |
| 15.8 | Lisibilité | Au téléphone, le pied de chaque carte est recouvert par Solvi ; le bouton « Voir le tutoriel » passe sous l'assistant. | T | Mineur | t-aide-A1.png |

## 16. Barre du haut, barre latérale et barre du bas (téléphone)

Identité : présentes sur toutes les pages. Barre du haut : étiquette « Espace titulaire » (menu de l'environnement de
test), nom de la pharmacie, date, « Créer », « Retard ou absence », cloche, bulle des messages, « ? » (aide), menu du
compte. Barre latérale : sélecteur de pharmacie, 14 rubriques en 4 groupes, lien d'aide, heure d'enregistrement.
Téléphone : barre du bas « Accueil, Planning, À décider, Messages, Menu ». Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 16.1 | Répétition | Le nom de la pharmacie est dans la barre latérale (sélecteur, coupé « Grande Pharmacie de la P… ») et dans la barre du haut (coupé « Grande Pharmacie de la Pin… » à 1440, réduit à « r… » à 1280) ; il est aussi en titre de Réglages et dans le bandeau du Tableau de bord. | O, P | Mineur | d-barre-creer.png, p-barre-creer.png |
| 16.2 | Répétition | Trois boutons d'aide visibles en permanence : « ? » de la barre du haut, « Besoin d'aide ? » de la barre latérale, bouton « Aide » de Solvi en bas à droite. | O, P | Mineur | d-barre-creer.png |
| 16.3 | Cohérence | La cloche (16) recompte les décisions déjà signalées par la pastille de Résoudre (7) et y ajoute « Compteurs d'heures en dessous du contrat 8 » : la moitié du chiffre de la cloche vient d'un compteur qui n'appelle pas de décision immédiate. Les lignes « Prévu · Igor L. attend un volontaire 1 » et « Autres décisions à prendre 5 » découpent les décisions autrement que Résoudre. | O, P, T | Mineur | d-barre-cloche.png |
| 16.4 | Ergonomie | Menu « Créer » : « Un planning » ne crée rien (il ouvre Construire) ; « Une formation » et « Un inventaire » ouvrent leur fenêtre par-dessus la page Équipe, sur laquelle on reste après avoir fermé la fenêtre, quelle que soit la page de départ ; « Mon absence » ouvre la fenêtre « Enregistrer un besoin » (voir 2.1). | O, P, T | Mineur | d-barre-creer.png, d-formation-1.png |
| 16.5 | Adaptation | Au téléphone, le menu « Créer » sort de l'écran par la gauche : son titre est coupé (« ÉER » pour « CRÉER ») et les libellés touchent le bord. | T | Mineur | t-barre-A.png |
| 16.6 | Adaptation | Au téléphone, la barre du haut n'a plus que des icônes sans texte (couronne, +, réveil, cloche, bulle, initiales) ; l'icône « ? » de l'aide disparaît. Le réveil orange « Retard ou absence » ne se devine pas. | T | Mineur | t-barre-A.png |
| 16.7 | Cohérence | Barre du bas du téléphone : « Accueil » ouvre le Tableau de bord, « Planning » ouvre Construire (et non Mon planning), « À décider » ouvre Résoudre : trois libellés différents du menu latéral. | T | Majeur | t-barre-A.png |
| 16.8 | Cohérence | Menu du compte : « Mon compte » et « Paramètres » ouvrent la même page (titre « Mes paramètres ») ; « Mes horaires » ouvre « Mon planning » (troisième nom pour la même page) ; « Se déconnecter » est aussi dans la page. Le choix d'apparence a trois modes dans le menu (Clair, Mixte, Sombre) et quatre dans la page (plus « Comme l'appareil »). | O, P, T | Mineur | d-barre-compte.png, d-compte-2.png |
| 16.9 | Cohérence | Accord : pastille « Titulaire principal » pour Caroline dans le menu du compte ; dans le menu de test, « Animateur / Animatrice », « Apprenti / Apprentie » sur la même ligne. | O, P, T | Cosmétique | d-barre-compte.png, d-barre-test.png |
| 16.10 | Lisibilité | Barre latérale : intitulés de groupes (« PRÉPARER », « PLANIFIER », « SUIVRE », « BILAN ») en 11 px gris ; « Enregistré sur cet appareil à 23 h 28 » en 11,5 px. À 1280, l'espacement des rubriques se resserre (32 px) et « Besoin d'aide ? » perd son sous-titre. | O, P | Cosmétique | d-barre-creer.png, p-barre-creer.png |
| 16.11 | Ergonomie | L'étiquette « Espace titulaire » (bouton bleu à chevron, à gauche de la barre du haut) ressemble à un sélecteur d'espace mais ouvre le menu de l'environnement de test (changer de profil, « Réinitialiser » en un clic). | O, P, T | Cosmétique | d-barre-test.png |

## 17. Mon compte (« Mes paramètres »)

Identité : menu du compte > « Mon compte » ou « Paramètres ». Surtitre « MON COMPTE », titre « Mes paramètres ».
Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 17.1 | Cohérence | Trois noms pour la page : « Mon compte » (menu), « Paramètres » (menu), « Mes paramètres » (titre). Deux pastilles d'identité : « Titulaire principal » et « Espace responsable » (le mot « responsable » n'apparaît nulle part ailleurs pour la titulaire, dont l'espace s'appelle « Espace titulaire » dans la barre du haut). | O, P, T | Mineur | d-compte-1.png |
| 17.2 | Cohérence | « Mes compétences et diplômes : Vous les tenez à jour vous-même. Vos titulaires sont informés de chaque changement. » : texte écrit pour un salarié, affiché à la titulaire principale. Le bloc est identique à celui de sa fiche dans Équipe (répétition). | O, P, T | Mineur | d-compte-1.png, d-equipe-1.png |
| 17.3 | Adaptation | Au téléphone, la carte d'identité met la ligne « Titulaire principal · non salarié · 15 ans et 8 mois d'ancienneté · Grande Pharmacie de la Pinède » dans une colonne de 80 px sur huit lignes à côté du bouton « Se déconnecter » ; même défaut pour « Vous les tenez à jour vous-même… » (cinq lignes) à côté de « 3 sélectionnées ». | T | Majeur | t-compte-A1.png |
| 17.4 | Lisibilité | Note sous les couleurs en 12 px gris sur deux lignes pleine largeur (« Chaque profil a sa couleur… En tant que titulaire principal, vous seul pouvez changer la vôtre… votre bannière garde son illustration en bleu… »). | O | Cosmétique | d-compte-2.png |
| 17.5 | Ergonomie | La « Clé de secours : TILL-2026 » s'affiche en clair à chaque ouverture de la page. Le bouton « Changer le mot de passe » est bleu pâle sans dire ce qui manque. | O | Mineur | d-compte-3.png |
| 17.6 | Hiérarchie | Page longue (quatre écrans à 1440, neuf au téléphone) dont la moitié est la grille des 22 compétences ; les réglages d'apparence et de connexion, propres à la page, viennent après. | O, T | Mineur | d-compte-1.png, t-compte-A1.png |

## 18. Fenêtre « Retard ou absence » (« Signaler un retard ou une absence »)

Identité : bouton orange « Retard ou absence » de la barre du haut. Profil : titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 18.1 | Ergonomie | Fenêtre courte et claire (« Pour qui ? », « Un retard / Une absence ») ; le bouton grisé porte une consigne « Choisissez retard ou absence » au lieu d'une action, comme « Choisissez une décision » dans Résoudre : convention propre à l'application, cohérente entre les deux fenêtres. | O, T | Cosmétique | d-retard-1.png |
| 18.2 | Répétition | Quatre entrées pour signaler une absence de la titulaire : ce bouton, « Poser une absence » (Mon planning), « Mon absence » (Créer), « Besoin ou absence » (fiche Équipe) ; elles n'ouvrent pas la même fenêtre (celle-ci contre « Enregistrer un besoin »). | O, P, T | Majeur | d-retard-1.png, d-moi-absence-1.png |

## 19. Fenêtre « Planifier une formation »

Identité : « Créer > Une formation », ou flèche de la tâche « Formation » dans la fenêtre d'un poste. Profil :
titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 19.1 | Hiérarchie | La consigne qui oriente le choix (« Pour une formation de quelques heures pendant un poste, ouvrez plutôt le poste dans « Construire »… ») est en bas de la fenêtre en 12 px gris, après tous les champs. | O, T | Mineur | d-formation-2.png |
| 19.2 | Ergonomie | Liste des participants : 11 grandes cartes à case à cocher sur deux colonnes, sans bouton « Toute l'équipe » (alors que la fenêtre inventaire en a un) ; la fenêtre défile (866 px pour 614 à 1440 ; 1130 pour 521 au téléphone). | O, T | Mineur | d-formation-2.png |
| 19.3 | Cohérence | Le champ « Nom de la formation » a une flèche ▼ pleine, différente du chevron de toutes les autres listes ; au téléphone, son texte d'exemple est coupé (« Vaccination, entretiens pharmaceutiqu »). | O, T | Cosmétique | d-formation-1.png, t-barre-B.png |
| 19.4 | Lisibilité | Dates affichées « 12/05/2026 » à côté de « Le sam. 5 décembre » : un lecteur français lit 12 mai. Réserve : champ natif, format du navigateur de test. | O | Cosmétique | d-formation-1.png |
| 19.5 | Ergonomie | « Planifier et prévenir » grisé sans indiquer ce qui manque. | O, T | Mineur | d-formation-1.png |

## 20. Fenêtre « Planifier un inventaire » (titre affiché : « Fixer un inventaire »)

Identité : « Créer > Un inventaire », ou flèche de la tâche « Inventaire » dans la fenêtre d'un poste. Profil :
titulaire.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 20.1 | Cohérence | Trois noms : « Un inventaire » (Créer), « Planifier une formation ou un inventaire » (Aide), « Fixer un inventaire » (titre de la fenêtre), bouton « Fixer et prévenir ». | O, T | Cosmétique | d-inventaire-1.png |
| 20.2 | Lisibilité | Deux formats d'heure côte à côte : champs « 07:30 PM » et « 10:30 PM », résumé « 3 h · 19:30 → 22:30 ». Réserve : champs natifs du navigateur de test ; le résumé en « 19:30 » reste différent du « 19 h 30 » du reste de l'application. | O, T | Cosmétique | d-inventaire-1.png |
| 20.3 | Ergonomie | « Toute l'équipe » est un bouton bleu pâle isolé au-dessus de la liste, sans effet visible tant qu'on ne clique pas ; même liste de 11 grandes cartes que la formation. | O | Cosmétique | d-inventaire-1.png |

## 21. Ce qui change chez le titulaire secondaire (Pierre, role 1)

Identité : même menu, mêmes pages que Caroline. Étiquette « Espace titulaire secondaire ». Chaque décision part en
accord chez la titulaire principale. Captures préfixées `r1-` (Pierre) et `r0-` (Caroline après la décision de
Pierre). Ces captures ont été faites après minuit : la date simulée est alors samedi 21 novembre.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| 21.1 | Ergonomie | Dans « Décider : congé de Nicolas L. », rien n'indique à Pierre que sa décision ne s'appliquera qu'après l'accord de Caroline : le bouton dit « Accepter la demande ». Ce n'est qu'après le clic qu'un message dit « Envoyé à Caroline pour accord. Rien n'est appliqué avant. » | O | Majeur | r1-decider.png, r1-en-attente.png |
| 21.2 | Cohérence | La même demande est comptée deux fois après la décision de Pierre : onglet « En attente d'accord 1 » et onglet « Demandes 2 » chez Pierre ; « Accords à donner 1 » et « Demandes 2 » chez Caroline. Le titre passe à « 7 décisions à prendre » chez Pierre alors que la pastille de son menu dit 6. | O | Majeur | r1-en-attente.png, r0-resoudre-accord.png |
| 21.3 | Ergonomie | Chez Caroline, la carte « Approuver : congé de Nicolas L. », sous-titre « Proposé par Pierre F., titulaire secondaire », propose « Refuser » et « Donner mon accord » sans rien dire de ce que la décision implique (les 4 postes à couvrir, les deux manques au comptoir que la fenêtre de Pierre affichait) : il faut aller dans l'onglet Demandes pour le savoir. | O | Majeur | r0-resoudre-accord.png |
| 21.4 | Adaptation | Barre du haut de Pierre : l'étiquette plus longue « Espace titulaire secondaire » mange le début du nom de la pharmacie, qui s'affiche « de Pharmacie de la… ». | O, P | Mineur | r1-d-tableau-1.png |
| 21.5 | Adaptation | Tableau de bord de Pierre au téléphone : le bandeau met la date, la salutation et « Titulaire secondaire · Grande Pharmacie de la Pinède » dans une colonne étroite, un mot par ligne (« SAMEDI / 21 / NOVEMBRE / 2026 / Bonsoir / Pierre / … / Grande / Pharmacie / de / la / Pinède »), sur 400 px de haut. | T | Majeur | r1-t-tableau-A1.png |
| 21.6 | Cohérence | Pierre voit et peut modifier Réglages, Règles et Équipe exactement comme Caroline, sans mention qu'un changement y attend ou non l'accord de Caroline (la fiche Équipe dit pourtant « Chacune de ses décisions… attend l'accord »). Le sélecteur de pharmacie de la barre latérale n'existe pas chez lui. | O | Mineur | r1-d-officine-1.png |
| 21.7 | Répétition | En-tête de Réglages (identique chez Caroline et Pierre) : sous le titre, la ligne des surfaces puis un paragraphe « Horaires d'ouverture, effectif attendu et postes types. Ces réglages… se modifient librement. Un onglet par famille de réglages. » qui décrit les onglets visibles juste dessous. | O | Cosmétique | r1-d-officine-1.png |

## 22. Transversal (ce qui se répète sur plusieurs pages)

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| T.1 | Adaptation | Au téléphone, les barres d'onglets défilent horizontalement sans aucun indice (ni flèche, ni ombre, ni onglet coupé lisible) et l'onglet actif peut être hors écran : Réglages (Planning, Paramètres cachés), Règles (À faire valider), Résoudre (Demandes, Gardes, À publier), Équité (4 sur 6 cachés), Statistiques (2 sur 4), Documents (3 sur 5), Aide (catégories). | T | Majeur | t-officine-divers.png, t-resoudre-o3-A1.png, t-equite-A1.png, t-documents-o1-A1.png |
| T.2 | Adaptation | Au téléphone, un même défaut de mise en page revient partout : un texte placé à côté d'un bouton ou d'une pastille garde une colonne de 50 à 120 px et s'écrit un ou deux mots par ligne (Tableau de bord « Décisions récentes », fiche Équipe, confirmation de retrait, Contrôles de Construire, frise d'absences de Résoudre, Équité « Fatigue », fenêtre « Faire rattraper », Mon compte, bandeau de Pierre). | T | Majeur | t-tableau-A2.png, t-construire-A1.png, t-resoudre-o3-A1.png, t-heures-fen.png, t-compte-A1.png, r1-t-tableau-A1.png |
| T.3 | Adaptation | Au téléphone, choisir un élément dans une liste (une personne dans Équipe, une conversation dans Messages, une garde dans Gardes) affiche son détail plusieurs écrans plus bas sans y amener : rien ne semble se passer. | T | Majeur | t-equipe-ines-clic.png, t-messages-fen.png, t-gardes-fen.png |
| T.4 | Adaptation | L'assistant Solvi (122 × 62 px à l'ordinateur, 58 × 58 px au téléphone, fixe en bas à droite) recouvre en permanence le contenu situé dessous : dernière colonne de la grille de Construire, pastilles des décisions du Tableau de bord, boutons « Solder » de Heures, boutons « Voir le tutoriel » de l'Aide. Ouvert, son panneau de 410 px recouvre le tiers droit de la page sans voile. | O, P, T | Mineur | d-construire-1.png, d-solvi.png, solvi-A.png |
| T.5 | Cohérence | Accords au masculin appliqués aux femmes sur toutes les pages : « Titulaire principal » (Caroline), « Pharmacien » (Léa), « Préparateur » (Inès), « Animateur » (Sarah), « Apprenti » (Manon). Le menu de test, lui, écrit « Titulaire principale », « Animatrice », « Apprentie ». | O, P, T | Mineur | d-equipe-1.png, d-tableau-1.png, d-barre-test.png |
| T.6 | Cohérence | Formats d'heure mélangés : « 8 h 30 – 16 h 30 » (pages), « 08:30–16:30 » (grille de Construire, Réglages > Comptoir, postes types), « 8h30 » (vue Mois), « 19:30 → 22:30 » (inventaire). Formats de date mélangés : « lun. 30 novembre », « 30/11/2026 » (Journal), « 12/05/2026 » (champs natifs). | O, P, T | Mineur | d-construire-1.png, d-construire-mois-1.png, d-journal-1.png |
| T.7 | Lisibilité | Chiffres à chasse fixe très espacés dans les grands nombres et les heures (« 1 1 h 30 », « 1 , 8 / 2 », « 1 4 3 , 5 h », « 1 7 h 3 0 ») sur le Tableau de bord, Équipe, Heures, Journal, Construire. | O, P, T | Cosmétique | d-tableau-2.png, d-journal-1.png |
| T.8 | Cohérence | Une même chose porte plusieurs noms selon l'écran : Résoudre / À décider ; Tableau de bord / Accueil ; Construire / Planning / Planning de l'équipe / Un planning ; Mon planning / Mes horaires ; Heures / Compteur d'heures ; Mon compte / Paramètres / Mes paramètres ; Documents / Mes documents / Bilan ; poste à couvrir / absence à couvrir / poste sans personne ; alerte / à surveiller. | O, P, T | Majeur | d-resoudre-1.png, t-barre-A.png, d-compte-1.png |
| T.9 | Cohérence | Des chiffres qui devraient coïncider diffèrent d'une page à l'autre, sans que la période ou le périmètre soit dit : équivalents temps plein pharmaciens (1,8 / 2 ; 3,7 pour 2,1 ; 2 · 1,8), heures en moins (45 h 30 ; 22 h 30 ; « 8 à régulariser »), heures en plus (0 h ; 0,5 h), postes à couvrir après l'arrêt d'Igor (1 ; 3), demandes de remplacement (1 ; 2), gardes de Léa (0 ; 1). | O, P, T | Majeur | d-equipe-1.png, o-officine-4.png, d-stats-o1-2.png, d-heures-1.png, d-journal-navette-1.png |
| T.10 | Ergonomie | Actions à effet immédiat sans confirmation, avec ou sans message d'annulation : supprimer un poste type (aucun message), « Choisir » une option d'absence, « Solder » un compteur, « Régulariser automatiquement » (7 compteurs), supprimer une garde (message « Annuler » 5 à 9 s). À l'inverse, publier une semaine propre ou retirer une personne demande une fenêtre de confirmation. | O, P, T | Majeur | d-officine-poste-retire.png, d-res-choisir-sans-dialogue.png, d-heures-auto.png |
| T.11 | Ergonomie | Le message de retour (en bas au centre) reste 5,2 s, ou 9 s quand il a un bouton, et se superpose aux fenêtres ouvertes juste après ; au téléphone il couvre la barre du bas. | O, T | Mineur | d-res-decider1-1.png, t-construire-fen2.png |
| T.12 | Ergonomie | Boutons principaux désactivés sans explication, dessinés en bleu pâle comme les boutons secondaires actifs : « Publier les modifications », « Ajouter » (personne), « Enregistrer » (besoin), « Valider pour le comptable », « Envoyer », « Changer le mot de passe », « Planifier et prévenir », « Ajouter garde ». | O, P, T | Mineur | d-construire-1.png, d-equipe-ajouter-1.png, d-gardes-4.png |
| T.13 | Ergonomie | Cibles sous 40 px au doigt sur la plupart des pages : boutons secondaires « sm » de 34 px (Mon planning, Tout marquer comme lu, Vu, Retirer, Noter un retard, Faire rattraper, Solder, puces de raccourcis et de jours), cases à cocher de 22 px, liens du pied de page de 20 px, cases de jour de la grille au téléphone (30 × 55), cases du mini-planning de rattrapage (8 × 40 au téléphone). | O, P, T | Mineur | d-equipe-besoin-1.png, t-heures-fen.png |
| T.14 | Lisibilité | Textes d'aide et notes de bas de bloc en 12 px gris à presque chaque section (Règles, Gardes, Heures, Statistiques, Réglages, fenêtres), souvent porteurs d'une information décisive (période, unité, condition). Les mesures relèvent de 15 à 280 éléments de texte sous 12 px par page (la vue Mois en compte 279). | O, P | Mineur | d-heures-2.png, d-gardes-3.png, d-construire-mois-2.png |
| T.15 | Lisibilité des données | Les couleurs portent du sens sans légende à l'endroit où on les voit : frise du Tableau de bord, cartes de jours de Mon planning (légende seulement en mode Calendrier), barres sous les noms de la vue Mois et de Heures, barres d'Équité, niveaux de fatigue. | O, P, T | Majeur | d-tableau-1.png, d-moi-2.png, d-heures-1.png |
| T.16 | Cohérence | Des textes écrits pour un salarié s'affichent à la titulaire : « Vous proposer n'engage à rien tant que le responsable n'a pas validé » (Mon planning), « Seuls vos titulaires la voient » (besoin), « Vos titulaires sont informés de chaque changement » (Mon compte), « préférez une demande » (Messages), « Les titulaires sont prévenus aussitôt » (retard), catégorie « Mes demandes » (Aide). | O, P, T | Mineur | d-moi-1.png, d-compte-1.png, d-aide-1.png |
| T.17 | Répétition | Chaque titre de page est doublé d'un sous-titre qui le redit ou décrit les onglets visibles juste dessous (Réglages « Un onglet par famille de réglages », Règles « Rangées par question », Statistiques, Aide) ; les tuiles chiffrées en tête de page répètent les pastilles des onglets (Statistiques, Journal, Documents). | O, P | Cosmétique | d-stats-o2-1.png, r1-d-officine-1.png |
| T.18 | Adaptation | Thème sombre : rendu globalement correct ; les tuiles de postes et les barres de frise restent en pastels très clairs et deviennent l'élément le plus lumineux de l'écran ; dans Gardes, l'icône des pastilles « Pharmacien » devient un disque noir plein. | S | Cosmétique | s-construire-1.png, s-gardes-2.png |

## 23. Ce que je n'ai pas pu voir ou juger

- **Formats des champs date et heure natifs** : le navigateur de test (Chromium sans interface, contexte `fr-FR`)
  affiche les champs `date` et `time` au format américain (« 11/23/2026 », « 03:00 PM »). Je n'ai pas pu vérifier le
  rendu dans un navigateur réglé en français ; les points 6.19, 9.10, 10a.5, 19.4, 20.2 sont donc à revérifier (les
  troncatures au téléphone, elles, resteraient).
- **Exporter le dossier** (13.2) et l'impression : la version testée est la version hébergée ; elle ouvre une fenêtre
  de copie au lieu d'enregistrer un fichier. Je n'ai pas vu le comportement d'une installation locale, ni la sortie
  papier réelle (seulement l'aperçu).
- **Heure de la journée** : les captures ont été faites le soir puis après minuit (horloge réelle du navigateur) ; le
  Tableau de bord affichait donc « Journée terminée », et la date simulée est passée du vendredi 20 au samedi 21
  novembre en cours d'audit (captures `r1-`, `r0-`, `d-barre-*`, `d-solvi`). L'état « en pleine journée » (curseur
  « Maintenant » au milieu de la frise) n'a pas été vu.
- **Fenêtres non ouvertes** : « Comment régler cette absence ? » a été vue mais pas appliquée ; les fenêtres « Me faire
  remplacer » (côté salarié), la fenêtre de déconnexion, la visite guidée et les tutoriels (hors périmètre ou non
  demandés), la fenêtre de publication avec points bloquants (aucune semaine de l'exemple n'en avait), l'onglet « À
  publier » non vide, l'état vide de chaque page (nouvelle pharmacie).
- **Titulaire secondaire** : je n'ai pas vérifié si un changement de Réglages, de Règles ou d'Équipe fait par Pierre
  attend aussi l'accord de Caroline ; seul le circuit d'une demande de congé a été joué.
- **Grand écran 1920 × 1080** et **taille de texte « Grand »** : non capturés.
- **Lecteurs d'écran, navigation au clavier** : non évalués (hors grille demandée).
