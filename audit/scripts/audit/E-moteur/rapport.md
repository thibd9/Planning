# Audit E-moteur : justesse du moteur de calcul de Solvéa

Périmètre : `src/engine/`, `src/domain/`, `src/data/seed.ts`, et les actions de `src/store/store.ts` qui publient ou répercutent. Aucun navigateur : tout est vérifié par des essais chiffrés exécutés sur le code tel qu'il est.

Méthode
- Dossier de travail : `$S/audit/E-moteur/` (lien `node_modules` vers le dépôt, `vitest.config.ts` en environnement node, cache Vite dans ce dossier). Rien n'a été écrit dans `/home/user/releve-planning`.
- 10 fichiers d'essai dans `tests/` (règles, génération, compteurs, publication, dates, compléments, 1er mai, Rétablir, et deux sondes `x4` et `pu4` qui affichent le détail d'un cas). Chaque vérification est consignée sur une ligne JSON (`journaux/*.jsonl`, 230 lignes) et dans la sortie de la suite (`journaux/*.out`, dont `journaux/suite-complete.out` : 54 essais, tous exécutés sans erreur, 40 s). Les identifiants entre crochets ci-dessous ([RH3], [PU7]…) renvoient à ces lignes. Le champ `ok` d'une ligne est mon critère automatique ; le verdict qui fait foi est celui du tableau (pour [X3-*], le critère automatique ne regardait que les règles impératives : la ligne dit `ok` alors que le constat est un défaut, voir 1.2).
- Rejouer : `node /home/user/releve-planning/node_modules/vitest/vitest.mjs run --root $S/audit/E-moteur` (environ 40 s).
- Les 183 tests unitaires existants (19 fichiers) passent tous, rejoués depuis mon dossier sans toucher au dépôt : `journaux/tests-existants.out`.
- Jeu de données : `seed('2026-11-20', 2)`, c'est-à-dire l'exemple « établi » que charge `chargerExemple` (9 semaines publiées dans le passé, la semaine en cours et deux semaines à venir publiées, arrêt d'Igor du mercredi 18 au vendredi 20 novembre).

## Synthèse

Ce qui est juste : les seuils de durée, de repos quotidien, d'amplitude, la présence du pharmacien minute par minute, les absences et indisponibilités reconnues, les compétences, les délais de garde et de temps partiel, les jours fériés (fêtes mobiles comprises), les semaines ISO, le 29 février, le changement d'heure dans les gardes, les indemnités de garde, l'équité et le compteur d'heures (recomptés à la main), la répercussion d'une décision sur la version publiée. Les trois propositions sortent sans point bloquant sur 30 semaines-variantes sur 33 (les 3 autres portent un rendez-vous confié à une personne en arrêt), en 0,4 à 0,65 s par variante.

Ce qui ne va pas, par ordre d'importance :
1. Le calcul vise toujours le contrat entier : les heures d'un jour férié chômé sont « rattrapées » dans la semaine (Code du travail, L3133-2 : pas de récupération), et une personne en congé ou en arrêt une partie de la semaine se voit replanifier presque tout son contrat sur les jours restants ([JF-*], [ABS-*]). Le compteur d'heures, qui ne déduit pas non plus les fériés, fabrique ensuite des « retards » et propose des rattrapages à 8 personnes sur 8 ([SH-ferie], [SH-regul]).
2. Repos hebdomadaire : une semaine de 7 jours travaillés n'est pas signalée si la semaine précédente est vide ou si son week-end était libre ([RH3], [RH4]). Aucun contrôle des 6 jours au plus par semaine (L3132-1).
3. Heures complémentaires sans borne : une préparatrice à 24 h est planifiée à 45 h par les trois propositions, sans aucun point bloquant ni alerte ([X3], [H7]).
4. La variante « Habitudes d'abord » et le relais automatique à l'échéance recopient les habitudes sans relire repos posés ni indisponibilités reconnues ([HB-habitudes], [RL1]).
5. La date limite des préférences (le 20) tombe après la date limite de publication (le 17 ou le 18) avec les réglages par défaut, et le relais automatique se déclenche alors que la collecte est encore ouverte ([ECH1], [ECH2]).
6. Une décision publie en silence le brouillon de la même personne le même jour ([PU3]) ; « Annuler » juste après « Publier » dépublie la semaine et efface l'entrée du journal ([PU7]).
7. Les seuils des règles dites « obligatoires » acceptent n'importe quelle valeur (repos quotidien à 2 h, durée quotidienne à -1 h) ([RG1]).
8. Aucune règle pour les jeunes travailleurs (pas de date de naissance) ; les gardes à volets ouverts n'entrent ni dans la durée quotidienne ni dans la durée hebdomadaire ([JT1], [Q5], [GH1]).

## 1. Tableau des constats

### 1.1 Règles (validateur `validateWeek`, `validateEquipe`, `controlePublication`, délais)

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Durée quotidienne 10 h | 8 h-19 h avec pause de 59 min (10 h 01) ; même poste avec pause d'1 h (10 h pile) ; titulaire à 12 h ; deux postes 6 h + 4 h 30 | Fonctionne | 10 h 01 : bloquant « 10 h 01 de travail lundi, pour 10 h au plus » ; 10 h pile : rien ; titulaire : rien ; deux postes cumulés : bloquant 10 h 30 | | [Q1]-[Q4] `journaux/regles.out` |
| Durée quotidienne et garde à volets ouverts | Adjoint : poste de 9 h 30 de travail puis garde à volets ouverts 20 h-23 h le même jour (12 h 30 de travail effectif) | Ne fonctionne pas | Aucun constat. Le moteur paie cette garde comme du travail effectif (code GARDE_VO, 100 %) mais la fiche dit « le temps de garde est décompté à part » et `validateWeek` ne somme que les postes | Majeur (à vérifier en droit) | [Q5] |
| Amplitude 12 h | Deux postes 7 h-11 h et 15 h-19 h 01 ; puis 15 h-19 h | Fonctionne | 12 h 01 : bloquant ; 12 h pile : rien | | [A1] [A2] |
| Durée hebdomadaire 46 h | 5 jours de 9 h 15 (46 h 15) ; 5 jours de 9 h 12 (46 h pile) | Fonctionne | 46 h 15 : bloquant ; 46 h : rien | | [H1] [H2] |
| Durée hebdomadaire et garde | Adjoint : 42 h 30 de postes + garde à volets ouverts dimanche 9 h-19 h (52 h 30 de travail effectif) | Ne fonctionne pas | Seule l'alerte « plafond de l'officine 42 h » sort ; pas de bloquant 46 h | Majeur (à vérifier) | [GH1] `journaux/complements.out` |
| Plafond de l'officine 42 h | 42 h ; 42 h 15 ; 46 h ; 46 h 15 | Fonctionne | 42 h : rien ; 42 h 15 et 46 h : alerte ; 46 h 15 : seul le bloquant 46 h (pas de doublon) | | [H3]-[H6] |
| Heures complémentaires d'un temps partiel | Préparatrice 24 h planifiée 4 × 7 h 30 = 30 h | Ne fonctionne pas | Aucun constat : ni la limite du dixième (ou du tiers par accord), ni l'interdiction d'atteindre 35 h ne sont contrôlées. Voir aussi [X3] : 45 h pour un contrat de 24 h | Majeur | [H7] |
| Pause 20 min | 6 h 15 continues ; coupure de 19 min ; coupure de 20 min ; pause réglée à 30 min avec coupure de 25 min | Fonctionne | Signalé ; signalé (coupure fusionnée : 7 h continues) ; non signalé ; signalé : comme attendu | | [P1] [P3] [P4] [P6] |
| Pause : seuil des 6 h | 8 h-14 h sans coupure (6 h pile) | Partiel | Non signalé : le test est `> 360` (validate.ts l.276). L3121-16, cité par la fiche : « dès que le temps de travail quotidien atteint six heures ». L'écran du jour dit « dès 6 heures » (Jour.tsx l.241) | Mineur | [P2] |
| Pause courte de 20 min | 8 h-15 h avec une pause courte 10 h 50-11 h 10 saisie dans « pauses » | Partiel | Bloquant « 7 h de travail continu sans pause de 20 minutes » : les pauses courtes ne sont jamais lues par le contrôle, même de 20 min consécutives | Mineur | [P5] |
| Repos quotidien 11 h | 11 h pile ; 10 h 45 ; à cheval sur dimanche-lundi ; garde volets fermés suivie d'un poste à 9 h ; astreinte sans intervention ; astreinte avec intervention 2 h-3 h | Fonctionne | Résultats attendus dans les 6 cas, message précis (« 5 h 30 de repos entre mardi 3 h et mardi 8 h 30 ») | | [RQ1]-[RQ6] |
| Repos quotidien et changement d'heure | Samedi 27 mars 2027 fin 21 h, dimanche 28 début 8 h (10 h réelles, 11 h à l'horloge) | Partiel | Non signalé : le repos est mesuré en heure locale naïve (`absMin`) alors que `dureeReelle` existe | Mineur | [RQ7] |
| Repos hebdomadaire 36 h | Semaine précédente travaillée jusqu'au dimanche ; samedi 17 h → lundi 5 h (36 h) puis 4 h 45 (35 h 45) | Fonctionne | 36 h : rien ; 35 h 45 : bloquant | | [RH1] [RH2] |
| Repos hebdomadaire, première semaine | 7 jours sur 7 (9 h-16 h), semaine précédente vide | Ne fonctionne pas | Aucun constat alors que le plus long repos fait 17 h : avant le premier poste, le moteur compte un repos « infini » (validate.ts l.376, même logique dans generate.ts l.343-347) | Majeur | [RH3] |
| Repos hebdomadaire et 6 jours au plus | Semaine précédente du lundi au vendredi, puis 7 jours sur 7 | Ne fonctionne pas | Aucun constat : le week-end de la semaine précédente (65 h) est crédité à la semaine suivante. Le Code du travail (L3132-1) interdit plus de six jours de travail par semaine : aucun contrôle | Majeur | [RH4] |
| Pharmacien présent | 1 min sans pharmacien en fin de journée ; couverture pile ; pause d'un adjoint seul ; pause d'une titulaire seule ; pharmacien en formation ; 1er janvier fermé | Fonctionne | 19 h 29-19 h 30 bloquant avec la cause (« après le départ d'A1 ») ; pause de l'adjoint : trou 12 h 30-13 h 30 ; titulaire en pause : rien (règle annoncée) ; formation : toute la journée ; férié : aucun contrôle | | [PH1]-[PH6] |
| Seul pharmacien en rendez-vous | Adjoint seul en entretien ; puis avec la titulaire en poste | Fonctionne | Alerte, puis rien | | [RDV1] [RDV2] |
| Compétence et salle | Vaccination par un préparateur non formé ; adjoint en poste jusqu'à 10 h 29 pour 10 h-10 h 30 ; fin pile à 10 h 30 ; créneau sans personne ; salle réservée deux fois | Fonctionne | Bloquant, bloquant, rien, alerte, bloquant | | [C1]-[C5] |
| Compétence réservée aux pharmaciens | Entretien confié à un préparateur dont la fiche porte « entretien » | Partiel | Accepté : `validateWeek` lit la liste des compétences, pas `peutDetenir()` ; `majPersonne` ne filtre pas non plus (seul `majMesCompetences` filtre) | Mineur | [C6] |
| Effectif minimal | 3 personnes ; 2 personnes ; une en réception | Fonctionne | Rien ; alertes 10 h-12 h 30 et 16 h 30-19 h ; la réception ne compte pas | | [E1] [E2] [E5] |
| Effectif : pas de 30 min | Une personne en pause 10 h 15-10 h 45 ; une autre en pause 10 h 05-10 h 25 | Partiel | Le contrôle n'échantillonne qu'à 8 h 30, 9 h, 9 h 30… : alerte affichée « de 10 h 30 à 11 h » pour un manque réel de 10 h 15 à 10 h 45 ; le manque de 10 h 05 à 10 h 25 n'est pas vu | Mineur | [E3] [E4] |
| Absence approuvée | Poste pendant un congé approuvé ; congé demandé ; lendemain du congé | Fonctionne | Bloquant ; rien ; rien | | [AB1]-[AB3] |
| Indisponibilité reconnue, préférences | Journée ; plage 14 h-18 h touchée pile / dépassée de 15 min ; « finir avant 17 h » pile / 17 h 15 ; en attente ; prioritaire ; une semaine sur deux (paire, impaire) | Fonctionne | 9 cas conformes : bloquant pour reconnue, info pour prioritaire, rien en attente, parité juste | | [I1]-[I9] |
| Repos posé par le titulaire | Poste sur un jour où un repos est posé | Partiel | Le validateur ne contrôle pas les repos posés. Sans effet dans la grille (poser un poste efface le repos) mais rend invisibles les violations de [HB-habitudes] et [RL1] | Mineur | [RP1] |
| Samedis libres par mois | 5 samedis sur 5 en janvier 2027 ; 4 sur 5 | Fonctionne | Alerte ; rien | | [S1] [S2] |
| Temps partiel minimal 16 h | 15 h ; 16 h ; étudiant et apprenti à 10 h ; animatrice à 21 h | Fonctionne (seuil à vérifier) | Alerte à 15 h seulement ; dérogations respectées. 16 h est une « source secondaire » : le Code fixe 24 h (L3123-27) sauf accord de branche | | [TP1]-[TP4] |
| Nombre de pharmaciens | CA 2 600 000 € et 2 599 999 € avec 1,8 ETP d'adjoints | Fonctionne | 2 ETP attendus puis 1 : tranche révolue respectée | | [AD1] [AD2] |
| Délai de garde 15 jours | 15 jours ; 14 jours ; exceptionnel vendredi pour lundi ; exceptionnel samedi pour lundi ; titulaire | Fonctionne | Tenu, non tenu, tenu (2 jours ouvrables en comptant le jour de la garde : à vérifier), non tenu, sans délai | | [DG1]-[DG5] |
| Délai temps partiel 7 jours ouvrés | Publication le 30 déc. 2026 pour le 11 janv. 2027 (1er janv. exclu) ; le 31 ; changement publié 2 jours avant | Fonctionne | Tenu (7) ; signalé (6) ; signalé (2) | | [DT1]-[DT3] |
| Délai de prévenance d'un temps plein | Poste d'un temps plein allongé de 2 h, publié la veille | Partiel | Aucun délai signalé ; l'avis est seulement marqué « tardif ». La fiche « delai.remplacement » affirme pourtant qu'un changement d'horaire d'un collègue suppose 7 jours (L3121-47) | Mineur (à vérifier) | [DT4] |
| Délai de remplacement 7 jours | Poste à 7 jours, puis à 6 ; fiche abaissée à 1 jour | Fonctionne | Accepté puis refusé ; plancher de 3 jours tenu | | [DR1] [DR2] |
| Jeunes travailleurs (apprentie, étudiant) | Manon (apprentie, 21 h) planifiée 4 × 9 h 30 + 3 h 30 = 41 h 30 | Ne fonctionne pas | Aucun constat : pas de date de naissance dans `Person`, aucune règle « moins de 18 ans » (8 h/j et 35 h/sem., L3162-1 ; pause de 30 min dès 4 h 30, L3162-3 ; 12 h de repos, L3164-1 ; 2 jours de repos consécutifs, L3164-2), et le dépassement du contrat n'est jamais signalé (seul le plafond de 42 h l'est). Les propositions gardent Manon entre 19 h et 21 h 30 | Majeur si l'apprentie est mineure | [JT1] [JT2] |
| Seuils des règles « obligatoires » | `majRegle` : repos quotidien 2 h, durée hebdomadaire 70 h, durée quotidienne -1 h | Ne fonctionne pas | Tout est enregistré (nouvelle version de la règle, notée au journal) ; à -1 h, chaque journée travaillée par un salarié devient bloquante (36 constats sur la semaine du 23 nov.). La page Règles affiche un champ « Seuil » sans borne pour ces règles et dit « le planning ne peut pas l'enfreindre » | Majeur | [RG1] `journaux/publication.out` |
| Désactiver une règle impérative | `majRegle('pharmacie.presence', { active: false })` puis retrait de tous les pharmaciens | Partiel | Accepté par le magasin, plus aucun constat de présence. L'écran masque la case, ce n'est donc atteignable que par l'action | Mineur | [RG2] |
| 1er mai travaillé | Officine réglée « ouverte les jours fériés », semaine du lundi 1er mai 2028 | Partiel (à vérifier) | 10 postes générés le 1er mai, aucun constat, aucune variable dans la fiche navette. Seules les gardes du 1er mai sont traitées | Mineur | [MAI1] `journaux/premiermai.out` |
| Majorations de nuit (garde volets ouverts) | Lecture de `variablesGarde` | Partiel | Fiche annoncée (20 % et 40 %) mais aucun calcul : une note renvoie au comptable | Mineur | gardes.ts l.259-261 |
| Moyenne de 44 h sur 12 semaines | Lecture du validateur | Non testable | Aucune règle ne la porte (pas de donnée à tester) ; à vérifier selon la convention | | validate.ts |

