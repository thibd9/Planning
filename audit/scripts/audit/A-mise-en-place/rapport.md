# Audit A : la mise en place, côté titulaire

Périmètre : connexion et création d'une vraie pharmacie, Réglages (5 onglets et dimensionnement), Équipe, Règles, Mon compte, plusieurs pharmacies.
Version testée : la copie publiée servie par `$S/servi.js` (dossier `heberge`), date de l'appareil : vendredi 20 novembre 2026.
Méthode : Chromium piloté par Playwright, comme un utilisateur (clics, saisies, rechargements), à 1440×900 sauf mention ; 1280×760 et 390×800 pour l'ergonomie (onglets et accordéons dans leur état réel, `PLIE=1`).
Une vraie pharmacie a été créée de bout en bout sans passer par l'exemple : « Pharmacie des Tilleuls », titulaire principale Claire Martin, 7 personnes. L'exemple (Caroline, Pierre, Nicolas, Sarah, Manon) a servi pour le retrait d'une personne, le quota de pharmaciens, les profils et les préférences d'apparence.

Tous les chemins de preuve sont relatifs à `/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/A-mise-en-place/` : scripts `a1-…js` à `a14-…js`, journaux `a1.log` à `a14.log`, captures dans `captures/`. Aucune erreur de console n'a été relevée pendant les 14 scripts.

Note d'environnement : dans le navigateur de test, les champs heure et date s'affichent au format anglais (« 08:30 AM », « mm/dd/yyyy ») malgré la langue française du contexte. C'est un effet du moteur de test ; ce n'est pas retenu comme défaut.

---

## 1. Fonctions testées

