# Audit C-decider-suivre : décider, échanger et faire le bilan (Caroline, titulaire principale ; Pierre, titulaire secondaire)

Version testée : la copie publiée servie par `servi.js` (dossier `heberge`), exemple « Grande Pharmacie de la Pinède », jour du test vendredi 20 novembre 2026 (vers 23 h 30, heure réelle de la machine : les postes du jour sont donc terminés). Navigateur Chromium piloté par Playwright, 1440×900 sauf mention, plus 1280×760, 390×800 et thème sombre pour l'ergonomie (`PLIE=1` pour juger onglets et accordéons comme un utilisateur).

Méthode : chaque scénario part d'un exemple neuf (localStorage vidé). Les données sont relues dans `releve.v3` après chaque action (brouillon `shifts`, version publiée `semaines[lundi].snapshot`, `notifications`, `messages`, `annonces`, `journal`). Quand l'exemple ne contient pas le cas voulu, une demande d'équipe est ajoutée directement dans les données enregistrées puis la page est rechargée (fichier `fixtures.js` : trois demandes de remplacement « en attente » de Nicolas le 30/11, Sarah le 24/11 en urgence médicale, Igor le 25/11 ; un congé de Sarah du 1er au 3/12 ; ailleurs, deux postes ajoutés à Léa pour créer des heures en plus, un poste retiré du brouillon pour créer une modification à publier, un poste posé à la main le 8/12). Tout le reste est fait par l'interface.

Scripts, journaux et captures : `/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/C-decider-suivre/` (`r1.js` à `r29.js`, `lib.js`, `fixtures.js`, `e1280.log`, `e390.log`, dossier `captures/`). Dans le tableau, « captures/… » désigne ce dossier.

Aucun fichier du projet n'a été modifié. Aucune erreur de console ni de page n'a été relevée pendant les 29 scripts.

## 1. Fonctions et scénarios testés