### 1.2 Propositions de planning (`generer`, `genererVariantes`, `preparerMois`)

33 propositions : 11 semaines (16 et 23 nov., 30 nov. avec le congé de Nicolas approuvé, 7 déc. avec un repos posé, 14 déc. avec congé lundi-mardi d'Inès et repos posé de Léa, 21 déc. Noël, 28 déc. 1er janvier et garde d'Igor, 4 janv. arrêt de Jules, 29 mars 2027 lundi de Pâques, 3 mai 2027 Ascension et 8 mai, 17 mai 2027 lundi de Pentecôte) × 3 variantes. Détail : `journaux/generation.out`, `journaux/generation-mesures.json`, `journaux/generation-comparaison.txt`.

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Points bloquants restants | 33 propositions contrôlées par `validateWeek` | Fonctionne | 30 sans bloquant ; 3 (semaine en cours) avec 1 bloquant chacune : la vaccination du jeudi reste confiée à Igor, en arrêt (donnée de l'exemple, non corrigible par le calcul) | | [G-*] |
| Absences, repos posés, indisponibilités reconnues | Mêmes 33 propositions | Fonctionne | 0 poste pendant une absence, 0 sur un repos posé, 0 contre une indisponibilité reconnue | | [G-*] |
| Personnes au-delà du contrat | Mêmes 33 | Fonctionne | Personne au-delà de 46 h ; « Équité » et « Préférences » dépassent de 30 min 0 à 3 personnes ; « Contrats d'abord » : jamais | | [G-*] [GV2] |
| Préférences suivies | Semaines avec préférences de décembre | Fonctionne | « Préférences d'abord » en suit le plus dans 11 semaines sur 11 ; sur les 5 semaines de décembre (16 à 28 préférences) : 88 à 96 %, contre 62 à 81 % pour les deux autres | | [GV1] |
| Équité des samedis | Écart type (réel - attendu) sur 8 semaines | Partiel | « Équité d'abord » n'a le plus petit écart que 4 semaines sur 11 ; les écarts entre variantes ne dépassent pas 0,16 : la variante ne change pas mesurablement la répartition | Mineur | [GV3] `generation-comparaison.txt` |
| Objectif d'heures et jours fériés | Semaines de Noël (vendredi), du 1er janvier (vendredi), de l'Ascension + 8 mai | Ne fonctionne pas | Noël : 3 temps pleins sur 4 à 34 h 30 en 5 jours (semaine normale : 33 à 35 h 30) ; 1er janvier : 4 sur 4 à 34 h 30 ; semaine de l'Ascension et du 8 mai (4 jours ouverts) : 33 h pour chacun, soit 8 h 15 par jour ouvert en moyenne. Les heures du férié sont replanifiées sur les autres jours, contraire à L3133-2 (« Les heures de travail perdues par suite de chômage des jours fériés ne donnent pas lieu à récupération »). `cibleSemaine` = contrat + régularisations, sans férié | Majeur | [JF-2026-12-21] [JF-2026-12-28] [JF-2027-05-03] |
| Objectif d'heures et absences partielles | Inès (24 h) en congé lundi-mardi ; Igor (35 h) en arrêt mercredi-vendredi | Ne fonctionne pas | Inès : 23 à 24 h planifiées du jeudi au samedi pour un contrat de semaine de 14,4 h (`contratSemaine`) ; Igor : 28 h lundi, mardi, samedi pour 14 h. Le calcul fait « rattraper » le congé ou l'arrêt ; le compteur comptera ensuite ces heures comme des heures en plus | Majeur | [ABS-ines-*] [ABS-igor-*] |
| Samedis libres par mois | 33 propositions | Partiel | 6 propositions (semaines du 16 et du 23 nov.) laissent 2 à 5 personnes « tous les samedis du mois » : le calcul ne lit pas `equipe.samedisLibres` | Mineur | [SL1] |
| Variante « Habitudes d'abord » | Mode « vous seul », repos posé pour Nicolas le lundi 7 déc. et indisponibilité reconnue le mardi | Ne fonctionne pas | Les variantes Équité et Contrats respectent les deux ; « Habitudes » pose Nicolas lundi et mardi (1 bloquant visible, le repos posé n'est pas contrôlé). `semaineHabituelle` recopie l'historique et le calcul garde ces postes comme fixes | Majeur | [HB-*] |
| Relais à l'échéance (`preparerMois`) | Décembre 2026 préparé le 18 nov. d'après les habitudes, avec un repos posé et une indisponibilité reconnue nouvelle | Ne fonctionne pas | 4 semaines préparées : 1 poste sur le repos posé, 4 postes contre l'indisponibilité reconnue, 4 bloquants. En vraie pharmacie, ce relais part sans geste à l'ouverture du tableau de bord (Tableau.tsx l.195-200) | Majeur | [RL1] |
| Postes types plus longs que la loi | Poste type 8 h 30-19 h 30 sans pause ajouté à ceux de l'exemple (3 graines) ; puis seul poste type en semaine | Partiel | 13 postes de 11 h sans pause donnés à des salariés alors que des postes légaux existent (26 bloquants). Le calcul ne vérifie ni durée quotidienne, ni amplitude, ni pause, alors que sa notice les range parmi les « règles impératives » ; l'écran de poste type ne vérifie que fin > début | Majeur | [X5b] [X5] |
| Cas extrême : un seul pharmacien, la titulaire | Équipe sans Pierre, Igor, Léa ni Paul | Fonctionne | 0 bloquant ; la titulaire (non salariée) porte 56 h 30 ; aucun salarié au-delà de 46 h | | [X1-*] |
| Cas extrême : un seul pharmacien salarié | Igor seul pharmacien, 57 h d'ouverture | Partiel | Diagnostic juste (« Pas assez d'heures de pharmacien sur la semaine », créneaux découverts) mais « Équité » et « Préférences » planifient Igor 46 h 30 (bloquant 46 h) pour couvrir davantage : un quart d'heure au-delà du maximum légal coûte au calcul autant qu'un quart d'heure sans pharmacien, et un repos manqué ne coûte qu'une unité quelle que soit sa durée (generate.ts l.313, l.333, l.375) | Majeur | [X2-*] |
| Cas extrême : équipe trop petite | Titulaire + Inès (24 h) | Ne fonctionne pas | Les trois variantes planifient Inès 45 h (contrat 24 h), 0 bloquant : le poids de l'effectif écrase l'écart au contrat, et aucune règle ne borne les heures complémentaires | Majeur | [X3-*] |
| Cas extrême : 7 jours sur 7 | Dimanche 9 h-19 h ajouté, trois semaines enchaînées | Fonctionne | Aucun salarié à 6 ou 7 jours. Le seul bloquant (dimanche 13 h-14 h) vient de mes postes du dimanche, et le diagnostic le dit (« Aucun poste type le dimanche de 13 h à 14 h ») | | [X4-*] `journaux/x4.out` |
| Temps de calcul | 33 propositions ; équipe de 29 personnes | Fonctionne | 0,41 à 0,65 s par variante (3 variantes : 1,2 à 2 s) ; 29 personnes : 0,74 s | | [G-*] [PERF] |

