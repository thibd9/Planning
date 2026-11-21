// Capture chaque onglet d'une rubrique : VUE=officine ONGLETS="Pharmacie,Horaires,..." TAILLES=d,p,t
const ux = require('./ux');
const fs = require('fs');
const VUE = process.env.VUE; const ONG = process.env.ONGLETS.split(',');
const CONF = { d: { w: 1440, h: 900 }, p: { w: 1280, h: 760 }, t: { w: 390, h: 800, tactile: true }, s: { w: 1440, h: 900, mode: 'sombre' } };
(async () => {
  const b = await ux.lancer(); const mes = {};
  for (const t of (process.env.TAILLES || 'd,p,t').split(',')) {
    const { p, errs } = await ux.ouvrir(b, { ...CONF[t], plie: true });
    await ux.aller(p, VUE);
    for (let i = 0; i < ONG.length; i++) {
      const o = ONG[i];
      const ok = await p.evaluate((o) => { const e = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim().startsWith(o) && x.getBoundingClientRect().width > 0); if (!e) return false; e.click(); return true; }, o);
      await p.waitForTimeout(600);
      await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0));
      const nom = `${t}-${VUE}-o${i + 1}`;
      const f = await ux.defiler(p, nom, { max: +(process.env.MAX || 10) });
      if (t === 't') for (let k = 0; k < f.length; k += 4) ux.assembler(f.slice(k, k + 4), `${ux.DIR}/${nom}-A${k / 4 + 1}.png`, 4);
      mes[nom] = { ok, n: f.length, ...(await ux.mesurer(p)) };
      console.log(nom, o, ok, f.length);
    }
    console.log(t, errs);
    await p.context().close();
  }
  fs.writeFileSync(`${__dirname}/mesures-onglets-${VUE}.json`, JSON.stringify(mes, null, 1));
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
