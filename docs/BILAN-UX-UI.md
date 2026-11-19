# Bilan UX et UI de Solvéa

Bilan établi le 19 novembre 2026 sur le code du dépôt, après les derniers correctifs.

**Méthode.** Cinq grilles ont été appliquées : critique de design (première impression, usage, hiérarchie,
cohérence), audit d'accessibilité WCAG 2.1 AA, audit technique en cinq dimensions (accessibilité,
performance, thèmes, adaptation aux écrans, intégrité du code), audit du système de design (jetons,
composants), relecture des textes d'interface. Les constats viennent de mesures faites dans un navigateur
piloté par script, pas d'impressions : 22 écrans relevés à 5 tailles (360, 390, 768, 1024 et 1440 px),
analyse automatique d'accessibilité (axe-core) sur 110 écrans en clair et 40 en sombre, mesure des temps, lecture du code.

> [!IMPORTANT]
> Ce bilan ne remplace pas trois vérifications qui restent à faire : des essais sur de vrais téléphones
> (Safari sur iPhone, Chrome sur Android), des essais avec un lecteur d'écran, et des essais avec de vrais
> utilisateurs d'une pharmacie. Rien de ce qui suit n'a été observé sur une personne réelle.

---

## 1. L'essentiel

| | Note | Lecture |
| --- | --- | --- |
| **Usage** (10 heuristiques de Nielsen) | **29 / 40** | Bon. Les points faibles : cohérence, densité, raccourcis. |
| **Technique** (5 dimensions) | **12 / 20** | Acceptable. Le poids du code et le téléphone tirent la note vers le bas. |
| **Système de design** | **55 / 100** | Des jetons existent, mais trop de valeurs hors système. |

**Trois forces.** Le vocabulaire est celui d'une pharmacie et tout est dit en mots, pas en codes. L'aide est
exceptionnelle pour un outil de ce type (assistant, lexique, visites, un tutoriel par tâche). Les décisions
montrent ce qu'elles impliquent avant d'être prises.

**Trois faiblesses.** Il n'y a pas de serveur : chaque appareil garde ses propres données, donc l'équipe ne
voit pas réellement le planning du titulaire. Le téléphone est utilisable mais pas encore confortable
(grille de la semaine en caractères de 10 px, écrans denses). Le style a été écrit par couches
successives : 41 tailles de texte, 124 ombres, 176 couleurs écrites en dur.

---

## 2. Ce qui va bien

| Sujet | Constat mesuré |
| --- | --- |
| **Aucun débordement** | Sur 22 écrans et 5 largeurs, la page ne défile jamais à l'horizontale. |
| **La semaine tient** | « Construire » et « Planning de l'équipe » affichent tous les jours ouverts sans défilement, de 2000 à 360 px. |
| **Accessibilité de base** | 0 défaut détecté par axe-core sur 110 écrans en mode clair, 40 en mode sombre et 6 sur téléphone. Lien d'évitement, langue déclarée, un seul titre de niveau 1 par écran, aucun saut de niveau de titre. |
| **Fenêtres** | Le focus y est enfermé, Échap les ferme, le focus revient au bouton d'origine. |
| **Clavier** | L'ordre de tabulation suit le menu puis la page ; chaque arrêt a un indicateur visible. |
| **Mode sombre et couleurs** | Dix couleurs, un mode sombre complet, une couleur de base par profil. |
| **Rapidité à l'ouverture** | Premier bouton utilisable en moins de 0,2 s sur ordinateur, 0,4 s sur un téléphone ralenti quatre fois (hors temps de téléchargement). |
| **Clarté des décisions** | Chaque décision ouvre une fenêtre : la demande, ce qu'elle implique, les options, le message envoyé. |
| **Honnêteté** | L'application dit ce qu'elle ne sait pas : pas de coût sans taux saisi, pas de conseil médical, rien de publié sans le titulaire. |
| **Tests** | 127 tests unitaires sur le moteur ; chaque fonction rejouée par script dans un navigateur. |