### 1.1 Résoudre : absences à couvrir

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Carte d'une absence | Arrêt d'Igor du 18 au 20/11, un poste restant le 20/11 (11 h 30 – 19 h 30) | Fonctionne | Ce qui manque est dit (aucun pharmacien de 16 h 30 à 19 h 30, sous-effectif 13 h – 13 h 30 et 16 h 30 – 19 h), appel déjà lancé (Léa volontaire, « À son tour »), 3 options comparées : « Réaffecter Pierre F. » (conseillé), « Heures complémentaires à Léa F. », « Faire appel à Paul L., remplaçant habituel », chacune avec personnes touchées, avant/après, règles | | captures/r1-carte-absence.png |
| Option conseillée « Choisir » | Réaffecter Pierre le 20/11 | Partiel | Effet juste : Pierre passe de 8 h 30 – 16 h 30 à 11 h 30 – 19 h 30 dans le brouillon ET dans la version publiée, poste résolu, notification à Pierre (tardive), journal, annonce à Igor et aux titulaires. Mais le message flash dit « Option retenue. Pensez à publier la modification pour prévenir l'équipe. » alors que la version publiée est déjà à jour : « À publier » reste à 0 et le bouton « Publier les modifications » de Construire est grisé | Mineur | captures/r2-A-apres-choisir.png, captures/r6-paul-construire.png |
| Volontaire de l'appel après un autre choix | Léa s'était proposée ; on choisit « Réaffecter Pierre » | Partiel | L'appel passe à « annulée » sans aucun message ni annonce à Léa (annonce adressée à Igor, Pierre, Caroline seulement) : la volontaire n'apprend pas que son offre n'est plus utile | Mineur | sortie r2.js : `remplacements [...["2026-11-20","annulee","appel",null]]`, `messages 2 []` |
| « Voir et choisir la solution » | Ouvrir la fenêtre de réglage de l'arrêt d'Igor, puis « Appliquer mes choix » sans rien changer | Ne fonctionne pas | La carte annonce « 1 poste à couvrir » ; la fenêtre annonce « 3 jours » et propose aussi mer. 18 et jeu. 19 novembre (passés). La solution cochée par défaut pour jeudi 19 (hier) est « Réaffecter Pierre F. » : après « Appliquer », la journée passée de Pierre devient 8 h 30 – 19 h 30 (au lieu de 8 h 30 – 13 h) dans le brouillon et dans la version publiée de la semaine du 16/11, et le journal enregistre « Absence de Igor L. du jeu. 19 novembre : réaffecter pierre f. ». Le planning déjà vécu et publié est réécrit. Reproduction : Résoudre > Absences > « Voir et choisir la solution » > « Appliquer mes choix » | Majeur | captures/e-1280-dlg-reglage.png ; sortie r2.js : `2026-11-19 Pierre brouillon=[8.5-19.5/reparation] publié=[8.5-19.5]` |
| « Je prends ce poste moi-même » | Igor absent sam. 28/11 (9 h – 14 h, Caroline libre) | Fonctionne | Proposé dans la fenêtre de réglage ; Caroline reçoit 9 h – 14 h dans le brouillon et la version publiée, poste résolu, journal. Doublon : l'option conseillée « Réaffecter Caroline T. » produit exactement le même changement (Repos → 9 h – 14 h). La carte compte « 3 options à comparer » alors que la fenêtre en montre 4 | Cosmétique | captures/r3-reglage-moi.png ; sortie r3.js |
| Heures complémentaires | « Proposer des heures complémentaires à Léa F. » le 20/11 | Fonctionne | Léa 11 h 30 – 19 h 30 dans le brouillon et publié, notification, journal avec « Accord de Léa F. à obtenir ; Temps partiel prévenu moins de 7 jours ouvrés avant : accord à tracer ». Même message flash trompeur que ci-dessus | Mineur | sortie r6.js |
| Remplaçant extérieur | « Faire appel à Paul L. » | Fonctionne | Poste de Paul ajouté au brouillon et à la version publiée, journal « Disponibilité de Paul L. à confirmer ; Contrat ou bon de mission à établir » | | sortie r6.js |
| « Classer » | Absence de Thomas le sam. 21/11 qui ne découvre rien | Fonctionne | « Journée classée sans remplacement. », poste résolu « Aucun remplacement nécessaire », journal | | sortie r6.js |
| « Je règle ce jour à la main » | Les 3 jours d'Igor « à la main » | Fonctionne | Rien n'est appliqué, message « 0 jour réglé, 3 à régler à la main. », Construire s'ouvre sur la semaine du 16/11 avec la case d'Igor du 18/11 encadrée. Même défaut que plus haut : des jours passés sont proposés | | captures/r6-a-la-main.png |
| Appel à l'équipe, de bout en bout | Nicolas absent jeu. 26/11 (enregistré par Caroline) ; « Prévenir les 2 personnes » ; Sarah répond « Je peux » ; Caroline « Confier » | Fonctionne | Message identique à Inès et Sarah, journal « Appel à l'équipe… 2 personnes prévenues » ; chez Sarah, l'appel est en tête de Mon planning avec « Votre rang : 2e sur 2 » ; chez Caroline, Sarah passe « À son tour » ; après « Confier », Sarah a 8 h 30 – 19 h 30 dans le brouillon et la version publiée, notification « +9 h 30 sur le contrat cette semaine », message de remerciement, poste résolu | | captures/r5-sarah-appel-recu.png, captures/r5-titulaire-volontaire.png, captures/r5-sarah-apres.png |
| Contrôle des heures complémentaires | Même cas : Sarah, 21 h par semaine, reçoit 9 h 30 de plus | Partiel | L'appel et le contrôle disent « Règles respectées » alors que la semaine de Sarah passe de 21 h à 30 h 30 (+45 %). Aucune des 24 règles (src/domain/rules.ts) ne borne les heures complémentaires d'un temps partiel (plafond légal d'un dixième du contrat, un tiers par accord, soit 7 h ici) | Majeur | sortie r5.js : `+9 h 30 sur le contrat cette semaine` |
| « Confier » sur l'appel existant | Léa, volontaire pour le 20/11 | Fonctionne | Léa 11 h 30 – 19 h 30 brouillon et publié, notification, message « Merci : le poste du ven. 20 novembre est pour vous… », journal « selon le tour de rôle » | | sortie r4.js |

### 1.2 Résoudre : remplacements

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Refuser une demande déjà acceptée | Demande d'Igor du sam. 21/11 (exemple), raison « Aucun remplaçant possible » et un mot | Partiel | Message reçu par Igor exact (« … n'est pas acceptée. Raison : aucun remplaçant possible. Désolée, samedi impossible. Vous restez en poste. »), annonce à Igor et aux titulaires. Mais rien n'est inscrit au Journal (« Dossier de preuve ») : la dernière entrée reste « Arrêt d'Igor L. enregistré » | Majeur | captures/r7-refus-dialogue.png ; sortie r7.js et r19.js |
| Décider : accepter et prévenir l'équipe | Nicolas, lun. 30/11 (prévu) | Fonctionne | Accord enregistré, Thomas (seul possible) sollicité, messages à Nicolas et à Thomas, journal, annonce ; la carte reste dans l'onglet en attendant un volontaire | | captures/r7-decider-equipe.png |
| Décider : accepter et confier | Nicolas, lun. 30/11, confié à Thomas | Partiel | Planning juste (Thomas à la place de Nicolas, brouillon et publié), notifications, journal. Mais l'aperçu « Ce que Nicolas recevra : … Thomas N. reprend votre poste » n'est pas ce qui part : Nicolas reçoit « … 1 collègue est prévenu ; vous restez en poste tant que personne n'a repris » et Thomas reçoit « Un collègue cherche un remplaçant… Répondez depuis « Mon planning » » alors que le poste lui est déjà attribué. Aucun message ne dit à Nicolas qu'il est remplacé par Thomas (seulement la notification) | Majeur | captures/r7-decider-confier.png ; sortie r7.js |
| Heures ajoutées au remplaçant | Même cas | Partiel | La fenêtre annonce « Thomas N. (+6 h sur son contrat) » ; la notification et le journal disent « +5 h ». La fenêtre compte le poste sans sa pause d'une heure | Mineur | sortie r7.js |
| Dernier recours : un titulaire assure | Sarah, mar. 24/11, urgence médicale ; « Accepter : un titulaire assure le poste », Pierre | Partiel | Option proposée comme prévu pour une urgence médicale ; Pierre prend le poste (brouillon et publié), notification à Sarah « Libéré : Pierre F. assure », journal. Même contradiction des messages : Sarah reçoit « vous restez en poste tant que personne n'a repris », Pierre reçoit « Un collègue cherche un remplaçant… » | Majeur | captures/r7-decider-titulaire.png ; sortie r7.js |
| Demande urgente avec un collègue possible | Igor, mer. 25/11 | Fonctionne | Pas de dernier recours (un collègue peut), impact « sans pharmacien de 16 h 30 à 19 h 30 » affiché, « C'est sa 2e demande de remplacement » | | captures/r7-decider-igor.png |
| Décider : refuser | Nicolas, lun. 30/11, raison et mot | Fonctionne | Message identique à l'aperçu, statut refusé, journal, annonce | | sortie r7.js |
| Personne ne peut reprendre | Cas non présent dans l'exemple | Non testable | Aucun poste trouvé où aucun collègue ne peut ; seul le dernier recours médical a été joué | | |

### 1.3 Résoudre : demandes (congés et horaires)

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Accepter un congé | Nicolas, 30/11 au 4/12 | Partiel | 4 postes retirés du brouillon et de la version publiée (semaine du 30/11), 4 postes à couvrir créés, journal, annonce (avec « Reste à trancher sur ces dates : la demande de Sarah L.. »), Nicolas voit « Acceptée : c'est inscrit au planning ». Mais la fenêtre annonce « Ce que Nicolas recevra : Votre demande (congé…) est acceptée. » et aucun message n'est envoyé : Nicolas n'a que l'annonce sous la cloche | Mineur | captures/r8-dialogue-conge.png, captures/r8-nicolas-demandes.png ; sortie r8.js `messages Nicolas []` |
| Refuser un congé avec motif | Raison « Effectif insuffisant » et un mot | Fonctionne | Message identique à l'aperçu, statut refusé, journal avec la raison | | captures/r8-refus-conge.png |
| Deux congés sur les mêmes dates | Nicolas (30/11 – 4/12) et Sarah (1 – 3/12) | Fonctionne | Pastille « 2 demandes sur ces dates », bloc « En même temps » sur chaque carte avec l'ordre d'arrivée, frise des absences ; après acceptation de Nicolas, la carte de Sarah dit « Nicolas L. est déjà absent… 3 jours en commun » et l'annonce rappelle la demande restante | | captures/r8-demandes.png |
| Demande d'horaire : simple préférence | Jules, « Finir avant 18 h - vendredi » | Fonctionne | Statut « preference », journal, annonce. Même écart que pour le congé : le message de l'aperçu n'est pas envoyé | Mineur | sortie r8.js |
| Demande d'horaire : prioritaire | Idem, plafond 0 / 2 | Fonctionne | Statut « prioritaire », compteur du plafond affiché | | sortie r8.js |
| Demande d'horaire : indisponibilité reconnue | Idem | Fonctionne | Statut « reconnue », annonce « Les prochains plannings la respectent toujours. ». La fenêtre signale le poste du 4/12 qui contredit la demande | | captures/r8-dialogue-besoin.png |
| Demande d'horaire : refuser | Idem | Partiel | Message envoyé, journal. La fenêtre et le message flash disent « le refus compte dans la mémoire d'équité », mais Équité > « Demandes refusées » reste vide (voir 1.10) | Majeur | sortie r8.js `EQUITE refus … Personne n'est concerné` |