### 1.3 Compteurs (heures, équité, ETP, coût, gardes, suivi)

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Compteur d'heures (`soldeHeures`) | Recomptage à la main sur les 9 semaines publiées pour Nicolas, Igor, Inès, Manon | Fonctionne | Valeurs identiques : Nicolas 307 h pour 315 h (-8 h), Igor 286 h pour 294 h (-8 h), Inès 211 h pour 216 h (-5 h), Manon 184 h 30 pour 189 h (-4 h 30) | | [SH-*] `journaux/compteurs.out` |
| Contrat d'une semaine avec férié | Semaine du 9 nov. 2026 (mercredi 11 fermé) | Ne fonctionne pas | Contrat compté 35 h pour les temps pleins (planifiés 33 à 34 h 30) ; Yanis perd 7 h cette semaine-là. Tous les soldes sont négatifs et `proposerRegularisations` propose des rattrapages à 8 salariés sur 8 (Igor, Nicolas, Yanis : 8 h chacun) | Majeur | [SH-ferie] [SH-regul] [SH-detail] |
| Compteur et brouillon | Poste de Nicolas allongé de 2 h en brouillon sur une semaine publiée | Partiel | Solde -8 h → -6 h avant toute publication : `soldeHeures` lit `data.shifts`, pas la version publiée, alors que sa notice dit « planifié et publié » | Mineur | [SH-brouillon] |
| Semaine en cours | Vendredi 20 nov. | Fonctionne (à vérifier) | Les 9 h du samedi à venir sont déjà comptées comme réalisées | | [SH-encours] |
| Heures d'une personne sur un mois | Nicolas et Inès, octobre 2026 | Fonctionne | Fiche navette 154 h et 105 h 30, vue Mois identique, recomptage identique. `heuresMois()` (semaines entières, non utilisé à l'écran) donne 172 h 30 et 117 h | | [HM-*] |
| Objectif du mois et férié (vue Mois) | Nicolas, novembre 2026 | Partiel | Objectif 147 h pour 20 jours ouvrés hors férié (140 h attendues) : le 11 novembre compte dans l'objectif | Mineur | [HM-nov] |
| Heures supplémentaires de la fiche navette | Octobre 2026 | Fonctionne | 0 h, comme le recomptage ; la semaine du 28 sept. est rattachée à septembre (choix documenté) | | [HS-*] |
| Jours d'absence de la fiche navette | Congé du lundi 5 au dimanche 18 octobre | Partiel (à vérifier) | « Congé : 14 j » : jours calendaires, dimanches compris (12 jours ouvrables ou 10 ouvrés selon le décompte des congés payés) | Mineur | [FN-abs] |
| Équité des samedis et fermetures | 8 semaines avant la semaine en cours | Fonctionne | Réel et attendu identiques au recomptage (ex. Caroline 7/7,84, Yanis 8/2,99) ; 124 fermetures des deux côtés. Les titulaires sont dans le partage ; Yanis, disponible seulement le mercredi et le samedi, apparaît très au-dessus de sa part | | [EQ-*] |
| ETP | Équipe de l'exemple ; Igor passé à 39 h | Partiel | 8,83 ETP juste (titulaires et apprentie comptés). À 39 h : statistiques 1,8 ETP d'adjoints, contrôle du nombre de pharmaciens 1,91 (plafond à 1 d'un côté, pas de l'autre) | Mineur | [ETP1] [ETP2] |
| Coût, contrat de 39 h | 39 h planifiées, 10 €/h | Ne fonctionne pas | 440 € au lieu de 400 € (35 × 10 + 4 × 12,50) : `taux × (contrat + heures majorées)` paie deux fois les heures de la 36e à la 39e. Faux pour tout contrat au-delà de 35 h (coûts masqués par défaut) | Majeur | [PAY1] |
| Coût, autres cas | 35 h → 44 h ; 24 h → 30 h ; 35 h → 30 h | Fonctionne | 465 € ; 311,40 € (10 % puis 25 %) ; 350 € | | [PAY2]-[PAY4] |
| Garde volets fermés | Igor (35 h) et Léa (28 h), mardi 20 h-mercredi 8 h | Fonctionne | Igor : 3 h d'équivalence = 72 € ; Léa : 12 h à 100 % = 282 € | | [GA1] [GA2] |
| Garde dimanche, 1er mai | Léa dimanche 9 h-19 h (point 4,50 €) ; Igor 1er mai 2027 | Fonctionne | 15 points = 67,50 € + 10 h + 10 h de repos ; 1er mai : 240 € + 240 € + 10 h de repos | | [GA3] [GA4] |
| Garde et changement d'heure | Nuits du 24-25 oct. 2026 et du 27-28 mars 2027 | Fonctionne | 13 h et 11 h réelles, ventilées samedi/dimanche | | [GA5] [GA6] |
| Garde à cheval sur l'année | 31 déc. 19 h 30-1er janv. 8 h 30 | Fonctionne | 1,13 h d'équivalence en décembre, 12,75 points en janvier, repos rattaché à décembre ; la fiche navette de décembre ne prend que sa part | | [GA7] [GA10] |
| Astreinte | 14 h avec une intervention de 45 min ; un dimanche | Fonctionne (dimanche à vérifier) | 33,60 € + 18 € ; le dimanche, aucune sujétion | | [GA8] [GA9] |
| Suivi de présence | Arrêt d'Igor ; retards de Jules | Fonctionne | 3 jours ; 2 retards, 25 min | | [SU1] [SU2] |

