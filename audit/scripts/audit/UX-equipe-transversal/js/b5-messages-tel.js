// Messages au téléphone, proprement : largeur de la grille, bouton Envoyer atteignable ? envoi d'un message.
const { ouvrir } = require('../lib.js');
(async () => {
  const w = +(process.env.W || 390);
  const o = await ouvrir({ role: +(process.env.ROLE || 3), w, h: 800 }); const p = o.p;
  await o.nav('messages'); await p.waitForTimeout(500);
  const m = await p.evaluate(() => { const c = document.getElementById('contenu'); const grille = c.querySelector('.msg-fil')?.parentElement?.parentElement; const anc = []; for (let x = c.querySelector('textarea'); x && x !== c; x = x.parentElement) { const s = getComputedStyle(x); anc.push(`${x.tagName.toLowerCase()}.${String(x.className).slice(0, 25)} w=${Math.round(x.getBoundingClientRect().width)} disp=${s.display} gtc=${s.gridTemplateColumns?.slice(0, 40)} ox=${s.overflowX}`); } return { contenu: [c.scrollWidth, c.clientWidth, c.scrollLeft], html: document.documentElement.scrollWidth, anc }; });
  console.log(JSON.stringify(m, null, 1));
  await o.shot('b5-messages-tel-0');
  const ta = p.locator('#contenu textarea'); await ta.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await o.shot('b5-messages-tel-ecrire');
  await ta.fill('Bonjour à tous'); await p.waitForTimeout(200);
  const env = await p.evaluate(() => { const b = [...document.querySelectorAll('#contenu button')].find((e) => /Envoyer/.test(e.textContent)); const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const e = document.elementFromPoint(Math.min(x, innerWidth - 1), y); return { r: [r.left, r.right, r.top].map(Math.round), auPoint: e === b || b.contains(e), sl: document.getElementById('contenu').scrollLeft }; });
  console.log('envoyer', JSON.stringify(env));
  await o.shot('b5-messages-tel-rempli');
  // Un utilisateur au doigt : balayer horizontalement le contenu
  await p.evaluate(() => document.getElementById('contenu').scrollBy(400, 0)); await p.waitForTimeout(300);
  console.log('après balayage', await p.evaluate(() => [document.getElementById('contenu').scrollLeft, document.documentElement.scrollLeft, document.querySelector('.content')?.scrollLeft]));
  await o.shot('b5-messages-tel-balaye');
  console.log(o.errs); await o.b.close();
})();
