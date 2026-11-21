# Revue UX / UI de Solvéa : avant d'entrer, espace de l'équipe, transversal

Code : UX-equipe-transversal. Version testée : copie publiée servie par `servi.js` (dossier `heberge`), Chromium
(Playwright), horloge figée au vendredi 20 novembre 2026 à 10 h sauf mention. Tailles : 1440×900 (« ordinateur »),
1280×760 (« portable »), 390×800 (« téléphone », tactile). Captures : `captures/` de ce dossier (chemins relatifs
ci-dessous : `captures/<nom>.png`). Scripts : `js/`. Rien n'a été modifié dans l'application.

Gravité : **Bloquant** (empêche d'utiliser la page), **Majeur** (gêne forte, induit en erreur), **Mineur**,
**Cosmétique**.

Décompte : 217 constats ; Bloquant 0, Majeur 29, Mineur 126, Cosmétique 62.

---

# Partie A. Avant d'entrer

## A1. Page de connexion (appareil vide)

Identité : première ouverture de l'application, localStorage vidé. Aucun profil.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| A1-1 | Hiérarchie / ergonomie | Sur un appareil sans aucun compte, le formulaire « Connexion » occupe toute la carte et reçoit le focus ; les deux seules actions possibles (« Créer ma pharmacie », « Comment ça marche ? ») sont reléguées sous un intertitre gris « PREMIÈRE VISITE ? ». L'utilisateur peut saisir un identifiant et un mot de passe pour rien : ce n'est qu'après avoir cliqué « Se connecter » qu'il lit « Aucun compte n'existe encore sur cet appareil. Créez votre pharmacie… ». L'application sait pourtant d'avance que l'appareil est vide (elle masque déjà « Mot de passe oublié ? » dans ce cas). | toutes | Majeur | captures/a1-connexion-b.png, captures/a1-connexion-b-erreur.png |
| A1-2 | Ergonomie | Le message « Aucun compte n'existe encore sur cet appareil » s'accompagne d'un encadré rouge sur les DEUX champs (identifiant et mot de passe), comme si la saisie était fausse, alors que le problème n'est pas la saisie. | 1440×900 | Mineur | captures/a1-connexion-b-erreur.png |
| A1-3 | Lisibilité / orthographe | Aide sous le champ Identifiant : « Adresse électronique ou prenom.nom » : « prénom » sans accent. | toutes | Cosmétique | captures/a1-connexion-b.png |
| A1-4 | Lisibilité | Note sous la carte : « Sans serveur, cette connexion sépare les espaces sur cet appareil ; elle ne remplace pas de vrais comptes en ligne. » Phrase technique (« sans serveur », « espaces ») qui inquiète plus qu'elle n'informe un pharmacien, en 12 px gris clair. | toutes | Mineur | captures/a1-connexion-b.png |
| A1-5 | Mise en page | Pied « Une question sans réponse ? Support Solvéa : 01 99 00 12 34 · » : à 1440×900 la ligne casse juste après le point médian, qui reste seul en fin de ligne, et l'adresse « support@solvea.example » passe seule à la ligne suivante. À 1280 la ligne tient. | 1440×900 | Cosmétique | captures/a1-connexion-b.png, captures/a1-connexion-p.png |
| A1-6 | Cohérence | La disposition change selon la largeur : à 1440 la carte est étroite et empilée (formulaire puis « Première visite ? »), à 1280 elle s'élargit sur deux colonnes (formulaire à gauche, options à droite). Le plus grand écran a donc la mise en page la plus étroite. | 1440 / 1280 | Cosmétique | captures/a1-connexion-b.png, captures/a1-connexion-p.png |
| A1-7 | Ergonomie | Le téléphone et l'adresse du support (pied) sont des liens de 20 px de haut seulement : cible trop petite au doigt. | 390×800 | Mineur | captures/a1-connexion-t-full.png |
| A1-8 | Cohérence | La page de connexion reste toujours en thème clair (les préférences d'apparence sont rangées par personne) : quelqu'un qui a choisi « Sombre » retrouve un écran blanc à chaque déconnexion. | toutes | Cosmétique | captures/a1-connexion-sombre.png |

Ce qui va bien : contraste du bouton principal correct (blanc sur bleu 18,87,192), bouton « Se connecter » grisé tant que les champs sont vides, œil d'affichage du mot de passe, pas de débordement au téléphone.

## A2. « Créer ma pharmacie » (assistant en trois étapes)

Identité : page de connexion, bouton « Créer ma pharmacie ». Étapes : 1 « Votre pharmacie », 2 « Votre équipe », 3 « Tout est prêt ? ».

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| A2-1 | Cohérence (vocabulaire) | Le même objet porte deux noms sur le même écran : bouton d'entrée « Créer ma pharmacie », surtitre « CRÉER MON OFFICINE · ÉTAPE 1 SUR 3 », titre « Votre pharmacie », champ « Nom de la pharmacie » puis « Surface de l'officine », accroche « Le planning de votre officine », bouton final « Créer mon officine ». | toutes | Mineur | captures/a2-e1-b-0.png, captures/a2-e3-b-0.png |
| A2-2 | Accord | Étape 3 et premier écran : une titulaire nommée Claire apparaît comme « Claire Martin · Titulaire principal · 42 h » (pastille du récapitulatif) puis « Titulaire principal · Pharmacie des Tilleuls » sous « Bonjour Claire ». Le masculin est imposé quelle que soit la personne. | toutes | Mineur | captures/a2-e3-b-0.png, captures/a2-cree-b.png |
| A2-3 | Lisibilité (hiérarchie des boutons) | Le bouton principal de chaque étape (« Continuer : l'équipe », « Continuer : vérification », « Créer mon officine ») est dessiné en dégradé bleu très pâle avec texte foncé, presque identique au bouton secondaire voisin (« J'ai déjà un compte », « Retour ») : l'action principale a l'air désactivée et ne se distingue pas. Sur la page de connexion, le bouton principal est au contraire bleu plein. | toutes | Mineur | captures/a2-e1-b-0.png, captures/a2-e2-b-0.png, captures/a2-e3-b-0.png |
| A2-4 | Adaptation | La barre de pied collante (texte, « Retour », « Continuer ») est semi-transparente : le contenu qui défile dessous reste lisible à travers (« La pharmacie ouvre le samedi », champs « Prénom / Nom » des pharmaciens, titre « Autres titulaires ») et se mêle au texte de la barre. | 1440×900, 1280×760 | Cosmétique | captures/a2-e1-b-0.png, captures/a2-e2-b-0.png, captures/a2-e1-p.png |
| A2-5 | Répétition | Étape 2 : sept groupes empilés (Autres titulaires, Pharmaciens, Préparateurs, Animateurs, Apprentis, Étudiants en pharmacie, Rayonnistes), dont cinq vides qui répètent chacun « Aucune ligne pour l'instant. » et un bouton « Ajouter un … ». Page de 2 345 px de haut à 1440×900 (4 écrans), environ 3 000 px au téléphone. | toutes | Mineur | captures/a2-e2-b-0.png, captures/a2-e2-b-1.png, captures/a2-e2-b-2.png, captures/a2-e2-t-full.png |
| A2-6 | Répétition | Chaque erreur s'affiche deux fois : dans l'encadré rouge du haut (« 4 points à corriger », liens) et sous chaque champ, mot pour mot (« Indiquez le prénom du titulaire. »…). À l'étape 2 cela produit 8 lignes rouges pour 4 erreurs. | toutes | Cosmétique | captures/a2-e1-b-erreur.png, captures/a2-e2-b-erreur-0.png |
| A2-7 | Ergonomie | Le champ « Surface de l'officine (facultatif) » affiche un exemple « 120 » dans le champ même, en gris moyen, qui ressemble à une valeur déjà saisie. | toutes | Mineur | captures/a2-e1-b-0.png |
| A2-8 | Cohérence | Aide de ce champ : « Vous pourrez la corriger dans « Réglages » ». Le libellé exact du menu titulaire est bien « Réglages », mais l'étape parle aussi de « Mon compte » pour l'apparence : deux renvois vers des endroits que l'utilisateur ne connaît pas encore, sans lien. | toutes | Cosmétique | captures/a2-e1-b-1.png |
| A2-9 | Lisibilité | Bloc « Le samedi » : sa phrase d'aide parle du dimanche (« Le dimanche est fermé par défaut ; les gardes se gèrent à part ») ; les blocs d'horaires portent une icône d'étincelles (« magie ») sans rapport avec des horaires. | toutes | Cosmétique | captures/a2-e1-b-1.png |
| A2-10 | Typographie | « Vous en changerez quand vous voulez dans « Mon compte » ; chacun… » : le guillemet fermant « » » passe seul en début de ligne (espace insécable manquante). | 1440×900, 1280×760 | Cosmétique | captures/a2-e1-b-1.png, captures/a2-e1-p-1.png |
| A2-11 | Ergonomie | Le récapitulatif (étape 3) ne rappelle pas l'identifiant de connexion choisi ; la promesse « Trois étapes, puis vos identifiants » de la page de connexion n'est pas tenue à cet endroit (les identifiants de l'équipe ne sont donnés qu'ensuite, dans les fiches Équipe). | toutes | Mineur | captures/a2-e3-b-0.png |
| A2-12 | Ergonomie | Au téléphone, l'assistant n'a plus de barre de pied collante : le bouton « Continuer » est tout en bas d'une page de 3 000 px (étape 2) ; la frise des étapes du haut se réduit à des pastilles numérotées sans nom. | 390×800 | Mineur | captures/a2-e2-t-full.png |
| A2-13 | Adaptation | Le titre-accroche du panneau de gauche « Le planning de votre officine, enfin serein. » (38 px) et le rappel « Vos données restent sur cet appareil… » restent affichés en permanence et prennent un tiers de l'écran à 1280×760 pendant les trois étapes. | 1280×760 | Cosmétique | captures/a2-e1-p.png |

Non jugé : les champs d'heure s'affichent « 08:30 AM / 07:30 PM » dans le navigateur de test ; c'est le rendu du champ natif de Chromium sans paramètres régionaux français du système, pas forcément ce que verra un utilisateur en France.

## A3. Première connexion et visite de bienvenue (Tour.tsx)

Identité : fin de l'assistant de création (bouton « Créer mon officine ») : le titulaire est connecté et la visite de bienvenue en 11 étapes démarre. Les membres de l'équipe n'ont pas de visite de bienvenue (voir A5).

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| A3-1 | Cohérence (libellé qui ment) | Étape 1 : « Vous pourrez le relancer à tout moment avec le bouton « Tutoriel », en haut de l'écran. » Il n'existe aucun bouton « Tutoriel » dans la barre du haut : on y voit « Créer », « Retard ou absence », la cloche, la bulle, un « ? » sans texte et le nom de la personne. | toutes | Majeur | captures/a2-cree-b.png |
| A3-2 | Cohérence (libellé qui ment) | Étape 6 « La grille » : « La ligne « Couverture » signale chaque jour où un pharmacien manque. » La ligne correspondante de la grille s'appelle « Équipe au complet ? » ; aucune ligne « Couverture ». | toutes | Mineur | captures/a2-tour-b-5.png, captures/a2-tour-t-5.png |
| A3-3 | Ergonomie | Dès la création, un message de confirmation noir s'affiche en même temps que la fiche de bienvenue : « L'échéance est passée : Solvéa a préparé décembre en brouillon d'après vos habitudes. Relisez, puis publiez le mois. » La pharmacie vient d'être créée : elle n'a ni habitudes ni échéance vécue. Le message reste par-dessus la visite (étapes 1 à 3). | 1440×900 | Majeur | captures/a2-cree-b.png, captures/a2-tour-b-1.png |
| A3-4 | Adaptation | Au téléphone ce même message se pose sur la barre d'onglets du bas (masque « Planning », « À décider », « Messages ») pendant la visite. | 390×800 | Mineur | captures/a2-tour-t-1.png |
| A3-5 | Lisibilité | Une pharmacie toute neuve affiche déjà « 2 décisions vous attendent », une pastille « 2 » sur Résoudre et « 3 » sur la cloche : bruit d'accueil pour quelqu'un qui n'a encore rien fait. | 1440×900 | Mineur | captures/a2-cree-b.png |
| A3-6 | Cohérence (vocabulaire) | La fiche s'intitule « TUTORIEL · Étape 1 sur 11 », l'aide parle de « visite guidée », la page de connexion de « Comment ça marche ? », la fenêtre de « Découvrir Solvéa » et de « visites », l'étape 2 de « Tableau de bord » alors que la barre du bas du téléphone dit « Accueil » pour le même écran. | toutes | Mineur | captures/a2-tour-b-1.png, captures/a2-tour-t-1.png |
| A3-7 | Adaptation | Étape 7 « Les contrôles » : la fiche recouvre le titre « Contrôles » de l'encadré qu'elle met en lumière. Étape 6 : la fiche recouvre la case « Préférences » et le haut de la grille éclairée. Étape 2 : l'anneau du projecteur autour de « Tableau de bord » mord sur « Mon planning ». | 1440×900 | Cosmétique | captures/a2-tour-b-1.png, captures/a2-tour-b-5.png, captures/a2-tour-b-6.png |
| A3-8 | Ergonomie | La visite annonce « Un tour d'une minute » mais compte 11 étapes qui changent quatre fois de page. | toutes | Cosmétique | captures/a2-cree-b.png |

## A4. Fenêtre « Découvrir Solvéa » (« Comment ça marche ? »)

Identité : page de connexion, bouton « Comment ça marche ? ». Cinq onglets : Parcours (4 visites), Autres métiers (3), Journées types (3), Écran par écran (3), Entrer librement (7 profils).

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| A4-1 | Adaptation (stabilité) | La fenêtre est centrée verticalement et sa hauteur dépend du contenu : en passant d'une visite à l'autre ou d'un onglet à l'autre, tout saute. À 1440×900 la rangée d'onglets est à 227 px du haut sur « Complet », à 268 px sur « Pharmacien », à 403 px sur « Entrer librement » : les onglets fuient sous la souris. | 1440×900, 1280×760 | Mineur | captures/a3-b-dc-onglet-parcours.png, captures/a3-b-dc-onglet-parcours-2.png, captures/a3-b-dc-onglet-libre.png |
| A4-2 | Cohérence | La visite « Parcours pharmacien » suit « Léa, pharmacienne », mais l'onglet « Entrer librement » propose comme pharmacien « Igor » ; Léa n'y figure pas. On ne peut pas entrer dans le profil de la personne que la visite montre. | 1440×900 | Mineur | captures/a3-b-dc-onglet-parcours-2.png, captures/a3-b-dc-onglet-libre.png |
| A4-3 | Répétition | Les visites Pharmacien, Préparateur et Animatrice ont exactement les mêmes quatre chapitres (« Mon planning », « Mes demandes », « L'équipe et moi », « Mon espace »), la même durée (9 min) et presque le même nombre d'étapes (17 ou 18) : rien n'indique ce qui les distingue. | 1440×900 | Mineur | captures/a3-b-dc-onglet-parcours-2.png, captures/a3-b-dc-onglet-parcours-3.png, captures/a3-b-dc-onglet-metiers.png |
| A4-4 | Cohérence | Onglet « Entrer librement » : son titre commence par « Ou entrer librement, en testeur », un « Ou » qui n'a plus de sens dans un onglet à part ; « testeur » est un mot d'informaticien. | toutes | Cosmétique | captures/a3-b-dc-onglet-libre.png |
| A4-5 | Cohérence | Pastilles d'initiales des profils : deux lettres pour Caroline (CT), Pierre (PF), Sarah (SL)…, trois lettres pour Igor (ILR) et Nicolas (NLS). | toutes | Cosmétique | captures/a3-b-dc-onglet-libre.png |
| A4-6 | Adaptation | Au téléphone, la rangée d'onglets et la rangée des visites défilent de côté sans aucun indice : seuls « Parcours » et « Autres métiers » sont visibles, la troisième pastille est coupée (« Phar… »). Il faut deviner qu'il y a « Journées types », « Écran par écran » et « Entrer librement » à droite. | 390×800 | Majeur | captures/a3-t-dc-onglet-parcours.png |
| A4-7 | Lisibilité | Au téléphone, onglet « Entrer librement » : les rôles sont coupés net sans points de suspension (« Titulaire principa », « Titulaire secondai »). | 390×800 | Mineur | captures/a3-t-dc-onglet-libre.png |
| A4-8 | Ergonomie | Au téléphone, le bouton « Lancer la visite » n'est visible qu'après avoir fait défiler la fenêtre (huit chapitres avant lui) ; la fenêtre défile à l'intérieur d'un écran qui défile aussi. | 390×800 | Mineur | captures/a3-t-dc-onglet-parcours.png, captures/a3-t-dc-onglet-parcours-bas.png |
| A4-9 | Lisibilité | Étiquette « PARCOURS COMPLET · 1 SUR 4 » en 11,5 px capitales espacées ; « 1 sur 4 » répète l'information des pastilles juste au-dessus. | toutes | Cosmétique | captures/a3-b-dc-onglet-parcours.png |
| A4-10 | Ergonomie | La visite « Complet » dure 49 minutes (97 étapes) et c'est celle qui est proposée d'office à l'ouverture. | toutes | Mineur | captures/a3-b-dc-onglet-parcours.png |
| A4-11 | Cohérence | Dans l'onglet Parcours, la visite se nomme « Préparateur » (pastille), « Parcours préparateur » (étiquette), « Mon espace de préparateur » (titre) ; dans Autres métiers : « Animateur ou animatrice » (pastille), « Autre métier » (étiquette), « Mon espace d'animatrice » (titre). Trois noms pour une visite. | toutes | Cosmétique | captures/a3-b-dc-onglet-parcours-3.png, captures/a3-b-dc-onglet-metiers.png |

Ce qui va bien : fenêtre lisible à 1280×760 sans défilement, chapitres cliquables pour démarrer au bon endroit, choix du rythme visible, fermeture par la croix, Échap ou clic à côté.

## A5. Visites guidées lancées depuis « Découvrir Solvéa » (annonce, fiche, sommaire, « i », démonstration)

Identité : « Comment ça marche ? », une visite par famille : Parcours préparateur, Autre métier apprentie, Journée sous tension, Écran par écran « L'espace de l'équipe ». Lancement réel (PLIE=1).

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| A5-1 | Répétition | Écran d'annonce de chapitre : la même idée est dite trois fois en haut de la fenêtre (surtitre « MON ESPACE DE PRÉPARATEUR · CHAPITRE 1 SUR 4 », phrase de visite « Tout ce que voit Nicolas, préparateur : son planning… », phrase de chapitre « Votre accueil, votre prochain poste… »), puis le sommaire des 4 chapitres que l'utilisateur vient de voir dans « Découvrir Solvéa ». | 1440×900 | Mineur | captures/a4-equipe-b-0-annonce.png |
| A5-2 | Répétition | Fiche de visite : le nom du chapitre apparaît deux fois de suite (bouton de sommaire « Mon planning » puis sous-titre « Accueil »), puis le titre de l'étape « Mon accueil » : trois intitulés empilés pour une seule étape. | 1440×900 | Mineur | captures/a4-equipe-b-1-etape.png |
| A5-3 | Adaptation | La fiche de visite (420×370 px environ) se pose en bas à gauche ou en bas à droite selon l'étape ; elle cache alors une partie de la page qu'elle commente (à l'étape « Mon accueil », la carte « Mes compétences et mes postes » ; dans « Écran par écran », le bloc « Prochain poste »). | 1440×900, 1280×760 | Mineur | captures/a4-equipe-b-1-etape.png, captures/a4-ecrans-b-1-etape.png |
| A5-4 | Adaptation | Au téléphone, la fiche occupe la moitié basse de l'écran (358×424 px, 549 px dans « Écran par écran ») et recouvre la barre d'onglets du bas ; la page commentée n'est visible que sur 250 px. Pendant une démonstration, le geste de Solvi se joue en partie sous la fiche. | 390×800 | Majeur | captures/a4-ecrans-t-1-etape.png, captures/a4-ecrans-t-4-demo-a.png, captures/a4-equipe-t-5-suite1.png |
| A5-5 | Ergonomie | Bouton « i » (« Comment se passe une démonstration ») : à la première étape, l'encadré « Démonstration en 5 gestes. Solvi le fait à l'écran, vous regardez » est déjà ouvert d'office, et un clic sur « i » ne le referme pas (capture prise après le clic : encadré toujours affiché, « i » allumé). Le bouton semble sans effet. | 1440×900 | Mineur | captures/a4-ecrans-b-1-etape.png, captures/a4-ecrans-b-2-info.png |
| A5-6 | Ergonomie | Trois boutons en pied de fiche pour avancer : « Passer » (texte gris), « Voir la démonstration » (bleu) et, une fois la démonstration vue, « Étape suivante » ; « Passer » saute la démonstration ET l'étape, sans le dire autrement que par une infobulle. | toutes | Mineur | captures/a4-ecrans-b-1-etape.png |
| A5-7 | Cohérence (vocabulaire) | La même chose s'appelle « visite » (Découvrir), « parcours » (étiquette « Parcours préparateur », bouton de fermeture « Quitter le parcours guidé »), « tutoriel » (fiche de l'aide « Voir le tutoriel »), « démonstration » (bouton). | toutes | Mineur | captures/a4-equipe-b-0-annonce.png, captures/a4-equipe-b-1-etape.png |
| A5-8 | Lisibilité | Le choix du rythme (« Posé / Normal / Vif ») est répété dans la fenêtre « Découvrir Solvéa », dans l'écran d'annonce et à chaque étape de la fiche, où il prend une ligne entière. | toutes | Cosmétique | captures/a4-equipe-b-1-etape.png |
| A5-9 | Cohérence | La visite « Parcours préparateur » se fait « dans la peau de Nicolas » ; la visite pharmacien se fait avec Léa, alors que le profil pharmacien de test est Igor (voir A4-2). | 1440×900 | Cosmétique | captures/a4-equipe-b-0-annonce.png |

Ce qui va bien : le sommaire s'ouvre depuis le nom du chapitre, la progression par segments est visible, la démonstration montre réellement le geste (pointeur, clic) à l'écran.

## A6. Première connexion d'un membre de l'équipe

Identité : pharmacie neuve créée par Claire (titulaire), avec un préparateur « Paul Durand » ; déconnexion, puis connexion de Paul avec son identifiant `paul.durand` et son mot de passe provisoire. Puis Nicolas dans la pharmacie d'exemple.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| A6-1 | Ergonomie | Aucun accueil de première connexion pour un membre de l'équipe : ni visite de bienvenue (elle n'est lancée que pour un titulaire), ni invitation à remplacer le mot de passe provisoire. Paul arrive directement sur « Bonjour Paul ». Le seul signal est une pastille « Mot de passe provisoire » tout en bas de « Mon compte ». | 1440×900 | Majeur | captures/a5-neuve-b-arrivee.png, captures/a5-neuve-b-compte.png |
| A6-2 | État vide | Pharmacie sans planning publié : l'accueil de Paul n'explique pas pourquoi il n'a aucun poste (pas de phrase du type « votre titulaire n'a pas encore publié de planning ») ; « Mon planning », « Planning de l'équipe » et « Mes documents » affichent chacun leur propre formulation d'absence. | 1440×900 | Mineur | captures/a5-neuve-b-arrivee.png, captures/a5-neuve-b-moi.png, captures/a5-neuve-b-planning.png, captures/a5-neuve-b-documents.png |
| A6-3 | Cohérence | Dans la pharmacie d'exemple, le mot de passe de tous les profils est « demo » (4 caractères) alors que l'application exige au moins 6 caractères partout ailleurs. | sans objet | Cosmétique | (données : `personnes[].provisoire = "demo"`) |


---

# Partie B. Les pages de l'équipe

Profil de référence : Nicolas (préparateur, role 3), pharmacie d'exemple « Grande Pharmacie de la Pinède », vendredi 20 novembre 2026, 10 h. Les différences des autres profils sont à la fin de chaque section ou en B12.

## B0. Cadre commun : barre du haut et menu latéral (vus sur toutes les pages)

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B0-1 | Adaptation | Barre du haut : le nom de la pharmacie commence 52 px SOUS l'étiquette « Espace préparateur » (nom de 460 à 587 px, étiquette jusqu'à 512 px) : on lit « )harmacie … », le début est masqué et la fin coupée. À 1280×760 c'est la date qui passe dessous (« ) novembre »). | 1440×900, 1280×760 | Mineur | captures/b4-r3-b-barre.png, captures/b1-r3-moi-b-0.png, captures/b1-r3-espace-p-0.png |
| B0-2 | Répétition | Bouton « Faire une demande » présent deux fois à l'écran sur « Mon planning » (barre du haut et en-tête de page, côte à côte à 1440) ; « Retard ou absence » (barre du haut) et « Prévenir d'un retard » (carte Prochain poste) ouvrent deux fenêtres différentes pour la même chose (voir B9). | toutes | Mineur | captures/b1-r3-moi-b-0.png |
| B0-3 | Répétition | Deux entrées vers l'aide toujours visibles en même temps : l'icône « ? » de la barre du haut et le bloc « Besoin d'aide ? Aide, tutoriels et lexique » du menu ; plus Solvi « Aide » en bas à droite : trois portes pour l'aide sur le même écran. | 1440×900 | Mineur | captures/b1-r3-espace-b-0.png |
| B0-4 | Cohérence | Messages : une pastille « 1 » sur l'entrée de menu « Messages » ET sur l'icône bulle de la barre du haut ; la cloche affiche aussi « 1 » pour autre chose (« Collègue qui cherche un remplaçant »). Deux compteurs identiques côte à côte pour des sujets différents. | 1440×900 | Mineur | captures/b4-r3-b-cloche.png |
| B0-5 | Cohérence | Menu du compte : « Apparence » propose 3 choix (Clair, Mixte, Sombre) ; la page « Mon compte » en propose 4 (avec « Comme l'appareil »). Le menu a aussi « Paramètres », qui ouvre la même page que « Mon compte » (descendue à l'apparence). Deux entrées pour une seule page. | 1440×900 | Mineur | captures/b4-r3-b-menu-compte.png, captures/b1-r3-compte-b-1.png |
| B0-6 | Lisibilité | Surtitres de page et intertitres en capitales 11 à 11,5 px (« MON PLANNING », « PROCHAIN POSTE », « MON MÉTIER », date de l'accueil en 11 px) : en dessous du seuil de 12 px. | toutes | Mineur | captures/b1-r3-espace-b-0.png |
| B0-7 | Ergonomie | Pied de chaque page : « Une question sans réponse ? Support Solvéa : 01 99 00 12 34 · support@solvea.example », répété sur toutes les pages ; liens de 20 px de haut. | toutes | Cosmétique | captures/b1-r3-moi-b-1.png |

## B1. Accueil (Nicolas)

Identité : menu « Accueil » (premier écran après connexion). Titre « Bonjour Nicolas » sans surtitre de page.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B1-1 | Cohérence | Seule page sans surtitre ni titre de page « Accueil » : la bannière dit « Bonjour Nicolas » puis, sous la bannière, une phrase orpheline grise « Vos horaires, vos compétences et vos demandes. » qui flotte entre deux cartes. | toutes | Cosmétique | captures/b1-r3-espace-b-0.png |
| B1-2 | Répétition | Le prochain poste apparaît deux fois sur l'accueil : carte « PROCHAIN POSTE » (« Aujourd'hui · soir 11 h 30 – 19 h 30 », « Ensuite : Demain, 9 h – 19 h ») et, juste dessous, liste « MES PROCHAINS POSTES » (« Vendredi 20 novembre 11 h 30 – 19 h 30 », « Samedi 21 novembre 9 h – 19 h »…). La même carte « Prochain poste » est encore en tête de « Mon planning ». | toutes | Mineur | captures/b1-r3-espace-b-0.png, captures/b1-r3-moi-b-0.png |
| B1-3 | Cohérence | La carte « Mes compétences et mes postes » porte le surtitre « MON MÉTIER » mais contient surtout les prochains postes, qui ne relèvent pas du métier. | toutes | Mineur | captures/b1-r3-espace-b-0.png |
| B1-4 | Répétition | « Mes raccourcis » répète des entrées déjà présentes à l'écran : « Voir mon planning » (menu), « Demander une absence ou un horaire » (bouton « Faire une demande » de la barre), « Écrire à Caroline T. » (Messages). | toutes | Mineur | captures/b1-r3-espace-t-3.png |
| B1-5 | Lisibilité | Pictogramme de lever ou coucher de soleil collé au prénom dans « Bonjour Nicolas » : c'est le symbole du type de poste du jour (soir), sans légende ; il se lit comme une décoration. | toutes | Cosmétique | captures/b1-r3-espace-b-0.png |
| B1-6 | Adaptation | Au téléphone la bannière d'accueil passe à 430 px de haut : la date en capitales se casse en trois lignes (« VENDREDI / 20 NOVEMBRE / 2026 »), « Bonjour / Nicolas » sur deux lignes, et « Espace préparateur · Grande Pharmacie de la Pinède » s'empile sur 8 lignes d'un ou deux mots (« de », « la »). Le prochain poste n'apparaît qu'en bas du premier écran. | 390×800 | Majeur | captures/b1-r3-espace-t-0.png |
| B1-7 | Adaptation | Au téléphone, Solvi (bulle flottante 60 px) recouvre la fin des lignes de la carte Prochain poste (« pause déjeuner 14 h – 15 h · ») et le bouton « Parler d'une formation » est frôlé. | 390×800 | Mineur | captures/b1-r3-espace-t-0.png, captures/b1-r3-espace-t-1.png |
| B1-8 | Lisibilité des données | Heures alignées à droite dans « MES PROCHAINS POSTES » avec chiffres espacés « 1 1 h 30 – 1 9 h 30 » (chasse fixe qui sépare les deux « 1 ») ; même effet dans « Me faire remplacer » et « Mes demandes ». | toutes | Cosmétique | captures/b4-r3-b-menu-compte.png, captures/b1-r3-espace-t-1.png |
| B1-9 | Ergonomie | « Demander un rendez-vous » est un bouton plein bleu foncé, du même poids que « Faire une demande » de la barre du haut, alors que la page contient déjà « Prévenir d'un retard » et « Parler d'une formation » en boutons de couleurs différentes (jaune, lilas) : quatre styles de boutons sur un même écran sans logique apparente. | 1440×900 | Cosmétique | captures/b1-r3-espace-b-0.png |

## B2. Mon planning (Nicolas)

Identité : menu « Mon planning ». Surtitre « MON PLANNING », titre « Quand est-ce que je travaille ? ».

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B2-1 | Répétition | En-tête : trois boutons « Faire une demande », « Imprimer », « Planning de l'équipe » ; le premier double celui de la barre du haut, le troisième double l'entrée de menu juste à gauche. | 1440×900 | Mineur | captures/b1-r3-moi-b-0.png |
| B2-2 | Lisibilité | Les cartes de jour sont denses : dans une colonne de 165 px on lit le type (« Journée »), l'horaire, « 7 h de travail », « Pause déjeuner 12 h 30 – 13 h 30 », « Pauses courtes à 10 h 30, 15 h (15 min) » et une frise. Les lignes cassent au milieu des heures (« Pause déjeuner 14 h – / 15 h », « (15 min) » seul). | 1440×900, 1280×760 | Mineur | captures/b1-r3-moi-b-0.png, captures/b1-r3-moi-p-0.png |
| B2-3 | Lisibilité des données | Deux écritures des heures dans l'application : « 8 h 30 – 16 h 30 » ici, « 08:30–16:30 » dans « Planning de l'équipe » (voir B6-2). | toutes | Mineur | captures/b1-r3-moi-b-0.png, captures/b1-r3-planning-b-0.png |
| B2-4 | Lisibilité | Les jours passés de la semaine (lundi 16 au jeudi 19) ont exactement le même aspect que les jours à venir ; seul « Aujourd'hui » est encadré. | toutes | Mineur | captures/b1-r3-moi-b-0.png |
| B2-5 | Lisibilité | Les noms de mois sous chaque numéro de jour (« novembre ») sont soulignés comme des liens ; c'est toute la carte qui est cliquable (« voir la journée »), rien ne l'indique autrement. | toutes | Cosmétique | captures/b1-r3-moi-b-0.png |
| B2-6 | Adaptation | À 1280×760, la carte Prochain poste met « Prévenir d'un retard » sous l'horaire, séparé par un trait qui s'arrête au milieu de la carte ; à 1440 il est à droite. Au téléphone « Calendrier » est coupé sous Solvi (« Cale… »). | 1280×760, 390×800 | Cosmétique | captures/b1-r3-moi-p-0.png, captures/b1-r3-moi-t-0.png |
| B2-7 | Adaptation | Au téléphone : page de 3 073 px (6 écrans) ; chaque jour devient une carte pleine largeur ; le titre « Mes semaines » se casse en deux lignes à côté des boutons Semaine / Calendrier. | 390×800 | Mineur | captures/b1-r3-moi-t-0.png, captures/b1-r3-moi-t-2.png |
| B2-8 | Lisibilité des données | Vue « Calendrier » (« Mon calendrier ») : en-têtes de jours en capitales « LUNDI … DIMANCHE », alors que la vue Semaine écrit « Lundi » ; les horaires sont sur deux lignes sans tiret (« 8 h 30 » / « 16 h 30 ») ; le bouton « Aujourd'hui » est pâle comme désactivé. | 1440×900 | Cosmétique | captures/b4-r3-b-moi-calendrier-0.png |
| B2-9 | Cohérence | Fenêtre de la journée (clic sur un jour) : sur un jour où Nicolas est au repos (lundi 16), elle montre la journée de l'équipe sans rappeler que lui ne travaille pas ; titre « Lundi 16 novembre 2026 / Ouverture : 8 h 30 – 19 h 30 · 7 postes ». Boutons « Veille / Lendemain / Fermer » corrects, focus sur « Veille » à l'ouverture. | 1440×900 | Mineur | captures/b4-r3-b-moi-journee.png |
| B2-10 | Ergonomie | Impression : l'aperçu s'ouvre sur « Mes postes » (1 ligne : Nicolas) ; la légende des couleurs du bas de la feuille et la mention « Solvéa · page 1 sur 1 » sont en 6 à 7 px dans l'aperçu ; bouton « Imprimer » encadré deux fois (focus + bordure). | 1440×900 | Cosmétique | captures/b4-r3-b-moi-imprimer.png |
| B2-11 | Cohérence | En thème sombre, les cartes de jour de « Mon planning » sont teintées sombre, alors que les mêmes postes dans « Planning de l'équipe » restent en aplats pastel clairs (voir B6-8) : deux rendus du même objet. | 1440×900 sombre | Cosmétique | captures/b1-r3-sombre-moi-b-0.png, captures/b1-r3-sombre-planning-b-0.png |

## B3. Mes demandes (Nicolas) : les trois cartes

Identité : menu « Mes demandes ». Surtitre « MON ESPACE », titre « Mes demandes », phrase « Choisissez ce que vous voulez faire. ». Trois cartes-onglets : « Mes préférences », « Absence ou horaire », « Me faire remplacer ».

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B3-1 | Cohérence | Surtitre « MON ESPACE » alors que les autres pages de la même rubrique ont un surtitre propre (« MON PLANNING », « MON SUIVI ») ; « Mes documents » reprend aussi « MON ESPACE ». Trois règles de surtitre dans la même rubrique. | toutes | Cosmétique | captures/b1-r3-demandes-b-0.png, captures/b1-r3-documents-b-0.png |
| B3-2 | Ergonomie (état à l'ouverture) | Avec les accordéons et onglets dans leur état réel, la page s'ouvre sur l'onglet « Absence ou horaire » (carte du milieu encadrée), pas sur la première carte. Le crawl sans PLIE montre au contraire tout ouvert. Rien n'indique que les trois cartes sont des onglets : elles ressemblent à des tuiles d'information (pastilles « Dernier jour », « 1 en attente », « Aucune », ligne « Votre titulaire répond »). Seule une petite flèche sous la carte active relie la carte au panneau. | 1440×900 | Majeur | captures/b1-r3-demandes-b-0.png, captures/b2-r3-b-pref-0.png |
| B3-3 | Lisibilité | Pastille « Dernier jour » sur la carte « Mes préférences » sans dire de quoi (dernier jour pour remplir décembre). La même pastille est répétée dans le panneau à côté de « Décembre 2026 ». Pour Igor, Sarah et Yanis la même pastille dit « À remplir aujourd'hui » : deux libellés pour la même échéance selon le profil. | toutes | Mineur | captures/b2-r3-b-pref-0.png |
| B3-4 | Lisibilité | Lignes de pied des cartes (« Pas de réponse à attendre », « Votre titulaire répond », « Titulaire, puis un collègue volontaire ») précédées d'une même icône de bulle : on les prend pour des liens. | toutes | Cosmétique | captures/b1-r3-demandes-b-0.png |
| B3-5 | Adaptation | Le panneau sous les cartes n'occupe que les deux tiers de la largeur (jusqu'à 1 056 px) : la colonne de droite reste vide sur l'onglet « Absence ou horaire » et « Me faire remplacer ». | 1440×900 | Cosmétique | captures/b1-r3-demandes-b-0.png, captures/b2-r3-b-rempl-0.png |
| B3-6 | Adaptation | Au téléphone, les trois cartes s'empilent (380 px de haut à elles trois) : le contenu de l'onglet choisi commence sous le premier écran ; on touche une carte et rien ne bouge à l'écran. | 390×800 | Majeur | captures/b2-r3-t-pref-0.png, captures/b2-r3-t-pref-1.png |

### B3a. Onglet « Mes préférences »

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B3a-1 | Lisibilité | Les cases du samedi affichent « Après-… » (texte coupé) ; au téléphone toutes les cases perdent leur libellé et ne gardent qu'un pictogramme (soleil, coucher de soleil, parasol) à deviner. | 1440×900, 390×800 | Mineur | captures/b2-r3-b-pref-0.png, captures/b2-r3-t-pref-1.png |
| B3a-2 | Lisibilité | Au téléphone, le point orange « l'équipe annoncée ne suffit pas » des 9 et 24 décembre se superpose au numéro du jour (« 9● », « 2● »). | 390×800 | Mineur | captures/b2-r3-t-pref-1.png |
| B3a-3 | Ergonomie | « M'assister » est grisé (désactivé) sans explication visible ; l'encadré « Comment faire » dit pourtant « M'assister remplit le reste d'après vos habitudes ». Le mois est déjà rempli à 26 jours sur 26, d'où le grisé, mais l'écran ne le dit pas. | 1440×900 | Mineur | captures/b2-r3-b-pref-0.png |
| B3a-4 | Ergonomie | Toucher un jour enregistre immédiatement (« Choix enregistré » en vert près du titre, discret) ; aucune annulation proposée ; le panneau de droite se remplace par « LE JOUR CHOISI » et l'encadré « Comment faire » disparaît. | 1440×900 | Mineur | captures/b2-r3-b-pref-apres-clic.png |
| B3a-5 | Cohérence | « L'ÉQUIPE · 7 sur 11 ont répondu » puis « Jusqu'au ven. 20 novembre inclus : c'est bientôt » : on est le 20 novembre, c'est aujourd'hui, pas « bientôt ». | toutes | Mineur | captures/b2-r3-b-pref-0.png, captures/b2-r3-t-pref-2.png |
| B3a-6 | Lisibilité | Panneau « LE JOUR CHOISI » : effectifs « 5/3 », « 4/3 » sans unité ni légende (présents sur besoin) ; à côté, initiales en pastilles puis la même liste en noms complets juste dessous (« LF NL TN JP MG » puis « Léa F., Nicolas L., Thomas N., Jules P., Manon G. »). | 1440×900 | Mineur | captures/b2-r3-b-pref-apres-clic.png |
| B3a-7 | Adaptation | À 1440, Solvi et sa bulle « Aide » recouvrent le texte de la carte « L'ÉQUIPE » (« c'est bientôt »). | 1440×900 | Mineur | captures/b2-r3-b-pref-apres-clic.png |

