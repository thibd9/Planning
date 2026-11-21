// Le titulaire retouche une semaine publiée sans republier : que voit le préparateur ?
const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 0 });
  const { p } = o; const log = [];
  await o.nav('construire');
  log.push('Construire semaine: ' + (await p.locator('.week-nav .label').first().innerText()).replace(/\s+/g, ' '));
  const suppr = async (txt) => { const t = p.locator('button.tile', { hasText: txt }).first(); log.push(`tuile ${txt}: ${await t.count()}`); await t.click(); await p.waitForTimeout(400); await p.locator('.dialog button.btn.danger', { hasText: 'Supprimer' }).click(); await p.waitForTimeout(400); };
  await suppr('Nicolas L., lundi');
  await p.getByRole('button', { name: 'Semaine précédente' }).first().click(); await p.waitForTimeout(500);
  log.push('Construire semaine: ' + (await p.locator('.week-nav .label').first().innerText()).replace(/\s+/g, ' '));
  await suppr('Nicolas L., samedi');
  await o.shot('brouillon-0-construire');
  let d = await o.data();
  const nic = (arr) => arr.filter((s) => s.personId === 'p_camille' && s.date >= '2026-11-20' && s.date <= '2026-11-24').map((s) => s.date).join(',');
  log.push('shifts Nicolas 20-24: ' + nic(d.shifts));
  log.push('snapshot 16: ' + nic(d.semaines['2026-11-16'].snapshot) + ' | snapshot 23: ' + nic(d.semaines['2026-11-23'].snapshot) + ' | statuts ' + d.semaines['2026-11-16'].statut + '/' + d.semaines['2026-11-23'].statut);
  await o.profil('Préparateur');
  log.push('\n=== ACCUEIL Nicolas ===\n' + (await o.texte()).split('MON AGENDA')[0]);
  await o.shot('brouillon-1-accueil', { fullPage: true });
  await o.nav('moi');
  log.push('\n=== MON PLANNING (haut) ===\n' + (await o.texte()).slice(0, 900));
  await o.shot('brouillon-2-monplanning');
  await o.nav('planning');
  log.push('\n=== PLANNING EQUIPE ligne Nicolas ===\n' + (await p.locator('tr.moi').innerText()).replace(/\n+/g, ' | ').slice(0, 600));
  // Signaler une absence demain : combien de postes annoncés ?
  await p.locator('#top-signaler').click(); await p.waitForTimeout(300);
  await p.locator('label[for="sg-absence"]').click(); await p.waitForTimeout(200);
  await p.locator('#sg-du').fill('2026-11-21'); await p.locator('#sg-au').fill('2026-11-23'); await p.waitForTimeout(200);
  log.push('\n=== SIGNALER absence 21-23 ===\n' + await p.locator('#sg-postes').innerText());
  await p.locator('label[for="sg-retard"]').click(); await p.waitForTimeout(200);
  log.push('SIGNALER retard: ' + await p.locator('.dialog').innerText().then((t) => t.split('De combien')[1]?.slice(0, 300)));
  await o.shot('brouillon-3-signaler');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // Remplacement : quels postes et quel avis des collègues ?
  await o.nav('demandes'); await p.locator('#dem-remplacements').click(); await p.waitForTimeout(300);
  log.push('\n=== REMPLACER liste ===\n' + (await o.texte()).split('Quel poste')[1]?.slice(0, 800));
  await p.locator('.dm button', { hasText: /Me faire remplacer|Demande urgente/ }).first().click(); await p.waitForTimeout(500);
  log.push('\n=== DIALOGUE REMPLACER (lundi 23 retiré du brouillon) ===\n' + (await p.locator('.dialog').innerText()).slice(0, 1500));
  await o.shot('brouillon-4-remplacer');
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('brouillon.txt', log.join('\n'));
  console.log(log.join('\n'));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