### 1.4 Publication et répercussions (`publish.ts`, `store.ts`)

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Retouche dans la grille | `saveShift`, `moveShift`, `deleteShift`, `poserRepos`, `viderSemaine` sur une semaine publiée | Fonctionne | Version publiée inchangée dans les 5 cas ; l'écart attend « Publier » | | [PU1*] `journaux/publication.out` |
| Décision sur une autre journée | Brouillon pour Inès, puis arrêt de Thomas un autre jour | Fonctionne | Thomas retiré de la version publiée sans republier (`publishedAt` inchangé) ; le brouillon d'Inès reste seul en attente | | [PU2] |
| Décision sur la même journée qu'un brouillon | Inès : prise de poste retardée d'1 h en brouillon, puis inventaire 20 h-21 h ce jour-là | Ne fonctionne pas | Version publiée = « 9 h 30-19 h 30 + inventaire » : le brouillon est publié avec la décision ; l'avis reçu ne parle que de l'inventaire. `repercuter` recopie toute la journée actuelle de la personne touchée | Majeur | [PU3] |
| Réparation et brouillon | Poste à couvrir réglé par « Réaffecter Pierre F. » ; Pierre avait en brouillon une demi-heure d'administratif le même jour | Partiel | Le brouillon n'est pas publié, mais il est supprimé : l'option retire tous les postes de Pierre ce jour-là, brouillon compris, sans le dire | Mineur | [PU4] `journaux/pu4.out` |
| Décision sur une semaine non publiée | Arrêt sur une semaine copiée en brouillon | Fonctionne | Rien n'est publié | | [PU5] |
| Avis tardif | Inventaire dans 3 jours | Fonctionne | Avis marqué « tardif » | | [PU6] |
| « Annuler » après « Publier » | Copier une semaine, la publier, Annuler | Ne fonctionne pas | La semaine n'est plus publiée, ses postes disparaissent, l'entrée « publié » du journal aussi (6 → 5). « Rétablir » la ramène [PU7b], et Annuler une retouche faite après une publication ne dépublie pas. `publier` est un commit non annulable : Annuler revient à l'état d'avant la copie | Majeur | [PU7] [PU7b] `journaux/redo.out` |