### 1.1 Connexion et création d'une vraie pharmacie

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Connexion, appareil vide | Page de connexion sur un appareil vide : bouton vide, puis identifiant « personne » / « abcdef » | Fonctionne | « Se connecter » reste désactivé tant qu'un champ est vide ; à l'envoi : « Aucun compte n'existe encore sur cet appareil. Créez votre pharmacie… ». Le lien « Mot de passe oublié » est masqué sur un appareil vide. | | a1.log ; captures/a1-01-connexion.png |
| Assistant, étape 1 : erreurs | Nom vide, ouverture 19:00 / fermeture 08:00, coupure 15:00-13:00, samedi 13:00-09:00 | Fonctionne | 4 erreurs listées en tête et sous chaque champ : nom, « la fermeture doit suivre l'ouverture », « la coupure du midi doit se situer entre l'ouverture et la fermeture », samedi. Un nom fait d'espaces est refusé. | | a1.log ; captures/a1-03-etape1-erreurs.png |
| Assistant, surface | Surface « -50 » | Ne fonctionne pas | Aucune erreur : la valeur est ignorée en silence. La pharmacie créée reçoit 180 m² (voir ligne suivante). | Mineur | a1.log (« surface:180 ») |
| Valeurs de départ d'une pharmacie neuve | Création sans rien saisir dans « L'officine en chiffres », puis Réglages | Ne fonctionne pas | La pharmacie neuve reçoit les chiffres de la pharmacie d'exemple : surface 180 m², vente 110 m², réserve 45 m², 3 caisses, 4 comptoirs, 1 espace de confidentialité, 240 clients par jour. L'en-tête de Réglages affiche « 180 m² au total · 110 m² de surface de vente · 45 m² de réserve » et le dimensionnement conclut « 3 au comptoir, 5 à la pointe » sur ces chiffres fictifs, alors que tout est présenté comme « Facultatif ». Reproduit sur une 2e pharmacie ajoutée (même jeu de valeurs). | Majeur | a3.log (« CHIFFRES préremplis ») ; a8.log (« infos {"surfaceVente":110…} ») ; captures/a3-01-reglages.png |
| Assistant, étape 2 : erreurs | Titulaire vide, identifiant « ab », mot de passe « 123 », pharmacien avec prénom seul, préparateur à 60 h | Fonctionne | 6 erreurs claires, chacune reliée à son champ. | | a1.log ; captures/a1-05-etape2-erreurs.png |
| Assistant, heures du titulaire principal | Heures du titulaire : 200 | Ne fonctionne pas | 200 h acceptées sans contrôle (le champ annonce un maximum de 70, les autres lignes sont contrôlées de 1 à 48). Conséquence visible dans Construire : « Claire M. 56 h 30 / 200 h · - 143 h 30 » en rouge. Les 200 h sont recopiées dans la 2e pharmacie. | Mineur | a1.log ; captures/a4-02-construire-decembre.png ; a8.log |
| Assistant, lignes vides et retours | Ligne « étudiant » laissée vide ; « Modifier la pharmacie » puis retour | Fonctionne | La ligne vide est ignorée ; nom, surface, prénom, heures et mot de passe sont conservés en revenant en arrière. Un double clic sur « Créer mon officine » ne crée qu'une pharmacie. | | a1.log ; a12.log |
| Création, connexion immédiate | « Créer mon officine » | Fonctionne | La titulaire est connectée d'emblée, le tutoriel (11 étapes) s'ouvre. Identifiant et mot de passe provisoire générés pour chaque membre (prenom.nom, 6 chiffres). | | a1.log ; captures/a1-07-apres-creation.png, a1-08-tour1.png |
| Clé de secours à la création | Lecture de tout l'écran de création, du récapitulatif et des 11 étapes du tutoriel | Ne fonctionne pas | La clé de secours (ici « DL2O-7UL8 ») n'est montrée nulle part pendant la création. L'écran « Mot de passe oublié » dit pourtant « à noter lors de la création ». Elle n'est visible que dans « Mon compte ». Une titulaire qui oublie son mot de passe sans être passée par « Mon compte » perd l'accès. | Majeur | a1.log (tutoriel) ; a2.log (texte de l'écran oubli) |
| Préparation automatique à la création | Première ouverture d'une pharmacie neuve | Partiel | Sans rien demander, Solvéa prépare tout décembre en brouillon (152 postes, 5 semaines) car l'échéance de publication (17 novembre) est passée. Le tableau de bord écrit « Préparé par Solvéa d'après vos habitudes » alors que la pharmacie n'a aucun historique ; Résoudre coche « Étape 2 · faite : Construire une première semaine » alors que rien n'a été construit, et liste « À publier 2 » avec « Planning à construire ». Les samedis sont préparés de 9 h à 19 h alors que la pharmacie ferme à 13 h le samedi (voir 1.2). Même effet à l'ajout d'une 2e pharmacie (84 postes) et d'une 3e (28 postes). | Majeur | a2.log ; captures/a2-03-tableau-neuf.png, a2-02-resoudre-neuf.png ; a8.log |
| Rechargement | Rechargement de la page après création | Fonctionne | Session, données et vue « Tableau de bord » conservées ; le tutoriel ne se relance pas. | | a2.log |
| Déconnexion, reconnexion | Menu du compte > Se déconnecter, puis « CLAIRE@TILLEULS.FR » avec espaces | Fonctionne | La casse et les espaces sont tolérés. | | a2.log |
| Mauvais mot de passe | « mauvais1 » | Fonctionne | « Identifiant ou mot de passe incorrect. » | | captures/a2-04-mauvais-mdp.png |
| Mot de passe oublié, titulaire principal | Identifiant d'un salarié ; clé fausse ; nouveau mot de passe de 3 caractères ; clé juste en minuscules | Fonctionne | Messages justes à chaque cas ; la clé est acceptée en minuscules ; l'ancien mot de passe ne marche plus, le nouveau oui ; le nouveau mot de passe vaut aussi dans les autres pharmacies de la titulaire. | | a2.log ; captures/a2-05-oubli.png |
| Mot de passe oublié, membre | Écran « Mot de passe oublié » ; bouton « Nouveau mot de passe provisoire » dans la fiche | Fonctionne | Le membre est renvoyé vers le titulaire ; le titulaire régénère un provisoire (257674 → 355272). | | a2.log ; a6.log |
| Première connexion d'un membre | Julie Bernard se connecte avec son mot de passe provisoire | Partiel | Aucun changement de mot de passe n'est imposé ni même proposé : pas de bandeau, pas de rappel ; seule une pastille « Mot de passe provisoire » dans « Mon compte ». Tant qu'il n'est pas changé, le provisoire reste affiché en clair dans la fiche « Équipe » (et enregistré en clair sur l'appareil). Le changement par Julie fonctionne (ancien faux refusé, pastille « Mot de passe personnel », la fiche du titulaire n'affiche plus le code). | Majeur | a2.log ; captures/a2-06-julie-premiere-connexion.png, a2-07-julie-compte.png |
| Effacer l'appareil depuis la connexion | Exemple chargé, déconnexion, « Mot de passe oublié » > saisir « effacer » > « Tout effacer et recommencer » | Ne fonctionne pas | Sans aucun mot de passe, n'importe qui devant l'appareil efface toutes les pharmacies, équipes, plannings et comptes (« effacer » en minuscules suffit). Sur un poste partagé au comptoir, un salarié peut tout supprimer. | Bloquant | a12.log ; captures/a12-01-tout-efface.png |
| Bouton Retour du navigateur | Équipe puis Réglages, puis Retour | Partiel | L'application n'écrit rien dans l'historique : Retour quitte Solvéa (page précédente du navigateur) au lieu de revenir à l'écran précédent. | Mineur | a12.log |

