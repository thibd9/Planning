const { ouvrir } = require('../lib.js');
(async () => {
  for (const [w, h, t] of [[1440, 900, "b"], [1280, 760, "p"], [390, 800, "t"]].filter((x) => !process.env.T || process.env.T.includes(x[2]))) {
    const o = await ouvrir({ vierge: true, w, h }); const p = o.p;
    await p.getByRole('button', { name: /Créer ma pharmacie/ }).click(); await p.waitForTimeout(600);
    const sc = await p.evaluate(() => { const c = [...document.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }).map((e) => e.className + ' ' + e.scrollHeight + '/' + e.clientHeight); return [c, document.documentElement.scrollHeight]; });
    console.log(t, 'scrollers', JSON.stringify(sc));
    const sel = (await p.evaluate(() => { const f = document.querySelector('.accueil-form'); return f && f.scrollHeight > f.clientHeight + 5; })) ? '.accueil-form' : 'html';
    const def = async (nom) => { if (sel === 'html') { await o.shot(nom + '-full', { fullPage: true }); } else { console.log(nom, await o.defiler(nom, 8, sel)); } };
    await o.shot(`a2-e1-${t}`); await def(`a2-e1-${t}`);
    if (t === 'b') { console.log(JSON.stringify(await o.mesurer('.accueil'))); await p.evaluate(() => document.querySelector('button[type=submit]').click()); await p.waitForTimeout(400); await o.shot('a2-e1-b-erreur'); }
    await p.fill('#officine-nom', 'Pharmacie des Tilleuls'); await p.evaluate(() => document.querySelector('button[type=submit]').click()); await p.waitForTimeout(600);
    await o.shot(`a2-e2-${t}`); await def(`a2-e2-${t}`);
    if (t === 'b') { console.log(JSON.stringify(await o.mesurer('.accueil'))); await p.evaluate(() => document.querySelector('button[type=submit]').click()); await p.waitForTimeout(400); await o.shot('a2-e2-b-erreur'); await def('a2-e2-b-erreur'); }
    await p.fill('#tit-prenom', 'Claire'); await p.fill('#tit-nom', 'Martin'); await p.fill('#tit-identifiant', 'claire'); await p.fill('#tit-mdp', 'secret1');
    const pre = await p.$$('input[id^="prep-"][id$="-prenom"]'); const nomi = await p.$$('input[id^="prep-"][id$="-nom"]');
    await pre[0].fill('Paul'); await nomi[0].fill('Durand');
    const ad = await p.$$('input[id^="adj-"][id$="-prenom"]'); const adn = await p.$$('input[id^="adj-"][id$="-nom"]'); await ad[0].fill('Anne'); await adn[0].fill('Roux');
    await p.evaluate(() => document.querySelector('button[type=submit]').click()); await p.waitForTimeout(600);
    await o.shot(`a2-e3-${t}`); await def(`a2-e3-${t}`);
    await p.evaluate(() => document.querySelector('button[type=submit]').click()); await p.waitForTimeout(1200);
    await o.shot(`a2-cree-${t}`);
    for (let i = 0; i < 8; i++) {
      const etat = await p.evaluate(() => { const d = document.querySelector('[role=dialog], .tour, .tour-card, .tutoriel'); return d ? (d.className + ' | ' + d.innerText.slice(0, 300)) : null; });
      console.log(t, 'tour', i, etat);
      if (!etat) break;
      await o.shot(`a2-tour-${t}-${i}`);
      const suiv = p.getByRole('button', { name: /Suivant|Continuer|Commencer|Terminer|C’est parti|Compris/ }).first();
      if (await suiv.count()) { await suiv.click(); await p.waitForTimeout(700); } else break;
    }
    await o.shot(`a2-apres-tour-${t}`);
    console.log(t, 'errs', o.errs);
    await o.b.close();
  }
})();
