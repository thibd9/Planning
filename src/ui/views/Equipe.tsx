import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Award, BriefcaseBusiness, CalendarOff, ChartLine, Check, ClipboardList, Crown, HandHelping, Medal, HeartHandshake, KeyRound, Lightbulb, Lock, Plus, RefreshCw, ShieldCheck, Sparkles, Stethoscope, Trash2, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { fmtDateCourt, uid } from '../../domain/time';
import type { Besoin, CompetenceId, Person, Qualification } from '../../domain/types';
import type { AppData } from '../../domain/types';
import { COMPETENCE_FAMILLES, COMPETENCE_LABEL, QUALIFICATION_LABEL, estPharmacien, libelleAbsence, nomComplet } from '../../domain/types';
import { decrireBesoin } from '../../engine/core';
import { pointsForts, suiviDe } from '../../engine/suivi';
import { quotaAdjoints, validateEquipe } from '../../engine/validate';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Compteurs, PointsForts } from '../components/Compteurs';
import { DialogueDemande } from '../components/Demande';
import { DialogueFormation } from '../components/Formation';
import { DialogueInventaire } from '../components/Inventaire';
import { empreinte, estResponsable, identifiantPropose, libelleRole, memeIdentifiant, responsable } from '../../domain/acces';
import { COMPETENCE_ICONE, EtiquetteRole } from '../icons';
import { Avatar, Dialog, Empty, Pill } from '../kit';
import { usagePlafond } from './Resoudre';

/** Mot de passe provisoire : six chiffres, à transmettre de vive voix puis à changer. */
const provisoire = (): string => String(Math.floor(100000 + Math.random() * 900000));

/** Identifiants déjà pris, toutes pharmacies confondues : un identifiant désigne une seule personne. */
const identifiantsPris = (data: AppData, autres: Record<string, AppData>): string[] =>
  [data, ...Object.values(autres)].flatMap((d) => d.personnes.map((p) => p.identifiant ?? '')).filter(Boolean);

export const STATUT_BESOIN: Record<Besoin['statut'], { label: string; tone: string }> = {
  reconnue: { label: 'Indisponibilité reconnue', tone: 'danger' },
  prioritaire: { label: 'Préférence prioritaire', tone: 'miel' },
  preference: { label: 'Simple préférence', tone: '' },
};

