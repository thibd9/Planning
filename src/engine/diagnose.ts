import { valeurRegle } from '../domain/rules';
import {
  JOURS,
  absMin,
  fmtDuree,
  fmtHeure,
  fmtJourMois,
  intersect,
  subtract,
  totalDuree,
  union,
  weekDates,
  weekday,
} from '../domain/time';
import type { AppData, ISODate, Interval, Person } from '../domain/types';
import { ABSENCE_LABEL, estPharmacien, nomCourt } from '../domain/types';
import { besoinsDe, equipeInterne, gardeAbs, ouverture, segmentsTravail } from './core';
import { validateWeek } from './validate';

/**
 * Quatre situations à ne jamais confondre :
 *  - impossible          : impossibilité démontrée avec les contraintes actuelles ;
 *  - donnees_manquantes  : le calcul ne peut pas aboutir faute d'informations ;
 *  - non_trouvee         : aucune solution trouvée dans le temps de calcul (ce n'est pas une preuve) ;
 *  - decouvert           : une solution existe, avec un créneau encore découvert.
 */
export type CasBlocage = 'impossible' | 'donnees_manquantes' | 'non_trouvee' | 'decouvert';

export interface Blocage {
  cas: CasBlocage;
  titre: string;
  message: string;
  date?: ISODate;
  start?: number;
  end?: number;
  /** Pourquoi chaque personne concernée ne peut pas couvrir la plage. */
  raisons: { personId: string; raison: string }[];
  /** Leviers proposés. Aucun ne consiste à assouplir une obligation légale. */
  leviers: string[];
}

export const CAS_LABEL: Record<CasBlocage, string> = {
  impossible: 'Impossibilité démontrée',
  donnees_manquantes: 'Données manquantes',
  non_trouvee: 'Solution non trouvée dans le temps de calcul',
  decouvert: 'Solution avec un créneau encore découvert',
};

const JOUR_ENTIER: Interval[] = [{ start: 0, end: 1440 }];

interface Indispo {
  plages: Interval[];
  raison: string;
  /** L'indisponibilité peut-elle être rediscutée avec la personne ? */
  negociable: boolean;
}

/** Tout ce qui empêche une personne d'être affectée un jour donné, avec la raison lisible. */
export function indisponibilites(data: AppData, p: Person, date: ISODate): Indispo[] {
  const out: Indispo[] = [];
  const absence = data.absences.find(
    (a) => a.personId === p.id && a.statut === 'approuvee' && a.from <= date && date <= a.to,
  );
  if (absence) {
    out.push({
      plages: JOUR_ENTIER,
      raison: `${ABSENCE_LABEL[absence.type].toLowerCase()} approuvé${absence.type === 'conge' || absence.type === 'maladie' ? '' : 'e'} jusqu'au ${fmtJourMois(absence.to)}`,
      negociable: false,
    });
  }
  for (const b of besoinsDe(data, p.id, date)) {
    if (b.statut !== 'reconnue') continue;
    const plages =
      b.forme === 'indisponible'
        ? b.plageStart !== undefined && b.plageEnd !== undefined
          ? [{ start: b.plageStart, end: b.plageEnd }]
          : JOUR_ENTIER
        : b.forme === 'finir_avant'
          ? [{ start: b.heure ?? 1440, end: 1440 }]
          : [{ start: 0, end: b.heure ?? 0 }];
    out.push({
      plages,
      raison: b.horsPlafond ? 'aménagement validé' : 'indisponibilité reconnue',
      negociable: !b.horsPlafond,
    });
  }
  if (p.salarie) {
    const repos = valeurRegle(data.regles, 'repos.quotidien', 11) * 60;
    const jour0 = absMin(date, 0);
    for (const g of data.gardes) {
      if (g.personId !== p.id || g.type === 'astreinte') continue;
      const abs = gardeAbs(g);
      const bloc = { start: abs.start - repos - jour0, end: abs.end + repos - jour0 };
      if (bloc.end <= 0 || bloc.start >= 1440) continue;
      out.push({
        plages: [{ start: Math.max(0, bloc.start), end: Math.min(1440, bloc.end) }],
        raison: 'repos obligatoire autour d’une garde',
        negociable: false,
      });
    }
  }
  return out;
}

/** Plages d'ouverture où une personne peut encore être affectée. */
export function plagesAffectables(data: AppData, p: Person, date: ISODate): Interval[] {
  const indispo = indisponibilites(data, p, date).flatMap((i) => i.plages);
  return subtract(ouverture(data.officine, date), indispo);
}

const jourLong = (date: ISODate): string => `${JOURS[weekday(date)]} ${fmtJourMois(date)}`;

