import re, json, collections
S='/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/'
D=json.load(open(S+'rapport/items.json',encoding='utf-8'))
PAGES=[
 ('Avant d’entrer','connexion','Connexion et mot de passe oublié'),
 ('Avant d’entrer','creation','Créer sa pharmacie'),
 ('Avant d’entrer','decouvrir','Comment ça marche ? et visites guidées'),
 ('Avant d’entrer','bienvenue','Première connexion et visite de bienvenue'),
 ('Titulaire','t-cadre','Barre du haut, menu et cloche'),
 ('Titulaire','t-tableau','Tableau de bord'),
 ('Titulaire','t-monplanning','Mon planning (titulaire)'),
 ('Titulaire','t-equipe','Équipe'),
 ('Titulaire','t-reglages','Réglages'),
 ('Titulaire','t-regles','Règles'),
 ('Titulaire','t-construire','Construire : la semaine'),
 ('Titulaire','t-poste','Construire : la fenêtre d’un poste et les préférences'),
 ('Titulaire','t-propositions','Construire : propositions, contrôles et publication'),
 ('Titulaire','t-mois','Construire : le mois'),
 ('Titulaire','t-journee','La journée'),
 ('Titulaire','t-impression','Impression'),
 ('Titulaire','t-gardes','Gardes'),
 ('Titulaire','t-formation','Formation et inventaire'),
 ('Titulaire','t-resoudre','Résoudre'),
 ('Titulaire','t-signaler','Retard ou absence'),
 ('Titulaire','t-messages','Messages et rendez-vous'),
 ('Titulaire','t-heures','Heures'),
 ('Titulaire','t-equite','Équité'),
 ('Titulaire','t-stats','Statistiques'),
 ('Titulaire','t-journal','Journal et paie'),
 ('Titulaire','t-documents','Documents'),
 ('Titulaire','t-aide','Aide'),
 ('Titulaire','t-compte','Mon compte'),
 ('Titulaire','t-pharmacies','Plusieurs pharmacies'),
 ('Titulaire','t-secondaire','Titulaire secondaire et accords'),
 ('Équipe','e-cadre','Barre du haut, menu et cloche'),
 ('Équipe','e-accueil','Accueil'),
 ('Équipe','e-planning','Mon planning'),
 ('Équipe','e-planningequipe','Planning de l’équipe'),
 ('Équipe','e-demandes','Mes demandes : préférences, absences, horaires'),
 ('Équipe','e-remplacement','Me faire remplacer et aider un collègue'),
 ('Équipe','e-retard','Prévenir d’un retard'),
 ('Équipe','e-suivi','Mon suivi'),
 ('Équipe','e-gardes','Mes gardes'),
 ('Équipe','e-documents','Mes documents'),
 ('Équipe','e-messages','Messages'),
 ('Équipe','e-compte','Mon compte'),
 ('Équipe','e-droits','Droits et confidentialité'),
 ('Transversal','x-solvi','Solvi, l’assistant'),
 ('Transversal','x-telephone','Téléphone, tablette et petits écrans'),
 ('Transversal','x-composants','Fenêtres, messages et composants'),
 ('Transversal','x-vocabulaire','Vocabulaire, libellés et accords'),
 ('Transversal','x-moteur','Moteur de calcul et règles du travail'),
 ('Transversal','x-donnees','Données, sauvegarde, sécurité, performances'),
 ('Transversal','x-transversal','Navigation, confirmations et points communs à toutes les pages'),
]
# règles : (motif, page titulaire, page équipe) ; la première qui correspond gagne
R=[
 (r'rechargement|persistance au rechargement|bouton retour|précédent du navigateur|^navigation|actions? destructrices?|sans confirmation|débordements?|mise en page 1280|thème sombre|lecteur d.écran|boutons grisés','x-transversal','x-transversal'),
 (r'libellés|accords? grammaticaux|^textes$|formats? d.heure|vocabulaire|élision|à la 3e personne|masculin','x-vocabulaire','x-vocabulaire'),
 (r'fenêtre du poste','t-poste','t-poste'),
 (r'^journée|journée :|^la journée','t-journee','e-planning'),
 (r'^préférences|toucher le jour','t-mois','e-demandes'),
 (r'demande adressée|^aider|titulaire / équipe','t-resoudre','e-remplacement'),
 (r'boutons du métier|raccourci « demander','e-accueil','e-accueil'),
 (r'se déconnecter|deux « paramètres »','t-compte','e-compte'),
 (r'saisie des durées|saisie du retard','t-signaler','e-retard'),
 (r'réglage d.une absence|réaffecter','t-resoudre','t-resoudre'),
 (r'en-tête équipe|« pharmaciens »','t-equipe','t-equipe'),
 (r'recherche de l.aide|^aide|fiche d.aide','t-aide','t-aide'),
 (r'^imprimer|aperçu avant impression|impression du titulaire','t-impression','e-planning'),
 (r'poste type « repos »','t-poste','t-poste'),
 (r'assistant de création|création sur téléphone','creation','creation'),
 (r'solvi|bulle d.aide|bouton flottant|question à solvi','x-solvi','x-solvi'),
 (r'retard ou absence|prévenir d.un retard|^retard','t-signaler','e-retard'),
 (r'formation \(menu|inventaire \(menu','t-formation','t-formation'),
 (r'titulaire secondaire|accords? à donner|accord de caroline|donner son accord|ce qui change chez le titulaire secondaire|\bpierre\b.*accord','t-secondaire','t-secondaire'),
 (r'mot de passe oublié|page de connexion|connexion, appareil|mauvais mot de passe|déconnexion|effacer l.appareil|^connexion','connexion','connexion'),
 (r'créer ma pharmacie|assistant(, | de création| en trois)|pharmacie neuve|création, |à la création|valeurs de départ|clé de secours à la création|préparation automatique à la création','creation','creation'),
 (r'découvrir solvéa|comment ça marche|visites? guidée|visite en cours|tutoriel','decouvrir','decouvrir'),
 (r'visite de bienvenue|tour\.tsx|première connexion','bienvenue','bienvenue'),
 (r'plusieurs pharmacies|deuxième pharmacie|changer de pharmacie|sélecteur de pharmacie','t-pharmacies','t-pharmacies'),
 (r'repartir de zéro','t-reglages','t-reglages'),
 (r'droits|confidentialit|raisons? d.absence des autres','e-droits','e-droits'),
 (r'téléphone|tablette|390|barre d.onglets du bas|barre du bas','x-telephone','x-telephone'),
 (r'tableau de bord|bannière|tuile','t-tableau','e-accueil'),
 (r'\baccueil\b','e-accueil','e-accueil'),
 (r'cloche|barre du haut|menu latéral|barre latérale|cadre commun|menu du compte|« créer »|menu créer','t-cadre','e-cadre'),
 (r'retard ou absence|signaler|accident du travail','t-signaler','e-retard'),
 (r'prévenir d.un retard|avis de retard','t-signaler','e-retard'),
 (r'réglages|officine en chiffres|horaires d.ouverture|jours fériés|effectif attendu|dimensionnement|qui prépare|publication au mois|postes? types?|paramètres et coûts|coupure le midi|recopier un horaire|quota','t-reglages','t-reglages'),
 (r'règles?\b|seuil','t-regles','t-regles'),
 (r'(fiche|liste) (d.une personne|de l.équipe)|^équipe|ajouter une personne|besoin ou absence|retrait d.une personne|retirer une personne|compétences? réservée|marques|contrat|ancienneté|enregistrer un besoin','t-equipe','e-compte'),
 (r'mes préférences|préférences?\b.*(formes|jours|m.assister|date limite)|nouvelle demande|absence ou horaire|mes demandes|demande d.horaire|demander un congé|suivre sa demande|les trois cartes','t-resoudre','e-demandes'),
 (r'me faire remplacer|remplacement|aider un collègue|appel à l.équipe|se proposer|dire non','t-resoudre','e-remplacement'),
 (r'résoudre|décision|couvrir|absence à couvrir|refuser|accepter un congé|onglet gardes','t-resoudre','e-demandes'),
 (r'proposer un planning|propositions?|contrôles?|publi(er|cation)|à publier','t-propositions','e-planning'),
 (r'vue mois|\bmois\b|relancer|corriger automatiquement','t-mois','e-planning'),
 (r'voir la journée|la journée|fenêtre « voir la journée »','t-journee','e-planning'),
 (r'impression|imprimer|aperçu d.impression','t-impression','e-planning'),
 (r'nouveau poste|modifier le poste|fenêtre d.un poste|poste type « repos »|qui a demandé|tirage|tirer au sort|accorder|rendre le poste|pauses courtes','t-poste','t-poste'),
 (r'construire|grille|recopier|remettre à zéro|glisser|annuler / rétablir|semaine','t-construire','e-planning'),
 (r'gardes?\b|astreinte|import(er)? (de|le calendrier de)? ?garde','t-gardes','e-gardes'),
 (r'formation|inventaire','t-formation','t-formation'),
 (r'messages?|rendez-vous|conversation','t-messages','e-messages'),
 (r'heures|régularis|faire rattraper|solder|compteur','t-heures','e-suivi'),
 (r'équité','t-equite','t-equite'),
 (r'statistiques|points forts','t-stats','t-stats'),
 (r'journal|fiche navette|paie|export','t-journal','t-journal'),
 (r'documents?|fichier|justificatif','t-documents','e-documents'),
 (r'\baide\b|lexique|recherche','t-aide','t-aide'),
 (r'mon compte|mes paramètres|apparence|taille du texte|disposition','t-compte','e-compte'),
 (r'mon suivi','e-suivi','e-suivi'),
 (r'mon planning|planning de l.équipe','t-monplanning','e-planning'),
 (r'toast|fenêtres en général|cohérence des composants|composants','x-composants','x-composants'),
]
NOMS={p[1]:p for p in PAGES}
def equipe(i):
    if i['src']=='D-equipe': return True
    if i['src']=='UX-equipe-transversal' and i['h1'].startswith('Partie B'): return True
    return False
