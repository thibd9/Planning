import { AlertTriangle, CalendarOff, CircleCheck, Crown, HeartHandshake, KeyRound, Lock, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { fmtDateCourt, uid } from '../../domain/time';
import type { Besoin, CompetenceId, Person, Qualification } from '../../domain/types';
import type { AppData } from '../../domain/types';
import { ABSENCE_LABEL, COMPETENCE_LABEL, QUALIFICATION_LABEL, estPharmacien, nomComplet } from '../../domain/types';
import { decrireBesoin } from '../../engine/core';
import { quotaAdjoints, validateEquipe } from '../../engine/validate';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { DialogueDemande } from '../components/Demande';
import { empreinte, estResponsable, identifiantPropose, libelleRole, memeIdentifiant, responsable } from '../../domain/acces';
import { EtiquetteRole } from '../icons';
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
  const quota = quotaAdjoints(data);
  const internes = data.personnes.filter((p) => !p.externe);
  const externes = data.personnes.filter((p) => p.externe);
  const courant = data.personnes.find((p) => p.id === personneId) ?? internes[0];

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
      <div className="split" style={{ gridTemplateColumns: '340px minmax(0, 1fr)', display: data.personnes.length ? undefined : 'none' }}>
        <div className="col" style={{ gap: 8 }}>
          <button type="button" className="btn primary" onClick={() => setAjout(true)} style={{ alignSelf: 'stretch' }}>
            <Plus size={15} /> Ajouter une personne
          </button>
          {internes.map((p) => (
            <LignePersonne key={p.id} p={p} on={courant?.id === p.id} onClick={() => ouvrirPersonne(p.id)} />
          ))}
          {externes.length ? <div className="eyebrow" style={{ margin: '12px 4px 2px' }}>Remplaçants habituels</div> : null}
          {externes.map((p) => (
            <LignePersonne key={p.id} p={p} on={courant?.id === p.id} onClick={() => ouvrirPersonne(p.id)} />
          ))}
        </div>
        {courant ? <Fiche key={courant.id} person={courant} /> : null}
      </div>
      {ajout ? <DialoguePersonne onClose={() => setAjout(false)} /> : null}
    </div>
  );
}

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

function Fiche({ person }: { person: Person }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { majPersonne, supprimerBesoin, deciderAbsence, supprimerPersonne, autres } = useStore();
  const ouvrirPersonne = useUi((s) => s.ouvrirPersonne);
  const [retrait, setRetrait] = useState(false);
  const session = useUi((s) => s.session);
  const chef = responsable(data);
  const jeSuisResponsable = !!chef && memeIdentifiant(chef.identifiant, session ?? '');
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
      <div className="card-body col" style={{ gap: 20 }}>
        <section className="row wrap" style={{ alignItems: 'flex-end' }}>
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

        <section className="col" style={{ gap: 8 }}>
          <h3>Compétences</h3>
          <div className="row wrap" style={{ gap: 6 }}>
            {(Object.keys(COMPETENCE_LABEL) as CompetenceId[]).map((c) => {
              const on = person.competences.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`btn sm${on ? ' primary' : ''}`}
                  aria-pressed={on}
                  onClick={() => maj({ competences: on ? person.competences.filter((x) => x !== c) : [...person.competences, c] })}
                >
                  {on ? <CircleCheck size={14} /> : null} {COMPETENCE_LABEL[c]}
                </button>
              );
            })}
          </div>
          <p className="tiny muted">Une activité à rendez-vous n'est planifiable que si une personne formée est en poste et que la salle est libre.</p>
        </section>

        {!person.externe ? (
          <section className="col" style={{ gap: 8 }}>
            <h3>Droits d’accès</h3>
            {estResponsable(data, person) ? (
              <div className="notice ok">
                <Crown size={17} aria-hidden="true" />
                <span>
                  <b>Titulaire principal.</b> A créé la pharmacie et détient tous les droits : plannings, équipe, gardes, règles et réglages. Lui seul peut donner l’accès à la gestion, à un titulaire secondaire comme à un adjoint.
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
          <section className="col" style={{ gap: 8 }}>
            <h3>Compte de connexion</h3>
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
          <section className="col" style={{ gap: 8 }}>
            <h3>Volontariat</h3>
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
          <section className="col" style={{ gap: 8 }}>
            <div className="row">
              <h3 className="grow">Besoins personnels</h3>
              <Pill title="Plafond identique pour toute l'équipe">
                Prioritaires : {usage.actifs} / {usage.plafond}
              </Pill>
            </div>
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
          <section className="col" style={{ gap: 8 }}>
            <h3>Absences à venir</h3>
            {absences.length ? (
              absences.map((a) => (
                <div key={a.id} className="row wrap" style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 11 }}>
                  <CalendarOff size={15} />
                  <div className="grow">
                    <b>{ABSENCE_LABEL[a.type]}</b> · du {fmtDateCourt(a.from)} au {fmtDateCourt(a.to)}
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