### B3b. Onglet « Absence ou horaire »

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B3b-1 | Hiérarchie | Le panneau commence par « Absences de l'équipe » (frise des 10 prochaines semaines, une seule ligne : Igor) avant « Mes demandes d'absence et d'horaire » : les demandes de Nicolas, objet de l'onglet, passent au second plan. | 1440×900 | Mineur | captures/b1-r3-demandes-b-0.png |
| B3b-2 | Lisibilité des données | Frise « Absences de l'équipe » : barre grise uniforme avec deux hachures non expliquées (semaines 21 et 28 décembre) et un rectangle plus clair au début ; aucune légende. Phrase du bas « 10 personnes sans absence prévue sur la période » en 12 px gris. | 1440×900 | Mineur | captures/b1-r3-demandes-b-0.png |
| B3b-3 | Cohérence | Deux pastilles d'état différentes pour deux demandes dans la même liste : « En attente » (orange) pour le congé, « Préférence prioritaire » (lilas) pour l'horaire accepté, placée là où l'on attend l'état. Le fil d'étapes (« Envoyée, Réponse du titulaire, Au planning ») donne déjà l'état. | 1440×900 | Mineur | captures/b1-r3-demandes-b-1.png |
| B3b-4 | Typographie | Titre de demande « Finir avant 17 h - mercredi (une semaine sur deux) » avec un trait d'union entouré d'espaces en guise de tiret. | toutes | Cosmétique | captures/b1-r3-demandes-b-1.png |
| B3b-5 | Cohérence | Libellé « Envoyée » dans le fil d'étapes, mais toast après envoi « Demande envoyée au responsable » et bouton « Envoyer au responsable » : ailleurs on dit « votre titulaire » (« Votre titulaire répond », « Votre titulaire n'a pas encore répondu »). Deux noms pour la même personne. | toutes | Mineur | captures/b2-r3-b-nd-envoye.png |

