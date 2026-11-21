// « Me faire remplacer » : ouvrir la fenêtre depuis une ligne (urgente et normale), regarder ; puis la fenêtre « Retard ou absence » et « Prévenir d'un retard ».
const { ouvrir } = require('../lib.js');
const TAILLES = { b: [1440, 900], p: [1280, 760], t: [390, 800] };
const dialogue = (p) => p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); if (!d) return null; const r = d.getBoundingClientRect(); const sc = [d, ...d.querySelectorAll('*')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }); return { r: [r.left, r.top, r.width, r.height].map(Math.round), defile: sc ? [sc.className, sc.scrollHeight, sc.clientHeight] : null, titre: d.querySelector('h2')?.innerText, texte: d.innerText.slice(0, 1600) }; });
const basDialogue = (p) => p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); if (!d) return false; const x = [d, ...d.querySelectorAll('*')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }); if (!x) return false; x.scrollTo(0, 10000); return true; });
const fermer = (p) => p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); const b = d && [...d.querySelectorAll('button')].find((e) => /Annuler|Fermer/.test(e.textContent + (e.getAttribute('aria-label') || ''))); b?.click(); return !!b; });
(async () => {
  const role = +(process.env.ROLE || 3);
  for (const t of (process.env.T || 'b').split('')) {
    const [w, h] = TAILLES[t]; const pre = `b3-r${role}-${t}`;
    const o = await ouvrir({ role, w, h }); const p = o.p;
    await o.nav('demandes'); await p.evaluate(() => document.getElementById('dem-remplacements')?.click()); await p.waitForTimeout(400);
    for (const [k, re] of [['urgent', 'Demande urgente'], ['normal', 'Me faire remplacer']]) {
      const ok = await p.evaluate((s) => { const b = [...document.querySelectorAll('#contenu .dm-ligne button, #contenu button.btn')].find((e) => e.textContent.trim() === s); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; }, re); await p.waitForTimeout(700);
      const d = await dialogue(p); console.log(pre, k, ok, JSON.stringify(d && { ...d, texte: undefined })); console.log(d?.texte);
      await o.shot(`${pre}-rempl-${k}`); if (await basDialogue(p)) { await p.waitForTimeout(250); await o.shot(`${pre}-rempl-${k}-bas`); }
      await fermer(p); await p.waitForTimeout(400);
    }
    // Retard ou absence (barre du haut)
    await p.evaluate(() => document.getElementById('top-signaler')?.click()); await p.waitForTimeout(700);
    let d = await dialogue(p); console.log(pre, 'signaler', JSON.stringify(d && { ...d, texte: undefined })); console.log(d?.texte);
    await o.shot(`${pre}-signaler-0`); if (await basDialogue(p)) { await p.waitForTimeout(250); await o.shot(`${pre}-signaler-0-bas`); }
    // choix successifs proposés dans la fenêtre
    const choix = await p.evaluate(() => [...[...document.querySelectorAll('[role=dialog]')].pop().querySelectorAll('button, [role=radio], label')].map((e) => e.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 40));
    console.log('choix', JSON.stringify(choix));
    for (const [i, re] of [[1, 'absent'], [2, 'retard']]) {
      const ok = await p.evaluate((s) => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); const b = [...d.querySelectorAll('button, label, [role=radio]')].find((e) => new RegExp(s, 'i').test(e.textContent) && !/Annuler|Envoyer|Signaler$/.test(e.textContent.trim())); if (!b) return null; b.click(); return b.textContent.trim().slice(0, 60); }, re); await p.waitForTimeout(500);
      console.log(pre, 'signaler choix', re, ok); await o.shot(`${pre}-signaler-${i}`); if (await basDialogue(p)) { await p.waitForTimeout(250); await o.shot(`${pre}-signaler-${i}-bas`); }
    }
    await fermer(p); await p.waitForTimeout(400);
    // Prévenir d'un retard (accueil)
    await o.nav('espace');
    const r = await p.evaluate(() => { const b = [...document.querySelectorAll('#contenu button')].find((e) => /Prévenir d’un retard/.test(e.textContent)); if (!b) return false; b.click(); return true; }); await p.waitForTimeout(700);
    d = await dialogue(p); console.log(pre, 'prevenir', r, JSON.stringify(d && { ...d, texte: undefined })); console.log(d?.texte);
    await o.shot(`${pre}-prevenir`); if (await basDialogue(p)) { await p.waitForTimeout(250); await o.shot(`${pre}-prevenir-bas`); }
    console.log(pre, 'errs', o.errs);
    await o.b.close();
  }
})();
