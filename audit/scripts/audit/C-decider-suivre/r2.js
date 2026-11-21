// A : « Choisir » l'option conseillée sur la carte. B : « Appliquer mes choix » dans la fenêtre (3 jours, dont 2 passés).
const { ouvrir } = require('./lib');
const etat = async (data, label) => {
  const d = await data();
  const sh = (id, date) => d.shifts.filter((s) => s.personId === id && s.date === date).map((s) => `${s.start/60}-${s.end/60}${s.origine ? '/' + s.origine : ''}`).join(',');
  const snap = (m, id, date) => (d.semaines[m]?.snapshot ?? []).filter((s) => s.personId === id && s.date === date).map((s) => `${s.start/60}-${s.end/60}`).join(',');
  console.log(`== ${label}`);
  console.log(' trous', JSON.stringify(d.trous.map((t) => [t.shift.date, t.statut, t.resolution])));
  for (const date of ['2026-11-18', '2026-11-19', '2026-11-20']) console.log(` ${date} Pierre brouillon=[${sh('p_antoine', date)}] publié=[${snap('2026-11-16', 'p_antoine', date)}] | Léa=[${sh('p_lea', date)}] pub=[${snap('2026-11-16', 'p_lea', date)}] | Inès=[${sh('p_ines', date)}] pub=[${snap('2026-11-16','p_ines',date)}]`);
  console.log(' remplacements', JSON.stringify(d.remplacements.map((r) => [r.date, r.statut, r.trouId ? 'appel' : 'demande', r.remplacantId])));
  console.log(' notifs nouvelles', JSON.stringify(d.notifications.filter((n) => !n.luLe).map((n) => [n.personId, n.date, n.avant, n.apres, n.tardif])));
  console.log(' journal[0..2]', JSON.stringify(d.journal.slice(0, 3).map((j) => [j.type, j.titre, j.detail])));
  console.log(' annonces[0]', JSON.stringify((d.annonces ?? []).slice(0, 2).map((a) => [a.titre, a.pour, a.effets])));
  console.log(' messages', d.messages.length, JSON.stringify(d.messages.slice(2).map((m) => [m.de, m.a, m.texte.slice(0, 120)])));
};
(async () => {
  // A
  let o = await ouvrir({ role: 0 });
  await o.nav('resoudre');
  await o.p.locator('.options .option.reco button', { hasText: 'Choisir' }).click(); await o.p.waitForTimeout(700);
  console.log('TOAST', await o.p.evaluate(() => document.querySelector('.toast, .toasts, [class*=toast]')?.innerText));
  await o.shot('r2-A-apres-choisir');
  await etat(o.data, 'A après Choisir (Réaffecter Pierre)');
  console.log(' onglets', (await o.p.evaluate(() => [...document.querySelectorAll('.ong-onglet')].map((x) => x.innerText.replace(/\n/g, ' ')).join(' / '))));
  console.log('ERR', o.errs); await o.b.close();
  // B
  o = await ouvrir({ role: 0 });
  await o.nav('resoudre');
  await o.p.getByRole('button', { name: /Voir et choisir la solution/ }).click(); await o.p.waitForTimeout(600);
  await o.p.getByRole('button', { name: /Appliquer mes choix/ }).click(); await o.p.waitForTimeout(800);
  console.log('TOAST', await o.p.evaluate(() => document.querySelector('.toast, .toasts, [class*=toast]')?.innerText));
  await o.shot('r2-B-apres-appliquer');
  await etat(o.data, 'B après Appliquer mes choix (3 jours)');
  console.log('ERR', o.errs); await o.b.close();
})();
