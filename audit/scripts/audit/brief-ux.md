# Revue UX / UI de Solvéa, page par page : consignes communes

Lis d'abord /tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/brief-audit.md : la règle
« tu ne modifies rien », la façon d'ouvrir l'application et d'entrer sous un profil, le dossier où écrire. Elles
s'appliquent ici. Écris tout en français, sans tiret cadratin ni émoji.

## La demande du client (mot pour mot)
« Je veux toutes les erreurs UX, UI, les répétitions, les doublons, tout ce qui est répétitif, ce qui n'est pas très
lisible, absolument tout ce qui ne convient pas, les erreurs d'ergonomie. Il faut absolument que j'aie le rapport le
plus complet possible, si possible fait page par page. »
Il veut tout, mais il veut du vrai : chaque point doit être visible sur une capture que tu as regardée.

## Méthode, pour CHAQUE page et CHAQUE fenêtre de ton périmètre
1. Capture à trois tailles : 1440×900 (ordinateur), 1280×760 (portable 13 pouces) et 390×800 (téléphone). Fais
   défiler la page : capture aussi le bas (le contenu défile dans l'élément `#contenu`, pas dans la fenêtre ; fais
   `document.getElementById('contenu').scrollTo(0, y)` ou capture des éléments). Ajoute une capture en thème sombre
   (`mode: 'sombre'`) pour les pages principales. Lance sans PLIE pour tout voir ouvert, puis avec `PLIE=1` pour juger
   l'état réel à l'ouverture (accordéons fermés, premier onglet).
2. REGARDE chaque capture (outil Read). Ne rapporte rien que tu n'aies pas vu.
3. Passe la page au crible de cette grille, et note chaque défaut trouvé :
   - **Hiérarchie** : ce qui compte le plus se voit-il en premier ? Un titre qui ne dit pas ce qu'est la page ?
   - **Lisibilité** : texte trop petit, trop long, trop gris, mal contrasté, tronqué (« … »), coupé, passant mal à la
     ligne ; densité excessive ; alignements cassés ; espacements irréguliers.
   - **Répétition et doublons** : la même information à plusieurs endroits de la page, ou sur plusieurs pages ;
     deux boutons qui font la même chose ; une phrase d'aide qui répète le titre.
   - **Cohérence** : le libellé du menu, le surtitre et le titre disent-ils la même chose ? Le même concept porte-t-il
     le même nom partout ? Les mêmes composants (boutons, onglets, cartes, pastilles, accordéons) ont-ils le même
     dessin partout ? Accords (masculin employé pour une femme, etc.).
   - **Ergonomie** : nombre de clics pour la tâche principale, actions cachées ou loin de leur objet, boutons dont on
     ne devine pas l'effet, retour visible après une action (message, état), confirmations manquantes avant une action
     destructrice ou superflues, état vide expliqué, erreurs de saisie expliquées, cibles trop petites (moins de 40 px
     de haut au doigt), raccourcis.
   - **Adaptation** : ce qui déborde, se chevauche, se cache ou devient inutilisable à 1280×760 et à 390×800 ;
     défilement horizontal ; éléments fixes qui masquent du contenu (l'assistant Solvi en bas à droite, la barre du bas).
   - **Lisibilité des données** : tableaux et grilles lisibles ? unités, dates et heures cohérentes (« 8 h 30 » ou
     « 08:30 ») ? couleurs qui ont un sens expliqué ?
4. Mesure quand c'est utile (taille de police, contraste, hauteur des cibles) avec `getComputedStyle` /
   `getBoundingClientRect`.

## Ce que tu rends
`$S/audit/<ton-code>/rapport.md`, organisé PAGE PAR PAGE (une section par page ou par fenêtre, dans l'ordre du menu).
Dans chaque section : une ligne d'identité (comment on y arrive, pour quel profil), puis un tableau
`| # | Catégorie | Constat précis (où exactement, ce qu'on voit) | Taille d'écran | Gravité | Capture |`
Gravité : **Bloquant** (empêche d'utiliser la page), **Majeur** (gêne forte, induit en erreur), **Mineur**,
**Cosmétique**. Termine par une section « Transversal » (ce qui se répète sur plusieurs pages) et la liste de ce que
tu n'as pas pu voir. Réponse finale : un court résumé (nombre de points par gravité, les dix plus graves).
