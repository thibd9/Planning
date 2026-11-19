import { JOURS, MOIS, addDays, weekday } from '../domain/time';
import type { AppData, ISODate, Person } from '../domain/types';

/**
 * Comprendre ce qui est tapé, tel que c'est tapé : sans accents, avec des abréviations, des lettres répétées et des
 * fautes de frappe. Rien ne part de l'appareil : ce sont des règles, pas un modèle de langage.
 */
export const simple = (t: string): string => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, ' ');

/** Les raccourcis du quotidien, remis en toutes lettres. */
const ABREGES: Record<string, string> = {
  bjr: 'bonjour', bjour: 'bonjour', slt: 'salut', cc: 'coucou', bsr: 'bonsoir', wesh: 'salut', yo: 'salut', hi: 'salut',
  stp: 's il te plait', svp: 's il vous plait', pk: 'pourquoi', pq: 'pourquoi', pkoi: 'pourquoi', pcq: 'parce que',
  mdr: 'haha', lol: 'haha', ptdr: 'haha', xd: 'haha', jtm: 'je t aime', jtd: 'je t adore', tkt: 'ne t inquiete pas',
  auj: 'aujourd hui', ajd: 'aujourd hui', aujourdhui: 'aujourd hui', dm1: 'demain', dem1: 'demain', demin: 'demain', '2m1': 'demain', '2main': 'demain', wk: 'week end', we: 'week end', weekend: 'week end',
  rdv: 'rendez vous', tlm: 'tout le monde', qqn: 'quelqu un', qq1: 'quelqu un', bcp: 'beaucoup', tjs: 'toujours', tjrs: 'toujours',
  dsl: 'desole', mrc: 'merci', mci: 'merci', thx: 'merci', thanks: 'merci', cv: 'ca va', jsp: 'je sais pas', nn: 'non', oe: 'oui', ouais: 'oui', ouai: 'oui', yes: 'oui', yep: 'oui', nope: 'non',
  pb: 'probleme', taf: 'travail', boulot: 'travail', bosse: 'travaille', bosser: 'travailler', bossent: 'travaillent', dispo: 'disponible', vacs: 'vacances',
  pharma: 'pharmacie', prepa: 'preparateur', hsup: 'heures supplementaires', aprem: 'apres midi', matinee: 'matin', mtn: 'maintenant', tt: 'tout', qd: 'quand', kan: 'quand', koi: 'quoi', ki: 'qui',
  chui: 'je suis', jsuis: 'je suis', chuis: 'je suis', jss: 'je suis', jpp: 'j en peux plus', oklm: 'tranquille', att: 'attends', dacc: 'd accord', dac: 'd accord', okay: 'ok',
};

/** Les émoticônes disent quelque chose : on les traduit avant de retirer la ponctuation. */
const EMOTICONES: [RegExp, string][] = [
  [/❤️|❤|💙|💚|💛|💜|🧡|😍|🥰|😘|💕|💖|<3/gu, ' je t aime '],
  [/😂|🤣|😆|😹/gu, ' haha '],
  [/👍|👌|🙏|🤝/gu, ' merci '],
  [/😢|😭|😞|😔|☹️|🙁/gu, ' je suis triste '],
  [/😡|🤬|😠/gu, ' je suis enerve '],
  [/😴|🥱|😩|😫/gu, ' je suis fatigue '],
  [/👋/gu, ' bonjour '],
  [/:\)|:-\)|:D|😀|😃|😊|🙂|😁/gu, ' content '],
  [/:\(|:-\(/gu, ' je suis triste '],
];

/** La phrase remise à plat : minuscules, sans accents ni ponctuation, raccourcis développés, entourée d'espaces. */
export function nettoyer(texte: string): string {
  let t = texte;
  for (const [signe, mots] of EMOTICONES) t = t.replace(signe, mots);
  const jetons = simple(t)
    .replace(/(\d)\s*h\s*(\d{2})\b/g, '$1h$2')
    // Les traits d'union tombent (« est-ce », « après-demain », « rendez-vous ») ; la barre reste entre deux chiffres (« 24/11 »).
    .replace(/[^a-z0-9/]+/g, ' ')
    .replace(/(?<![0-9])\/|\/(?![0-9])/g, ' ')
    // « saluuuut » : trois lettres identiques ou plus n'en font qu'une.
    .replace(/([a-z])\1{2,}/g, '$1')
    .split(/\s+/)
    .filter(Boolean)
    .map((m) => ABREGES[m] ?? m);
  return ` ${jetons.join(' ')} `;
}

/** Distance d'édition (échange de deux lettres voisines compris), arrêtée dès qu'elle dépasse `max`. */
export function distance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let avant: number[] = [];
  let ligne = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const suivante = [i];
    let mini = i;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(ligne[j] + 1, suivante[j - 1] + 1, ligne[j - 1] + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, avant[j - 2] + 1);
      suivante.push(v);
      if (v < mini) mini = v;
    }
    if (mini > max) return max + 1;
    avant = ligne;
    ligne = suivante;
  }
  return ligne[b.length];
}

/**
 * Deux mots sont voisins s'ils sont identiques, au pluriel près, ou à une faute de frappe près quand ils sont assez
 * longs pour qu'on ne les confonde pas avec un autre mot (« travaile » vaut « travaille », mais « cause » ne vaut pas « pause »).
 */
export function voisin(tape: string, attendu: string): boolean {
  if (tape === attendu) return true;
  if (attendu.length >= 3 && (tape === `${attendu}s` || tape === `${attendu}x` || `${tape}s` === attendu)) return true;
  const long = Math.max(tape.length, attendu.length);
  if (long < 6 || tape[0] !== attendu[0] || /\d/.test(attendu)) return false;
  return distance(tape, attendu, long >= 9 ? 2 : 1) <= (long >= 9 ? 2 : 1);
}

