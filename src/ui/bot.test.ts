import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { addDays } from '../domain/time';
import { motifRefus, texteDeclin, texteRefus } from '../domain/refus';
import { libelleGarde, momentGarde, nomGarde } from '../domain/types';
import { avisCollegues } from '../engine/remplacement';
import { planifieMois } from '../engine/souhaits';
import type { Memoire } from './bot';
import { calculette, chercher, fichesPour, jourDe, repondre } from './bot';
import { contient, distance, jourCite, nettoyer, personnesCitees, voisin } from './langue';

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

  it('dit au titulaire si l’équipe est assez nombreuse, et le refuse aux autres', () => {
    const r = repondre('Ai-je assez de préparateurs ?', titulaire);
    expect(r.texte).toMatch(/au comptoir à l’heure ordinaire/);
    expect(r.lignes?.some((l) => /^Pharmaciens : /.test(l))).toBe(true);
    expect(r.lignes?.some((l) => /^Préparateurs et comptoir : /.test(l))).toBe(true);
    expect(r.lignes?.at(-1)).toMatch(/repère, pas une norme/);
    expect(repondre('Est-ce qu’on est en sous-effectif ?', camille).texte).toMatch(/réservé aux titulaires/);
  });

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

describe('assistant : comprendre ce qui est tapé, tel que c’est tapé', () => {
  const data = seed(TODAY);
  it('remet à plat les raccourcis, les accents, les lettres répétées et les émoticônes', () => {
    expect(nettoyer('Bjr, qui bosse dem1 ?')).toBe(' bonjour qui travaille demain ');
    expect(nettoyer('Saluuuut !!!')).toBe(' salut ');
    expect(nettoyer('Est-ce que je travaille après-demain ?')).toBe(' est ce que je travaille apres demain ');
    expect(nettoyer('❤️')).toContain(' je t aime ');
    expect(nettoyer('de 8 h 30 à 16h30')).toBe(' de 8h30 a 16h30 ');
  });
  it('tolère une faute de frappe sur un mot assez long, jamais sur un mot court', () => {
    expect(distance('demian', 'demain')).toBe(1);
    expect(voisin('travaile', 'travaille')).toBe(true);
    expect(voisin('absant', 'absent')).toBe(true);
    expect(voisin('gardes', 'garde')).toBe(true);
    // « cause » n'est pas « pause », « porte » n'est pas « poste » : trop courts pour deviner.
    expect(voisin('cause', 'pause')).toBe(false);
    expect(voisin('porte', 'poste')).toBe(false);
    expect(contient(nettoyer('qui travail demian'), 'demain')).toBe(true);
  });
  it('lit les dates écrites de toutes les façons', () => {
    expect(jourCite('qui travaille le 24/11 ?', TODAY)).toBe('2026-11-24');
    expect(jourCite('et le 24 novembre', TODAY)).toBe('2026-11-24');
    expect(jourCite('le 3', TODAY)).toBe('2026-12-03');
    expect(jourCite('ce week-end', TODAY)).toBe('2026-11-21');
    expect(jourCite('hier', TODAY)).toBe('2026-11-17');
    expect(jourCite('ce soir', TODAY)).toBe(TODAY);
    expect(jourCite('mercredi prochain', TODAY)).toBe('2026-11-25');
    expect(jourCite('qui est absent ?', TODAY)).toBeNull();
  });
  it('reconnaît une personne par son prénom, sans accent et à une faute près', () => {
    expect(personnesCitees('Ines travaille quand ?', data).map((p) => p.id)).toEqual(['p_ines']);
    expect(personnesCitees('quand travaile nicolas', data).map((p) => p.id)).toEqual(['p_camille']);
    expect(personnesCitees('qui travaille demain', data)).toEqual([]);
  });
  it('calcule sans se tromper, et sans confondre une date avec une division', () => {
    expect(calculette('35 x 4,33')).toBe(151.55);
    expect(calculette('151,67 / 4')).toBe(37.92);
    expect(calculette('(12 + 3) x 2')).toBe(30);
    expect(calculette('bonjour')).toBeNull();
  });
});

