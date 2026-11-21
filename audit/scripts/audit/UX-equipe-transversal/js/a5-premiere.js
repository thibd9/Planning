// Première connexion réelle d'un membre de l'équipe : (1) dans une pharmacie toute neuve (aucun planning), (2) Nicolas dans l'exemple.
const { ouvrir } = require('../lib.js');
const clic = (p, re) => p.evaluate((s) => { const r = new RegExp(s); const b = [...document.querySelectorAll('button, a')].find((e) => r.test(e.textContent) && e.getBoundingClientRect().width > 0); if (!b) return false; b.click(); return true; }, re.source);
const deconnecter = async (o) => { const p = o.p; await p.evaluate(() => document.querySelector('.compte-btn').click()); await p.waitForTimeout(300); await clic(p, /Se déconnecter/); await p.waitForTimeout(600); if (await clic(p, /Me déconnecter quand même/)) await p.waitForTimeout(600); };
const connecter = async (o, id, mdp) => { const p = o.p; await p.fill('#cx-identifiant', id); await p.fill('#cx-mdp', mdp); await p.evaluate(() => document.querySelector('button[type=submit]').click()); await p.waitForTimeout(1200); };
(async () => {
  const w = +(process.env.W || 1440), h = +(process.env.H || 900), t = process.env.TT || 'b';
  // 1. pharmacie neuve
  {
    const o = await ouvrir({ vierge: true, w, h }); const p = o.p;
    await p.getByRole('button', { name: /Créer ma pharmacie/ }).click(); await p.waitForTimeout(500);
    await p.fill('#officine-nom', 'Pharmacie des Tilleuls'); await p.evaluate(() => document.querySelector('button[type=submit]').click()); await p.waitForTimeout(500);
    await p.fill('#tit-prenom', 'Claire'); await p.fill('#tit-nom', 'Martin'); await p.fill('#tit-identifiant', 'claire'); await p.fill('#tit-mdp', 'secret1');
    const pre = await p.$$('input[id^="prep-"][id$="-prenom"]'); const nomi = await p.$$('input[id^="prep-"][id$="-nom"]'); await pre[0].fill('Paul'); await nomi[0].fill('Durand');
    await p.evaluate(() => document.querySelector('button[type=submit]').click()); await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelector('button[type=submit]').click()); await p.waitForTimeout(1200);
    await clic(p, /^Passer$/); await p.waitForTimeout(400);
    const d = await o.data(); const paul = d.personnes.find((x) => x.prenom === 'Paul');
    console.log('Paul', paul.identifiant, paul.provisoire);
    await deconnecter(o); await o.shot(`a5-neuve-${t}-deconnecte`);
    await connecter(o, paul.identifiant, paul.provisoire);
    await o.shot(`a5-neuve-${t}-arrivee`);
    console.log('neuve vue', await p.evaluate(() => [document.querySelector('.page-head h1, h1')?.innerText, !!document.querySelector('.tour-card'), !!document.querySelector('.parcours-test')]));
    for (const v of ['espace', 'moi', 'demandes', 'suivi', 'documents', 'planning', 'messages']) { if (await o.nav(v)) { await o.shot(`a5-neuve-${t}-${v}`); if (t === 'b') await o.defiler(`a5-neuve-${t}-${v}-def`, 4); } }
    await p.evaluate(() => document.querySelector('.compte-btn').click()); await p.waitForTimeout(300); await clic(p, /^\s*Mon compte/); await p.waitForTimeout(600); await o.shot(`a5-neuve-${t}-compte`);
    console.log('errs', o.errs); await o.b.close();
  }
  // 2. Nicolas dans la pharmacie d'exemple : vraie connexion par le formulaire
  {
    const o = await ouvrir({ role: 3, w, h }); const p = o.p;
    const d = await o.data(); const n = d.personnes.find((x) => x.prenom === 'Nicolas');
    console.log('Nicolas', n.identifiant, n.provisoire, !!n.code);
    await deconnecter(o); await o.shot(`a5-exemple-${t}-deconnecte`);
    if (n.provisoire) { await connecter(o, n.identifiant, n.provisoire); await o.shot(`a5-exemple-${t}-arrivee`); console.log('exemple vue', await p.evaluate(() => [document.querySelector('h1')?.innerText, !!document.querySelector('.tour-card')])); }
    console.log('errs', o.errs); await o.b.close();
  }
})();
