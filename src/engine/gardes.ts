import { regleActive, valeurRegle } from '../domain/rules';
import {
  absMin,
  addDays,
  dayIndex,
  decalageParis,
  estPremierMai,
  ferie,
  fmtDateCourt,
  fmtDuree,
  fmtHeure,
  fromDayIndex,
  joursOuvrablesEntre,
  weekday,
} from '../domain/time';
import type { AppData, Garde, ISODate, Person, Shift } from '../domain/types';
import { segmentsTravail, gardeAbs, gardeDuree } from './core';

export type TypeJour = 'ouvrable' | 'dimanche_ferie' | 'premier_mai';

export interface SegmentGarde {
  date: ISODate;
  /** Minutes réellement écoulées sur cette date, changement d'heure compris. */
  minutes: number;
  typeJour: TypeJour;
  libelleJour: string;
}

export interface VariableGarde {
  code: string;
  label: string;
  quantite: number;
  unite: string;
  /** Mois de rattachement « AAAA-MM » : une garde à cheval sur deux mois est ventilée. */
  mois: string;
  /** Montant en euros quand toutes les données nécessaires sont connues. */
  montant: number | null;
  regle: string;
}

export interface CalculGarde {
  /** Durée affichée à l'horloge. */
  dureeHorloge: number;
  /** Durée réellement écoulée (± 1 h la nuit d'un changement d'heure). */
  dureeReelle: number;
  changementHeure: number;
  segments: SegmentGarde[];
  variables: VariableGarde[];
  reposCompensateur: number;
  notes: string[];
}

function typeJour(date: ISODate): TypeJour {
  if (estPremierMai(date)) return 'premier_mai';
  if (weekday(date) === 6 || ferie(date)) return 'dimanche_ferie';
  return 'ouvrable';
}

/** Découpe une garde par date calendaire, en minutes réelles. */
export function segmentsGarde(g: Pick<Garde, 'date' | 'start' | 'end'>): SegmentGarde[] {
  const abs = gardeAbs(g);
  const out: SegmentGarde[] = [];
  let cursor = abs.start;
  while (cursor < abs.end) {
    const di = Math.floor(cursor / 1440);
    const date = fromDayIndex(di);
    const finJour = Math.min(abs.end, (di + 1) * 1440);
    const m1 = cursor - di * 1440;
    const m2 = finJour - di * 1440;
    // Sur une même date, le décalage ne change qu'à 2 h ou 3 h du matin.
    const reel = finJour - cursor - (decalageParis(date, Math.min(m2, 1439)) - decalageParis(date, m1));
    const f = ferie(date);
    out.push({
      date,
      minutes: reel,
      typeJour: typeJour(date),
      libelleJour: estPremierMai(date) ? '1er mai' : f ? `jour férié (${f})` : weekday(date) === 6 ? 'dimanche' : 'jour ouvrable',
    });
    cursor = finJour;
  }
  return out;
}

const h = (min: number): number => Math.round((min / 60) * 100) / 100;

/**
 * Variables de paie d'une garde, d'après l'article 4 de l'accord du 23 mars 2000.
 * Les quantités sont calculées ; les montants en euros ne le sont que si la valeur du point
 * et le taux horaire sont renseignés. À faire relire par un spécialiste de la paie officinale.
 */