### 1.4 Résoudre : gardes, à publier, accords

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Onglet Gardes | Lecture | Fonctionne | 2 gardes à affecter (astreinte du 12/12 « J − 7 avant la limite », garde du 25/12 « J − 20 ») et 1 garde à valider (24/10, Igor) | | captures/r9-gardes.png |
| « Relire » puis valider | Garde du 24/10 | Fonctionne | Ouvre Gardes sur la garde, « Valider pour le comptable » : date de validation et journal | | captures/r9-relire.png |
| « Affecter » | Astreinte du 12/12 | Fonctionne | Ouvre Gardes sur l'astreinte (l'affectation elle-même relève de l'écran Gardes, non approfondie ici) | | captures/r9-affecter.png |
| Repos à protéger après une garde | Aucun cas dans l'exemple | Non testable | Pas de conflit de repos dans les données | | |
| À publier | Un poste de Jules retiré du brouillon d'une semaine publiée | Fonctionne | « 1 modification en attente : l'équipe voit encore l'ancienne version », « Publier les modifications » ouvre Construire sur la semaine 48 avec « Relisez la semaine, puis publiez : le bouton est mis en évidence » | | captures/r9-a-publier.png, captures/r9-publier-modifs.png |
| Décisions de Pierre soumises à accord | Pierre choisit l'option conseillée pour Igor et accepte le congé de Nicolas | Fonctionne | « Envoyé à Caroline pour accord. Rien n'est appliqué avant. » ; rien ne change ; onglet « En attente d'accord » (2) avec « Retirer », qui fonctionne | | captures/r10-pierre-accords.png |
| Donner son accord | Caroline, onglet « Accords à donner » ouvert d'office | Fonctionne | La décision est rejouée (Pierre 11 h 30 – 19 h 30 brouillon et publié, poste résolu), message « Accord donné : … » à Pierre, journal « Accord donné à Pierre F. : … » | | captures/r10-caroline-accords.png |
| Refuser un accord | Pierre « Solder » le compteur d'Igor, Caroline refuse | Fonctionne | Rien n'est appliqué, message « Accord refusé : … » à Pierre, journal | | sortie r10.js |
| Décision de Pierre qui échappe à l'accord | Pierre refuse la demande de remplacement d'Igor (sam. 21/11) | Partiel | Appliquée tout de suite, sans accord (« Demande de remplacement refusée. », message à Igor signé Pierre), alors que refuser une demande « en attente » passe par l'accord de Caroline. Le refus d'une demande déjà acceptée n'est pas dans la liste des décisions soumises | Majeur | sortie r10.js : `rempl Igor 21/11 refusee` alors que les deux autres décisions attendent |
| Absence que Pierre enregistre pour lui-même | « Retard ou absence » > Absence le 23/11 | Partiel | Mise en attente d'accord (« Enregistrer : arrêt de Pierre F. »), mais la fenêtre ne le dit pas : elle annonce « Caroline T. reçoit une notification » et « il sera à couvrir dans « Résoudre » » | Mineur | sortie r11.js |

