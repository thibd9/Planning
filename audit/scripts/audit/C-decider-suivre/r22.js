// Aide : recherche (avec fautes), thèmes, lexique.
const { ouvrir } = require('./lib');
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await o.nav('aide'); await p.waitForTimeout(500);
  console.log('THEMES', await p.evaluate(() => [...document.querySelectorAll('[data-onglets] [role=tab], .ong-onglet')].map((b) => b.innerText.replace(/\n/g, ' ')).join(' / ')));
  console.log('NB FICHES', await p.locator('.ad-fiche').count(), '| avec tutoriel', await p.locator('.ad-fiche button', { hasText: 'Voir le tutoriel' }).count());
  const sans = await p.evaluate(() => [...document.querySelectorAll('.ad-fiche')].filter((f) => ![...f.querySelectorAll('button')].some((b) => /tutoriel/.test(b.innerText))).map((f) => f.getAttribute('data-fiche')));
  console.log('fiches sans tutoriel', JSON.stringify(sans));
  const dbl = await p.evaluate(() => { const c = {}; document.querySelectorAll('.ad-fiche').forEach((f) => { const k = f.getAttribute('data-fiche'); c[k] = (c[k] || 0) + 1; }); return Object.entries(c).filter(([, n]) => n > 1); });
  console.log('fiches en double', JSON.stringify(dbl));
  await o.shot('r22-aide', { fullPage: false });
  const reqs = ['publier', 'conge', 'remplacemnt', 'heures sup', 'acident du travail', 'garde de nuit', 'imprimer le planing', 'mot de passe', 'equite', 'fiche navette', 'absense maladie', 'retard', 'comment valider un congé', 'rendez vous', 'exporter'];
  for (const q of reqs) {
    await p.fill('#aide-recherche', q); await p.waitForTimeout(250);
    const n = await p.locator('.ad-fiche').count();
    const titres = await p.locator('.ad-fiche h3').allInnerTexts();
    const lex = await p.evaluate(() => document.querySelector('.jr-filtre:nth-child(2) .rg-nb')?.innerText);
    console.log(`RECHERCHE « ${q} » : ${n} fiche(s), lexique ${lex} | ${titres.slice(0, 4).join(' ; ')}${n === 0 ? ' | VIDE : ' + (await p.locator('#ad-vide, #lex-vide').innerText().catch(() => '')).replace(/\n/g, ' ').slice(0, 120) : ''}`);
  }
  await p.fill('#aide-recherche', 'remplacemnt'); await p.waitForTimeout(250); await o.shot('r22-recherche-faute');
  await p.fill('#aide-recherche', ''); await p.waitForTimeout(200);
  await p.locator('.jr-filtre', { hasText: 'Lexique' }).click(); await p.waitForTimeout(300);
  console.log('LEXIQUE', await p.locator('.lex-terme').count(), 'termes :', (await p.locator('.lex-terme dt').allInnerTexts()).join(', '));
  await o.shot('r22-lexique');
  for (const q of ['ETP', 'astreinte', 'navette', 'equite', 'tour de role']) { await p.fill('#aide-recherche', q); await p.waitForTimeout(200); console.log(`  lexique « ${q} »`, await p.locator('.lex-terme').count(), '|', (await p.locator('.lex-terme dt').allInnerTexts()).join(', ')); }
  // Un bouton de fiche mène-t-il au bon écran ?
  await p.fill('#aide-recherche', ''); await p.locator('.jr-filtre', { hasText: 'Comment faire' }).click(); await p.waitForTimeout(200);
  for (const id of ['heures', 'equite', 'paie', 'documents', 'decisions', 'accord']) {
    await o.nav('aide'); await p.waitForTimeout(300);
    const f = p.locator(`[data-fiche="${id}"]`).first();
    if (!(await f.count())) { console.log('fiche absente', id); continue; }
    const b = f.locator('button').last(); const lib = await b.innerText();
    await b.click(); await p.waitForTimeout(500);
    console.log(`BOUTON fiche ${id} « ${lib.trim()} » -> ${await p.evaluate(() => document.querySelector('h1')?.innerText.replace(/\n/g, ' '))} | onglet Résoudre: ${await p.evaluate(() => document.querySelector('.ong-onglet.on')?.innerText.replace(/\n/g, ' ') ?? '-')}`);
  }
  console.log('ERR', o.errs); await o.b.close();
})();