def page(i):
    c=i['cols']; src=i['src']
    h=(i['h2']+' '+i['h3']).lower()
    # sections propres aux revues d'interface : la section dit la page
    if src=='UX-equipe-transversal':
        if i['h1'].startswith('Partie A'):
            for k,p in [('a1.','connexion'),('a2.','creation'),('a3.','bienvenue'),('a4.','decouvrir'),('a5.','decouvrir'),('a6.','bienvenue')]:
                if i['h2'].lower().startswith(k): return p
        if i['h1'].startswith('Partie B'):
            for k,p in [('b0.','e-cadre'),('b1.','e-accueil'),('b2.','e-planning'),('b3','e-demandes'),('b4.','e-suivi'),('b5.','e-documents'),('b6.','e-planningequipe'),('b7.','e-messages'),('b8.','e-compte'),('b9.','e-retard'),('b10.','e-remplacement'),('b11.','e-gardes'),('b12.','e-accueil')]:
                if i['h2'].lower().startswith(k):
                    if k=='b3' and 'remplacer' in i['h3'].lower(): return 'e-remplacement'
                    return p
        if i['h1'].startswith('Partie C'):
            for k,p in [('c1.','x-solvi'),('c2.','decouvrir'),('c3.','x-composants'),('c4.','x-composants'),('c5.','x-composants'),('c6.','x-telephone')]:
                if i['h2'].lower().startswith(k): return p
    if src=='UX-titulaire':
        m=re.match(r'(\d+)([a-g]?)\.',i['h3'] or i['h2'])
        if m:
            n=int(m.group(1)); s=m.group(2)
            if n==6: return {'a':'t-construire','b':'t-poste','c':'t-propositions','d':'t-propositions','e':'t-mois','f':'t-journee','g':'t-impression'}.get(s,'t-construire')
            T={1:'t-tableau',2:'t-monplanning',3:'t-equipe',4:'t-reglages',5:'t-regles',7:'t-gardes',8:'t-resoudre',9:'t-messages',10:'t-heures',11:'t-equite',12:'t-stats',13:'t-journal',14:'t-documents',15:'t-aide',16:'t-cadre',17:'t-compte',18:'t-signaler',19:'t-formation',20:'t-formation',21:'t-secondaire'}
            if n in T: return T[n]
    if src=='E-moteur': return 'x-moteur'
    if src=='A-mise-en-place' and i['h3']:
        for k,p in [('1.2','t-reglages'),('1.3','t-equipe'),('1.4','t-regles'),('1.5','t-compte'),('1.6','t-pharmacies')]:
            if i['h3'].startswith(k): return p
    if src=='C-decider-suivre' and i['h3']:
        f=c.get('fonction','').lower()
        if i['h3'].startswith('1.8'): return 't-stats' if re.search('statist|etp|effectif|compétences|points forts|activité',f) else 't-equite'
        if i['h3'].startswith('1.11'): return 't-aide' if re.search(r'^aide|recherche|thème|lexique|tutoriel|fiche',f) else 'x-solvi'
        for k,p in [('1.1 ','t-resoudre'),('1.2 ','t-resoudre'),('1.3 ','t-resoudre'),('1.4 ','t-resoudre'),('1.5 ','t-signaler'),('1.6 ','t-messages'),('1.7 ','t-heures'),('1.9 ','t-journal'),('1.10 ','t-documents')]:
            if i['h3'].startswith(k): return p
        if i['h3'].startswith('1.12'): return 'x-transversal'
    if src=='UX-titulaire' and i['h2'].startswith('22.'): return 'x-transversal'
    if 'question' in c: return 'x-solvi'
    if 'action' in c and 'temps' in ' '.join(c): return 'x-donnees'
    if 'fenêtre' in c: return 'x-composants'
    if i.get('sous')=='Libellé': return 'x-vocabulaire'
    txt=(c.get('fonction','')+' '+(h if src!='UX-titulaire' else '')+' '+(c.get('constat précis','')[:160] if not c.get('fonction') else '')).lower()
    if src=='C-decider-suivre' and not c.get('fonction'): txt=(c.get('constat précis','')[:200]+' '+h).lower()
    for motif,pt,pe in R:
        if re.search(motif,txt): return pe if equipe(i) else pt
    return None
