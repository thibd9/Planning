import { illustrationDuProfil } from '../components/Illustration';
import { CIBLE, viser } from '../viser';
import { AlarmClock, ArrowLeftRight, ArrowRight, BellRing, BriefcaseMedical, Building2, CalendarDays, CalendarRange, Check, Handshake, History, Hourglass, ListChecks, MoonStar, ShieldCheck, Sparkles, Store, UserMinus, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { libelleRole, memeIdentifiant } from '../../domain/acces';
import { MOIS, addDays, fmtDateCourt, fmtDateLong, fmtHeure, fmtSemaine, mondayOf, todayISO, totalDuree, weekDates } from '../../domain/time';
import type { AppData } from '../../domain/types';
import { libelleAbsence, libelleGarde, nomCourt, MOTIF_RETARD_LABEL } from '../../domain/types';
import { declarationsAFaire, delaiDeclaration } from '../../engine/accident';
import { ouverture, shiftsSemaine, trousPharmacien } from '../../engine/core';
import { arriveePrevue, retardsDuJour } from '../../engine/retard';
import { rdvAVenir } from '../../engine/rdv';
import { ProchainsRendezVous } from '../components/RendezVous';
import { etatPublication, reglagePublication } from '../../engine/echeance';
import { decisions } from '../../engine/decisions';
import { changementsSemaine } from '../../engine/publish';
import { aRegulariser, semaineLibre } from '../../engine/heures';
import { estCollaboratif, moisDe, reponses } from '../../engine/souhaits';
import { validateWeek } from '../../engine/validate';
import { useStore } from '../../store/store';
import { ListeAnnonces, annoncesDe } from '../components/Annonces';
import { prefsDe, useUi } from '../../store/ui';
import { Avatar, Frise, Graduations, Pill } from '../kit';
import { BanniereAccueil } from '../components/Banniere';

/** Part des minutes d'ouverture d'une semaine où un pharmacien est planifié ; null si rien n'est posé. */
function couverture(data: AppData, monday: string): number | null {
  if (!shiftsSemaine(data, monday).length) return null;
  let total = 0;
  let sans = 0;
  for (const d of weekDates(monday)) {
    total += totalDuree(ouverture(data.officine, d));
    sans += totalDuree(trousPharmacien(data, d));
  }
  return total ? Math.round(((total - sans) / total) * 100) : null;
}

const capitale = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** Tableau de bord du responsable : l'état de l'officine en un écran. */
/** Dans une petite carte, le mois s'abrège à la française : « 29 nov. », « 3 déc. ». */
const ABREGES: Record<string, string> = { janvier: 'janv.', février: 'févr.', avril: 'avr.', juillet: 'juil.', septembre: 'sept.', octobre: 'oct.', novembre: 'nov.', décembre: 'déc.' };
const moisAbrege = (texte: string): string => texte.replace(/(janvier|février|avril|juillet|septembre|octobre|novembre|décembre)/, (m) => ABREGES[m]);

export function Tableau({ personId }: { personId: string }): JSX.Element {
  const { data, autres, officineId, today, changerOfficine } = useStore();
  const { aller, setSemaine, session, setSujet, voirJour, dire, preferences } = useUi();
  // La disposition choisie dans « Mon compte » : le comptoir et les décisions côte à côte, ou la priorité d'abord.
  const disposition = prefsDe(preferences, session).tableau;
  const preparerMois = useStore((st) => st.preparerMois);
  const moi = data.personnes.find((p) => p.id === personId);
  const lundi = mondayOf(today);
  const d = useMemo(() => decisions(data, today), [data, today]);
  const lireAnnonces = useStore((x) => x.lireAnnonces);
  // Les six dernières décisions annoncées, lues ou non.
  const recentes = annoncesDe(data, personId).slice(0, 6);
  const cetteSemaine = couverture(data, lundi);
  const heures = useMemo(() => aRegulariser(data, today).length, [data, today]);
  const suivante = addDays(lundi, 7);
  const etatSuivante = data.semaines[suivante]?.statut === 'publie' ? 'Publiée' : shiftsSemaine(data, suivante).length ? 'Brouillon' : 'À construire';
  const prochaineGarde = data.gardes.filter((g) => g.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const duJour = data.shifts.filter((s) => s.date === today).sort((a, b) => a.start - b.start);
  const retards = retardsDuJour(data, today);
  const absents = data.absences.filter((a) => a.statut === 'approuvee' && a.from <= today && today <= a.to);
  const pharmacies = [{ id: officineId, d: data }, ...Object.entries(autres).map(([id, x]) => ({ id, d: x }))].filter(({ d: x }) => x.personnes.some((p) => memeIdentifiant(p.identifiant, session ?? '')));

  // Les décisions, rangées par sujet : chaque ligne ouvre le bon onglet de « Résoudre ».
  const sujets: { cle: string; label: string; nombre: number; icone: JSX.Element }[] = [
    { cle: 'accords', label: 'Accords à donner', nombre: d.accords.length, icone: <Handshake size={18} /> },
    { cle: 'absences', label: 'Absences à couvrir', nombre: d.trous.length, icone: <UserMinus size={18} /> },
    { cle: 'remplacements', label: 'Remplacements', nombre: d.remplacements.length, icone: <ArrowLeftRight size={18} /> },
    { cle: 'demandes', label: 'Demandes de l’équipe', nombre: d.absences.length + d.besoins.length, icone: <Check size={18} /> },
    { cle: 'gardes', label: 'Gardes', nombre: d.gardesAAffecter.length + d.gardesRepos.length + d.gardesAbsence.length + d.gardesAValider.length, icone: <MoonStar size={18} /> },
    { cle: 'publications', label: 'Plannings à publier', nombre: d.publications.length, icone: <CalendarRange size={18} /> },
  ].filter((x) => x.nombre > 0);
  const ouvrir = (cle: string): void => {
    setSujet(cle);
    aller('resoudre');
  };
  const enPoste = [...new Map(duJour.map((s) => [s.personId, s])).values()];
  const ouvertAuj = ouverture(data.officine, today).length > 0;
  // Une pharmacie qui débute, ou une semaine jamais construite : aucun poste cette semaine. On le dit, plutôt qu'un « 0 en poste » muet.
  const semaineVide = !shiftsSemaine(data, lundi).length;
  // Ce que le titulaire voit ici, l'équipe ne le voit qu'une fois publié : on le dit quand ce n'est pas le cas.
  const semaineEnBrouillon = !semaineVide && data.semaines[lundi]?.statut !== 'publie';
  const retouchesEnAttente = data.semaines[lundi]?.statut === 'publie' ? changementsSemaine(data, lundi).length : 0;
  const construireCetteSemaine = (): void => {
    setSemaine(lundi);
    aller('construire');
    viser(CIBLE.grille);
  };

  // Le cycle d'une semaine : préférences, brouillon, contrôles, publication. On montre la première semaine à traiter.
  const cycle = useMemo(() => {
    const cible = semaineLibre(data, today);
    const postes = shiftsSemaine(data, cible).length;
    const bloquants = postes ? validateWeek(data, cible).filter((i) => i.gravite === 'bloquant').length : 0;
    const collaboratif = estCollaboratif(data.officine);
    const r = reponses(data, moisDe(addDays(cible, 3)));
    const recues = r.repondu.length;
    const attendues = recues + r.attendus.length;
    // On arrive sur ce qu'il reste à faire : la grille vide, ou le bouton « Publier » quand tout est bon.
    const voir = (): void => {
      setSemaine(cible);
      aller('construire');
      if (!postes) viser(CIBLE.grille);
      else if (!bloquants) viser(CIBLE.publier);
    };
    const etapes: { nom: string; detail: string; etat: 'fait' | 'cours' | 'attente' }[] = [
      ...(collaboratif ? [{ nom: 'Préférences', detail: `${recues}/${attendues} reçues`, etat: recues >= attendues || postes ? ('fait' as const) : ('cours' as const) }] : []),
      { nom: 'Brouillon', detail: postes ? `${postes} postes` : 'À construire', etat: postes ? ('fait' as const) : ('attente' as const) },
      { nom: 'Contrôles', detail: !postes ? 'Après le brouillon' : bloquants ? `${bloquants} à corriger` : 'Tout est bon', etat: postes && !bloquants ? ('fait' as const) : ('attente' as const) },
      { nom: 'Publication', detail: 'À envoyer à l’équipe', etat: 'attente' as const },
    ];
    // L'étape en cours est la première qui n'est pas faite.
    const premiere = etapes.findIndex((e) => e.etat !== 'fait');
    if (premiere >= 0) etapes[premiere] = { ...etapes[premiere], etat: 'cours' };
    const bouton = !postes ? 'Construire' : bloquants ? 'Corriger' : 'Publier';
    return { semaine: cible, etapes, bouton, action: voir };
  }, [data, today, aller, setSemaine]);

  // Les accidents du travail signalés dont la déclaration reste à faire : un délai légal court, donc un rappel bien visible.
  const aDeclarer = useMemo(() => declarationsAFaire(data, today), [data, today]);
  const noterDeclaration = useStore((s) => s.noterDeclarationAccident);
  // Ce qui passe avant tout le reste : une seule chose, dite en clair, avec le bouton qui y mène.
  const priorite = ((): { ton: 'urgent' | 'attention' | 'calme' | 'ok'; icone: JSX.Element; titre: string; detail: string; bouton?: string; action?: () => void } => {
    const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;
    // Un délai légal qui tombe aujourd'hui, ou déjà dépassé, passe avant tout le reste.
    if (aDeclarer.length && aDeclarer[0].jours <= 0) {
      const x = aDeclarer[0];
      const qui = data.personnes.find((y) => y.id === x.absence.personId);
      return {
        ton: x.jours <= 0 ? 'urgent' : 'attention',
        icone: <BriefcaseMedical size={22} />,
        titre: `${libelleAbsence(x.absence)} à déclarer`,
        detail: `Celui de ${qui ? nomCourt(qui) : 'la personne'} : à la caisse d’assurance maladie au plus tard le ${fmtDateCourt(x.echeance)}, ${delaiDeclaration(x.jours)}. Notez « C’est fait » une fois la déclaration envoyée.`,
      };
    }
    if (d.trous.length) {
      const t = [...d.trous].sort((a, b) => a.shift.date.localeCompare(b.shift.date) || a.shift.start - b.shift.start)[0];
      const qui = data.personnes.find((x) => x.id === t.shift.personId);
      return { ton: 'urgent', icone: <UserMinus size={22} />, titre: `${pluriel(d.trous.length, 'poste', 'postes')} sans personne`, detail: `Le plus proche : celui ${qui ? `de ${nomCourt(qui)}` : 'd’un absent'}, ${fmtDateCourt(t.shift.date)} de ${fmtHeure(t.shift.start)} à ${fmtHeure(t.shift.end)}.`, bouton: 'Couvrir l’absence', action: () => ouvrir('absences') };
    }
    if (aDeclarer.length) {
      const x = aDeclarer[0];
      const qui = data.personnes.find((y) => y.id === x.absence.personId);
      return {
        ton: x.jours <= 0 ? 'urgent' : 'attention',
        icone: <BriefcaseMedical size={22} />,
        titre: `${libelleAbsence(x.absence)} à déclarer`,
        detail: `Celui de ${qui ? nomCourt(qui) : 'la personne'} : à la caisse d’assurance maladie au plus tard le ${fmtDateCourt(x.echeance)}, ${delaiDeclaration(x.jours)}. Notez « C’est fait » une fois la déclaration envoyée.`,
      };
    }
    if (d.remplacements.length) {
      const r = [...d.remplacements].sort((a, b) => a.date.localeCompare(b.date))[0];
      const qui = data.personnes.find((x) => x.id === r.demandeur);
      return { ton: 'attention', icone: <ArrowLeftRight size={22} />, titre: `${pluriel(d.remplacements.length, 'demande', 'demandes')} de remplacement`, detail: `${qui ? nomCourt(qui) : 'Un collègue'} demande à être remplacé ${fmtDateCourt(r.date)}.`, bouton: 'Répondre', action: () => ouvrir('remplacements') };
    }
    if (d.accords.length) return { ton: 'attention', icone: <Handshake size={22} />, titre: `${pluriel(d.accords.length, 'accord', 'accords')} à donner`, detail: 'Un titulaire attend votre accord pour appliquer sa décision.', bouton: 'Donner mon accord', action: () => ouvrir('accords') };
    const demandes = d.absences.length + d.besoins.length;
    if (demandes) return { ton: 'attention', icone: <Check size={22} />, titre: `${pluriel(demandes, 'demande', 'demandes')} de l’équipe à trancher`, detail: 'Congés et horaires : chacun attend une réponse.', bouton: 'Répondre', action: () => ouvrir('demandes') };
    const gardes = d.gardesAAffecter.length + d.gardesRepos.length + d.gardesAbsence.length + d.gardesAValider.length;
    if (gardes) return { ton: 'attention', icone: <MoonStar size={22} />, titre: `${pluriel(gardes, 'garde', 'gardes')} à régler`, detail: 'À confier, à valider, ou un repos à prévoir.', bouton: 'Voir les gardes', action: () => ouvrir('gardes') };
    if (d.publications.length) {
      const x = d.publications[0];
      const semaine = `Semaine du ${fmtSemaine(x.monday)}`;
      if (x.type === 'modifications') return { ton: 'attention', icone: <CalendarRange size={22} />, titre: 'Des modifications attendent d’être publiées', detail: `${semaine} : ${pluriel(x.nombre, 'changement', 'changements')} que l’équipe ne voit pas encore.`, bouton: 'Publier', action: () => ouvrir('publications') };
      if (!x.nombre) return { ton: 'attention', icone: <CalendarRange size={22} />, titre: 'Un planning reste à construire', detail: `${semaine} : aucun poste n’est encore posé, l’équipe n’a pas d’horaires.`, bouton: 'Construire', action: () => ouvrir('publications') };
      return { ton: 'attention', icone: <CalendarRange size={22} />, titre: 'Un planning attend d’être publié', detail: `${semaine} : l’équipe ne voit pas encore ses horaires.`, bouton: 'Publier', action: () => ouvrir('publications') };
    }
    if (cycle.etapes.some((e) => e.etat !== 'fait')) return { ton: 'calme', icone: <CalendarRange size={22} />, titre: `Préparer la semaine du ${fmtSemaine(cycle.semaine)}`, detail: 'Rien d’urgent : c’est le bon moment pour avancer le prochain planning.', bouton: cycle.bouton, action: cycle.action };
    return { ton: 'ok', icone: <Check size={22} />, titre: 'Tout est à jour', detail: 'Absences couvertes, demandes arbitrées, plannings publiés.' };
  })();
  // Mon agenda : mon prochain poste (jamais un poste déjà terminé) et mes rendez-vous à venir.
  const heureIci = today === todayISO() ? new Date().getHours() * 60 + new Date().getMinutes() : 0;
  const monPoste = moi
    ? data.shifts
        .filter((x) => x.personId === moi.id && data.semaines[mondayOf(x.date)]?.statut === 'publie' && (x.date > today || (x.date === today && x.end > heureIci)))
        .sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start)[0]
    : undefined;
  const mesRdv = moi ? rdvAVenir(data, moi.id, today) : [];
  // Les jours qui suivent : mes postes publiés, et ma prochaine garde, pour que l'agenda se lise d'un coup d'œil.
  const mesSuivants = moi
    ? data.shifts
        .filter((x) => x.personId === moi.id && x.id !== monPoste?.id && data.semaines[mondayOf(x.date)]?.statut === 'publie' && (x.date > today || (x.date === today && x.end > heureIci)))
        .sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start)
        .slice(0, 4)
    : [];
  const maGarde = moi ? data.gardes.filter((g) => g.personId === moi.id && g.date >= today).sort((x, y) => x.date.localeCompare(y.date))[0] : undefined;
  // Le planning se transmet au mois : à l'approche de l'échéance, puis une fois dépassée, un bandeau le rappelle.
  const pub = etatPublication(data, today);
  const relais = reglagePublication(data.officine).relais;
  const nomMois = MOIS[Number(pub.mois.slice(5)) - 1];
  const prepares = pub.semaines.filter((x) => x.auto).length;
  // Dans une vraie pharmacie, le relais se fait sans geste : dès qu'un titulaire ouvre Solvéa après l'échéance.
  // Dans l'environnement d'exemple, le bandeau propose un bouton, pour le voir faire.
  const aPreparer = !data.demo && relais && pub.etat === 'depasse' && pub.vides > 0;
  useEffect(() => {
    if (!aPreparer) return;
    preparerMois(pub.mois);
    dire(`L’échéance est passée : Solvéa a préparé ${nomMois} en brouillon d’après vos habitudes. Relisez, puis publiez le mois.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aPreparer, pub.mois]);
  const versLeMois = (): void => {
    const ui = useUi.getState();
    ui.setSemaine(pub.semaines.find((x) => x.etat !== 'publie')?.monday ?? pub.semaines[0]?.monday ?? today);
    ui.setPlanVue('mois');
    ui.aller('construire');
  };
  // L'équipe du jour, une ligne par personne, sur l'échelle des heures d'ouverture.
  const ouvertures = ouverture(data.officine, today);
  const echelle = ouvertures.length ? { start: Math.floor(ouvertures[0].start / 60) * 60, end: Math.ceil(ouvertures[ouvertures.length - 1].end / 60) * 60 } : { start: 8 * 60, end: 20 * 60 };
  const parPersonne = [...new Set(duJour.map((s) => s.personId))].map((id) => ({ p: data.personnes.find((x) => x.id === id), postes: duJour.filter((s) => s.personId === id) })).filter((x) => x.p);
  // Le repère de l'heure avance tout seul : la page se rafraîchit chaque minute.
  const [, setMinute] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setMinute((x) => x + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const maintenant = new Date().getHours() * 60 + new Date().getMinutes();
  // Toujours visible un jour d'ouverture : avant l'ouverture il attend au début, après la fermeture il reste à la fin.
  const avantOuverture = maintenant <= echelle.start;
  const apresFermeture = maintenant >= echelle.end;
  const aiguille = today === todayISO() && ouvertures.length ? Math.min(100, Math.max(0, ((maintenant - echelle.start) / (echelle.end - echelle.start)) * 100)) : null;
  const libelleMaintenant = avantOuverture ? `Ouverture à ${fmtHeure(ouvertures[0]?.start ?? echelle.start)}` : apresFermeture ? `Journée terminée · ${fmtHeure(maintenant)}` : `Maintenant · ${fmtHeure(maintenant)}`;

  // Les blocs du tableau de bord. Leur contenu ne change pas d'une disposition à l'autre : seule leur place change.
  const blocPriorite = (
          <section className={`tb-priorite ${priorite.ton}`} aria-labelledby="tb-prio" data-focus="priorite">
            <span className="tb-prio-ico" aria-hidden="true">
              {priorite.icone}
            </span>
            <div className="tb-prio-texte">
              <div className="eyebrow">{priorite.ton === 'ok' ? 'Aujourd’hui' : 'À faire en premier'}</div>
              <h2 id="tb-prio">{priorite.titre}</h2>
              <p>{priorite.detail}</p>
            </div>
            {priorite.action && priorite.bouton ? (
              <button type="button" className="btn primary" onClick={priorite.action}>
                {priorite.bouton} <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : null}
          </section>
  );
  const blocEcheance =
          pub.etat === 'rappel' || pub.etat === 'depasse' ? (
            <section className={`tb-priorite note tb-echeance ${pub.etat}`} aria-labelledby="tb-echeance" data-focus="echeance">
              <span className="tb-prio-ico" aria-hidden="true">
                {pub.etat === 'depasse' && prepares ? <Sparkles size={20} /> : <BellRing size={20} />}
              </span>
              <div className="tb-prio-texte">
                <div className="eyebrow">Planning de {nomMois}</div>
                <h3 id="tb-echeance">
                  {pub.etat === 'rappel'
                    ? `À transmettre avant le ${fmtDateCourt(pub.echeance)}`
                    : prepares && !pub.vides
                      ? 'Préparé par Solvéa d’après vos habitudes'
                      : `En retard depuis le ${fmtDateCourt(pub.echeance)}`}
                </h3>
                <p>
                  {pub.etat === 'rappel'
                    ? `${pub.jours === 0 ? 'C’est aujourd’hui.' : `Il reste ${pub.jours} jour${pub.jours > 1 ? 's' : ''}.`} ${pub.restantes} semaine${pub.restantes > 1 ? 's ne sont' : ' n’est'} pas encore publiée${pub.restantes > 1 ? 's' : ''}${pub.vides ? `, dont ${pub.vides} vide${pub.vides > 1 ? 's' : ''}` : ''}.`
                    : pub.vides
                      ? relais
                        ? `${pub.vides} semaine${pub.vides > 1 ? 's' : ''} vide${pub.vides > 1 ? 's' : ''}. Solvéa peut ${pub.vides > 1 ? 'les' : 'la'} préparer en brouillon d’après vos habitudes ; rien n’est publié sans vous.`
                        : `${pub.vides} semaine${pub.vides > 1 ? 's' : ''} vide${pub.vides > 1 ? 's' : ''}, ${pub.restantes} à publier.`
                      : `${pub.restantes} semaine${pub.restantes > 1 ? 's' : ''} en brouillon${prepares ? `, dont ${prepares} préparée${prepares > 1 ? 's' : ''} par Solvéa` : ''} : relisez, corrigez, puis publiez le mois.`}
                </p>
              </div>
              {pub.etat === 'depasse' && pub.vides && relais ? (
                <button
                  type="button"
                  className="btn"
                  id="echeance-preparer"
                  onClick={() => {
                    preparerMois(pub.mois);
                    dire(`Solvéa a préparé ${nomMois} en brouillon d’après vos habitudes. Relisez, puis publiez le mois.`, true);
                    versLeMois();
                  }}
                >
                  <Sparkles size={16} aria-hidden="true" /> Préparer {nomMois}
                </button>
              ) : (
                <button type="button" className="btn" id="echeance-ouvrir" onClick={versLeMois}>
                  {pub.vides ? `Construire ${nomMois}` : 'Relire et publier'} <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </section>
          ) : null;
  // Mon agenda : un titulaire a lui aussi un planning et des rendez-vous.
  const blocAgenda = (
        <section className="card tb-agenda" aria-labelledby="tb-agenda" data-focus="mon-agenda">
          <div className="card-head">
            <span className="ico carte-ico" aria-hidden="true"><CalendarDays size={20} /></span>
            <div className="grow">
              <div className="eyebrow">Mon agenda</div>
              <h2 id="tb-agenda">
                {monPoste ? (
                  <>
                    {capitale(monPoste.date === today ? 'Aujourd’hui' : monPoste.date === addDays(today, 1) ? 'Demain' : fmtDateCourt(monPoste.date))}{'\u00a0'}:{' '}
                    <span className="num sans-coupure">
                      {fmtHeure(monPoste.start)} – {fmtHeure(monPoste.end)}
                    </span>
                  </>
                ) : (
                  'Pas de poste à venir'
                )}
              </h2>
            </div>
            <button type="button" className="btn sm" onClick={() => aller('moi')}>
              Mon planning <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="card-body tb-agenda-corps">
            {mesSuivants.length || maGarde ? (
              <div>
                <h3 className="tb-agenda-titre">Ensuite</h3>
                <ul className="tb-agenda-liste">
                  {mesSuivants.map((x) => (
                    <li key={x.id}>
                      <span className="jour">{x.date === addDays(today, 1) ? 'Demain' : capitale(fmtDateCourt(x.date))}</span>
                      <span className="num">
                        {fmtHeure(x.start)} – {fmtHeure(x.end)}
                      </span>
                    </li>
                  ))}
                  {maGarde ? (
                    <li className="garde">
                      <span className="jour">
                        <MoonStar size={14} aria-hidden="true" /> {capitale(fmtDateCourt(maGarde.date))}
                      </span>
                      <span>{libelleGarde(maGarde)}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            <h3 className="tb-agenda-titre">Rendez-vous</h3>
            {mesRdv.length ? (
              <ProchainsRendezVous data={data} personId={moi?.id ?? ''} today={today} onOuvrir={(autre) => { useUi.getState().viserFil(autre); aller('messages'); }} />
            ) : (
              <p className="soft small" style={{ margin: 0 }}>Aucun rendez-vous à venir. Une demande acceptée se fixe ici et dans « Mon planning ».</p>
            )}
          </div>
        </section>
  );
  const blocFaire = (
          <section className="card tb-faire" aria-labelledby="tb-faire">
            <div className="card-head">
              <span className="ico carte-ico" aria-hidden="true"><ListChecks size={20} /></span>
              <div className="grow">
                <div className="eyebrow">À décider</div>
                <h2 id="tb-faire">{d.total ? `${d.total} décision${d.total > 1 ? 's' : ''} à prendre` : aDeclarer.length ? `${aDeclarer.length} déclaration${aDeclarer.length > 1 ? 's' : ''} à faire` : 'Tout est à jour'}</h2>
              </div>
              {d.total ? (
                <button type="button" className="btn" onClick={() => aller('resoudre')}>
                  Tout voir <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {aDeclarer.length ? (
              <ul className="tb-declarer" id="tb-declarer" aria-label="Accidents du travail à déclarer">
                {aDeclarer.map((x) => {
                  const qui = data.personnes.find((y) => y.id === x.absence.personId);
                  return (
                    <li key={x.absence.id} className={x.jours <= 0 ? 'presse' : undefined}>
                      <span className="ico" aria-hidden="true">
                        <BriefcaseMedical size={18} />
                      </span>
                      <span className="grow">
                        <b>
                          Déclarer l’{libelleAbsence(x.absence).toLowerCase()} de {qui ? nomCourt(qui) : 'la personne'}
                        </b>
                        <span className="small">
                          À la caisse d’assurance maladie, au plus tard le {fmtDateCourt(x.echeance)} : {delaiDeclaration(x.jours)}.
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn sm"
                        data-declare={x.absence.id}
                        onClick={() => {
                          noterDeclaration(x.absence.id);
                          useUi.getState().dire('Déclaration notée comme faite : le rappel est retiré.');
                        }}
                      >
                        <Check size={14} aria-hidden="true" /> C’est fait
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {sujets.length ? (
              <div className="tb-sujets">
                {sujets.map((x, i) => (
                  <button key={x.cle} type="button" className={`tb-sujet${i === 0 ? ' premier' : ''}`} onClick={() => ouvrir(x.cle)}>
                    <span className="ico" aria-hidden="true">{x.icone}</span>
                    <span className="grow">{x.label}</span>
                    <span className="compte num">{x.nombre}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : aDeclarer.length ? null : (
              <p className="card-body soft tb-ajour">
                <span className="tb-ajour-ico" aria-hidden="true">
                  <Check size={22} />
                </span>
                <span>Absences couvertes, demandes arbitrées, plannings publiés.</span>
              </p>
            )}
          </section>
  );
  const blocCycle = (
          <section className="card cycle" aria-labelledby="tb-cycle" data-focus="cycle">
            <div className="cycle-tete">
              <span className="ico carte-ico" aria-hidden="true"><CalendarRange size={20} /></span>
              <div className="grow">
                <div className="eyebrow">Le prochain planning</div>
                <h2 id="tb-cycle">Semaine du {fmtSemaine(cycle.semaine)}</h2>
              </div>
              <button type="button" className="btn" onClick={cycle.action}>
                {cycle.bouton} <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            <ol className="cycle-etapes">
              {cycle.etapes.map((e, i) => (
                <li key={e.nom} className={e.etat} aria-current={e.etat === 'cours' ? 'step' : undefined}>
                  <span className="cycle-pastille" aria-hidden="true">
                    {e.etat === 'fait' ? <Check size={15} /> : i + 1}
                  </span>
                  <span>
                    <b>{e.nom}</b>
                    <span className="small soft">{e.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
  );
  const blocJour = (
        <section className="card tb-jour" aria-labelledby="tb-jour">
          <div className="card-head">
            <span className="ico carte-ico" aria-hidden="true"><Store size={20} /></span>
            <div className="grow">
              <div className="eyebrow">Aujourd’hui au comptoir</div>
              <h2 id="tb-jour">
                {enPoste.length ? `${enPoste.length} personne${enPoste.length > 1 ? 's' : ''} en poste` : !ouvertAuj ? 'Officine fermée' : semaineVide ? 'Semaine sans planning' : 'Aucun poste aujourd’hui'}
                {absents.length ? ` · ${absents.length} absent${absents.length > 1 ? 's' : ''}` : ''}
              </h2>
            </div>
            <button type="button" className="btn" onClick={() => voirJour(today)}>
              Voir la journée <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          {semaineEnBrouillon || retouchesEnAttente ? (
            <div className="notice warn tb-nonpublie" id="tb-nonpublie">
              <CalendarRange size={16} aria-hidden="true" />
              <span className="grow">
                {semaineEnBrouillon
                  ? 'Le planning de cette semaine est un brouillon : l’équipe ne le voit pas encore.'
                  : `${retouchesEnAttente} retouche${retouchesEnAttente > 1 ? 's' : ''} de cette semaine ${retouchesEnAttente > 1 ? 'ne sont pas encore publiées' : 'n’est pas encore publiée'} : l’équipe lit toujours l’ancienne version.`}
              </span>
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  setSemaine(lundi);
                  aller('construire');
                  viser(CIBLE.publier);
                }}
              >
                {semaineEnBrouillon ? 'Relire et publier' : 'Publier les modifications'} <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          ) : null}
          {parPersonne.length ? (
            <div className="tbj">
              {/* L'heure qu'il est : une étiquette au-dessus des heures, puis un trait continu à travers toutes les lignes. */}
              <div className={`tbj-ligne tete${aiguille !== null ? ' avec-maintenant' : ''}`} aria-hidden="true">
                <span />
                <span className="tbj-piste">
                  <Graduations echelle={echelle} />
                  {aiguille !== null ? (
                    <>
                      <span className={`tbj-maintenant${aiguille < 12 ? ' debut' : aiguille > 88 ? ' fin' : ''}`} style={{ left: `${aiguille}%` }}>
                        {libelleMaintenant}
                      </span>
                      <i className="tbj-aiguille" style={{ left: `${aiguille}%` }} />
                    </>
                  ) : null}
                </span>
              </div>
              {parPersonne.map(({ p, postes }) =>
                p ? (
                  <div key={p.id} className="tbj-ligne">
                    <span className="tbj-qui">
                      <Avatar person={p} />
                      <span style={{ minWidth: 0 }}>
                        <b>{nomCourt(p)}</b>
                        <span className="small soft">{libelleRole(data, p)}</span>
                        {retards
                          .filter((r) => r.personId === p.id)
                          .map((r) => (
                            <span key={r.id} className="tbj-retard" title={[r.motif ? MOTIF_RETARD_LABEL[r.motif] : '', r.note ?? ''].filter(Boolean).join(' : ') || undefined}>
                              <AlarmClock size={12} aria-hidden="true" /> Retard<span className="sr"> annoncé</span> · arrivée {fmtHeure(arriveePrevue(r))}
                            </span>
                          ))}
                      </span>
                    </span>
                    <span className="tbj-piste">
                      <Frise shifts={postes} echelle={echelle} />
                      {aiguille !== null ? <i className="tbj-aiguille" style={{ left: `${aiguille}%` }} aria-hidden="true" /> : null}
                      <span className="sr">{postes.map((s) => `${fmtHeure(s.start)} – ${fmtHeure(s.end)}`).join(', ')}</span>
                    </span>
                  </div>
                ) : null,
              )}
              {absents.length ? (
                <p className="tbj-absents">
                  <UserMinus size={15} aria-hidden="true" /> Absent{absents.length > 1 ? 's' : ''} :{' '}
                  {absents.map((a) => { const q = data.personnes.find((x) => x.id === a.personId); return q ? nomCourt(q) : ''; }).filter(Boolean).join(', ')}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="card-body tb-vide" id="tb-jour-vide">
              {!ouvertAuj ? (
                <p className="soft">L’officine est fermée aujourd’hui : personne n’est attendu au comptoir.</p>
              ) : semaineVide ? (
                <>
                  <p className="soft">
                    La semaine du {fmtSemaine(lundi)} n’a aucun poste : elle n’a pas été construite. C’est normal quand la pharmacie vient d’être créée ou que le premier planning commence la semaine suivante. Vous pouvez la construire maintenant, même entamée.
                  </p>
                  <button type="button" className="btn" id="tb-construire-semaine" onClick={construireCetteSemaine}>
                    Construire cette semaine <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <>
                  <p className="soft">Personne n’a de poste aujourd’hui, alors que l’officine est ouverte. Les autres jours de la semaine sont planifiés.</p>
                  <button type="button" className="btn" onClick={construireCetteSemaine}>
                    Ouvrir le planning de la semaine <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          )}
        </section>
  );

  return (
    <div className={`tb dispo-${disposition}`}>
      <BanniereAccueil
        illustration={illustrationDuProfil(data, moi)}
        personne={moi}
        date={fmtDateLong(today)}
        role={`${moi ? libelleRole(data, moi) : 'Titulaire'} · ${data.officine.nom || 'Ma pharmacie'}`}
        resume={
          <>
            <span>
            {d.total ? (
              <>
                <b>
                  {d.total} décision{d.total > 1 ? 's' : ''}
                </b>{' '}
                <span className="tb-resume-ligne">vous {d.total > 1 ? 'attendent' : 'attend'}.</span>{' '}
                {d.total > 1 ? <>Concentrez-vous sur la priorité, <span className="sans-coupure">le reste suit dans l’ordre.</span></> : 'Elle est affichée en premier.'}
              </>
            ) : (
              <>
                <b>Rien n’attend votre décision.</b> Vous pouvez avancer le prochain planning.
              </>
            )}
          </span>
          </>
        }
      >
        <div className="tb-chiffres" aria-label="Repères">
          <button type="button" className="tb-chiffre tb-auj" onClick={() => voirJour(today)}>
            <span className="ico" aria-hidden="true"><UsersRound size={18} /></span>
            <span className="grow">
              <span className="l">L’équipe aujourd’hui</span>
              <span className="v">{!ouvertAuj ? 'Fermée' : semaineVide ? 'Pas de planning' : <><span className="num">{enPoste.length}</span> en poste</>}</span>
              <span className="d">{!ouvertAuj ? 'pas d’ouverture' : semaineVide ? 'semaine à construire' : semaineEnBrouillon ? 'brouillon, non publié' : absents.length ? `${absents.length} absent${absents.length > 1 ? 's' : ''}` : 'aucun absent'}</span>
            </span>
          </button>
          <button type="button" className="tb-chiffre" onClick={() => { setSemaine(lundi); aller('construire'); }}>
            <span className="ico" aria-hidden="true"><ShieldCheck size={18} /></span>
            <span className="grow">
              <span className="l">Pharmacien présent</span>
              <span className="v num">{cetteSemaine === null ? '-' : `${cetteSemaine} %`}</span>
              <span className="d">cette semaine</span>
            </span>
          </button>
          <button type="button" className="tb-chiffre" onClick={() => { setSemaine(suivante); aller('construire'); }}>
            <span className="ico" aria-hidden="true"><CalendarRange size={18} /></span>
            <span className="grow">
              <span className="l">Semaine prochaine</span>
              <span className="v">{etatSuivante}</span>
              <span className="d">à partir du {moisAbrege(fmtDateCourt(suivante).replace(/^\S+ /, ''))}</span>
            </span>
          </button>
          <button type="button" className="tb-chiffre" onClick={() => aller('heures')}>
            <span className="ico" aria-hidden="true"><Hourglass size={18} /></span>
            <span className="grow">
              <span className="l">Compteurs d’heures</span>
              <span className="v">{heures ? <><span className="num">{heures}</span> à régulariser</> : 'À jour'}</span>
              <span className="d">{heures ? 'en plus ou en moins' : 'chacun à son contrat'}</span>
            </span>
          </button>
          <button type="button" className="tb-chiffre" onClick={() => aller('gardes')}>
            <span className="ico" aria-hidden="true"><MoonStar size={18} /></span>
            <span className="grow">
              <span className="l">Prochaine garde</span>
              <span className="v cap1">{prochaineGarde ? moisAbrege(fmtDateCourt(prochaineGarde.date)) : 'Aucune'}</span>
              <span className="d">{prochaineGarde ? (prochaineGarde.personId ? nomCourt(data.personnes.find((p) => p.id === prochaineGarde.personId) ?? data.personnes[0]) : 'À affecter') : 'rien de prévu'}</span>
            </span>
          </button>
        </div>
      </BanniereAccueil>

      {disposition === 'comptoir' ? (
        <>
          {/* L'équipe du jour à gauche, ce qui attend une décision à droite ; dessous, le planning à préparer et mon agenda. */}
          <div className="tb-grille tb-rang">
            {blocJour}
            <div className="tb-col tb-decider">
              <div className="tb-avant">{blocPriorite}</div>
              {blocFaire}
            </div>
          </div>
          <div className="tb-grille tb-rang">
            {/* L'échéance du mois va avec le prochain planning : les étapes se lisent alors en ligne, sinon en colonne. */}
            {blocEcheance ? (
              <div className="tb-suite">
                {blocEcheance}
                {blocCycle}
              </div>
            ) : (
              <div className="tb-col">{blocCycle}</div>
            )}
            {blocAgenda}
          </div>
        </>
      ) : (
        <>
          {/* La priorité et mon agenda d'abord ; dessous, les décisions et le prochain planning, puis l'équipe du jour. */}
          <div className="tb-duo">
            <div className="tb-avant">
              {blocPriorite}
              {blocEcheance}
            </div>
            {blocAgenda}
          </div>
          <div className="tb-grille">
            <div className="tb-col">
              {blocFaire}
              {blocCycle}
            </div>
            {blocJour}
          </div>
        </>
      )}

      {recentes.length ? (
        <section className="card tb-annonces" aria-labelledby="tb-annonces" data-focus="annonces" style={{ marginTop: 24 }}>
          <div className="card-head">
            <span className="ico carte-ico" aria-hidden="true"><History size={20} /></span>
            <div className="grow">
              <div className="eyebrow">Déjà décidé</div>
              <h2 id="tb-annonces">Décisions récentes</h2>
              <div className="small soft">Ce qui a été décidé, et ce que cela change dans les plannings. Les personnes concernées sont prévenues.</div>
            </div>
            {recentes.some((a) => !a.luPar.includes(personId)) ? (
              <button type="button" className="btn sm" onClick={() => lireAnnonces(personId)}>
                Tout marquer comme lu
              </button>
            ) : null}
          </div>
          <ListeAnnonces data={data} annonces={recentes} moi={personId} onLu={(id) => lireAnnonces(personId, id)} />
        </section>
      ) : null}

      {pharmacies.length > 1 ? (
        <section className="card" aria-labelledby="tb-pharmacies" style={{ marginTop: 24 }}>
          <div className="card-head">
            <span className="ico" aria-hidden="true"><Building2 size={18} /></span>
            <h2 id="tb-pharmacies" className="h3 grow">Mes pharmacies</h2>
          </div>
          <div className="card-body col">
            {pharmacies.map(({ id, d: x }) => {
              const n = decisions(x, today).total;
              return (
                <div key={id} className="row wrap">
                  <div className="grow">
                    <b>{x.officine.nom}</b>
                    <div className="small soft">
                      {x.personnes.filter((p) => !p.externe).length} personnes · {n} décision{n > 1 ? 's' : ''}
                    </div>
                  </div>
                  {id === officineId ? <Pill tone="ok">Ouverte</Pill> : (
                    <button type="button" className="btn sm" onClick={() => changerOfficine(id)}>
                      Ouvrir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
