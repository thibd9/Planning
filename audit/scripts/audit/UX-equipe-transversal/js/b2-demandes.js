// Mes demandes (Nicolas) : les trois cartes, les préférences, la fenêtre « Nouvelle demande », « Me faire remplacer ». PLIE=1 conseillé.
const { ouvrir } = require('../lib.js');
const TAILLES = { b: [1440, 900], p: [1280, 760], t: [390, 800] };
const clic = (p, re, sel = 'button') => p.evaluate(([s, sel]) => { const r = new RegExp(s); const b = [...document.querySelectorAll(sel)].find((e) => r.test(e.textContent) && e.getBoundingClientRect().width > 0 && !e.disabled); if (!b) return false; b.click(); return true; }, [re.source, sel]);
const dialogue = (p) => p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); if (!d) return null; const r = d.getBoundingClientRect(); const sc = [d, ...d.querySelectorAll('*')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }); return { r: [r.left, r.top, r.width, r.height].map(Math.round), defile: sc ? [sc.className, sc.scrollHeight, sc.clientHeight] : null, titre: d.querySelector('h2')?.innerText }; });
const toasts = (p) => p.evaluate(() => [...document.querySelectorAll('.toast, [role=status]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.innerText.trim()).filter(Boolean));
(async () => {
  const role = +(process.env.ROLE || 3);
  for (const t of (process.env.T || 'b').split('')) {
    const [w, h] = TAILLES[t]; const pre = `b2-r${role}-${t}`;
    const o = await ouvrir({ role, w, h }); const p = o.p;
    await o.nav('demandes');
    for (const [k, id] of [['pref', 'dem-souhaits'], ['abs', 'dem-absences'], ['rempl', 'dem-remplacements']]) {
      const ok = await p.evaluate((id) => { const b = document.getElementById(id) || [...document.querySelectorAll('[role=tab]')].find((e) => e.id.includes(id.split('-')[1].slice(0, 4))); if (!b) return false; b.click(); return b.id; }, id);
      await p.waitForTimeout(500); console.log(pre, k, ok);
      await o.defiler(`${pre}-${k}`, 6);
    }
    console.log('onglets', await p.$$eval('[role=tab]', (l) => l.map((e) => e.id + ' ' + e.getAttribute('aria-selected'))));
    // Préférences : choisir Matin puis toucher un jour
    await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((e) => /pr[eé]f/i.test(e.textContent))?.click()); await p.waitForTimeout(400);
    await clic(p, /^\s*Matin\s*$/); await p.waitForTimeout(200);
    const jour = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((e) => /À remplir|Matin|Journée|Après-midi|Repos/.test(e.textContent) && /^\s*\d+/.test(e.textContent) && e.getBoundingClientRect().width > 0); if (!b) return null; b.click(); return b.textContent; }); await p.waitForTimeout(400);
    console.log(pre, 'jour touché', jour, await toasts(p)); await o.shot(`${pre}-pref-apres-clic`);
    // Nouvelle demande
    await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((e) => /Absence ou horaire/.test(e.textContent))?.click()); await p.waitForTimeout(400);
    await clic(p, /Nouvelle demande/); await p.waitForTimeout(600);
    console.log(pre, 'dialogue', JSON.stringify(await dialogue(p)));
    await o.shot(`${pre}-nd-0`);
    const sc = await p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); const x = [d, ...d.querySelectorAll('*')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }); if (!x) return false; x.scrollTo(0, 10000); return true; });
    if (sc) { await p.waitForTimeout(300); await o.shot(`${pre}-nd-1-bas`); }
    const genres = await p.$$eval('[role=dialog] select', (l) => l.map((s) => [s.id, [...s.options].map((x) => x.value)]));
    console.log('selects', JSON.stringify(genres));
    const selType = await p.evaluate(() => { const s = [...document.querySelectorAll('[role=dialog] select')].find((x) => [...x.options].some((o) => o.value === 'absence')); if (!s) return null; s.setAttribute('data-test-type', '1'); return true; });
    for (const g of ['finir_avant', 'jour', 'absence', 'indisponible']) {
      await p.selectOption('[data-test-type]', g); await p.waitForTimeout(300);
      await p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); const x = [d, ...d.querySelectorAll('*')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }); x?.scrollTo(0, 0); });
      await o.shot(`${pre}-nd-type-${g}`);
      if (t === 'b') { const x = await p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); const x = [d, ...d.querySelectorAll('*')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }); if (!x) return false; x.scrollTo(0, 10000); return true; }); if (x) { await p.waitForTimeout(200); await o.shot(`${pre}-nd-type-${g}-bas`); } }
    }
    // raccourci « Chabbat »
    await clic(p, /Chabbat/); await p.waitForTimeout(300); await o.shot(`${pre}-nd-raccourci`);
    await clic(p, /Chabbat/); await p.waitForTimeout(200);
    // envoi d'un jour précis : remplir la raison puis envoyer
    await p.selectOption('[data-test-type]', 'jour'); await p.selectOption('#demande-motif', 'administratif'); await p.waitForTimeout(200);
    const btn = await p.evaluate(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find((e) => /Envoyer/.test(e.textContent)); return b ? [b.textContent, b.disabled] : null; });
    console.log(pre, 'bouton envoyer', btn);
    await o.shot(`${pre}-nd-pret`);
    await clic(p, /Envoyer au responsable/); await p.waitForTimeout(500);
    console.log(pre, 'après envoi', await toasts(p), JSON.stringify(await dialogue(p))); await o.shot(`${pre}-nd-envoye`);
    await p.waitForTimeout(2500); console.log(pre, 'toasts après 3 s', await toasts(p));
    // Me faire remplacer
    await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((e) => /remplacer/.test(e.textContent))?.click()); await p.waitForTimeout(400);
    await o.defiler(`${pre}-rempl2`, 4);
    const r = await clic(p, /Me faire remplacer|Demande urgente/, '#contenu button'); await p.waitForTimeout(600);
    console.log(pre, 'remplacer ouvert', r, JSON.stringify(await dialogue(p)));
    await o.shot(`${pre}-rempl-dialogue`);
    const sc2 = await p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); if (!d) return false; const x = [d, ...d.querySelectorAll('*')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }); if (!x) return false; x.scrollTo(0, 10000); return true; });
    if (sc2) { await p.waitForTimeout(300); await o.shot(`${pre}-rempl-dialogue-bas`); }
    console.log(pre, 'texte remplacer', (await p.evaluate(() => [...document.querySelectorAll('[role=dialog]')].pop()?.innerText || '')).slice(0, 1500));
    console.log(pre, 'errs', o.errs);
    await o.b.close();
  }
})();
