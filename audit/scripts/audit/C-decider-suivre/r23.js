// « Voir le tutoriel » : la visite démarre-t-elle à la bonne étape ?
const { ouvrir } = require('./lib');
const lire = (p) => p.evaluate(() => ({ titre: document.querySelector('.pt-titre h2')?.innerText, chap: document.querySelector('.pt-chapitre')?.innerText?.replace(/\n/g, ' '), acte: document.querySelector('.pt-acte')?.innerText?.replace(/\n+/g, ' | ').slice(0, 200), texte: document.querySelector('.pt-corps p.small')?.innerText?.slice(0, 160), h1: document.querySelector('h1')?.innerText?.replace(/\n/g, ' ') }));
(async () => {
  const ids = (process.env.IDS || 'publier,absence,demande-remplacement,demandes-equipe,accord,heures,equite,paie,documents,message,rendez-vous,signaler,accident,dernier-recours,historique,points-forts').split(',');
  const o = await ouvrir({ role: 0 }); const { p } = o;
  // Une modification de l'exemple avant le premier tutoriel : survit-elle ?
  await o.nav('messages'); await p.fill('#msg-texte', 'Message avant tutoriel'); await p.locator('form button[type=submit]').click(); await p.waitForTimeout(300);
  let premier = true;
  for (const id of ids) {
    await o.nav('aide'); await p.waitForTimeout(300);
    const f = p.locator(`[data-fiche="${id}"]`).first();
    if (!(await f.count())) { console.log(id, 'FICHE ABSENTE'); continue; }
    const q = await f.locator('h3').innerText();
    await f.locator('button', { hasText: 'Voir le tutoriel' }).click(); await p.waitForTimeout(1800);
    let l = await lire(p);
    if (l.acte && !l.titre) { await p.locator('[data-acte="go"]').click().catch(() => {}); await p.waitForTimeout(1500); const l2 = await lire(p); l = { ...l2, acte: l.acte }; }
    console.log(`TUTO ${id} « ${q} » -> étape « ${l.titre} » [${l.chap ?? ''}] écran « ${l.h1} » | ${l.texte ?? ''}${l.acte ? ' | ACTE ' + l.acte : ''}`);
    if (premier) { await o.shot('r23-tuto-' + id); premier = false; }
    if (id === 'accord') await o.shot('r23-tuto-accord');
    // quitter
    const q1 = p.getByRole('button', { name: /Quitter le parcours guidé|Quitter la visite/ }).first();
    if (await q1.count()) await q1.click(); else await p.keyboard.press('Escape');
    await p.waitForTimeout(800);
  }
  const d = await o.data(); console.log('Message avant tutoriel conservé ?', d.messages.some((m) => m.texte === 'Message avant tutoriel'), '| session', await p.evaluate(() => document.querySelector('.topbar, header')?.innerText.replace(/\n/g, ' ').slice(0, 60)));
  console.log('ERR', o.errs.slice(0, 5)); await o.b.close();
})();
