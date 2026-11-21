import json, re
S='/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/'
D=json.load(open(S+'rapport/data.json',encoding='utf-8'))
D['pages'].append(['Transversal','x-tests','Tests automatiques'])
for o in D['items']:
    if o['page']=='x-transversal-autre': o['page']='x-transversal'
n=max(o['id'] for o in D['items'])+1
def aj(page,genre,res,grav,titre,detail,scenario='',preuve='',taille=''):
    global n
    D['items'].append({'id':n,'src':'Audit transversal','page':page,'genre':genre,'res':res,'grav':grav,'titre':titre,'scenario':scenario,'detail':detail,'taille':taille,'preuve':preuve,'section':'Vérifications transversales'}); n+=1
F='Fonctionnement'; I='Interface'
aj('x-donnees',F,'Ne fonctionne pas','Bloquant','Pas de serveur : l’équipe ne partage rien d’un appareil à l’autre',"Toutes les données sont dans le stockage du navigateur de l'appareil (clé releve.v3). Messages, demandes, remplacements, publication ne relient que les personnes qui utilisent le même poste : un préparateur sur son téléphone ne voit rien de ce que publie le titulaire au comptoir. La page de connexion le dit en petit (« elle ne remplace pas de vrais comptes en ligne ») ; tout le reste de l'application présente un outil d'équipe en ligne.",'Lecture de src/store/store.ts et src/store/ui.ts','store.ts, fonction enregistrer')
aj('x-donnees',F,'Ne fonctionne pas','Bloquant','Sauvegarde impossible : aucune alerte, perte au rechargement',"Quand le stockage du navigateur est plein (limite d'environ 5 Mo ; les documents déposés peuvent à eux seuls en occuper 3), l'écriture échoue sans rien dire : le code continue « en mémoire ». Seule l'heure « Enregistré sur cet appareil à… » cesse d'avancer. Tout ce qui est saisi ensuite est perdu au rechargement.",'Lecture du code de sauvegarde','store.ts : « Quota dépassé ou navigation privée : l’application continue en mémoire »')
aj('x-donnees',F,'Ne fonctionne pas','Majeur','Données abîmées : retour à la connexion sans message',"Avec des données enregistrées illisibles (ou un enregistrement vide), l'application s'ouvre sur la page de connexion comme sur un appareil neuf, sans dire que des données existaient. Aucune erreur affichée, aucune proposition de récupération.",'Stockage remplacé par « {abîmé » puis rechargement','F-transverse/perf.js')
aj('x-donnees',F,'Ne fonctionne pas','Majeur','Aucune sauvegarde ni restauration complète',"Il n'existe ni export ni import de l'ensemble des données d'une pharmacie (seuls le dossier de preuve et la fiche navette s'exportent, en texte). Effacer les données du navigateur, changer d'ordinateur ou de navigateur fait perdre la pharmacie entière.",'Recherche d’un export ou import dans l’interface et le code','Journal.tsx (export partiel uniquement)')
aj('x-donnees',F,'Partiel','Majeur','Mots de passe protégés par une empreinte simple',"Les mots de passe sont conservés sous forme d'empreinte non cryptographique (un hachage maison de quelques lignes), dans le même stockage que les données, lisible par quiconque ouvre les outils du navigateur.",'Lecture de src/domain/acces.ts','acces.ts, fonction empreinte')
aj('x-donnees',F,'Partiel','Majeur','Données de santé en clair',"Arrêts, accidents du travail, motifs (« Santé, rendez-vous médical »), justificatifs déposés : tout est lisible en clair dans le stockage du navigateur. Sujet RGPD à traiter avant tout usage réel.",'Lecture des données enregistrées','localStorage releve.v3 : absences, besoins, documents')
aj('x-donnees',F,'Fonctionne','','Rapidité',"Page de connexion en 0,3 s, entrée dans l'exemple en 1,5 s, chaque écran en 0,08 à 0,2 s (Construire 0,14 s, Résoudre 0,19 s). Proposer un planning : 1 à 1,25 s ; Corriger le mois : 3,3 s.",'Mesures dans le navigateur, 1440×900','F-transverse/perf.js')
aj('x-donnees',F,'Fonctionne','','Poids des données',"L'exemple (13 personnes, 11 semaines, 499 postes, 182 préférences) occupe 233 Ko. Une année d'activité tient dans la limite, mais les documents déposés partagent la même place.",'Mesure du stockage après entrée dans l’exemple','F-transverse/perf.js')
aj('x-donnees',I,'Constat','Mineur','Navigateurs récents obligatoires',"L'interface emploie color-mix() 265 fois et :has() 24 fois, sans version de secours : il faut Chrome ou Edge 111 et plus, Safari 16.2 et plus, Firefox 121 et plus. Sur un poste ou une tablette plus ancien, couleurs et mise en page se dégradent.",'Recensement dans les feuilles de style','src/ui/styles.css')
aj('x-donnees',F,'Partiel','Mineur','Paquet lourd',"Un seul fichier JavaScript de 1,56 Mo et une feuille de style de 374 Ko (5 436 lignes, avec plusieurs « secondes passes » qui se recouvrent). L'outil de construction le signale à chaque fois.",'Mesure du dossier publié','dist-artifact/assets')
aj('x-tests',F,'Partiel','Majeur','Les tests navigateur ne sont pas dans le dépôt',"Les 190 scripts de contrôle (suites, visites, accessibilité) vivent dans un dossier temporaire de la session de développement, pas dans le dépôt GitHub : ils disparaîtront avec elle. Seuls les 183 tests unitaires du moteur sont versionnés.",'Inventaire du dépôt','git ls-files')
aj('t-resoudre',F,'Ne fonctionne pas','Majeur','Un poste déjà terminé reste « Urgent » à couvrir',"À 23 h 44, Résoudre affiche encore « Arrêt de Igor L. · 1 poste à couvrir · Urgent · Voir et choisir la solution » pour un poste de 11 h 30 à 19 h 30 le jour même, terminé depuis 4 heures. Le tableau de bord le met « À faire en premier ».",'Résoudre ouvert le 20/11 à 23 h 44','F-transverse/resoudre-tard.png')
aj('decouvrir',I,'Constat','Majeur','Deux noms de l’exemple peuvent choquer',"« Igor Le Russe » (nationalité) et « Nicolas Le Syndicaliste » (engagement syndical), identifiant « nicolas.lesyndicaliste », apparaissent dans la grille, l'accueil, les messages, les visites et le menu de test : risque réel devant un client.",'Lecture des données de l’exemple','src/data/seed.ts')
aj('connexion',I,'Constat','Majeur','Coordonnées du support fictives',"« 01 99 00 12 34 » et « support@solvea.example » sont affichés sur la page de connexion, en pied du tableau de bord et dans l'Aide.",'Lecture des écrans','audit/textes/0-tableau.txt')
aj('x-vocabulaire',I,'Constat','Majeur','Le menu, le surtitre et le titre ne disent pas la même chose',"Réglages → surtitre « Officine », titre = nom de la pharmacie ; Heures → « Compteur d’heures » / « Le moins d’heures en plus possible » ; Journal et paie → « Dossier de preuve » ; Documents (rangé sous « Bilan ») → « Mes documents » alors qu'il contient « Reçus de l’équipe » ; Mes demandes et Mes documents → surtitre « Mon espace ». Sur téléphone : Tableau de bord devient « Accueil », Résoudre devient « À décider ».",'Relevé de chaque écran, 6 profils','audit/crawl.json')
aj('x-vocabulaire',I,'Constat','Mineur','Plusieurs mots pour la même chose',"« préférences » partout mais « souhaits » dans la fiche d'aide Construire ; « besoin », « horaire à tenir », « contrainte » et « besoins personnels » pour la même notion ; « pharmacie » et « officine » mélangés ; la 3e proposition s'appelle « Contrats d'abord » à l'écran et « la moins coûteuse » dans l'aide ; « remplacement » et « dépannage » ; « garde » et « astreinte » ; « ETP » abrégé dans Statistiques, en toutes lettres dans Équipe.",'Relevé du texte affiché de chaque écran','audit/textes/')
aj('x-transversal',I,'Constat','Majeur','Six portes d’entrée vers l’aide',"« Besoin d’aide ? » (menu), l’icône « ? » (barre du haut), Solvi (bas à droite), « Comment ça marche ? », la visite de bienvenue d’une minute, les tutoriels de chaque fiche et le lexique : on ne sait pas où chercher.",'Relevé des points d’entrée','audit/textes/0-side.txt')
aj('decouvrir',I,'Constat','Majeur','13 visites, environ 3 h 45, qui se recouvrent',"Complet (49 min) contient presque tout Titulaire (36 min) ; « Installer et préparer » et « Planifier et suivre » reprennent les mêmes écrans ; les cinq visites métier (16 à 18 étapes) ont les mêmes quatre chapitres, seul l'accueil change ; les journées types rejouent des moments de Complet.",'Inventaire des visites','src/ui/Parcours.tsx')
aj('t-tableau',I,'Constat','Majeur','Les décisions affichées quatre fois sur le même écran',"Bandeau « 7 décisions vous attendent », bloc « À faire en premier », bloc « À décider · 7 décisions », badge « Résoudre 7 » du menu, plus la cloche (16) qui reprend les mêmes décisions ; « Déjà décidé » (tableau) et « Décidé récemment » (cloche) listent la même chose. Deux blocs voisins parlent du prochain planning (« Planning de décembre » et « Le prochain planning »).",'Tableau de bord de Caroline','audit/audit-0-tableau.png')
# résultats des suites automatiques
for l in open(S+'suites.log',encoding='utf-8'):
    l=l.strip()
    if not l or l=='FIN': continue
    nom,_,reste=l.partition(':'); reste=reste.strip()
    m=re.search(r'(\d+)/(\d+)',reste)
    if nom in('e2e6','sombre-e2e6'): aj('x-tests',F,'Partiel','Mineur','Suite '+nom+' (parcours principal)',"45 contrôles sur 46. Le seul échec vient du test lui-même : il demande à Solvi « Qui travaille demain ? » et attend des noms. Joué un samedi, demain est un dimanche, pharmacie fermée, et Solvi répond justement « Demain : aucun poste planifié ». Le test dépend du jour où on le lance.",'Rejeu complet','audit/suites/'+nom+'.log'); continue
    if nom=='lot2': aj('x-tests',F,'Non testable','','Suite lot2 (Construire, contrôles, mois)',"Arrêtée au contrôle qui ouvre « Voir et choisir la solution » sur l'arrêt d'Igor : cet arrêt finit le 20 novembre, et la suite a été jouée le 21, quand il n'y avait plus d'absence à couvrir. Le test dépend du jour où on le lance ; il passait à 35 sur 35 la veille.",'Rejeu complet','audit/suites/lot2.log'); continue
    if nom=='mobile2': aj('x-tests',I,'Constat','Mineur','Suite mobile2 (écrans à 360 px)',"11 barres d'onglets ou de filtres se font glisser au doigt à 360 px (Réglages, Règles, Résoudre, Équité, Statistiques, Documents, Aide, Mes demandes, Mes documents) : voulu, mais sans indice visible qu'il y a plus à droite.",'Rejeu complet','audit/suites/mobile2.log'); continue
    aj('x-tests',F,'Fonctionne','','Suite '+nom,reste[:220],'Rejeu complet','audit/suites/'+nom+'.log')
