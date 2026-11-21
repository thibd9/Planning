const { ouvrir } = require('../lib.js');
(async () => {
  for (const [w, h, t] of [[1440, 900, 'b'], [1280, 760, 'p'], [390, 800, 't']]) {
    const o = await ouvrir({ vierge: true, w, h });
    await o.shot(`a1-connexion-${t}`); await o.shot(`a1-connexion-${t}-full`, { fullPage: true });
    if (t === 'b') {
      console.log(JSON.stringify(await o.mesurer('.connexion'), null, 1));
      // saisie d'un identifiant et mot de passe faux sur appareil vide
      await o.p.fill('#cx-identifiant', 'nicolas'); await o.p.fill('#cx-mdp', 'abc'); await o.p.click('button[type=submit]'); await o.p.waitForTimeout(300);
      await o.shot('a1-connexion-b-erreur');
      const btn = await o.p.evaluate(() => { const b = document.querySelector('button[type=submit]'); const s = getComputedStyle(b); return [s.backgroundColor, s.color, b.getBoundingClientRect().height]; });
      console.log('btn', btn);
    }
    if (t === 't') { const o2 = o; console.log(JSON.stringify(await o2.mesurer('.connexion'), null, 1)); }
    await o.b.close();
  }
  const o = await ouvrir({ vierge: true, mode: 'sombre' }); await o.p.reload(); await o.p.waitForTimeout(600); await o.shot('a1-connexion-sombre'); await o.b.close();
})();
