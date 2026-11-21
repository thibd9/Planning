import { beforeEach, describe, it } from 'vitest';
import { rmSync } from 'node:fs';
import { addDays, mondayOf } from '/home/user/releve-planning/src/domain/time';
import type { Shift } from '/home/user/releve-planning/src/domain/types';
import { changementsSemaine } from '/home/user/releve-planning/src/engine/publish';
import { validateWeek } from '/home/user/releve-planning/src/engine/validate';
import { optionsReparation } from '/home/user/releve-planning/src/engine/repair';
import { useStore } from '/home/user/releve-planning/src/store/store';
import { DOSSIER, H, constat } from './aide';

rmSync(`${DOSSIER}/publication.jsonl`, { force: true });
const F = 'publication';
const s = (): ReturnType<typeof useStore.getState> => useStore.getState();
const publie = (personId: string, date: string): Shift[] => (s().data.semaines[mondayOf(date)]?.snapshot ?? []).filter((x) => x.personId === personId && x.date === date);
const reel = (personId: string, date: string): Shift[] => s().data.shifts.filter((x) => x.personId === personId && x.date === date);
const txt = (l: Shift[]): string => l.map((x) => `${x.start / 60}-${x.end / 60}${x.activite !== 'comptoir' ? ' ' + x.activite : ''}`).sort().join(' + ') || 'repos';
const ecarts = (): string[] =>
  Object.keys(s().data.semaines)
    .filter((m) => s().data.semaines[m].statut === 'publie')
    .flatMap((m) => changementsSemaine(s().data, m).map((c) => `${c.personId} ${c.date}`));

beforeEach(() => {
  s().chargerExemple(true);
  s().setActeur('p_helene');
});