describe('assistant : tenir une vraie conversation', () => {
  const data = seed(TODAY);
  const titulaire = { data, today: TODAY, moi: 'p_helene', espace: 'responsable' as const, fiches: fichesPour('responsable', true), heure: 600 };
  const nicolas = { data, today: TODAY, moi: 'p_camille', espace: 'equipe' as const, fiches: fichesPour('equipe', true), heure: 600 };
  /** Une conversation : chaque réponse laisse sa mémoire à la question suivante. */
  const fil = (c: typeof titulaire | typeof nicolas, questions: string[]): ReturnType<typeof repondre>[] => {
    let memoire: Memoire | undefined;
    return questions.map((q) => {
      const r = repondre(q, { ...c, memoire });
      memoire = r.memoire;
      return r;
    });
  };

  it('reçoit une marque d’affection pour ce qu’elle est, pas pour un merci', () => {
    for (const mot of ['je t’aime', 'Je vous adore !', 'jtm', '❤️']) {
      const r = repondre(mot, nicolas);
      expect(r.texte).not.toMatch(/Avec plaisir|Revenez quand vous voulez/);
      expect(r.texte).toMatch(/aime bien|réciproque|tiens à vous/);
      expect(r.humeur).toBe('excite');
    }
    const [, suite] = fil(nicolas, ['tu m’aimes ?', 'et toi ?']);
    expect(suite.texte).toMatch(/Moi aussi/);
  });
  it('écoute l’humeur, et propose quelque chose d’utile', () => {
    expect(repondre('je suis crevé', nicolas)).toMatchObject({ humeur: 'fatigue' });
    expect(repondre('je suis crevé', nicolas).texte).toMatch(/Courage, Nicolas.*jour sans poste/);
    expect(repondre('je suis stressée', nicolas).propose).toBe('Ma journée');
    expect(repondre('j’ai envie de mourir', nicolas).texte).toMatch(/3114/);
    expect(repondre('😂', nicolas).humeur).toBe('joyeux');
    expect(repondre('bonne nuit', nicolas).texte).toMatch(/À bientôt|à vous aussi/);
  });
  it('comprend les fautes de frappe et le langage du quotidien', () => {
    expect(repondre('bjr qui bosse dem1 ?', nicolas).texte).toMatch(/^Bonjour ! Demain, \d+ personnes? en poste/);
    expect(repondre('qui travail demian', nicolas).texte).toMatch(/^Demain/);
    expect(repondre('qui est absant', titulaire).texte).toMatch(/absence/);
  });
  it('suit le fil : « et samedi ? », « et Léa ? », « oui »', () => {
    const [a, b, c2] = fil(titulaire, ['Igor est là demain ?', 'et Léa ?', 'et samedi ?']);
    expect(a.texte).toMatch(/^Igor est absent demain/);
    expect(b.texte).toMatch(/^Léa travaille demain/);
    expect(c2.texte).toMatch(/^Léa .*sam\. 21 novembre/);
    const [bonjour, oui] = fil(titulaire, ['bonjour', 'oui']);
    expect(bonjour.texte).toMatch(/Voulez-vous le détail/);
    expect(oui.texte).toMatch(/décisions? vous attend/);
    // Un « oui » sans rien avant n'est pas une question perdue.
    expect(repondre('oui', nicolas).texte).toMatch(/Je vous écoute/);
    // Deux échecs de suite : Solvi change de ton et dit ce qu'il sait faire.
    const [, insiste] = fil(nicolas, ['xyzzy', 'blablabla truc']);
    expect(insiste.texte).toMatch(/Décidément/);
    expect(insiste.lignes?.length).toBeGreaterThan(2);
  });
  it('répond sur une personne, une journée, une pause, un repos, une semaine', () => {
    expect(repondre('quand travaille Inès ?', titulaire).texte).toBe('Les prochains postes d’Inès :');
    expect(repondre('qui est Thomas', nicolas).texte).toMatch(/Thomas .* : préparateur/);
    expect(repondre('je travaille samedi ?', nicolas).texte).toMatch(/^Vous travaillez sam\. 21 novembre : 9 h – 19 h/);
    expect(repondre('avec qui je travaille demain', nicolas).lignes?.length).toBeGreaterThan(1);
    expect(repondre('mon prochain jour de repos', nicolas).texte).toMatch(/jour sans poste : dim\. 22 novembre/);
    expect(repondre('combien d’heures je fais cette semaine', nicolas).texte).toMatch(/Semaine du lun\. 16 novembre : .* planifiées, pour un contrat de 35 h/);
    // Une absence acceptée après la publication : la personne n'est plus comptée parmi les présents.
    expect(repondre('où est Igor ?', nicolas).texte).toMatch(/^Igor est absent aujourd’hui/);
    expect(repondre('qui travaille demain', nicolas).lignes?.some((l) => l.startsWith('Igor'))).toBe(false);
    // La nature d'une absence ne regarde que la personne et ses titulaires.
    expect(repondre('où est Igor ?', nicolas).texte).not.toMatch(/arrêt/);
    expect(repondre('où est Igor ?', titulaire).texte).toMatch(/arrêt/);
  });
  it('répond sur la pharmacie : ouverture, pharmaciens, fériés, équipe, échéance', () => {
    expect(repondre('à quelle heure ouvre la pharmacie dimanche', nicolas).texte).toMatch(/la pharmacie est fermée/);
    expect(repondre('la pharmacie est ouverte samedi ?', nicolas).texte).toMatch(/ouverte de 9 h à 19 h/);
    expect(repondre('quel pharmacien est là demain', titulaire).texte).toMatch(/pharmaciens? :/);
    expect(repondre('qui ouvre demain', titulaire).texte).toMatch(/à l’ouverture/);
    expect(repondre('prochain jour férié', nicolas).texte).toMatch(/Noël, ven\. 25 décembre/);
    expect(repondre('combien sommes-nous dans l’équipe', titulaire).texte).toMatch(/L’équipe compte 11 personnes/);
    expect(repondre('échéance du planning du mois', titulaire).texte).toMatch(/décembre/);
    expect(repondre('échéance du planning du mois', nicolas).texte).not.toMatch(/dépassée/);
    expect(repondre('de 8h30 à 16h30 ça fait combien', titulaire).texte).toMatch(/cela fait 8 h/);
  });
  it('ouvre la bonne fenêtre quand il y a urgence, et emmène où on lui dit', () => {
    expect(repondre('je suis en retard', nicolas).bouton?.label).toBe('Prévenir d’un retard');
    expect(repondre('je suis malade', nicolas).bouton?.label).toBe('Signaler une absence');
    const accident = repondre('je me suis coupé la main', nicolas);
    expect(accident.texte).toMatch(/15 ou le 112/);
    expect(accident.bouton?.label).toBe('Signaler un accident du travail');
    expect(repondre('emmène-moi aux réglages', titulaire).bouton?.label).toBe('Ouvrir « Réglages »');
    expect(repondre('montre-moi le planning de l’équipe', nicolas).bouton?.label).toBe('Ouvrir « Planning de l’équipe »');
    // L'équipe n'a pas de rubrique « Réglages » : Solvi ne l'y emmène pas.
    expect(repondre('ouvre les réglages', nicolas).bouton?.label).not.toBe('Ouvrir « Réglages »');
  });
  it('explique le vocabulaire, et garde ses limites', () => {
    expect(repondre('c’est quoi une astreinte ?', nicolas).texte).toMatch(/^Astreinte\. Garde tenue à domicile/);
    expect(repondre('c’est quoi une garde à volets fermés', titulaire).texte).toMatch(/^Garde à volets fermés\./);
    expect(repondre('mes données sont-elles en sécurité ?', nicolas).texte).toMatch(/restent dans ce navigateur/);
    expect(repondre('je suis malade, quel médicament prendre ?', nicolas).texte).toMatch(/aucun conseil médical/);
    expect(repondre('que sais-tu faire ?', titulaire).lignes?.length).toBeGreaterThan(3);
  });
  it('fait le point du jour, selon le rôle', () => {
    const t = repondre('ma journée', titulaire);
    expect(t.lignes?.some((l) => /en poste aujourd’hui/.test(l))).toBe(true);
    expect(t.lignes?.some((l) => /décisions? à prendre/.test(l))).toBe(true);
    const e = repondre('quoi de neuf ?', nicolas);
    expect(e.lignes?.[0]).toMatch(/^Votre poste : 8 h 30 – 13 h/);
    expect(e.lignes?.some((l) => /décisions? à prendre/.test(l))).toBe(false);
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