/** La phrase (déjà nettoyée) contient-elle ce motif, mot pour mot, aux fautes de frappe près ? */
export function contient(phrase: string, motif: string): boolean {
  if (phrase.includes(` ${motif} `)) return true;
  const mots = phrase.trim().split(' ');
  const cherches = motif.split(' ');
  for (let i = 0; i + cherches.length <= mots.length; i++) {
    if (cherches.every((m, k) => voisin(mots[i + k], m))) return true;
  }
  return false;
}
export const contientUn = (phrase: string, motifs: string[]): boolean => motifs.some((m) => contient(phrase, m));

const MOIS_SIMPLES = MOIS.map((m) => simple(m));

/**
 * Le jour dont parle la phrase, s'il y en a un : hier, aujourd'hui, ce soir, demain, après-demain, ce week-end,
 * un jour de la semaine (« samedi », « lundi prochain »), ou une date (« le 24 », « 24/11 », « 24 novembre »).
 */
export function jourCite(question: string, today: ISODate): ISODate | null {
  const q = nettoyer(question);
  const a = (...m: string[]): boolean => contientUn(q, m);
  if (a('apres demain', 'surlendemain')) return addDays(today, 2);
  if (a('avant hier')) return addDays(today, -2);
  if (a('demain')) return addDays(today, 1);
  if (a('hier')) return addDays(today, -1);
  if (a('aujourd hui', 'ce matin', 'ce midi', 'ce soir', 'cet apres midi', 'cette apres midi', 'maintenant', 'tout a l heure', 'la tout de suite', 'en ce moment')) return today;
  // « 24/11 » ou « 24 novembre » ; « le 24 » : le prochain 24.
  const chiffres = q.match(/ (\d{1,2})\/(\d{1,2}) /);
  const lettres = q.match(new RegExp(` (\\d{1,2}|1er) (${MOIS_SIMPLES.join('|')}) `));
  const nu = q.match(/ le (\d{1,2}|1er) /);
  const [annee, moisCourant, jourCourant] = today.split('-').map(Number);
  const iso = (an: number, mois: number, jour: number): ISODate | null => {
    const d = new Date(Date.UTC(an, mois - 1, jour));
    return d.getUTCMonth() === mois - 1 && jour >= 1 ? d.toISOString().slice(0, 10) : null;
  };
  if (chiffres || lettres) {
    const jour = Number((chiffres ?? lettres)![1].replace('1er', '1'));
    const mois = chiffres ? Number(chiffres[2]) : MOIS_SIMPLES.indexOf(lettres![2]) + 1;
    const cette = iso(annee, mois, jour);
    // Une date passée de plus de six mois désigne l'an prochain.
    return cette && cette < addDays(today, -183) ? iso(annee + 1, mois, jour) : cette;
  }
  if (nu) {
    const jour = Number(nu[1].replace('1er', '1'));
    return jour >= jourCourant ? iso(annee, moisCourant, jour) : iso(moisCourant === 12 ? annee + 1 : annee, (moisCourant % 12) + 1, jour);
  }
  if (a('week end', 'fin de semaine')) return addDays(today, (5 - weekday(today) + 7) % 7);
  const mots = q.trim().split(' ');
  const i = JOURS.findIndex((j) => mots.some((m) => voisin(m, j)));
  if (i < 0) return null;
  const ecart = (i - weekday(today) + 7) % 7;
  // « lundi prochain » dit un lundi : le même jour que le jour cité, c'est dans une semaine.
  return addDays(today, ecart === 0 && a('prochain', 'prochaine') ? 7 : ecart);
}

/** La semaine dont parle la phrase : 0 cette semaine, 1 la suivante ; null si elle n'en parle pas. */
export function semaineCitee(question: string): number | null {
  const q = nettoyer(question);
  if (contientUn(q, ['semaine prochaine', 'semaine suivante', 'semaine d apres'])) return 1;
  if (contientUn(q, ['cette semaine', 'la semaine', 'semaine en cours'])) return 0;
  return null;
}

/** Les mots courants qui sont aussi des prénoms ne désignent personne s'ils ne commencent pas par une majuscule. */
const AMBIGUS = new Set(['rose', 'marie', 'ange', 'aime', 'aimee', 'pierre', 'jean', 'marin', 'clement', 'constant', 'parfait', 'prudence', 'mai', 'avril', 'juin', 'noel', 'pascal', 'dimanche', 'sam', 'max', 'tom', 'eve', 'lea', 'luc']);

/** Les personnes de l'équipe nommées dans la phrase, par leur prénom ou leur nom, aux fautes de frappe près. */
export function personnesCitees(question: string, data: Pick<AppData, 'personnes'>): Person[] {
  const mots = nettoyer(question).trim().split(' ');
  const bruts = question.split(/[^\p{L}-]+/u);
  const trouve = (cle: string): boolean => {
    const c = simple(cle).replace(/[^a-z-]/g, '');
    if (c.length < 3) return false;
    if (AMBIGUS.has(c)) return bruts.some((b) => simple(b) === c && /^\p{Lu}/u.test(b));
    return mots.some((m) => (c.length <= 5 ? m === c : voisin(m, c)));
  };
  const parPrenom = data.personnes.filter((p) => trouve(p.prenom));
  if (parPrenom.length) return parPrenom;
  return data.personnes.filter((p) => trouve(p.nom));
}