---

## 3. Ce qui ne va pas

Gravité : **P0** bloque un usage réel, **P1** gêne fortement, **P2** agace, **P3** finition.

### P0 : à régler avant toute mise en service

| # | Problème | Conséquence | Piste |
| --- | --- | --- | --- |
| 1 | **Pas de serveur.** Les données vivent dans le navigateur de chaque appareil. | Le planning publié par le titulaire n'arrive pas sur le téléphone de l'équipe. Un retard « signalé » ne prévient personne en dehors de l'appareil. Toute l'application multi-utilisateurs est aujourd'hui une démonstration sur un seul écran. | Un serveur : comptes, base de données partagée, droits par rôle, notifications. C'est le chantier numéro un, avant toute application mobile. |
| 2 | **Aucune sauvegarde.** Vider les données du navigateur efface la pharmacie. | Perte totale et définitive. | Avec le serveur. En attendant : un export et un import complets. |
| 3 | **Mots de passe et données en clair sur l'appareil.** L'empreinte du mot de passe n'est pas cryptographique ; arrêts et accidents du travail sont lisibles dans le stockage du navigateur. | Aucune confidentialité réelle entre deux personnes qui partagent un poste. | Authentification côté serveur. Hébergement et traitement des données à faire valider (RGPD). |
| 4 | **Le bouton « Retour » du téléphone quitte l'application.** Il n'y a pas d'adresse par écran. | Sur Android, le geste retour ferme Solvéa au lieu de revenir à l'écran précédent. Impossible d'envoyer un lien vers un écran. | Un routeur : une adresse par écran et par fenêtre ouverte. |

> Un cinquième P0 a été trouvé pendant ce bilan et **corrigé** : le planning de l'équipe, vu par les
> salariés, était coupé après le vendredi à toutes les tailles d'écran. Il tient maintenant en entier.

### P1 : gêne forte

| # | Problème | Où | Piste |
| --- | --- | --- | --- |
| 5 | **Grille de la semaine sur téléphone.** Sept jours dans 390 px : 72 textes sur 106 font moins de 11 px. Lisible, pas confortable. | Construire, Planning de l'équipe | Sur téléphone, une vue « jour par jour » par défaut (on balaie d'un jour à l'autre) ; la semaine reste en aperçu. |
| 6 | **Cibles tactiles.** Mesuré avant correction : 8 à 35 éléments par écran sous 44 px. **Corrigé pendant ce bilan** : sur écran tactile, boutons, listes et champs font 44 px ; il reste les tuiles de la grille, étroites par nature sur téléphone. | Construire, Planning de l'équipe | Réglé par la vue « jour par jour » du point 5. À confirmer sur de vrais téléphones. |
| 7 | **Calculs qui figent l'écran.** Les trois propositions prennent 1,4 s sur ordinateur, sans progression ; plusieurs secondes sur un téléphone. | Proposer un planning | Calcul dans un fil séparé, avec une vraie barre de progression. |
| 8 | **« Résoudre » est lent sur téléphone** : 0,75 s d'écran figé à l'ouverture (0,2 s sur ordinateur). | Résoudre | Ne calculer les options d'un poste que lorsqu'on l'ouvre. |
| 9 | **Déplacer un poste ne marche qu'à la souris.** Le glisser-déposer n'existe pas au doigt ni au clavier. | Construire | Une action « Déplacer vers… » dans la fenêtre du poste. |
| 10 | **Solvi recouvre du contenu.** Le bouton d'aide flotte sur le coin bas droit : dernière colonne de la grille, fin de phrases. | Tous les écrans, surtout téléphone | Réserver sa place en bas de page, ou le ranger dans la barre du bas sur téléphone. |
| 11 | **Trop de place prise avant le contenu.** Sur un écran de 900 px de haut, la grille commence à 390 px. | Construire | Regrouper titre et commandes sur une ligne ; barre de test repliable. |
| 12 | **Deux moteurs de visite guidée** (le tutoriel en 11 étapes et les visites avec Solvi). | Aide | N'en garder qu'un. |
| 13 | **La visite « Titulaire » dure 30 minutes** (55 étapes). | Visites | La proposer par chapitres indépendants ; les tutoriels par tâche existent déjà. |
| 14 | **Les visites guidées sont longues à revérifier** : les rejouer en entier prend près d'une heure de machine. Sur cette version, les quatre visites ont été déroulées en entier sans erreur (13, 16, 17 et 55 étapes). Dans la visite « Titulaire », douze gestes de démonstration facultatifs ne se jouaient pas : l'étape s'explique, mais Solvi ne montre pas le geste. Deux sont corrigés (les postes types), sans avoir été rejoués ; dix restent à reprendre (contrôles, compteur d'heures, tableau de bord). | Visites | Les rejouer à chaque livraison, de façon automatique. |

