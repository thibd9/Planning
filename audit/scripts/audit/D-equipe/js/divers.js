// Mon compte, Mes documents, Messages et rendez-vous, Calendrier et impression, Mes gardes (Igor, Léa).
const { ouvrir } = require('../lib');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
(async () => {
  const o = await ouvrir({ role: 3 });
  const { p } = o; const log = [];
  const D = '.dialog';
  const etape = async (nom, fn) => { try { await fn(); } catch (e) { log.push(`!! ÉCHEC ${nom}: ${e.message.split('\n')[0].slice(0, 200)}`); await o.shot(`divers-echec-${nom}`); await p.keyboard.press('Escape').catch(() => {}); } };
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\n+/g, ' | ');
  const toast = async () => { await p.waitForTimeout(300); return p.locator('.toast').innerText().then((t) => t.replace(/\n+/g, ' ')).catch(() => '-'); };
  const compte = async () => { await p.locator('.compte-btn').click(); await p.waitForTimeout(200); await p.getByRole('button', { name: 'Mon compte' }).click(); await p.waitForTimeout(400); };
  // A. Compétences
  await etape('competences', async () => {
    await compte();
    await p.locator('[data-competence="preparations"]').click(); log.push('Ajout préparations : ' + await toast());
    const res = p.locator('[data-competence="trod"]');
    log.push('Tests angine (préparateur) : disabled=' + await res.isDisabled() + ' title=' + await res.getAttribute('title'));
    await res.click({ force: true, timeout: 2000 }).catch(() => {}); await p.waitForTimeout(200);
    const d = await o.data(); log.push('Compétences Nicolas : ' + d.personnes.find((x) => x.id === 'p_camille').competences.join(','));
    await o.shot('divers-1-competences', { fullPage: true });
    await o.nav('espace'); log.push('Accueil compétences : ' + ((await o.texte()).match(/MES COMPÉTENCES[\s\S]*?MES PROCHAINS/)?.[0] ?? '').replace(/\n+/g, ' | '));
  });
  // B. Mot de passe
  await etape('mdp', async () => {
    await compte();
    const essai = async (a, n, lib) => { await p.locator('#code-actuel').fill(a); await p.locator('#code-nouveau').fill(n); const dis = await p.locator('form button[type=submit]', { hasText: 'Changer' }).isDisabled(); if (!dis) await p.locator('form button[type=submit]', { hasText: 'Changer' }).click(); await p.waitForTimeout(250); log.push(`MDP ${lib} : bouton grisé=${dis} ; erreur=${await p.locator('.erreur').innerText().catch(() => '-')} ; toast=${await toast()} ; pastille=${await p.locator('#c-code').locator('xpath=ancestor::div[contains(@class,"card-head")]').innerText().then((t) => t.replace(/\n+/g, ' ')).catch(() => '?')}`); };
    await essai('', 'abcdef', 'actuel vide');
    await essai('faux', 'abcdef', 'actuel faux');
    await essai('demo', 'abc', 'nouveau trop court');
    await essai('demo', 'nicolas1', 'correct');
    await o.shot('divers-2-mdp');
    // déconnexion par le bouton de la page (sans étape)
    await p.locator('.page-compte button', { hasText: 'Se déconnecter' }).click(); await p.waitForTimeout(400);
    log.push('Après « Se déconnecter » (page compte) : ' + (await p.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 160) + ' | dialogue=' + (await p.locator(D).count()));
    await p.locator('#cx-identifiant').fill('nicolas.lesyndicaliste'); await p.locator('#cx-mdp').fill('demo'); await p.locator('button[type=submit]', { hasText: /Se connecter|Connexion|Entrer/ }).click(); await p.waitForTimeout(300);
    log.push('Connexion ancien mdp : ' + await p.locator('#cx-err').innerText().catch(() => 'pas d’erreur'));
    await p.locator('#cx-mdp').fill('nicolas1'); await p.locator('button[type=submit]', { hasText: /Se connecter|Connexion|Entrer/ }).click(); await p.waitForTimeout(500);
    log.push('Connexion nouveau mdp : ' + await p.title());
  });
  // C. Déconnexion par le menu
  await etape('deco-menu', async () => {
    await p.locator('.compte-btn').click(); await p.waitForTimeout(200); await p.locator('.menu button', { hasText: 'Se déconnecter' }).click(); await p.waitForTimeout(300);
    log.push('Déconnexion par le menu : ' + ((await p.locator(D).count()) ? await txt(D) : 'pas de dialogue'));
    await o.shot('divers-3-deconnexion-menu');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  });
  // D. Documents
  await etape('documents', async () => {
    await o.nav('documents'); await p.locator('button[role=tab]', { hasText: 'Mes fichiers' }).click(); await p.waitForTimeout(200);
    const input = p.locator('input[type=file]');
    await input.setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('bonjour') }); await p.waitForTimeout(300);
    log.push('Dépôt .txt : ' + await p.locator('[role=alert]').innerText().catch(() => 'aucun message'));
    await input.setInputFiles({ name: 'gros.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(700 * 1024, 32) }); await p.waitForTimeout(300);
    log.push('Dépôt PDF 700 Ko : ' + await p.locator('[role=alert]').innerText().catch(() => 'aucun message'));
    await p.locator('#doc-categorie').selectOption({ index: 0 });
    await input.setInputFiles({ name: 'arret.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(600); log.push('Dépôt PNG : ' + await toast());
    await p.locator('#doc-categorie').selectOption({ index: 2 }); await p.locator('#doc-partage').uncheck();
    await input.setInputFiles({ name: 'attestation.pdf', mimeType: 'application/pdf', buffer: PDF }); await p.waitForTimeout(600); log.push('Dépôt PDF privé : ' + await toast());
    log.push('Liste : ' + (await p.locator('.doc-liste').last().innerText()).replace(/\n+/g, ' | '));
    await o.shot('divers-4-documents', { fullPage: true });
    // le même fichier deux fois
    await input.setInputFiles({ name: 'arret.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(600);
    log.push('Même fichier redéposé, nb docs : ' + (await o.data()).documents?.length);
    const sup = p.locator('.doc-liste button[aria-label^="Supprimer"]').first(); await sup.click(); await p.waitForTimeout(300);
    log.push('Supprimer : dialogue=' + (await p.locator(D).count()) + ' ; ' + await toast() + ' ; nb docs=' + (await o.data()).documents?.length);
    await p.reload(); await p.waitForTimeout(800); await o.nav('documents'); await p.locator('button[role=tab]', { hasText: 'Mes fichiers' }).click(); await p.waitForTimeout(200);
    log.push('Après rechargement : ' + (await p.locator('.doc-liste').last().innerText().catch(() => '-')).replace(/\n+/g, ' | '));
    await p.locator('button[role=tab]', { hasText: 'Mes plannings' }).click(); await p.waitForTimeout(200);
    await p.locator('.doc-liste button', { hasText: 'Voir' }).nth(3).click(); await p.waitForTimeout(400);
    log.push('Voir une ancienne semaine : ' + await p.title() + ' / ' + await txt('.plan-bar'));
  });
  // E. Messages et rendez-vous
  await etape('messages', async () => {
    await o.nav('messages');
    log.push('Envoyer vide : grisé=' + await p.locator('form button[type=submit]', { hasText: 'Envoyer' }).isDisabled());
    await p.locator('#msg-texte').fill('   '); log.push('Envoyer espaces : grisé=' + await p.locator('form button[type=submit]', { hasText: 'Envoyer' }).isDisabled());
    await p.locator('.msg-fil', { hasText: 'Caroline' }).click(); await p.waitForTimeout(200);
    await p.locator('#msg-texte').fill('Bonjour, je confirme ma présence samedi.'); await p.locator('#msg-texte').press('Enter'); await p.waitForTimeout(200);
    log.push('Entrée dans le champ : ' + await p.locator('#msg-texte').inputValue().then((v) => (v ? `texte resté (« ${v.replace(/\n/g, '⏎')} »)` : 'envoyé')));
    await p.locator('form button[type=submit]', { hasText: 'Envoyer' }).click(); await p.waitForTimeout(200);
    log.push('Fil Caroline : ' + (await txt('.fil')).slice(-300));
    await p.locator('#rdv-demander').click(); await p.waitForTimeout(400);
    log.push('Dialogue RDV : ' + (await txt(D)).slice(0, 900));
    await o.shot('divers-5-rdv');
    log.push('Sujets : ' + (await p.locator('#rdv-sujet option').allInnerTexts()).join(' / '));
    await p.locator('#rdv-date').fill('2026-11-22'); await p.waitForTimeout(200);
    log.push('RDV dimanche 22 : ' + (await txt(D)).split('Quand ?')[1]?.slice(0, 500) + ' ; envoyer grisé=' + await p.locator('#rdv-envoyer').isDisabled());
    await p.locator('.rdv-idees button').first().click(); await p.waitForTimeout(200);
    await p.locator('#rdv-envoyer').click(); log.push('RDV envoyé : ' + await toast());
    log.push('Fil après RDV : ' + (await txt('.fil')).slice(-500));
  });
  await o.profil('Titulaire 1');
  await etape('caroline-rdv', async () => {
    await o.nav('messages'); await p.locator('.msg-fil', { hasText: 'Nicolas' }).click(); await p.waitForTimeout(300);
    const acc = p.locator('.fil button', { hasText: /Accepter/ }).first();
    log.push('\nCaroline carte RDV : ' + (await p.locator('.fil').innerText()).replace(/\n+/g, ' | ').slice(-500));
    if (await acc.count()) { await acc.click(); log.push('Caroline accepte : ' + await toast()); }
    await o.nav('documents'); log.push('Caroline documents (onglets) : ' + await txt('[role=tablist]'));
    await p.locator('button[role=tab]', { hasText: /équipe|Reçus|reçus/ }).first().click().catch(() => {}); await p.waitForTimeout(300);
    log.push('Caroline documents équipe : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 700));
  });
  await o.profil('Préparateur');
  await etape('nicolas-rdv', async () => {
    log.push('\nAccueil RDV : ' + ((await o.texte()).match(/Mes rendez-vous[\s\S]*?Mes raccourcis/)?.[0] ?? '').replace(/\n+/g, ' | '));
    await o.nav('moi'); log.push('Mon planning RDV : ' + (await p.locator('.rdv-puce').allInnerTexts()).join(' / '));
    // Calendrier et impression
    await p.locator('.seg button, [role=radiogroup] button, button', { hasText: 'Calendrier' }).first().click(); await p.waitForTimeout(300);
    log.push('Calendrier : ' + (await txt('.cal')).slice(0, 600));
    await o.shot('divers-6-calendrier', { fullPage: true });
    await p.getByRole('button', { name: 'Mois suivant' }).click(); await p.waitForTimeout(200); log.push('Calendrier décembre : ' + (await p.locator('.card-head').filter({ hasText: /décembre/i }).first().innerText()).replace(/\n+/g, ' | '));
    await p.getByRole('button', { name: 'Mois suivant' }).click(); await p.waitForTimeout(200); log.push('Calendrier janvier : ' + (await p.locator('.card-head').filter({ hasText: /janvier/i }).first().innerText()).replace(/\n+/g, ' | '));
    await p.locator('#moi-imprimer').click(); await p.waitForTimeout(600);
    log.push('Aperçu impression : ' + (await p.locator('.apercu, .impression, [role=dialog]').first().innerText().catch(() => '?')).replace(/\n+/g, ' | ').slice(0, 900));
    await o.shot('divers-7-impression');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await o.nav('planning');
    log.push('Planning équipe semaine affichée : ' + await txt('.plan-bar'));
    await p.getByRole('button', { name: 'Semaine précédente' }).click(); await p.waitForTimeout(200); log.push('Préc. : ' + await txt('.plan-bar'));
    for (let i = 0; i < 4; i++) await p.getByRole('button', { name: 'Semaine suivante' }).click();
    await p.waitForTimeout(200); log.push('+3 : ' + await txt('.plan-bar') + ' ; ' + (await o.texte()).match(/Cette semaine n’est pas encore publiée[^\n]*/)?.[0]);
    await o.shot('divers-8-planning-non-publie');
  });
  await o.profil('Pharmacien');
  await etape('igor-gardes', async () => {
    await o.nav('mesgardes');
    const carte = p.locator('article.card', { hasText: '24 octobre' });
    const h = carte.locator('input[type=time]'); const n = carte.locator('input[type=number]'); const b = carte.locator('button', { hasText: 'Déclarer' });
    for (const [hh, mm] of [['10:00', '20'], ['23:00', '0'], ['23:30', '999'], ['', '20']]) { await h.fill(hh); await n.fill(mm); await b.click(); await p.waitForTimeout(250); log.push(`Intervention ${hh} ${mm} min : ${await toast()} ; liste=${(await carte.locator('.chips').innerText().catch(() => '-')).replace(/\n+/g, ' ')}`); }
    await o.shot('divers-9-mesgardes', { fullPage: true });
    await p.locator('#recap-mois').fill('2026-10'); await p.waitForTimeout(300);
    log.push('Récap octobre : ' + await txt('#g-recap ~ *, section.card:has(#g-recap)'));
  });
  // Léa par la connexion
  await etape('lea', async () => {
    await p.locator('.compte-btn').click(); await p.locator('.menu button', { hasText: 'Se déconnecter' }).click(); await p.waitForTimeout(300);
    const partir = p.locator(`${D} button`, { hasText: /Se déconnecter|Partir|Quitter/ }).last(); if (await partir.count()) await partir.click(); await p.waitForTimeout(400);
    await p.locator('#cx-identifiant').fill('lea.fontaine'); await p.locator('#cx-mdp').fill('demo'); await p.locator('button[type=submit]').first().click(); await p.waitForTimeout(600);
    log.push('\nLéa : ' + await p.title() + ' ; ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 900));
    await o.nav('mesgardes'); log.push('Léa mes gardes : ' + (await o.texte()).replace(/\n+/g, ' | ').slice(0, 900));
    await o.shot('divers-10-lea-gardes', { fullPage: true });
    await o.nav('moi'); log.push('Léa garde dans Mon planning : ' + (await p.locator('.pill', { hasText: /Garde/ }).allInnerTexts()).join(' / '));
  });
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('divers.txt', log.join('\n'));
  console.log(log.join('\n').slice(0, 25000));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
