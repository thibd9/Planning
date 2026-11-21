import re, json, sys, collections
S='/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/'
SOURCES={'A-mise-en-place':'Fonctionnement','B-planifier':'Fonctionnement','C-decider-suivre':'Fonctionnement','D-equipe':'Fonctionnement','E-moteur':'Moteur','UX-equipe-transversal':'Interface','UX-titulaire':'Interface'}
def cellules(l):
    l=l.strip()
    if l.startswith('|'): l=l[1:]
    if l.endswith('|'): l=l[:-1]
    # découpe sur | non échappé
    return [c.strip().replace('\\|','|') for c in re.split(r'(?<!\\)\|',l)]
lignes=[]
for src,genre in SOURCES.items():
    try: txt=open(S+src+'/rapport.md',encoding='utf-8').read().split('\n')
    except FileNotFoundError: continue
    titres={1:'',2:'',3:'',4:''}; entete=None
    for l in txt:
        m=re.match(r'^(#{1,4}) (.*)',l)
        if m:
            n=len(m.group(1)); titres[n]=m.group(2).strip()
            for k in range(n+1,5): titres[k]=''
            entete=None; continue
        if not l.strip().startswith('|'): entete=None if not l.strip() else entete; continue
        c=cellules(l)
        if all(re.fullmatch(r':?-{2,}:?',x or '---') for x in c): continue
        if entete is None: entete=[x.lower() for x in c]; continue
        if len(c)!=len(entete): c=(c+['']*len(entete))[:len(entete)]
        d=dict(zip(entete,c))
        lignes.append({'source':src,'genre':genre,'h2':titres[2],'h3':titres[3],'h4':titres[4],**d})
json.dump(lignes,open(S+'rapport/brut.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
cpt=collections.Counter((r['source'],tuple(k for k in r if k not in('source','genre','h2','h3','h4'))) for r in lignes)
for k,v in cpt.items(): print(v,k)
print(len(lignes),'lignes')