### P2 : agacements

| # | Problème | Piste |
| --- | --- | --- |
| 15 | **Tailles de texte en pixels.** Le réglage « texte plus grand » du téléphone est ignoré (l'option interne « texte grand » existe). | Passer aux unités relatives. |
| 16 | **Mouvement réduit : tout est coupé d'un bloc**, y compris les retours utiles. | Garder les changements d'état, retirer seulement les déplacements. |
| 17 | **Champs de date et d'heure du navigateur** : leur format dépend de l'appareil (vu en format américain dans les essais). | À vérifier sur appareils réglés en français ; sinon, champs maison. |
| 18 | **Trois tableaux défilent encore dans leur cadre sur téléphone** : postes types, points forts, frise des congés. | Les présenter en listes sur téléphone. |
| 19 | **Barre du haut sur téléphone : des icônes sans libellé.** | Libellés courts, ou regroupement. |
| 20 | **Vocabulaire à unifier** : « responsable » et « titulaire » désignent la même personne selon l'écran. | Un seul mot : titulaire. |
| 21 | **Pas d'états d'attente ni d'erreur de réseau** (logique : pas de réseau aujourd'hui). | À dessiner avec le serveur. |
| 22 | **Changement d'écran sans retour en haut** : corrigé pendant ce bilan. | Fait. |

### P3 : finition

- Les boutons « désactivés » sont seulement pâlis : dire pourquoi au survol.
- L'impression existe mais n'a pas été contrôlée sur papier.
- Aucun raccourci clavier pour les gestes fréquents (semaine suivante, annuler, publier).

---

## 4. Le détail des notes

### Usage : 29 / 40

| # | Heuristique | Note | Pourquoi |
| --- | --- | --- | --- |
| 1 | État du système visible | 3 | Messages de confirmation, compteurs, « enregistré à… ». Manque : progression des calculs. |
| 2 | Langage de l'utilisateur | 4 | Mots du métier, phrases entières, aucun code. |
| 3 | Contrôle et liberté | 3 | Annuler et rétablir dans la grille. Une publication ne s'annule pas. |
| 4 | Cohérence | 2 | Deux visites, tailles de boutons variables, deux mots pour le titulaire. |
| 5 | Prévention des erreurs | 3 | Contrôles avant publication, implications avant décision. |
| 6 | Reconnaître plutôt que se souvenir | 3 | Menu par moments de travail. Sur téléphone, beaucoup d'écrans sont derrière « Menu ». |
| 7 | Souplesse et efficacité | 2 | Pas de raccourcis, pas de recherche globale, glisser-déposer à la souris seulement. |
| 8 | Sobriété | 2 | Écrans denses, beaucoup de cadres ; le tableau de bord vient d'être allégé. |
| 9 | Aide à corriger une erreur | 3 | Les messages disent quoi faire (« prolongez son poste ou posez un autre pharmacien »). |
| 10 | Aide et documentation | 4 | Assistant, lexique, visites, tutoriels par tâche. |