### 1.5 Dates (`time.ts`, `echeance.ts`, `officine.ts`, `souhaits.ts`)

| Fonction | Scénario joué | Résultat | Constat précis | Gravité | Preuve |
|---|---|---|---|---|---|
| Semaines ISO et fin d'année | 10 dates, dont 31/12/2026 (S53), 01/01/2027 (S53), 04/01/2027 (S1), 30/12/2024 (S1), 02/01/2028 (S52) | Fonctionne | Toutes justes ; lundi du 1er janvier 2027 = 28 déc. 2026 | | [ISO1]-[ISO3] `journaux/dates.out` |
| 29 février | 28/02/2028 + 1, 28/02/2027 + 1, février 2100, limite au 29 | Fonctionne | Justes, y compris 2100 non bissextile | | [B1]-[B5] |
| Jours fériés, fêtes mobiles | Lundi de Pâques, Ascension, lundi de Pentecôte 2025 à 2028 et 2038 ; liste légale | Fonctionne | Toutes justes ; 11 jours (L3133-1) | | [JF-*] |
| Jours fériés régionaux | Vendredi saint et 26 décembre (Alsace-Moselle) | Partiel | Non gérés, aucun réglage de région | Mineur | [JF-am] |
| Jours ouvrables et ouvrés | Noël 2026 ; 1er-8 mai 2026 | Fonctionne | 2 et 4, justes | | [JF-ov] [JF-oe] |
| Changement d'heure | Décalage à 1 h 59, 3 h, heure ambiguë ; gardes de 24 h autour du 25 oct. | Fonctionne | Justes (heure ambiguë comptée en heure d'été) | | [DST1]-[DST4] |
| Échéance de publication et limite des préférences | Réglages par défaut, 5 mois | Ne fonctionne pas | Décembre : préférences jusqu'au 20 nov., publication au plus tard le 17 nov. (rappel dès le 10) ; même décalage de 2 à 5 jours les 5 mois testés. Aucun contrôle croisé entre les deux réglages | Majeur | [ECH1] |
| Relais pendant la collecte | Le 18 nov. 2026 | Ne fonctionne pas | État « dépassé », 4 semaines vides à préparer, alors que la collecte des préférences de décembre reste ouverte jusqu'au 20 : le relais automatique remplit le mois avant la fin de la collecte | Majeur | [ECH2] |
| Échéance de janvier | Le 10 déc. 2026 | Fonctionne | Mois 2027-01, échéance 18 déc., semaines du 28 déc. au 25 janv. | | [ECH4] |
| Officine en chiffres | Phrases ; incohérences ; valeurs négatives | Partiel | Phrases et 3 remarques justes ; une surface de vente de -10 m² ne déclenche aucune remarque | Mineur | [OF1]-[OF3] |