### 1.5 Retard ou absence (bouton de la barre du haut)

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Retard pour soi | Caroline, 15 min, poste de demain 9 h | Fonctionne | « Arrivée prévue vers 9 h 15 », avis enregistré, message à Pierre, journal, annonce | | captures/r11-retard-moi.png |
| Retard pour quelqu'un d'autre | Thomas, « + de 20 min », 45 min | Fonctionne | Avis noté « par » Caroline, journal « Retard de Thomas N. noté : 45 min, demain », annonce à Pierre | | captures/r11-retard-thomas.png |
| Saisie de la durée | 0, −30, 999 | Partiel | 0 et −30 donnent « Arrivée prévue vers 9 h 01 » et un bouton actif (1 min enregistrée) ; 999 est ramené à 240 min (13 h) sans message | Mineur | sortie r11.js |
| Retard sans poste | Pierre, pas de poste aujourd'hui ni demain | Fonctionne | « l'avis part quand même, sans heure d'arrivée », message à Caroline | | sortie r11.js |
| Absence pour quelqu'un d'autre | Igor sam. 28/11 ; Inès 9 – 13/11 | Partiel | Absence approuvée, postes retirés, postes à couvrir créés. Mais la fenêtre affiche « Pierre F. reçoit une notification. » et rien n'est envoyé : annonces +0, messages +0, notifications +0. La personne déclarée absente n'est pas prévenue non plus | Majeur | captures/r3-signaler-igor.png ; sortie r12.js `annonces + 0 / messages + 0 / notifications + 0` |
| Dates incohérentes | Du 25 au 23/11 | Fonctionne | La date de fin est remontée au 25 | | captures/r11-absence-dates.png |
| Date passée tapée au clavier | Inès du 9 au 13/11 (champ min = aujourd'hui contourné en tapant) | Partiel | Acceptée ; les 3 postes publiés d'Inès de la semaine du 9/11 disparaissent de la version publiée, son compteur passe de −5 h à « À jour ». Le message dit « 3 postes à couvrir dans « Résoudre » » alors qu'aucun n'est créé (jours passés). Une absence rétroactive peut être voulue, mais le message est faux et la trace de ce qui avait été publié est perdue | Majeur | sortie r12.js |
| Accident du travail | Thomas, du 21 au 24/11, à la pharmacie, 10 h 15, faits, témoin | Fonctionne | Bloc « La suite, dans l'ordre » avec échéance lun. 23/11 ; absence approuvée avec tous les faits ; journal « À déclarer… au plus tard le lun. 23 novembre » ; rappel au tableau de bord « Déclarer l'accident du travail de Thomas N. » | | captures/r11-accident.png, captures/r11-tableau-accident.png |
| « C'est fait » | Même accident | Fonctionne | Date de déclaration notée, journal « déclaration notée comme faite », rappel retiré | | sortie r11.js |

### 1.6 Messages et rendez-vous

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Écrire à toute l'équipe | Caroline, puis lecture par Nicolas | Fonctionne | Nicolas : badge « 3 messages non lus », fil équipe ouvert d'office avec séparateur « Nouveaux messages » ; sa réponse apparaît chez Caroline | | captures/r13-nicolas.png |
| Écrire à une personne | Thomas (premier message), Nicolas (réponse) | Fonctionne | Aperçu « Vous : … », pastille « 1 non lu » chez Nicolas | | captures/r13-apres-envoi.png |
| Écrire à un groupe | Chercher un fil de groupe, menu « Créer » > « Un message » | Ne fonctionne pas | La fonction n'existe pas : seulement « Toute l'équipe » et un fil par personne | Mineur | sortie r13.js |
| Ordre des conversations | Avant et après envoi | Fonctionne | Ordre fixe (équipe, titulaires, pharmaciens, préparateurs, autres postes, puis prénom), comme le code le prévoit ; la conversation qui a du nouveau s'ouvre d'office | | sortie r13.js |
| Message vide | Rien, puis des espaces | Fonctionne | Bouton « Envoyer » désactivé | | sortie r13.js |
| Demander un rendez-vous | Caroline → Nicolas | Fonctionne | Trois moments proposés où les deux sont en poste, date passée refusée (« Choisissez un jour à venir. »), personne absente refusée (« Igor est en absence approuvée ce jour-là. »), message et carte « En attente de la réponse de Nicolas » | | captures/r14-dialogue-rdv.png, captures/r14-carte-caroline.png |
| Rendez-vous un jour de fermeture | Dimanche 22/11 | Partiel | Simples avertissements (« L'officine est fermée ce jour-là », aucun des deux en poste) et envoi possible | Mineur | sortie r14.js |
| Proposer un autre horaire | Nicolas propose lun. 23/11, 14 h | Fonctionne | Rendez-vous déplacé, message « Autre horaire proposé… À vous de répondre. », c'est à Caroline de répondre | | sortie r14.js |
| Accepter | Caroline accepte | Fonctionne | Statut fixé ; visible au tableau de bord de Caroline, dans la grille de Construire (pastille), dans Mon planning de Caroline et de Nicolas, sur l'accueil de Nicolas. L'annonce « Rendez-vous fixé » part aussi à Pierre, qui n'est pas concerné (gênant pour un entretien annuel) | Mineur | captures/r14-construire-rdv.png, captures/r14-nicolas-planning.png |
| Annuler | Nicolas annule le rendez-vous fixé | Partiel | Statut annulé, message à Caroline. Pas de message flash, pas d'annonce d'annulation : Pierre, qui avait reçu « Rendez-vous fixé », n'est pas informé | Mineur | sortie r14.js |
| Décliner | Nicolas demande, Caroline décline | Fonctionne | Statut « Décliné », message type envoyé | | sortie r29.js |

### 1.7 Heures

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Justesse des compteurs | Recalcul à la main des 9 salariés : postes des 9 semaines publiées (21/09 au 22/11), contrat hebdomadaire moins un cinquième par jour ouvré d'absence approuvée | Fonctionne | Tous identiques. Igor : 9 × 35 h − 3 jours d'arrêt (21 h) = 294 h, 286 h planifiées, −8 h. Nicolas : 315 h, 307 h, −8 h. Yanis : 144 h, 135 h 30, −8 h 30. Remarques : la période n'est écrite nulle part ; les postes à venir de la semaine en cours (sam. 21/11) sont déjà comptés | | captures/r15-heures.png ; sortie r15.js (calcul Python) |
| Solder | Thomas, −4 h 30 | Fonctionne | Régularisation +4 h 30, « À jour », journal | | captures/r16-solder.png |
| Retirer une régularisation | Corbeille de l'historique | Partiel | Retirée sans confirmation et sans trace au journal : le journal dit toujours « compteur soldé » | Mineur | sortie r16.js |
| Faire rattraper | Yanis, −8 h 30, proposition de Solvéa | Fonctionne | Mer. 2/12 : 11 h 30 – 19 h 30 devient 8 h 30 – 19 h 30 dans le brouillon et la version publiée, notification, message, journal ; compteur −5 h 30 avec « +3 h prévu mer. 2 décembre » | | captures/r16-rattraper.png |
| Faire récupérer | Léa, +9 h 30 (deux samedis ajoutés), proposition conseillée | Partiel | « Mardi 1er décembre · 9 h → 13 h, Part plus tôt » sur un poste de 8 h 30 – 13 h : il reste à Léa un poste de 30 minutes (8 h 30 – 9 h) | Majeur | captures/r27-recuperer.png ; sortie r27.js `Léa le 2026-12-01 [[510,540,null]]` |
| Payer | Léa, solde restant | Fonctionne | Paiement −5 h 30, « À jour » | | sortie r27.js |
| Régulariser automatiquement | 8 compteurs négatifs | Partiel | 8 régularisations sur la semaine du 7/12 et brouillon de cette semaine calculé ; tous les compteurs passent à « À jour ». Mais le brouillon ne donne pas les heures annoncées : Yanis 18 h 30 pour un objectif de 24 h, Inès 28 h pour 29 h, Léa 27 h 30 pour 28 h ; Yanis restera donc à −5 h 30 alors que l'écran dit « À jour » | Majeur | captures/r16-auto.png ; sortie r16.js |
| Régulariser automatiquement sur une semaine déjà commencée | Un poste posé à la main le 8/12 pour Sarah | Ne fonctionne pas | Le poste posé à la main est effacé et remplacé par un poste calculé, sans avertissement ni confirmation | Majeur | sortie r27.js `poste posé à la main conservé ? false` |

### 1.8 Équité et Statistiques

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Samedis (Équité, 8 semaines) | Recalcul à la main des 11 personnes | Fonctionne | Identiques : Yanis 9 pour 3,3 attendu, Caroline 8 pour 8,6, Léa 4 pour 5,8, total 65 | | captures/r17-equite.png ; calcul Python |
| Fenêtre « 8 semaines » | Lecture | Partiel | « Du lun. 21 septembre au dim. 22 novembre » : 9 semaines, et le samedi 21/11 (demain) est compté comme « travaillé ». Statistiques donne 8 samedis à Yanis, Équité 9 ; idem Caroline 7 / 8, Igor 6 / 7 | Mineur | captures/r17-equite.png, captures/r18-stats.png |
| Fermetures, gardes, dépannages | Lecture et comparaison avec Statistiques | Fonctionne | Caroline 23 fermetures, Igor 1 garde, 0 dépannage : mêmes chiffres dans les deux écrans | | sorties r17.js et r18.js |
| Changements tardifs absorbés | Lecture (l'exemple contient une notification tardive pour Jules le 9/11) | Ne fonctionne pas | Toujours « Personne n'est concerné sur cette période. Non concernés : Caroline, Pierre, … Yanis. » | Majeur | captures/r17-equite-tardifs.png |
| Demandes refusées | Après refus de la demande de Jules | Ne fonctionne pas | Même message vide, alors que la décision dit que le refus « compte dans la mémoire d'équité » | Majeur | sortie r8.js |
| Périodes 12 semaines, 6 mois | Bascule | Fonctionne | Mêmes chiffres (l'historique commence le 21/09) | | sortie r17.js |
| Effectif | Statistiques face à Équipe | Fonctionne | 11 personnes plus 2 remplaçants ; Équipe : 2 + 2 + 4 + 1 + 1 + 1 | | captures/r18-stats.png, captures/r17-equipe.png |
| Équivalents temps plein | Recalcul (heures / 35, plafonné à 1) | Fonctionne | 8,83 → « 8,8 » ; pharmaciens 1,8 comme Équipe « 1,8 / 2 » ; 5 temps partiels, les 5 marqués « (temps partiel) » dans Équipe | | captures/r18-stats.png |
| Compétences couvertes | Recomptage | Fonctionne | 8 sur 22, 4 reposent sur une seule personne (Orthopédie : Nicolas ; Dermatologie, Beauté, Parapharmacie : Sarah) | | sortie r18.js |
| Points forts | Recomptage | Fonctionne | 7 pour 6 personnes : 5 « Toujours à l'heure » + 2 « Prend sa part » | | sortie r18.js |
| Heures planifiées | Recalcul des 4 semaines (26/10 au 22/11) | Fonctionne | 956 h 30 pour 979 h, identique ; Igor 115 h 30 pour 119 h, même règle que Heures | | calcul Python |
| 4 onglets | Composition, Compétences, Points forts, Activité (`PLIE=1`) | Fonctionne | Un onglet à la fois, chiffres clés au-dessus | | captures/e-1280-stats.png |

### 1.9 Journal et paie

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Enregistrement des actions | Option choisie, solde d'heures, congé, accord, appel, accident, garde validée | Partiel | Bien enregistrés. Pas enregistrés : refus d'une demande de remplacement déjà acceptée, retrait d'une régularisation, rendez-vous fixés ou annulés | Majeur | captures/r19-journal.png ; sorties r7.js, r16.js, r19.js |
| Filtres | Tout, Publications, Modifications, Absences, Corrections | Fonctionne | Chaque filtre ne montre que sa nature (Publications 4, Corrections 1…) | | sortie r19.js |
| Exporter le dossier | Clic, avec écoute de l'événement download | Partiel | Aucun fichier téléchargé : une fenêtre « Cette page hébergée ne peut pas enregistrer de fichier… copiez le contenu » s'ouvre. Contenu JSON : officine, exporteLe, regles (24), journal (7), accusesDeLecture (2) ; copie possible. Ni absences, ni demandes, ni messages | Mineur | captures/r19-export-dossier.png |
| Fiche navette | Novembre puis octobre 2026 | Fonctionne | Nov. : 9 salariés, 996 h prévues, 0,5 h en plus (Jules, 0,5 h à 25 %), 3 j d'absence (Igor), variables de la garde de Léa (15 points, 10 h, 10 h de repos) ; oct. : 1 101 h, 1 h en plus | | captures/r19-navette.png |
| Exporter pour le comptable | Clic, écoute download | Partiel | Même fenêtre à copier, pas de fichier ; contenu CSV correct (séparateur « ; », en-tête « heures PRÉVUES ») | Mineur | sortie r19b.js |

### 1.10 Documents

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Onglets | Lecture | Fonctionne | Plannings publiés 11, Mes absences 0, Mes fichiers, Reçus de l'équipe, Absences de l'équipe | | captures/r20-plannings.png |
| Plannings publiés | « Voir » | Fonctionne | Ouvre Construire sur la semaine choisie | | sortie r20.js |
| Déposer un fichier | .txt, PDF de 700 Ko, PDF, PNG | Fonctionne | « Déposez une photo ou un PDF. » ; « Ce PDF dépasse 600 Ko : photographiez plutôt le document. » ; PDF accepté ; PNG accepté et converti en photo.jpg (89 Ko) ; place utilisée affichée | | captures/r20-fichiers-deposes.png |
| Retrouver, ouvrir, recharger | « Ouvrir », puis rechargement de la page | Fonctionne | Le fichier est téléchargé (photo.jpg) ; les documents sont toujours là après rechargement | | sortie r20.js |
| Supprimer | Corbeille, puis « Annuler » du message flash | Ne fonctionne pas | Suppression immédiate sans confirmation ; « Annuler » ne rend pas le document mais défait l'action précédente (le compteur soldé de Thomas est annulé, le document reste supprimé) | Majeur | captures/r21-annuler-suppression.png ; sortie r21.js `docs 0 / régul 0` |
| Reçus de l'équipe | Nicolas dépose un arrêt « visible par les titulaires » | Fonctionne | Le document apparaît chez Caroline avec le nom de Nicolas | | captures/r20-recus.png |
| Absences de l'équipe | Lecture | Fonctionne | Frise, filtres par personne et par nature, compteurs sur 12 mois, « Joindre » présent (non approfondi) | | captures/r20-historique.png |

### 1.11 Aide et Solvi

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Recherche | 15 requêtes | Partiel | Résultats pertinents pour : publier, conge, heures sup, garde de nuit, mot de passe, equite, fiche navette, retard, rendez vous, exporter. Aucun résultat pour « remplacemnt », « acident du travail », « imprimer le planing », « absense maladie », « comment valider un congé » (tous les mots doivent être présents, aucune tolérance aux fautes, alors que Solvi en a une) | Mineur | captures/r22-recherche-faute.png ; sortie r22.js |
| Thèmes | 8 onglets | Fonctionne | 52 fiches pour le titulaire, sans doublon, toutes avec un tutoriel | | captures/r22-aide.png |
| Lexique | 42 termes, 5 recherches | Partiel | Fonctionne, mais « ETP » (abréviation employée par Statistiques) ne trouve rien | Mineur | captures/r22-lexique.png |
| Boutons des fiches | heures, equite, paie, documents, decisions, accord | Fonctionne | Chacun ouvre le bon écran ; « Voir les accords » arrive sur l'onglet « Absences » quand aucun accord n'attend | Cosmétique | sortie r22.js |
| Voir le tutoriel | 16 fiches : publier, absence, demande-remplacement, demandes-equipe, accord, heures, equite, paie, documents, message, rendez-vous, signaler, accident, dernier-recours, historique, points-forts | Fonctionne | Chaque visite démarre à l'étape qui correspond à la fiche (ex. « Publier un planning » → étape « Publier » ; « Donner mon accord » → « Donner son accord », écran Résoudre) | | captures/r23-tuto-publier.png, captures/r23-tuto-accord.png ; sortie r23.js |
| Tutoriel et données de l'exemple | Un message envoyé avant de lancer un tutoriel | Partiel | Le message a disparu au retour : l'exemple est rechargé sans prévenir | Mineur | sortie r23.js `Message avant tutoriel conservé ? false` |
| Solvi | 28 questions (détail ci-dessous) | Partiel | 15 justes, 6 partielles, 7 fausses ou à côté | Majeur | captures/r24-solvi-fin.png ; sortie r24.js |

Détail des questions posées à Solvi (Caroline, données de l'exemple) :

| Question | Réponse de Solvi (extrait) | Verdict |
|---|---|---|
| qui travaille demain ? | 6 personnes : Caroline 9 h – 19 h, Igor 9 h – 14 h, Nicolas, Thomas, Jules, Yanis | Juste |
| combien d'heures a fait Thomas ce mois-ci ? | Liste des 8 compteurs à régulariser | À côté (attendu : 138,5 h prévues en novembre) |
| comment publier ? | Explication et bouton « Aller publier » | Juste |
| Léa est malade demain | « Léa ne travaille pas demain : aucun poste planifié. » | Partiel (exact, mais ne propose pas d'enregistrer l'absence) |
| qui est absent cette semaine ? | Igor, du 18 au 20/11, arrêt | Juste |
| quel pharmacien est là samedi ? | Demain : Caroline, Igor | Juste |
| qui ferme lundi ? | Caroline, Pierre, Jules | Juste |
| qu'est-ce que je dois décider aujourd'hui ? | « 7 décisions » puis 4 lignes qui en totalisent 6 | Partiel (la garde à valider manque à la liste) |
| quand travaille Nicolas ? | Ses 4 prochains postes | Juste |
| Igor est là lundi ? | 8 h 30 – 16 h 30, pause 12 h 30 – 13 h 30 | Juste |
| qui est de garde le 29 novembre ? | Garde de jour, volets ouverts, Léa F. | Juste |
| combien d'heures sup cette semaine ? | Liste des 8 compteurs (tous négatifs) | À côté |
| où en est le compteur de Yanis ? | Les prochains postes de Yanis | Faux (attendu : −8 h 30) |
| comment refuser un congé ? | Onglet « Demandes » de « Résoudre » | Juste |
| Thomas s'est blessé à la réserve | Conduite à tenir et bouton « Signaler un accident du travail » | Juste |
| je serai en retard de 10 minutes | Ouvre la fenêtre de signalement | Juste |
| faire rattraper des heures à Yanis | Liste des compteurs et « Ouvrir les heures » | Partiel |
| comment exporter la fiche navette ? | « Journal et paie » | Juste |
| combien de samedis a fait Yanis ? | « Là, je sèche » | Faux (attendu : 9 sur 8 semaines dans Équité) |
| on est assez nombreux ? | « Pharmaciens : 3,7 temps plein au contrat pour 2,1 qu'il faut, c'est plus qu'il n'en faut » | Faux par rapport à Équipe, qui affiche « Pharmaciens 1,8 / 2, Sous le seuil » (titulaires comptés ici, pas là, et Caroline comptée 1,2) |
| qui est en congé en décembre ? | « 1 absence sur sept jours : Igor… » (novembre) | Faux |
| combien font 151,67 / 4 | 37,92 | Juste |
| de 8h30 à 19h30 ça fait combien d'heures ? | 11 h, pensez à la pause | Juste |
| comment ajouter une personne | Dans « Équipe », bouton | Juste |
| qui travaille avec moi demain ? | Igor, Nicolas, Thomas, Jules, Yanis | Juste |
| qui est en retard aujourd'hui ? | Aucun retard annoncé | Juste |
| remplacemnt de nicolas | Les prochains postes de Nicolas | À côté |
| quelles demandes de congé sont en attente ? | Explication générale, sans la demande de Nicolas | Partiel |

### 1.12 Droits, doubles clics, annulation, rechargement

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Profil sans droit | Igor (pharmacien) et Nicolas (préparateur) | Fonctionne | Ni Résoudre, ni Heures, ni Équité, ni Statistiques, ni Journal dans leur menu | | sortie r28.js |
| Double clic | « Choisir », « Enregistrer l'absence », « Prévenir » | Fonctionne | Aucun doublon (1 poste, 1 absence, 1 appel) | | sortie r27.js |
| Annuler une décision | « Choisir » puis « Annuler » du message flash | Fonctionne | Tout est défait : poste à couvrir rouvert, version publiée rétablie, notification et journal retirés | | sortie r21.js |
| Rechargement | Après chaque scénario | Fonctionne | Toutes les vérifications lisent l'enregistrement local : les décisions, messages et documents restent après rechargement | | sorties r1 à r29 |

## 2. Ergonomie et interface

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Barre du haut, 1280×760 | Lecture sur tous les écrans | Partiel | Le nom de la pharmacie est réduit à « r… » entre « Espace titulaire » et la date | Cosmétique | captures/e-1280-resoudre-absences.png |
| Bouton flottant « Aide » (Solvi), 1280×760 et 390×800 | Lecture | Partiel | Il recouvre du contenu et des boutons : le bouton « Solder » de Nicolas dans Heures, la fin du texte des cartes de Résoudre, l'encadré « À couvrir » sur téléphone | Mineur | captures/e-1280-heures.png, captures/e-390-resoudre-absences.png |
| Onglets de Résoudre, 390×800 | Lecture | Partiel | La rangée défile horizontalement : « Demandes », « Gardes », « À publier » sont hors écran, rien n'indique qu'il y en a d'autres | Mineur | captures/e-390-resoudre-absences.png |
| Messages, 390×800 | Ouvrir, toucher « Nicolas » | Ne fonctionne pas | La zone de contenu est plus large que l'écran (853 px pour 390) et décalée de 37 px : les intitulés sont coupés à gauche (« TULAIRES », « ARMACIENS ») ; la conversation et le champ d'écriture sont sous les 11 contacts (y = 1 592 px) et toucher un contact n'y amène pas | Majeur | captures/r26-messages-390.png, captures/r26-messages-390-nicolas.png |
| Messages | Taper Entrée | Partiel | Entrée ne fait qu'aller à la ligne, sans indication ; il faut cliquer « Envoyer » | Cosmétique | sortie r13.js |
| Frise « Absences de l'équipe », 390×800 | Résoudre > Demandes ; Documents > Absences de l'équipe | Ne fonctionne pas | L'en-tête s'écrase sur une colonne d'un mot par ligne (« Les / 10 / prochaines… ») et la légende chevauche le texte | Mineur | captures/e-390-resoudre-demandes.png, captures/e-390-documents-historique.png |
| Fenêtre de décision d'un remplacement, 390×800 | Choix « Un titulaire assure le poste » | Partiel | Le bord droit des cartes de choix est rogné | Cosmétique | captures/e-390-dlg-decision-remplacement.png |
| Fenêtre de décision d'un remplacement | Lecture | Partiel | « Règles respectées · · aucun dépannage » pour un titulaire (séparateur doublé) ; même identifiant `dr-titulaire` pour le bouton radio et la liste déroulante | Cosmétique | captures/e-1280-dlg-decision-remplacement.png ; sortie r7.js (erreur « strict mode violation ») |
| Fenêtre « Faire rattraper / récupérer », 390×800 | Lecture | Partiel | Cases du planning de 8×40 px impossibles à viser au doigt, horaires tronqués (« 8 h 30 – 1… ») ; « Combien d'heures ? 4 h » alors que le créneau retenu fait 3 h | Mineur | captures/e-390-dlg-regulariser.png |
| Fenêtre de réglage d'une absence | Lecture | Partiel | Titre « 3 jours » face à la carte « 1 poste à couvrir », jours passés en tête | Majeur (voir 1.1) | captures/e-1280-dlg-reglage.png |
| Messages flash après une décision | « Choisir » une option | Partiel | « Pensez à publier la modification » alors qu'il n'y a rien à publier | Mineur (voir 1.1) | captures/r6-paul-construire.png |
| Fenêtre « Signaler » | Absence ou retard pour Igor | Partiel | « Elle arrivera plus tard que prévu. », « Elle ne pourra pas venir. » pour un homme ; « Pierre F. reçoit une notification » faux | Cosmétique / Majeur (voir 1.5) | captures/r3-signaler-igor.png |
| Saisie du retard | 0, −30, 999 minutes | Partiel | Aucune erreur expliquée, la valeur est corrigée en silence | Mineur | sortie r11.js |
| Heures | Lecture | Partiel | La période du compteur n'est pas écrite ; « Solder » n'explique pas ce qu'il fait d'un solde négatif (heures dues effacées) | Mineur | captures/e-1280-heures.png |
| Actions sans confirmation | Corbeille d'un document, corbeille d'une régularisation, « Régulariser automatiquement » | Partiel | Aucune confirmation ; pour le document, « Annuler » défait autre chose (voir 1.10) ; « Régulariser automatiquement » efface un brouillon posé à la main | Majeur | captures/r21-annuler-suppression.png |
| Exports | « Exporter le dossier », « Exporter pour le comptable » | Partiel | Le libellé promet un fichier ; on obtient une zone à copier | Mineur | captures/r19-export-dossier.png |
| Libellés et accords grammaticaux | Divers écrans | Partiel | « Arrêt de Igor L. », « Remplacement de Igor L. », « Le planning de Igor » (ailleurs « Arrêt d'Igor L. ») ; double point « Léa F.. », « Caroline T.. », « Sarah L.. » ; « Sarah L. demande à être remplacé » ; « Caroline T. est prévenu », « Léa est prévenu » ; « il ou elle reçoit votre message » ; « Semaine 49 · dans 1 semaines » ; « 1 poste déjà planifié ne respecte pas… Ils ne changent pas » ; noms en minuscules dans le journal (« réaffecter pierre f. ») ; « Du sam. 28 novembre au sam. 28 novembre » | Cosmétique | sorties r2.js, r3.js, r7.js, r8.js, r20.js |
| Formats d'heure | Messages, notifications, journal | Partiel | « 11:30 – 19:30 » et « 08:30 » dans les messages et notifications, « 11 h 30 – 19 h 30 » partout ailleurs ; « Compteur : -8 h » (trait d'union) contre « −8 h » | Cosmétique | sorties r4.js, r5.js, r7.js |
| Frise de Résoudre, 1280×760 | Lecture | Partiel | L'étiquette « Demandé » est tronquée en « Demand » dans la barre de Nicolas | Cosmétique | captures/e-1280-resoudre-demandes.png |
| Thème sombre, 1280×760 | Toutes les captures `e-1280-sombre-*` | Fonctionne | Contrastes et fenêtres lisibles ; mêmes remarques de troncature que le thème clair | | captures/e-1280-sombre-dlg-decision-conge.png |
| Contrôle automatique 390×800 | Débordement de page, éléments hors écran, textes coupés | Fonctionne | Aucun débordement de page sur les 22 écrans et fenêtres hormis Messages (débordement interne) ; seules cibles trop petites : la fenêtre de régularisation | | e390.log, e1280.log |

## 3. Incohérences et répétitions

Incohérences :
1. Résoudre, absence d'Igor : la carte dit « 1 poste à couvrir », la fenêtre « Voir et choisir la solution » dit « 3 jours » et règle des jours passés (src/ui/views/Resoudre.tsx, la fenêtre reprend tous les postes ouverts sans le filtre de date de la carte).
2. Message flash « Pensez à publier la modification » alors que la décision est déjà répercutée dans la version publiée et que « À publier » vaut 0.
3. Fenêtres de décision : « Ce que X recevra » ne correspond pas à ce qui part. Congé et horaire acceptés : aucun message. Remplacement « confié » ou « assuré par un titulaire » : le demandeur reçoit « vous restez en poste », le remplaçant « un collègue cherche un remplaçant ».
4. Remplacement confié : « +6 h sur son contrat » dans la fenêtre, « +5 h » dans la notification et le journal.
5. Signaler pour quelqu'un : « Pierre F. reçoit une notification » alors que rien n'est envoyé ; « 3 postes à couvrir » alors qu'aucun n'est créé (dates passées).
6. Équité : « le refus compte dans la mémoire d'équité » (fenêtre de décision et message flash), mais « Demandes refusées » et « Changements tardifs absorbés » sont toujours vides.
7. Équité compte le samedi de demain comme « travaillé » sur une fenêtre dite de 8 semaines qui en couvre 9 ; Statistiques s'arrête à aujourd'hui (Yanis 9 contre 8 samedis).
8. Heures affiche « À jour » après « Régulariser automatiquement » alors que le brouillon calculé ne contient pas les heures annoncées (Yanis 18 h 30 pour 24 h).
9. Construire, semaine du 16/11 : « Igor L. 12 h / 35 h · − 23 h » alors qu'Igor est en arrêt 3 jours ; Heures déduit l'arrêt (contrat de la semaine 14 h).
10. Heures « 0 h en plus des contrats », Fiche navette de novembre « 0,5 h en plus des contrats » (la seconde compte les heures supplémentaires semaine par semaine, la première le solde ; même libellé).
11. Journal : « 4 plannings publiés » ; Documents : « Plannings publiés 11 ».
12. Équipe : « Pharmaciens 1,8 / 2, Sous le seuil » ; Solvi : « 3,7 temps plein pour 2,1, c'est plus qu'il n'en faut ».
13. Statistiques : « les 4 dernières semaines publiées » alors que deux semaines publiées suivent (23/11 et 30/11).
14. Pierre : refuser une demande en attente demande l'accord de Caroline, refuser une demande déjà acceptée non.
15. Solvi : « 7 décisions vous attendent » suivi de 4 lignes qui en totalisent 6.
16. Le texte du tutoriel « Le compteur compare les heures publiées » alors que le compteur lit le brouillon (identique dans l'exemple).
17. Recherche de l'Aide sans tolérance aux fautes, alors que Solvi en a une.

Répétitions :
1. « Réaffecter Caroline T. » et « Je prends ce poste moi-même » proposent le même changement dans la même fenêtre (Igor, sam. 28/11).
2. « Accepter et confier le poste » à Pierre et « Accepter : un titulaire assure le poste » avec Pierre : deux chemins pour le même résultat dans la fenêtre de décision de Sarah.
3. La frise « Absences de l'équipe » est présentée deux fois, dans Résoudre > Demandes et dans Documents > Absences de l'équipe (même défaut d'affichage sur téléphone).
4. Les annonces de décision et les messages font souvent doublon pour la même personne (refus : annonce sous la cloche et message), alors qu'une acceptation n'a que l'annonce.

## 4. Ce qui n'a pas pu être testé

- « Personne ne peut reprendre ce poste » hors urgence médicale : aucun poste de l'exemple dans ce cas ; seul le dernier recours de l'urgence médicale a été joué.
- Onglet Gardes, « Repos à protéger » et « Garde confiée à une personne absente » : aucun cas dans l'exemple.
- L'affectation d'une garde et la publication elle-même : ouvertes depuis Résoudre, elles relèvent des écrans Gardes et Construire (autres auditeurs).
- Le téléchargement réel des exports : la version publiée affiche une zone à copier au lieu d'enregistrer un fichier (comportement voulu pour la page hébergée) ; l'événement download ne se déclenche donc pas. Le téléchargement par « Ouvrir » d'un document, lui, fonctionne.
- « Joindre » un justificatif dans l'historique des absences : bouton vu, non actionné.
- Le format des champs de date (affichés « 11/20/2026 ») dépend de la langue du Chromium de test, pas de l'application : non retenu comme défaut.
- Une vraie pharmacie (hors exemple) : tous les tests portent sur l'exemple ; le comportement « on retrouve sa pharmacie » après un tutoriel n'a pas été vérifié sur une pharmacie créée.

## Synthèse

Ce qui fonctionne bien : le circuit complet d'une absence (signalée, comparée, appel à l'équipe, volontaire, confiée) avec répercussion immédiate sur la version publiée, notifications et journal ; les décisions sur les congés et les horaires (y compris deux demandes sur les mêmes dates) ; le circuit d'accord entre titulaires ; l'accident du travail jusqu'au « C'est fait » ; les rendez-vous ; les compteurs d'heures et les statistiques, exacts au recalcul ; les dépôts de documents ; les 16 tutoriels essayés.

Défauts majeurs à retenir : la fenêtre de réglage d'une absence réécrit des journées passées et publiées ; les messages annoncés par les fenêtres de décision ne sont pas ceux envoyés (remplacement confié, titulaire en dernier recours, acceptations) ; une absence enregistrée par un titulaire ne prévient personne malgré ce qui est écrit ; « Annuler » après la suppression d'un document défait une autre décision ; « Régulariser automatiquement » efface un brouillon posé à la main et affiche « À jour » sans que les heures soient planifiées ; la récupération conseillée peut laisser un poste de 30 minutes ; deux compteurs d'Équité sont toujours vides ; le Journal ne trace pas toutes les décisions ; aucune règle ne borne les heures complémentaires d'un temps partiel ; Messages est inutilisable en largeur téléphone ; Solvi se trompe ou répond à côté sur 13 questions sur 28.