### Technique : 12 / 20

| Dimension | Note | Constat principal |
| --- | --- | --- |
| Accessibilité | 3 / 4 | Aucun défaut automatique ; cibles tactiles et petits textes à reprendre ; pas d'essai au lecteur d'écran. |
| Performance | 2 / 4 | Un seul fichier de 1 Mo (300 Ko compressé) chargé d'un bloc ; calculs sur le fil principal. |
| Thèmes | 3 / 4 | Mode sombre et dix couleurs fonctionnent ; 176 couleurs encore écrites en dur. |
| Adaptation aux écrans | 2 / 4 | Rien ne déborde, mais la grille sur téléphone et les cibles tactiles restent rudes. |
| Intégrité du code | 2 / 4 | Feuille de style de 4000 lignes écrite par ajouts ; 407 styles en ligne ; un fichier de 3000 lignes. |

### Système de design : 55 / 100

| Catégorie | Défini | Hors système |
| --- | --- | --- |
| Couleurs | 84 variables | 334 couleurs en dur, 176 différentes |
| Texte | aucune échelle | 41 tailles, 9 graisses |
| Arrondis | 3 variables | Ramenés pendant ce bilan à 4, 6, 8 et 12 px (376 valeurs réduites) |
| Ombres | 2 variables | 124 ombres différentes |
| Espacements | aucune échelle | valeurs libres |
| Mouvement | 1 courbe | 197 transitions et animations |

Priorités : une échelle de 6 tailles de texte, 3 niveaux d'ombre, une échelle d'espacement, puis remplacer
les valeurs en dur. Un seul composant « bouton » avec ses tailles et ses états documentés.

---

## 5. Adaptation aux écrans : les mesures

| Largeur | Débordement de page | Éléments coupés | Cibles sous 44 px (par écran) | Textes sous 12 px |
| --- | --- | --- | --- | --- |
| 360 px | aucun | aucun | 8 à 35 (0 à 2 sur écran tactile, hors grilles) | forte dans les grilles |
| 390 px | aucun | aucun | 8 à 35 (0 à 2 sur écran tactile, hors grilles) | 72 sur 106 dans le planning de l'équipe |
| 768 px | aucun | aucun | 8 à 35 | 78 sur 121 dans « Construire » |
| 1024 px | aucun | aucun | 14 à 31 | 14 sur 53 dans « Construire » |
| 1440 px | aucun | aucun | 14 à 43 | 28 sur 127 dans « Construire » |

Lecture : l'application **tient** partout, mais elle **serre** au lieu de **réorganiser**. Tenir sept jours
dans la largeur était la demande ; sur téléphone, cela a un prix en lisibilité. D'où la recommandation
d'une vue par jour sur téléphone.

---

## 6. Faut-il construire une application mobile ?

**Non, pas une application séparée.** La bonne suite est en trois temps.

1. **D'abord le serveur.** Sans lui, une application mobile aurait le même défaut qu'aujourd'hui : des
   données enfermées dans chaque téléphone. C'est lui qui « connecte » les appareils.
2. **Ensuite, rendre cette application installable** (application web progressive) : une icône sur l'écran
   d'accueil, le plein écran, la lecture du planning hors connexion, des notifications. Sur Android, c'est
   immédiat. Sur iPhone, les notifications d'une application web installée existent depuis iOS 16.4.
3. **Si les magasins d'applications sont exigés** (App Store, Google Play) ou s'il faut du natif
   (notifications plus fiables, déverrouillage par empreinte) : empaqueter **la même application** dans une
   coquille native. Un seul code, trois sorties : web, Android, iOS.

Une réécriture native complète ne se justifie pas : rien dans Solvéa ne demande ce que le web ne sait pas
faire, et elle doublerait le travail à chaque évolution.

