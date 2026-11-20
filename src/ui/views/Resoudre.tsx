import { montrerDansPlanning } from '../viser';
import { AlertTriangle, ArrowLeftRight, ArrowRight, CalendarCheck, CalendarRange, Check, ChevronDown, CircleCheck, Handshake, CircleHelp, Clock3, ListChecks, MoonStar, Paperclip, PartyPopper, Send, UserMinus, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RAISONS_REFUS, texteRefus } from '../../domain/refus';
import { FriseConges } from '../components/FriseConges';
import { DialogueRefus } from '../components/Refus';
import { DecisionRemplacement } from '../components/DecisionRemplacement';
import { DialogueDecision } from '../components/Decision';
import {
  JOURS,
  addDays,
  dayIndex,
  fmtDateCourt,
  fmtDateLong,
  fmtDuree,
  fmtEuros,
  fmtHeure,
  fmtSemaine,
  isoWeek,
  mondayOf,
  weekday,
} from '../../domain/time';
import type { Absence, AppData, Besoin, BesoinStatut, ISODate, MotifDemande, Remplacement, Trou, Shift } from '../../domain/types';
import { classeAbsence, libelleAbsence, nomCourt, nomGarde, libelleGarde, LIEU_ACCIDENT_LABEL, MOTIF_DEMANDE_LABEL, MOTIF_REMPLACEMENT_LABEL, estPharmacien } from '../../domain/types';
import { echeanceDeclaration } from '../../engine/accident';
import { besoinApplicable, contreditBesoin, decrireBesoin, decrireShift, minutesSemaine, shiftsSemaine } from '../../engine/core';
import { absencesSimultanees } from '../../engine/suivi';
import { decisions } from '../../engine/decisions';
import { diagnosticPrealable } from '../../engine/diagnose';
import { congesIncompatibles } from '../../engine/gardes';
import type { RepairOption } from '../../engine/repair';
import { appliquerPatch, optionsReparation } from '../../engine/repair';
import { validateWeek } from '../../engine/validate';
import { estResponsable, memeIdentifiant } from '../../domain/acces';
import { useStore } from '../../store/store';
import { TourDeRole } from '../components/Appel';
import { aSonTour, tourRemplacement } from '../../engine/appel';
import { cibleSemaine } from '../../engine/heures';
import { useUi } from '../../store/ui';
import { AvantApres, Avatar, Delai, Empty, PastilleUrgence, Pill, Dialog } from '../kit';
import { SiCouts } from '../kit';

const capitale = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

const COUVERTURE: Record<RepairOption['couverture'], { label: string; tone: string }> = {
  maintenue: { label: 'Couverture maintenue', tone: 'ok' },
  sous_conditions: { label: 'Couverture sous conditions', tone: 'warn' },
  partielle: { label: 'Couverture partielle', tone: 'danger' },
};

type Onglet = 'accords' | 'absences' | 'remplacements' | 'demandes' | 'gardes' | 'publications';

