// Sondes : barre du haut (nom de pharmacie), menu du compte, cloche, Messages au téléphone, Mon planning (calendrier, journée, impression), Mes documents (onglets, Voir).
const { ouvrir } = require('../lib.js');
const TAILLES = { b: [1440, 900], p: [1280, 760], t: [390, 800] };
const clic = (p, re, sel = 'button') => p.evaluate(([s, sel]) => { const r = new RegExp(s); const b = [...document.querySelectorAll(sel)].find((e) => r.test(e.textContent) && e.getBoundingClientRect().width > 0 && !e.disabled); if (!b) return false; b.click(); return true; }, [re.source, sel]);
(async () => {
  const role = +(process.env.ROLE || 3);
  for (const t of (process.env.T || 'b').split('')) {
    const [w, h] = TAILLES[t]; const pre = `b4-r${role}-${t}`;
    const o = await ouvrir({ role, w, h }); const p = o.p;
    // 1. barre du haut
    const barre = await p.evaluate(() => { const n = document.querySelector('.espace-officine'); const b = document.querySelector('#bt-ouvrir'); if (!n) return null; const rn = n.getBoundingClientRect(), rb = b.getBoundingClientRect(); const s = getComputedStyle(n); return { nom: n.textContent, nomRect: [rn.left, rn.right, rn.width].map(Math.round), badge: [rb.left, rb.right].map(Math.round), visible: s.display, overflow: s.textOverflow, sw: n.scrollWidth, cw: n.clientWidth, dir: s.direction }; });
    console.log(pre, 'barre', JSON.stringify(barre));
    await o.shot(`${pre}-barre`, { clip: { x: 0, y: 0, width: w, height: 80 } });
    // 2. menu du compte
    await p.evaluate(() => document.querySelector('.compte-btn').click()); await p.waitForTimeout(300); await o.shot(`${pre}-menu-compte`);
    console.log(pre, 'menu', await p.evaluate(() => document.querySelector('.compte-btn')?.parentElement.querySelector('.menu')?.innerText));
    await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('.compte-btn').click()); await p.waitForTimeout(200);
    // 3. cloche
    await p.evaluate(() => document.querySelector('.top-ico[aria-haspopup]')?.click()); await p.waitForTimeout(400); await o.shot(`${pre}-cloche`);
    console.log(pre, 'cloche', await p.evaluate(() => document.querySelector('.menu.cloche')?.innerText));
    await p.evaluate(() => document.querySelector('.top-ico[aria-haspopup]')?.click()); await p.waitForTimeout(200);
    // 4. Messages
    await o.nav('messages');
    const m = await p.evaluate(() => { const W = innerWidth; const out = []; for (const e of document.querySelectorAll('#contenu *')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.right > W + 1 && (e.matches('button, textarea, h2, h3, .card, p'))) out.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)} « ${(e.textContent || '').trim().slice(0, 30)} » ${Math.round(r.left)}→${Math.round(r.right)}`); } const env = [...document.querySelectorAll('#contenu button')].find((e) => /Envoyer/.test(e.textContent)); const r = env?.getBoundingClientRect(); return { W, out: out.slice(0, 15), envoyer: r ? [Math.round(r.left), Math.round(r.right)] : null }; });
    console.log(pre, 'messages', JSON.stringify(m));
    // ouvrir la conversation avec Caroline
    await clic(p, /Caroline Tellier/, '#contenu button'); await p.waitForTimeout(500);
    const pos = await p.evaluate(() => { const c = document.querySelector('#contenu textarea'); const r = c?.getBoundingClientRect(); return { scrollTop: document.getElementById('contenu').scrollTop, textarea: r ? Math.round(r.top) : null }; });
    console.log(pre, 'après clic Caroline', JSON.stringify(pos)); await o.shot(`${pre}-messages-caroline`);
    // 5. Mon planning : calendrier, journée, impression
    await o.nav('moi');
    await clic(p, /^\s*Calendrier\s*$/); await p.waitForTimeout(500); await o.defiler(`${pre}-moi-calendrier`, 4);
    await clic(p, /^\s*Semaine\s*$/); await p.waitForTimeout(300);
    const j = await p.evaluate(() => { const b = document.querySelector('.lien-jour'); if (!b) return false; b.click(); return b.getAttribute('aria-label') || b.textContent; }); await p.waitForTimeout(600);
    console.log(pre, 'journée', j); await o.shot(`${pre}-moi-journee`);
    console.log(pre, 'journée texte', (await p.evaluate(() => [...document.querySelectorAll('[role=dialog]')].pop()?.innerText || '')).slice(0, 800));
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await clic(p, /^\s*Imprimer\s*$/, '#contenu button'); await p.waitForTimeout(800); await o.shot(`${pre}-moi-imprimer`);
    console.log(pre, 'impression', (await p.evaluate(() => [...document.querySelectorAll('[role=dialog]')].pop()?.innerText || document.body.innerText.slice(0, 300))).slice(0, 600));
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    // 6. Mes documents
    await o.nav('documents');
    for (const re of [/Mes absences/, /Mes fichiers/]) { await clic(p, re, '#contenu button'); await p.waitForTimeout(400); await o.shot(`${pre}-documents-${re.source.split(' ')[1]}`); }
    await clic(p, /Mes plannings/, '#contenu button'); await p.waitForTimeout(300); await clic(p, /Voir/, '#contenu button'); await p.waitForTimeout(700);
    await o.shot(`${pre}-documents-voir`); console.log(pre, 'voir', (await p.evaluate(() => [...document.querySelectorAll('[role=dialog]')].pop()?.innerText || 'pas de fenêtre ; vue : ' + document.querySelector('#contenu h1')?.innerText)).slice(0, 400));
    console.log(pre, 'errs', o.errs);
    await o.b.close();
  }
})();