### B3c. Fenêtre « Nouvelle demande »

Identité : bouton « Nouvelle demande » (onglet Absence ou horaire) ou « Faire une demande » (barre du haut).

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B3c-1 | Hiérarchie | L'ordre des champs est inversé : on demande la « Raison de la demande » (obligatoire) et des « Besoins courants » (raccourcis) AVANT le « Type de besoin » qui détermine tout le reste du formulaire. Le focus initial est sur « Type de besoin », au milieu de la fenêtre. | 1440×900 | Majeur | captures/b2-r3-b-nd-0.png |
| B3c-2 | Lisibilité / cohérence | Rangée « Besoins courants (facultatif) » : « Chabbat », « Prière du vendredi », « Office du dimanche », « Rupture du jeûne », « Sortie d'école », « Mercredi », « Cours du soir ». Ces boutons apparaissent en premier, en tête de chaque demande, alors que la page affirme « Aucune information de santé, de religion ou de vie privée n'est demandée » (création) et « rien à justifier ». Le message « Le raccourci choisi n'est pas enregistré » est en 12 px gris. | 1440×900 | Majeur | captures/b2-r3-b-nd-0.png, captures/b2-r3-b-nd-raccourci.png |
| B3c-3 | Répétition | Trois phrases d'explication sur la confidentialité dans la même fenêtre : sous-titre « seuls vos titulaires la voient », note sous les raccourcis, note sous la raison (« Seuls vos titulaires la voient ; vos collègues ne voient que vos horaires »). | 1440×900 | Mineur | captures/b2-r3-b-nd-0.png |
| B3c-4 | Ergonomie | Le bouton « Envoyer au responsable » reste grisé tant qu'aucune raison n'est choisie, sans message qui dise ce qui manque. | toutes | Mineur | captures/b2-r3-b-nd-0.png, captures/b2-r3-b-nd-1-bas.png |
| B3c-5 | Lisibilité des données | Champs de date au format « mm/dd/yyyy » (« 11/20/2026 ») dans le navigateur de test ; ailleurs l'application écrit « 20 novembre 2026 ». (Rendu natif du navigateur, à vérifier sur un poste français.) | 1440×900 | Mineur | captures/b2-r3-b-nd-1-bas.png, captures/b2-r3-b-nd-type-absence.png |
| B3c-6 | Lisibilité | « Demandes prioritaires actives : 1 / 2 » puis « Le même plafond s'applique à toute l'équipe. » : chiffres sans explication de ce qu'est une demande prioritaire à cet endroit ; le choix s'appelle « Importance » avec « Simple préférence ». | 1440×900 | Mineur | captures/b2-r3-b-nd-1-bas.png |
| B3c-7 | Adaptation | La fenêtre fait 820 px de haut à 1440×900 et défile à l'intérieur (832 px de contenu pour 636 visibles) ; au téléphone 1 352 px de contenu pour 543 visibles, avec un en-tête violet qui garde 110 px et deux gros boutons empilés en pied (130 px). | 1440×900, 390×800 | Mineur | captures/b2-r3-b-nd-0.png, captures/b2-r3-t-nd-0.png |
| B3c-8 | Cohérence | Type « Une absence de plusieurs jours » : la fenêtre change de hauteur (813 px au lieu de 820) et se recentre ; « Nature » (Congé…) s'ajoute à « Raison de la demande » : deux notions proches (nature, raison) pour une même absence. | 1440×900 | Mineur | captures/b2-r3-b-nd-type-absence.png |
| B3c-9 | Ergonomie | Après envoi, toast « Demande envoyée au responsable. Annuler » : il reste 5 à 9 s, centré en bas, et masque la carte de demande à laquelle il se rapporte. | 1440×900 | Mineur | captures/b2-r3-b-nd-envoye.png |