### 1.6 Seuils comparés au droit

| Règle | Seuil du moteur | Ce que je connais du texte | Avis |
|---|---|---|---|
| Durée quotidienne | 10 h | Code du travail, L3121-18 : 10 h, dérogations jusqu'à 12 h | Juste |
| Amplitude | 12 h | Pas de plafond explicite dans le Code ; le repos de 11 h donne 13 h au plus | Plus strict que le Code ; source conventionnelle à vérifier |
| Durée hebdomadaire | 46 h | L3121-20 : 48 h ; L3121-22 : 44 h en moyenne sur 12 semaines (46 h par accord) | 46 h prudent ; la moyenne sur 12 semaines n'est pas contrôlée ; à vérifier dans la convention |
| Pause | 20 min au-delà de 6 h | L3121-16 : dès que le temps de travail quotidien atteint 6 h | Juste sauf le cas « 6 h pile » |
| Repos quotidien | 11 h | L3131-1 : 11 h consécutives | Juste |
| Repos hebdomadaire | 36 h | L3132-2 : 24 h + 11 h = 35 h ; L3132-1 : 6 jours au plus | 36 h plus protecteur ; les 6 jours au plus ne sont pas contrôlés ; convention à vérifier |
| Temps partiel minimal | 16 h | L3123-27 : 24 h sauf accord de branche ou demande du salarié | À vérifier sur l'accord de branche (marqué « à valider ») |
| Heures supplémentaires | 25 % de 35 à 43 h, 50 % au-delà | L3121-36 (taux supplétifs) | Juste, mais coût faux au-delà d'un contrat de 35 h (PAY1) |
| Heures complémentaires | 10 % dans le dixième, 25 % au-delà | Majorations du Code ; limite du dixième (tiers par accord) ; jamais jusqu'à la durée légale | Calcul juste ; limites non contrôlées (H7, X3) |
| Jours fériés | 11 jours, fermeture réglable | L3133-1 (liste) ; L3133-2 (pas de récupération) ; 1er mai chômé | Liste juste ; récupération faite par le calcul (JF) ; 1er mai sans alerte |
| Jeunes travailleurs | aucun | L3162-1, L3162-3, L3164-1, L3164-2 | Non géré |
| Pharmacien présent | chaque minute d'ouverture | Code de la santé publique (présence d'un pharmacien) | Principe juste ; la pause du titulaire comptée comme présence est un choix à faire valider |
| Nombre de pharmaciens | 1 ETP par tranche révolue de 1,3 M€ | Seuil fixé par arrêté | À vérifier (marqué « à valider ») |
| Gardes : 15 jours, 25 %, 1,5 point/h, 10 % | selon la fiche | Accord du 23 mars 2000, article 4, que je n'ai pas sous les yeux | Calculs conformes aux fiches ; textes et décompte des jours ouvrables à faire vérifier |
| Délai temps partiel | 7 jours ouvrés (lundi-vendredi) | L3123-31 (cité par la fiche) | Juste ; compter lundi-vendredi est plus strict qu'un décompte sur les jours d'ouverture |