export function variablesGarde(data: Pick<AppData, 'personnes' | 'officine' | 'regles'>, g: Garde): CalculGarde {
  const person = data.personnes.find((p) => p.id === g.personId);
  const segments = segmentsGarde(g);
  const dureeHorloge = gardeDuree(g);
  const dureeReelle = segments.reduce((t, s) => t + s.minutes, 0);
  const res: CalculGarde = {
    dureeHorloge,
    dureeReelle,
    changementHeure: dureeReelle - dureeHorloge,
    segments,
    variables: [],
    reposCompensateur: 0,
    notes: [],
  };
  if (res.changementHeure !== 0) {
    res.notes.push(
      `Changement d'heure pendant la garde : ${fmtDuree(dureeReelle)} réellement écoulées pour ${fmtDuree(
        dureeHorloge,
      )} à l'horloge.`,
    );
  }
  if (!person) {
    res.notes.push('Personne n’est encore affecté à cette garde : aucune variable calculée.');
    return res;
  }
  if (!person.salarie) {
    res.notes.push('Garde assurée par le titulaire : hors décompte salarié, aucune variable de paie.');
    return res;
  }

  const taux = person.tauxHoraire;
  const point = data.officine.valeurPoint;
  const tempsPlein = person.heuresHebdo >= 35;
  const equivalence = valeurRegle(data.regles, 'garde.equivalence', 25) / 100;
  const sujetion = valeurRegle(data.regles, 'garde.dimanche', 1.5);
  const astreinte = valeurRegle(data.regles, 'garde.astreinte', 10) / 100;
  const add = (v: Omit<VariableGarde, 'montant'> & { montant?: number | null }): void => {
    if (v.quantite <= 0) return;
    const prev = res.variables.find((x) => x.code === v.code && x.mois === v.mois);
    if (prev) {
      prev.quantite = Math.round((prev.quantite + v.quantite) * 100) / 100;
      if (prev.montant !== null && v.montant != null) prev.montant += v.montant;
      return;
    }
    res.variables.push({ ...v, montant: v.montant ?? null });
  };

  const minutesIntervention = g.interventions.reduce((t, i) => t + i.duree, 0);
  const moisDebut = g.date.slice(0, 7);

  for (const s of segments) {
    const mois = s.date.slice(0, 7);
    const heures = h(s.minutes);

    if (g.type === 'astreinte') {
      add({
        code: 'ASTREINTE',
        label: 'Heures d’astreinte à domicile (10 % du salaire horaire)',
        quantite: heures,
        unite: 'h',
        mois,
        montant: taux !== null ? heures * taux * astreinte : null,
        regle: 'garde.astreinte',
      });
      continue;
    }

    if (s.typeJour === 'premier_mai') {
      add({
        code: 'GARDE_1ER_MAI',
        label: 'Garde du 1er mai : indemnité égale au salaire correspondant',
        quantite: heures,
        unite: 'h',
        mois,
        montant: taux !== null ? heures * taux : null,
        regle: 'garde.dimanche',
      });
      res.reposCompensateur += s.minutes;
    } else if (s.typeJour === 'dimanche_ferie') {
      add({
        code: 'SUJETION_DIM_FERIE',
        label: `Indemnité de sujétion dimanche ou jour férié (${sujetion.toLocaleString('fr-FR')} point par heure)`,
        quantite: Math.round(heures * sujetion * 100) / 100,
        unite: 'points',
        mois,
        montant: point !== null ? heures * sujetion * point : null,
        regle: 'garde.dimanche',
      });
      res.reposCompensateur += s.minutes;
    }

    if (g.type === 'volets_ouverts') {
      add({
        code: 'GARDE_VO',
        label: 'Garde à volets ouverts : travail effectif',
        quantite: heures,
        unite: 'h',
        mois,
        montant: taux !== null ? heures * taux : null,
        regle: 'garde.nuit',
      });
    } else if (s.typeJour === 'ouvrable') {
      if (tempsPlein) {
        add({
          code: 'GARDE_VF_EQUIV',
          label: `Garde à volets fermés : heures d’équivalence (${Math.round(equivalence * 100)} % du temps passé)`,
          quantite: h(s.minutes * equivalence),
          unite: 'h',
          mois,
          montant: taux !== null ? h(s.minutes * equivalence) * taux : null,
          regle: 'garde.equivalence',
        });
      } else {
        add({
          code: 'GARDE_VF_100',
          label: 'Garde à volets fermés, temps partiel : heures rémunérées à 100 %',
          quantite: heures,
          unite: 'h',
          mois,
          montant: taux !== null ? heures * taux : null,
          regle: 'garde.equivalence',
        });
      }
    } else {
      add({
        code: 'GARDE_VF_PRESENCE',
        label: 'Garde à volets fermés un dimanche ou jour férié : heures de présence',
        quantite: heures,
        unite: 'h',
        mois,
        regle: 'garde.dimanche',
      });
    }
  }

  if (g.type === 'astreinte' && minutesIntervention > 0) {
    add({
      code: 'ASTREINTE_INTERVENTION',
      label: 'Interventions pendant l’astreinte, trajet compris (100 %)',
      quantite: h(minutesIntervention),
      unite: 'h',
      mois: moisDebut,
      montant: taux !== null ? h(minutesIntervention) * taux : null,
      regle: 'garde.astreinte',
    });
  }
  if (g.type === 'volets_fermes' && g.interventions.length > 0) {
    add({
      code: 'GARDE_VF_DERANGEMENT',
      label: 'Indemnité spéciale pour dérangement (montant : barème FSPF)',
      quantite: g.interventions.length,
      unite: 'dérangement(s)',
      mois: moisDebut,
      regle: 'garde.equivalence',
    });
  }
  if (res.reposCompensateur > 0) {
    add({
      code: 'REPOS_COMPENSATEUR',
      label: 'Repos compensateur à positionner',
      quantite: h(res.reposCompensateur),
      unite: 'h',
      mois: moisDebut,
      regle: 'garde.dimanche',
    });
  }

  if (g.type === 'volets_fermes') res.notes.push('Volets fermés : les majorations de nuit ne sont pas dues.');
  if (g.type === 'volets_ouverts' && regleActive(data.regles, 'garde.nuit')) {
    res.notes.push('Volets ouverts : majorations de nuit à appliquer par le comptable (taux à confirmer).');
  }
  if (new Set(res.variables.map((v) => v.mois)).size > 1) {
    res.notes.push('La garde est à cheval sur deux mois : les variables sont ventilées par mois.');
  }
  if (point === null && res.variables.some((v) => v.unite === 'points')) {
    res.notes.push('Valeur du point non saisie : l’indemnité de sujétion est exprimée en points.');
  }
  return res;
}