export function Resoudre(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const d = useMemo(() => decisions(data, today), [data, today]);
  /** L'absence dont on choisit la solution, jour par jour. */
  const [reglage, setReglage] = useState<string | null>(null);
  const { ouvrirGarde } = useUi();
  const corrigerRepos = useStore((s) => s.corrigerRepos);
  const { donnerAccord, ecarterAccord } = useStore();
  const dire = useUi((s) => s.dire);
  const nom = (id: string | null): string => {
    const p = data.personnes.find((x) => x.id === id);
    return p ? nomCourt(p) : '-';
  };

  // Les trous sont regroupés par absence : une décision par jour à couvrir.
  const parAbsence = useMemo(() => {
    const m = new Map<string, Trou[]>();
    for (const t of d.trous) m.set(t.absenceId, [...(m.get(t.absenceId) ?? []), t]);
    return [...m.entries()];
  }, [d.trous]);
  // Seul le premier jour qui demande un vrai choix est déplié : les autres attendent leur tour.
  const premierADecider = useMemo(() => d.trous.find((t) => optionsReparation(data, t.shift, today).impact.length)?.id ?? d.trous[0]?.id, [d.trous, data, today]);
  const nbGardes = d.gardesAAffecter.length + d.gardesRepos.length + d.gardesAbsence.length + d.gardesAValider.length;
  // Une famille de décisions par onglet : on ne lit qu'un sujet à la fois.
  const session = useUi((s) => s.session);
  const moi = data.personnes.find((p) => memeIdentifiant(p.identifiant, session ?? ''));
  const principal = estResponsable(data, moi);
  const onglets: { cle: Onglet; label: string; nombre: number; icone: JSX.Element }[] = [
    ...(d.accords.length ? [{ cle: 'accords' as Onglet, label: principal ? 'Accords à donner' : 'En attente d’accord', nombre: d.accords.length, icone: <Handshake size={16} /> }] : []),
    { cle: 'absences', label: 'Absences', nombre: d.trous.length, icone: <UserMinus size={16} /> },
    { cle: 'remplacements', label: 'Remplacements', nombre: d.remplacements.length, icone: <ArrowLeftRight size={16} /> },
    { cle: 'demandes', label: 'Demandes', nombre: d.absences.length + d.besoins.length, icone: <Check size={16} /> },
    { cle: 'gardes', label: 'Gardes', nombre: nbGardes, icone: <MoonStar size={16} /> },
    { cle: 'publications', label: 'À publier', nombre: d.publications.length, icone: <CalendarCheck size={16} /> },
  ];
  const [choix, setChoix] = useState<Onglet | null>(null);
  const sujet = useUi((s) => s.sujet);
  const voulu = choix ?? (onglets.some((o) => o.cle === sujet) ? (sujet as Onglet) : null);
  const onglet = voulu ?? onglets.find((o) => o.nombre > 0)?.cle ?? 'absences';
  const courant = onglets.find((o) => o.cle === onglet);

  return (
    <div className="page page-resoudre">
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <ListChecks size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Résoudre · {fmtDateLong(today)}</div>
          <h1>
            Que décider <span className="hl">aujourd'hui</span> ?
          </h1>
          <p>
            {d.total
              ? `${d.total} décision${d.total > 1 ? 's' : ''} à prendre. Chaque option dit ce qu’elle change avant que vous ne choisissiez.`
              : 'Aucune décision en attente.'}
          </p>
        </div>
      </div>

      <Demarrage />

      {!d.total && data.personnes.length ? (
        <Empty icon={<PartyPopper size={30} />} title="Rien à décider aujourd'hui">
          Les absences sont couvertes, les demandes arbitrées et les plannings à jour.
        </Empty>
      ) : null}

      {d.total ? (
        <div className="onglets ong-barre" role="tablist" aria-label="Familles de décisions">
          {onglets.map((o) => (
            <button key={o.cle} type="button" role="tab" id={`onglet-${o.cle}`} aria-selected={onglet === o.cle} aria-controls="panneau-decisions" className={`onglet ong-onglet${onglet === o.cle ? ' on' : ''}`} onClick={() => setChoix(o.cle)}>
              <span aria-hidden="true" className="ong-ico">
                {o.icone}
              </span>
              <span className="ong-lib">
                <span className="ong-titre">{o.label}</span>
                <span className={`compte ong-note${o.nombre ? '' : ' zero'}`}>
                  {o.nombre}
                  <span className="sr"> à traiter</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div id="panneau-decisions" role="tabpanel" aria-labelledby={`onglet-${onglet}`} className="panneau">
      {d.total && courant && !courant.nombre ? (
        <Empty icon={<CircleCheck size={30} />} title="Rien à traiter ici">
          Aucune décision en attente dans « {courant.label} ».
        </Empty>
      ) : null}

      {onglet === 'accords' && d.accords.length ? (
        <>
          <div className="section-title">
            <h2>{principal ? 'Accords à donner' : 'En attente d’accord'}</h2>
          </div>
          <div className="card">
            {d.accords.map((a) => {
              const auteur = data.personnes.find((p) => p.id === a.auteur);
              return (
                <div key={a.id} className="decision" style={{ alignItems: 'center' }}>
                  <Avatar person={auteur} />
                  <div className="grow" style={{ minWidth: 220 }}>
                    <b>{a.titre}</b>
                    <div className="small soft">
                      Proposé par {auteur ? nomCourt(auteur) : '-'}, titulaire secondaire · {fmtDateCourt(a.at.slice(0, 10))}
                    </div>
                  </div>
                  {principal ? (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          ecarterAccord(a.id, true);
                          dire('Refusé. Rien n’a été appliqué.', true);
                        }}
                      >
                        Refuser
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => {
                          donnerAccord(a.id);
                          dire('Accord donné : la décision est appliquée.', true);
                        }}
                      >
                        <Check size={16} aria-hidden="true" /> Donner mon accord
                      </button>
                    </>
                  ) : a.auteur === moi?.id ? (
                    <button type="button" className="btn" onClick={() => ecarterAccord(a.id, false)}>
                      Retirer
                    </button>
                  ) : (
                    <Pill tone="warn">En attente</Pill>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {onglet === 'absences' && parAbsence.length ? (
        <>
          <div className="section-title">
            <span className="ico">
              <UserMinus size={18} />
            </span>
            <h2>Absences à couvrir</h2>
            <span className="count">{d.trous.length}</span>
          </div>
          <div className="col" style={{ gap: 16 }}>
            {parAbsence.map(([absenceId, trous]) => {
              const a = data.absences.find((x) => x.id === absenceId);
              const p = data.personnes.find((x) => x.id === trous[0].shift.personId);
              return (
                <div key={absenceId} className="card">
                  <div className="card-head">
                    <Avatar person={p} />
                    <div className="grow">
                      <h3>
                        {a ? libelleAbsence(a) : 'Absence'} de {p ? nomCourt(p) : '-'}
                      </h3>
                      <div className="small soft">
                        {a ? `Du ${fmtDateCourt(a.from)} au ${fmtDateCourt(a.to)}` : ''} · {trous.length} poste{trous.length > 1 ? 's' : ''} à couvrir
                      </div>
                    </div>
                    <Pill tone="danger">
                      <Clock3 size={12} /> {dayIndex(trous[0].shift.date) - dayIndex(today) <= 1 ? 'Urgent' : `Dans ${dayIndex(trous[0].shift.date) - dayIndex(today)} jours`}
                    </Pill>
                    <button type="button" className="btn primary" onClick={() => setReglage(absenceId)}>
                      <ListChecks size={16} aria-hidden="true" /> Voir et choisir la solution
                    </button>
                  </div>
                  {trous.map((t) => (
                    <CarteTrou key={t.id} trou={t} ouvert={t.id === premierADecider} />
                  ))}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {onglet === 'remplacements' && d.remplacements.length ? (
        <>
          <div className="section-title">
            <span className="ico">
              <ArrowLeftRight size={18} />
            </span>
            <h2>Demandes de remplacement</h2>
            <span className="count">{d.remplacements.length}</span>
          </div>
          {/* Une carte par demande, entourée à la couleur de son urgence : chacune se lit séparément. */}
          <div className="demandes-pile">
            {d.remplacements.map((r) => (
              <DemandeRemplacement key={r.id} remplacement={r} />
            ))}
          </div>
        </>
      ) : null}

      {onglet === 'demandes' && (d.absences.length || d.besoins.length) ? (
        <>
          <div className="section-title">
            <span className="ico">
              <Check size={18} />
            </span>
            <h2>Demandes à arbitrer</h2>
            <span className="count">{d.absences.length + d.besoins.length}</span>
          </div>
          {/* Avant de répondre : qui est déjà absent, et qui demande les mêmes dates. */}
          {d.absences.length ? <FriseConges data={data} today={today} /> : null}
          <div className="card">
            {d.absences.map((a) => (
              <DemandeAbsence key={a.id} absence={a} />
            ))}
            {d.besoins.map((b) => (
              <DemandeBesoin key={b.id} besoin={b} />
            ))}
          </div>
        </>
      ) : null}

      {onglet === 'gardes' && nbGardes ? (
        <>
          <div className="section-title">
            <span className="ico">
              <MoonStar size={18} />
            </span>
            <h2>Gardes</h2>
            <span className="count">{nbGardes}</span>
          </div>
          <div className="card">
            {d.gardesRepos.map(({ garde, repos }) => (
              <div key={`r${garde.id}`} className="decision">
                <div className="grow" style={{ minWidth: 260 }}>
                  <b>Repos à protéger après la garde du {fmtDateCourt(garde.date)}</b>
                  <div className="soft small" style={{ marginTop: 3 }}>
                    {nom(garde.personId)} · {repos.texte}
                  </div>
                  {repos.conflits.map((c) => (
                    <div key={c.shift.id} className="row small" style={{ marginTop: 8 }}>
                      <Pill tone="danger">{JOURS[weekday(c.shift.date)]} · {decrireShift(c.shift)}</Pill>
                      <span className="soft">
                        {c.position === 'pendant' ? 'chevauche la garde' : `il manque ${Math.ceil(c.manque / 60)} h de repos ${c.position === 'avant' ? 'avant' : 'après'} la garde`}
                      </span>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => {
                          corrigerRepos(garde.id, c.shift.id);
                          dire('Poste corrigé pour respecter le repos.', true, { label: 'Voir le poste', faire: () => montrerDansPlanning({ date: c.shift.date, personId: c.shift.personId }) });
                        }}
                      >
                        Corriger le poste
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn sm ghost" onClick={() => ouvrirGarde(garde.id)}>
                  Ouvrir la garde <ArrowRight size={14} />
                </button>
              </div>
            ))}
            {d.gardesAbsence.map((g) => (
              <div key={`a${g.id}`} className="decision">
                <div className="grow">
                  <b>Garde du {fmtDateCourt(g.date)} confiée à une personne absente</b>
                  <div className="soft small" style={{ marginTop: 3 }}>
                    {nom(g.personId)} a une absence approuvée ou demandée sur cette période. Réaffectez la garde ou refusez le congé.
                  </div>
                </div>
                <button type="button" className="btn sm" onClick={() => ouvrirGarde(g.id)}>
                  Réaffecter <ArrowRight size={14} />
                </button>
              </div>
            ))}
            {d.gardesAAffecter.map((g) => {
              const limite = addDays(g.date, -15);
              const reste = dayIndex(limite) - dayIndex(today);
              return (
                <div key={g.id} className="decision">
                  <div className="grow">
                    <b>
                      {nomGarde(g)} du {fmtDateCourt(g.date)} à affecter
                    </b>
                    <div className="soft small" style={{ marginTop: 3 }}>
                      De {fmtHeure(g.start)} à {fmtHeure(g.end)}
                      {g.end <= g.start ? ' le lendemain' : ''} ·{' '}
                      {reste >= 0
                        ? `à communiquer au plus tard le ${fmtDateCourt(limite)} pour respecter les 15 jours (${reste} jour${reste > 1 ? 's' : ''})`
                        : 'le délai de 15 jours est déjà dépassé : accord du salarié à recueillir'}
                    </div>
                  </div>
                  <Pill tone={reste < 0 ? 'danger' : reste <= 5 ? 'warn' : 'nuit'}>{reste < 0 ? 'Délai dépassé' : `J − ${reste} avant la limite`}</Pill>
                  <button type="button" className="btn sm" onClick={() => ouvrirGarde(g.id)}>
                    Affecter <ArrowRight size={14} />
                  </button>
                </div>
              );
            })}
            {d.gardesAValider.map((g) => (
              <div key={`v${g.id}`} className="decision">
                <div className="grow">
                  <b>Variables de la garde du {fmtDateCourt(g.date)} à valider</b>
                  <div className="soft small" style={{ marginTop: 3 }}>
                    {nom(g.personId)} · {libelleGarde(g).toLowerCase()} · à relire avant transmission au comptable
                  </div>
                </div>
                <button type="button" className="btn sm" onClick={() => ouvrirGarde(g.id)}>
                  Relire <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {onglet === 'publications' && d.publications.length ? (
        <>
          <div className="section-title">
            <span className="ico">
              <CalendarCheck size={18} />
            </span>
            <h2>Plannings à publier</h2>
            <span className="count">{d.publications.length}</span>
          </div>
          <div className="card">
            {d.publications.map((pub) => (
              <div key={pub.monday} className="decision">
                <div className="grow">
                  <b>
                    Semaine {isoWeek(pub.monday)} · {fmtSemaine(pub.monday)}
                  </b>
                  <div className="soft small" style={{ marginTop: 3 }}>
                    {pub.type === 'modifications'
                      ? `${pub.nombre} modification${pub.nombre > 1 ? 's' : ''} en attente : l'équipe voit encore l'ancienne version.`
                      : pub.nombre
                        ? `Brouillon de ${pub.nombre} postes, pas encore visible par l'équipe.`
                        : 'Planning à construire.'}{' '}
                    {pub.type === 'a_publier' ? `La semaine commence dans ${pub.jours} jours.` : ''}
                  </div>
                </div>
                {pub.type === 'a_publier' && pub.jours < 10 ? <Pill tone="warn">Moins de 7 jours ouvrés</Pill> : null}
                {/* On arrive sur ce qu'il reste à faire : la grille si elle est vide, le bouton « Publier » sinon. */}
                <button
                  type="button"
                  className="btn sm"
                  data-publier={pub.monday}
                  onClick={() => {
                    const vide = pub.type === 'a_publier' && !pub.nombre;
                    montrerDansPlanning({ date: pub.monday, cible: vide ? 'grille' : 'publier' });
                    dire(vide ? 'La grille est vide : posez les postes, ou demandez des propositions.' : 'Relisez la semaine, puis publiez : le bouton est mis en évidence.');
                  }}
                >
                  {pub.type === 'a_publier' && !pub.nombre ? 'Construire la semaine' : pub.type === 'modifications' ? 'Publier les modifications' : 'Relire et publier'} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}
      </div>
      {reglage ? <DialogueReglage trous={data.trous.filter((t) => t.absenceId === reglage && t.statut === 'ouvert')} titre={(() => { const a = data.absences.find((x) => x.id === reglage); const p = data.personnes.find((x) => x.id === a?.personId); return `${a ? libelleAbsence(a) : 'Absence'} de ${p ? nomCourt(p) : '-'}`; })()} onClose={() => setReglage(null)} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Réparation

const MAIN = 'main';
/** Les options sont recalculées à chaque choix et changent d'identifiant : on les reconnaît à leur nature et à leur titre. */
const cleOption = (o: RepairOption): string => (o.id === 'moi' ? 'moi' : `${o.type}|${o.titre}`);

/**
 * Régler une absence sans rien décider à votre place : pour chaque jour, la solution conseillée est cochée,
 * les autres restent au choix, et « à la main » laisse le jour ouvert pour le régler dans le planning.
 * Les jours sont calculés l'un après l'autre : le choix d'un jour est pris en compte pour le suivant.
 */
function DialogueReglage({ trous, titre, onClose }: { trous: Trou[]; titre: string; onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const resoudre = useStore((s) => s.resoudreTrou);
  const { dire, session } = useUi();
  const [choix, setChoix] = useState<Record<string, string>>({});
  // Le titulaire peut assumer lui-même le poste, sans le reporter sur un collègue.
  const moi = data.personnes.find((p) => memeIdentifiant(p.identifiant, session ?? ''));
  const parMoi = (t: Trou, d: AppData): RepairOption | null => {
    const absent = data.personnes.find((p) => p.id === t.shift.personId);
    // Un poste de pharmacien ne se reprend que par un pharmacien.
    if (!moi || moi.id === t.shift.personId || (absent && estPharmacien(absent) && !estPharmacien(moi))) return null;
    const pris = d.shifts.some((x) => x.personId === moi.id && x.date === t.shift.date && x.start < t.shift.end && t.shift.start < x.end);
    if (pris || d.absences.some((a) => a.personId === moi.id && a.statut === 'approuvee' && a.from <= t.shift.date && t.shift.date <= a.to)) return null;
    const poste: Shift = { ...t.shift, id: `moi-${t.id}`, personId: moi.id, origine: 'reparation', explication: `Poste repris par ${nomCourt(moi)}.` };
    return { id: 'moi', type: 'echange', titre: 'Je prends ce poste moi-même', resume: `Vous assurez le poste de ${fmtHeure(t.shift.start)} à ${fmtHeure(t.shift.end)}. Personne d’autre n’est sollicité.`, couverture: 'maintenue', changements: [{ personId: moi.id, date: t.shift.date, avant: 'Repos', apres: decrireShift(poste) }], personnesTouchees: [moi.id], creneauxModifies: 1, coutSupp: 0, validations: [], regles: [], restant: [], patch: { retirer: [], ajouter: [poste], auComptoir: [], liberer: [], confier: [] }, recommande: false };
  };
  const nom = (id: string): string => {
    const p = data.personnes.find((x) => x.id === id);
    return p ? nomCourt(p) : '-';
  };
  const plan = useMemo(() => {
    let courant = data;
    return trous.map((t) => {
      const base = optionsReparation(courant, t.shift, today);
      const perso = parMoi(t, courant);
      const rep = perso ? { ...base, options: base.options.concat(perso) } : base;
      const conseillee = rep.options.find((o) => o.recommande) ?? rep.options[0];
      const voulu = choix[t.id];
      const retenue = voulu === MAIN ? null : (rep.options.find((o) => cleOption(o) === voulu) ?? conseillee ?? null);
      if (retenue) courant = appliquerPatch(courant, retenue.patch);
      return { trou: t, rep, retenue, main: voulu === MAIN };
    });
  }, [data, trous, today, choix]);
  const regles = plan.filter((x) => x.retenue).length;
  const aLaMain = plan.filter((x) => x.main);
  const appliquer = (): void => {
    for (const x of plan) {
      if (!x.retenue) continue;
      // Chaque jour est recalculé sur le planning déjà corrigé, puis l'option choisie est appliquée.
      const frais = optionsReparation(useStore.getState().data, x.trou.shift, today).options;
      const voulue = x.retenue ? cleOption(x.retenue) : '';
      const o = voulue === 'moi' ? parMoi(x.trou, useStore.getState().data) : (frais.find((y) => cleOption(y) === voulue) ?? frais.find((y) => y.recommande) ?? frais[0]);
      if (o) resoudre(x.trou.id, o);
    }
    dire(`${regles} jour${regles > 1 ? 's' : ''} réglé${regles > 1 ? 's' : ''}${aLaMain.length ? `, ${aLaMain.length} à régler à la main` : ''}.`, true);
    // Ce qui reste à régler à la main : on arrive sur la case concernée.
    if (aLaMain.length) montrerDansPlanning({ date: aLaMain[0].trou.shift.date, personId: aLaMain[0].trou.shift.personId });
    onClose();
  };
  return (
    <Dialog
      size="wide"
      title="Comment régler cette absence ?"
      subtitle={`${titre} · ${trous.length} jour${trous.length > 1 ? 's' : ''}. La solution conseillée est cochée : gardez-la, changez-la, ou réglez le jour à la main.`}
      onClose={onClose}
      footer={
        <>
          <span className="grow small soft">
            {regles} jour{regles > 1 ? 's' : ''} réglé{regles > 1 ? 's' : ''} par vos choix{aLaMain.length ? ` · ${aLaMain.length} à la main, dans le planning` : ''}. Rien n’est appliqué avant votre accord.
          </span>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn primary" disabled={!regles && !aLaMain.length} onClick={appliquer}>
            <Check size={15} aria-hidden="true" /> Appliquer mes choix
          </button>
        </>
      }
    >
      {plan.map(({ trou, rep, retenue, main }) => (
        <fieldset key={trou.id} className="rs-jour">
          <legend>
            <b className="cap1">{fmtDateLong(trou.shift.date).replace(/ \d{4}$/, '')}</b>
            <span className="small soft">Poste vacant : {decrireShift(trou.shift)}</span>
          </legend>
          {rep.impact.length ? <p className="rs-impact">{rep.impact.join(' ')}</p> : <p className="rs-impact ok">Rien n’est découvert ce jour-là.</p>}
          {rep.options.map((o) => {
            const on = !!retenue && cleOption(retenue) === cleOption(o);
            return (
              <label key={cleOption(o)} className={`rs-option${on ? ' on' : ''}`}>
                <input type="radio" name={`reglage-${trou.id}`} checked={on} onChange={() => setChoix((c) => ({ ...c, [trou.id]: cleOption(o) }))} />
                <span className="rs-corps">
                  <span className="rs-tete">
                    <b>{o.titre}</b>
                    {o.recommande ? <span className="rs-conseil">Conseillé</span> : null}
                    <Pill tone={COUVERTURE[o.couverture].tone}>{COUVERTURE[o.couverture].label}</Pill>
                  </span>
                  <span className="small soft">{o.resume}</span>
                  {on && o.changements.length ? (
                    <span className="rs-changements">
                      {o.changements.map((c, i) => (
                        <span key={i}>
                          <b>{nom(c.personId)}</b> <span className="soft">{JOURS[weekday(c.date)]}</span> <AvantApres avant={c.avant} apres={c.apres} />
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {on ? (
                    <span className="rs-faits small">
                      <span>{o.personnesTouchees.length ? `Touche ${o.personnesTouchees.map(nom).join(', ')}` : 'Personne d’autre n’est touché'}</span>
                      <SiCouts>
                        <span>{o.coutSupp > 0 ? `+ ${fmtEuros(o.coutSupp)}` : 'Sans coût en plus'}</span>
                      </SiCouts>
                      {o.regles.length ? <span>{o.regles.every((r) => r.ok) ? 'Règles respectées' : 'Une règle à regarder'}</span> : null}
                      {o.restant.length ? <span className="reste">Reste : {o.restant.join(' ')}</span> : null}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
          <label className={`rs-option libre${main ? ' on' : ''}`}>
            <input type="radio" name={`reglage-${trou.id}`} checked={main} onChange={() => setChoix((c) => ({ ...c, [trou.id]: MAIN }))} />
            <span className="rs-corps">
              <span className="rs-tete">
                <b>Je règle ce jour à la main</b>
              </span>
              <span className="small soft">Rien n’est changé pour ce jour. Le planning de la semaine s’ouvre ensuite pour déplacer ou ajouter un poste vous-même.</span>
            </span>
          </label>
        </fieldset>
      ))}
    </Dialog>
  );
}

function CarteTrou({ trou, ouvert }: { trou: Trou; ouvert: boolean }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const resoudre = useStore((s) => s.resoudreTrou);
  const dire = useUi((s) => s.dire);
  const rep = useMemo(() => optionsReparation(data, trou.shift, today), [data, trou, today]);
  const publie = data.semaines[mondayOf(trou.shift.date)]?.statut === 'publie';
  const nom = (id: string): string => {
    const p = data.personnes.find((x) => x.id === id);
    return p ? nomCourt(p) : '-';
  };
  if (!rep.impact.length && rep.options.length === 1) {
    const o = rep.options[0];
    return (
      <div className="decision" style={{ borderTop: '1px solid var(--line)', alignItems: 'center' }}>
        <CircleCheck size={18} style={{ color: 'var(--ok)' }} />
        <div className="grow">
          <b>{capitale(fmtDateLong(trou.shift.date).replace(/ \d{4}$/, ''))}</b> · poste vacant : {decrireShift(trou.shift)}
          <div className="soft small" style={{ marginTop: 2 }}>
            Cette absence ne découvre aucune plage : le reste de l'équipe suffit. {o.restant.join(' ')}
          </div>
        </div>
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            resoudre(trou.id, o);
            dire('Journée classée sans remplacement.', true);
          }}
        >
          Classer
        </button>
      </div>
    );
  }
  return (
    <details className="volet" open={ouvert}>
      <summary>
        <ChevronDown size={18} className="chev" aria-hidden="true" />
        <h3 className="grow">{capitale(fmtDateLong(trou.shift.date).replace(/ \d{4}$/, ''))}</h3>
        <span className="small soft">Poste vacant : {decrireShift(trou.shift)}</span>
        <Pill tone={rep.impact.length ? 'danger' : 'ok'}>{rep.impact.length ? `${rep.options.length} option${rep.options.length > 1 ? 's' : ''} à comparer` : 'Rien n’est découvert'}</Pill>
      </summary>
      <div className="volet-corps">
      {rep.impact.length ? (
        <div className="notice danger" style={{ marginBottom: 14 }}>
          <AlertTriangle size={16} />
          <div>
            <b>À couvrir</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {rep.impact.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="notice ok" style={{ marginBottom: 14 }}>
          <CircleCheck size={16} /> Cette absence ne découvre aucune plage : le reste de l'équipe suffit.
        </div>
      )}
      <TourDeRole trou={trou} />
      <h4 className="appel-ou">Ou réglez-le vous-même</h4>
      <div className="options">
        {rep.options.map((o) => (
          <div key={o.id} className={`option${o.recommande ? ' reco' : ''}`}>
            {o.recommande ? <span className="reco-tag">Conseillé</span> : null}
            <div>
              <h3>{o.titre}</h3>
              <p className="soft small" style={{ marginTop: 4 }}>{o.resume}</p>
            </div>
            <div>
              <Pill tone={COUVERTURE[o.couverture].tone}>{COUVERTURE[o.couverture].label}</Pill>
            </div>
            <dl className="facts">
              <dt>Personnes touchées</dt>
              <dd>{o.personnesTouchees.length ? o.personnesTouchees.map(nom).join(', ') : 'Aucune dans l’équipe'}</dd>
              <dt>Horaires modifiés</dt>
              <dd>{o.creneauxModifies || 'Aucun'}</dd>
              <SiCouts>
                <dt>Coût en plus</dt>
                <dd className="num">{o.coutSupp > 0 ? `+ ${fmtEuros(o.coutSupp)}` : 'Aucun'}</dd>
              </SiCouts>
            </dl>
            {o.changements.length ? (
              <div className="col small" style={{ gap: 4 }}>
                {o.changements.map((c, i) => (
                  <div key={i}>
                    <b>{nom(c.personId)}</b> · {JOURS[weekday(c.date)]}
                    <br />
                    <AvantApres avant={c.avant} apres={c.apres} />
                  </div>
                ))}
              </div>
            ) : null}
            <details className="plus">
              <summary>
                <ChevronDown size={15} className="chev" aria-hidden="true" />
                {o.validations.length ? `${o.validations.length} point${o.validations.length > 1 ? 's' : ''} à valider` : 'Rien à valider'} · {o.regles.every((r) => r.ok) ? 'règles respectées' : 'une règle n’est pas respectée'}
              </summary>
              {o.validations.length ? (
                <div className="small">
                  <span className="eyebrow">À valider</span>
                  <ul style={{ margin: '3px 0 0', paddingLeft: 18 }}>
                    {o.validations.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ul className="checks" aria-label="Règles contrôlées">
                {o.regles.map((r) => (
                  <li key={r.label}>
                    {r.ok ? <Check size={14} className="y" aria-label="Respecté" /> : <X size={14} className="n" aria-label="Non respecté" />}
                    {r.label}
                  </li>
                ))}
              </ul>
            </details>
            {o.restant.length ? (
              <div className="notice warn small">
                <AlertTriangle size={15} />
                <div>
                  <b>Reste à régler</b>
                  {o.restant.map((r) => (
                    <div key={r}>{r}</div>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className={`btn ${o.recommande ? 'primary' : ''}`}
              style={{ marginTop: 'auto' }}
              onClick={() => {
                resoudre(trou.id, o);
                dire(publie && (o.changements.length || o.patch.liberer.length) ? 'Option retenue. Pensez à publier la modification pour prévenir l’équipe.' : 'Option retenue.', true, {
                  label: 'Voir dans le planning',
                  faire: () => montrerDansPlanning({ date: trou.shift.date, personId: trou.shift.personId }),
                });
              }}
            >
              Choisir
            </button>
          </div>
        ))}
      </div>
      </div>
    </details>
  );
}

// ------------------------------------------------------------------ Demandes

/** Ce que l'approbation d'un congé découvrirait, calculé avant de décider. */
function simulerAbsence(data: AppData, a: Absence): { messages: string[]; garde: boolean; sansPlanning: boolean } {
  const sim: AppData = {
    ...data,
    absences: data.absences.map((x) => (x.id === a.id ? { ...x, statut: 'approuvee' as const } : x)),
    shifts: data.shifts.filter((s) => !(s.personId === a.personId && s.date >= a.from && s.date <= a.to)),
  };
  const messages: string[] = [];
  let sansPlanning = false;
  for (let monday = mondayOf(a.from); monday <= a.to; monday = addDays(monday, 7)) {
    const avantDiag = new Set(diagnosticPrealable(data, monday).map((b) => b.titre));
    for (const b of diagnosticPrealable(sim, monday)) {
      if (b.cas === 'impossible' && !avantDiag.has(b.titre)) messages.push(b.message);
    }
    if (!shiftsSemaine(data, monday).length) {
      sansPlanning = true;
      continue;
    }
    const avant = new Set(validateWeek(data, monday).map((i) => i.id));
    for (const i of validateWeek(sim, monday)) {
      if (!avant.has(i.id) && i.gravite !== 'info' && (i.regle === 'pharmacie.presence' || i.regle === 'equipe.effectif')) messages.push(i.message);
    }
  }
  const garde = data.gardes.some((g) => g.personId === a.personId && congesIncompatibles(sim, g));
  return { messages: [...new Set(messages)], garde, sansPlanning };
}

/** La raison donnée par la personne pour sa demande ; les demandes anciennes n'en portent pas. */
function Raison({ motif, precision }: { motif?: MotifDemande; precision?: string }): JSX.Element {
  return (
    <div className="demande-motif">
      <span className="small soft">Raison donnée</span>
      <b>{motif ? MOTIF_DEMANDE_LABEL[motif] : 'Non précisée'}</b>
      {precision ? <span className="small">« {precision} »</span> : null}
    </div>
  );
}

function DemandeAbsence({ absence }: { absence: Absence }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const decider = useStore((s) => s.deciderAbsence);
  const dire = useUi((s) => s.dire);
  const p = data.personnes.find((x) => x.id === absence.personId);
  const sim = useMemo(() => simulerAbsence(data, absence), [data, absence]);
  // Qui d'autre est absent, ou demande à l'être, sur ces dates : pour ne pas répondre à l'un en oubliant l'autre.
  const memeTemps = useMemo(() => absencesSimultanees(data, absence), [data, absence]);
  const nomDe = (id: string): string => {
    const x = data.personnes.find((y) => y.id === id);
    return x ? nomCourt(x) : 'un collègue';
  };
  const [decision, setDecision] = useState(false);
  const acc = absence.type === 'accident' ? absence.accident : undefined;
  const jours = dayIndex(absence.to) - dayIndex(absence.from) + 1;
  // Les postes déjà planifiés sur la période : ceux qu'un accord rendrait à couvrir.
  const postes = data.shifts.filter((s) => s.personId === absence.personId && s.date >= absence.from && s.date <= absence.to).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const objet = `${libelleAbsence(absence).toLowerCase()}, du ${fmtDateCourt(absence.from)} au ${fmtDateCourt(absence.to)}`;
  return (
    <div className="decision">
      <Avatar person={p} />
      <div className="grow" style={{ minWidth: 280 }}>
        <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
          <span className={`pill nature ${classeAbsence(absence.type)}`}>{libelleAbsence(absence)}</span>
          {absence.imprevue ? <span className="pill danger">Imprévue, signalée par {p?.prenom ?? 'la personne'}</span> : null}
          <Delai date={absence.from} today={today} />
          {memeTemps.demandees.length ? (
            <span className="pill warn">
              <Users size={13} aria-hidden="true" /> {memeTemps.demandees.length + 1} demandes sur ces dates
            </span>
          ) : null}
        </div>
        <b>{p ? nomCourt(p) : '-'}</b>
        <div className="soft small" style={{ marginTop: 3 }}>
          Du {fmtDateCourt(absence.from)} au {fmtDateCourt(absence.to)} · {jours} jour{jours > 1 ? 's' : ''}
        </div>
        <Raison motif={absence.motif} precision={absence.precision} />
        <div className="col" style={{ gap: 6, marginTop: 9 }}>
          {memeTemps.demandees.length || memeTemps.accordees.length ? (
            <div className="notice info small meme-temps">
              <Users size={15} aria-hidden="true" />
              <div>
                <b>En même temps</b>
                {memeTemps.demandees.map((x) => (
                  <div key={x.absence.id}>
                    {nomDe(x.absence.personId)} demande aussi : {libelleAbsence(x.absence).toLowerCase()} du {fmtDateCourt(x.absence.from)} au {fmtDateCourt(x.absence.to)}, {x.jours} jour{x.jours > 1 ? 's' : ''} en commun. Sa demande est arrivée {x.avant ? 'avant' : 'après'} celle-ci.
                  </div>
                ))}
                {memeTemps.accordees.map((x) => (
                  <div key={x.absence.id}>
                    {nomDe(x.absence.personId)} est déjà absent : {libelleAbsence(x.absence).toLowerCase()} du {fmtDateCourt(x.absence.from)} au {fmtDateCourt(x.absence.to)}, {x.jours} jour{x.jours > 1 ? 's' : ''} en commun.
                  </div>
                ))}
                {memeTemps.demandees.length ? <div className="soft">Répondez aux deux demandes : accepter l’une peut rendre l’autre impossible.</div> : null}
              </div>
            </div>
          ) : null}
          {sim.garde ? (
            <div className="notice danger small">
              <AlertTriangle size={15} /> Une garde est déjà affectée à {p ? nomCourt(p) : 'cette personne'} sur cette période : approuver le congé imposera de la réaffecter.
            </div>
          ) : null}
          {sim.messages.length ? (
            <div className="notice warn small">
              <AlertTriangle size={15} />
              <div>
                <b>Si vous approuvez</b>
                {sim.messages.slice(0, 4).map((m) => (
                  <div key={m}>{m}</div>
                ))}
                {sim.messages.length > 4 ? <div>… et {sim.messages.length - 4} autre{sim.messages.length - 4 > 1 ? 's' : ''} plage{sim.messages.length - 4 > 1 ? 's' : ''}</div> : null}
              </div>
            </div>
          ) : (
            <div className="notice ok small">
              <CircleCheck size={15} />
              {sim.sansPlanning
                ? 'Aucune impossibilité démontrée. Le planning de cette période n’est pas encore construit : le congé sera pris en compte dès la génération.'
                : 'Approuver ce congé ne découvre aucune plage.'}
            </div>
          )}
        </div>
      </div>
      <div className="row">
        {/* Une demande ne se tranche pas d'un clic : « Décider » montre ce qu'elle implique, puis les décisions possibles. */}
        <button type="button" className="btn sm primary" data-decider={absence.id} onClick={() => setDecision(true)}>
          <ListChecks size={14} aria-hidden="true" /> Décider
        </button>
        {decision ? (
          <DialogueDecision
            titre={`Décider : ${libelleAbsence(absence).toLowerCase()} de ${p ? nomCourt(p) : 'la personne'}`}
            sousTitre={`Du ${fmtDateCourt(absence.from)} au ${fmtDateCourt(absence.to)}, ${jours} jour${jours > 1 ? 's' : ''}.`}
            personne={p}
            demande={
              <dl className="dr-faits">
                <dt>Demande</dt>
                <dd>
                  {libelleAbsence(absence)}, {jours} jour{jours > 1 ? 's' : ''}
                </dd>
                {acc ? (
                  <>
                    <dt>Accident</dt>
                    <dd>
                      {LIEU_ACCIDENT_LABEL[acc.ou]}, le {fmtDateCourt(acc.jour)}
                      {acc.heure !== undefined ? ` vers ${fmtHeure(acc.heure)}` : ''}
                      {acc.circonstances ? ` : « ${acc.circonstances} »` : ''}
                      {acc.temoin ? ` Témoin ou première personne prévenue : ${acc.temoin}.` : ''}
                    </dd>
                  </>
                ) : null}
                <dt>{acc ? 'Un mot' : 'Raison'}</dt>
                <dd>
                  {absence.motif ? MOTIF_DEMANDE_LABEL[absence.motif] : acc && !absence.precision ? 'Aucun' : 'Non précisée'}
                  {absence.precision ? ` : « ${absence.precision} »` : ''}
                </dd>
                <dt>Délai</dt>
                <dd>
                  <Delai date={absence.from} today={today} />
                </dd>
              </dl>
            }
            implications={
              <>
                {acc && !acc.declareLe ? (
                  <p className="dr-alerte" id="dc-accident">
                    Un accident du travail se déclare à la caisse d’assurance maladie dans les 48 heures, dimanches et jours fériés non comptés : au plus tard le {fmtDateCourt(echeanceDeclaration(acc.connuLe))}. Le rappel reste sur votre tableau de bord tant que la déclaration n’est pas notée comme faite.
                  </p>
                ) : null}
                <p className={postes.length ? 'dr-alerte' : 'dr-ok'}>
                  {postes.length
                    ? `${postes.length} poste${postes.length > 1 ? 's sont déjà planifiés' : ' est déjà planifié'} sur ces dates : ${postes
                        .slice(0, 4)
                        .map((x) => `${fmtDateCourt(x.date)}, ${fmtHeure(x.start)} – ${fmtHeure(x.end)}`)
                        .join(' ; ')}${postes.length > 4 ? '…' : ''}. Si vous acceptez, ${postes.length > 1 ? 'ils passent' : 'il passe'} dans « Absences à couvrir », avec les options de remplacement comparées.`
                    : sim.sansPlanning
                      ? 'Aucun poste n’est encore planifié sur ces dates : l’absence sera prise en compte quand vous construirez le planning.'
                      : 'Aucun poste n’est planifié sur ces dates : rien à couvrir.'}
                </p>
                {sim.messages.length ? (
                  <ul className="dr-risques">
                    {sim.messages.slice(0, 5).map((m) => (
                      <li key={m} className={/pharmacien/i.test(m) ? 'bad' : undefined}>
                        {m}
                      </li>
                    ))}
                    {sim.messages.length > 5 ? <li>… et {sim.messages.length - 5} autre{sim.messages.length - 5 > 1 ? 's' : ''} plage{sim.messages.length - 5 > 1 ? 's' : ''} à regarder.</li> : null}
                  </ul>
                ) : postes.length ? (
                  <p className="dr-ok">Même sans {p?.prenom ?? 'cette personne'}, un pharmacien reste présent et l’effectif attendu est atteint.</p>
                ) : null}
                {sim.garde ? <p className="dr-alerte">Une garde lui est confiée sur cette période : accepter imposera de la réaffecter.</p> : null}
                {memeTemps.demandees.length || memeTemps.accordees.length ? (
                  <p className="dr-alerte">
                    En même temps :{' '}
                    {[...memeTemps.accordees.map((x) => `${nomDe(x.absence.personId)} est déjà absent (${x.jours} jour${x.jours > 1 ? 's' : ''} en commun)`), ...memeTemps.demandees.map((x) => `${nomDe(x.absence.personId)} demande aussi ces dates (${x.jours} jour${x.jours > 1 ? 's' : ''} en commun)`)].join(' ; ')}
                    .{memeTemps.demandees.length ? ' Accepter l’une peut rendre l’autre impossible.' : ''}
                  </p>
                ) : null}
              </>
            }
            options={[
              {
                cle: 'accepter',
                titre: acc ? 'Prendre acte de l’accident' : 'Accepter la demande',
                phrase: `${acc ? 'L’arrêt' : 'L’absence'} est ${acc ? 'enregistré' : 'enregistrée'}${postes.length ? ` ; ${postes.length > 1 ? 'ses postes sont' : 'son poste est'} à couvrir dans « Résoudre ».` : ' et pris en compte dans les plannings.'}${acc ? ' Il vous reste à déclarer l’accident.' : ''}`,
                icone: Check,
              },
              // Un accident ne se refuse pas comme un congé : on écarte seulement un signalement fait par erreur.
              { cle: 'refuser', titre: acc ? 'Écarter ce signalement' : 'Refuser', phrase: acc ? `À réserver à une erreur de saisie : ${p?.prenom ?? 'la personne'} garde ses postes et reçoit votre raison.` : `${p?.prenom ?? 'La personne'} garde ses postes et reçoit votre raison.`, icone: X, refus: true },
            ]}
            raisons={acc ? ['Signalement fait par erreur', 'Déjà enregistré par ailleurs'] : RAISONS_REFUS.absence}
            message={(cle, motif) => (cle === 'accepter' ? (acc ? `Votre ${libelleAbsence(absence).toLowerCase()} est pris en compte, du ${fmtDateCourt(absence.from)} au ${fmtDateCourt(absence.to)}. La pharmacie se charge de la déclaration à la caisse.` : `Votre demande (${objet}) est acceptée.`) : texteRefus(`(${objet})`, motif))}
            bouton={(cle) => (cle === 'accepter' ? (acc ? 'Prendre acte' : 'Accepter la demande') : acc ? 'Écarter le signalement' : `Refuser et prévenir ${p?.prenom ?? 'la personne'}`)}
            onConfirmer={(cle, motif) => {
              decider(absence.id, cle === 'accepter', cle === 'accepter' ? undefined : motif);
              dire(cle === 'accepter' ? `${acc ? 'Accident pris en compte' : 'Demande acceptée'}.${postes.length ? ` ${postes.length} poste${postes.length > 1 ? 's' : ''} à couvrir dans « Résoudre ».` : ''}` : `Demande refusée. ${p?.prenom ?? 'La personne'} est prévenu.`, true);
            }}
            onClose={() => setDecision(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

export function usagePlafond(data: AppData, personId: string, today: ISODate): { actifs: number; plafond: number } {
  const actifs = data.besoins.filter(
    (b) => b.personId === personId && b.decision === 'acceptee' && b.statut === 'prioritaire' && !b.horsPlafond && (!b.to || b.to >= today),
  ).length;
  return { actifs, plafond: data.officine.plafondPrioritaires };
}

function DemandeBesoin({ besoin }: { besoin: Besoin }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const decider = useStore((s) => s.deciderBesoin);
  const dire = useUi((s) => s.dire);
  const p = data.personnes.find((x) => x.id === besoin.personId);
  const [refus, setRefus] = useState(false);
  const usage = usagePlafond(data, besoin.personId, today);
  // Les postes à venir qui ne respecteraient pas la demande si elle était acceptée.
  const contredits = data.shifts.filter((x) => x.personId === besoin.personId && x.date >= today && besoinApplicable({ ...besoin, decision: 'acceptee' }, x.date) && contreditBesoin(besoin, x)).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="decision">
      <Avatar person={p} />
      <div className="grow" style={{ minWidth: 280 }}>
        <b>Demande de {p ? nomCourt(p) : '-'} à arbitrer</b>
        <div style={{ marginTop: 3 }}>{decrireBesoin(besoin)}</div>
        <div className="soft small" style={{ marginTop: 3 }}>
          {besoin.from ? `À partir du ${fmtDateCourt(besoin.from)}` : 'Sans date de début'}
          {besoin.to ? ` jusqu'au ${fmtDateCourt(besoin.to)}` : ''}
        </div>
        <Raison motif={besoin.motif} precision={besoin.precision} />
        <div className="row wrap small" style={{ marginTop: 9 }}>
          <Pill title="Plafond identique pour toute l'équipe">
            Demandes prioritaires actives : {usage.actifs} / {usage.plafond}
          </Pill>
        </div>
      </div>
      <div className="row">
        <button type="button" className="btn sm primary" data-decider={besoin.id} onClick={() => setRefus(true)}>
          <ListChecks size={14} aria-hidden="true" /> Décider
        </button>
        {refus ? (
          <DialogueDecision
            titre={`Décider : demande d’horaires de ${p ? nomCourt(p) : 'la personne'}`}
            sousTitre={decrireBesoin(besoin)}
            personne={p}
            demande={
              <dl className="dr-faits">
                <dt>Demande</dt>
                <dd>{decrireBesoin(besoin)}</dd>
                <dt>Période</dt>
                <dd>
                  {besoin.from ? `À partir du ${fmtDateCourt(besoin.from)}` : 'Sans date de début'}
                  {besoin.to ? `, jusqu’au ${fmtDateCourt(besoin.to)}` : ''}
                </dd>
                <dt>Raison</dt>
                <dd>
                  {besoin.motif ? MOTIF_DEMANDE_LABEL[besoin.motif] : 'Non précisée'}
                  {besoin.precision ? ` : « ${besoin.precision} »` : ''}
                </dd>
              </dl>
            }
            implications={
              <>
                <p className={contredits.length ? 'dr-alerte' : 'dr-ok'}>
                  {contredits.length
                    ? `${contredits.length} poste${contredits.length > 1 ? 's déjà planifiés ne respectent' : ' déjà planifié ne respecte'} pas cette demande : ${contredits
                        .slice(0, 3)
                        .map((x) => `${fmtDateCourt(x.date)}, ${fmtHeure(x.start)} – ${fmtHeure(x.end)}`)
                        .join(' ; ')}${contredits.length > 3 ? '…' : ''}. Ils ne changent pas tout seuls : à vous de les corriger dans « Construire ».`
                    : 'Aucun poste déjà planifié ne contredit cette demande.'}
                </p>
                <p className="small soft" style={{ margin: 0 }}>
                  Demandes prioritaires actives de {p?.prenom ?? 'cette personne'} : {usage.actifs} sur {usage.plafond}, le même plafond pour toute l’équipe. Une indisponibilité reconnue devient une règle pour le calcul : aucun poste n’y est proposé.
                </p>
              </>
            }
            options={[
              { cle: 'preference', titre: 'Accepter comme simple préférence', phrase: 'Le planning en tient compte quand c’est possible.', icone: Check },
              { cle: 'prioritaire', titre: 'Accepter comme préférence prioritaire', phrase: usage.actifs >= usage.plafond ? 'Son plafond de demandes prioritaires est atteint.' : 'Elle passe avant les simples préférences, et compte dans son plafond.', icone: ArrowRight, off: usage.actifs >= usage.plafond },
              { cle: 'reconnue', titre: 'Reconnaître une indisponibilité', phrase: 'Aucun poste ne sera proposé sur cette plage : c’est une règle pour le calcul.', icone: CircleCheck },
              { cle: 'refuser', titre: 'Refuser', phrase: `${p?.prenom ?? 'La personne'} reçoit votre raison ; le refus compte dans la mémoire d’équité.`, icone: X, refus: true },
            ]}
            raisons={RAISONS_REFUS.horaire}
            message={(cle, motif) =>
              cle === 'refuser' ? texteRefus(`« ${decrireBesoin(besoin)} »`, motif) : `Votre demande « ${decrireBesoin(besoin)} » est acceptée, comme ${cle === 'reconnue' ? 'indisponibilité reconnue' : cle === 'prioritaire' ? 'préférence prioritaire' : 'simple préférence'}.`
            }
            bouton={(cle) => (cle === 'refuser' ? `Refuser et prévenir ${p?.prenom ?? 'la personne'}` : 'Accepter la demande')}
            onConfirmer={(cle, motif) => {
              if (cle === 'refuser') decider(besoin.id, false, undefined, motif);
              else decider(besoin.id, true, cle as BesoinStatut);
              dire(cle === 'refuser' ? 'Demande refusée. Le refus est compté dans la mémoire d’équité.' : 'Demande acceptée.', true);
            }}
            onClose={() => setRefus(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Étapes de démarrage : visibles tant que la première semaine n'est pas publiée. */
function Demarrage(): JSX.Element | null {
  const data = useStore((s) => s.data);
  const { aller, setTour } = useUi();
  const internes = data.personnes.filter((p) => !p.externe);
  const etapes = [
    {
      titre: 'Compléter l’équipe',
      texte: internes.length ? `${internes.length} personne${internes.length > 1 ? 's' : ''} dans l’équipe. Ajoutez contrats, compétences et besoins.` : 'Ajoutez le titulaire, les pharmaciens et les préparateurs.',
      fait: internes.length >= 2 && internes.some((p) => p.qualification === 'titulaire' || p.qualification === 'adjoint'),
      icone: <Users size={18} />,
      ton: 'mint',
      vers: 'equipe' as const,
    },
    {
      titre: 'Construire une première semaine',
      texte: 'Faites-vous proposer trois plannings, ou posez les postes à la main.',
      fait: data.shifts.length > 0,
      icone: <CalendarRange size={18} />,
      ton: 'sun',
      vers: 'construire' as const,
    },
    {
      titre: 'Publier le planning',
      texte: 'Une fois publié, il devient la version officielle que voit l’équipe.',
      fait: Object.values(data.semaines).some((x) => x.statut === 'publie'),
      icone: <Send size={18} />,
      ton: 'sky',
      vers: 'construire' as const,
    },
  ];
  if (etapes.every((e) => e.fait)) return null;
  const prochaine = etapes.findIndex((e) => !e.fait);
  return (
    <section className="col" style={{ gap: 14, marginBottom: 26 }} aria-label="Bien démarrer">
      <div className="welcome">
        <p className="eyebrow">Bien démarrer</p>
        <h2 style={{ marginTop: 8 }}>{data.officine.nom || 'Votre officine'} est prête.</h2>
        <p>Trois étapes pour arriver à votre premier planning publié. Le tutoriel vous montre où tout se trouve en une minute.</p>
        <div className="row wrap" style={{ marginTop: 20 }}>
          <button type="button" className="btn primary" onClick={() => aller(etapes[prochaine].vers)}>
            {etapes[prochaine].titre} <ArrowRight size={15} />
          </button>
          <button type="button" className="btn" onClick={() => setTour(0)}>
            <CircleHelp size={15} /> Suivre le tutoriel
          </button>
        </div>
      </div>
      <ol className="steps">
        {etapes.map((e, i) => (
          <li key={e.titre}>
            <button type="button" className={`stepcard${e.fait ? ' done' : i === prochaine ? ' next' : ''}`} onClick={() => aller(e.vers)}>
              <span className="no">
                Étape {i + 1}
                {e.fait ? ' · faite' : i === prochaine ? ' · à faire maintenant' : ''}
              </span>
              <span className={`ico ${e.fait ? 'mint' : e.ton}`} aria-hidden="true">
                {e.fait ? <Check size={18} /> : e.icone}
              </span>
              <b>{e.titre}</b>
              <span className="small">{e.texte}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Un poste à reprendre : chaque volontaire est relu par le moteur avant que le responsable ne valide. */
function DemandeRemplacement({ remplacement: r }: { remplacement: Remplacement }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { validerRemplacement, cloreRemplacement, deciderDemande } = useStore();
  const { dire, demandeVisee, viserDemande } = useUi();
  const demandeur = data.personnes.find((p) => p.id === r.demandeur);
  const attente = r.accord === 'attente';
  // Adressée à un collègue, la demande montre sa réponse sans attendre l'accord du titulaire.
  const tour = useMemo(() => (attente && !r.destinataire ? [] : tourRemplacement(data, r, today)), [data, r, today, attente]);
  const adresse = r.destinataire ? data.personnes.find((p) => p.id === r.destinataire) : undefined;
  const refusCollegue = !!r.destinataire && (r.indisponibles ?? []).includes(r.destinataire);
  // Pour décider : combien de fois cette personne a demandé à être remplacée sur trois mois.
  const deja = data.remplacements.filter((x) => x.demandeur === r.demandeur && !x.trouId && x.date >= addDays(today, -90) && x.statut !== 'annulee').length;
  const [refus, setRefus] = useState(false);
  const [decision, setDecision] = useState(false);
  const volontaires = tour.filter((c) => c.volontaire);
  const premier = aSonTour(tour);
  const urgence = r.urgence ?? 'prevu';
  const ref = useRef<HTMLDivElement>(null);
  const visee = demandeVisee === r.id;
  useEffect(() => {
    if (!visee) return;
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = window.setTimeout(() => viserDemande(null), 2600);
    return () => window.clearTimeout(t);
  }, [visee, viserDemande]);
  /** Ce que le poste ajouterait au compteur du volontaire cette semaine. */
  const enPlus = (id: string): string => {
    const p = data.personnes.find((x) => x.id === id);
    if (!p || !p.salarie) return '';
    const monday = mondayOf(r.date);
    const ecart = minutesSemaine(data, id, monday) + (r.end - r.start) - cibleSemaine(data, p, monday);
    return ecart > 0 ? ` · +${fmtDuree(ecart)} sur son contrat` : '';
  };
  return (
    <div ref={ref} className={`decision demande-r u-${urgence}${visee ? ' visee' : ''}`} style={{ alignItems: 'flex-start' }} data-focus="demande-remplacement">
      <Avatar person={demandeur} />
      <div className="grow col" style={{ gap: 10, minWidth: 220 }}>
        <div>
          <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
            <PastilleUrgence urgence={urgence} />
            <Delai date={r.date} today={today} />
          </div>
          <b>{demandeur ? nomCourt(demandeur) : '-'}</b> {adresse ? <>demande à <b>{nomCourt(adresse)}</b> de le remplacer</> : 'demande à être remplacé'}{' '}
          <b>
            {fmtDateCourt(r.date)}, {fmtHeure(r.start)} – {fmtHeure(r.end)}
          </b>
          {adresse ? (
            <div className="small soft">
              {refusCollegue ? `${adresse.prenom} ne peut pas. ${demandeur ? demandeur.prenom : 'Le demandeur'} peut ouvrir la demande à toute l’équipe.` : r.volontaires.includes(adresse.id) ? `${adresse.prenom} est d’accord : il reste à valider.` : `${adresse.prenom} n’a pas encore répondu.`}
            </div>
          ) : attente ? (
            <div className="small soft">« Décider » ouvre ce qu’il faut pour trancher : qui peut reprendre le poste, ce qui se passe s’il n’est pas repris, puis votre décision.</div>
          ) : (
            <div className="small soft">Demande acceptée. Sans remplaçant confirmé, le poste reste le sien.</div>
          )}
        </div>
        <div className="rm-faits">
          <span className={r.motif ? 'motif' : 'motif absent'}>
            Motif : <b>{r.motif ? MOTIF_REMPLACEMENT_LABEL[r.motif] : 'non précisé'}</b>
            {r.precision ? ` - « ${r.precision} »` : ''}
          </span>
          <span title="Demandes de remplacement de cette personne sur les trois derniers mois, celle-ci comprise">
            {deja <= 1 ? '1re demande en 3 mois' : `${deja}e demande en 3 mois`}
          </span>
        </div>
        {r.justificatif ? (
          r.justificatif.data ? (
            <span className="piece-bloc">
              <a className="btn sm piece-lien" href={r.justificatif.data} download={r.justificatif.nom}>
                <Paperclip size={14} aria-hidden="true" /> Justificatif : {r.justificatif.nom}
              </a>
              <span className="small soft">Conservé dans « Documents » après votre décision.</span>
            </span>
          ) : (
            <span className="small soft">Justificatif rangé dans « Documents ».</span>
          )
        ) : null}
        {!attente && !volontaires.length && !adresse ? (
          <div className="small soft">
            {tour.filter((c) => c.ok).length} personne{tour.filter((c) => c.ok).length > 1 ? 's' : ''} prévenue{tour.filter((c) => c.ok).length > 1 ? 's' : ''}, aucun volontaire pour l’instant.
          </div>
        ) : null}
        {volontaires.map((c) => {
          const p = data.personnes.find((x) => x.id === c.personId);
          const sonTour = premier?.personId === c.personId;
          return (
            <div key={c.personId} className="row wrap" style={{ gap: 10 }}>
              <Avatar person={p} />
              <div className="grow" style={{ minWidth: 180 }}>
                <b>{p ? nomCourt(p) : '-'}</b> se propose
                <div className="small soft">
                  {c.ok ? `Règles respectées${enPlus(c.personId)} · ${c.depannages ? `${c.depannages} dépannage${c.depannages > 1 ? 's' : ''} sur 3 mois` : 'aucun dépannage sur 3 mois'}` : c.raisons.join(' · ')}
                </div>
              </div>
              {c.ok ? (
                <>
                  {sonTour && volontaires.filter((x) => x.ok).length > 1 ? <Pill tone="ok">À son tour</Pill> : null}
                  <button
                    type="button"
                    className={`btn sm${sonTour ? ' primary' : ''}`}
                    onClick={() => {
                      validerRemplacement(r.id, c.personId);
                      dire(`Remplacement validé : ${p ? nomCourt(p) : ''} reprend le poste${enPlus(c.personId)}. Les deux personnes sont prévenues.`, true, {
                        label: 'Voir dans le planning',
                        faire: () => montrerDansPlanning({ date: r.date, personId: c.personId }),
                      });
                    }}
                  >
                    <Check size={14} aria-hidden="true" /> Valider avec {p?.prenom}
                  </button>
                </>
              ) : (
                <Pill tone="warn">Impossible en l’état</Pill>
              )}
            </div>
          );
        })}
      </div>
      {attente && !adresse ? (
        // Une demande à trancher ouvre la fenêtre de décision : ce qu'il faut savoir, puis trois décisions possibles.
        <button type="button" className="btn primary sm" data-decider={r.id} onClick={() => setDecision(true)}>
          <ListChecks size={14} aria-hidden="true" /> Décider
        </button>
      ) : (
        <>
          {attente && !(adresse && volontaires.some((c) => c.ok)) ? (
            <button
              type="button"
              className="btn primary sm"
              onClick={() => {
                deciderDemande(r.id, true);
                dire(adresse && !refusCollegue ? `Accord donné. Il reste à ${adresse.prenom} de répondre.` : 'Demande acceptée : l’équipe disponible est prévenue.', true);
              }}
            >
              <Check size={14} aria-hidden="true" /> Accepter
            </button>
          ) : null}
          <button type="button" className="btn sm" onClick={() => setRefus(true)}>
            Refuser
          </button>
        </>
      )}
      {decision ? <DecisionRemplacement remplacement={r} onClose={() => setDecision(false)} /> : null}
      {refus ? (
        <DialogueRefus
          quoi={`Remplacement de ${demandeur ? nomCourt(demandeur) : '-'}, ${fmtDateCourt(r.date)}, ${fmtHeure(r.start)} – ${fmtHeure(r.end)}`}
          raisons={RAISONS_REFUS.remplacement}
          apercu={(m) => texteRefus(`de remplacement du ${fmtDateCourt(r.date)}, ${fmtHeure(r.start)} – ${fmtHeure(r.end)}`, m, 'Vous restez en poste.')}
          sansMessage="Sans raison précisée, le demandeur reçoit seulement l’avis de refus."
          pour={demandeur?.prenom ?? 'la personne'}
          onClose={() => setRefus(false)}
          onConfirmer={(motif) => {
            if (attente) deciderDemande(r.id, false, motif ?? '');
            else cloreRemplacement(r.id, 'refusee', motif ?? '');
            dire('Demande de remplacement refusée.', true);
          }}
        />
      ) : null}
    </div>
  );
}
