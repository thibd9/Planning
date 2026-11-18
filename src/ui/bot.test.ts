import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { addDays } from '../domain/time';
import { motifRefus, texteDeclin, texteRefus } from '../domain/refus';
import { libelleGarde, momentGarde, nomGarde } from '../domain/types';
import { avisCollegues } from '../engine/remplacement';
import { planifieMois } from '../engine/souhaits';
import { chercher, fichesPour, jourDe, repondre } from './bot';

const TODAY = '2026-11-18'; // un mercredi

describe('assistant : comprendre le jour demandé', () => {
  it('lit aujourd’hui, demain, après-demain et un jour de la semaine', () => {
    expect(jourDe('Qui travaille ?', TODAY)).toBe(TODAY);
    expect(jourDe('Qui travaille demain ?', TODAY)).toBe(addDays(TODAY, 1));
    expect(jourDe('et après-demain ?', TODAY)).toBe(addDays(TODAY, 2));
    expect(jourDe('Qui est là samedi ?', TODAY)).toBe('2026-11-21');
    // Le jour nommé est toujours à venir : « mardi » un mercredi, c'est mardi prochain.
    expect(jourDe('qui ouvre mardi', TODAY)).toBe('2026-11-24');
  });
});

describe('assistant : répondre d’après le planning', () => {
  const data = seed(TODAY);
  const titulaire = { data, today: TODAY, moi: 'p_helene', espace: 'responsable' as const, fiches: fichesPour('responsable', true) };
  const camille = { data, today: TODAY, moi: 'p_camille', espace: 'equipe' as const, fiches: fichesPour('equipe', true) };

  it('liste les personnes en poste un jour donné, avec leurs horaires', () => {
    const r = repondre('Qui travaille demain ?', titulaire);
    const attendus = new Set(data.shifts.filter((s) => s.date === addDays(TODAY, 1)).map((s) => s.personId));
    expect(attendus.size).toBeGreaterThan(0);
    expect(r.lignes).toHaveLength(attendus.size);
    expect(r.texte).toContain(`${attendus.size} personne`);
    expect(r.lignes?.every((l) => /\d+ h/.test(l))).toBe(true);
    expect(r.bouton?.label).toBe('Voir la journée');
  });

  it('donne à un membre de l’équipe son prochain poste publié, jamais un brouillon', () => {
    const r = repondre('Mon prochain poste ?', camille);
    expect(r.texte).toMatch(/^Votre prochain poste/);
    const sansPublication = { ...camille, data: { ...data, semaines: {} } };
    expect(repondre('Mon prochain poste ?', sansPublication).texte).toBe('Aucun poste publié à venir pour vous.');
  });

  it('ne montre les décisions en attente qu’au titulaire', () => {
    expect(repondre('Que dois-je décider ?', titulaire).texte).toMatch(/décision|Rien n’attend/);
    // L'équipe peut lire comment les décisions lui sont annoncées, jamais la liste de ce qui attend le titulaire.
    expect(repondre('Que dois-je décider ?', camille).texte).not.toMatch(/vous attend|Rien n’attend/);
  });

  it('retombe sur une fiche d’aide, puis sur des suggestions quand rien ne correspond', () => {
    const r = repondre('comment me faire remplacer', camille);
    expect(r.bouton?.label).toBe('Demander un remplacement');
    const inconnu = repondre('xyzzy', camille);
    expect(inconnu.texte).toMatch(/pas trouvé/);
    expect(inconnu.suites?.length).toBeGreaterThan(0);
    // Quand il ne sait pas, Solvi le dit avec le sourire et renvoie vers l'aide ou vers une personne.
    expect(inconnu).toMatchObject({ support: true, humeur: 'confus' });
    expect(inconnu.bouton?.label).toBe('Ouvrir l’aide');
  });

  it('tient une conversation courante, sans se faire passer pour ce qu’il n’est pas', () => {
    expect(repondre('Bonjour !', camille).texte).toMatch(/^Bonjour Nicolas/);
    expect(repondre('merci beaucoup', camille).humeur).toBe('joyeux');
    expect(repondre('Qui es-tu ?', camille).texte).toMatch(/Je suis Solvi.*règles/);
    expect(repondre('Tu es une intelligence artificielle ?', camille).texte).toMatch(/assistant à règles/);
    expect(repondre('raconte-moi une blague', camille).humeur).toBe('joyeux');
    expect(repondre('Quel jour sommes-nous ? on est quel jour', camille).texte).toMatch(/Nous sommes le/);
  });

  it('dit ses limites et renvoie vers une personne', () => {
    expect(repondre('Quelle dose de paracétamol pour ce médicament ?', camille).texte).toMatch(/aucun conseil médical/);
    expect(repondre('Combien pour une rupture conventionnelle ?', camille).texte).toMatch(/dépasse le planning/);
    expect(repondre('Il y a un bug, ça ne marche pas', camille)).toMatchObject({ support: true });
    // Une vraie question d'usage reste une question d'usage, même dite poliment.
    expect(repondre('Bonjour, comment me faire remplacer ?', camille).bouton?.label).toBe('Demander un remplacement');
  });

  it('réserve les fiches personnelles à l’équipe', () => {
    expect(fichesPour('responsable', true).some((f) => f.id === 'remplacer')).toBe(false);
    expect(fichesPour('equipe', true).some((f) => f.id === 'remplacer')).toBe(true);
    expect(fichesPour('equipe', false).some((f) => f.id === 'souhaits')).toBe(false);
    expect(chercher(fichesPour('equipe', true), 'poser un congé')[0]?.id).toBe('conge');
  });
});