// ----------------------------------------------------- Délai et repos

export interface DelaiGarde {
  ok: boolean;
  joursRestants: number;
  requis: string;
  message: string;
}

/** Délai de communication de la programmation d'une garde au salarié. */
export function delaiGarde(data: Pick<AppData, 'regles'>, g: Garde, person: Person | undefined, today: ISODate): DelaiGarde {
  const requisJours = valeurRegle(data.regles, 'garde.delai', 15);
  const depuis = g.communiqueLe ? g.communiqueLe.slice(0, 10) : today;
  const jours = dayIndex(g.date) - dayIndex(depuis);
  if (person && !person.salarie) {
    return { ok: true, joursRestants: jours, requis: 'aucun', message: 'Titulaire : aucun délai de prévenance.' };
  }
  if (g.exceptionnel) {
    const ouvrables = joursOuvrablesEntre(depuis, g.date);
    return {
      ok: ouvrables >= 2,
      joursRestants: jours,
      requis: '2 jours ouvrables',
      message:
        ouvrables >= 2
          ? `Circonstances exceptionnelles : ${ouvrables} jours ouvrables de prévenance.`
          : `Circonstances exceptionnelles : ${ouvrables} jour ouvrable de prévenance pour 2 requis. Accord du salarié à recueillir.`,
    };
  }
  return {
    ok: jours >= requisJours,
    joursRestants: jours,
    requis: `${requisJours} jours`,
    message:
      jours >= requisJours
        ? `Programmation communiquée ${jours} jours avant la garde.`
        : `Programmation communiquée ${Math.max(0, jours)} jour${jours > 1 ? 's' : ''} avant la garde, pour ${requisJours} requis.`,
  };
}

export interface ReposGarde {
  /** Fin de la période à protéger, en minutes absolues. */
  finOccupation: number;
  /** Reprise possible au plus tôt. */
  reprise: { date: ISODate; minute: number };
  /** Postes qui empiètent sur le repos avant ou après la garde. */
  conflits: { shift: Shift; manque: number; position: 'avant' | 'apres' | 'pendant' }[];
  texte: string;
}

