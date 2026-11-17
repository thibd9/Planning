import {
  AlertTriangle,
  Ban,
  CalendarCheck,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CloudSun,
  Copy,
  GraduationCap,
  Info,
  Lock,
  MessageCircleQuestion,
  Minus,
  Moon,
  Package,
  Pencil,
  Plus,
  Printer,
  Redo2,
  ShieldAlert,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Trash2,
  TreePalm,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  JOURS,
  JOURS_COURT,
  addDays,
  dayIndex,
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
  totalDuree,
  uid,
  weekDates,
  weekday,
} from '../../domain/time';
import type { Activite, AppData, ISODate, Person, Shift } from '../../domain/types';
import { HEBERGE } from '../../env';
import { ABSENCE_LABEL, ACTIVITE_LABEL, GARDE_LABEL, MISSION_LABEL, estPharmacien, nomComplet, nomCourt } from '../../domain/types';
import {
  besoinsDe,
  decrireBesoin,
  decrireShift,
  estFermeture,
  estOuverture,
  minutesSemaine,
  minutesTravail,
  ouverture,
  pharmacienSeulEnRendezVous,
  presencePharmaciens,
  shiftsSemaine,
  sousEffectifs,
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
import { AvantApres, Avatar, Dialog, Empty, Pill, Seg, Strip, Track, roleDe } from '../kit';

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

  const ouverts = dates.map((d) => ouverture(data.officine, d).length > 0);
  const avecSynthese = lecture !== 'heures';
  const colonnes = `212px ${dates
    .map((d, i) => (ouverts[i] ? 'minmax(104px, 1fr)' : data.gardes.some((g) => g.date === d && g.personId) ? '104px' : '44px'))
    .join(' ')}${avecSynthese ? ' 136px' : ''}`;
  const visibles = data.personnes.filter((p) => !p.externe || postes.some((s) => s.personId === p.id));
  const lignesEquite = useMemo(
    () => (lecture === 'equite' ? equite(data, periodeAvant(semaine, 8).from, addDays(semaine, 6)) : []),
    [data, semaine, lecture],
  );
  const nb = { bloquant: issues.filter((i) => i.gravite === 'bloquant').length, alerte: issues.filter((i) => i.gravite === 'alerte').length };
  // Part des minutes d'ouverture où un pharmacien est planifié.
  const couverture = useMemo(() => {
    let total = 0;
    let sans = 0;
    for (const d of dates) {
      total += totalDuree(ouverture(data.officine, d));
      sans += totalDuree(trousPharmacien(data, d));
    }
    return total ? Math.round(((total - sans) / total) * 100) : 0;
  }, [data, dates]);
  const joursAvant = dayIndex(semaine) - dayIndex(today);
  const sansEquipe = !data.personnes.some((p) => !p.externe);
  const aller = useUi((s) => s.aller);
  const visiblesIssues = (postes.length ? issues : []).filter(
    (i) => !(i.regle === 'pharmacie.presence' && blocages.some((b) => b.date === i.date && b.start !== undefined && b.start <= (i.start ?? 0) && (i.end ?? 0) <= (b.end ?? 0))),
  );

  return (
    <div>
      <div className="page-head">
        <span className="page-ico">
          <CalendarRange size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Construire</div>
          <h1>
            Comment couvrir <em>la semaine</em> ?
          </h1>
        </div>
        <div className="row no-print" style={{ gap: 4 }}>
          <button type="button" className="btn ghost icon" onClick={undo} disabled={!past.length} aria-label="Annuler la dernière manipulation" title="Annuler (Ctrl + Z)">
            <Undo2 size={17} />
          </button>
          <button type="button" className="btn ghost icon" onClick={redo} disabled={!future.length} aria-label="Rétablir" title="Rétablir (Ctrl + Maj + Z)">
            <Redo2 size={17} />
          </button>
          {!HEBERGE ? (
            <button type="button" className="btn ghost icon" onClick={() => window.print()} aria-label="Imprimer le planning" title="Imprimer">
              <Printer size={17} />
            </button>
          ) : null}
        </div>
      </div>

      {sansEquipe ? (
        <Empty
          icon={<Users size={30} />}
          title="Ajoutez d’abord votre équipe"
          action={
            <button type="button" className="btn primary" onClick={() => aller('equipe')}>
              <Plus size={15} /> Ajouter une personne
            </button>
          }
        >
          Le planning se construit autour des personnes : au moins un pharmacien, puis les préparateurs et les autres postes.
        </Empty>
      ) : (
        <>
          <div className="plan">
            <div className="plan-bar">
              <div className="week-nav">
                <button type="button" className="btn ghost icon" onClick={() => setSemaine(addDays(semaine, -7))} aria-label="Semaine précédente">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" className="btn ghost icon" onClick={() => setSemaine(addDays(semaine, 7))} aria-label="Semaine suivante">
                  <ChevronRight size={18} />
                </button>
                <div className="label" aria-live="polite">
                  {fmtSemaine(semaine)}
                  <small>
                    Semaine {isoWeek(semaine)} ·{' '}
                    {semaine === mondayOf(today) ? 'en cours' : semaine === addDays(mondayOf(today), 7) ? 'la semaine prochaine' : passee ? 'passée' : `dans ${Math.round(joursAvant / 7)} semaines`}
                  </small>
                </div>
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
                <Pill tone="iris" title="Un brouillon n'est visible que par le responsable">
                  <Pencil size={12} /> Brouillon
                </Pill>
              )}
              {postes.length ? (
                <span className="ring" title="Part des minutes d'ouverture où un pharmacien est planifié">
                  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="#e9e8f6" strokeWidth="3.5" />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke={couverture === 100 ? '#12936a' : '#7c6cf5'}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray={`${(couverture / 100) * 56.5} 56.5`}
                    />
                  </svg>
                  <span className="num">{couverture} %</span>
                  <small>
                    pharmacien présent{joursAvant > 0 && statut?.statut !== 'publie' ? ` · J − ${joursAvant}` : ''}
                  </small>
                </span>
              ) : null}
              <div className="right row wrap no-print" style={{ gap: 8 }}>
                <Seg<Lecture>
                  label="Lecture du planning"
                  value={lecture}
                  onChange={setLecture}
                  options={[
                    { value: 'heures', label: 'Heures' },
                    { value: 'cout', label: 'Coût' },
                    { value: 'equite', label: 'Équité' },
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
                    <button type="button" className="btn magic" data-tour="proposer" onClick={() => setGeneration(true)}>
                      <Sparkles size={15} /> Proposer un planning
                    </button>
                    <button type="button" className="btn primary" onClick={() => setPublication(true)} disabled={!postes.length || (statut?.statut === 'publie' && !enAttente)}>
                      <CalendarCheck size={15} /> {statut?.statut === 'publie' ? 'Publier les modifications' : 'Publier'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="plan-scroll" data-tour="grille">
              <div className="plan-grid" style={{ gridTemplateColumns: colonnes }} role="table" aria-label={`Planning de la semaine du ${fmtSemaine(semaine)}`}>
                <div className="pg-h" role="columnheader">
                  <span className="eyebrow">Équipe</span>
                </div>
                {dates.map((date, i) => (
                  <div key={date} className={`pg-h${date === today ? ' today' : ''}${!ouverts[i] ? ' closed' : ''}`} role="columnheader">
                    <span className="n">{Number(date.slice(8))}</span>
                    <span className="d">{ouverts[i] ? JOURS[weekday(date)] : JOURS_COURT[weekday(date)]}</span>
                  </div>
                ))}
                {avecSynthese ? (
                  <div className="pg-h" role="columnheader">
                    <span className="n num" style={{ fontSize: 15 }}>{lecture === 'cout' ? fmtEuros(coutSemaine(data, semaine)) : '8 semaines'}</span>
                    <span className="d">{lecture === 'cout' ? 'coût estimé' : 'samedis, fermetures'}</span>
                  </div>
                ) : null}

                <div className="pg-o lab" role="rowheader">
                  Couverture
                </div>
                {dates.map((date, i) => (
                  <Objectif key={date} data={data} date={date} echelle={echelle} ouvert={ouverts[i]} vide={!postes.some((s) => s.date === date)} flag={!!focus && focus.date === date && !focus.personId} />
                ))}
                {avecSynthese ? <div className="pg-o" /> : null}

                {GROUPES.map((g) => {
                  const membres = visibles.filter(g.test);
                  if (!membres.length) return null;
                  return (
                    <div key={g.titre} style={{ display: 'contents' }}>
                      <div className="pg-group">
                        <span className="dot" style={{ background: g.couleur }} /> {g.titre}
                      </div>
                      {membres.map((p) => {
                        const minutes = minutesSemaine(data, p.id, semaine);
                        const ecart = minutes - p.heuresHebdo * 60;
                        return (
                          <div key={p.id} style={{ display: 'contents' }} role="row">
                            <div className="pg-p" role="rowheader">
                              <Avatar person={p} />
                              <div className="grow">
                                <div className="nm">{nomCourt(p)}</div>
                                <div className="meta num">
                                  {p.externe ? (
                                    <>Remplaçant · {fmtDuree(minutes)}</>
                                  ) : (
                                    <>
                                      <b>{fmtDuree(minutes)}</b> / {p.heuresHebdo} h
                                      {postes.length ? (
                                        <span className={ecart === 0 ? 'egal' : ecart > 0 ? 'plus' : 'moins'}> · {ecart === 0 ? 'atteint' : `${ecart > 0 ? '+' : '−'} ${fmtDuree(Math.abs(ecart))}`}</span>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            {dates.map((date, i) => {
                              const cle = `${p.id}|${date}`;
                              const duJour = postes.filter((s) => s.personId === p.id && s.date === date).sort((a, b) => a.start - b.start);
                              const absence = data.absences.find((a) => a.personId === p.id && a.statut === 'approuvee' && a.from <= date && date <= a.to);
                              const reconnus = besoinsDe(data, p.id, date).filter((b) => b.statut === 'reconnue');
                              const gardes = data.gardes.filter((g) => g.personId === p.id && g.date === date);
                              const missions = data.missions.filter((m) => m.personId === p.id && m.date === date);
                              const signale = !!focus && focus.personId === p.id && (!focus.date || focus.date === date);
                              return (
                                <div
                                  key={date}
                                  role="cell"
                                  className={`pg-c${!ouverts[i] ? ' closed' : ''}${survol === cle ? ' over' : ''}${signale ? ' flag' : ''}`}
                                  onDragOver={(e) => {
                                    if (passee || !ouverts[i]) return;
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
                                    <span className={`tile ${absence.type === 'conge' ? 'conge' : absence.type === 'maladie' ? 'arret' : 'absence'}`}>
                                      <span className="ti">{absence.type === 'conge' ? <TreePalm size={14} /> : absence.type === 'maladie' ? <Thermometer size={14} /> : absence.type === 'formation' ? <GraduationCap size={14} /> : <Ban size={14} />}</span>
                                      <span className="tt">{ABSENCE_LABEL[absence.type]}</span>
                                    </span>
                                  ) : null}
                                  {duJour.map((s) => (
                                    <Tuile key={s.id} data={data} s={s} person={p} echelle={echelle} missions={missions} glissable={!passee} onClick={() => setEdition({ personId: p.id, date, shift: s })} />
                                  ))}
                                  {gardes.map((g) => (
                                    <span key={g.id} className="tile garde" title={GARDE_LABEL[g.type]}>
                                      <span className="ti">
                                        <Moon size={14} />
                                      </span>
                                      <span className="tt num">
                                        {fmtHHMM(g.start)}→{fmtHHMM(g.end)}
                                        <span className="ts">{g.type === 'astreinte' ? 'Astreinte' : 'Garde'}</span>
                                      </span>
                                    </span>
                                  ))}
                                  {!duJour.length && !absence && !gardes.length && ouverts[i] && !passee ? (
                                    <button type="button" className="add" onClick={() => setEdition({ personId: p.id, date })} aria-label={`Ajouter un poste à ${nomCourt(p)} ${JOURS[weekday(date)]}`}>
                                      <Plus size={15} />
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                            {avecSynthese ? <Resume data={data} person={p} semaine={semaine} lecture={lecture} lignes={lignesEquite} /> : null}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="legend">
              <span><i style={{ background: 'linear-gradient(135deg, #fff0b0, #f9d75e)' }} /> Ouverture, matin</span>
              <span><i style={{ background: 'linear-gradient(135deg, #e4dfff, #c0b6ff)' }} /> Fermeture, après-midi</span>
              <span><i style={{ background: 'linear-gradient(120deg, #fde68a, #c9bfff)' }} /> Journée complète</span>
              <span><i style={{ background: 'linear-gradient(135deg, #34347a, #26265a)' }} /> Garde</span>
              <span><i style={{ background: 'linear-gradient(135deg, #e4f3fb, #cfe9f8)' }} /> Congé</span>
              <span><Lock size={12} /> Indisponibilité reconnue</span>
              <span><Sparkles size={12} /> Affectation expliquée</span>
            </div>
          </div>

          {!postes.length && !passee ? (
            <div className="card pad" style={{ marginTop: 16, background: 'var(--grad-soft)' }}>
              <div className="row wrap">
                <span className="ico grad">
                  <Sparkles size={18} />
                </span>
                <div className="grow">
                  <h3>Cette semaine est vide</h3>
                  <p className="soft" style={{ marginTop: 4 }}>
                    Demandez trois propositions comparables, recopiez la semaine précédente, ou cliquez sur un « + » pour poser un poste à la main.
                  </p>
                </div>
                <button type="button" className="btn magic" onClick={() => setGeneration(true)}>
                  <Sparkles size={15} /> Proposer un planning
                </button>
              </div>
            </div>
          ) : null}

          <section className="card no-print" style={{ marginTop: 20 }} data-tour="controles" aria-label="Contrôles de la semaine">
            <div className="card-head">
              <span className="ico">
                <ShieldAlert size={18} />
              </span>
              <div className="grow">
                <h3>Contrôles</h3>
                <div className="small soft">Aide à la conformité : ces contrôles signalent des écarts, ils ne valent pas certification.</div>
              </div>
              {!postes.length ? (
                <Pill>Semaine vide</Pill>
              ) : nb.bloquant ? (
                <Pill tone="danger">
                  {nb.bloquant} bloquant{nb.bloquant > 1 ? 's' : ''}
                </Pill>
              ) : (
                <Pill tone="ok">
                  <CircleCheck size={13} /> Aucun bloquant
                </Pill>
              )}
              {postes.length && nb.alerte ? (
                <Pill tone="warn" title="Alertes d'organisation">
                  {nb.alerte} alerte{nb.alerte > 1 ? 's' : ''}
                </Pill>
              ) : null}
              {postes.length && !passee ? (
                <button
                  type="button"
                  className="btn ghost sm danger"
                  onClick={() => {
                    viderSemaine(semaine);
                    dire('Semaine vidée.', true);
                  }}
                >
                  <Trash2 size={14} /> Vider la semaine
                </button>
              ) : null}
            </div>
            <div className="card-body">
              {blocages.length || visiblesIssues.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                  {blocages.map((b, i) => (
                    <CarteBlocage key={i} b={b} data={data} onFocus={() => setFocus(b.date ? { date: b.date } : null)} />
                  ))}
                  {visiblesIssues.map((i) => (
                    <CarteIssue key={i.id} issue={i} data={data} onClick={() => setFocus(i.personId || i.date ? { personId: i.personId, date: i.date } : null)} />
                  ))}
                </div>
              ) : (
                <p className="soft small">
                  {postes.length ? 'Aucun point à signaler sur cette semaine.' : 'Aucune impossibilité détectée avec les contraintes connues. Les contrôles détaillés démarrent au premier poste posé.'}
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {edition ? <DialoguePoste {...edition} onClose={() => setEdition(null)} /> : null}
      {generation ? <DialogueGeneration semaine={semaine} onClose={() => setGeneration(false)} /> : null}
      {publication ? <DialoguePublication semaine={semaine} onClose={() => setPublication(false)} /> : null}
    </div>
  );
}

const pct = (e: Echelle, m: number): number => Math.max(0, Math.min(100, ((m - e.start) / (e.end - e.start)) * 100));

/** Tuile d'un poste : pictogramme du moment de la journée, horaires, et position dans la journée. */
function Tuile({
  data,
  s,
  person,
  echelle,
  missions,
  glissable,
  onClick,
}: {
  data: AppData;
  s: Shift;
  person: Person;
  echelle: Echelle;
  missions: { start: number; end: number }[];
  glissable: boolean;
  onClick: () => void;
}): JSX.Element {
  const ouvre = estOuverture(data.officine, s);
  const ferme = estFermeture(data.officine, s);
  const categorie = ouvre && ferme ? 'journee' : ouvre ? 'matin' : ferme ? 'soir' : 'milieu';
  const Icone =
    s.activite === 'formation' ? GraduationCap : s.activite !== 'comptoir' ? Package : categorie === 'matin' ? (s.end - s.start <= 330 ? Sunrise : Sun) : categorie === 'soir' ? Sunset : categorie === 'journee' ? Sun : CloudSun;
  const activite = s.activite === 'back' ? 'réception' : s.activite === 'admin' ? 'administratif' : s.activite === 'formation' ? 'formation' : '';
  return (
    <button
      type="button"
      className={`tile ${categorie}${s.activite !== 'comptoir' ? ' back' : ''}${person.externe ? ' ext' : ''}`}
      draggable={glissable}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', s.id)}
      onClick={onClick}
      aria-label={`${nomCourt(person)}, ${JOURS[weekday(s.date)]} : ${decrireShift(s)}, ${ACTIVITE_LABEL[s.activite]}. Modifier.`}
      title={s.explication ?? `${decrireShift(s)} · ${ACTIVITE_LABEL[s.activite]}`}
    >
      <span className="ti">
        <Icone size={14} />
      </span>
      <span className="tt num">
        {fmtHHMM(s.start)}–{fmtHHMM(s.end)}
        <span className="ts">
          {fmtDuree(minutesTravail(s))}
          {activite ? ` · ${activite}` : ''}
        </span>
      </span>
      <span className="tline" aria-hidden="true">
        <i style={{ left: `${pct(echelle, s.start)}%`, width: `${pct(echelle, s.end) - pct(echelle, s.start)}%` }} />
        {s.pauseStart !== undefined && s.pauseEnd !== undefined ? <i className="p" style={{ left: `${pct(echelle, s.pauseStart)}%`, width: `${pct(echelle, s.pauseEnd) - pct(echelle, s.pauseStart)}%` }} /> : null}
        {missions.map((m, i) => (
          <i key={i} className="m" style={{ left: `${pct(echelle, m.start)}%`, width: `${pct(echelle, m.end) - pct(echelle, m.start)}%` }} />
        ))}
      </span>
      {s.explication ? (
        <span className="why" aria-label="Affectation expliquée">
          <Sparkles size={9} />
        </span>
      ) : null}
    </button>
  );
}

/** Ligne « Couverture » : un coup d'œil par jour sur la présence d'un pharmacien et l'effectif. */
function Objectif({ data, date, echelle, ouvert, vide, flag }: { data: AppData; date: ISODate; echelle: Echelle; ouvert: boolean; vide: boolean; flag: boolean }): JSX.Element {
  if (!ouvert) {
    return (
      <div className="pg-o" role="cell">
        <span className="mark off" title="Officine fermée">
          <Minus size={14} />
        </span>
      </div>
    );
  }
  const trous = trousPharmacien(data, date);
  const sous = vide ? [] : sousEffectifs(data, date);
  const etat = vide ? 'off' : trous.length ? 'bad' : sous.length ? 'warn' : 'ok';
  const texte = vide
    ? 'Aucun poste posé ce jour-là'
    : trous.length
      ? `Sans pharmacien : ${trous.map((t) => `${fmtHeure(t.start)} – ${fmtHeure(t.end)}`).join(', ')}`
      : sous.length
        ? `Sous l'effectif attendu : ${sous.map((t) => `${fmtHeure(t.start)} – ${fmtHeure(t.end)}`).join(', ')}`
        : 'Pharmacien présent sur toute l’ouverture, effectif atteint';
  return (
    <div className={`pg-o${flag ? ' flag' : ''}`} role="cell" title={texte}>
      <span className={`mark ${etat}`}>{etat === 'ok' ? <Check size={15} /> : etat === 'bad' ? <X size={14} /> : etat === 'warn' ? <AlertTriangle size={13} /> : <Minus size={14} />}</span>
      <span className="sr">{texte}</span>
      {vide ? null : (
        <Strip
          echelle={echelle}
          parts={[
            { cls: 'open', list: ouverture(data.officine, date) },
            { cls: 'ph', list: presencePharmaciens(data, date) },
            { cls: 'rdv', list: pharmacienSeulEnRendezVous(data, date) },
            { cls: 'gap', list: trous },
          ]}
        />
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
          {l.attendu.samedis !== null ? <span className="muted"> / {fmtDecimal(l.attendu.samedis, 1)}</span> : null} · Ferm. <b>{l.reel.fermetures}</b>
        </span>
        <Pill tone={f.niveau === 'élevée' ? 'danger' : f.niveau === 'modérée' ? 'warn' : 'ok'}>Fatigue {f.niveau}</Pill>
      </div>
    );
  }
  if (person.externe) {
    return (
      <div className="pg-sum">
        <b className="num">{fmtEuros(((person.tauxHoraire ?? 0) * minutes) / 60)}</b>
        <span className="muted tiny">facturé</span>
      </div>
    );
  }
  const d = decompteSemaine(data, person, minutes);
  return (
    <div className="pg-sum">
      <b className="num">{d.cout !== null ? fmtEuros(d.cout) : '—'}</b>
      <span className="muted tiny">{!person.salarie ? 'titulaire' : person.tauxHoraire === null ? 'taux non saisi' : d.auDela ? `dont ${fmtDuree(d.auDela)} en plus` : 'sans dépassement'}</span>
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
            <button type="button" className="btn magic" onClick={() => lancer(graine)} data-autofocus>
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
