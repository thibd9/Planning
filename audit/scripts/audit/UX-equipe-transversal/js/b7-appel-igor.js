// Nicolas demande à Igor de le remplacer le 27 novembre ; Igor voit la demande (accueil, Mon planning, cloche) et y répond.
const { ouvrir } = require('../lib.js');
const TAILLES = { b: [1440, 900], p: [1280, 760], t: [390, 800] };
const clic = (p, re, sel = 'button') => p.evaluate(([s, sel]) => { const r = new RegExp(s); const b = [...document.querySelectorAll(sel)].find((e) => r.test(e.textContent) && e.getBoundingClientRect().width > 0 && !e.disabled); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return b.textContent.trim().slice(0, 50); }, [re.source, sel]);
const toasts = (p) => p.evaluate(() => [...document.querySelectorAll('.toast')].map((e) => e.innerText.trim()));
(async () => {
  for (const t of (process.env.T || 'b').split('')) {
    const [w, h] = TAILLES[t]; const pre = `b7-${t}`;
    const o = await ouvrir({ role: 3, w, h }); const p = o.p;
    await o.nav('demandes'); await p.evaluate(() => document.getElementById('dem-remplacements')?.click()); await p.waitForTimeout(400);
    await p.evaluate(() => { const l = [...document.querySelectorAll('#contenu button')].filter((e) => e.textContent.trim() === 'Me faire remplacer'); l[0]?.click(); }); await p.waitForTimeout(700);
    await p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); const s = d.querySelector('select'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, s.options[3].value); s.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForTimeout(200);
    console.log(pre, 'clic Igor', await clic(p, /Igor Le Russe/, '[role=dialog] button, [role=dialog] label, [role=dialog] [role=radio]'));
    await p.waitForTimeout(300); await o.shot(`${pre}-nicolas-choix-igor`);
    console.log(pre, 'envoi', await clic(p, /Envoyer la demande/, '[role=dialog] button')); await p.waitForTimeout(600);
    console.log(pre, 'toast', await toasts(p)); await o.shot(`${pre}-nicolas-envoye`);
    await o.defiler(`${pre}-nicolas-onglet`, 2);
    // passer à Igor
    await o.profil('Pharmacien'); await p.waitForTimeout(500);
    console.log(pre, 'Igor vue', await p.evaluate(() => document.querySelector('#contenu h1')?.innerText));
    await o.defiler(`${pre}-igor-accueil`, 3);
    console.log(pre, 'Igor accueil', (await p.evaluate(() => { const m = document.getElementById('contenu').innerText.match(/.{0,120}(remplac|Nicolas).{0,200}/i); return m ? m[0] : null; })));
    await p.evaluate(() => document.querySelector('.top-ico[aria-haspopup]')?.click()); await p.waitForTimeout(400); await o.shot(`${pre}-igor-cloche`);
    console.log(pre, 'Igor cloche', await p.evaluate(() => document.querySelector('.menu.cloche')?.innerText));
    await p.evaluate(() => document.querySelector('.top-ico[aria-haspopup]')?.click()); await p.waitForTimeout(200);
    await o.nav('moi'); await o.defiler(`${pre}-igor-moi`, 2);
    const carte = await p.evaluate(() => { const c = document.getElementById('contenu'); const h = [...c.querySelectorAll('h2')].find((e) => /remplacer|remplaçant|coup de main/.test(e.textContent)); if (!h) return null; const s = h.closest('section, .card') || h.parentElement; s.scrollIntoView({ block: 'start' }); return s.innerText.slice(0, 800); });
    console.log(pre, 'Igor carte', carte); await p.waitForTimeout(300); await o.shot(`${pre}-igor-carte`);
    const btns = await p.evaluate(() => { const c = document.getElementById('contenu'); const h = [...c.querySelectorAll('h2')].find((e) => /remplacer|remplaçant|coup de main/.test(e.textContent)); const s = h?.closest('section, .card') || h?.parentElement; return s ? [...s.querySelectorAll('button')].map((b) => b.textContent.trim()) : []; });
    console.log(pre, 'boutons', btns);
    const oui = await clic(p, /J’accepte/, '#contenu button'); await p.waitForTimeout(700);
    console.log(pre, 'réponse', oui, await toasts(p), JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[role=dialog]')].pop()?.innerText.slice(0, 600) || null)));
    await o.shot(`${pre}-igor-repondu`);
    console.log(pre, 'errs', o.errs);
    await o.b.close();
  }
})();
