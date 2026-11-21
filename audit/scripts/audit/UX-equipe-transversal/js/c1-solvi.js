// Solvi : la bulle (ce qu'elle masque), la conversation, une question, à trois tailles.
const { ouvrir } = require('../lib.js');
const TAILLES = { b: [1440, 900], p: [1280, 760], t: [390, 800] };
(async () => {
  for (const t of (process.env.T || 'bpt').split('')) {
    const [w, h] = TAILLES[t]; const pre = `c1-${t}`;
    const o = await ouvrir({ role: 3, w, h }); const p = o.p;
    const bulle = await p.evaluate(() => { const b = document.querySelector('.assistant > button, .assistant .aide-bouton, .assistant button'); const r = b.getBoundingClientRect(); const mot = document.querySelector('.aide-mot')?.getBoundingClientRect(); return { cls: b.className, r: [r.left, r.top, r.width, r.height].map(Math.round), mot: mot ? [mot.left, mot.top, mot.width, mot.height].map(Math.round) : null }; });
    console.log(pre, 'bulle', JSON.stringify(bulle));
    // Ce que la bulle masque sur chaque page : éléments interactifs ou texte sous sa zone
    for (const v of ['espace', 'moi', 'demandes', 'suivi', 'documents', 'planning', 'messages']) {
      await o.nav(v);
      for (const y of [0, 99999]) {
        await p.evaluate((y) => document.getElementById('contenu').scrollTo(0, y), y); await p.waitForTimeout(250);
        const sous = await p.evaluate(() => { const a = document.querySelector('.assistant'); const zs = [...a.querySelectorAll('button, .aide-mot')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0); const out = []; for (const e of document.querySelectorAll('#contenu button, #contenu a, #contenu .pill, #contenu b, #contenu p, #contenu span, #contenu td')) { if (e.closest('.assistant')) continue; const r = e.getBoundingClientRect(); if (r.width < 2) continue; for (const z of zs) { const ox = Math.min(r.right, z.right) - Math.max(r.left, z.left), oy = Math.min(r.bottom, z.bottom) - Math.max(r.top, z.top); if (ox > 6 && oy > 6 && e.children.length < 3) { out.push(`${e.tagName.toLowerCase()} « ${(e.textContent || '').trim().slice(0, 30)} »`); break; } } } return [...new Set(out)].slice(0, 6); });
        if (sous.length) console.log(pre, v, y ? 'bas' : 'haut', 'MASQUE', JSON.stringify(sous));
      }
    }
    await o.nav('moi');
    await p.evaluate(() => document.querySelector('.assistant button').click()); await p.waitForTimeout(700);
    const pan = await p.evaluate(() => { const s = document.querySelector('.aide-panneau'); const r = s.getBoundingClientRect(); return { r: [r.left, r.top, r.width, r.height].map(Math.round), texte: s.innerText.slice(0, 900) }; });
    console.log(pre, 'panneau', JSON.stringify(pan));
    await o.shot(`${pre}-ouvert`);
    await p.fill('#aide-question', 'Quand est-ce que je travaille demain ?'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
    await o.shot(`${pre}-reponse1`);
    console.log(pre, 'réponse', (await p.evaluate(() => [...document.querySelectorAll('.aide-bulle.bot')].pop()?.innerText)).slice(0, 600));
    await p.fill('#aide-question', 'Comment poser un congé ?'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
    await o.shot(`${pre}-reponse2`);
    console.log(pre, 'réponse2', (await p.evaluate(() => [...document.querySelectorAll('.aide-bulle.bot')].pop()?.innerText)).slice(0, 600));
    await p.fill('#aide-question', 'zzz blabla'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
    await o.shot(`${pre}-reponse3`);
    console.log(pre, 'réponse3', (await p.evaluate(() => [...document.querySelectorAll('.aide-bulle.bot')].pop()?.innerText)).slice(0, 600));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    console.log(pre, 'fermé par Échap', await p.evaluate(() => !document.querySelector('.aide-panneau')));
    console.log(pre, 'errs', o.errs);
    await o.b.close();
  }
})();
