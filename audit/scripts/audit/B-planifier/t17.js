const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav, bascule } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const toast = async () => (await texte('.toast')).join(' / ');
  await nav('construire'); await allerSemaine(p, '2026-12-07');
  // Poser un poste, recharger
  await p.getByRole('button', { name: 'Ajouter un poste à Nicolas L. lundi' }).click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(1200);
  const vue = await p.evaluate(() => document.querySelector('[data-tour^="nav-"][aria-current="page"]')?.getAttribute('data-tour'));
  log('RELOAD vue', vue, '| semaine', await texte('.week-nav .label'), '| poste conservé', (await data()).shifts.filter((s) => s.personId === 'p_camille' && s.date === '2026-12-07').length, '| annuler actif', await p.locator('[aria-label="Annuler la dernière manipulation"]').isEnabled().catch(() => 'n/a'));
  // Double clic sur « Placer dans le brouillon » puis double clic sur « Publier »
  await nav('construire'); await allerSemaine(p, '2026-12-07');
  await p.locator('.plan-bar [data-tour="proposer"]').click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] input[name=mode]').first().check(); await p.locator('[role=dialog] button', { hasText: 'Calculer les propositions' }).click();
  await p.waitForSelector('[role=dialog] .variant', { timeout: 60000 });
  const j0 = (await data()).journal.length;
  await p.locator('[role=dialog] button', { hasText: 'Placer dans le brouillon' }).dblclick().catch((e) => log('dblclick placer', e.message.slice(0, 60))); await p.waitForTimeout(400);
  log('DBLCLIC placer : entrées journal +', (await data()).journal.length - j0);
  await p.locator('[data-focus="publier"]').click(); await p.waitForTimeout(300);
  const j1 = (await data()).journal.length;
  await p.locator('[role=dialog] .dialog-foot button.primary').dblclick().catch((e) => log('dblclick publier', e.message.slice(0, 60))); await p.waitForTimeout(400);
  const d = await data();
  log('DBLCLIC publier : entrées journal +', d.journal.length - j1, d.journal.slice(0, 3).map((j) => j.titre));
  // Pierre (titulaire secondaire) publie la semaine du 14 décembre
  await bascule('Titulaire 2');
  await nav('construire'); await allerSemaine(p, '2026-12-14');
  await p.locator('.plan-bar [data-tour="proposer"]').click(); await p.waitForSelector('[role=dialog] .variant', { timeout: 60000 });
  await p.locator('[role=dialog] button', { hasText: 'Placer dans le brouillon' }).click(); await p.waitForTimeout(400);
  log('PIERRE après placer : pill', await texte('.plan-bar .pill'), '| toast', await toast());
  await p.locator('[data-focus="publier"]').click(); await p.waitForTimeout(300);
  log('PIERRE dlg publier', ((await dlg(p)) || '').slice(0, 300));
  await p.locator('[role=dialog] .dialog-foot button.primary').click(); await p.waitForTimeout(500);
  log('PIERRE après publier : toast', await toast(), '| pill', await texte('.plan-bar .pill'));
  let d2 = await data();
  log('PIERRE statut 14/12', d2.semaines['2026-12-14']?.statut, '| accords', JSON.stringify((d2.accords || []).map((a) => [a.action, a.auteur ?? a.de])).slice(0, 200));
  await bascule('Titulaire 1');
  log('CAROLINE cloche', await texte('.top-ico .pastille-n'), '| tableau priorité', (await texte('.tb-priorite'))[0]);
  await nav('resoudre');
  log('CAROLINE onglets', await texte('.ong-onglet'));
  const acc = p.locator('#onglet-accords');
  if (await acc.count()) { await acc.click(); await p.waitForTimeout(300); log('CAROLINE accords', (await texte('#panneau-decisions')).join(' ').replace(/\s+/g, ' ').slice(0, 600)); await shot('17-accords'); }
  log('errs', errs);
  await b.close();
})();