/** Conséquences d'une garde sur le repos quotidien : quels postes doivent bouger ? */
export function reposApresGarde(data: AppData, g: Garde): ReposGarde | null {
  const person = data.personnes.find((p) => p.id === g.personId);
  if (!person || !person.salarie) return null;
  const repos = valeurRegle(data.regles, 'repos.quotidien', 11) * 60;
  const abs = gardeAbs(g);
  const periodes =
    g.type === 'astreinte'
      ? g.interventions.map((i) => ({ start: abs.start + i.offset, end: abs.start + i.offset + i.duree }))
      : [abs];
  if (!periodes.length) {
    return {
      finOccupation: abs.start,
      reprise: { date: g.date, minute: g.start },
      conflits: [],
      texte: 'Astreinte sans intervention : le repos n’est pas interrompu.',
    };
  }
  const debut = Math.min(...periodes.map((p) => p.start));
  const fin = Math.max(...periodes.map((p) => p.end));
  const conflits: ReposGarde['conflits'] = [];
  for (const s of data.shifts) {
    if (s.personId !== person.id) continue;
    if (Math.abs(dayIndex(s.date) - dayIndex(g.date)) > 2) continue;
    for (const seg of segmentsTravail(s)) {
      const a = absMin(s.date, seg.start);
      const b = absMin(s.date, seg.end);
      if (a < fin && debut < b) {
        conflits.push({ shift: s, manque: repos, position: 'pendant' });
        break;
      }
      if (a >= fin && a - fin < repos) {
        conflits.push({ shift: s, manque: repos - (a - fin), position: 'apres' });
        break;
      }
      if (b <= debut && debut - b < repos && s.date !== g.date) {
        conflits.push({ shift: s, manque: repos - (debut - b), position: 'avant' });
        break;
      }
    }
  }
  const repriseAbs = fin + repos;
  const reprise = { date: fromDayIndex(Math.floor(repriseAbs / 1440)), minute: repriseAbs % 1440 };
  return {
    finOccupation: fin,
    reprise,
    conflits,
    texte: `Reprise possible à partir de ${fmtDateCourt(reprise.date)} à ${fmtHeure(reprise.minute)} (${fmtDuree(
      repos,
    )} de repos).`,
  };
}

/** Absences approuvées ou demandées qui recouvrent une garde affectée. */
export function congesIncompatibles(data: AppData, g: Garde): boolean {
  if (!g.personId) return false;
  const fin = g.end > g.start ? g.date : addDays(g.date, 1);
  return data.absences.some(
    (a) => a.personId === g.personId && a.statut !== 'refusee' && a.from <= fin && g.date <= a.to,
  );
}

export type EtapeGarde = 'prevue' | 'affectee' | 'realisee' | 'repos' | 'validee';

/** Où en est la garde dans son parcours : prévue → affectée → réalisée → repos réglé → validée. */
export function etapeGarde(data: AppData, g: Garde, today: ISODate): EtapeGarde {
  if (!g.personId) return 'prevue';
  if (g.valideLe) return 'validee';
  const passee = dayIndex(g.date) < dayIndex(today);
  if (!passee) return 'affectee';
  const r = reposApresGarde(data, g);
  if (r && r.conflits.length) return 'realisee';
  return 'repos';
}

/** Importe un calendrier de garde collé depuis un tableur : « JJ/MM/AAAA;20:00;08:00;volets fermés ». */
export function parseCalendrierGardes(texte: string): { gardes: Omit<Garde, 'id'>[]; erreurs: string[] } {
  const gardes: Omit<Garde, 'id'>[] = [];
  const erreurs: string[] = [];
  texte
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((ligne, i) => {
      const c = ligne.split(/[;\t,]/).map((x) => x.trim());
      const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(c[0] ?? '') ?? null;
      const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c[0] ?? '');
      const t1 = /^(\d{1,2})[:h](\d{2})?$/.exec(c[1] ?? '');
      const t2 = /^(\d{1,2})[:h](\d{2})?$/.exec(c[2] ?? '');
      if ((!d && !iso) || !t1 || !t2) {
        if (i === 0 && /date/i.test(ligne)) return; // ligne d'en-tête
        erreurs.push(`Ligne ${i + 1} illisible : « ${ligne} »`);
        return;
      }
      const date = iso
        ? c[0]
        : `${d![3]}-${d![2].padStart(2, '0')}-${d![1].padStart(2, '0')}`;
      const lib = (c[3] ?? '').toLowerCase();
      const type = lib.includes('astreinte') ? 'astreinte' : lib.includes('ouvert') ? 'volets_ouverts' : 'volets_fermes';
      gardes.push({
        date,
        start: Number(t1[1]) * 60 + Number(t1[2] ?? 0),
        end: Number(t2[1]) * 60 + Number(t2[2] ?? 0),
        type,
        personId: null,
        interventions: [],
      });
    });
  return { gardes, erreurs };
}