/** Avant tout calcul : données manquantes et impossibilités démontrables. */
export function diagnosticPrealable(data: AppData, monday: ISODate): Blocage[] {
  const out: Blocage[] = [];
  const dates = weekDates(monday);
  const interne = equipeInterne(data);
  const pharmaciens = interne.filter(estPharmacien);

  if (!pharmaciens.length) {
    out.push({
      cas: 'donnees_manquantes',
      titre: 'Aucun pharmacien dans l’équipe',
      message: 'Ajoutez au moins un pharmacien : sans lui, aucune plage d’ouverture ne peut être couverte.',
      raisons: [],
      leviers: ['Compléter la fiche de l’équipe'],
    });
  }
  if (dates.every((d) => !ouverture(data.officine, d).length)) {
    out.push({
      cas: 'donnees_manquantes',
      titre: 'Aucune plage d’ouverture cette semaine',
      message: 'Les horaires d’ouverture ne sont pas renseignés, ou l’officine est fermée toute la semaine.',
      raisons: [],
      leviers: ['Renseigner les horaires d’ouverture'],
    });
  }
  for (const p of interne) {
    if (!(p.heuresHebdo > 0)) {
      out.push({
        cas: 'donnees_manquantes',
        titre: `Contrat de ${nomCourt(p)} incomplet`,
        message: `La durée hebdomadaire de ${nomCourt(p)} n’est pas renseignée : le calcul ne sait pas combien d’heures lui attribuer.`,
        raisons: [],
        leviers: ['Compléter le contrat dans la fiche de la personne'],
      });
    }
  }
  for (const date of dates) {
    const o = ouverture(data.officine, date);
    if (!o.length) continue;
    const wd = weekday(date);
    const postes = data.officine.postes.filter((x) => x.jours.includes(wd));
    const nonCouvert = subtract(
      o,
      postes.map((x) => ({ start: x.start, end: x.end })),
    );
    for (const t of nonCouvert) {
      out.push({
        cas: 'donnees_manquantes',
        titre: `Aucun poste type le ${JOURS[wd]} de ${fmtHeure(t.start)} à ${fmtHeure(t.end)}`,
        message: `L’officine est ouverte le ${jourLong(date)} de ${fmtHeure(t.start)} à ${fmtHeure(
          t.end,
        )}, mais aucun poste type ne couvre cette plage.`,
        date,
        start: t.start,
        end: t.end,
        raisons: [],
        leviers: ['Ajouter ou allonger un poste type dans les réglages de l’officine'],
      });
    }
  }
  if (!pharmaciens.length) return out;

  // Impossibilité plage par plage : aucun pharmacien affectable.
  let besoinTotal = 0;
  const capacite = new Map<string, number>();
  for (const date of dates) {
    const o = ouverture(data.officine, date);
    if (!o.length) continue;
    besoinTotal += totalDuree(o);
    const affectables = pharmaciens.map((p) => ({ p, plages: plagesAffectables(data, p, date) }));
    for (const a of affectables) {
      const maxJour = a.p.salarie ? valeurRegle(data.regles, 'duree.quotidienne', 10) * 60 : Infinity;
      capacite.set(a.p.id, (capacite.get(a.p.id) ?? 0) + Math.min(maxJour, totalDuree(a.plages)));
    }
    const impossibles = subtract(o, union(affectables.flatMap((a) => a.plages)));
    for (const t of impossibles) {
      const raisons = pharmaciens.map((p) => {
        const causes = indisponibilites(data, p, date).filter((i) => intersect(i.plages, [t]).length);
        return { personId: p.id, raison: causes.map((c) => c.raison).join(' ; ') || 'indisponible' };
      });
      const negociable = pharmaciens.some((p) =>
        indisponibilites(data, p, date).some((i) => i.negociable && intersect(i.plages, [t]).length),
      );
      out.push({
        cas: 'impossible',
        titre: `${jourLong(date)}, ${fmtHeure(t.start)} – ${fmtHeure(t.end)} : aucun pharmacien affectable`,
        message: `Le ${jourLong(date)}, de ${fmtHeure(t.start)} à ${fmtHeure(
          t.end,
        )}, aucun pharmacien de l’équipe ne peut être affecté avec les contraintes actuelles.`,
        date,
        start: t.start,
        end: t.end,
        raisons,
        leviers: [
          'Faire appel à un pharmacien remplaçant sur cette plage',
          ...(negociable ? ['Rediscuter, avec son accord, l’indisponibilité reconnue d’un pharmacien'] : []),
          'Réduire l’ouverture sur cette plage',
        ],
      });
    }
  }

  // Impossibilité globale : pas assez d'heures de pharmacien sur la semaine.
  const maxHebdo = valeurRegle(data.regles, 'duree.hebdo', 46) * 60;
  let capaciteTotale = 0;
  for (const p of pharmaciens) {
    capaciteTotale += Math.min(p.salarie ? maxHebdo : Infinity, capacite.get(p.id) ?? 0);
  }
  if (besoinTotal > capaciteTotale && !out.some((b) => b.cas === 'impossible')) {
    out.push({
      cas: 'impossible',
      titre: 'Pas assez d’heures de pharmacien sur la semaine',
      message: `L’ouverture demande ${fmtDuree(besoinTotal)} de présence pharmaceutique ; l’équipe peut en fournir au plus ${fmtDuree(
        capaciteTotale,
      )} dans le respect des durées maximales.`,
      raisons: [],
      leviers: ['Faire appel à un pharmacien remplaçant', 'Réduire l’amplitude d’ouverture'],
    });
  }
  return out;
}

