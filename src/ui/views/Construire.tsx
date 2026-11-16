import {
  AlertTriangle,
  Ban,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Copy,
  Info,
  Lock,
  MessageCircleQuestion,
  Moon,
  Package,
  Plus,
  Printer,
  Redo2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  JOURS,
  addDays,
  fmtDecimal,
  fmtDuree,
  fmtEuros,
  fmtHHMM,
  fmtHeure,
  fmtHorodatage,
  fmtJourMois,
  fmtSemaine,
  isoWeek,
  mondayOf,
  parseHHMM,
  uid,
  weekDates,
  weekday,
} from '../../domain/time';
import type { Activite, AppData, ISODate, Person, Shift } from '../../domain/types';
import { ABSENCE_LABEL, ACTIVITE_LABEL, GARDE_LABEL, MISSION_LABEL, QUALIFICATION_COURT, estPharmacien, nomComplet, nomCourt } from '../../domain/types';
import {
  besoinsDe,
  decrireBesoin,
  decrireShift,
  effectifComptoir,
  effectifRequis,
  minutesSemaine,
  minutesTravail,
  ouverture,
  pharmacienSeulEnRendezVous,
  presencePharmaciens,
  shiftsSemaine,
  trousPharmacien,
} from '../../engine/core';
import type { Blocage } from '../../engine/diagnose';
import { CAS_LABEL, diagnosticPrealable, diagnosticResultat } from '../../engine/diagnose';
import { equite, fatigue, periodeAvant } from '../../engine/equity';
import type { GenResult } from '../../engine/generate';
import { VARIANTE_LABEL, genererVariantes } from '../../engine/generate';
import { coutSemaine, decompteSemaine } from '../../engine/payroll';
import { controlePublication } from '../../engine/publish';
import type { Issue } from '../../engine/validate';
import { validateWeek } from '../../engine/validate';
import { modificationsEnAttente, useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import type { Echelle } from '../kit';
import { AvantApres, Avatar, Dialog, Pill, Seg, Strip, Track, roleDe } from '../kit';

type Lecture = 'heures' | 'cout' | 'equite';

export function echelleOfficine(data: AppData): Echelle {
  const plages = data.officine.horaires.flat();
  if (!plages.length) return { start: 8 * 60, end: 20 * 60 };
  return {
    start: Math.floor((Math.min(...plages.map((p) => p.start)) - 30) / 60) * 60,
    end: Math.ceil((Math.max(...plages.map((p) => p.end)) + 30) / 60) * 60,
  };
}

const GROUPES: { titre: string; test: (p: Person) => boolean; couleur: string }[] = [
  { titre: 'Pharmaciens', test: (p) => estPharmacien(p) && !p.externe, couleur: 'var(--pharma)' },
  { titre: 'Préparateurs', test: (p) => p.qualification === 'preparateur' && !p.externe, couleur: 'var(--prepa)' },
  { titre: 'Apprentis, étudiants et autres postes', test: (p) => !estPharmacien(p) && p.qualification !== 'preparateur' && !p.externe, couleur: 'var(--autre)' },
  { titre: 'Remplaçants', test: (p) => !!p.externe, couleur: 'var(--externe)' },
];

export function Construire(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { undo, redo, past, future, moveShift, copierSemaine, viderSemaine } = useStore();
  const { semaine, setSemaine, focus, setFocus, dire } = useUi();
  const [lecture, setLecture] = useState<Lecture>('heures');
  const [edition, setEdition] = useState<{ personId: string; date: ISODate; shift?: Shift } | null>(null);
  const [generation, setGeneration] = useState(false);
  const [publication, setPublication] = useState(false);
  const [survol, setSurvol] = useState<string | null>(null);

  const dates = useMemo(() => weekDates(semaine), [semaine]);
  const echelle = useMemo(() => echelleOfficine(data), [data]);
  const issues = useMemo(() => validateWeek(data, semaine), [data, semaine]);
  const blocages = useMemo(() => {
    const pre = diagnosticPrealable(data, semaine);
    return shiftsSemaine(data, semaine).length ? diagnosticResultat(data, semaine, pre).filter((b) => b.cas !== 'non_trouvee') : pre;
  }, [data, semaine]);
  const postes = useMemo(() => shiftsSemaine(data, semaine), [data, semaine]);
  const statut = data.semaines[semaine];
  const enAttente = modificationsEnAttente(data, semaine);
  const passee = addDays(semaine, 6) < today;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const colonnes = `164px ${dates.map((d) => (ouverture(data.officine, d).length ? 'minmax(88px, 1fr)' : data.gardes.some((g) => g.date === d && g.personId) ? '78px' : '50px')).join(' ')} ${lecture === 'equite' ? 128 : 104}px`;
  const visibles = data.personnes.filter((p) => !p.externe || postes.some((s) => s.personId === p.id));
  const lignesEquite = useMemo(
    () => (lecture === 'equite' ? equite(data, periodeAvant(semaine, 8).from, addDays(semaine, 6)) : []),
    [data, semaine, lecture],
  );

  const nb = { bloquant: issues.filter((i) => i.gravite === 'bloquant').length, alerte: issues.filter((i) => i.gravite === 'alerte').length };

  return (
    <div>
      <div className="page-head">
        <div className="grow">
          <div className="eyebrow">Construire</div>
          <h1>Comment couvrir la semaine ?</h1>
        </div>
        <div className="row no-print">
          <button type="button" className="btn ghost icon" onClick={undo} disabled={!past.length} aria-label="Annuler la dernière manipulation" title="Annuler (Ctrl + Z)">
            <Undo2 size={17} />
          </button>
          <button type="button" className="btn ghost icon" onClick={redo} disabled={!future.length} aria-label="Rétablir" title="Rétablir (Ctrl + Maj + Z)">
            <Redo2 size={17} />
          </button>
          <button type="button" className="btn ghost icon" onClick={() => window.print()} aria-label="Imprimer le planning" title="Imprimer">
            <Printer size={17} />
          </button>
        </div>
      </div>

      <div className="plan-bar">
        <div className="week-nav">
          <button type="button" className="btn ghost icon" onClick={() => setSemaine(addDays(semaine, -7))} aria-label="Semaine précédente">
            <ChevronLeft size={18} />
          </button>
          <div className="label" aria-live="polite">
            Semaine {isoWeek(semaine)} · {fmtSemaine(semaine)}
            <small>{semaine === mondayOf(today) ? 'Semaine en cours' : semaine === addDays(mondayOf(today), 7) ? 'Semaine prochaine' : passee ? 'Semaine passée' : `Dans ${Math.round((Date.parse(semaine) - Date.parse(mondayOf(today))) / 604_800_000)} semaines`}</small>
          </div>
          <button type="button" className="btn ghost icon" onClick={() => setSemaine(addDays(semaine, 7))} aria-label="Semaine suivante">
            <ChevronRight size={18} />
          </button>
        </div>
        {statut?.statut === 'publie' ? (
          enAttente ? (
            <Pill tone="warn" title="Les salariés voient encore la version publiée">
              <AlertTriangle size={13} /> Publié · {enAttente} modification{enAttente > 1 ? 's' : ''} en attente
            </Pill>
          ) : (
            <Pill tone="ok">
              <CircleCheck size={13} /> Publié le {fmtHorodatage(statut.publishedAt ?? '')}
            </Pill>
          )
        ) : (
          <Pill tone="miel" title="Un brouillon n'est visible que par le responsable">
            Brouillon · non visible par l'équipe
          </Pill>
        )}
        <div className="right row wrap">
          <Seg<Lecture>
            label="Lecture du planning"
            value={lecture}
            onChange={setLecture}
            options={[
              { value: 'heures', label: 'Heures' },
              { value: 'cout', label: 'Coût' },
              { value: 'equite', label: 'Équité et fatigue' },
            ]}
          />
          {!passee ? (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  copierSemaine(addDays(semaine, -7), semaine);
                  dire('Semaine précédente recopiée dans le brouillon.', true);
                }}
                title="Recopier les postes de la semaine précédente"
              >
                <Copy size={15} /> Recopier
              </button>
              <button type="button" className="btn honey" onClick={() => setGeneration(true)}>
                <Sparkles size={15} /> Proposer un planning
              </button>
              <button type="button" className="btn primary" onClick={() => setPublication(true)} disabled={statut?.statut === 'publie' && !enAttente}>
                <CalendarCheck size={15} /> {statut?.statut === 'publie' ? 'Publier les modifications' : 'Publier'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="plan-wrap">
        <div>
          <div className="plan">
            <div className="plan-grid" style={{ gridTemplateColumns: colonnes }} role="table" aria-label={`Planning de la semaine du ${fmtSemaine(semaine)}`}>
              <div className="pg-h" role="columnheader">
                <span className="eyebrow">Équipe</span>
                <div className="tiny muted" style={{ marginTop: 9 }}>
                  Présence d'un pharmacien
                  <br />
                  Effectif au comptoir
                </div>
              </div>
              {dates.map((date) => (
                <EnTeteJour key={date} data={data} date={date} echelle={echelle} today={today} flag={!!focus && focus.date === date && !focus.personId} />
              ))}
              <div className="pg-h" role="columnheader">
                <span className="eyebrow">{lecture === 'heures' ? 'Heures / contrat' : lecture === 'cout' ? 'Coût estimé' : '8 semaines'}</span>
                {lecture === 'cout' ? <div style={{ fontWeight: 700, marginTop: 6 }} className="num">{fmtEuros(coutSemaine(data, semaine))}</div> : null}
              </div>

              {GROUPES.map((g) => {
                const membres = visibles.filter(g.test);
                if (!membres.length) return null;
                return (
                  <div key={g.titre} style={{ display: 'contents' }}>
                    <div className="pg-group">
                      <span className="dot" style={{ background: g.couleur }} /> {g.titre}
                    </div>
                    {membres.map((p) => (
                      <div key={p.id} style={{ display: 'contents' }} role="row">
                        <div className="pg-p" role="rowheader">
                          <Avatar person={p} />
                          <div className="grow">
                            <div className="nm">{nomCourt(p)}</div>
                            <div className="meta">
                              {QUALIFICATION_COURT[p.qualification]}
                              {p.externe ? ' · remplaçant' : ` · ${p.heuresHebdo} h`}
                            </div>
                          </div>
                        </div>
                        {dates.map((date) => {
                          const cle = `${p.id}|${date}`;
                          const duJour = postes.filter((s) => s.personId === p.id && s.date === date).sort((a, b) => a.start - b.start);
                          const absence = data.absences.find((a) => a.personId === p.id && a.statut === 'approuvee' && a.from <= date && date <= a.to);
                          const ouvert = ouverture(data.officine, date).length > 0;
                          const reconnus = besoinsDe(data, p.id, date).filter((b) => b.statut === 'reconnue');
                          const gardes = data.gardes.filter((g) => g.personId === p.id && g.date === date);
                          const missions = data.missions.filter((m) => m.personId === p.id && m.date === date);
                          const signale = !!focus && focus.personId === p.id && (!focus.date || focus.date === date);
                          return (
                            <div
                              key={date}
                              role="cell"
                              className={`pg-c${!ouvert ? ' closed' : ''}${absence ? ' absent' : ''}${survol === cle ? ' over' : ''}${signale ? ' flag' : ''}`}
                              onDragOver={(e) => {
                                if (passee) return;
                                e.preventDefault();
                                setSurvol(cle);
                              }}
                              onDragLeave={() => setSurvol((s) => (s === cle ? null : s))}
                              onDrop={(e) => {
                                e.preventDefault();
                                setSurvol(null);
                                const id = e.dataTransfer.getData('text/plain');
                                if (id) {
                                  moveShift(id, p.id, date);
                                  dire('Poste déplacé.', true);
                                }
                              }}
                            >
                              {reconnus.length && !duJour.length && !absence ? (
                                <span className="unavail" title={reconnus.map(decrireBesoin).join('\n')}>
                                  <Lock size={12} aria-label="Indisponibilité reconnue" />
                                </span>
                              ) : null}
                              {absence ? (
                                <span className="tag">
                                  <Ban size={12} /> {ABSENCE_LABEL[absence.type]}
                                </span>
                              ) : null}
                              {duJour.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  className="shift"
                                  draggable={!passee}
                                  onDragStart={(e) => e.dataTransfer.setData('text/plain', s.id)}
                                  onClick={() => setEdition({ personId: p.id, date, shift: s })}
                                  aria-label={`${nomCourt(p)}, ${JOURS[weekday(date)]} : ${decrireShift(s)}, ${ACTIVITE_LABEL[s.activite]}. Modifier.`}
                                  title={s.explication}
                                >
                                  <Track shifts={[s]} echelle={echelle} role={roleDe(p)} missions={missions} />
                                  <span className="lbl num">
                                    {s.activite !== 'comptoir' ? <Package size={12} aria-label={ACTIVITE_LABEL[s.activite]} /> : null}
                                    {fmtHHMM(s.start)}–{fmtHHMM(s.end)}
                                  </span>
                                  {s.explication ? <MessageCircleQuestion size={12} className="why" aria-label="Affectation expliquée" /> : null}
                                </button>
                              ))}
                              {gardes.map((g) => (
                                <span key={g.id} className="garde-chip" title={GARDE_LABEL[g.type]}>
                                  <Moon size={11} /> {fmtHHMM(g.start).replace(':00', ' h')}→{fmtHHMM(g.end).replace(':00', ' h')}
                                </span>
                              ))}
                              {!duJour.length && !absence && ouvert && !passee ? (
                                <button type="button" className="add" onClick={() => setEdition({ personId: p.id, date })} aria-label={`Ajouter un poste à ${nomCourt(p)} ${JOURS[weekday(date)]}`}>
                                  <Plus size={16} />
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                        <Resume data={data} person={p} semaine={semaine} lecture={lecture} lignes={lignesEquite} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="legend">
              <span><i style={{ background: 'var(--pharma)' }} /> Pharmacien</span>
              <span><i style={{ background: 'var(--prepa)' }} /> Préparateur</span>
              <span><i style={{ background: 'var(--autre)' }} /> Apprenti, étudiant</span>
              <span><i style={{ background: 'repeating-linear-gradient(135deg, var(--danger), var(--danger) 3px, #e58a7f 3px, #e58a7f 6px)' }} /> Ouverture sans pharmacien</span>
              <span><i style={{ background: 'var(--miel)' }} /> Rendez-vous</span>
              <span><Moon size={12} /> Garde</span>
              <span><Lock size={12} /> Indisponibilité reconnue</span>
              <span><MessageCircleQuestion size={12} /> Affectation expliquée</span>
            </div>
          </div>
          {!postes.length && !passee ? (
            <div className="card pad" style={{ marginTop: 14 }}>
              <div className="row wrap">
                <div className="grow">
                  <h3>Cette semaine est vide</h3>
                  <p className="soft" style={{ marginTop: 4 }}>
                    Demandez trois propositions comparables, recopiez la semaine précédente, ou cliquez dans une case pour poser un poste à la main.
                  </p>
                </div>
                <button type="button" className="btn honey" onClick={() => setGeneration(true)}>
                  <Sparkles size={15} /> Proposer un planning
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="panel no-print" aria-label="Contrôles de la semaine">
          <div className="card">
            <div className="card-head">
              <ShieldAlert size={18} />
              <h3 className="grow">Contrôles</h3>
              {!postes.length ? (
                <Pill>Semaine vide</Pill>
              ) : nb.bloquant ? (
                <Pill tone="danger">{nb.bloquant} bloquant{nb.bloquant > 1 ? 's' : ''}</Pill>
              ) : (
                <Pill tone="ok">Aucun bloquant</Pill>
              )}
              {postes.length && nb.alerte ? <Pill tone="warn" title="Alertes d'organisation">{nb.alerte} alerte{nb.alerte > 1 ? 's' : ''}</Pill> : null}
            </div>
            <div className="card-body col" style={{ gap: 8, maxHeight: '62vh', overflow: 'auto' }}>
              {blocages.map((b, i) => (
                <CarteBlocage key={i} b={b} data={data} onFocus={() => setFocus(b.date ? { date: b.date } : null)} />
              ))}
              {(postes.length ? issues : [])
                .filter((i) => !(i.regle === 'pharmacie.presence' && blocages.some((b) => b.date === i.date && b.start !== undefined && b.start <= (i.start ?? 0) && (i.end ?? 0) <= (b.end ?? 0))))
                .map((i) => (
                  <CarteIssue key={i.id} issue={i} data={data} onClick={() => setFocus(i.personId || i.date ? { personId: i.personId, date: i.date } : null)} />
                ))}
              {!postes.length ? (
                <p className="soft small">
                  {blocages.length ? 'Ces points existent avant même de poser un poste.' : 'Aucune impossibilité détectée avec les contraintes connues.'} Les contrôles détaillés démarrent au premier poste posé.
                </p>
              ) : !issues.length && !blocages.length ? (
                <p className="soft small">Aucun point à signaler sur cette semaine.</p>
              ) : null}
              <p className="tiny muted" style={{ marginTop: 4 }}>
                Aide à la conformité : ces contrôles signalent des écarts, ils ne valent pas certification.
              </p>
            </div>
          </div>
          {postes.length && !passee ? (
            <button
              type="button"
              className="btn ghost sm danger"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                viderSemaine(semaine);
                dire('Semaine vidée.', true);
              }}
            >
              <Trash2 size={14} /> Vider la semaine
            </button>
          ) : null}
        </aside>
      </div>

      {edition ? <DialoguePoste {...edition} onClose={() => setEdition(null)} /> : null}
      {generation ? <DialogueGeneration semaine={semaine} onClose={() => setGeneration(false)} /> : null}
      {publication ? <DialoguePublication semaine={semaine} onClose={() => setPublication(false)} /> : null}
    </div>
  );
}

function EnTeteJour({ data, date, echelle, today, flag }: { data: AppData; date: ISODate; echelle: Echelle; today: ISODate; flag: boolean }): JSX.Element {
  const o = ouverture(data.officine, date);
  const wd = weekday(date);
  const trous = trousPharmacien(data, date);
  const creneaux: { present: number; requis: number }[] = [];
  for (let t = echelle.start; t < echelle.end; t += 30) creneaux.push({ present: effectifComptoir(data, date, t), requis: effectifRequis(data.officine, date, t) });
  const max = Math.max(4, ...creneaux.map((c) => c.present));
  return (
    <div className={`pg-h${date === today ? ' today' : ''}${!o.length ? ' closed' : ''}`} role="columnheader" style={{ position: 'sticky', boxShadow: flag ? 'inset 0 0 0 2px var(--danger)' : undefined }}>
      <span className="d">{o.length ? JOURS[wd] : JOURS[wd].slice(0, 3)}</span>
      <span className="n">{fmtJourMois(date).split(' ')[0]}</span>
      {o.length ? (
        <>
          <Strip
            echelle={echelle}
            parts={[
              { cls: 'open', list: o },
              { cls: 'ph', list: presencePharmaciens(data, date) },
              { cls: 'rdv', list: pharmacienSeulEnRendezVous(data, date) },
              { cls: 'gap', list: trous },
            ]}
          />
          <span className="staff" aria-hidden="true">
            {creneaux.map((c, i) => (
              <i key={i} className={c.requis === 0 ? 'off' : c.present < c.requis ? 'low' : ''} style={{ height: `${(c.present / max) * 100}%` }} />
            ))}
          </span>
          <span className="sr">
            {trous.length ? `${trous.length} plage(s) sans pharmacien` : 'Pharmacien présent sur toute l’ouverture'}
          </span>
        </>
      ) : (
        <div className="tiny muted" style={{ marginTop: 6 }}>Fermé</div>
      )}
    </div>
  );
}

function Resume({ data, person, semaine, lecture, lignes }: { data: AppData; person: Person; semaine: ISODate; lecture: Lecture; lignes: ReturnType<typeof equite> }): JSX.Element {
  const minutes = minutesSemaine(data, person.id, semaine);
  if (lecture === 'equite') {
    const l = lignes.find((x) => x.personId === person.id);
    const f = fatigue(data, person.id, semaine);
    if (!l) return <div className="pg-sum muted">—</div>;
    return (
      <div className="pg-sum" title={f.facteurs.map((x) => `${x.label} (+${x.points})`).join('\n') || 'Aucun facteur de fatigue relevé'}>
        <span className="num">
          Sam. <b>{l.reel.samedis}</b>
          {l.attendu.samedis !== null ? <span className="muted"> / {fmtDecimal(l.attendu.samedis, 1)}</span> : null}
        </span>
        <span className="num">
          Ferm. <b>{l.reel.fermetures}</b>
          {l.attendu.fermetures !== null ? <span className="muted"> / {fmtDecimal(l.attendu.fermetures, 1)}</span> : null}
        </span>
        <Pill tone={f.niveau === 'élevée' ? 'danger' : f.niveau === 'modérée' ? 'warn' : 'ok'}>Fatigue {f.niveau}</Pill>
      </div>
    );
  }
  if (person.externe) {
    return (
      <div className="pg-sum">
        <b className="num">{fmtDuree(minutes)}</b>
        <span className="muted num">{fmtEuros(((person.tauxHoraire ?? 0) * minutes) / 60)}</span>
      </div>
    );
  }
  const d = decompteSemaine(data, person, minutes);
  if (lecture === 'cout') {
    return (
      <div className="pg-sum">
        <b className="num">{d.cout !== null ? fmtEuros(d.cout) : '—'}</b>
        <span className="muted tiny">{!person.salarie ? 'Titulaire, hors coût salarial' : d.auDela ? `dont ${fmtDuree(d.auDela)} au-delà du contrat` : 'Contrat sans dépassement'}</span>
      </div>
    );
  }
  const contrat = person.heuresHebdo * 60;
  const ecart = minutes - contrat;
  return (
    <div className="pg-sum">
      <span className="num">
        <b>{fmtDuree(minutes)}</b> <span className="muted">/ {person.heuresHebdo} h</span>
      </span>
      <span className="meter">
        <i className={ecart > 0 && person.salarie ? 'over' : ''} style={{ width: `${Math.min(100, (minutes / Math.max(1, contrat)) * 100)}%` }} />
      </span>
      <span className="tiny muted num">{ecart === 0 ? 'Contrat atteint' : ecart > 0 ? `+ ${fmtDuree(ecart)}` : `${fmtDuree(ecart)}`}</span>
    </div>
  );
}

function CarteIssue({ issue, data, onClick }: { issue: Issue; data: AppData; onClick: () => void }): JSX.Element {
  const regle = data.regles.find((r) => r.id === issue.regle);
  return (
    <button type="button" className={`issue ${issue.gravite}`} onClick={onClick}>
      <span className="ico">{issue.gravite === 'info' ? <Info size={14} /> : <AlertTriangle size={14} />}</span>
      <span>
        <span className="sr">{issue.gravite === 'bloquant' ? 'Point bloquant : ' : issue.gravite === 'alerte' ? 'Alerte : ' : 'Information : '}</span>
        {issue.message}
        {issue.detail ? <span className="src">{issue.detail}</span> : null}
        {regle ? (
          <span className="src" style={{ display: 'block' }}>
            {regle.titre} · v{regle.version}
            {regle.verification === 'a_valider' ? ' · à valider par un expert' : ''}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function CarteBlocage({ b, data, onFocus, ouvert }: { b: Blocage; data: AppData; onFocus?: () => void; ouvert?: boolean }): JSX.Element {
  return (
    <div className="issue diag" onClick={onFocus} role={onFocus ? 'button' : undefined} tabIndex={onFocus ? 0 : undefined} onKeyDown={(e) => e.key === 'Enter' && onFocus?.()}>
      <span className="ico">
        <Ban size={14} />
      </span>
      <span className="grow">
        <b style={{ display: 'block', fontSize: 11.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--danger)' }}>{CAS_LABEL[b.cas]}</b>
        {b.message}
        {b.raisons.length || b.leviers.length ? (
          <details className="why" open={ouvert} onClick={(e) => e.stopPropagation()}>
            <summary>Pourquoi, et que faire ?</summary>
            {b.raisons.map((r, i) => {
              const p = data.personnes.find((x) => x.id === r.personId);
              return (
                <span key={i} className="src" style={{ display: 'block' }}>
                  <b style={{ color: 'var(--ink)' }}>{p ? nomCourt(p) : '—'}</b> : {r.raison}
                </span>
              );
            })}
            {b.leviers.length ? (
              <span className="src" style={{ display: 'block', marginTop: 6 }}>
                <b style={{ color: 'var(--ink)' }}>Pistes</b> : {b.leviers.join(' · ')}
              </span>
            ) : null}
          </details>
        ) : null}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ Poste

function DialoguePoste({ personId, date, shift, onClose }: { personId: string; date: ISODate; shift?: Shift; onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const { saveShift, deleteShift } = useStore();
  const dire = useUi((s) => s.dire);
  const person = data.personnes.find((p) => p.id === personId) as Person;
  const wd = weekday(date);
  const postes = data.officine.postes.filter((p) => p.jours.includes(wd));
  const [debut, setDebut] = useState(fmtHHMM(shift?.start ?? postes[0]?.start ?? 510));
  const [fin, setFin] = useState(fmtHHMM(shift?.end ?? postes[0]?.end ?? 990));
  const [avecPause, setAvecPause] = useState(shift ? shift.pauseStart !== undefined : postes[0]?.pauseStart !== undefined);
  const [pauseDebut, setPauseDebut] = useState(fmtHHMM(shift?.pauseStart ?? postes[0]?.pauseStart ?? 750));
  const [pauseFin, setPauseFin] = useState(fmtHHMM(shift?.pauseEnd ?? postes[0]?.pauseEnd ?? 810));
  const [activite, setActivite] = useState<Activite>(shift?.activite ?? 'comptoir');

  const brouillon = useMemo<Shift | null>(() => {
    const s = parseHHMM(debut);
    const e = parseHHMM(fin);
    if (s === null || e === null || e <= s) return null;
    const ps = avecPause ? parseHHMM(pauseDebut) : null;
    const pe = avecPause ? parseHHMM(pauseFin) : null;
    const pauseOk = ps !== null && pe !== null && pe > ps && ps > s && pe < e;
    const modifie = !shift || shift.start !== s || shift.end !== e || shift.pauseStart !== (pauseOk ? ps : undefined) || shift.activite !== activite;
    return {
      id: shift?.id ?? uid('s'),
      personId,
      date,
      start: s,
      end: e,
      pauseStart: pauseOk ? (ps as number) : undefined,
      pauseEnd: pauseOk ? (pe as number) : undefined,
      activite,
      origine: modifie ? 'manuel' : (shift?.origine ?? 'manuel'),
      explication: modifie ? undefined : shift?.explication,
    };
  }, [debut, fin, avecPause, pauseDebut, pauseFin, activite, shift, personId, date]);

  // Contrôle immédiat : ce que ce poste changerait, avant même d'enregistrer.
  const effets = useMemo(() => {
    if (!brouillon) return [];
    const monday = mondayOf(date);
    const avant = new Set(validateWeek(data, monday).map((i) => i.id));
    const apres = validateWeek({ ...data, shifts: data.shifts.filter((s) => s.id !== brouillon.id).concat(brouillon) }, monday);
    return apres.filter((i) => !avant.has(i.id) && i.gravite !== 'info' && (i.personId === personId || i.date === date));
  }, [brouillon, data, date, personId]);

  return (
    <Dialog
      title={shift ? 'Modifier le poste' : 'Nouveau poste'}
      subtitle={
        <>
          {nomComplet(person)} · {JOURS[wd]} {fmtJourMois(date)}
        </>
      }
      onClose={onClose}
      footer={
        <>
          {shift ? (
            <button
              type="button"
              className="btn danger"
              style={{ marginRight: 'auto' }}
              onClick={() => {
                deleteShift(shift.id);
                dire('Poste supprimé.', true);
                onClose();
              }}
            >
              <Trash2 size={15} /> Supprimer
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!brouillon}
            onClick={() => {
              if (!brouillon) return;
              saveShift(brouillon);
              dire(shift ? 'Poste modifié.' : 'Poste ajouté.', true);
              onClose();
            }}
          >
            Enregistrer
          </button>
        </>
      }
    >
      {shift?.explication ? (
        <div className="notice ok">
          <MessageCircleQuestion size={16} />
          <div>
            <b>Pourquoi ce poste ?</b>
            <div>{shift.explication}</div>
          </div>
        </div>
      ) : null}
      {postes.length ? (
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Postes types</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {postes.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn sm"
                onClick={() => {
                  setDebut(fmtHHMM(p.start));
                  setFin(fmtHHMM(p.end));
                  setAvecPause(p.pauseStart !== undefined);
                  if (p.pauseStart !== undefined && p.pauseEnd !== undefined) {
                    setPauseDebut(fmtHHMM(p.pauseStart));
                    setPauseFin(fmtHHMM(p.pauseEnd));
                  }
                }}
              >
                {p.label} <span className="muted num">{fmtDuree(minutesTravail(p))}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <label className="field">
          Début
          <input type="time" step={900} value={debut} onChange={(e) => setDebut(e.target.value)} data-autofocus />
        </label>
        <label className="field">
          Fin
          <input type="time" step={900} value={fin} onChange={(e) => setFin(e.target.value)} />
        </label>
        <label className="field grow">
          Activité
          <select value={activite} onChange={(e) => setActivite(e.target.value as Activite)}>
            {(Object.keys(ACTIVITE_LABEL) as Activite[]).map((a) => (
              <option key={a} value={a}>
                {ACTIVITE_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={avecPause} onChange={(e) => setAvecPause(e.target.checked)} />
        Pause planifiée (non comptée en temps de travail)
      </label>
      {avecPause ? (
        <div className="row">
          <label className="field">
            Début de pause
            <input type="time" step={900} value={pauseDebut} onChange={(e) => setPauseDebut(e.target.value)} />
          </label>
          <label className="field">
            Fin de pause
            <input type="time" step={900} value={pauseFin} onChange={(e) => setPauseFin(e.target.value)} />
          </label>
        </div>
      ) : null}
      {brouillon ? (
        <div className="row small soft">
          <Track shifts={[brouillon]} echelle={echelleOfficine(data)} role={roleDe(person)} />
          <span className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDuree(minutesTravail(brouillon))} de travail</span>
        </div>
      ) : (
        <div className="notice warn">
          <AlertTriangle size={16} /> L'heure de fin doit suivre l'heure de début.
        </div>
      )}
      {effets.length ? (
        <div className="col" style={{ gap: 6 }}>
          <div className="eyebrow">Ce que ce poste déclenche</div>
          {effets.map((i) => (
            <div key={i.id} className={`notice ${i.gravite === 'bloquant' ? 'danger' : 'warn'}`}>
              <AlertTriangle size={16} /> {i.message}
            </div>
          ))}
        </div>
      ) : brouillon ? (
        <div className="notice ok">
          <CircleCheck size={16} /> Aucun nouveau point à signaler avec ce poste.
        </div>
      ) : null}
      {data.missions.filter((m) => m.personId === personId && m.date === date).map((m) => (
        <div key={m.id} className="small soft">
          Rendez-vous ce jour-là : {MISSION_LABEL[m.type]}, {fmtHeure(m.start)} – {fmtHeure(m.end)}
        </div>
      ))}
    </Dialog>
  );
}

// ------------------------------------------------------------- Génération

function DialogueGeneration({ semaine, onClose }: { semaine: ISODate; onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const appliquer = useStore((s) => s.appliquerGeneration);
  const dire = useUi((s) => s.dire);
  const dejaPoses = shiftsSemaine(data, semaine).filter((s) => !data.personnes.find((p) => p.id === s.personId)?.externe).length;
  const [conserver, setConserver] = useState(false);
  const [calcul, setCalcul] = useState(false);
  const [resultats, setResultats] = useState<GenResult[] | null>(null);
  const [choix, setChoix] = useState(0);
  const [graine, setGraine] = useState(7);
  const echelle = echelleOfficine(data);

  const lancer = (g: number): void => {
    setCalcul(true);
    setResultats(null);
    // Laisser l'écran afficher l'état « calcul en cours » avant de lancer le moteur.
    window.setTimeout(() => {
      setResultats(genererVariantes(data, semaine, conserver, g));
      setChoix(0);
      setCalcul(false);
    }, 40);
  };
  useEffect(() => {
    if (!dejaPoses) lancer(graine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meilleur = (cle: 'souhaits' | 'ecartSamedis' | 'coutEstime' | 'auDela' | 'sousEffectif', i: number): boolean => {
    if (!resultats) return false;
    const v = resultats.map((r) => r.indicateurs[cle] ?? 0);
    const cible = cle === 'souhaits' ? Math.max(...v) : Math.min(...v);
    return v[i] === cible && new Set(v).size > 1;
  };
  const retenu = resultats?.[choix];
  const personnes = data.personnes.filter((p) => !p.externe);

  return (
    <Dialog
      size="wide"
      title="Trois propositions pour la semaine"
      subtitle={`Semaine ${isoWeek(semaine)} · ${fmtSemaine(semaine)}. Le calcul propose, vous décidez : rien n'est publié sans votre validation.`}
      onClose={onClose}
      footer={
        <>
          {resultats ? (
            <button type="button" className="btn ghost" style={{ marginRight: 'auto' }} onClick={() => { const g = graine + 13; setGraine(g); lancer(g); }}>
              <Sparkles size={15} /> Recalculer d'autres propositions
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>
            Fermer
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!retenu}
            onClick={() => {
              if (!retenu) return;
              appliquer(semaine, retenu);
              dire(`Proposition « ${VARIANTE_LABEL[retenu.variante].titre} » placée dans le brouillon.`, true);
              onClose();
            }}
          >
            Placer dans le brouillon
          </button>
        </>
      }
    >
      {!resultats && !calcul ? (
        <div className="col">
          <div className="notice info">
            <Info size={16} />
            <div>
              {dejaPoses} poste{dejaPoses > 1 ? 's sont déjà posés' : ' est déjà posé'} sur cette semaine. Vous pouvez les garder et ne faire compléter que le reste.
            </div>
          </div>
          <label className="check">
            <input type="radio" name="mode" checked={!conserver} onChange={() => setConserver(false)} />
            <span>
              <b>Repartir d'une semaine vide</b>
              <span className="soft" style={{ display: 'block' }}>Les postes actuels du brouillon seront remplacés par la proposition retenue.</span>
            </span>
          </label>
          <label className="check">
            <input type="radio" name="mode" checked={conserver} onChange={() => setConserver(true)} />
            <span>
              <b>Conserver les postes déjà posés</b>
              <span className="soft" style={{ display: 'block' }}>Le calcul complète autour de ce que vous avez décidé.</span>
            </span>
          </label>
          <div>
            <button type="button" className="btn honey" onClick={() => lancer(graine)} data-autofocus>
              <Sparkles size={15} /> Calculer trois propositions
            </button>
          </div>
        </div>
      ) : null}
      {calcul ? (
        <div className="row" style={{ padding: '30px 0', justifyContent: 'center' }} role="status">
          <span className="spinner" /> Calcul des propositions : règles impératives d'abord, effectif ensuite, souhaits et équité enfin…
        </div>
      ) : null}
      {resultats ? (
        <>
          <div className="variants">
            {resultats.map((r, i) => {
              const k = r.indicateurs;
              return (
                <button key={r.variante} type="button" className={`variant${i === choix ? ' on' : ''}`} onClick={() => setChoix(i)} aria-pressed={i === choix}>
                  <div>
                    <div className="row">
                      <h3 className="grow">{VARIANTE_LABEL[r.variante].titre}</h3>
                      {k.bloquants ? <Pill tone="danger">{k.bloquants} bloquant{k.bloquants > 1 ? 's' : ''}</Pill> : <Pill tone="ok">Règles respectées</Pill>}
                    </div>
                    <p className="soft small" style={{ marginTop: 4 }}>{VARIANTE_LABEL[r.variante].phrase}</p>
                  </div>
                  <div className="mini" aria-hidden="true">
                    {personnes.map((p) => (
                      <div className="mini-row" key={p.id}>
                        {weekDates(semaine).slice(0, 6).map((d) => (
                          <Track key={d} shifts={r.shifts.filter((s) => s.personId === p.id && s.date === d)} echelle={echelle} role={roleDe(p)} />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="kpi">
                    <span>Souhaits satisfaits</span>
                    <b className={meilleur('souhaits', i) ? 'best' : ''}>{k.souhaits === null ? '—' : `${Math.round(k.souhaits * 100)} %`}</b>
                    <span title="Écart type entre samedis réels et attendus sur 8 semaines : plus il est bas, plus la répartition est équilibrée">Écart d'équité (samedis)</span>
                    <b className={meilleur('ecartSamedis', i) ? 'best' : ''}>{fmtDecimal(k.ecartSamedis, 2)}</b>
                    <span>Heures au-delà des contrats</span>
                    <b className={meilleur('auDela', i) ? 'best' : ''}>{fmtDuree(k.auDela)}</b>
                    <span>Coût salarial estimé</span>
                    <b className={meilleur('coutEstime', i) ? 'best' : ''}>{fmtEuros(k.coutEstime)}</b>
                    <span>Sous l'effectif attendu</span>
                    <b className={meilleur('sousEffectif', i) ? 'best' : ''}>{k.sousEffectif ? fmtDuree(k.sousEffectif) : 'Jamais'}</b>
                  </div>
                </button>
              );
            })}
          </div>
          {retenu?.blocages.length ? (
            <div className="col" style={{ gap: 8 }}>
              <div className="eyebrow">Ce que le calcul ne peut pas résoudre seul</div>
              {retenu.blocages.map((b, i) => (
                <CarteBlocage key={i} b={b} data={data} ouvert />
              ))}
            </div>
          ) : null}
          <p className="tiny muted">
            Indicateurs calculés sur les données saisies. Le coût est une estimation à partir de taux horaires indicatifs, pas un calcul de paie.
          </p>
        </>
      ) : null}
    </Dialog>
  );
}

// ------------------------------------------------------------ Publication

function DialoguePublication({ semaine, onClose }: { semaine: ISODate; onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const publier = useStore((s) => s.publier);
  const dire = useUi((s) => s.dire);
  const ctrl = useMemo(() => controlePublication(data, semaine, today), [data, semaine, today]);
  const bloquants = ctrl.issues.filter((i) => i.gravite === 'bloquant');
  const alertes = ctrl.issues.filter((i) => i.gravite === 'alerte');
  const [assume, setAssume] = useState(false);
  const [accords, setAccords] = useState<string[]>([]);
  const pret = (!bloquants.length || assume) && ctrl.delais.every((d) => accords.includes(d.id));
  const nom = (id: string): string => {
    const p = data.personnes.find((x) => x.id === id);
    return p ? nomCourt(p) : '';
  };

  return (
    <Dialog
      size="mid"
      title={ctrl.premiere ? 'Publier le planning' : 'Publier les modifications'}
      subtitle={`Semaine ${isoWeek(semaine)} · ${fmtSemaine(semaine)}. Une fois publié, le planning devient la version officielle vue par l'équipe.`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Revenir au brouillon
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!pret}
            onClick={() => {
              publier(semaine, ctrl.delais.filter((d) => accords.includes(d.id)).map((d) => d.message), assume ? bloquants.length : 0);
              dire(ctrl.premiere ? 'Planning publié. L’équipe peut le consulter.' : 'Modifications publiées et notifiées.');
              onClose();
            }}
          >
            <CalendarCheck size={15} /> {ctrl.premiere ? 'Publier' : 'Publier et notifier'}
          </button>
        </>
      }
    >
      {bloquants.length ? (
        <div className="col" style={{ gap: 8 }}>
          <div className="notice danger">
            <AlertTriangle size={16} />
            <div>
              <b>{bloquants.length} point{bloquants.length > 1 ? 's' : ''} bloquant{bloquants.length > 1 ? 's' : ''} non résolu{bloquants.length > 1 ? 's' : ''}.</b> Corrigez-les dans le brouillon, ou assumez explicitement la publication.
            </div>
          </div>
          <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>
            {bloquants.slice(0, 6).map((i) => (
              <li key={i.id}>{i.message}</li>
            ))}
            {bloquants.length > 6 ? <li>… et {bloquants.length - 6} autre{bloquants.length - 6 > 1 ? 's' : ''}</li> : null}
          </ul>
          <label className="check">
            <input type="checkbox" checked={assume} onChange={(e) => setAssume(e.target.checked)} />
            Je publie en connaissance de cause. Cette décision sera inscrite au journal avec les règles en vigueur.
          </label>
        </div>
      ) : (
        <div className="notice ok">
          <CircleCheck size={16} /> Aucun point bloquant. {alertes.length ? `${alertes.length} alerte${alertes.length > 1 ? 's' : ''} d'organisation reste${alertes.length > 1 ? 'nt' : ''} visible${alertes.length > 1 ? 's' : ''} dans les contrôles.` : 'Aucune alerte.'}
        </div>
      )}

      {ctrl.delais.length ? (
        <div className="col" style={{ gap: 8 }}>
          <div className="eyebrow">Délais de prévenance non tenus : accord à recueillir</div>
          {ctrl.delais.map((d) => (
            <label key={d.id} className="check">
              <input type="checkbox" checked={accords.includes(d.id)} onChange={(e) => setAccords((a) => (e.target.checked ? [...a, d.id] : a.filter((x) => x !== d.id)))} />
              <span>
                {d.message}
                <span className="soft" style={{ display: 'block' }}>J'ai recueilli l'accord de {nom(d.personId)} ; il sera tracé au journal.</span>
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {!ctrl.premiere ? (
        <div className="col" style={{ gap: 6 }}>
          <div className="eyebrow">{ctrl.changements.length} changement{ctrl.changements.length > 1 ? 's' : ''} par rapport à la version publiée</div>
          {ctrl.changements.map((c, i) => (
            <div key={i} className="row small" style={{ gap: 12 }}>
              <b style={{ minWidth: 150 }}>
                {nom(c.personId)} · {JOURS[weekday(c.date)]}
              </b>
              <AvantApres avant={c.avant} apres={c.apres} />
            </div>
          ))}
          <p className="tiny muted">Chaque personne concernée reçoit son changement exact, avant et après. Les autres ne sont pas dérangées.</p>
        </div>
      ) : (
        <p className="small soft">
          {shiftsSemaine(data, semaine).length} postes seront communiqués à l'équipe. La publication est horodatée et conservée avec la version des règles appliquées.
        </p>
      )}
    </Dialog>
  );
}