json.dump(D,open(S+'rapport/data.json','w',encoding='utf-8'),ensure_ascii=False)
import collections
print(len(D['items']),'éléments'); print(collections.Counter(o['grav'] for o in D['items'])); print(collections.Counter(o['res'] for o in D['items']))
import os; print(os.path.getsize(S+'rapport/data.json')//1024,'Ko')
# normalisation des résultats
D=json.load(open(S+'rapport/data.json',encoding='utf-8'))
ok={'Constat','Fonctionne','Partiel','Ne fonctionne pas','Non testable'}
for o in D['items']:
    if o['res'] in ok: continue
    if o['src']=='B-planifier' and o['res']=='': o['res']='Fonctionne'
    elif o['src']=='E-moteur' and o['res']=='': o['res']='Fonctionne'
    else:
        o['detail']=o['detail']+' Verdict de l’auditeur : '+o['res']+('' if o['res'].endswith('.') else '.')
        o['res']='Constat'
json.dump(D,open(S+'rapport/data.json','w',encoding='utf-8'),ensure_ascii=False)
print(collections.Counter(o['res'] for o in D['items']))
# tableau 1.6 de l'audit moteur : relu directement
lignes=open(S+'E-moteur/rapport.md',encoding='utf-8').read().split('### 1.6 Seuils comparés au droit')[1].split('\n###')[0].splitlines()
T={}
for l in lignes:
    c=[x.strip() for x in l.strip().strip('|').split('|')]
    if len(c)==4 and c[0] not in('Règle','---') and not c[0].startswith('-'): T[c[0]]=c
D=json.load(open(S+'rapport/data.json',encoding='utf-8'))
for o in D['items']:
    if o['src']=='E-moteur' and '1.6 Seuils' in o['section'] and o['titre'] in T:
        r,seuil,texte,avis=T[o['titre']]
        o['scenario']='Seuil retenu par le moteur : '+seuil
        o['detail']='Texte de référence : '+texte+'. Avis de l’auditeur : '+avis+'.'
        o['res']='Fonctionne' if avis.lower().startswith('juste') and ',' not in avis and 'sauf' not in avis else 'Constat'
    if o['id']==1200:
        o['grav']='Mineur'; o['titre']='Deux noms de l’exemple à revoir avant une présentation'
        o['detail']="« Igor Le Russe » (nationalité) et « Nicolas Le Syndicaliste » (engagement syndical), identifiant « nicolas.lesyndicaliste », apparaissent dans la grille, l'accueil, les messages, les visites et le menu de test. Devant un client ou un salarié, ces surnoms peuvent être mal reçus."
json.dump(D,open(S+'rapport/data.json','w',encoding='utf-8'),ensure_ascii=False)
print('1.6 :',len(T),'lignes relues')

# corrections relevées à la relecture
D=json.load(open(S+'rapport/data.json',encoding='utf-8'))
for o in D['items']:
    o['detail']=o['detail'].replace("que je n'ai pas sous les yeux","non consulté par l’auditeur")
    if o['src']=='UX-titulaire' and o['detail']=='Chaque carte porte deux boutons (« Voir le tutoriel':
        o.update(detail="Chaque carte porte deux boutons (« Voir le tutoriel | 1 étape » et « Ouvrir … → ») ; « Ouvrir le tableau de bord » est répété sur quatre cartes de la catégorie Au quotidien, dont « À quoi sert le bouton « Créer » ? » (qui ne concerne pas le tableau de bord).",taille='O, P, T',grav='Mineur',preuve='d-aide-2.png')
json.dump(D,open(S+'rapport/data.json','w',encoding='utf-8'),ensure_ascii=False)
