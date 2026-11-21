// Accueil et écrans de chaque profil de l'équipe, à 21 h (journée finie) et à 10 h (journée en cours).
const { ouvrir, ROLES } = require('../lib');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const heures = (process.env.HEURES || '21:00,10:00').split(',');
  for (const h of heures) for (const r of [2, 3, 4, 5, 6]) {
    const o = await ouvrir({ role: r, b, heure: `2026-11-20T${h}:00` });
    const tag = `${r}-${h.replace(':', '')}`;
    const top = await o.p.evaluate(() => document.querySelector('.topbar')?.innerText.replace(/\s+/g, ' '));
    const side = await o.p.evaluate(() => document.querySelector('.side')?.innerText.replace(/\n+/g, ' | '));
    let out = `TOPBAR: ${top}\nSIDE: ${side}\nTITLE: ${await o.p.title()}\n\n=== espace ===\n${await o.texte()}`;
    await o.shot(`accueil-${tag}`, { fullPage: true });
    for (const v of (h === '21:00' ? ['moi', 'planning', 'suivi', 'documents', 'messages', 'mesgardes', 'aide'] : ['moi'])) {
      if (!(await o.nav(v))) { out += `\n\n=== ${v} : ABSENT DU MENU ===`; continue; }
      out += `\n\n=== ${v} === (title ${await o.p.title()})\n${await o.texte()}`;
      if (h === '21:00') await o.shot(`${v}-${tag}`, { fullPage: true });
    }
    if (h === '21:00') {
      await o.nav('demandes');
      for (const t of ['souhaits', 'absences', 'remplacements']) {
        await o.p.locator(`#dem-${t}`).click(); await o.p.waitForTimeout(400);
        out += `\n\n=== demandes/${t} ===\n${await o.texte()}`;
        await o.shot(`demandes-${t}-${tag}`, { fullPage: true });
      }
      // Compte
      await o.p.locator('.compte-btn').click(); await o.p.waitForTimeout(200);
      out += `\n\n=== menu compte ===\n${await o.p.evaluate(() => document.querySelector('.compte-btn + .menu, [data-tour="compte"] ~ .menu')?.innerText)}`;
      await o.p.getByRole('button', { name: 'Mon compte' }).click(); await o.p.waitForTimeout(500);
      out += `\n\n=== compte === (title ${await o.p.title()})\n${await o.texte()}`;
      await o.shot(`compte-${tag}`, { fullPage: true });
      // cloche
      await o.p.locator('.outils .top-ico').first().click(); await o.p.waitForTimeout(300);
      out += `\n\n=== cloche ===\n${await o.p.evaluate(() => document.querySelector('.menu.cloche')?.innerText)}`;
      await o.p.keyboard.press('Escape');
    }
    out += `\n\nERREURS: ${JSON.stringify(o.errs)}`;
    o.ecrire(`textes/${tag}.txt`, out);
    console.log(tag, 'ok', o.errs.length);
    await o.ctx.close();
  }
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