### B3d. Onglet et fenêtre « Me faire remplacer »

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B3d-1 | Cohérence | Le même geste a deux libellés de bouton selon la date : « Demande urgente » (gris lilas, 6 lignes) et « Me faire remplacer » (bleu plein, 2 lignes). Le bouton le plus fréquent (urgent) a l'air secondaire. | 1440×900 | Mineur | captures/b2-r3-b-rempl-0.png, captures/b2-r3-b-rempl-1.png |
| B3d-2 | Cohérence (libellé qui ment) | Bandeau de l'onglet : « Dans moins de 7 jours : demande urgente. Seul un collègue volontaire peut reprendre le poste. » Dans la fenêtre d'un poste urgent, le choix « Urgent » dit pourtant « votre titulaire répond d'abord, puis prévient l'équipe », et « Urgence médicale » « Traitée en premier ». Pour le 27 novembre (« Dans 7 jours »), la fenêtre dit « Poste dans 7 jours. Plus de 7 jours : vos collègues sont prévenus dans les règles. » : 7 jours n'est pas « plus de 7 jours ». | 1440×900 | Mineur | captures/b3-r3-b-rempl-urgent.png, captures/b3-r3-b-rempl-normal-bas.png |
| B3d-3 | Ergonomie | Fenêtre « Me faire remplacer » : le choix « À qui demander ? » affiche « Toute l'équipe » en surbrillance, puis des collègues avec « Possible » ; on ne voit pas si ces cartes sont cliquables ni ce qui est choisi. Idem pour « Niveau d'urgence » (Prévu surligné). Pas de bouton radio visible. | 1440×900 | Mineur | captures/b3-r3-b-rempl-urgent.png, captures/b3-r3-b-rempl-normal-bas.png |
| B3d-4 | Lisibilité des données | « 28 h → 35 h cette semaine-là, pour un contrat de 28 h » : flèche entre deux totaux, sans dire que le remplacement ajoute 7 h ni que c'est au-dessus du contrat. | 1440×900 | Mineur | captures/b3-r3-b-rempl-urgent.png |
| B3d-5 | Cohérence | Le motif se choisit dans une liste différente de celle de « Nouvelle demande » : ici « Raison de santé, Obligation familiale, Rendez-vous administratif, Formation ou examen, Problème de transport, Autre raison » ; là « Congés, repos ; Famille, garde d'enfant ; Santé, rendez-vous médical ; Études, formation ; Démarche administrative ; Raison personnelle » ; et « Prévenir d'un retard » propose « Transport, Santé, Famille, Autre raison ». Trois listes pour la même notion. | toutes | Mineur | captures/b3-r3-b-rempl-urgent.png, captures/b2-r3-b-nd-0.png, captures/b3-r3-b-prevenir.png |
| B3d-6 | Ergonomie | Le bouton « Envoyer la demande » est grisé tant que le motif n'est pas choisi ; l'infobulle « Indiquez le motif de votre demande » n'apparaît qu'au survol (invisible au doigt). | toutes | Mineur | captures/b3-r3-b-rempl-urgent.png |
| B3d-7 | Lisibilité | Phrase finale « Tant que votre titulaire n'a pas validé un remplaçant, le poste reste le vôtre. » en 12 px gris, alors que c'est l'information la plus importante pour le demandeur. | 1440×900 | Mineur | captures/b3-r3-b-rempl-normal-bas.png |

