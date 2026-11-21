// Prévenir d'un retard (accueil, Mon planning) et « Retard ou absence » de la barre du haut, côté Nicolas puis Caroline.
const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 3 });
  const { p } = o; const log = [];
  const D = '.dialog';
  const etape = async (nom, fn) => { try { await fn(); } catch (e) { log.push(`!! ÉCHEC ${nom}: ${e.message.split('\n')[0].slice(0, 200)}`); await o.shot(`retard-echec-${nom}`); await p.keyboard.press('Escape').catch(() => {}); } };
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\n+/g, ' | ');
  const toast = async () => { await p.waitForTimeout(300); return p.locator('.toast').innerText().then((t) => t.replace(/\n+/g, ' ')).catch(() => '-'); };
  await etape('dialogue', async () => {
    await p.locator('#ret-prevenir').first().click(); await p.waitForTimeout(300);
    log.push('Dialogue : ' + await txt(D)); await o.shot('retard-1-dialogue');
    await p.locator('#ret-durees button', { hasText: '+ de 20 min' }).click(); await p.waitForTimeout(150);
    for (const v of ['0', '-15', '3', '500', '', '45']) { await p.locator('#ret-minutes').fill(v); await p.waitForTimeout(120); log.push(`  durée « ${v} » → ${await txt('#ret-arrivee')} ; champ=${await p.locator('#ret-minutes').inputValue()} ; bouton actif=${!(await p.locator('#ret-envoyer').isDisabled())}`); }
    await p.locator('#ret-minutes').fill('0'); await p.waitForTimeout(100); await o.shot('retard-2-zero');
    await p.locator('#ret-durees button', { hasText: '15 min' }).click();
    await p.locator('#ret-motifs button').first().click(); await p.locator('#ret-note').fill('Bus en retard');
    log.push('Effet : ' + ((await p.locator('#ret-effet').count()) ? await txt('#ret-effet') : '-'));
    await p.locator('#ret-envoyer').click(); log.push('Envoi 15 min : ' + await toast());
    log.push('État accueil : ' + await txt('.ret'));
    await o.shot('retard-3-annonce');
    await o.nav('moi'); log.push('État Mon planning : ' + await txt('.ret'));
    await p.locator('#ret-modifier').click(); await p.waitForTimeout(300);
    log.push('Modifier, titre : ' + await txt(`${D} h2, ${D} .dialog-titre`).catch(() => '?') + ' ; sélection : ' + (await p.locator('#ret-durees button[aria-pressed="true"]').allInnerTexts()).join(','));
    await p.locator('#ret-durees button', { hasText: '+ de 20 min' }).click(); await p.locator('#ret-minutes').fill('30'); await p.locator('#ret-envoyer').click(); log.push('Correction 30 min : ' + await toast());
    log.push('État : ' + await txt('.ret'));
    await p.locator('#ret-annuler').click(); log.push('Je serai à l’heure : ' + await toast()); log.push('État : ' + await txt('.ret'));
    await p.locator('#ret-prevenir').click(); await p.waitForTimeout(200); await p.locator('#ret-envoyer').dblclick().catch(() => {}); await p.waitForTimeout(300);
  });
  // Barre du haut
  await etape('signaler-retard', async () => {
    await p.locator('#top-signaler').click(); await p.waitForTimeout(300);
    log.push('\nSignaler (vide) : bouton « ' + await p.locator('#sg-confirmer').innerText() + ' » grisé=' + await p.locator('#sg-confirmer').isDisabled());
    await p.locator('label[for="sg-retard"]').click(); await p.waitForTimeout(150);
    log.push('Signaler retard : ' + await txt(D)); await o.shot('retard-4-signaler-retard');
    await p.locator(`${D} button`, { hasText: 'Annuler' }).first().click();
  });
  await etape('signaler-absence', async () => {
    await p.locator('#top-signaler').click(); await p.waitForTimeout(300);
    await p.locator('label[for="sg-absence"]').click(); await p.waitForTimeout(150);
    await p.locator('#sg-du').fill('2026-11-10'); await p.waitForTimeout(150);
    log.push('Absence du 10/11 (passé) : du=' + await p.locator('#sg-du').inputValue() + ' au=' + await p.locator('#sg-au').inputValue() + ' ; ' + await txt('#sg-postes') + ' ; bouton grisé=' + await p.locator('#sg-confirmer').isDisabled());
    await p.locator('#sg-du').fill('2026-11-21'); await p.locator('#sg-au').fill('2026-11-20'); await p.waitForTimeout(150);
    log.push('Absence 21/11 → 20/11 : au affiché=' + await p.locator('#sg-au').inputValue() + ' ; ' + await txt('#sg-postes'));
    await p.locator('#sg-au').fill('2026-11-23'); await p.waitForTimeout(150);
    log.push('Absence 21/11 → 23/11 : ' + await txt('#sg-postes'));
    await p.locator('#sg-raisons button', { hasText: 'Accident' }).click(); await p.waitForTimeout(150);
    log.push('Accident : ' + await txt('#sg-accident'));
    await p.locator('#sg-acc-jour').fill('2026-11-25'); await p.waitForTimeout(100);
    log.push('Jour accident futur (25/11) accepté dans le champ : ' + await p.locator('#sg-acc-jour').inputValue());
    await o.shot('retard-5-accident', { fullPage: false });
    await p.locator('#sg-raisons button', { hasText: 'Maladie' }).click(); await p.locator('#sg-note').fill('Fièvre');
    await p.locator('#sg-confirmer').click(); log.push('Absence maladie envoyée : ' + await toast());
    await o.nav('demandes'); await p.locator('#dem-absences').click(); await p.waitForTimeout(300);
    log.push('Mes demandes après : ' + (await o.texte()).split('Nouvelle demande')[1]?.replace(/\n+/g, ' | ').slice(0, 900));
    await o.nav('moi'); log.push('Mon planning après signalement : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(300, 900));
  });
  await o.profil('Titulaire 1');
  await etape('caroline', async () => {
    log.push('\nCaroline tableau : ' + ((await o.texte()).match(/[^|]*retard[^|]*/gi) ?? []).slice(0, 5).join(' / '));
    await p.locator('.outils .top-ico').first().click(); await p.waitForTimeout(300); log.push('Caroline cloche : ' + (await txt('.menu.cloche')).slice(0, 1500)); await p.keyboard.press('Escape');
    await o.nav('messages'); await p.locator('.msg-fil', { hasText: 'Nicolas' }).click(); await p.waitForTimeout(300);
    log.push('Fil Nicolas : ' + (await txt('.fil')).slice(0, 1500));
    await o.shot('retard-6-caroline-messages');
    await o.nav('resoudre'); log.push('Résoudre : ' + (await txt('.ong-barre')));
  });
  const d = await o.data();
  log.push('\nRETARDS : ' + JSON.stringify(d.retards));
  log.push('ABSENCES Nicolas : ' + JSON.stringify(d.absences.filter((a) => a.personId === 'p_camille')));
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('retard.txt', log.join('\n'));
  console.log(log.join('\n'));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
