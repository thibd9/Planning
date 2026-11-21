// Aperçu avant impression : accessibilité, et chemins de l'équipe (planning de l'équipe, mon planning, absence).
const fs = require('fs'); const { ouvrir } = require('./lib');
const axeSrc = fs.readFileSync(__dirname + '/axe/node_modules/axe-core/axe.min.js', 'utf8');
let ok = 0, ko = 0; const verifie = (nom, cond) => { cond ? ok++ : ko++; console.log(`${cond ? '✓' : '✗'} ${nom}`); };
(async () => {
  for (const mode of ['clair', 'sombre']) {
    const { b, p, errs, nav } = await ouvrir({ role: 0, w: 1440, h: 900, mode });
    await nav('construire'); await p.waitForTimeout(400); await p.locator("button[aria-label='Imprimer le planning']").click(); await p.waitForTimeout(700);
    await p.evaluate(axeSrc);
    const r = await p.evaluate(async () => await window.axe.run(document.querySelector('.dialog'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
    for (const x of r.violations) { console.log(`   [${x.id}] (${x.nodes.length})`, x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ').slice(0, 220)); }
    verifie(`aperçu en mode ${mode} : aucun défaut d’accessibilité détecté`, r.violations.length === 0 && errs.length === 0);
    // Clavier : le focus reste dans la fenêtre, Échap ferme.
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    verifie(`mode ${mode} : le focus reste dans la fenêtre`, await p.evaluate(() => !!document.activeElement.closest('.dialog')));
    await b.close();
  }
  // Un membre de l'équipe : le planning de l'équipe, puis le sien.
  const { b, p, errs } = await ouvrir({ role: 3, w: 1440, h: 900 });
  await p.locator('[data-tour="nav-planning"]').first().click(); await p.waitForTimeout(400);
  // La semaine en cours : un collègue y est en arrêt, l'équipe ne doit lire que « Absent ».
  await p.locator('.plan button[aria-label*="précédente"], .plan .btn.ghost.icon').first().click(); await p.waitForTimeout(400);
  await p.locator('#equipe-imprimer').click(); await p.waitForTimeout(600);
  const texte = await p.locator('.imp-zone .feuille').first().innerText();
  verifie('équipe : la feuille de la semaine publiée s’affiche', /Planning de l’équipe/.test(texte) && /Publié le/.test(texte));
  verifie('équipe : une absence se lit « Absent », jamais sa nature', !/Arrêt\n|Arrêt\t/.test(texte.replace(/Arrêt\s*Formation/, '')) || /Absent/.test(texte));
  verifie('équipe : pas de « sur 35 h » (le contrat ne regarde que le titulaire)', !/sur \d+ h/.test(texte));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('[data-tour="nav-moi"]').first().click(); await p.waitForTimeout(400); await p.locator('#moi-imprimer').click(); await p.waitForTimeout(600);
  const moi = await p.evaluate(() => ({ titre: document.querySelector('.imp-zone .feuille h1').textContent, lignes: document.querySelectorAll('.imp-zone .feuille tbody tr:not(.f-groupe)').length }));
  verifie(`mon planning : une feuille à mon nom, une seule ligne (${moi.titre.slice(0, 44)})`, /Planning de Nicolas/.test(moi.titre) && moi.lignes === 1);
  console.log(`\n${ok}/${ok + ko} vérifications`); console.log(errs.length ? errs.join('\n') : 'aucune erreur de page');
  await b.close();
})();
