const { ouvrir } = require('../lib.js');
(async () => {
  for (const [w, h, t] of [[1440, 900, 'b'], [1280, 760, 'p'], [390, 800, 't']]) {
    const o = await ouvrir({ vierge: true, w, h }); const p = o.p;
    await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(700);
    const geo = await p.evaluate(() => { const d = document.querySelector('.decouvrir'); const r = d.getBoundingClientRect(); const sc = [...d.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }).map((e) => e.className + ' ' + e.scrollHeight + '/' + e.clientHeight); return { r: [r.left, r.top, r.width, r.height].map(Math.round), sc, dsh: d.scrollHeight, dch: d.clientHeight }; });
    console.log(t, 'dialog', JSON.stringify(geo));
    const onglets = await p.$$eval('.dc-onglet', (l) => l.map((e) => e.id));
    for (const id of onglets) {
      await p.click('#' + id); await p.waitForTimeout(600);
      await o.shot(`a3-${t}-${id}`);
      if (t !== 't') { const fam = await p.$$eval('.dc-point', (l) => l.map((e) => e.textContent.trim())); console.log(t, id, fam); if (t === 'b') { for (let i = 1; i < fam.length; i++) { await p.locator('.dc-point').nth(i).click(); await p.waitForTimeout(600); await o.shot(`a3-${t}-${id}-${i}`); } } }
      else { await o.shot(`a3-${t}-${id}-full`, { fullPage: true }); const sc = await p.evaluate(() => { const d = document.querySelector('.decouvrir'); const x = [d, ...d.querySelectorAll('*')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }); if (!x) return null; x.scrollTo(0, x.scrollHeight); return x.className + ' ' + x.scrollHeight; }); console.log('scroll', sc); await p.waitForTimeout(300); await o.shot(`a3-${t}-${id}-bas`); }
      if (t === 'b' && id === 'dc-onglet-parcours') console.log(JSON.stringify(await o.mesurer('.decouvrir')));
    }
    console.log(t, 'errs', o.errs);
    await o.b.close();
  }
})();