## 2. Incohérences et répétitions

Incohérences
1. Pause : « dès 6 heures de travail dans la journée » (src/ui/components/Jour.tsx l.241 ; src/ui/parcours/ecransSuivre.ts l.691), « au-delà de 6 heures de travail continu » (src/domain/rules.ts, fiche duree.pause), « Au-delà de six heures » (src/ui/bot.ts l.440) ; le validateur applique `> 360` (validate.ts l.276). Le texte cité (L3121-16) dit « atteint ».
2. Page Règles : « Obligatoire : le planning ne peut pas l'enfreindre » (src/ui/views/Regles.tsx), alors que le seuil de ces règles se modifie sans borne (RG1), que la publication accepte des « bloquants assumés » (store.ts, `publier`) et que le calcul propose lui-même des plannings bloquants (X2, X5b).
3. Deux contrats de semaine : `contratSemaine` (absences déduites, sert au compteur, aux statistiques, à l'espace) et `cibleSemaine` (sans absences ni fériés, sert au calcul). Le calcul vise un objectif que le compteur comptera ensuite comme des heures en plus (ABS) ou, pour un férié, comme un retard (SH-ferie).
4. Échéance de publication (14 jours avant le 1er, soit le 17 ou le 18) et date limite des préférences (le 20) : deux réglages voisins dans l'écran Officine, sans contrôle croisé (ECH1, ECH2).
5. Notice de `generer` (generate.ts l.125-129) : « trois niveaux qui ne se compensent jamais : 1. règles impératives (durées, repos, présence d'un pharmacien, absences, indisponibilités reconnues) ». En réalité le calcul ne contraint ni la durée quotidienne, ni l'amplitude, ni la pause (X5b), et ses règles impératives se compensent entre elles (X2).
6. Garde à volets ouverts : payée comme « travail effectif » (gardes.ts, GARDE_VO) mais exclue des durées (« le temps de garde est décompté à part », fiche duree.quotidienne) (Q5, GH1).
7. Délai de prévenance : la fiche delai.remplacement dit qu'un collègue dont les horaires changent doit être prévenu 7 jours avant ; à la publication, seul le temps partiel est contrôlé (DT4).
8. ETP : plafonné à 1 par personne dans les statistiques (stats.ts l.170), non plafonné dans le contrôle du nombre de pharmaciens (validate.ts l.446-453) (ETP2).
9. Trois calculs d'heures du mois : `ficheNavette` (jours du mois), `planifieMois` (jours du mois, objectif sur les jours ouvrés lundi-vendredi, fériés compris), `heuresMois` (semaines entières, débordant sur les mois voisins ; utilisé par les tests seulement).
10. Un jour d'absence vaut 1/5 de semaine (lundi-vendredi) dans le compteur, un jour calendaire (dimanche compris) dans la fiche navette (FN-abs).
11. `equipe.samedisLibres` est lue par le validateur mais pas par le calcul (SL1).
12. Compteur d'heures : la notice dit « ce qui a été planifié et publié », le code lit le brouillon (SH-brouillon).

Répétitions
1. `semainesDuMois` est écrite deux fois, à l'identique (src/engine/payroll.ts l.66 et src/engine/echeance.ts l.28) (ECH3).
2. La déduction « un cinquième par jour ouvré d'absence » est réécrite trois fois (heures.ts `contratSemaine`, souhaits.ts `heuresMois`, souhaits.ts `planifieMois`, cette dernière par jour et sans le samedi).
3. Le temps de travail d'un poste est recalculé en ligne (`s.end - s.start - ((s.pauseEnd ?? 0) - (s.pauseStart ?? 0))`) dans payroll.ts l.102 et souhaits.ts `planifieMois`, au lieu de `minutesTravail` ; équivalent tant que la pause est dans le poste.
4. « Indisponibilité reconnue toute la journée, chaque semaine, ce jour-là » est testée deux fois avec la même expression (equity.ts `eligible`, gardes.ts `candidatsGarde`).
5. Le lundi d'une date est recalculé en ligne (`fromDayIndex(dayIndex(d) - ((dayIndex(d) + 3) % 7))`) dans plusieurs actions de store.ts au lieu de `mondayOf`.
6. Mois suivant : `moisSuivant` (echeance.ts) et `moisDecale` (souhaits.ts) font le même calcul.

## 3. Tests unitaires existants : ce qu'ils couvrent

| Point | Tests existants qui le couvrent | Non couvert par aucun test |
|---|---|---|
| Règles | engine.test.ts « signale la minute sans pharmacien, pause comprise », « un titulaire compte comme pharmacien… », « contrôle le repos de 11 h et la durée quotidienne des salariés, pas du titulaire », « distingue indisponibilité reconnue (bloquant) et préférence (information) », « signale sans bloquer le plafond d'heures et les samedis libres choisis par l'officine », « refuse une demande de remplacement pour le lendemain, l'accepte à sept jours », « ne descend jamais sous trois jours », « contrôle le délai de 15 jours et le repos après la garde » ; presence.test.ts (4 tests) ; bot.test.ts « refuse un collègue dont les heures de la semaine dépasseraient le plafond » | Amplitude, durée hebdomadaire 46 h, pause, repos hebdomadaire, effectif minimal, absence approuvée dans le validateur, temps partiel minimal, nombre de pharmaciens (`validateEquipe`), délais de publication (`controlePublication`), compétences (seulement indirectement), tous les cas limites « pile au seuil », jeunes travailleurs, gardes dans les durées, bornes de `majRegle` |
| Propositions | engine.test.ts « génération » (5 tests : sans bloquant, reproductible et absences, trois variantes, habitudes, conserver), « génère une première semaine pour une petite équipe », « recalcule les semaines en brouillon du mois… » ; modele.test.ts (2) ; repos.test.ts « une proposition respecte les repos posés » ; echeance.test.ts « prépare les semaines vides en brouillon… » | Jours fériés et objectif d'heures, absence partielle et objectif, cas extrêmes (pharmacien salarié seul, équipe trop petite, 7 j/7), variante Habitudes et relais face aux repos posés et indisponibilités, postes types illégaux, samedis libres, temps de calcul |
| Compteurs | engine.test.ts « compteur d'heures » (5), « compare les samedis au prorata », « garde le détail de ce qui est compté… », « exporte une fiche navette lisible », gardes (ventilation, fin de mois, temps partiel, délai), « compte retards, départs et jours d'absence » ; stats.test.ts (8) ; bot.test.ts « vue mois : heures planifiées face au contrat » | Contrat d'une semaine fériée, brouillon dans le compteur, coût (`decompteSemaine`, `coutSemaine` : aucun test), cohérence des ETP, montants d'astreinte et du 1er mai, jours d'absence de la fiche navette, valeurs des heures supplémentaires |
| Publication | symbiose.test.ts (13 tests, dont « une retouche à la main dans la grille reste un brouillon… » et « une absence enregistrée par le titulaire se lit partout, sans republier ») ; store.test.ts « décisions annoncées » ; repos.test.ts « remettre un planning à zéro » | Brouillon et décision sur la même journée (PU3), réparation qui efface un brouillon (PU4), Annuler après Publier (PU7) |
| Dates | engine.test.ts « temps » (3 : jours, fériés 2026-2027, changement d'heure, jours ouvrés) ; echeance.test.ts « compte les semaines qui touchent le mois », « rappelle avant l'échéance… » ; engine.test.ts « ferme la collecte le 20 du mois précédent » ; accident.test.ts (fériés et dimanches) ; time.test.ts (moments, ancienneté) | Semaines ISO, 29 février, lundi de Pentecôte, années lointaines, heure ambiguë, semaine à cheval sur deux années, cohérence échéance/préférences (les deux valeurs sont testées séparément, jamais ensemble), jours fériés régionaux |

## 4. Ce que je n'ai pas pu tester

- Le texte de la convention collective (IDCC 1996) et de l'accord du 23 mars 2000 : je ne les ai pas sous les yeux ; les seuils qui en dépendent sont marqués « à vérifier » sans référence inventée.
- Les règles des jeunes travailleurs sur l'exemple : aucune date de naissance n'existe, je ne peux pas savoir si Manon est mineure.
- L'effet à l'écran (page Règles, vue Mois, tableau de bord) : hors périmètre, aucun navigateur utilisé ; j'ai seulement relevé le texte des composants cités.
- Le montant de l'indemnité de dérangement (barème FSPF) et les majorations de nuit : le moteur ne les calcule pas, il n'y a rien à comparer.
- Le diagnostic et la réparation en profondeur : seulement leurs effets sur la publication (PU4) et sur les cas extrêmes.