### Peut-on connecter les deux ?

**Oui, et c'est le serveur qui le fait.** L'application du titulaire sur ordinateur et celle de l'équipe sur
téléphone ne se parlent pas directement : elles lisent et écrivent la même base de données, avec les mêmes
comptes. Un planning publié à l'ordinateur apparaît sur les téléphones ; un retard signalé au téléphone
s'affiche chez le titulaire dans la seconde. Avec la voie proposée ci-dessus, ce n'est d'ailleurs pas « deux
applications » mais une seule, affichée sur deux écrans.

### Avec quelles briques ?

| Brique | Avis | Pourquoi |
| --- | --- | --- |
| **React** | À garder | L'application est déjà écrite avec ; rien à refaire. |
| **Supabase** | Recommandé pour le serveur | Il apporte d'un bloc ce qui manque : comptes, base PostgreSQL, droits vérifiés ligne par ligne selon le rôle, mises à jour en temps réel, hébergement possible en région européenne. Le moteur de règles de Solvéa, lui, ne change pas. |
| **Application installable**, puis **coquille native** | Recommandé pour le téléphone | La même application, installée ; les magasins d'applications seulement s'ils sont exigés. |
| **Three.js** | Non | Rien dans un planning n'appelle la 3D. Elle alourdirait une application déjà lourde (1 Mo) sans rien apporter à la lecture d'une semaine. |

Le passage à Supabase est un vrai chantier : créer le projet, décrire les tables et les droits, remplacer le
stockage local par des appels au serveur, puis migrer les écrans un à un. Il demande un compte Supabase et
ses clés, que seul le propriétaire du projet peut créer.

Ce que le serveur doit apporter : des comptes avec un vrai mot de passe, des droits par rôle vérifiés côté
serveur, une base partagée, l'envoi des notifications, une sauvegarde, un hébergement en France ou dans
l'Union européenne. Les données d'absence, d'arrêt et d'accident du travail sont des données personnelles
sensibles : le cadre (RGPD, durée de conservation, accès) est à faire valider par un professionnel.

---

## 7. Ce qui reste à vérifier

| À vérifier | Pourquoi ce n'est pas fait |
| --- | --- |
| iPhone (Safari) et Android (Chrome) réels | Les mesures viennent d'un navigateur de bureau réglé à la taille d'un téléphone. |
| Lecteur d'écran (VoiceOver, NVDA, TalkBack) | L'analyse automatique ne voit qu'environ un tiers des défauts. |
| Zoom à 200 % et texte agrandi du système | Non mesuré. |
| Vrais utilisateurs | Aucun essai avec une équipe de pharmacie. |
| Exactitude des règles de droit du travail | Les seuils sont réglables, mais leur justesse doit être validée par un professionnel. |
| Délai de déclaration d'un accident du travail | Calculé d'après la règle des 48 heures hors dimanches et jours fériés : à faire confirmer. |
| Impression | Feuille de style prévue, jamais contrôlée sur papier. |
| Les gestes facultatifs de la visite « Titulaire » | Dix gestes ne trouvent pas leur cible à ce moment de l'histoire : à reprendre un par un. |
| Gros volumes | Une équipe de 30 personnes, deux ans d'historique : temps de calcul et place dans le navigateur. |

---

## 8. Ordre de marche proposé

1. **Serveur, comptes, base partagée** (P0 1 à 3). Tout le reste en dépend.
2. **Adresses par écran et bouton retour** (P0 4).
3. **Téléphone** : vue par jour, cibles de 44 px, Solvi qui ne recouvre rien (P1 5, 6, 10).
4. **Calculs hors du fil principal** (P1 7, 8).
5. **Application installable**, puis notifications.
6. **Système de design** : échelles de texte, d'ombre et d'espacement.
7. **Essais** : téléphones réels, lecteur d'écran, puis une pharmacie pilote.
