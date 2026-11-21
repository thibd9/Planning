// Document partagé reçu par la titulaire ; aperçu d'impression ; semaine non publiée ; Léa par la connexion.
const { ouvrir } = require('../lib');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const o = await ouvrir({ role: 3 });
  const { p } = o; const log = [];
  const D = '.dialog';
  const etape = async (nom, fn) => { try { await fn(); } catch (e) { log.push(`!! ÉCHEC ${nom}: ${e.message.split('\n')[0].slice(0, 200)}`); await o.shot(`divers2-echec-${nom}`); await p.keyboard.press('Escape').catch(() => {}); } };
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\n+/g, ' | ');
  await etape('doc', async () => {
    await o.nav('documents'); await p.locator('button[role=tab]', { hasText: 'Mes fichiers' }).click(); await p.waitForTimeout(200);
    await p.locator('#doc-categorie').selectOption('arret');
    await p.locator('input[type=file]').setInputFiles({ name: 'arret-maladie.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(600);
    log.push('Nicolas fichiers : ' + (await p.locator('.doc-liste').last().innerText()).replace(/\n+/g, ' | '));
    log.push('Partage : ' + JSON.stringify((await o.data()).documents.map((d) => [d.nom, d.categorie, d.partage])));
  });
  await etape('impression', async () => {
    await o.nav('moi'); await p.locator('#moi-imprimer').click(); await p.waitForTimeout(700);
    await o.shot('divers2-1-impression');
    log.push('Aperçu : ' + (await p.evaluate(() => { const e = document.querySelector('[class*="apercu"], [class*="impression"]'); return e ? e.className + ' :: ' + e.innerText.slice(0, 1200) : 'introuvable'; })).replace(/\n+/g, ' | '));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    log.push('Après Échap, aperçu encore là : ' + await p.evaluate(() => !!document.querySelector('[class*="apercu"]')));
  });
  await etape('non-publie', async () => {
    await o.nav('planning');
    for (let i = 0; i < 2; i++) await p.getByRole('button', { name: 'Semaine suivante' }).click();
    await p.waitForTimeout(300);
    log.push('Semaine +2 : ' + await txt('.plan-bar') + ' ; ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 500));
    log.push('Bouton Imprimer présent : ' + (await p.locator('#equipe-imprimer').count()));
    await o.shot('divers2-2-non-publie');
    await o.nav('moi'); log.push('Mon planning : ' + ((await o.texte()).match(/Semaine prochaine[\s\S]{0,200}/)?.[0] ?? '').replace(/\n+/g, ' | '));
  });
  await o.profil('Titulaire 1');
  await etape('caroline-doc', async () => {
    await o.nav('documents'); await p.locator('button[role=tab]', { hasText: 'Reçus' }).click(); await p.waitForTimeout(300);
    log.push('\nCaroline Reçus : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 600));
  });
  await etape('lea', async () => {
    await p.locator('.compte-btn').click(); await p.locator('.menu button', { hasText: 'Se déconnecter' }).click(); await p.waitForTimeout(300);
    if (await p.locator(D).count()) { log.push('Dialogue déconnexion Caroline : ' + await txt(D)); await p.locator(`${D} button`, { hasText: /quand même/ }).click(); await p.waitForTimeout(400); }
    await p.locator('#cx-identifiant').fill('lea.fontaine'); await p.locator('#cx-mdp').fill('demo'); await p.locator('button[type=submit]').first().click(); await p.waitForTimeout(700);
    log.push('\nLéa : ' + await p.title() + ' ; topbar=' + (await txt('.topbar')).slice(0, 200));
    log.push('Léa accueil : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 1200));
    await o.shot('divers2-3-lea-accueil', { fullPage: true });
    await o.nav('mesgardes'); log.push('Léa mes gardes : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 1200));
    await o.shot('divers2-4-lea-gardes', { fullPage: true });
    await o.nav('moi'); log.push('Léa garde dans Mon planning : ' + (await p.locator('.pill', { hasText: /arde/ }).allInnerTexts()).join(' / ') + ' ; dimanche 29 : ' + ((await o.texte()).match(/29\s*\n\s*Dimanche[\s\S]{0,200}/)?.[0] ?? 'absent').replace(/\n+/g, ' | '));
    await p.locator('#bt-ouvrir').click().catch(() => {}); await p.waitForTimeout(300); log.push('Menu test pour Léa : ' + ((await p.locator('.bandeau-test').count()) ? (await txt('.bandeau-test')).slice(0, 300) : 'absent'));
  });
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('divers2.txt', log.join('\n'));
  console.log(log.join('\n'));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
