// Appel à l'équipe vu par l'équipe : Thomas est absent samedi, Caroline prévient l'équipe.
const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 0 });
  const { p } = o; const log = [];
  const D = '.dialog';
  const etape = async (nom, fn) => { try { await fn(); } catch (e) { log.push(`!! ÉCHEC ${nom}: ${e.message.split('\n')[0].slice(0, 200)}`); await o.shot(`appel-echec-${nom}`); await p.keyboard.press('Escape').catch(() => {}); } };
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\n+/g, ' | ');
  const toast = async () => { await p.waitForTimeout(300); return p.locator('.toast').innerText().then((t) => t.replace(/\n+/g, ' ')).catch(() => '-'); };
  await etape('signaler', async () => {
    await p.locator('#top-signaler').click(); await p.waitForTimeout(300);
    await p.locator('#sg-qui').selectOption('p_camille'); await p.locator('label[for="sg-absence"]').click();
    await p.locator('#sg-du').fill('2026-11-26'); await p.locator('#sg-au').fill('2026-11-26'); await p.waitForTimeout(200);
    await p.locator('#sg-confirmer').click(); log.push('Absence Nicolas 26/11 : ' + await toast());
  });
  await o.nav('resoudre');
  await etape('appel', async () => {
    await p.locator('#onglet-absences').click(); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelectorAll('details.volet').forEach((d) => { d.open = true; })); await p.waitForTimeout(300);
    await o.shot('appel-0-resoudre', { fullPage: true });
    for (const sec of await p.locator('section.appel').all()) { const b = sec.locator('button', { hasText: /Prévenir/ }); if (await b.count()) { log.push('Avant : ' + (await sec.innerText()).replace(/\n+/g, ' | ').slice(0, 500)); await b.click(); log.push('Prévenu : ' + await toast()); } }
  });
  const d0 = await o.data();
  const ap = d0.remplacements.filter((r) => r.trouId && r.date === '2026-11-26');
  log.push('Sollicités : ' + JSON.stringify(ap.map((r) => r.sollicites)));
  for (const [n, r] of [['Sarah', 'Animateur'], ['Manon', 'Apprenti'], ['Yanis', 'Étudiant'], ['Nicolas', 'Préparateur'], ['Igor', 'Pharmacien']]) {
    await o.profil(r);
    await etape(`m-${n}`, async () => {
      log.push(`\n${n} prio accueil : ` + ((await p.locator('.tb-priorite').count()) ? await txt('.tb-priorite') : 'aucune'));
      await o.shot(`appel-accueil-${n}`);
      await p.locator('.outils .top-ico').first().click(); await p.waitForTimeout(300); log.push(`${n} cloche : ` + await txt('.menu.cloche')); await p.keyboard.press('Escape');
      await o.nav('moi');
      const carte = p.locator('[data-focus="aider"]');
      log.push(`${n} carte : ` + ((await carte.count()) ? await txt('[data-focus="aider"]') : 'aucune'));
      const a = carte.locator('.appel-recu').first();
      if (await a.count()) {
        await o.shot(`appel-carte-${n}`);
        if (n === 'Sarah') { await a.locator('button', { hasText: 'Je ne peux pas' }).click(); await p.waitForTimeout(300); log.push('Dialogue Sarah : ' + await txt(D)); await o.shot('appel-refus-sarah'); await p.locator('#refus-raison').selectOption({ index: 1 }); await p.locator('#refus-mot').fill('Je suis prise jeudi.'); await p.locator(`${D} button.btn.danger`).click(); log.push('Sarah non : ' + await toast()); log.push('Sarah carte après non : ' + await txt('[data-focus="aider"]')); await o.shot('appel-sarah-apres-non'); await a.locator('button', { hasText: 'Je peux' }).click(); log.push('Sarah Je peux : ' + await toast()); }
        if (n === 'Manon') { await a.locator('button', { hasText: 'Je ne peux pas' }).click(); await p.waitForTimeout(300); log.push('Dialogue : ' + await txt(D)); await o.shot('appel-refus-manon'); await p.locator('#refus-raison').selectOption({ index: 1 }); await p.locator('#refus-mot').fill('Je suis en cours samedi matin.'); await p.locator(`${D} button.btn.danger`).click(); log.push('Manon non : ' + await toast()); }
        log.push(`${n} carte après : ` + await txt('[data-focus="aider"]'));
      }
    });
  }
  await o.profil('Titulaire 1'); await o.nav('resoudre');
  await etape('confier', async () => {
    await p.locator('#onglet-absences').click(); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelectorAll('details.volet').forEach((d) => { d.open = true; })); await p.waitForTimeout(300);
    for (const sec of await p.locator('section.appel').all()) { const t = await sec.innerText(); if (/Sarah/.test(t)) { log.push('\nAppel côté titulaire : ' + t.replace(/\n+/g, ' | ').slice(0, 700)); const b = sec.locator('button', { hasText: /Confier/ }); if (await b.count()) { await b.first().click(); log.push('Confié : ' + await toast()); } } }
    await o.nav('messages'); log.push('Messages Caroline : ' + (await p.locator('.msg-fils').innerText()).replace(/\n+/g, ' | ').slice(0, 900));
  });
  for (const [n, r] of [['Sarah', 'Animateur'], ['Manon', 'Apprenti']]) {
    await o.profil(r);
    await etape(`ret-${n}`, async () => {
      await o.nav('moi');
      log.push(`\n${n} après : ` + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 1200));
      await o.shot(`appel-retour-${n}`, { fullPage: true });
      await o.nav('suivi'); log.push(`${n} suivi : ` + ((await o.texte()).match(/Mon compteur d’heures[\s\S]{0,120}/)?.[0] ?? '').replace(/\n+/g, ' | ') + ' … ' + ((await o.texte()).match(/Remplacements assurés\s*\n\s*\d+/)?.[0] ?? '').replace(/\n/g, ' '));
    });
  }
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('appel.txt', log.join('\n'));
  console.log(log.join('\n'));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
