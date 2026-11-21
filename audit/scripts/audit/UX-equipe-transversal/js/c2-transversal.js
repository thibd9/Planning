// Transversal : fenêtres (Échap, clic à côté, saisie perdue), toasts (position, durée), téléphone (barre d'onglets, menu), visite en cours (Solvi, projecteur).
const { ouvrir } = require('../lib.js');
(async () => {
  // 1. Fenêtres à 1440
  {
    const o = await ouvrir({ role: 3 }); const p = o.p;
    const ouvrirND = async () => { await p.evaluate(() => document.querySelector('.top-creer')?.click()); await p.waitForTimeout(600); };
    await ouvrirND();
    await p.selectOption('#demande-motif', 'famille'); await p.fill('#demande-precision', 'texte saisi');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    console.log('ND Échap ferme', await p.evaluate(() => !document.querySelector('[role=dialog]')), 'confirmation ?', o.errs.filter((e) => e.startsWith('DIALOG')));
    await ouvrirND(); console.log('ND rouverte, précision conservée ?', await p.evaluate(() => document.getElementById('demande-precision')?.value));
    await p.mouse.click(60, 600); await p.waitForTimeout(400);
    console.log('ND clic à côté ferme', await p.evaluate(() => !document.querySelector('[role=dialog]')));
    // focus dans la fenêtre au Tab
    await ouvrirND(); const foc = []; for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); foc.push(await p.evaluate(() => !!document.activeElement.closest('[role=dialog]'))); }
    console.log('ND focus reste dans la fenêtre sur 40 Tab', foc.every(Boolean));
    const geo = await p.evaluate(() => { const d = document.querySelector('[role=dialog]'); const t = d.querySelector('.dialog-fermer, [aria-label=Fermer]'); const r = t?.getBoundingClientRect(); return { fermer: r ? [Math.round(r.width), Math.round(r.height)] : null, pied: [...d.querySelectorAll('footer button, .dialog-foot button')].map((b) => b.textContent.trim()) }; });
    console.log('ND géométrie', JSON.stringify(geo));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    // toasts : un message envoyé ; durée et position
    await o.nav('messages'); await p.fill('#contenu textarea', 'Bonjour'); await p.evaluate(() => [...document.querySelectorAll('#contenu button')].find((b) => /Envoyer/.test(b.textContent))?.click());
    const t0 = Date.now(); let vu = null; const pos = await p.evaluate(() => { const t = document.querySelector('.toast'); if (!t) return null; const r = t.getBoundingClientRect(); return { txt: t.innerText, r: [r.left, r.top, r.width, r.height].map(Math.round) }; });
    console.log('toast message', JSON.stringify(pos)); await o.shot('c2-toast-message');
    for (let i = 0; i < 12; i++) { await p.waitForTimeout(1000); if (!(await p.evaluate(() => !!document.querySelector('.toast')))) { vu = Date.now() - t0; break; } }
    console.log('toast disparu après ms', vu);
    await o.b.close();
  }
  // 2. Téléphone : barre d'onglets, menu, toast
  {
    const o = await ouvrir({ role: 3, w: 390, h: 800 }); const p = o.p;
    const tab = await p.evaluate(() => { const t = document.querySelector('.tabbar'); const r = t.getBoundingClientRect(); return { r: [r.top, r.height].map(Math.round), onglets: [...t.querySelectorAll('button, a')].map((b) => { const q = b.getBoundingClientRect(); const s = getComputedStyle(b.querySelector('span') || b); return `${b.textContent.trim()} ${Math.round(q.width)}×${Math.round(q.height)} ${s.fontSize}`; }) }; });
    console.log('tabbar', JSON.stringify(tab));
    await p.evaluate(() => document.querySelector('.tabbar .burger')?.click()); await p.waitForTimeout(600);
    await o.shot('c2-tel-menu'); console.log('menu', await p.evaluate(() => document.querySelector('nav.side')?.innerText.replace(/\n+/g, ' | ')));
    const side = await p.evaluate(() => { const s = document.querySelector('nav.side'); const r = s.getBoundingClientRect(); return [r.left, r.width, r.height, s.scrollHeight].map(Math.round); }); console.log('menu géo', side);
    await p.evaluate(() => document.querySelector('nav.side')?.scrollTo(0, 9999)); await p.waitForTimeout(300); await o.shot('c2-tel-menu-bas');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    console.log('menu fermé par Échap', await p.evaluate(() => !document.querySelector('nav.side.ouvert')));
    // onglet Demandes de la barre
    await p.evaluate(() => [...document.querySelectorAll('.tabbar button, .tabbar a')].find((b) => /Demandes/.test(b.textContent))?.click()); await p.waitForTimeout(600);
    console.log('onglet Demandes →', await p.evaluate(() => document.querySelector('#contenu h1')?.innerText));
    // toast au téléphone
    await p.evaluate(() => document.getElementById('dem-souhaits')?.click()); await p.waitForTimeout(300);
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((e) => /^\s*\d+/.test(e.textContent) && /À remplir|Matin|Journée|Après|Repos/.test(e.textContent)); b?.click(); });
    await p.evaluate(() => document.querySelector('.top-creer')?.click()); await p.waitForTimeout(600);
    await p.selectOption('#demande-motif', 'famille'); await p.evaluate(() => { const s = [...document.querySelectorAll('[role=dialog] select')].find((x) => [...x.options].some((o) => o.value === 'jour')); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'jour'); s.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForTimeout(200); await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => /Envoyer/.test(b.textContent))?.click()); await p.waitForTimeout(500);
    const tt = await p.evaluate(() => { const t = document.querySelector('.toast'); if (!t) return null; const r = t.getBoundingClientRect(); const tb = document.querySelector('.tabbar').getBoundingClientRect(); const f = document.querySelector('.aide-fab')?.getBoundingClientRect(); return { txt: t.innerText, toast: [r.left, r.top, r.right, r.bottom].map(Math.round), tabbar: Math.round(tb.top), fab: f ? [f.left, f.top, f.right, f.bottom].map(Math.round) : null }; });
    console.log('toast tel', JSON.stringify(tt)); await o.shot('c2-tel-toast');
    console.log(o.errs); await o.b.close();
  }
  // 3. Visite en cours : la bulle Solvi habituelle est-elle masquée ? projecteur ?
  {
    const o = await ouvrir({ vierge: true }); const p = o.p;
    await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(500);
    await p.evaluate(() => [...document.querySelectorAll('.dc-point')].find((e) => /Préparateur/.test(e.textContent))?.click()); await p.waitForTimeout(300);
    await p.evaluate(() => [...document.querySelectorAll('.decouvrir button')].find((e) => /Lancer la visite/.test(e.textContent)).click()); await p.waitForTimeout(1500);
    await p.evaluate(() => document.querySelector('[data-acte="go"]')?.click()); await p.waitForTimeout(2000);
    for (let k = 0; k < 4; k++) { await p.evaluate(() => (document.querySelector('[data-suite="etape"]') || document.querySelector('.pt-passer'))?.click()); await p.waitForTimeout(2200); }
    const etat = await p.evaluate(() => { const fab = document.querySelector('.aide-fab'); const fr = fab?.getBoundingClientRect(); const spot = [...document.querySelectorAll('[class*="projecteur"], [class*="spot"], .tour-spot, .pt-spot')].map((e) => e.className); const fiche = document.querySelector('.parcours-test').getBoundingClientRect(); return { fab: fr ? [fr.left, fr.top, fr.width].map(Math.round) : null, fabVisible: fab ? getComputedStyle(fab).visibility + '/' + getComputedStyle(fab.parentElement).display : null, spot, fiche: [fiche.left, fiche.top, fiche.width, fiche.height].map(Math.round), titre: document.querySelector('.pt-titre h2')?.innerText }; });
    console.log('visite étape 5', JSON.stringify(etat)); await o.shot('c2-visite-etape5');
    // rechargement pendant la visite
    await p.reload(); await p.waitForTimeout(1500); console.log('après rechargement : visite encore là ?', await p.evaluate(() => !!document.querySelector('.parcours-test:not(.ferme)')), await p.evaluate(() => document.querySelector('#contenu h1, h1')?.innerText));
    await o.shot('c2-visite-apres-reload');
    console.log(o.errs); await o.b.close();
  }
})();