export function Equipe(): JSX.Element {
  const data = useStore((s) => s.data);
  const { personneId, ouvrirPersonne } = useUi();
  const alertes = useMemo(() => validateEquipe(data), [data]);
  const [ajout, setAjout] = useState(false);
  const [formation, setFormation] = useState(false);
  const [inventaire, setInventaire] = useState(false);
  const { intention, setIntention } = useUi();
  useEffect(() => {
    if (intention === 'personne') {
      setAjout(true);
      setIntention(null);
    }
    if (intention === 'formation') {
      setFormation(true);
      setIntention(null);
    }
    if (intention === 'inventaire') {
      setInventaire(true);
      setIntention(null);
    }
  }, [intention, setIntention]);
  const quota = quotaAdjoints(data);
  const internes = data.personnes.filter((p) => !p.externe);
  const externes = data.personnes.filter((p) => p.externe);
  const courant = data.personnes.find((p) => p.id === personneId) ?? internes[0];
  // Les points forts de l'équipe ne sont montrés qu'aux titulaires ; eux-mêmes n'y figurent pas.
  const today = useStore((s) => s.today);
  const session = useUi((s) => s.session);
  const titulaire = data.personnes.find((p) => memeIdentifiant(p.identifiant, session ?? ''))?.qualification === 'titulaire';
  const enAvant = useMemo(
    () =>
      titulaire
        ? data.personnes
            .filter((p) => !p.externe && p.qualification !== 'titulaire')
            .map((p) => ({ p, points: pointsForts(data, p.id, today) }))
            .filter((x) => x.points.length)
            .sort((a, b) => a.p.prenom.localeCompare(b.p.prenom))
        : [],
    [data, today, titulaire],
  );

  return (
    <div>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <Users size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Équipe</div>
          <h1>Qui peut faire quoi, et quand</h1>
          <p>Contrats, compétences et besoins personnels. Un besoin décrit une contrainte d'horaire, jamais sa raison.</p>
        </div>
        {quota ? (
          <div className="card pad" style={{ padding: '10px 16px' }}>
            <div className="eyebrow">Pharmaciens adjoints</div>
            <div className="row" style={{ marginTop: 2 }}>
              <b className="num" style={{ fontSize: 20 }}>
                {quota.etpActuel.toLocaleString('fr-FR')} / {quota.etpRequis}
              </b>
              <span className="small soft">équivalent temps plein</span>
              {quota.etpActuel < quota.etpRequis ? <Pill tone="warn">Sous le seuil</Pill> : <Pill tone="ok">Conforme au seuil</Pill>}
            </div>
          </div>
        ) : null}
      </div>
      {alertes.map((a) => (
        <div key={a.id} className="notice warn" style={{ marginBottom: 10 }}>
          <AlertTriangle size={16} /> {a.message}
        </div>
      ))}

      {!data.personnes.length ? (
        <Empty
          icon={<Users size={30} />}
          title="Aucune personne dans l’équipe"
          action={
            <button type="button" className="btn primary" onClick={() => setAjout(true)}>
              <Plus size={15} /> Ajouter une personne
            </button>
          }
        >
          Commencez par le titulaire et les pharmaciens adjoints, puis les préparateurs et les autres postes.
        </Empty>
      ) : null}
      {enAvant.length ? (
        <section className="card pf-carte" data-focus="points-forts">
          <div className="card-head">
            <span className="pf-ico" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <div className="grow">
              <h2 className="h3">Sur qui compter</h2>
              <p className="small soft" style={{ margin: 0 }}>Ce que chacun apporte, d’après les faits des 12 derniers mois. Ni note, ni classement.</p>
            </div>
          </div>
          <ul className="pf-equipe">
            {enAvant.map(({ p, points }) => (
              <li key={p.id}>
                <button type="button" className="pf-qui" onClick={() => ouvrirPersonne(p.id)} title="Ouvrir sa fiche">
                  <Avatar person={p} />
                  <span className="pf-nom">
                    <b>{nomComplet(p)}</b>
                    <span className="small soft">{libelleRole(data, p)}</span>
                  </span>
                </button>
                <PointsForts points={points} court />
              </li>
            ))}
          </ul>
          <p className="tiny muted pf-note">Classés par prénom. Les arrêts, les congés et les absences n’entrent jamais en compte.</p>
        </section>
      ) : null}
      <div className="split" style={{ gridTemplateColumns: '340px minmax(0, 1fr)', display: data.personnes.length ? undefined : 'none' }}>
        <div className="col" style={{ gap: 8 }}>
          <button data-focus="ajouter-personne" type="button" className="btn primary" onClick={() => setAjout(true)} style={{ alignSelf: 'stretch' }}>
            <Plus size={15} /> Ajouter une personne
          </button>
          {POSTES.map((g) => {
            const membres = internes.filter((p) => g.cles.includes(p.qualification));
            if (!membres.length) return null;
            return (
              <div key={g.titre} className="col" style={{ gap: 8 }}>
                <div className="eyebrow poste-titre">
                  {g.titre} <span className="soft">· {membres.length}</span>
                </div>
                {membres.map((p) => (
                  <LignePersonne key={p.id} p={p} on={courant?.id === p.id} onClick={() => ouvrirPersonne(p.id)} />
                ))}
              </div>
            );
          })}
          {externes.length ? <div className="eyebrow" style={{ margin: '12px 4px 2px' }}>Remplaçants habituels</div> : null}
          {externes.map((p) => (
            <LignePersonne key={p.id} p={p} on={courant?.id === p.id} onClick={() => ouvrirPersonne(p.id)} />
          ))}
        </div>
        {courant ? <Fiche key={courant.id} person={courant} /> : null}
      </div>
      {ajout ? <DialoguePersonne onClose={() => setAjout(false)} /> : null}
      {formation ? <DialogueFormation onClose={() => setFormation(false)} /> : null}
      {inventaire ? <DialogueInventaire onClose={() => setInventaire(false)} /> : null}
    </div>
  );
}