describe('4. Publication et répercussions', () => {
  it('une retouche reste un brouillon', () => {
    const lundi = addDays(mondayOf(s().today), 7);
    const p = s().data.shifts.find((x) => x.personId === 'p_ines' && x.date >= lundi && x.date <= addDays(lundi, 5))!;
    const avant = txt(publie('p_ines', p.date));
    s().saveShift({ ...p, end: p.end - 30 });
    constat(F, { id: 'PU1', regle: 'store.saveShift', scenario: `Inès, ${p.date} (semaine publiée) : poste raccourci de 30 min dans la grille`, attendu: 'version publiée inchangée ; 1 écart en attente de « Publier »', obtenu: `publié ${avant} → ${txt(publie('p_ines', p.date))} ; écarts ${ecarts().join(', ')}`, ok: txt(publie('p_ines', p.date)) === avant && ecarts().length === 1 });
    for (const [nom, f] of [
      ['moveShift', () => s().moveShift(p.id, 'p_jules', p.date)],
      ['deleteShift', () => s().deleteShift(p.id)],
      ['poserRepos', () => s().poserRepos('p_ines', p.date)],
      ['viderSemaine', () => s().viderSemaine(lundi)],
    ] as const) {
      s().chargerExemple(true);
      s().setActeur('p_helene');
      const snap = JSON.stringify(s().data.semaines[lundi].snapshot);
      f();
      constat(F, { id: `PU1-${nom}`, regle: `store.${nom}`, scenario: `${nom} sur la semaine publiée du ${lundi}`, attendu: 'version publiée inchangée', obtenu: JSON.stringify(s().data.semaines[lundi].snapshot) === snap ? 'inchangée' : 'MODIFIÉE', ok: JSON.stringify(s().data.semaines[lundi].snapshot) === snap });
    }
  });

  it('une décision met à jour la version publiée sans republier, et seulement elle', () => {
    const lundi = addDays(mondayOf(s().today), 7);
    const p = s().data.shifts.find((x) => x.personId === 'p_ines' && x.date >= lundi && x.date <= addDays(lundi, 5))!;
    s().saveShift({ ...p, end: p.end - 30 });
    // Décision sur une autre personne, un autre jour.
    const jour = s().data.shifts.find((x) => x.personId === 'p_thomas' && x.date >= lundi && x.date <= addDays(lundi, 5) && x.date !== p.date)!.date;
    const pubAt = s().data.semaines[lundi].publishedAt;
    s().declarerAbsence({ personId: 'p_thomas', from: jour, to: jour, type: 'maladie', statut: 'approuvee' } as never);
    constat(F, { id: 'PU2', regle: 'publish.repercuter', scenario: `Brouillon en cours pour Inès (${p.date}), puis arrêt de Thomas le ${jour} enregistré`, attendu: 'Thomas retiré de la version publiée, sans republier ; la retouche d’Inès reste un brouillon', obtenu: `Thomas publié : ${txt(publie('p_thomas', jour))} ; Inès publiée : ${txt(publie('p_ines', p.date))} (brouillon ${txt(reel('p_ines', p.date))}) ; publishedAt ${pubAt === s().data.semaines[lundi].publishedAt ? 'inchangé' : 'changé'} ; écarts restants ${ecarts().join(', ')}`, ok: publie('p_thomas', jour).length === 0 && txt(publie('p_ines', p.date)) !== txt(reel('p_ines', p.date)) && ecarts().length === 1 });
  });

  it('une décision sur la même journée qu’un brouillon publie aussi le brouillon', () => {
    const lundi = addDays(mondayOf(s().today), 7);
    const p = s().data.shifts.find((x) => x.personId === 'p_ines' && x.date >= lundi && x.date <= addDays(lundi, 4) && x.end <= H(19, 30))!;
    const avant = txt(publie('p_ines', p.date));
    s().saveShift({ ...p, start: p.start + 60 });
    const notifAvant = s().data.notifications.length;
    s().planifierInventaire({ date: p.date, start: H(20), end: H(21), personnes: ['p_ines'] });
    const apres = txt(publie('p_ines', p.date));
    const notes = s().data.notifications.slice(0, s().data.notifications.length - notifAvant).map((n) => `${n.avant} → ${n.apres}`);
    constat(F, { id: 'PU3', regle: 'publish.repercuter', scenario: `Inès, ${p.date} : prise de poste retardée d’1 h en brouillon (non publiée), puis inventaire 20 h - 21 h planifié ce jour-là`, attendu: `version publiée = ${avant} + inventaire 20-21 ; la retouche reste un brouillon`, obtenu: `version publiée = ${apres} ; avis reçu par Inès : ${notes.join(' | ')}`, ok: apres.startsWith(avant.split(' + ')[0]) && ecarts().length === 1, note: 'repercuter() recopie toute la journée actuelle de la personne touchée, brouillon compris ; l’avis ne mentionne que l’inventaire.' });
  });

  it('régler un poste à couvrir publie les brouillons des personnes déplacées', () => {
    const d = s().data;
    let trouve = false;
    for (const t of d.trous.filter((x) => x.statut === 'ouvert')) {
      if (d.semaines[mondayOf(t.shift.date)]?.statut !== 'publie') continue;
      for (const o of optionsReparation(d, t.shift, s().today).options) {
        const qui = o.patch.ajouter.find((x) => x.personId !== t.shift.personId)?.personId;
        if (!qui) continue;
        // Brouillon sans rapport le même jour pour cette personne : une demi-heure d'administratif le soir.
        s().saveShift({ id: 'brouillon_admin', personId: qui, date: t.shift.date, start: H(20), end: H(20, 30), activite: 'admin', origine: 'manuel' });
        const avantDecision = ecarts().length;
        const o2 = optionsReparation(s().data, t.shift, s().today).options.find((x) => x.type === o.type && x.patch.ajouter.some((y) => y.personId === qui));
        if (!o2) continue;
        s().resoudreTrou(t.id, o2);
        const pub = publie(qui, t.shift.date);
        constat(F, { id: 'PU4', regle: 'publish.repercuter', scenario: `Poste à couvrir du ${t.shift.date} réglé par « ${o2.titre} » ; ${qui} avait en brouillon, le même jour, une demi-heure d’administratif 20 h - 20 h 30 sans rapport`, attendu: 'la décision est publiée ; la demi-heure d’administratif reste un brouillon', obtenu: `écarts en attente avant ${avantDecision}, après ${ecarts().length} ; journée publiée de ${qui} : ${txt(pub)}`, ok: !pub.some((x) => x.id === 'brouillon_admin') });
        trouve = true;
        break;
      }
      if (trouve) break;
    }
    if (!trouve) constat(F, { id: 'PU4', regle: 'publish.repercuter', scenario: 'Aucune option qui ajoute un poste à un collègue dans l’exemple', attendu: '-', obtenu: 'non testable', ok: true });
  });

  it('une décision sur une semaine non publiée ne publie rien', () => {
    const lundi = addDays(mondayOf(s().today), 28);
    s().copierSemaine(addDays(mondayOf(s().today), 7), lundi);
    const jour = addDays(lundi, 1);
    s().declarerAbsence({ personId: 'p_thomas', from: jour, to: jour, type: 'maladie', statut: 'approuvee' } as never);
    constat(F, { id: 'PU5', regle: 'publish.repercuter', scenario: `Semaine du ${lundi} en brouillon (copiée), arrêt de Thomas le ${jour}`, attendu: 'la semaine reste un brouillon, sans version publiée', obtenu: `statut ${s().data.semaines[lundi]?.statut ?? 'aucun'} ; snapshot ${s().data.semaines[lundi]?.snapshot ? 'présent' : 'absent'}`, ok: s().data.semaines[lundi]?.statut !== 'publie' && !s().data.semaines[lundi]?.snapshot });
  });

  it('avis de changement tardif', () => {
    const jour = addDays(s().today, 3);
    const n0 = s().data.notifications.length;
    s().planifierInventaire({ date: jour, start: H(8), end: H(8, 30), personnes: ['p_jules'] });
    const n = s().data.notifications.slice(0, s().data.notifications.length - n0);
    constat(F, { id: 'PU6', regle: 'notifications.tardif', scenario: `Inventaire posé pour Jules dans 3 jours (${jour})`, attendu: 'avis marqué « tardif » (moins de 7 jours)', obtenu: n.map((x) => `${x.apres} tardif=${x.tardif}`).join(' | '), ok: n.length > 0 && n.every((x) => x.tardif) });
  });

  it('« Annuler » après « Publier »', () => {
    const lundi = addDays(mondayOf(s().today), 21);
    s().copierSemaine(addDays(mondayOf(s().today), 7), lundi);
    s().publier(lundi, [], 0);
    const publieApres = s().data.semaines[lundi]?.statut;
    const journal = s().data.journal.length;
    s().undo();
    constat(F, { id: 'PU7', regle: 'store.undo', scenario: `Copier une semaine (${lundi}), la publier, puis « Annuler »`, attendu: 'à décider : soit la publication reste (elle n’est pas annulable), soit l’annulation le dit ; jamais une dépublication silencieuse', obtenu: `après publication : ${publieApres} ; après Annuler : statut ${s().data.semaines[lundi]?.statut ?? 'aucun'}, postes de la semaine ${s().data.shifts.filter((x) => x.date >= lundi && x.date <= addDays(lundi, 6)).length}, journal ${journal} → ${s().data.journal.length} entrées`, ok: s().data.semaines[lundi]?.statut === 'publie', note: 'publier() est un commit « non annulable » : il n’entre pas dans l’historique, si bien que « Annuler » revient à l’état d’avant la copie, publication comprise.' });
  });

  it('seuils des règles impératives', () => {
    const lundi = addDays(mondayOf(s().today), 7);
    const avant = validateWeek(s().data, lundi).filter((i) => i.gravite === 'bloquant').length;
    s().majRegle('repos.quotidien', { valeur: 2 });
    s().majRegle('duree.hebdo', { valeur: 70 });
    s().majRegle('duree.quotidienne', { valeur: -1 });
    const r = s().data.regles.filter((x) => ['repos.quotidien', 'duree.hebdo', 'duree.quotidienne'].includes(x.id)).map((x) => `${x.id}=${x.valeur}`);
    const apres = validateWeek(s().data, lundi).filter((i) => i.regle === 'duree.quotidienne').length;
    constat(F, { id: 'RG1', regle: 'store.majRegle', scenario: 'Repos quotidien ramené à 2 h, durée hebdomadaire à 70 h, durée quotidienne à -1 h (règles « obligatoires »)', attendu: 'refusé, ou borné au minimum légal (la page Règles dit « le planning ne peut pas l’enfreindre »)', obtenu: `enregistré : ${r.join(', ')} ; bloquants « durée quotidienne » sur la semaine : ${apres} (avant : ${avant} bloquants en tout)`, ok: !r.includes('repos.quotidien=2') });
    s().majRegle('pharmacie.presence', { active: false });
    const pres = validateWeek({ ...s().data, shifts: s().data.shifts.filter((x) => !['p_helene', 'p_antoine', 'p_karim', 'p_lea'].includes(x.personId)) }, lundi).filter((i) => i.regle === 'pharmacie.presence').length;
    constat(F, { id: 'RG2', regle: 'store.majRegle', scenario: 'Désactiver « Pharmacien présent » par l’action du magasin (l’écran masque la case), puis retirer tous les pharmaciens de la semaine', attendu: 'la règle impérative reste active', obtenu: `active=${s().data.regles.find((x) => x.id === 'pharmacie.presence')!.active} ; ${pres} constat(s) de présence`, ok: pres > 0, note: 'Pas de garde-fou dans majRegle ; seule l’interface empêche de décocher.' });
  });
});