/**
 * Après un calcul : ce qui reste bloqué, classé honnêtement.
 * `data` doit déjà contenir le planning produit.
 */
export function diagnosticResultat(data: AppData, monday: ISODate, prealable: Blocage[]): Blocage[] {
  const out: Blocage[] = [...prealable];
  const issues = validateWeek(data, monday).filter((i) => i.gravite === 'bloquant');
  const pharmaciens = equipeInterne(data).filter(estPharmacien);
  const dejaProuve = (date: ISODate, t: Interval): boolean =>
    prealable.some(
      (b) => b.cas !== 'non_trouvee' && b.date === date && b.start !== undefined && b.start <= t.start && t.end <= (b.end ?? 0),
    );

  for (const i of issues) {
    if (i.regle !== 'pharmacie.presence' || !i.date || i.start === undefined || i.end === undefined) continue;
    const t = { start: i.start, end: i.end };
    if (dejaProuve(i.date, t)) continue;
    // Une partie de la plage peut être démontrée impossible : ne signaler que le reste.
    const prouve = prealable
      .filter((b) => b.cas === 'impossible' && b.date === i.date && b.start !== undefined)
      .map((b) => ({ start: b.start as number, end: b.end as number }));
    for (const reste of subtract([t], prouve)) {
      const raisons = pharmaciens.map((p) => {
        const enPoste = data.shifts.filter((s) => s.personId === p.id && s.date === i.date);
        const enPause = enPoste.some(
          (s) => s.pauseStart !== undefined && s.pauseEnd !== undefined && s.pauseStart < reste.end && reste.start < s.pauseEnd,
        );
        const causes = indisponibilites(data, p, i.date as ISODate).filter((x) => intersect(x.plages, [reste]).length);
        const raison = enPause
          ? 'en pause sur cette plage'
          : causes.length
            ? causes.map((c) => c.raison).join(' ; ')
            : enPoste.length
              ? `en poste à un autre moment (${enPoste.flatMap(segmentsTravail).map((x) => `${fmtHeure(x.start)} – ${fmtHeure(x.end)}`).join(', ')})`
              : 'affectable, mais cela dépasserait une durée maximale ou un repos';
        return { personId: p.id, raison };
      });
      out.push({
        cas: 'decouvert',
        titre: `${jourLong(i.date)}, ${fmtHeure(reste.start)} – ${fmtHeure(reste.end)} : créneau encore découvert`,
        message: `Le planning proposé laisse le ${jourLong(i.date)}, de ${fmtHeure(reste.start)} à ${fmtHeure(
          reste.end,
        )}, sans pharmacien. Ce n’est pas démontré impossible : un ajustement manuel ou un renfort peut suffire.`,
        date: i.date,
        start: reste.start,
        end: reste.end,
        raisons,
        leviers: [
          'Décaler la pause d’un pharmacien présent',
          'Proposer des heures complémentaires à un pharmacien à temps partiel volontaire',
          'Faire appel à un pharmacien remplaçant',
        ],
      });
    }
  }

  const autres = issues.filter((i) => i.regle !== 'pharmacie.presence');
  if (autres.length) {
    out.push({
      cas: 'non_trouvee',
      titre: 'Certaines règles ne sont pas encore respectées',
      message: `Aucune solution respectant toutes les règles n’a été trouvée dans le temps de calcul (${autres.length} point${
        autres.length > 1 ? 's' : ''
      } restant${autres.length > 1 ? 's' : ''}). Cela ne prouve pas qu’il n’en existe pas.`,
      raisons: autres.filter((i) => i.personId).map((i) => ({ personId: i.personId as string, raison: i.message })),
      leviers: ['Relancer le calcul', 'Ajuster à la main les postes signalés', 'Faire appel à un remplaçant'],
    });
  }
  return out;
}
