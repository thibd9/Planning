// A4 : effet des réglages dans Construire (jour fermé, dimanche ouvert, samedi raccourci, poste type supprimé, fériés).
const { reprendre } = require('./outils2');
(async () => {
  const o = await reprendre(`${__dirname}/etat-a3.json`);
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  await o.fermerTour();
  const lireSemaine = async () => p.evaluate(() => {
    const h = [...document.querySelectorAll('.plan-grid .pg-h')].slice(1, 8);
    const grille = document.querySelector('.plan-grid');
    return h.map((c, i) => ({ jour: c.innerText.replace(/\n/g, ' ').slice(0, 28), ferme: c.classList.contains('closed'), plus: [...grille.querySelectorAll('button.add')].filter((b) => (b.getAttribute('aria-label') || '').endsWith(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i])).length }));
  });
  const controles = async () => (await texte('[data-tour="controles"]')).replace(/\n/g, ' | ').slice(0, 1400);
  await o.nav('construire'); await p.waitForTimeout(500);
  log('Semaine affichée :', await p.locator('.plan-grid').getAttribute('aria-label'));
  log('COLONNES :', JSON.stringify(await lireSemaine()));
  await cap('a4-01-construire-semaine48', { fullPage: true });
  // Semaine du 30 novembre : préparée par Solvéa avant la fermeture du jeudi.
  await p.locator('button[aria-label="Semaine suivante"]').click(); await p.waitForTimeout(600);
  log('Semaine :', await p.locator('.plan-grid').getAttribute('aria-label'));
  log('COLONNES :', JSON.stringify(await lireSemaine()));
  const d = await o.courante();
  const jeudi = d.shifts.filter((s) => s.date === '2026-12-03'); const samedi = d.shifts.filter((s) => s.date === '2026-12-05');
  log('Postes le jeudi 3 déc. (jour désormais fermé) :', jeudi.length, '| samedi 5 déc. (ouvert 9 h-13 h) :', samedi.map((s) => `${s.start / 60}-${s.end / 60}`).join(', '));
  log('CONTRÔLES :', await controles());
  await cap('a4-02-construire-decembre', { fullPage: true });
  // Le dialogue d'un poste : quels postes types sont proposés un lundi, un dimanche ?
  await p.locator('button[aria-label="Semaine précédente"]').click(); await p.waitForTimeout(500);
  const plusLundi = p.locator('button.add[aria-label$=" lundi"]').first();
  await plusLundi.click(); await p.waitForTimeout(400);
  log('Postes types proposés un lundi :', (await p.locator('.ptc-liste button').allInnerTexts()).map((t) => t.replace(/\n/g, ' ')).join(' / '));
  await cap('a4-03-dialogue-poste-lundi');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const plusDim = p.locator('button.add[aria-label$=" dimanche"]').first();
  if (await plusDim.count()) { await plusDim.click(); await p.waitForTimeout(400); log('Postes types proposés un dimanche :', (await p.locator('.ptc-liste button').allInnerTexts()).map((t) => t.replace(/\n/g, ' ')).join(' / ')); await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  // Les fériés : semaine du 21 décembre (Noël le vendredi).
  for (let i = 0; i < 4; i++) { await p.locator('button[aria-label="Semaine suivante"]').click(); await p.waitForTimeout(350); }
  log('Semaine :', await p.locator('.plan-grid').getAttribute('aria-label'));
  log('COLONNES (fermé les fériés) :', JSON.stringify(await lireSemaine()));
  const noel = (await o.courante()).shifts.filter((s) => s.date === '2026-12-25').length; log('Postes le 25 déc. :', noel);
  await o.nav('officine'); await p.locator('#acc-feries input[type=checkbox]').uncheck(); await p.waitForTimeout(200);
  await o.nav('construire'); await p.waitForTimeout(400);
  log('Semaine :', await p.locator('.plan-grid').getAttribute('aria-label'));
  log('COLONNES (ouvert les fériés) :', JSON.stringify(await lireSemaine()));
  await cap('a4-04-noel-ouvert', { fullPage: false });
  await o.nav('officine'); await p.locator('#acc-feries input[type=checkbox]').check(); await p.waitForTimeout(200);
  // Effectif minimum à 9 sur lundi-vendredi : effet sur les contrôles de la semaine préparée.
  await p.locator('.of-effectifs input').first().fill('9'); await p.waitForTimeout(200);
  await o.nav('construire'); await p.waitForTimeout(400);
  for (let i = 0; i < 4; i++) { await p.locator('button[aria-label="Semaine précédente"]').click(); await p.waitForTimeout(300); }
  log('Semaine :', await p.locator('.plan-grid').getAttribute('aria-label'));
  log('Ligne « Équipe au complet ? » :', (await p.locator('.plan-grid .pg-o').allInnerTexts()).slice(0, 9).map((x) => x.replace(/\n/g, ' ')).join(' / '));
  log('CONTRÔLES (min 9) :', await controles());
  await o.nav('officine'); await p.locator('.of-effectifs input').first().fill('2'); await p.waitForTimeout(150);
  await o.sauver('etat-a4.json');
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
