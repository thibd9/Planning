// Tous les champs de tous les écrans : aucun ne garde l'aspect du navigateur. L'appareil est réglé à l'inverse de l'application.
const { chromium } = require('playwright');
(async () => {
  const mode = process.env.MODE || 'clair';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', colorScheme: mode === 'clair' ? 'dark' : 'light' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5180/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  const fautes = new Map(); let champs = 0, ecrans = 0;
  const releve = async (ou) => {
    await p.waitForTimeout(350); ecrans++;
    const r = await p.evaluate((sombre) => {
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); if (m.length > 3 && m[3] === 0) return null; return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255; };
      const fondDe = (el) => { for (let e = el; e; e = e.parentElement) { const l = lum(getComputedStyle(e).backgroundColor); if (l !== null) return l; } return 1; };
      const out = []; let n = 0;
      for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]), textarea, select')) {
        const s = getComputedStyle(el); const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || s.visibility === 'hidden' || s.opacity === '0') continue;
        n++; const fond = fondDe(el); const encre = lum(s.color) ?? 0;
        const soucis = [];
        if (sombre ? fond > 0.45 : fond < 0.6) soucis.push(`fond ${fond.toFixed(2)}`);
        if (Math.abs(fond - encre) < 0.4) soucis.push(`texte peu lisible ${encre.toFixed(2)}/${fond.toFixed(2)}`);
        const nu = s.borderTopStyle === 'inset' || (parseFloat(s.borderTopLeftRadius) < 6 && s.borderTopWidth !== '0px');
        if (nu) soucis.push(`aspect du navigateur (coins ${s.borderTopLeftRadius}, contour ${s.borderTopStyle})`);
        if (soucis.length) out.push(`${el.tagName.toLowerCase()}${el.type ? '[' + el.type + ']' : ''}${el.id ? '#' + el.id : ''}.${(el.className || '').toString().split(' ').join('.')} « ${(el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.placeholder || '').trim().slice(0, 40)} » : ${soucis.join(', ')}`);
      }
      return { n, out };
    }, mode === 'sombre');
    champs += r.n; for (const f of r.out) if (!fautes.has(f)) fautes.set(f, ou);
  };
  await releve('connexion');
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  const ids = ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste', 'sarah.lemoine', 'manon.girard', 'yanis.morel'];
  await p.evaluate(([l, m]) => { const o = {}; for (const id of l) o[id] = { mode: m }; localStorage.setItem('releve.preferences', JSON.stringify(o)); localStorage.setItem('releve.preferences.version', '2'); }, [ids, mode]); await p.reload(); await p.waitForTimeout(700);
  const ouvrirTout = async (ou) => {
    await releve(ou);
    // Les blocs repliés (règles, fiches) et les onglets cachent des champs : on les ouvre.
    for (const d of await p.locator('.content details:not([open]) > summary').all()) { await d.click({ timeout: 800 }).catch(() => {}); }
    for (const o of await p.locator('.content .onglet, .content .voie').all()) { await o.click({ timeout: 800 }).catch(() => {}); await releve(ou + ' · onglet'); }
    await releve(ou + ' · déplié');
  };
  for (const r of ['Titulaire 1', 'Pharmacien', 'Préparateur', 'Animateur']) {
    await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.bandeau-test button', { hasText: r }).first().click(); await p.waitForTimeout(600);
    const n = await p.locator('[data-tour^="nav-"]:visible').count();
    for (let i = 0; i < n; i++) { const l = p.locator('[data-tour^="nav-"]:visible').nth(i); const v = await l.getAttribute('data-tour'); await l.click(); await p.waitForTimeout(350); await ouvrirTout(`${r} · ${v}`); }
    await p.locator('[data-tour="compte"]:visible').first().click(); await p.waitForTimeout(250); await p.locator('.menu button', { hasText: 'Mon compte' }).click(); await ouvrirTout(`${r} · compte`);
    await p.locator('.aide-fab').click(); await releve(`${r} · assistant`); await p.locator('.aide-fab').click();
    if (r === 'Titulaire 1') {
      for (const m of ['Un planning', 'Une garde', 'Une formation', 'Un inventaire', 'Une personne', 'Une absence', 'Un message']) { await p.locator('.top-creer').click(); await p.waitForTimeout(200); const e = p.locator('.menu button', { hasText: m }); if (await e.count()) { await e.first().click(); await releve(`créer · ${m}`); } await p.keyboard.press('Escape'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); }
      await p.locator('[data-tour="nav-heures"]').click(); await p.waitForTimeout(400); if (await p.locator('[data-regul]').count()) { await p.locator('[data-regul]').first().click(); await releve('fenêtre faire rattraper'); await p.keyboard.press('Escape'); }
      await p.locator('[data-tour="nav-construire"]').click(); await p.waitForTimeout(500); const plus = p.locator('.plan button[aria-label*="Ajouter"], .plan .pg-plus').first(); if (await plus.count()) { await plus.click().catch(() => {}); await releve('fenêtre poste'); await p.keyboard.press('Escape'); }
      await p.locator('[data-tour="nav-messages"]').click(); await p.waitForTimeout(400); if (await p.locator('#rdv-demander').count()) { await p.locator('#rdv-demander').click(); await releve('fenêtre rendez-vous'); await p.keyboard.press('Escape'); }
    } else { await p.locator('[data-tour="nav-demandes"]:visible').first().click().catch(() => {}); await p.waitForTimeout(300); for (const v of await p.locator('.voie').all()) { await v.click(); const bt = p.locator('.dm .btn').first(); if (await bt.count()) { await bt.click().catch(() => {}); await releve(`${r} · fenêtre de demande`); await p.keyboard.press('Escape'); } } }
  }
  console.log(`${mode} (appareil réglé à l’inverse) : ${champs} champs relevés sur ${ecrans} écrans, ${fautes.size} en défaut ; erreurs de page ${errs.length}`);
  for (const [f, ou] of fautes) console.log('  -', ou, '→', f);
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 4).join('\n')); process.exit(1); });