def norm_grav(g):
    g=(g or '').lower()
    for k,v in [('bloquant','Bloquant'),('majeur','Majeur'),('mineur','Mineur'),('cosm','Cosmétique')]:
        if k in g: return v
    return ''
def norm_res(r):
    r=(r or '').lower()
    if r.startswith('fonctionne'): return 'Fonctionne'
    if 'partiel' in r: return 'Partiel'
    if 'ne fonctionne pas' in r: return 'Ne fonctionne pas'
    if 'non testable' in r: return 'Non testable'
    if 'juste' in r or 'exact' in r or r.startswith('bon'): return 'Fonctionne'
    if 'faux' in r or 'fausse' in r or 'à côté' in r or 'erron' in r: return 'Ne fonctionne pas'
    return r[:30]
out=[]; sans=collections.Counter()
for n,i in enumerate(D['items']):
    c=i['cols']; p=page(i)
    if p is None: sans[(i['src'],i['ctx'][-60:])]+=1; p='x-transversal-autre'
    genre=('Interface' if (i['src'].startswith('UX') or re.search('ergonomie',i['ctx'].lower())) else 'Moteur' if i['src']=='E-moteur' else 'Fonctionnement')
    if i['forme']=='liste': genre=i['sous']
    if 'question' in c: genre='Solvi'
    res=norm_res(c.get('résultat') or c.get('verdict') or c.get('avis') or '')
    if genre in('Interface','Incohérence','Répétition','Libellé') and not c.get('résultat'): res='Constat'
    out.append({'id':n,'src':i['src'],'page':p,'genre':genre,'res':res,'grav':norm_grav(c.get('gravité','')),
      'titre':c.get('fonction') or c.get('catégorie') or c.get('question') or c.get('règle') or c.get('point') or c.get('action') or c.get('fenêtre') or '',
      'scenario':c.get('scénario joué',''),'detail':c.get('constat précis') or c.get("constat précis (où exactement, ce qu'on voit)") or c.get('réponse de solvi (extrait)') or c.get('ce que je connais du texte') or ' · '.join(v for k,v in c.items() if k not in('fonction','#')),
      'taille':c.get("taille d'écran",''),'preuve':c.get('preuve') or c.get('capture',''),'section':i['ctx']})
json.dump({'pages':PAGES,'items':out,'nontest':D['nontest']},open(S+'rapport/data.json','w',encoding='utf-8'),ensure_ascii=False)
cp=collections.Counter(o['page'] for o in out)
for g,k,t in PAGES: print(f"{cp.get(k,0):4} {g[:9]:9} {t}")
print(cp.get('x-transversal-autre',0),'sans page'); 
for k,v in sans.most_common(40): print('  ',v,k)
print(collections.Counter((o['genre'],o['res']) for o in out).most_common(20))
print(collections.Counter(o['grav'] for o in out))
