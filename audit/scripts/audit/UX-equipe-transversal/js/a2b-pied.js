// Le bouton « Continuer » de la barre collante de l'assistant de création : est-il cliquable à 1280×760 ?
const { ouvrir } = require('../lib.js');
(async () => {
  for (const [w, h] of [[1280, 760], [1440, 900], [390, 800]]) {
    const o = await ouvrir({ vierge: true, w, h }); const p = o.p;
    await p.getByRole('button', { name: /Créer ma pharmacie/ }).click(); await p.waitForTimeout(600);
    const sonde = () => p.evaluate(() => { const b = document.querySelector('button[type=submit]'); const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const e = document.elementFromPoint(x, y); const s = getComputedStyle(b); const pied = b.closest('[class]').parentElement; return { r: [Math.round(r.top), Math.round(r.bottom)], dessus: e === b || b.contains(e) ? 'bouton' : (e.tagName + '.' + e.className + '#' + e.id), fond: s.backgroundImage.slice(0, 80) + ' ' + s.backgroundColor, color: s.color, opacity: s.opacity, piedFond: getComputedStyle(b.parentElement.parentElement).backgroundColor, piedCls: b.parentElement.parentElement.className, piedZ: getComputedStyle(b.parentElement.parentElement).zIndex }; });
    console.log(w, 'haut', JSON.stringify(await sonde()));
    for (const y of [200, 400, 600, 800]) { await p.evaluate((y) => document.querySelector('.accueil-form')?.scrollTo(0, y), y); await p.waitForTimeout(200); console.log(w, 'y=' + y, JSON.stringify((await sonde()).dessus)); }
    // essai de clic réel au centre du bouton, défilement en haut
    await p.evaluate(() => document.querySelector('.accueil-form')?.scrollTo(0, 0)); await p.fill('#officine-nom', 'Essai');
    const r = await p.evaluate(() => { const b = document.querySelector('button[type=submit]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await p.mouse.click(r[0], r[1]); await p.waitForTimeout(500);
    console.log(w, 'après clic souris, titre :', await p.evaluate(() => document.querySelector('.accueil-form h1')?.textContent));
    const ph = await p.evaluate(() => { const i = document.querySelector('#officine-surface'); return i ? getComputedStyle(i, '::placeholder').color : null; });
    console.log('placeholder', ph);
    await o.b.close();
  }
})();