## B4. Mon suivi (Nicolas)

Identité : menu « Mon suivi ». Surtitre « MON SUIVI », titre « Où j'en suis ».

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B4-1 | Répétition | Une carte de la page « Mon suivi » s'appelle elle aussi « Mon suivi » (menu, surtitre et carte portent le même nom ; le titre de page en porte un autre : « Où j'en suis »). | toutes | Mineur | captures/b1-r3-suivi-b-0.png |
| B4-2 | Répétition | « Vous ne voyez que votre position : il n'existe aucun classement » est écrit deux fois (sous le titre et en bas de « Ma part des contraintes »). | 1440×900 | Cosmétique | captures/b1-r3-suivi-b-0.png, captures/b1-r3-suivi-b-1.png |
| B4-3 | Lisibilité des données | « Mon compteur d'heures » affiche « -8 h » dans une pastille orange (couleur d'alerte) sans dire si c'est un dû ou un manque, ni sur quelle période (« sur les semaines publiées »). | toutes | Mineur | captures/b1-r3-suivi-b-0.png |
| B4-4 | Lisibilité | Sept tuiles de compteurs à 0 (« Retards 0 », « Départs anticipés 0 », « Absences non prévues 0 », « Congés 0 j », « Arrêts 0 j », « Formations 0 j », « Remplacements assurés 0 ») : beaucoup de place pour aucune information ; la septième tuile reste seule sur sa ligne. | toutes | Mineur | captures/b1-r3-suivi-b-0.png |
| B4-5 | Cohérence | « Congés 0 j » alors que Nicolas a un congé de 5 jours en attente (30 novembre au 4 décembre), affiché dans « Mes documents › Mes absences » sans mention d'attente (voir B5-3). | 1440×900 | Mineur | captures/b1-r3-suivi-b-0.png, captures/b4-r3-b-documents-absences.png |
| B4-6 | Lisibilité | « Ma part des contraintes » : lignes « Samedis travaillés / 6 faits / 7 pour votre part » coupées en colonnes étroites (« 7 pour votre / part ») ; pastilles « 1 de moins que votre part » (bleu), « 1 de plus que votre part » (orange), « Dans votre part » (vert), « Non concerné » (vert) : le vert sert à deux sens différents. | 1440×900 | Mineur | captures/b1-r3-suivi-b-0.png |
| B4-7 | Adaptation | Solvi masque la pastille « Non concerné » de la dernière ligne à l'ouverture. | 1440×900 | Cosmétique | captures/b1-r3-suivi-b-0.png |
| B4-8 | Adaptation | À 1280×760, la troisième carte passe sous les deux autres ; au téléphone, les pastilles passent sous les chiffres et la page fait 1 845 px. | 1280×760, 390×800 | Cosmétique | captures/b1-r3-suivi-p-0.png, captures/b1-r3-suivi-t-1.png |

## B5. Mes documents (Nicolas)

Identité : menu « Mes documents ». Surtitre « MON ESPACE », titre « Mes documents ». Trois onglets : « Mes plannings 11 », « Mes absences 1 », « Mes fichiers 0 ».

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B5-1 | Cohérence | « Mes plannings » liste des semaines à venir (« Semaine du 30 novembre – 6 décembre 2026 ») alors que la phrase d'en-tête parle de « vos anciens plannings ». Les semaines passées sont marquées « terminée », pas les futures. | 1440×900 | Mineur | captures/b1-r3-documents-b-0.png |
| B5-2 | Ergonomie | « Voir » sur une semaine quitte « Mes documents » et ouvre la page « Planning de l'équipe », réglée sur « Mes postes » et sur cette semaine (une seule ligne : Nicolas). On perd l'onglet ouvert et il n'y a pas de retour vers la liste ; la semaine du 30 novembre y montre Nicolas au travail alors que son congé de ces jours-là est en attente, sans aucune mention. | 1440×900 | Mineur | captures/b4-r3-b-documents-voir.png |
| B5-3 | Cohérence | « Mes absences » montre le congé du 30 novembre au 4 décembre comme acquis (« Congé · 5 jours »), sans la pastille « En attente » que porte la même demande dans « Mes demandes ». | 1440×900 | Majeur | captures/b4-r3-b-documents-absences.png, captures/b1-r3-demandes-b-1.png |
| B5-4 | Répétition | Chaque ligne a le même pictogramme, le même bouton « Voir » et presque le même sous-titre (« 5 postes · 35 h · terminée ») : 11 lignes identiques, sans repère de la semaine en cours. | 1440×900 | Cosmétique | captures/b1-r3-documents-b-0.png, captures/b1-r3-documents-b-1.png |
| B5-5 | Ergonomie | « Mes fichiers » : la nature « Arrêt de travail » est présélectionnée par défaut et la case « Visible par les titulaires » est cochée ; le bouton « Choisir un fichier » est à droite de la case, sur la même ligne. | 1440×900 | Mineur | captures/b4-r3-b-documents-fichiers.png |
| B5-6 | Cohérence | Ces onglets sont dessinés en pastilles (« jr-filtre ») avec compteur, différents des onglets en cartes de « Mes demandes » et des onglets à soulignement d'autres écrans. | toutes | Cosmétique | captures/b1-r3-documents-b-0.png |

## B6. Planning de l'équipe (Nicolas)

Identité : menu « Planning de l'équipe ». Surtitre « PLANNING DE L'ÉQUIPE », titre « Qui travaille quand ? ».

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B6-1 | Ergonomie | La page s'ouvre sur la semaine prochaine (23 – 29 novembre), pas sur la semaine en cours ; rien ne le signale (pas de « Cette semaine » / « Semaine prochaine » comme dans « Mon planning »). | toutes | Majeur | captures/b1-r3-planning-b-0.png |
| B6-2 | Lisibilité des données | Horaires écrits « 08:30–19:30 » ici et « 8 h 30 – 19 h 30 » partout ailleurs ; au téléphone, l'horaire se réduit à deux nombres empilés « 08:30 / 19:30 » sans durée ni poste. | toutes | Mineur | captures/b1-r3-planning-b-0.png, captures/b1-r3-planning-t-0.png |
| B6-3 | Lisibilité des données | Les couleurs des cases (jaune, orange, violet, bleu) codent le type de poste (matin, journée, soir, journée longue) mais aucune légende n'est affichée sur la page ; seul l'aperçu d'impression en a une. | toutes | Mineur | captures/b1-r3-planning-b-0.png |
| B6-4 | Répétition | « 7 h · comptoir » répété dans chaque case de la grille (le poste « comptoir » est le même partout dans l'exemple). | 1440×900 | Cosmétique | captures/b1-r3-planning-b-0.png |
| B6-5 | Cohérence | Sous-titre : « Vous ne pouvez pas le modifier ici : passez par une demande depuis « Mon planning » » : les demandes se font dans « Mes demandes » (ou par le bouton « Faire une demande »). Le sous-titre dit aussi « le responsable » là où le reste dit « votre titulaire ». | toutes | Mineur | captures/b1-r3-planning-b-0.png |
| B6-6 | Adaptation | Au téléphone : jours de repos marqués d'un simple point « · » minuscule ; l'en-tête « Équipe » de la première colonne et les jours abrégés (« lun. ») sont en 11 px ; Solvi recouvre la colonne du samedi (« 09:00 / 14:00 »). | 390×800 | Mineur | captures/b1-r3-planning-t-0.png, captures/b1-r3-planning-t-1.png |
| B6-7 | Adaptation | À 1440×900, Solvi recouvre la case du samedi d'Inès (« 09:0… / 9 h… »). | 1440×900 | Mineur | captures/b1-r3-planning-b-0.png |
| B6-8 | Lisibilité | En thème sombre, les pastilles de rôle (« Pharmacien », « Préparateur ») perdent leur pictogramme : un disque noir plein le remplace ; les cases de postes restent en pastels clairs. | 1440×900 sombre | Mineur | captures/b1-r3-sombre-planning-b-0.png |
| B6-9 | Accord | Pastilles de rôle au masculin pour toutes : « Caroline T. Titulaire principal », « Léa F. Pharmacien », « Inès D. Préparateur », « Sarah L. Animateur », « Manon G. Apprenti ». | toutes | Mineur | captures/b1-r3-planning-b-0.png, captures/b1-r3-planning-b-1.png |

## B7. Messages (Nicolas)

Identité : menu « Messages » ou icône bulle de la barre. Surtitre « MESSAGES », titre « Échanger avec l'équipe ».

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B7-1 | Adaptation | **Au téléphone, la zone de conversation est plus large que l'écran** : la grille « liste + conversation » mesure 833 px pour un écran de 390 px. Le bouton « Envoyer » est à 675–793 px, hors de l'écran ; le texte du message et la ligne « NOUVEAU MESSAGE » sont coupés à droite. Il faut deviner qu'on peut faire glisser le contenu de côté ; la page arrive parfois déjà décalée de 37 px (« TULAIRES », « ARMACIENS » coupés à gauche). | 390×800 | Majeur | captures/b5-messages-tel-0.png, captures/b5-messages-tel-balaye.png, captures/b1-r3-messages-t-2.png |
| B7-2 | Ergonomie | Au téléphone, la conversation est sous la liste des 12 contacts : il faut faire défiler 1 000 px pour lire ou écrire ; toucher un contact fait sauter la page sans repère. | 390×800 | Majeur | captures/b1-r3-messages-t-0.png, captures/b1-r3-messages-t-2.png |
| B7-3 | Hiérarchie | En-tête : le seul bouton est « Demander un rendez-vous », alors que la page sert à écrire ; « Envoyer » est en bas d'une carte, grisé. | 1440×900 | Mineur | captures/b1-r3-messages-b-0.png |
| B7-4 | Répétition | Dix contacts sur douze affichent « Aucun message » : liste longue de cartes vides groupées par métier (« TITULAIRES », « PHARMACIENS », « PRÉPARATEURS », « AUTRES POSTES »). | 1440×900 | Mineur | captures/b1-r3-messages-b-0.png, captures/b1-r3-messages-b-1.png |
| B7-5 | Lisibilité | Aperçus de messages coupés par « … » dans la liste (« Bonjour à tous, le planning de la s… ») ; « Toute l'équipe » est coché d'une grosse coche bleue qui ressemble à « lu ». | 1440×900 | Cosmétique | captures/b1-r3-messages-b-0.png |
| B7-6 | Lisibilité | Phrase d'en-tête « Les messages restent sur cet appareil. » : avertissement technique incompréhensible pour un salarié (un message envoyé n'arrive donc pas chez le collègue sur son propre téléphone ?). | toutes | Mineur | captures/b1-r3-messages-b-0.png |
| B7-7 | Cohérence | Noms complets dans Messages (« Caroline Tellier », « Igor Le Russe »), noms courts partout ailleurs (« Caroline T. », « Igor L. »). | toutes | Cosmétique | captures/b1-r3-messages-b-0.png |