### 1.2 Réglages (5 onglets) et effets ailleurs

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Nom de la pharmacie | Vider le nom | Partiel | Accepté sans alerte : la barre du haut et le titre affichent « Mon officine », le sélecteur de pharmacie montre une option vide. | Mineur | a3.log ; captures/a3-02-nom-vide.png |
| L'officine en chiffres | Saisies 0, vide, valeurs hautes | Fonctionne | Valeurs bornées (5000 m², 40 caisses…), une valeur vidée disparaît. Le défaut est l'héritage des chiffres de l'exemple (1.1). | | a3.log |
| Horaires : plages incohérentes | Mercredi : fermeture 07:00 après une réouverture à 14:00 ; mardi : fermeture du midi 15:00 après la réouverture 14:00 | Ne fonctionne pas | Les deux sont enregistrés sans aucune alerte (mercredi `{840→420}`, mardi deux plages qui se chevauchent). L'assistant de création refuse ces cas, Réglages les accepte. | Majeur | a3.log ; captures/a3-03-mercredi-incoherent.png |
| Horaires : coupure, recopier | Ajouter et retirer la coupure ; « Copier la veille » ; « Appliquer aux autres jours ouverts » | Fonctionne | Recopie exacte, message avec « Annuler ». Le bouton de coupure n'est proposé que sur une plage de plus de 4 h (pas sur un samedi 9 h-13 h). | | a3.log |
| Fermer un jour | Fermer le jeudi, puis Construire | Partiel | La colonne du jeudi est fermée, sans « + », dans les semaines vides. Mais les postes déjà posés ce jour-là (5 postes le jeudi 3 décembre, préparés par Solvéa) restent affichés dans la colonne fermée, sans aucune alerte dans les contrôles. | Majeur | a4.log ; captures/a4-02-construire-decembre.png |
| Ouvrir le dimanche | « Ouvrir ce jour : dimanche » | Partiel | La colonne s'ouvre, les contrôles signalent aussitôt « dimanche 6 décembre, de 9 h à 19 h, sans pharmacien ». Mais aucun effectif attendu ni poste type n'est créé pour ce jour : le seul poste type proposé le dimanche est celui créé « tous les jours ». | Mineur | a4.log |
| Horaires réduits et postes types | Samedi ouvert de 9 h à 13 h dès la création | Ne fonctionne pas | Les postes types « Samedi après-midi 14 h-19 h » et « Samedi journée 9 h-19 h » sont conservés ; la préparation automatique pose des postes de 9 h à 19 h le samedi ; la ligne « Équipe au complet ? » affiche « Complet » et aucun contrôle ne signale un poste hors des heures d'ouverture. Les effectifs attendus du samedi restent de 9 h à 19 h. | Majeur | a4.log (« samedi 5 déc. … 9-19, 9-19, 9-19 ») ; captures/a4-02-construire-decembre.png |
| Jours fériés | Case cochée puis décochée, semaine du 21 décembre | Fonctionne | Cochée : le vendredi 25 décembre est une colonne fermée. Décochée : il est ouvert avec ses « + ». | | a4.log ; captures/a4-04-noel-ouvert.png |
| Effectif attendu | Minimum -3, vide, 9 | Partiel | -3 est enregistré tel quel ; vidé, le champ vaut 0. Les plages (jours, heures) ne sont pas modifiables et aucune ne peut être ajoutée ou retirée. L'effet sur Construire fonctionne : minimum 9 donne 26 alertes « 5 personnes au comptoir pour 9 attendues ». | Mineur | a3.log ; a5.log |
| Dimensionnement | Lecture, puis activité 2 900 000 € | Partiel | Calcul affiché sur les chiffres hérités de l'exemple (1.1) ; résultat contradictoire avec le quota de l'écran Équipe (1.3). | Majeur | a3.log ; a5.log ; captures/a5-07-dimensionnement-quota.png |
| Qui prépare : « Vous seul » | Exemple : « Vous seul », puis Nicolas > Mes demandes, Construire | Fonctionne | La carte « Mes préférences » disparaît pour Nicolas, la case « Préférences » disparaît de Construire ; retour à « Avec l'équipe » : elle revient. | | a9.log ; captures/a9-avec-equipe-nicolas-demandes.png, a9-vous-seul-nicolas-demandes.png |
| Date limite des préférences et publication | Réglages par défaut, puis limite au 28 | Ne fonctionne pas | Par défaut, les préférences de décembre se donnent jusqu'au 20 novembre alors que le planning de décembre doit être publié au plus tard le 17 novembre. Une limite au 28 est aussi acceptée. Aucune alerte. Dans l'exemple, Nicolas voit « Dernier jour » pour ses préférences le 20 novembre, trois jours après l'échéance de publication. | Majeur | a3.log ; captures/a3-04-limite-vs-publication.png ; a9.log |
| Publication au mois | Délai 0, 100, -5, vide ; rappel 40 | Fonctionne | Délai ramené entre 1 et 45, rappel plafonné à 30 ; la phrase d'exemple (« rappel à partir du 10 novembre, à publier au plus tard le 17 novembre ») suit. | | a3.log |
| Préparation automatique (relais) | Case cochée par défaut | Partiel | Elle se déclenche dès la première ouverture d'une pharmacie neuve, avant que la titulaire ait pu la décocher (voir 1.1). | Majeur | a2.log |
| Postes types : création | Fin avant début ; poste 6 h-23 h « tous les jours » | Partiel | Fin avant début refusée avec message. Un poste de 6 h à 23 h tous les jours, dimanche fermé compris, est accepté sans remarque. Seuls 4 choix de jours (semaine, samedi, lundi-samedi, tous les jours) : impossible de créer un poste « mercredi seulement » ou « dimanche seulement ». | Mineur | a3.log ; captures/a3-05-poste-type-hors-horaires.png |
| Postes types : modification en ligne | Fin du poste « Matin » passée à 07:00 | Ne fonctionne pas | Enregistré sans alerte ; la colonne affiche « Travail effectif −1 h 30 ». Les jours et la pause d'un poste existant ne sont pas modifiables (pas de champ), un poste sans pause ne peut pas en recevoir une. | Mineur | a3.log |
| Postes types : suppression et effet | Retirer « Fermeture », puis le dialogue d'un poste dans Construire | Partiel | Le poste n'est plus proposé dans Construire (effet correct). Mais la suppression est immédiate, sans confirmation, sans message ni « Annuler ». | Mineur | a3.log ; a4.log ; captures/a4-03-dialogue-poste-lundi.png |
| Postes types : couleur | Couleur choisie au nuancier | Fonctionne | Enregistrée et appliquée à l'aperçu. | | a3.log |
| Paramètres et coûts | Valeur du point -2, demandes prioritaires -4, CA 2 900 000, coûts affichés | Partiel | Valeurs négatives acceptées ; le résumé affiche « Valeur du point : -2 € · -4 demande prioritaire par personne ». La case « Afficher les coûts » fait bien apparaître le taux horaire dans les fiches. | Mineur | a3.log ; captures/a3-06-parametres.png |
| Repartir de zéro | Bruno, titulaire d'une 3e pharmacie créée sur le même appareil : Réglages > Réinitialiser > Oui | Ne fonctionne pas | Efface toutes les pharmacies de l'appareil, y compris les deux de Claire Martin, qui ne peut plus se connecter (« Aucun compte n'existe encore sur cet appareil »). Rien ne peut être annulé. Le bouton est aussi offert à un titulaire secondaire, qui l'a exécuté sans accord du principal (exemple, Pierre), et à une préparatrice à qui l'on a donné l'accès gestion (Léa). Le texte annonce « efface l'officine » et « ramène à l'écran de création » ; on arrive en fait sur la connexion. | Bloquant | a8.log ; a9.log ; a6.log ; captures/a8-03-repartir-de-zero-confirmation.png, a8-04-apres-remise-a-zero.png |
| Droits du titulaire secondaire sur les réglages | Exemple, Pierre : renommer la pharmacie, baisser le repos quotidien à 9 h, changer les heures de Nicolas, retirer Nicolas | Partiel | Renommer, régler une règle légale et changer un contrat s'appliquent aussitôt, sans accord ; seul le retrait de Nicolas part « pour accord ». La fiche dit pourtant que « chacune de ses décisions … attend l'accord » du principal. | Majeur | a9.log ; captures/a9-pierre-retrait-accord.png |

### 1.3 Équipe

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Ajouter : champs obligatoires | Prénom et nom vides | Fonctionne | « Ajouter » reste désactivé. | | a6.log ; captures/a6-02-ajout-dialogue.png |
| Ajouter : valeurs hors bornes | Zoé Faure 200 h, taux -10 € ; Yves Noir -8 h | Ne fonctionne pas | 200 h et -10 € enregistrés ; -8 h devient 1 h sans message (puis l'écran signale « contrat de 1 h, sous le minimum de 16 h »). | Mineur | a6.log ; captures/a6-05-claire-preparatrice.png |
| Ajouter : homonyme | 2e « Julie Bernard » | Fonctionne | Identifiant distinct `julie.bernard2`. | | a6.log |
| Ajouter : remplaçant titulaire | Cocher « Remplaçant habituel », puis choisir « Pharmacien titulaire » | Ne fonctionne pas | La case disparaît mais reste active : la personne est créée titulaire et extérieure à la fois (« Remplaçant », contrat « Titulaire (non salarié) », sans identifiant). | Mineur | a6.log ; captures/a6-03-remi-titulaire-exterieur.png |
| Fiche : heures | -5, 0, 100, vide | Ne fonctionne pas | Toutes les valeurs sont enregistrées telles quelles (vide = 0) ; le champ annonce 0 à 48. | Mineur | a6.log |
| Fiche : contrat | Liste des contrats d'un préparateur, choix CDD | Fonctionne | CDI, CDD, apprentissage, professionnalisation, stage, remplacement ponctuel ; titulaire limité à « non salarié ». | | a6.log |
| Fiche : date d'entrée | 15/03/2018, puis 01/05/2031 | Fonctionne | « Ancienneté : 8 ans et 8 mois » ; une date future est acceptée avec « pas encore arrivé ». | | a6.log |
| Fiche : fonction | Julie (pharmacienne avec « Entretiens pharmaceutiques ») passée préparatrice | Ne fonctionne pas | La compétence réservée aux pharmaciens est conservée ; le bouton est affiché coché et verrouillé, donc impossible à retirer tant qu'elle est préparatrice. | Majeur | a6.log ; captures/a6-04-julie-preparatrice-competence-reservee.png |
| Fiche : fonction du titulaire principal | Claire passe sa propre fonction à « Préparateur » | Partiel | Accepté sans avertissement : elle reste « Espace titulaire » et titulaire principale, mais sa fiche dit « Préparateur », salariée, 200 h. | Mineur | a6.log ; captures/a6-05-claire-preparatrice.png |
| Fiche : compétences réservées | Préparateur | Fonctionne | « Tests angine et cystite » et « Entretiens pharmaceutiques » verrouillés avec la raison. | | a6.log |
| Fiche : besoin et absence | Exemple, Nicolas : congé 26-27 novembre (fin avant début testée), besoin « Mercredi », retrait d'un besoin | Fonctionne | Fin avant début : bouton désactivé. L'absence est approuvée d'office et crée 2 postes à couvrir (trous 3 → 5) ; le besoin apparaît « Simple préférence » ; le retrait est immédiat avec « Annuler ». | | a14.log ; captures/a14-01-fiche-besoins-absences.png |
| Marques d'une animatrice | Inès : ajouter « Avène », doublon « avène », familles, vider le nom | Partiel | Ajout et répertoire corrects, doublon refusé (« Inès présente déjà cette marque »). Mais un nom de marque vidé dans la fiche est enregistré vide (`""`). | Mineur | a6.log ; captures/a6-06-marques.png |
| Droits d'accès | Gestion donnée à Léa (préparatrice), puis connexion de Léa | Fonctionne | Léa arrive dans « Espace gestion » avec tout le menu ; le dimensionnement lui est masqué. Elle voit aussi « Repartir de zéro » (défaut bloquant, 1.2). | | a6.log ; captures/a6-08-lea-gestion-reglages.png |
| Mot de passe d'un membre | « Nouveau mot de passe provisoire » | Fonctionne | Nouveau code affiché, l'ancien ne marche plus. | | a6.log |
| Retirer une personne qui a des postes publiés | Exemple : retirer Igor (51 postes publiés dont 11 à venir, 2 gardes, 2 demandes de remplacement, 1 arrêt) | Ne fonctionne pas | Ses postes disparaissent de la version publiée sans créer de poste à couvrir : le vendredi 20 novembre, de 16 h 30 à 19 h 30, reste sans pharmacien (bloquant dans Construire) mais Résoudre passe de 1 absence à 0. Sa garde du 31 décembre passe « à affecter » sans annonce. Ses 2 demandes de remplacement restent ouvertes : Résoudre affiche une carte « ? · - demande à être remplacé sam. 21 novembre, 9 h-14 h » et la cloche « Un collègue attend un volontaire ». L'annonce « 3 postes à couvrir » reste affichée. Le retrait n'est pas noté au journal (« dossier de preuve »). La confirmation ne parle que de « postes, besoins et absences ». Le toast « Annuler » permet de revenir en arrière. | Majeur | a7.log ; a7b.log ; captures/a7-06-resoudre-remplacement-orphelin.png, a7-07-cloche-apres-retrait.png, a7-05-construire-apres-retrait.png, a7-02-confirmation-retrait.png |
| Quota « 1,8 / 2 équivalent temps plein » | Exemple : lecture ; Tilleuls : CA 2 900 000 dans Paramètres, activité 2 900 000 dans le dimensionnement, tranche de la règle passée à 900 000 € | Partiel | L'arithmétique est juste selon la formule de l'écran Équipe : pharmaciens adjoints Igor 35 h + Léa 28 h = 63 h / 35 = 1,8 ; 2 900 000 / 1 300 000 = 2 tranches. Mais deux calculs coexistent et se contredisent : Équipe ne compte que les adjoints, sans plafonner un adjoint au-delà de 35 h, et lit le CA de « Paramètres » ; le dimensionnement compte aussi les titulaires associés à temps plein, plafonne chacun à 1 et lit un autre champ (« Activité annuelle »). Aux Tilleuls : Équipe « 1 / 2, Sous le seuil » et dimensionnement « il faut au moins 2 … Vous en comptez 2 ». Avec la tranche à 900 000 € : Équipe « 1 / 3 », dimensionnement inchangé (texte figé « 1,3 million d'euros »). Dans l'exemple, le dimensionnement n'affiche pas la règle (champ activité vide) et juge les pharmaciens « Plus qu'il n'en faut » pendant qu'Équipe dit « Sous le seuil ». L'étiquette dit « Pharmaciens » alors que les titulaires sont exclus. | Majeur | a5.log ; a7.log ; captures/a5-06-equipe-quota.png, a5-07-dimensionnement-quota.png, a7-01-equipe-exemple.png |

### 1.4 Règles

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Filtres | Toutes, Obligatoires, Réglables, À faire valider | Fonctionne | Compteurs justes (24, 12, 20, 11) et listes conformes. « Réglables » contient 8 règles obligatoires. | | a5.log ; captures/a5-01-regles.png |
| Ouvrir une règle | « Durée quotidienne maximale » | Fonctionne | Description, seuil, source, date d'effet, version. | | captures/a5-02-regle-obligatoire-ouverte.png |
| Changer un seuil et son effet | 10 h → 8 h, puis Construire (semaine du 30 novembre) | Fonctionne | Version 1.1, noté au journal ; Construire affiche aussitôt 5 « À corriger » (« Julie B. : 9 h 30 de travail lundi, pour 8 h au plus »). | | a5.log ; captures/a5-03-construire-seuil-8h.png |
| Seuils hors de toute borne | Durée quotidienne -5 h, puis 30 h ; repos quotidien 2 h | Ne fonctionne pas | Tout est accepté, y compris sur des règles marquées « Obligatoire : le planning ne peut pas l'enfreindre » et sur le repos quotidien noté « Lue sur le texte ». Un titulaire secondaire peut le faire sans accord (1.2). | Majeur | a5.log ; captures/a5-04-regles-seuils-absurdes.png |
| Me prévenir | Désactiver « Effectif minimal au comptoir » | Partiel | Les alertes d'effectif disparaissent des contrôles, la règle est marquée « Désactivée ». Mais la ligne « Équipe au complet ? » de la grille affiche toujours « Manque du monde 13 h-13 h 30 ». | Mineur | a5.log ; captures/a5-05-construire-sans-alerte-effectif.png |

### 1.5 Mon compte

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Apparence | Clair, mixte, sombre, « Comme l'appareil » avec appareil sombre puis clair | Fonctionne | Appliqué aussitôt ; « auto » suit l'appareil en direct. | | a10.log ; captures/a10-02-compte-caroline-sombre.png |
| Couleur | Caroline (principale) choisit Framboise ; Nicolas et Pierre | Fonctionne | Seule la principale a le choix ; les autres voient la couleur de leur profil. | | a10.log ; captures/a10-04-compte-nicolas-mixte.png |
| Taille du texte, disposition | Grand ; « Priorité d'abord » | Fonctionne | Le tableau de bord passe en disposition « classique ». | | a10.log ; captures/a10-03-tableau-classique-sombre.png |
| Choix propres à chacun et gardés | Rechargement ; passage à Nicolas (mixte) et retour à Caroline | Fonctionne | Enregistrés par identifiant, gardés au rechargement, distincts d'une personne à l'autre, communs aux pharmacies d'une même titulaire. Ils survivent à « Repartir de zéro » (préférences de comptes effacés restées sur l'appareil). | | a10.log ; a8.log |
| Mot de passe | Actuel faux ; nouveau de 3 caractères ; correct | Fonctionne | Messages justes. | | a10.log ; a2.log |
| Clé de secours | Caroline, Pierre, Nicolas | Fonctionne | Affichée seulement à la principale. | | a10.log |
| Se déconnecter depuis Mon compte | Exemple, Caroline avec 4 sujets en cours | Partiel | Par le menu du compte, un point d'étape « 4 sujets en cours » s'affiche ; par le bouton de « Mon compte », la déconnexion est immédiate. | Mineur | a13.log ; captures/a13-02-point-etape-deconnexion.png |
| Relancer le tutoriel | Bouton de « Mon compte » | Fonctionne | Le tutoriel repart à l'étape 1 sur 11. | | a10.log |

### 1.6 Plusieurs pharmacies

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Ajouter une pharmacie | Menu du compte > Ajouter une pharmacie (« Pharmacie du Port », Hugo, Marc) | Fonctionne | La titulaire est préremplie, même identifiant, même mot de passe, même clé de secours ; la nouvelle pharmacie s'ouvre. Elle hérite des chiffres de l'exemple et d'un décembre préparé (1.1). | | a8.log ; captures/a8-01-ajout-pharmacie.png, a8-02-pharmacie2-tableau.png |
| Passer de l'une à l'autre | Sélecteur du menu latéral, menu du compte | Fonctionne | Équipe, plannings et tableau de bord distincts ; les données ne se mélangent pas. | | a8.log |
| Connexion d'un membre d'une autre pharmacie | Pharmacie 1 ouverte, connexion de Hugo (pharmacie 2) | Fonctionne | Hugo arrive dans sa pharmacie, sans sélecteur. Claire, en se reconnectant, retrouve la dernière pharmacie ouverte. | | a8.log |
| Nouveau compte sur un appareil déjà utilisé | Déconnecté, « Créer ma pharmacie » : identifiant de Claire en majuscules, puis celui d'un salarié d'une autre pharmacie, puis un nouveau | Fonctionne | Les deux premiers sont refusés (« déjà un compte sur cet appareil »). Bruno ne voit que sa pharmacie. Mais il peut effacer celles de Claire (1.2, bloquant). | | a8.log |
| Identifiants uniques | Marc Petit dans les deux pharmacies | Fonctionne | `marc.petit` et `marc.petit2`. | | a8.log |

---

## 2. Ergonomie et interface

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Création sur téléphone, étape 1 | 390×800, « Créer ma pharmacie » | Ne fonctionne pas | La page fait 600 px de large pour un écran de 390 : le texte est coupé à droite, « Continuer : l'équipe » est hors de l'écran, il faut faire défiler l'écran de côté. Cause visible : les trois cartes d'apparence côte à côte ne passent pas à la ligne. | Majeur | a11-390.log (« PAGE déborde de 210px ») ; captures/e-390-creation-1-ecran.png, e-390-creation-1.png |
| Création sur téléphone, étape 2 | 390×800, étape « Votre équipe » | Ne fonctionne pas | Page décalée et coupée des deux côtés (champ « Nom » et « Continuer : vérif… » tronqués) ; débordement de 154 px mesuré. | Majeur | a11-390.log ; captures/e-390-creation-2-identifiant.png |
| Création sur téléphone, barre d'actions | 390×800 | Partiel | La barre « Retour / Continuer » collante recouvre les champs (Surface à l'étape 1, Identifiant à l'étape 2). | Mineur | captures/e-390-creation-1-ecran.png, e-390-creation-2-identifiant.png |
| Création, appareil vide | Bouton « J'ai déjà un compte » | Partiel | Proposé alors qu'aucun compte n'existe ; il renvoie à une connexion qui répond « Aucun compte ». Clic inutile. | Mineur | a12.log ; captures/e-390-creation-1.png |
| Création, erreur de surface | Surface -50 | Partiel | Valeur rejetée sans message (voir 1.1). | Mineur | a1.log |
| Barre du haut, nom de la pharmacie | 1280×760 et 1440×900 | Partiel | Le nom passe derrière l'étiquette « Espace titulaire » et se réduit à « r… » (1280) ou « rm… » (1440, texte grand) ; le sélecteur du menu latéral coupe « Grande Pharmacie de la P… ». | Cosmétique | captures/e-1280-reglages-horaires.png, a10-02-compte-caroline-sombre.png, a7-06-resoudre-remplacement-orphelin.png |
| Bulle d'aide flottante | 1280×760 et 1440×900 | Partiel | La bulle « Aide » recouvre « Fermer ce jour » du vendredi (Réglages) et « Construire la semaine » (Résoudre). | Mineur | captures/e-1280-reglages-horaires.png, a2-02-resoudre-neuf.png |
| Réglages sur téléphone, onglets | 390×800 | Partiel | Seuls « Pharmacie », « Horaires » et « Comptoi… » sont visibles ; « Planning » et « Paramètres » sont hors écran sans indice de défilement. Les actions de chaque jour deviennent trois icônes sans texte. | Mineur | captures/e-390-reglages-horaires.png |
| Réglages, horaires | Plage incohérente | Ne fonctionne pas | Aucune bordure, aucun message sur une fermeture avant l'ouverture (1.2). | Majeur | captures/a3-03-mercredi-incoherent.png |
| Réglages, postes types | Suppression, fin avant début | Partiel | Suppression d'un clic sans confirmation ni « Annuler » ; « −1 h 30 » de travail affiché sans alerte. | Mineur | a3.log |
| Réglages, « Repartir de zéro » | Confirmation | Ne fonctionne pas | La confirmation « Tout effacer et revenir à l'écran de création ? » ne dit pas que toutes les pharmacies de l'appareil seront effacées ni que c'est sans retour. | Majeur | captures/a8-03-repartir-de-zero-confirmation.png |
| Réglages, effectif | Tableau | Partiel | Plages en lecture seule, valeur négative acceptée sans message. | Mineur | a3.log |
| Équipe, choix d'une personne | 1280×760, Sarah en bas de la liste | Partiel | La fiche reste défilée à la même hauteur que la liste : on arrive au milieu des compétences, sans voir le nom de la personne choisie. | Mineur | captures/e-1280-equipe-fiche-animatrice.png |
| Équipe sur téléphone | 390×800, choix de Sarah | Partiel | La fiche s'affiche sous toute la liste (14 personnes) sans défilement automatique ; le bouton « Nouveau mot de passe provisoire » dépasse à droite (186 → 440 px). | Mineur | captures/e-390-equipe-fiche-animatrice.png ; a11-390.log |
| Équipe, confirmation de retrait | « Retirer de l'équipe » | Partiel | Confirmation en deux clics, mais le texte omet les postes publiés, les gardes et les demandes en cours. | Mineur | captures/a7-02-confirmation-retrait.png |
| Équipe, fenêtre « Besoin ou absence » | Fiche de Léa | Partiel | Le champ dit « Raison de la demande (facultatif) » et la ligne juste dessous « Une raison est demandée pour chaque demande ». | Mineur | captures/a6-07-besoin-dialogue.png |
| Équipe, textes | Marques d'Inès, toasts | Partiel | « les marques que Inès anime », « les marques de Inès » (élision manquante), « Zoé Faure ajouté ». | Cosmétique | a6.log |
| Règles, journal | Changement de la tranche | Partiel | Le journal écrit « Valeur : 900000 → 1300000 € » sans séparateur de milliers. | Cosmétique | a5.log |
| Menu rapide d'apparence | Mode « Comme l'appareil », appareil sombre | Partiel | Le menu du compte n'a pas l'option « Comme l'appareil » et marque « Sombre » comme choisi. | Cosmétique | captures/a10-05-menu-apparence-auto.png |
| Deux « Paramètres » | Menu du compte et Réglages | Partiel | « Paramètres » du menu du compte ouvre « Mon compte » (apparence) ; l'onglet « Paramètres » de Réglages règle la valeur du point et les coûts. | Mineur | a8.log (menu du compte) ; captures/e-1280-reglages-parametres.png |
| Tutoriel | Étapes 1 et 6 ; carte « Tutoriel » de Mon compte | Partiel | Étape 1 : « relancer avec le bouton « Tutoriel », en haut de l'écran » : ce bouton n'existe pas (la barre a « Aide et tutoriels », la relance est dans « Mon compte »). Étape 6 : « La ligne « Couverture » » s'appelle « Équipe au complet ? ». « Mon compte » annonce « Dix étapes » pour un tutoriel de 11. | Mineur | a1.log ; a12.log ; captures/a4-02-construire-decembre.png ; a10.log |
| Mise en page 1280×760 | Connexion, création, Réglages, Équipe, Règles, Compte | Fonctionne | Aucun débordement horizontal mesuré à 1280×760 en dehors des noms tronqués. | | a11-1280.log |

---

## 3. Libellés de rôle au masculin pour des femmes

L'application n'a pas de notion de genre : `libelleRole` renvoie toujours un masculin. Relevé :

- Tableau de bord : « Titulaire principal · Pharmacie des Tilleuls » (Claire), « Titulaire principal · Grande Pharmacie de la Pinède » (Caroline). captures/a2-03-tableau-neuf.png ; a12.log.
- Menu du compte : « Claire Martin | Titulaire principal », « Caroline Tellier | Titulaire principal ». a8.log ; a12.log.
- Équipe, liste et fiches : « Pharmacien » (Julie Bernard, Léa Fontaine), « Préparateur » (Léa Roux, Inès Da Silva), « Animateur » (Inès Garcia, Sarah Lemoine), « Apprenti » (Emma Blanc, Manon Girard). a6.log ; captures/e-1280-equipe-fiche-animatrice.png, a12-02-fiche-sarah.png.
- Fiche, « Droits d'accès » de Caroline : « Titulaire principal. A créé la pharmacie… il donne son accord… lui seul ouvre la gestion ». a12.log.
- Fiche, « Marques présentées » de Sarah et d'Inès : « Il les retrouve dans son espace ». a6.log ; a12.log.
- Espace de Sarah : badge « Espace animateur ». captures/a12-03-sarah-accueil.png.
- Assistant de création : « Vous, le titulaire principal » ; récapitulatif « Claire Martin · Titulaire principal », « Inès Garcia · Animateur », « Emma Blanc · Apprenti ». captures/a1-06-verification.png.
- Connexion > Mot de passe oublié : « demandez au titulaire principal », « Titulaire principal : redéfinir avec la clé de secours ». captures/a2-05-oubli.png.
- Mon compte : « En tant que titulaire principal, vous seul pouvez changer la vôtre » ; vu par Nicolas : « Seul le titulaire principal choisit la sienne » (la principale est Caroline). a10.log.
- Réglages : choix « Vous seul » et « vous seul publiez » ; espace pharmacienne de Julie : « où vous êtes le pharmacien présent » ; tutoriel : « vous seul le voyez ». a2.log ; a3.log.
- À l'inverse, le menu de l'exemple et les visites guidées écrivent « Titulaire principale », « Animatrice », « Apprentie » (a9.log), et les textes de repli disent « la titulaire principale » quel que soit le genre réel.

---

## 4. Incohérences et répétitions

1. Deux champs pour le chiffre d'affaires : « Chiffre d'affaires annuel HT » (Réglages > Paramètres, utilisé par le quota de l'écran Équipe) et « Activité annuelle hors taxes » (Réglages > Comptoir > dimensionnement, utilisé par la « règle officielle »). Les deux écrans donnent des verdicts opposés sur le nombre de pharmaciens (1.3).
2. La tranche de chiffre d'affaires se règle dans « Règles » et l'écran Équipe la suit, mais le dimensionnement garde « 1,3 million d'euros » en dur.
3. L'en-tête Équipe s'intitule « Pharmaciens » alors qu'il ne compte que les adjoints ; l'alerte juste dessous dit « Pharmaciens, hors titulaires ».
4. Échéances : préférences jusqu'au 20 du mois précédent, publication 14 jours avant le 1er (le 17) ; les réglages par défaut se contredisent et aucune combinaison n'est signalée.
5. « Obligatoire : le planning ne peut pas l'enfreindre » (légende des Règles) alors que le seuil de ces règles se modifie librement ; le filtre « Réglables » contient 8 règles obligatoires ; la fiche d'aide « Voir ou régler les règles » ne cite que les seuils propres à l'officine.
6. L'assistant de création contrôle les horaires (fermeture après l'ouverture, coupure dans la journée) ; Réglages ne contrôle rien.
7. Heures d'un titulaire : maximum annoncé 70 à la création et à l'ajout, 48 dans la fiche ; aucun des deux n'est appliqué.
8. Raison d'une demande : le tutoriel dit « Un besoin se décrit sans jamais demander sa raison » ; la fenêtre dit « (facultatif) » puis « Une raison est demandée pour chaque demande » ; l'aide « Poser un congé » dit « Une raison est toujours demandée ».
9. L'écran de création promet « Aucune information de santé, de religion ou de vie privée n'est demandée » ; la fenêtre des besoins propose les raccourcis « Chabbat », « Prière du vendredi », « Office du dimanche », « Rupture du jeûne » (non enregistrés, ce qui est dit) et la raison « Santé, rendez-vous médical » (enregistrée).
10. « Préparé par Solvéa d'après vos habitudes » et « Étape 2 · faite » pour une pharmacie qui vient d'être créée ; « À publier 2 » pour une semaine marquée « Planning à construire ».
11. « Repartir de zéro » (Réglages) annonce « efface l'officine » et « ramène à l'écran de création » : il efface toutes les pharmacies et ouvre la connexion. La page de connexion offre le même effacement total (« Remettre l'application à zéro ») : deux boutons pour la même action, avec deux textes différents.
12. Titulaire secondaire : « chacune de ses décisions … attend l'accord » ; en pratique le retrait d'une personne attend l'accord, mais les réglages, les règles, les contrats et l'effacement complet s'appliquent aussitôt.
13. Même écran, trois noms : « Réglages » dans le menu, « Officine » en surtitre de la page, « modifiables dans « Officine » » au journal de création ; l'aide parle de « planning collaboratif et classique » quand l'écran dit « Avec l'équipe » et « Vous seul ».
14. L'écran « Mot de passe oublié » renvoie à une clé « à noter lors de la création » que la création ne montre jamais.
15. En mode « Ajouter une pharmacie », l'étape 3 promet « Un tutoriel d'une minute suit la création » ; aucun tutoriel ne s'ouvre (a13.log, captures/a13-01-ajout-etape3.png).
16. Après le retrait d'Igor, l'annonce « 3 postes à couvrir : les titulaires s'en chargent dans « Résoudre » » reste, alors que Résoudre n'en montre plus aucun.
17. Deux « Se déconnecter » (menu du compte et « Mon compte ») qui ne se comportent pas pareil ; deux « Paramètres » qui n'ouvrent pas la même chose.
18. Masculin dans l'application, féminin dans le menu de l'exemple et les visites guidées (section 3).

---

## 5. Ce qui n'a pas pu être testé, et pourquoi

- Le rappel de publication et la préparation automatique à une autre date : ils dépendent de la date de l'appareil, que la consigne ne permet pas de modifier. Seul le déclenchement du 20 novembre a été observé. Il n'a pas été possible de décocher « laisser Solvéa préparer » avant la première préparation, puisqu'elle a lieu dès l'ouverture qui suit la création.
- L'exactitude juridique des seuils (1,3 M€ par tranche, durées, repos) : hors du périmètre d'un audit fonctionnel ; seule la cohérence interne a été vérifiée.
- Le grand écran 1920×1080 n'a pas été passé en revue pour ce domaine (1440×900, 1280×760 et 390×800 l'ont été). Le thème sombre n'a été regardé que sur « Mon compte ».
- L'annulation par Ctrl+Z des changements de réglages : le raccourci n'est branché que dans Construire ; les toasts « Annuler » ont été vus mais pas rejoués un par un.
- L'affichage des champs heure et date au format français : le navigateur de test les affiche au format anglais (« 08:30 AM ») ; impossible de juger si les champs de 112 px tronquent l'heure chez un utilisateur français.
- Plusieurs appareils et vrais comptes en ligne : l'application est sans serveur, chaque appareil est isolé (ce que dit la page de connexion).