/** Un groupe par poste : on ne mélange pas apprentis, étudiants et animateurs. */
const POSTES: { titre: string; cles: Qualification[] }[] = [
  { titre: 'Titulaires', cles: ['titulaire'] },
  { titre: 'Pharmaciens adjoints', cles: ['adjoint'] },
  { titre: 'Préparateurs', cles: ['preparateur'] },
  { titre: 'Animateurs', cles: ['animateur'] },
  { titre: 'Apprentis', cles: ['apprenti'] },
  { titre: 'Étudiants', cles: ['etudiant'] },
  { titre: 'Rayonnistes', cles: ['rayonniste'] },
];

function LignePersonne({ p, on, onClick }: { p: Person; on: boolean; onClick: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  return (
    <button type="button" className={`g-item${on ? ' on' : ''}`} onClick={onClick} aria-pressed={on}>
      <Avatar person={p} lg />
      <span className="grow">
        <b>{nomComplet(p)}</b>
        <span className="row wrap" style={{ gap: 6, marginTop: 4 }}>
          <EtiquetteRole person={p} />
          <span className="small soft">{p.externe ? `${p.tauxHoraire} € / h facturés` : `${p.heuresHebdo} h${p.heuresHebdo < 35 && p.salarie ? ' (temps partiel)' : ''}`}</span>
          {!estResponsable(data, p) && p.gestion ? <Pill tone="iris">Accès gestion</Pill> : null}
        </span>
      </span>
    </button>
  );
}

/** Une icône par famille de compétences, dans l'ordre de COMPETENCE_FAMILLES. */
const FAMILLE_ICONE: LucideIcon[] = [Stethoscope, Lightbulb, ClipboardList];

/** Titre d'une rubrique de la fiche : une icône, le nom, et à droite un compteur ou une action. */
function TitreFiche({ icone: Icone, children, note, droite }: { icone: LucideIcon; children: ReactNode; note?: string; droite?: ReactNode }): JSX.Element {
  return (
    <div className="fiche-titre">
      <span className="fiche-pic" aria-hidden="true">
        <Icone size={17} />
      </span>
      <h3 className="grow">{children}</h3>
      {note ? <span className="small soft">{note}</span> : null}
      {droite}
    </div>
  );
}

function Fiche({ person }: { person: Person }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { majPersonne, supprimerBesoin, deciderAbsence, supprimerPersonne, autres } = useStore();
  const ouvrirPersonne = useUi((s) => s.ouvrirPersonne);
  const [retrait, setRetrait] = useState(false);
  const session = useUi((s) => s.session);
  const chef = responsable(data);
  const jeSuisResponsable = !!chef && memeIdentifiant(chef.identifiant, session ?? '');
  const jeSuisTitulaire = data.personnes.find((p) => memeIdentifiant(p.identifiant, session ?? ''))?.qualification === 'titulaire';
  const forts = useMemo(() => (person.externe || person.qualification === 'titulaire' ? [] : pointsForts(data, person.id, today)), [data, person, today]);
  const dire = useUi((s) => s.dire);
  const [demande, setDemande] = useState(false);
  const besoins = data.besoins.filter((b) => b.personId === person.id && b.decision !== 'refusee' && (!b.to || b.to >= today));
  const absences = data.absences.filter((a) => a.personId === person.id && a.to >= today && a.statut !== 'refusee').sort((a, b) => a.from.localeCompare(b.from));
  const usage = usagePlafond(data, person.id, today);
  const maj = (patch: Partial<Person>): void => majPersonne({ ...person, ...patch });

  return (
    <div className="card">
      <div className="card-head">
        <Avatar person={person} lg />
        <div className="grow">
          <h2>{nomComplet(person)}</h2>
          <div className="small soft">
            {libelleRole(data, person)}
            {person.externe ? ' · remplaçant habituel' : !person.salarie ? ' · hors décompte salarié' : ''}
          </div>
        </div>
        {!person.externe ? (
          <button type="button" className="btn" onClick={() => setDemande(true)}>
            <Plus size={15} /> Besoin ou absence
          </button>
        ) : null}
      </div>
      <div className="card-body col fiche" style={{ gap: 26 }}>
        <TitreFiche icone={BriefcaseBusiness}>Poste et contrat</TitreFiche>
        <section className="row wrap" style={{ alignItems: 'flex-end', marginTop: -12 }}>
          <label className="field">
            Fonction
            <select value={person.qualification} onChange={(e) => maj({ qualification: e.target.value as Qualification, salarie: e.target.value !== 'titulaire' })}>
              {(Object.keys(QUALIFICATION_LABEL) as Qualification[]).map((q) => (
                <option key={q} value={q}>
                  {QUALIFICATION_LABEL[q]}
                </option>
              ))}
            </select>
          </label>
          {!person.externe ? (
            <label className="field">
              Heures par semaine
              <input type="number" min={0} max={48} step={0.5} value={person.heuresHebdo} onChange={(e) => maj({ heuresHebdo: Number(e.target.value) })} style={{ width: 130 }} />
            </label>
          ) : null}
          {person.salarie ? (
            <label className="field">
              Taux horaire indicatif (€)
              <input type="number" min={0} step={0.1} value={person.tauxHoraire ?? ''} onChange={(e) => maj({ tauxHoraire: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 150 }} />
            </label>
          ) : null}
        </section>
        {person.salarie ? <p className="tiny muted" style={{ marginTop: -12 }}>Le taux horaire ne sert qu'à comparer le coût de deux scénarios. Il n'est jamais visible dans l'espace salarié.</p> : null}

        <section className="fiche-bloc">
          <TitreFiche icone={Award} note={`${person.competences.length} sélectionnée${person.competences.length > 1 ? 's' : ''}`}>
            Compétences et diplômes
          </TitreFiche>
          <p className="small soft">Touchez une compétence pour l’ajouter ou la retirer.</p>
          <div className="comp-familles">
            {COMPETENCE_FAMILLES.map((fam, i) => {
              const Icone = FAMILLE_ICONE[i] ?? Award;
              const acquis = fam.cles.filter((c) => person.competences.includes(c)).length;
              return (
                <div key={fam.titre} className="comp-famille" role="group" aria-label={fam.titre}>
                  <div className="comp-tete">
                    <span className="comp-pic" aria-hidden="true">
                      <Icone size={16} />
                    </span>
                    <b>{fam.titre}</b>
                    <span className="comp-nb num">
                      {acquis}/{fam.cles.length}
                    </span>
                  </div>
                  <div className="comp-liste">
                    {fam.cles.map((c: CompetenceId) => {
                      const on = person.competences.includes(c);
                      const Pic = COMPETENCE_ICONE[c];
                      return (
                        <button key={c} type="button" className={`comp${on ? ' on' : ''}`} aria-pressed={on} onClick={() => maj({ competences: on ? person.competences.filter((x) => x !== c) : [...person.competences, c] })}>
                          <Pic size={16} aria-hidden="true" />
                          <span>{COMPETENCE_LABEL[c]}</span>
                          {on ? <Check size={14} strokeWidth={3} className="comp-coche" aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="tiny muted">Un rendez-vous n’est planifiable que si une personne formée est en poste et la salle libre.</p>
        </section>

        {!person.externe ? (
          <section className="fiche-bloc">
            <TitreFiche icone={ShieldCheck}>Droits d’accès</TitreFiche>
            {estResponsable(data, person) ? (
              <div className="notice ok">
                <Crown size={17} aria-hidden="true" />
                <span>
                  <b>Titulaire principal.</b> A créé la pharmacie et décide en dernier ressort : il donne son accord aux décisions des autres titulaires, et lui seul ouvre la gestion à un adjoint.
                </span>
              </div>
            ) : person.qualification === 'titulaire' ? (
              <div className="notice info">
                <Medal size={17} aria-hidden="true" />
                <span>
                  <b>Titulaire secondaire.</b> Mêmes écrans que le titulaire principal. Chacune de ses décisions (publier, régler une absence, valider un remplacement, confier une garde…) attend l’accord de {chef ? chef.prenom : 'la titulaire principale'} avant d’être appliquée.
                </span>
              </div>
            ) : (
              <>
                <label className="check" htmlFor={`gestion-${person.id}`}>
                  <input id={`gestion-${person.id}`} type="checkbox" checked={!!person.gestion} disabled={!jeSuisResponsable} onChange={(e) => {
                    maj({ gestion: e.target.checked });
                    dire(e.target.checked ? `${person.prenom} peut désormais gérer l’officine.` : `${person.prenom} n’a plus accès à la gestion.`, true);
                  }} />
                  <span>
                    Peut modifier les plannings, l’équipe, les gardes et les réglages
                    <span className="soft small" style={{ display: 'block' }}>
                      {person.gestion ? 'Cette personne se connecte à l’espace responsable.' : `Sans cet accès, ${person.prenom} n’a que son espace ${estPharmacien(person) ? 'pharmacien' : 'équipe'} : son planning, le planning publié${estPharmacien(person) ? ', ses gardes' : ''} et ses demandes.`}
                    </span>
                  </span>
                </label>
                {!jeSuisResponsable ? <p className="small soft">Seul {chef ? nomComplet(chef) : 'le titulaire principal'} peut accorder ou retirer cet accès.</p> : null}
              </>
            )}
          </section>
        ) : null}

        {!person.externe ? (
          <section className="fiche-bloc">
            <TitreFiche icone={ChartLine}>Suivi sur 12 mois</TitreFiche>
            {jeSuisTitulaire && forts.length ? (
              <div className="pf-fiche" data-focus="points-forts-fiche">
                <div className="eyebrow">Points forts</div>
                <PointsForts points={forts} />
              </div>
            ) : null}
            <Compteurs suivi={suiviDe(data, person.id, today)} />
            <p className="tiny muted">Retards et départs se notent depuis la vue d’une journée (dans « Construire », cliquez sur un jour). Des dates et des durées, jamais une raison.</p>
          </section>
        ) : null}

        {!person.externe ? (
          <section className="fiche-bloc">
            <TitreFiche icone={KeyRound}>Compte de connexion</TitreFiche>
            <div className="notice" style={{ alignItems: 'center' }}>
              <KeyRound size={17} aria-hidden="true" />
              <div className="grow">
                <div>
                  Identifiant : <b>{person.identifiant ?? '—'}</b>
                </div>
                <div className="small soft">
                  {person.provisoire ? (
                    <>
                      Mot de passe provisoire : <b className="num" style={{ letterSpacing: '0.08em' }}>{person.provisoire}</b>. À transmettre à {person.prenom}, qui le remplacera dans « Mon compte ».
                    </>
                  ) : person.code ? (
                    `${person.prenom} a choisi son mot de passe. Personne d’autre ne peut le lire.`
                  ) : (
                    'Aucun mot de passe défini.'
                  )}
                </div>
              </div>
              {jeSuisResponsable && !estResponsable(data, person) ? (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    const mdp = provisoire();
                    maj({ identifiant: person.identifiant ?? identifiantPropose(person.prenom, person.nom, identifiantsPris(data, autres)), code: empreinte(mdp), provisoire: mdp });
                    dire(`Nouveau mot de passe provisoire pour ${person.prenom}.`, true);
                  }}
                >
                  <RefreshCw size={14} aria-hidden="true" /> Nouveau mot de passe provisoire
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {!person.externe ? (
          <section className="fiche-bloc">
            <TitreFiche icone={HandHelping}>Volontariat</TitreFiche>
            {person.salarie && person.heuresHebdo < 35 ? (
              <label className="check">
                <input type="checkbox" checked={person.volontaireHeuresComp} onChange={(e) => maj({ volontaireHeuresComp: e.target.checked })} />
                Volontaire pour des heures complémentaires en cas d'absence d'un collègue
              </label>
            ) : null}
            {estPharmacien(person) ? (
              <label className="check">
                <input type="checkbox" checked={person.volontaireGardes} onChange={(e) => maj({ volontaireGardes: e.target.checked })} />
                <span>
                  Volontaire pour les gardes
                  <span className="soft small" style={{ display: 'block' }}>Le volontariat ne supprime aucun contrôle de repos.</span>
                </span>
              </label>
            ) : null}
            {!(person.salarie && person.heuresHebdo < 35) && !estPharmacien(person) ? <p className="soft small">Aucun volontariat applicable à ce contrat.</p> : null}
          </section>
        ) : null}

        {!person.externe ? (
          <section className="fiche-bloc">
            <TitreFiche icone={HeartHandshake} droite={<Pill title="Plafond identique pour toute l'équipe">Prioritaires : {usage.actifs} / {usage.plafond}</Pill>}>
              Besoins personnels
            </TitreFiche>
            {besoins.length ? (
              besoins.map((b) => (
                <div key={b.id} className="row wrap" style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 11 }}>
                  {b.statut === 'reconnue' ? <Lock size={15} /> : <HeartHandshake size={15} />}
                  <div className="grow">
                    <b>{decrireBesoin(b)}</b>
                    <div className="small soft">
                      {b.from ? `Depuis le ${fmtDateCourt(b.from)}` : 'Sans date de début'}
                      {b.to ? ` · jusqu'au ${fmtDateCourt(b.to)}` : ''}
                      {b.horsPlafond ? ' · droit ou aménagement validé, hors plafond' : ''}
                    </div>
                  </div>
                  {b.decision === 'en_attente' ? <Pill tone="warn">À arbitrer</Pill> : <Pill tone={STATUT_BESOIN[b.statut].tone}>{STATUT_BESOIN[b.statut].label}</Pill>}
                  <button
                    type="button"
                    className="btn ghost icon"
                    aria-label="Retirer ce besoin"
                    onClick={() => {
                      supprimerBesoin(b.id);
                      dire('Besoin retiré.', true);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p className="soft small">Aucun besoin enregistré.</p>
            )}
            <p className="tiny muted">
              Indisponibilité reconnue : contrainte impérative. Préférence prioritaire : servie avant les autres, plafonnée. Simple préférence : satisfaite si possible. Aucun motif n'est stocké.
            </p>
          </section>
        ) : null}

        {!person.externe ? (
          <section className="fiche-bloc">
            <TitreFiche icone={CalendarOff}>Absences à venir</TitreFiche>
            {absences.length ? (
              absences.map((a) => (
                <div key={a.id} className="row wrap" style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 11 }}>
                  <CalendarOff size={15} />
                  <div className="grow">
                    <b>{libelleAbsence(a)}</b> · du {fmtDateCourt(a.from)} au {fmtDateCourt(a.to)}
                  </div>
                  {a.statut === 'demandee' ? (
                    <>
                      <Pill tone="warn">Demandée</Pill>
                      <button type="button" className="btn sm" onClick={() => deciderAbsence(a.id, true)}>
                        Approuver
                      </button>
                    </>
                  ) : (
                    <Pill tone="ok">Approuvée</Pill>
                  )}
                </div>
              ))
            ) : (
              <p className="soft small">Aucune absence à venir.</p>
            )}
          </section>
        ) : null}
      </div>
      <div className="card-body row wrap" style={{ borderTop: '1px solid var(--line)' }}>
        <span className="small soft grow">Retirer une personne supprime aussi ses postes, ses besoins et ses absences.</span>
        {retrait ? (
          <>
            <button type="button" className="btn sm" onClick={() => setRetrait(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn sm danger"
              onClick={() => {
                supprimerPersonne(person.id);
                ouvrirPersonne(null);
                dire(`${nomComplet(person)} retiré de l’équipe.`, true);
              }}
            >
              <Trash2 size={14} /> Oui, retirer {person.prenom}
            </button>
          </>
        ) : (
          <button type="button" className="btn sm ghost danger" onClick={() => setRetrait(true)} disabled={estResponsable(data, person) || memeIdentifiant(person.identifiant, session ?? '')} title={estResponsable(data, person) ? 'Le titulaire principal ne peut pas être retiré' : undefined}>
            <Trash2 size={14} /> Retirer de l’équipe
          </button>
        )}
      </div>
      {demande ? <DialogueDemande personId={person.id} espace="responsable" onClose={() => setDemande(false)} /> : null}
    </div>
  );
}

function DialoguePersonne({ onClose }: { onClose: () => void }): JSX.Element {
  const { majPersonne, data, autres } = useStore();
  const { dire, ouvrirPersonne } = useUi();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [qualification, setQualification] = useState<Qualification>('preparateur');
  const [heures, setHeures] = useState('35');
  const [externe, setExterne] = useState(false);
  const [taux, setTaux] = useState('');
  const pret = prenom.trim() !== '' && nom.trim() !== '';
  return (
    <Dialog
      title="Ajouter une personne"
      subtitle="L’essentiel suffit pour commencer : compétences, besoins et absences se complètent ensuite dans sa fiche."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!pret}
            onClick={() => {
              const id = uid('p');
              const mdp = provisoire();
              majPersonne({
                id,
                prenom: prenom.trim(),
                nom: nom.trim(),
                qualification,
                salarie: qualification !== 'titulaire',
                heuresHebdo: externe ? 0 : Math.max(1, Number(heures) || 35),
                tauxHoraire: taux === '' ? null : Number(taux),
                competences: [],
                volontaireHeuresComp: false,
                volontaireGardes: qualification === 'titulaire',
                ...(externe ? { externe: true } : { identifiant: identifiantPropose(prenom, nom, identifiantsPris(data, autres)), code: empreinte(mdp), provisoire: mdp }),
              });
              ouvrirPersonne(id);
              dire(externe ? `${prenom.trim()} ${nom.trim()} ajouté à l’équipe.` : `${prenom.trim()} ${nom.trim()} ajouté. Son identifiant et son mot de passe provisoire sont dans sa fiche.`, true);
              onClose();
            }}
          >
            <Plus size={15} /> Ajouter
          </button>
        </>
      }
    >
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <label className="field grow" style={{ minWidth: 150 }}>
          Prénom
          <input id="personne-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} data-autofocus autoComplete="off" />
        </label>
        <label className="field grow" style={{ minWidth: 150 }}>
          Nom
          <input id="personne-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" />
        </label>
      </div>
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <label className="field grow" style={{ minWidth: 200 }}>
          Fonction
          <select id="personne-fonction" value={qualification} onChange={(e) => setQualification(e.target.value as Qualification)}>
            {(Object.keys(QUALIFICATION_LABEL) as Qualification[]).map((q) => (
              <option key={q} value={q}>
                {QUALIFICATION_LABEL[q]}
              </option>
            ))}
          </select>
        </label>
        {!externe ? (
          <label className="field" style={{ width: 130 }}>
            Heures / semaine
            <input id="personne-heures" type="number" min={1} max={70} step={0.5} value={heures} onChange={(e) => setHeures(e.target.value)} className="num" />
          </label>
        ) : null}
        {qualification !== 'titulaire' ? (
          <label className="field" style={{ width: 170 }}>
            Taux horaire indicatif (€)
            <input id="personne-taux" type="number" min={0} step={0.1} value={taux} onChange={(e) => setTaux(e.target.value)} placeholder="facultatif" className="num" />
          </label>
        ) : null}
      </div>
      {qualification !== 'titulaire' ? (
        <label className="check">
          <input type="checkbox" checked={externe} onChange={(e) => setExterne(e.target.checked)} />
          <span>
            Remplaçant habituel, extérieur à l’équipe
            <span className="soft small" style={{ display: 'block' }}>Proposé quand une absence découvre une plage. Son taux sert à chiffrer le remplacement.</span>
          </span>
        </label>
      ) : (
        <div className="notice info small">Le titulaire est hors décompte salarié : ses heures sont un objectif, pas un contrat.</div>
      )}
    </Dialog>
  );
}