## B8. Mon compte (Nicolas)

Identité : menu du compte (nom en haut à droite) › « Mon compte » ou « Paramètres ». Surtitre « MON COMPTE », titre « Mes paramètres ». Page absente du menu latéral.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B8-1 | Cohérence | Surtitre « MON COMPTE » et titre « Mes paramètres » ; entrées de menu « Mon compte » et « Paramètres » qui mènent à la même page. | toutes | Mineur | captures/b1-r3-compte-b-0.png, captures/b4-r3-b-menu-compte.png |
| B8-2 | Hiérarchie | Le changement de mot de passe (le seul geste attendu d'un nouveau salarié, avec la pastille « Mot de passe provisoire ») est la toute dernière carte, après 22 compétences et le choix d'apparence : à 2 000 px du haut à 1440×900, 4 200 px au téléphone. | toutes | Majeur | captures/b1-r3-compte-b-2.png, captures/b1-r3-compte-t-7.png |
| B8-3 | Lisibilité | Carte d'identité : une phrase de 30 mots « Préparateur · 35 h par semaine · CDI · 12 ans et 10 mois d'ancienneté · Grande Pharmacie de la Pinède · Seul Caroline T. peut vous donner l'accès à la gestion » ; « Préparateur » y figure deux fois (pastille et phrase) ; « Seul Caroline T. » au lieu de « Seule ». | toutes | Mineur | captures/b1-r3-compte-b-0.png |
| B8-4 | Adaptation | Au téléphone, cette phrase s'écrit sur 14 lignes de 1 à 3 mots dans une colonne de 90 px, à côté d'un bouton « Se déconnecter » ; le nom « Nicolas / Le / Syndicaliste » sur trois lignes. | 390×800 | Majeur | captures/b1-r3-compte-t-0.png |
| B8-5 | Ergonomie | « Se déconnecter » est un gros bouton dans la carte d'identité, en plus de l'entrée « Se déconnecter » du menu du compte. | toutes | Cosmétique | captures/b1-r3-compte-b-0.png |
| B8-6 | Lisibilité | Compétences : 22 boutons-pastilles à cocher, dont deux verrouillés avec un cadenas (« Tests angine et cystite », « Entretiens pharmaceutiques ») grisés sans explication sur place (elle est 300 px plus bas : « réservés aux pharmaciens »). | 1440×900 | Mineur | captures/b1-r3-compte-b-0.png, captures/b1-r3-compte-b-1.png |
| B8-7 | Cohérence | Apparence : quatre vignettes (Clair, Mixte, Sombre, Comme l'appareil) ici, trois dans le menu du compte ; encart « Couleur de votre espace : Indigo » non modifiable présenté comme un réglage. | 1440×900 | Mineur | captures/b1-r3-compte-b-1.png |
| B8-8 | Ergonomie | Le changement de mot de passe ne demande pas de confirmation du nouveau mot de passe (un seul champ « Nouveau mot de passe »). | toutes | Mineur | captures/b1-r3-compte-b-2.png |
| B8-9 | Lisibilité | « Seule une empreinte est conservée, sur cet appareil. » : vocabulaire technique. | toutes | Cosmétique | captures/b1-r3-compte-b-2.png |

## B9. Fenêtres « Retard ou absence » et « Prévenir d'un retard »

Identité : bouton « Retard ou absence » (barre du haut, toutes pages) et bouton « Prévenir d'un retard » (carte Prochain poste de l'Accueil et de Mon planning).

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B9-1 | Répétition / cohérence | Deux fenêtres différentes pour prévenir d'un retard : « Signaler un retard ou une absence » (barre du haut ; choix Retard / Absence, puis « De combien ? » avec 5 / 10 / 15 / + de 20 min, « Un mot facultatif », sans raison) et « Prévenir d'un retard » (accueil ; mêmes durées, plus « Pourquoi ? » avec Transport / Santé / Famille / Autre raison, « Un mot pour les titulaires »). Selon le bouton, on ne donne pas les mêmes informations. | 1440×900 | Majeur | captures/b3-r3-b-signaler-2.png, captures/b3-r3-b-prevenir.png |
| B9-2 | Cohérence | Le bouton de validation change de nom : « Choisissez retard ou absence » (bouton grisé qui sert de consigne), puis « Prévenir les titulaires ». La première fenêtre dit « Vos titulaires sont prévenus aussitôt » avant même d'avoir choisi. | 1440×900 | Mineur | captures/b3-r3-b-signaler-0.png, captures/b3-r3-b-signaler-2.png |
| B9-3 | Ergonomie | « 10 min » est présélectionné dans les deux fenêtres : un clic distrait sur « Prévenir les titulaires » envoie une durée que la personne n'a pas choisie. | 1440×900 | Mineur | captures/b3-r3-b-signaler-2.png, captures/b3-r3-b-prevenir.png |
| B9-4 | Lisibilité des données | « Arrivée prévue vers 1 1 h 40 » : chiffres espacés en gras (« 1 1 »). | 1440×900 | Cosmétique | captures/b3-r3-b-signaler-2.png |
| B9-5 | Cohérence | Ponctuation des noms : « Caroline T., Pierre F. reçoivent… » dans une fenêtre, « Caroline T. et Pierre F. reçoivent… » dans l'autre. | 1440×900 | Cosmétique | captures/b3-r3-b-signaler-2.png, captures/b3-r3-b-prevenir.png |
| B9-6 | Ergonomie | Au téléphone, le bouton « Retard ou absence » de la barre du haut n'est plus qu'une icône de réveil sur fond orange sans texte, à côté du « + » ; rien ne dit ce qu'il fait. | 390×800 | Mineur | captures/b1-r3-espace-t-0.png |

## B10. Un appel à l'équipe vu par un collègue

Identité : (1) Nicolas, cloche « À VOIR · Collègue qui cherche un remplaçant 1 » (remplacement ouvert du samedi 21 dans l'exemple) ; (2) Nicolas demande à Igor de le remplacer le vendredi 27 novembre (« Me faire remplacer » › Igor Le Russe › Envoyer), puis on passe sur le profil d'Igor.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B10-1 | Cohérence (libellé qui ment) | Nicolas : la cloche annonce « Collègue qui cherche un remplaçant » (pastille 1) ; un clic ouvre « Mon planning », où aucune carte de remplacement n'apparaît (ni sur l'accueil). Même chose pour Sarah, Manon et Yanis. La cloche compte les demandes ouvertes sans vérifier que la personne peut reprendre le poste ; la page, elle, le vérifie. | 1440×900, 390×800 | Majeur | captures/b4-r3-b-cloche.png, captures/b6-b-apres-cloche.png |
| B10-2 | Cohérence | Igor, sollicité nommément par Nicolas : l'accueil affiche bien en tête « À FAIRE EN PREMIER · Nicolas vous demande de le remplacer » avec « Voir la demande », mais la cloche d'Igor ne le mentionne pas (elle ne montre que « DÉCIDÉ RÉCEMMENT · Arrêt d'Igor L. enregistré »). | 1440×900 | Majeur | captures/b7-b-igor-accueil-0.png, captures/b7-b-igor-cloche.png |
| B10-3 | Cohérence (vocabulaire) | Carte de demande chez Igor : « Vous proposer n'engage à rien tant que le responsable n'a pas validé » puis « Nicolas vous le demande, à vous. Le titulaire validera. » (responsable / titulaire dans la même carte) ; boutons « Je ne peux pas » / « J'accepte » ; après « J'accepte », l'état devient « Vous êtes volontaire » avec « Retirer » : trois verbes pour un seul geste. | 1440×900 | Mineur | captures/b7-b-igor-carte.png, captures/b7-b-igor-repondu.png |
| B10-4 | Hiérarchie | Dans « Mon planning » d'Igor, la carte « Un collègue vous demande de le remplacer » est placée sous « Prochain poste » ; « Voir la demande » de l'accueil y mène sans la mettre en évidence (pas de défilement ni de surbrillance de la carte). | 1440×900 | Mineur | captures/b7-b-igor-repondu.png |
| B10-5 | Ergonomie | Fenêtre « Me faire remplacer » côté Nicolas : choisir Igor ne fait que teinter sa carte en lilas pâle ; pas de coche, pas de bouton radio ; « Toute l'équipe » au-dessus a le même dessin. On ne sait pas lequel est choisi. | 1440×900 | Mineur | captures/b7-b-nicolas-choix-igor.png |
| B10-6 | Adaptation | Au téléphone, la carte « À faire en premier » d'Igor commence à 540 px, après une bannière de 430 px ; le bouton « Voir la demande » est sous Solvi et la barre d'onglets. | 390×800 | Majeur | captures/b7-t-igor-accueil-0.png |
| B10-7 | Retour d'action | « J'accepte » affiche le toast « Merci. Nicolas est prévenu ; le titulaire valide. Annuler » : retour clair, mais il se pose au milieu des cartes de jour (« Mardi 17 », « Mercredi 18 ») qu'il masque pendant 5 s. | 1440×900 | Cosmétique | captures/b7-b-igor-repondu.png |

## B11. Mes gardes (Igor, pharmacien)

Identité : menu « Mes gardes » (profil pharmacien uniquement). Surtitre « MES GARDES », titre « Mes gardes et astreintes ».

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B11-1 | Lisibilité des données | Garde passée : la pastille de dérangement « 0 h 10 · 25 min » mélange une heure (minuit dix) écrite comme une durée (« 0 h 10 ») et une durée (« 25 min »). | 1440×900 | Majeur | captures/b1-r2-mesgardes-b-0.png |
| B11-2 | Lisibilité des données | Trois écritures d'une même garde : « de 19 h 30 à 8 h 30 le lendemain · 13 h » (Mes gardes), « Garde de nuit · 19:30 → 08:30 » (accueil d'Igor), « 1 9:30 » avec chiffres espacés. | 1440×900 | Mineur | captures/b1-r2-mesgardes-b-0.png, captures/b1-r2-espace-b-1.png |
| B11-3 | Lisibilité des données | Champs « Heure » (« 11:00 PM ») et « Mois » (« November 2026 ») en anglais et au format américain dans le navigateur de test ; le reste de la page est en français (champs natifs, à vérifier sur un poste réglé en français). | 1440×900 | Mineur | captures/b1-r2-mesgardes-b-1.png |
| B11-4 | Répétition | Encadré vert « Programmation communiquée N jours avant la garde » répété sur chaque garde, avec la même phrase de repos ; pour une garde passée, l'information n'aide plus. | 1440×900 | Cosmétique | captures/b1-r2-mesgardes-b-0.png |
| B11-5 | Cohérence | Pastilles « À venir » (lilas) et « À valider par le responsable » (orange) ; ailleurs on dit « votre titulaire ». | 1440×900 | Cosmétique | captures/b1-r2-mesgardes-b-0.png |
| B11-6 | Ergonomie | Formulaire « Heure / Durée, trajet compris (min) / Déclarer » pré-rempli (« 11:00 PM », « 20 ») : une déclaration peut partir avec des valeurs que la personne n'a pas saisies. | 1440×900 | Mineur | captures/b1-r2-mesgardes-b-1.png |
| B11-7 | Lisibilité | « Récapitulatif mensuel · novembre 2026 · 0 garde » puis « Aucun élément de paie ce mois-ci. » : vocabulaire de paie pour un salarié ; le récapitulatif s'imprime même vide. | 1440×900 | Cosmétique | captures/b1-r2-mesgardes-b-1.png |
| B11-8 | Adaptation | Au téléphone, « Garde de nuit · volets fermés » se casse sur trois lignes, la pastille « À valider par le responsable » est coupée par Solvi. | 390×800 | Mineur | captures/b1-r2-mesgardes-t-0.png |

## B12. Ce qui diffère pour Igor, Sarah, Manon et Yanis

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| B12-1 | Lisibilité des données | Igor : bannière « Votre semaine : 12 h planifiées pour 14 h au contrat » alors que la fenêtre de remplacement dit « pour un contrat de 35 h ». Le contrat est réduit à cause de l'arrêt, mais rien ne l'explique. | 1440×900 | Majeur | captures/b7-b-igor-accueil-0.png, captures/b7-b-nicolas-choix-igor.png |
| B12-2 | Cohérence | L'onglet ouvert d'office dans « Mes demandes » change selon le profil : « Absence ou horaire » pour Nicolas et Manon, « Mes préférences » pour Igor, Sarah et Yanis. La même page ne s'ouvre pas de la même façon d'une personne à l'autre. | 1440×900 | Mineur | captures/b1-r3-demandes-b-0.png, captures/b1-r2-demandes-b-0.png |
| B12-3 | Répétition | Igor, « Mes demandes » : la carte dit « À remplir aujourd'hui » et, dix centimètres plus bas, le panneau dit « Dernier jour » pour la même échéance. | 1440×900 | Mineur | captures/b1-r2-demandes-b-0.png |
| B12-4 | Accord | Étiquette de la barre « Espace animateur » pour Sarah, « Espace apprenti » pour Manon ; pastilles « Animateur », « Apprenti » partout (Planning de l'équipe, Mon compte). | toutes | Mineur | captures/b1-r4-espace-b-0.png, captures/b1-r5-espace-b-0.png |
| B12-5 | Répétition | Sarah : « MES PROCHAINS JOURS D'ANIMATION » commence par « Vendredi 20 novembre 8 h 30 – 16 h 30 », déjà affiché juste au-dessus en « PROCHAIN POSTE · Aujourd'hui ». Même doublon pour Manon (« MES PROCHAINS JOURS EN OFFICINE » / « Lun. 23 novembre ») et Yanis. | 1440×900 | Mineur | captures/b1-r4-espace-b-1.png, captures/b1-r5-espace-b-0.png |
| B12-6 | Hiérarchie | Sarah : la carte « Les marques que je présente » (trois grandes cartes de marques avec pastilles de familles de produits) occupe plus d'un écran ; le bouton « Demander un bilan d'animation » est sous les marques, loin du haut. | 1440×900 | Mineur | captures/b1-r4-espace-b-0.png, captures/b1-r4-espace-b-1.png |
| B12-7 | Cohérence | Manon : « JOURS D'ÉCOLE SIGNALÉS · Indisponible - jeudi, vendredi » ; Yanis : « COURS ET EXAMENS SIGNALÉS · Indisponible - lundi, mardi, jeudi, vendredi » : le libellé affiché est le type technique (« Indisponible ») et non « École » ou « Cours », avec un trait d'union en guise de tiret. | 1440×900 | Mineur | captures/b1-r5-espace-b-0.png, captures/b1-r6-espace-b-0.png |
| B12-8 | Cohérence | Le bouton « Prévenir d'un retard » apparaît chez Nicolas, Sarah et Yanis (poste aujourd'hui ou demain) mais pas chez Manon (prochain poste lundi) : la carte « Prochain poste » n'a pas la même forme d'un profil à l'autre, sans explication. | 1440×900 | Cosmétique | captures/b1-r5-espace-b-0.png, captures/b1-r6-espace-b-0.png |
| B12-9 | Lisibilité | Couleur de chaque profil appliquée à toute l'interface (indigo, sarcelle, framboise, vert, ocre) : bannière, menu actif, boutons, pastilles. L'ocre de Yanis donne un bouton « Faire une demande » brun foncé et un « Retard ou absence » beige presque identiques en valeur ; le rose de Sarah rend les deux boutons de l'en-tête de même teinte. | 1440×900 | Cosmétique | captures/b1-r6-espace-b-0.png, captures/b1-r4-espace-b-0.png |
| B12-10 | Adaptation | Bannière d'accueil au téléphone : même défaut que B1-6 pour tous les profils (Igor : « Espace pharmacien / · / Grande / Pharmacie / de / la / Pinède », 9 lignes). | 390×800 | Majeur | captures/b7-t-igor-accueil-0.png |

---

# Partie C. Le transversal

## C1. Solvi, l'assistant (bulle en bas à droite)

Identité : bulle « Aide » en bas à droite de toutes les pages (122×62 px à 1440, 58×58 sans texte au téléphone) ; un clic ouvre le panneau « Solvi · Votre assistant. Posez votre question. ».

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| C1-1 | Adaptation (ce qu'il masque) | La bulle est posée sur le contenu sans réserve de place. Mesuré, page en haut : à 1440, elle recouvre « Voir mon planning » (Accueil), « 35 h prévues » et « 5 jours » (Mon planning), « Non concerné » (Mon suivi), un bouton « Voir » (Mes documents), la case du samedi d'Inès (Planning de l'équipe) ; à 1280, les horaires de la carte du vendredi (Mon planning) et « Ce que votre responsable a noté » (Mon suivi) ; au téléphone, « Calendrier » (Mon planning), « Ensuite : Demain, 9 h – 19 h » (Accueil), « Titulaire, puis un collègue volontaire » (Mes demandes), les titres de semaines (Mes documents), le contact « Léa Fontaine » (Messages), la colonne du samedi (Planning de l'équipe). | toutes | Majeur | captures/b1-r3-moi-b-0.png, captures/b1-r3-suivi-b-0.png, captures/b1-r3-planning-b-0.png, captures/b1-r3-moi-t-0.png, captures/b1-r3-planning-t-0.png |
| C1-2 | Cohérence (vocabulaire) | Trois noms pour la même chose : la bulle dit « Aide », le panneau « Solvi », le sous-titre « Votre assistant » ; et l'icône « ? » de la barre du haut s'appelle « Aide et tutoriels » mais ouvre une autre page (Aide). | toutes | Mineur | captures/c1-b-ouvert.png |
| C1-3 | Adaptation | Panneau ouvert : 410×620 px, il couvre le tiers droit de la page (à 1440 : la fin de la carte Prochain poste et le bouton « Prévenir d'un retard ») ; au téléphone il occupe tout l'écran sauf la barre d'onglets, et la bulle reste affichée par-dessus le contenu sous le panneau. | 1440×900, 390×800 | Mineur | captures/c1-b-ouvert.png, captures/c1-t-reponse1.png |
| C1-4 | Répétition | Suggestions d'ouverture en doublon : « Où voir mon prochain poste ? » et « Mon prochain poste ? » ; « Voir le planning de toute l'équipe » et « Qui travaille avec moi demain ? ». | toutes | Mineur | captures/c1-b-ouvert.png |
| C1-5 | Lisibilité | Réponse de repli : « Là, je sèche. Mes quatre lobes ont beau chauffer, je n'ai pas trouvé. » suivie de 7 boutons empilés (Ouvrir l'aide, téléphone, courriel, Écrire à mon titulaire, trois questions) qui remplissent le panneau. Ton familier dans un outil de travail. | 1440×900 | Cosmétique | captures/c1-b-reponse3.png |
| C1-6 | Répétition | Le pied du panneau propose « Visites guidées » : quatrième entrée vers les visites (avec « Comment ça marche ? », « Besoin d'aide ? », l'onglet Aide). | toutes | Cosmétique | captures/c1-b-ouvert.png |
| C1-7 | Lisibilité | Mention « Réponses calculées sur cet appareil. » en 12 px gris, technique. | toutes | Cosmétique | captures/c1-b-ouvert.png |

Ce qui va bien : réponses justes et courtes aux questions testées (« Quand est-ce que je travaille demain ? » : « 9 h – 19 h, pause de 13 h à 14 h », avec bouton « Ouvrir mon planning » ; « Comment poser un congé ? » : renvoi exact vers « Mes demandes › Absence ou horaire ») ; fermeture par Échap ; le champ reçoit le focus.

## C2. Visite guidée en cours (fiche, Solvi, projecteur, sommaire, « i »)

Voir aussi A5 (lancement). Ici : étape 5 de la visite « Préparateur » (« Le planning de l'équipe ») et rechargement pendant la visite.

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| C2-1 | Adaptation | Étape « Le planning de l'équipe » : le projecteur encadre la grille, mais la fiche (420×372 px, en bas à gauche) recouvre la colonne des noms, dont la ligne « Nicolas L. (vous) », au moment même où le texte explique « « Mes postes » ne garde que votre ligne ». | 1440×900 | Majeur | captures/c2-visite-etape5.png |
| C2-2 | Ergonomie | Recharger la page pendant une visite la termine sans reprise : on se retrouve sur « Bonjour Nicolas », sans fiche, sans proposition de reprendre à l'étape 5. | 1440×900 | Mineur | captures/c2-visite-apres-reload.png |
| C2-3 | Cohérence | Pendant la visite, la bulle Solvi habituelle disparaît et Solvi apparaît dans la fiche (visage en haut à gauche) : cohérent, mais le bouton de lecture automatique (▶) et la croix de la fiche, ronds et de même taille, se ressemblent. | 1440×900 | Cosmétique | captures/c2-visite-etape5.png |
| C2-4 | Lisibilité | Dans la fiche, le fil « Mon planning › Planning de l'équipe » (bouton de sommaire), le titre « Le planning de l'équipe » et la page éclairée « Planning de l'équipe » répètent le même nom trois fois. | 1440×900 | Cosmétique | captures/c2-visite-etape5.png |

## C3. Messages de confirmation (toasts)

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| C3-1 | Adaptation | Au téléphone, le toast (« Demande envoyée au responsable. Annuler ») se pose sur la barre d'onglets du bas (toast de 689 à 776 px, barre à partir de 729 px) et masque « Planning », « Demandes », « Messages » pendant 5 s. | 390×800 | Mineur | captures/c2-tel-toast.png |
| C3-2 | Adaptation | À l'ordinateur, le toast est centré en bas, par-dessus le contenu (cartes de jours, cartes de demande), et non dans une zone réservée. | 1440×900 | Cosmétique | captures/b2-r3-b-nd-envoye.png, captures/b7-b-igor-repondu.png |
| C3-3 | Ergonomie | Durée fixe de 5,2 s (9 s s'il y a un bouton d'action) : le lien « Annuler » d'une demande envoyée disparaît avec le toast, sans autre moyen d'annuler aussi simple. | toutes | Mineur | captures/b2-r3-b-nd-envoye.png |
| C3-4 | Cohérence | Le choix d'une préférence ne produit pas de toast mais un petit texte vert « Choix enregistré » près du titre ; les demandes, un toast noir ; « J'accepte », un toast noir ; l'envoi d'un message dans Messages, aucun toast. Trois façons de confirmer. | 1440×900 | Mineur | captures/b2-r3-b-pref-apres-clic.png, captures/b2-r3-b-nd-envoye.png, captures/c2-toast-message.png |
| C3-5 | Ergonomie | Premier écran du titulaire après la création : un toast parle d'une « échéance passée » et d'un brouillon de décembre « d'après vos habitudes » pendant la visite de bienvenue (voir A3-3). | 1440×900 | Majeur | captures/a2-cree-b.png |

## C4. Les fenêtres en général

Mesures à 1280×760 et 390×800 (hauteur de la boîte, hauteur de l'en-tête, partie visible / totale du corps qui défile).

| Fenêtre | 1280×760 | 390×800 |
|---|---|---|
| Nouvelle demande | 780×680, en-tête 85, corps 516/832 | 350×784, en-tête 110, corps 543/1 352 |
| Me faire remplacer | 580×680, corps 516/868 | 350×784, corps 595/1 035 |
| Signaler un retard ou une absence | 580×332, sans défilement | 350×478 |
| Prévenir d'un retard | 580×602, sans défilement | 350×784, en-tête 132, corps 521/556 |
| Journée (Mon planning) | 1100×680, corps 508/735 | 350×784, corps 550/1 463 |
| Aperçu avant impression | 1100×680, corps 508/560 | 350×770, en-tête 132 |
| Demander un rendez-vous | 780×680, en-tête 107 | 350×784, en-tête 154, corps 499/738 |

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| C4-1 | Ergonomie | Échap et un clic à côté ferment « Nouvelle demande » même après saisie (raison choisie, précision « texte saisi ») : rien n'est demandé, et la saisie est perdue à la réouverture. | 1440×900 | Mineur | (journal de js/c2-transversal.js : « ND Échap ferme true », précision vide à la réouverture) |
| C4-2 | Adaptation | Au téléphone, l'en-tête violet décoré (forme en tache) prend 110 à 154 px et le pied 2 gros boutons empilés (120 à 130 px) : il reste 500 à 600 px pour le contenu. | 390×800 | Mineur | captures/c3-t-rdv.png, captures/c3-t-imprimer.png |
| C4-3 | Adaptation | « Demander un rendez-vous » au téléphone : les champs « Jour », « À », « Durée » sont tronqués (« 11/21/ », « 02:0 », « 30 mi »). | 390×800 | Majeur | captures/c3-t-rdv.png |
| C4-4 | Adaptation | Fenêtre de la journée au téléphone : les étiquettes de la frise se chevauchent (« 8 h 30 » collé à la barre, « 13 h »), « (15 / min) » cassé sur deux lignes. | 390×800 | Mineur | captures/c3-t-journee.png |
| C4-5 | Lisibilité | Aperçu avant impression au téléphone : la feuille A4 réduite à 270 px de large est illisible ; le titre de semaine passe sur trois lignes entre les flèches. | 390×800 | Mineur | captures/c3-t-imprimer.png |
| C4-6 | Cohérence | Deux familles de fenêtres : en-tête violet décoré avec titre et croix (Nouvelle demande, Remplacer, Journée, Aperçu, Rendez-vous, Signaler) ; en-tête blanc avec logo (Découvrir Solvéa) ; panneau latéral (Solvi). Le bouton principal est tantôt à droite du pied (ordinateur), tantôt en dessous (téléphone, pleine largeur). | toutes | Cosmétique | captures/b2-r3-b-nd-0.png, captures/a3-b-dc-onglet-parcours.png |
| C4-7 | Ergonomie | Le focus reste bien dans la fenêtre (40 tabulations testées) et la croix fait 38×38 px : correct. Le focus initial varie : « Type de besoin » au milieu (Nouvelle demande), « Veille » (Journée), « Imprimer » (Aperçu). | 1440×900 | Cosmétique | captures/b4-r3-b-moi-journee.png, captures/b4-r3-b-moi-imprimer.png |

## C5. Cohérence des composants d'une page à l'autre

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| C5-1 | Cohérence | Cinq dessins d'onglets différents dans l'espace équipe : grandes cartes avec flèche (Mes demandes), pastilles avec compteur (Mes documents), interrupteur à deux positions (Semaine / Calendrier ; Toute l'équipe / Mes postes), onglets à icône avec compteur (Découvrir Solvéa), boutons de choix (Je préfère : Matin / Journée…). | toutes | Mineur | captures/b1-r3-demandes-b-0.png, captures/b1-r3-documents-b-0.png, captures/b1-r3-moi-b-0.png |
| C5-2 | Cohérence | Boutons d'action de même niveau dessinés différemment : bleu plein (« Faire une demande », « Demander un rendez-vous »), beige (« Prévenir d'un retard », « Retard ou absence »), lilas pâle (« Parler d'une formation », « Voir », « Imprimer »), dégradé pâle (assistant de création), rose pâle (« Demander un bilan d'animation »). | toutes | Mineur | captures/b1-r3-espace-b-0.png, captures/b1-r4-espace-b-1.png |
| C5-3 | Cohérence | Pastilles d'état : « En attente » (orange), « Préférence prioritaire » (lilas), « Dernier jour » (vert ou orange selon l'endroit), « À remplir aujourd'hui » (orange), « 1 en attente » (orange), « Aucune » (gris), « Possible » (vert), « Non concerné » (vert), « Mot de passe provisoire » (orange) : la couleur ne suit pas une règle lisible. | toutes | Mineur | captures/b1-r3-demandes-b-0.png, captures/b2-r3-b-pref-0.png, captures/b1-r3-suivi-b-0.png |
| C5-4 | Cohérence | En-têtes de page : icône + surtitre + titre + phrase sur toutes les pages sauf l'Accueil (bannière) ; le surtitre répète le menu (« MON PLANNING », « MON SUIVI », « MESSAGES ») ou dit autre chose (« MON ESPACE » pour Mes demandes et Mes documents, « MON COMPTE » pour « Mes paramètres »). | toutes | Cosmétique | captures/b1-r3-demandes-b-0.png, captures/b1-r3-compte-b-0.png |
| C5-5 | Cohérence | Noms des personnes : « Caroline T. » (menus, planning), « Caroline Tellier » (Messages, Me faire remplacer), « CT » (pastilles) ; initiales sur 2 ou 3 lettres selon les profils (« ILR », « NLS » dans Découvrir ; « IL », « NL » ailleurs). | toutes | Cosmétique | captures/b1-r3-messages-b-0.png, captures/a3-b-dc-onglet-libre.png |

## C6. Téléphone : barre d'onglets du bas, barre du haut et menu

| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |
|---|---|---|---|---|---|
| C6-1 | Cohérence (vocabulaire) | Barre du bas : « Accueil », « Planning », « Demandes », « Messages », « Menu ». « Planning » ouvre « Mon planning » (et non « Planning de l'équipe ») ; « Demandes » = « Mes demandes ». Libellés différents du menu pour les mêmes pages. | 390×800 | Mineur | captures/b1-r3-moi-t-0.png, captures/c2-tel-menu.png |
| C6-2 | Lisibilité | Libellés de la barre du bas en 11,5 px ; cibles correctes (73×58 px). | 390×800 | Cosmétique | captures/b1-r3-moi-t-0.png |
| C6-3 | Ergonomie | Barre du haut réduite à 6 icônes sans texte (fiole « Espace préparateur », « + », réveil, cloche, bulle, avatar) ; le « ? » de l'aide disparaît ; « + » et réveil ne se devinent pas. | 390×800 | Mineur | captures/b1-r3-espace-t-0.png |
| C6-4 | Ergonomie | « Menu » ouvre un volet « Toutes les rubriques » qui répète les 4 onglets de la barre et n'ajoute que « Mon suivi », « Mes documents » et « Planning de l'équipe » ; « Mon compte » et « Se déconnecter » n'y sont pas (seulement sous l'avatar). Échap ne ferme pas le volet quand le focus est resté sur le bouton Menu. | 390×800 | Mineur | captures/c2-tel-menu.png |
| C6-5 | Adaptation | Solvi (58×58 px) flotte juste au-dessus de l'onglet « Menu » et recouvre du contenu sur toutes les pages (voir C1-1). | 390×800 | Majeur | captures/b1-r3-espace-t-0.png |
| C6-6 | Adaptation | Pages très longues au téléphone : Mon compte 4 215 px, Mon planning 3 073 px, Mes documents 2 018 px, Accueil 1 900 px (Nicolas). | 390×800 | Mineur | captures/b1-r3-compte-t-0.png, captures/b1-r3-moi-t-0.png |

---

# Transversal : ce qui se répète sur plusieurs pages

1. **Solvi recouvre du contenu partout** (C1-1, C6-5, B1-7, B3a-7, B4-7, B6-6, B6-7) : aucune page ne réserve la place de la bulle ; au téléphone elle cache des boutons.
2. **Le téléphone est le parent pauvre** : bannière d'accueil cassée mot par mot (B1-6, B12-10), Messages plus large que l'écran avec « Envoyer » hors d'atteinte (B7-1), carte d'identité de Mon compte en colonne de 90 px (B8-4), onglets de Mes demandes qui ne font rien bouger à l'écran (B3-6), fiche de visite qui couvre la moitié de l'écran (A5-4), champs tronqués dans les fenêtres (C4-3), toasts sur la barre d'onglets (C3-1).
3. **Deux écritures des heures** : « 8 h 30 – 16 h 30 » (Mon planning, Accueil, fenêtres) et « 08:30–16:30 » (Planning de l'équipe, gardes à l'accueil d'Igor), plus « 19:30 → 08:30 », et des chiffres espacés « 1 1 h 30 » dans les listes alignées (B1-8, B2-3, B6-2, B9-4, B11-2).
4. **Vocabulaire flottant** : titulaire / responsable (B3b-5, B6-5, B10-3, B11-5) ; pharmacie / officine (A2-1) ; visite / parcours / tutoriel / démonstration (A3-6, A5-7) ; Aide / Solvi / assistant (C1-2) ; Mon compte / Mes paramètres / Paramètres (B8-1) ; Planning / Mon planning (C6-1) ; trois listes de motifs différentes pour une absence, un remplacement et un retard (B3d-5).
5. **Masculin imposé** : « Titulaire principal » (Claire, Caroline), « Pharmacien » (Léa), « Préparateur » (Inès), « Espace animateur » (Sarah), « Espace apprenti » (Manon), « Seul Caroline T. » (A2-2, B6-9, B8-3, B12-4).
6. **Mêmes informations répétées sur une page** : prochain poste deux fois sur l'Accueil puis encore dans Mon planning (B1-2, B12-5) ; « Faire une demande » deux fois sur Mon planning (B2-1) ; trois entrées d'aide sur chaque écran (B0-3) ; trois phrases de confidentialité dans Nouvelle demande (B3c-3) ; « Mon suivi » dans « Mon suivi » (B4-1) ; deux fenêtres pour prévenir d'un retard (B9-1).
7. **Signaux qui se contredisent** : la cloche annonce un appel que la page ne montre pas (B10-1) ou ne montre pas une demande que l'accueil met « à faire en premier » (B10-2) ; congé « en attente » d'un côté, acquis de l'autre (B5-3) ; « Dans moins de 7 jours » et « Plus de 7 jours » pour un poste à 7 jours (B3d-2) ; contrat de 14 h contre 35 h (B12-1) ; bouton « Tutoriel » annoncé mais inexistant (A3-1).
8. **Petits caractères** : surtitres en capitales de 11 à 11,5 px sur toutes les pages, libellés de la barre du bas en 11,5 px, notes de confidentialité en 12 px gris (B0-6, C6-2, B3c-2).
9. **Phrases techniques** adressées à des salariés : « Sans serveur », « Les messages restent sur cet appareil », « Seule une empreinte est conservée », « Réponses calculées sur cet appareil » (A1-4, B7-6, B8-9, C1-7).
10. **Sélection peu visible** : cartes choisies seulement teintées (« À qui demander ? », « Niveau d'urgence »), onglets qui ressemblent à des tuiles d'information (B3-2, B3d-3, B10-5).

# Ce que je n'ai pas pu voir

- Le rendu des champs de date et d'heure natifs sur un poste réglé en français : le navigateur de test affiche « mm/dd/yyyy », « 11:00 PM », « November 2026 ». Ces points (A2, B3c-5, B11-3) sont signalés « à vérifier ».
- L'impression réelle sur papier (seul l'aperçu a été regardé) et le dépôt d'un fichier dans « Mes fichiers » (pas de fichier fourni au navigateur de test).
- Les pages « Aide » et « Besoin d'aide ? » elles-mêmes, hors de mon périmètre (seulement vues comme entrées).
- Le thème sombre au téléphone et à 1280×760 (vu seulement à 1440×900 pour Accueil, Mon planning, Mes demandes, Mon suivi, Planning de l'équipe, Messages) ; le mode « Mixte » et la taille de texte « Grand ».
- Un appel « L'équipe a besoin d'un coup de main » lancé par le titulaire (trou dans le planning) : la pharmacie d'exemple n'en contenait pas pour Nicolas à cette date ; seul le cas d'une demande nommée (Nicolas vers Igor) a été joué de bout en bout.
- La « Visite guidée complète » (97 étapes, 49 minutes) : seules les premières étapes de quatre visites ont été jouées.
- Les lecteurs d'écran (annonces vocales) : seuls la gestion du focus et les libellés accessibles ont été relevés.
