// Outils de l'audit D-equipe : ouvrir l'exemple sous un profil, à une heure fixée, naviguer, capturer, lire les données.
const { chromium } = require('playwright');
const fs = require('fs');
const DIR = __dirname;
const ROLES = ['Titulaire 1', 'Titulaire 2', 'Pharmacien', 'Préparateur', 'Animateur', 'Apprenti', 'Étudiant'];
exports.ROLES = ROLES;
exports.ouvrir = async ({ role = 0, w = 1440, h = 900, mode, heure = '2026-11-20T21:00:00', tactile = false, b: bExist } = {}) => {
  const b = bExist ?? (await chromium.launch());
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', deviceScaleFactor: 1, ...(tactile ? { hasTouch: true, isMobile: true } : {}) });
  if (heure) await ctx.clock.setFixedTime(new Date(heure));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message)); p.on('console', (m) => (m.type() === 'error') && errs.push(m.text().slice(0, 300)));
  p.on('dialog', (d) => { errs.push('DIALOG ' + d.message()); d.accept().catch(() => {}); });
  await p.goto('http://localhost:5180/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(role).click(); await p.waitForTimeout(700);
  if (mode) { await p.evaluate((m) => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste', 'sarah.lemoine', 'manon.girard', 'yanis.morel', 'lea.fontaine']) o[id] = { theme: 'ciel', texte: 'normal', mode: m }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }, mode); await p.reload(); await p.waitForTimeout(700); }
  const nav = async (v) => { const ok = await p.evaluate((v) => { const e = [...document.querySelectorAll(`[data-tour="nav-${v}"]`)][0]; if (!e) return false; e.click(); return true; }, v); await p.waitForTimeout(600); return ok; };
  const shot = (nom, opt = {}) => p.screenshot({ path: `${DIR}/captures/${nom}.png`, ...opt });
  const data = () => p.evaluate(() => { const r = JSON.parse(localStorage.getItem('releve.v3')); return r.officines ? r.officines[r.courante] : r; });
  const texte = (sel = '.content') => p.evaluate((s) => (document.querySelector(s) || document.body).innerText, sel);
  const profil = async (court) => { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.bandeau-test button', { hasText: court }).first().click(); await p.waitForTimeout(700); };
  const ecrire = (nom, contenu) => fs.writeFileSync(`${DIR}/${nom}`, typeof contenu === 'string' ? contenu : JSON.stringify(contenu, null, 1));
  return { b, ctx, p, errs, nav, shot, data, texte, profil, ecrire };
};