describe('vue mois : heures planifiées face au contrat', () => {
  it('ne compte le contrat que sur les semaines construites et déduit les absences', () => {
    const data = seed(TODAY);
    const camille = data.personnes.find((p) => p.id === 'p_camille')!;
    const h = planifieMois(data, camille, '2026-11');
    expect(h.construit).toBe(true);
    expect(h.minutes).toBe(data.shifts.filter((s) => s.personId === 'p_camille' && s.date.startsWith('2026-11')).reduce((t, s) => t + s.end - s.start - ((s.pauseEnd ?? 0) - (s.pauseStart ?? 0)), 0));
    expect(h.cible).toBeGreaterThan(0);
    expect(h.cible).toBeLessThanOrEqual(camille.heuresHebdo * 60 * 5);
    // Un mois sans aucun planning : rien n'est dû, donc aucun « retard » affiché.
    const vide = planifieMois({ ...data, shifts: [] }, camille, '2026-11');
    expect(vide).toEqual({ minutes: 0, cible: 0, construit: false });
    // Une semaine d'absence approuvée réduit la cible d'autant.
    const absente = planifieMois({ ...data, absences: data.absences.concat({ id: 'a_test', personId: 'p_camille', from: '2026-11-09', to: '2026-11-13', type: 'conge', statut: 'approuvee', createdAt: '2026-11-01T08:00:00.000Z' }) }, camille, '2026-11');
    expect(h.cible - absente.cible).toBe(camille.heuresHebdo * 60);
  });
});

describe('gardes : de nuit, de jour, de 24 heures', () => {
  it('reconnaît le moment d’une garde d’après ses horaires', () => {
    expect(momentGarde({ start: 19 * 60 + 30, end: 8 * 60 + 30 })).toBe('nuit');
    expect(momentGarde({ start: 9 * 60, end: 19 * 60 })).toBe('jour');
    expect(momentGarde({ start: 8 * 60 + 30, end: 8 * 60 + 30 })).toBe('complet');
    expect(momentGarde({ start: 20 * 60, end: 8 * 60 })).toBe('nuit');
    expect(nomGarde({ start: 19 * 60, end: 9 * 60, type: 'astreinte' })).toBe('Astreinte de nuit');
    expect(libelleGarde({ start: 9 * 60, end: 19 * 60, type: 'volets_ouverts' })).toBe('Garde de jour · volets ouverts');
  });
});

describe('demander à un collègue de me remplacer', () => {
  const data = seed(TODAY, 2);
  const poste = data.shifts.filter((s) => s.personId === 'p_camille' && s.date >= '2026-11-25').sort((a, b) => a.date.localeCompare(b.date))[0];

  it('part d’un poste publié à venir', () => {
    expect(poste).toBeDefined();
  });

  it('ne propose que des collègues qui ont la qualification, et dit pourquoi les autres ne peuvent pas', () => {
    const avis = avisCollegues(data, poste);
    expect(avis.length).toBeGreaterThan(3);
    expect(avis.some((c) => c.personId === 'p_camille')).toBe(false);
    expect(avis.some((c) => c.ok)).toBe(true);
    for (const c of avis) {
      expect(c.ok).toBe(c.raisons.length === 0);
      expect(c.apres).toBeGreaterThan(c.avant);
    }
    // Les collègues possibles sont listés d'abord.
    const premierNon = avis.findIndex((c) => !c.ok);
    if (premierNon >= 0) expect(avis.slice(premierNon).every((c) => !c.ok)).toBe(true);
  });

  it('refuse un collègue dont les heures de la semaine dépasseraient le plafond', () => {
    // Plafond ramené très bas : plus aucun salarié ne peut reprendre le poste, pour une raison d'heures.
    const serre = { ...data, regles: data.regles.map((r) => (r.id === 'equipe.heuresMax' ? { ...r, active: true, valeur: 1 } : r)) };
    const avis = avisCollegues(serre, poste).filter((c) => c.contrat > 0);
    expect(avis.length).toBeGreaterThan(0);
    expect(avis.every((c) => !c.ok)).toBe(true);
    expect(avis.some((c) => c.raisons.some((r) => /Dépasserait/.test(r)))).toBe(true);
  });
});

describe('refuser avec une raison', () => {
  it('compose une phrase propre, avec ou sans raison, avec ou sans mot', () => {
    expect(motifRefus('', '')).toBe('');
    expect(motifRefus('Effectif insuffisant sur cette période', '')).toBe('Raison : effectif insuffisant sur cette période.');
    expect(motifRefus('', '  la semaine   suivante serait possible ')).toBe('la semaine suivante serait possible.');
    expect(texteRefus('(congé, du 3 au 7 mars)', motifRefus('Période de forte activité', 'Voyons en avril ?'))).toBe('Votre demande (congé, du 3 au 7 mars) n’est pas acceptée. Raison : période de forte activité. Voyons en avril ?');
    expect(texteDeclin('lun. 30 novembre, 8 h 30 – 13 h', '')).toBe('Je ne peux pas reprendre le poste du lun. 30 novembre, 8 h 30 – 13 h.');
  });
});
