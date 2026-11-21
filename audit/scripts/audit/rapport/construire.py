import re, json, collections
S='/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/'
SRC=['A-mise-en-place','B-planifier','C-decider-suivre','D-equipe','E-moteur','UX-titulaire','UX-equipe-transversal']
AUDITEUR={'A-mise-en-place':'Audit mise en place','B-planifier':'Audit construire et publier','C-decider-suivre':'Audit décider et suivre','D-equipe':'Audit espace de l’équipe','E-moteur':'Audit du moteur','UX-titulaire':'Revue interface titulaire','UX-equipe-transversal':'Revue interface équipe et transversal'}
def cel(l):
    l=l.strip(); l=l[1:] if l.startswith('|') else l; l=l[:-1] if l.endswith('|') else l
    return [c.strip().replace('\\|','|') for c in re.split(r'(?<!\\)\|',l)]
items=[]; nontest=[]
for src in SRC:
    txt=open(S+src+'/rapport.md',encoding='utf-8').read().split('\n')
    t={1:'',2:'',3:'',4:''}; ent=None
    for l in txt:
        m=re.match(r'^(#{1,4}) (.*)',l)
        if m:
            n=len(m.group(1)); t[n]=m.group(2).strip()
            for k in range(n+1,5): t[k]=''
            ent=None; continue
        ctx=' / '.join(x for x in (t[1],t[2],t[3]) if x)
        low=(t[2]+' '+t[3]).lower()
        if l.strip().startswith('|'):
            c=cel(l)
            if all(re.fullmatch(r':?-{2,}:?',x or '---') for x in c): continue
            if ent is None: ent=[x.lower() for x in c]; continue
            c=(c+['']*len(ent))[:len(ent)]; d=dict(zip(ent,c))
            items.append({'src':src,'ctx':ctx,'h1':t[1],'h2':t[2],'h3':t[3],'cols':d,'forme':'table'})
            continue
        ent=None if not l.strip() else ent
        b=re.match(r'^\s*(?:- |\d+\. )(.*)',l)
        if b and l.strip():
            if re.search(r"pas (pu|été) (test|voir|vérif)|n'a pas pu|non test",low):
                nontest.append({'src':src,'texte':b.group(1).strip()})
            elif re.search(r'incoh|répétit|libellés de rôle|doublon',low):
                items.append({'src':src,'ctx':ctx,'h1':t[1],'h2':t[2],'h3':t[3],'cols':{'constat précis':b.group(1).strip()},'forme':'liste','sous':('Répétition' if 'répét' in t[3].lower() else 'Libellé' if 'libellés' in low else 'Incohérence')})
json.dump({'items':items,'nontest':nontest},open(S+'rapport/items.json','w',encoding='utf-8'),ensure_ascii=False)
print(len(items),'éléments ;',len(nontest),'non testés')
print(collections.Counter((i['src'],i['forme']) for i in items))
