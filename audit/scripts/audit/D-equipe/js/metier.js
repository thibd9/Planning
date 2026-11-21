const { ouvrir } = require('../lib');
(async () => {
  const log = [];
  const o = await ouvrir({ role: 4 }); const { p } = o;
  const essai = async (bouton) => { await p.locator('.esp-metier button', { hasText: bouton }).click(); await p.waitForTimeout(400); log.push(`« ${bouton} » → titre=${await p.locator('.dialog [id], .dialog h2').first().innerText({ timeout: 1500 }).catch(() => '?')} ; avec=${await p.locator('#rdv-avec').inputValue({ timeout: 1500 }).catch(() => '-')} ; sujet=${await p.locator('#rdv-sujet').inputValue({ timeout: 1500 }).catch(() => '-')} ; raison=${await p.locator('#demande-motif').inputValue({ timeout: 1500 }).catch(() => '-')} ; type=${await p.locator('.dialog label.field', { hasText: 'Type de besoin' }).locator('select').inputValue({ timeout: 1500 }).catch(() => '-')} ; texte=${(await p.locator('.dialog').innerText({ timeout: 1500 }).catch(() => '')).replace(/\n+/g, ' | ').slice(0, 160)}`); await p.keyboard.press('Escape'); await p.waitForTimeout(300); };
  await essai('Demander un bilan d’animation');
  await o.profil('Apprenti'); await essai('Demander un point avec mon tuteur'); await essai('Signaler mes jours d’école');
  await o.profil('Étudiant'); await essai('Signaler un cours ou un examen');
  await o.profil('Préparateur'); await essai('Parler d’une formation');
  console.log(log.join('\n')); o.ecrire('metier.txt', log.join('\n'));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
