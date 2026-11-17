import { AlertTriangle, ArrowLeftRight, ArrowRight, CalendarCheck, CalendarRange, Check, ChevronDown, CircleCheck, Handshake, Sparkles, CircleHelp, Clock3, ListChecks, MoonStar, PartyPopper, Send, UserMinus, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  JOURS,
  addDays,
  dayIndex,
  fmtDateCourt,
  fmtDateLong,
  fmtEuros,
  fmtHeure,
  fmtSemaine,
  isoWeek,
  mondayOf,
  weekday,
} from '../../domain/time';
import type { Absence, AppData, Besoin, BesoinStatut, ISODate, Remplacement, Trou } from '../../domain/types';
import { ABSENCE_LABEL, GARDE_LABEL, nomCourt } from '../../domain/types';
import { decrireBesoin, decrireShift, shiftsSemaine } from '../../engine/core';
import { decisions } from '../../engine/decisions';
import { diagnosticPrealable } from '../../engine/diagnose';
import { congesIncompatibles } from '../../engine/gardes';
import type { RepairOption } from '../../engine/repair';
import { optionsReparation } from '../../engine/repair';
import { evaluerRemplacement } from '../../engine/remplacement';
import { validateWeek } from '../../engine/validate';
import { estResponsable, memeIdentifiant } from '../../domain/acces';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { AvantApres, Avatar, Empty, Pill } from '../kit';

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
  const { aller, setSemaine, ouvrirGarde } = useUi();
  const corrigerRepos = useStore((s) => s.corrigerRepos);
  const resoudreAbsence = useStore((s) => s.resoudreAbsence);
  const { donnerAccord, ecarterAccord } = useStore();
  const dire = useUi((s) => s.dire);
  const nom = (id: string | null): string => {
    const p = data.personnes.find((x) => x.id === id);
    return p ? nomCourt(p) : '—';
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
    <div style={{ maxWidth: 1180 }}>
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
        <div className="onglets" role="tablist" aria-label="Familles de décisions">
          {onglets.map((o) => (
            <button key={o.cle} type="button" role="tab" id={`onglet-${o.cle}`} aria-selected={onglet === o.cle} aria-controls="panneau-decisions" className={`onglet${onglet === o.cle ? ' on' : ''}`} onClick={() => setChoix(o.cle)}>
              <span aria-hidden="true">{o.icone}</span>
              {o.label}
              <span className={`compte${o.nombre ? '' : ' zero'}`}>
                {o.nombre}
                <span className="sr"> à traiter</span>
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
                      Proposé par {auteur ? nomCourt(auteur) : '—'}, titulaire secondaire · {fmtDateCourt(a.at.slice(0, 10))}
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
                        {a ? ABSENCE_LABEL[a.type] : 'Absence'} de {p ? nomCourt(p) : '—'}
                      </h3>
                      <div className="small soft">
                        {a ? `Du ${fmtDateCourt(a.from)} au ${fmtDateCourt(a.to)}` : ''} · {trous.length} poste{trous.length > 1 ? 's' : ''} à couvrir
                      </div>
                    </div>
                    <Pill tone="danger">
                      <Clock3 size={12} /> {dayIndex(trous[0].shift.date) - dayIndex(today) <= 1 ? 'Urgent' : `Dans ${dayIndex(trous[0].shift.date) - dayIndex(today)} jours`}
                    </Pill>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => {
                        resoudreAbsence(absenceId);
                        dire(`${trous.length} jour${trous.length > 1 ? 's' : ''} réglé${trous.length > 1 ? 's' : ''} avec les options conseillées.`, true);
                      }}
                    >
                      <Sparkles size={16} aria-hidden="true" /> Tout régler
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
          <div className="card">
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
                          dire('Poste corrigé pour respecter le repos.', true);
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
                      {GARDE_LABEL[g.type]} du {fmtDateCourt(g.date)} à affecter
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
                    {nom(g.personId)} · {GARDE_LABEL[g.type].toLowerCase()} · à relire avant transmission au comptable
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
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setSemaine(pub.monday);
                    aller('construire');
                  }}
                >
                  Ouvrir la semaine <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Réparation

function CarteTrou({ trou, ouvert }: { trou: Trou; ouvert: boolean }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const resoudre = useStore((s) => s.resoudreTrou);
  const dire = useUi((s) => s.dire);
  const rep = useMemo(() => optionsReparation(data, trou.shift, today), [data, trou, today]);
  const publie = data.semaines[mondayOf(trou.shift.date)]?.statut === 'publie';
  const nom = (id: string): string => {
    const p = data.personnes.find((x) => x.id === id);
    return p ? nomCourt(p) : '—';
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
              <dt>Coût en plus</dt>
              <dd className="num">{o.coutSupp > 0 ? `+ ${fmtEuros(o.coutSupp)}` : 'Aucun'}</dd>
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
                dire(publie && (o.changements.length || o.patch.liberer.length) ? 'Option retenue. Pensez à publier la modification pour prévenir l’équipe.' : 'Option retenue.', true);
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

function DemandeAbsence({ absence }: { absence: Absence }): JSX.Element {
  const data = useStore((s) => s.data);
  const decider = useStore((s) => s.deciderAbsence);
  const dire = useUi((s) => s.dire);
  const p = data.personnes.find((x) => x.id === absence.personId);
  const sim = useMemo(() => simulerAbsence(data, absence), [data, absence]);
  const jours = dayIndex(absence.to) - dayIndex(absence.from) + 1;
  return (
    <div className="decision">
      <Avatar person={p} />
      <div className="grow" style={{ minWidth: 280 }}>
        <b>
          {ABSENCE_LABEL[absence.type]} demandé par {p ? nomCourt(p) : '—'}
        </b>
        <div className="soft small" style={{ marginTop: 3 }}>
          Du {fmtDateCourt(absence.from)} au {fmtDateCourt(absence.to)} · {jours} jour{jours > 1 ? 's' : ''}
        </div>
        <div className="col" style={{ gap: 6, marginTop: 9 }}>
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
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            decider(absence.id, false);
            dire('Demande refusée.', true);
          }}
        >
          Refuser
        </button>
        <button
          type="button"
          className="btn sm primary"
          onClick={() => {
            decider(absence.id, true);
            dire('Congé approuvé.', true);
          }}
        >
          Approuver
        </button>
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
  const [statut, setStatut] = useState<BesoinStatut>(besoin.statut);
  const usage = usagePlafond(data, besoin.personId, today);
  const plein = statut === 'prioritaire' && usage.actifs >= usage.plafond;
  return (
    <div className="decision">
      <Avatar person={p} />
      <div className="grow" style={{ minWidth: 280 }}>
        <b>Demande de {p ? nomCourt(p) : '—'} à arbitrer</b>
        <div style={{ marginTop: 3 }}>{decrireBesoin(besoin)}</div>
        <div className="soft small" style={{ marginTop: 3 }}>
          {besoin.from ? `À partir du ${fmtDateCourt(besoin.from)}` : 'Sans date de début'}
          {besoin.to ? ` jusqu'au ${fmtDateCourt(besoin.to)}` : ''} · demande présentée sans motif, comme toutes les autres
        </div>
        <div className="row wrap small" style={{ marginTop: 9 }}>
          <label className="row" style={{ gap: 6 }}>
            <span className="soft">Statut accordé</span>
            <select className="input" value={statut} onChange={(e) => setStatut(e.target.value as BesoinStatut)} style={{ padding: '5px 8px' }}>
              <option value="preference">Simple préférence</option>
              <option value="prioritaire">Préférence prioritaire</option>
              <option value="reconnue">Indisponibilité reconnue</option>
            </select>
          </label>
          <Pill tone={plein ? 'warn' : undefined} title="Plafond identique pour toute l'équipe">
            Souhaits prioritaires actifs : {usage.actifs} / {usage.plafond}
          </Pill>
        </div>
        {plein ? (
          <div className="notice warn small" style={{ marginTop: 8 }}>
            <AlertTriangle size={15} /> Le plafond de souhaits prioritaires est atteint pour {p ? nomCourt(p) : 'cette personne'}. Accordez une simple préférence, ou libérez un souhait existant.
          </div>
        ) : null}
      </div>
      <div className="row">
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            decider(besoin.id, false);
            dire('Demande refusée. Le refus est compté dans la mémoire d’équité.', true);
          }}
        >
          Refuser
        </button>
        <button
          type="button"
          className="btn sm primary"
          disabled={plein}
          onClick={() => {
            decider(besoin.id, true, statut);
            dire('Demande acceptée.', true);
          }}
        >
          Accepter
        </button>
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
  const { validerRemplacement, cloreRemplacement } = useStore();
  const dire = useUi((s) => s.dire);
  const demandeur = data.personnes.find((p) => p.id === r.demandeur);
  const avis = useMemo(() => r.volontaires.map((id) => ({ id, avis: evaluerRemplacement(data, r, id) })), [data, r]);
  return (
    <div className="decision" style={{ alignItems: 'flex-start' }}>
      <Avatar person={demandeur} />
      <div className="grow col" style={{ gap: 8, minWidth: 220 }}>
        <div>
          <b>{demandeur ? nomCourt(demandeur) : '—'}</b> souhaite être remplacé{' '}
          <b>
            {fmtDateCourt(r.date)}, {fmtHeure(r.start)} – {fmtHeure(r.end)}
          </b>
          <div className="small soft">Aucune raison n’est demandée. Sans validation, le poste reste le sien.</div>
        </div>
        {!avis.length ? <div className="small soft">Aucun volontaire pour l’instant : l’équipe voit la demande dans « Mon planning ».</div> : null}
        {avis.map(({ id, avis: a }) => {
          const p = data.personnes.find((x) => x.id === id);
          return (
            <div key={id} className="row wrap" style={{ gap: 10 }}>
              <Avatar person={p} />
              <div className="grow" style={{ minWidth: 180 }}>
                <b>{p ? nomCourt(p) : '—'}</b> se propose
                <div className="small soft">{a.ok ? 'Règles respectées, couverture inchangée.' : a.raisons.join(' · ')}</div>
              </div>
              {a.ok ? (
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={() => {
                    validerRemplacement(r.id, id);
                    dire(`Remplacement validé : ${p ? nomCourt(p) : ''} reprend le poste. Les deux personnes sont prévenues.`, true);
                  }}
                >
                  <Check size={14} aria-hidden="true" /> Valider avec {p?.prenom}
                </button>
              ) : (
                <Pill tone="warn">Impossible en l’état</Pill>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="btn sm"
        onClick={() => {
          cloreRemplacement(r.id, 'refusee');
          dire('Demande de remplacement refusée.', true);
        }}
      >
        Refuser
      </button>
    </div>
  );
}
