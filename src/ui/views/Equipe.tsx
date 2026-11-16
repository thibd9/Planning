import { AlertTriangle, CalendarOff, CircleCheck, HeartHandshake, Lock, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { fmtDateCourt } from '../../domain/time';
import type { Besoin, CompetenceId, Person, Qualification } from '../../domain/types';
import { ABSENCE_LABEL, COMPETENCE_LABEL, QUALIFICATION_COURT, QUALIFICATION_LABEL, estPharmacien, nomComplet } from '../../domain/types';
import { decrireBesoin } from '../../engine/core';
import { quotaAdjoints, validateEquipe } from '../../engine/validate';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { DialogueDemande } from '../components/Demande';
import { Avatar, Pill } from '../kit';
import { usagePlafond } from './Resoudre';

export const STATUT_BESOIN: Record<Besoin['statut'], { label: string; tone: string }> = {
  reconnue: { label: 'Indisponibilité reconnue', tone: 'danger' },
  prioritaire: { label: 'Préférence prioritaire', tone: 'miel' },
  preference: { label: 'Simple préférence', tone: '' },
};

export function Equipe(): JSX.Element {
  const data = useStore((s) => s.data);
  const { personneId, ouvrirPersonne } = useUi();
  const alertes = useMemo(() => validateEquipe(data), [data]);
  const quota = quotaAdjoints(data);
  const internes = data.personnes.filter((p) => !p.externe);
  const externes = data.personnes.filter((p) => p.externe);
  const courant = data.personnes.find((p) => p.id === personneId) ?? internes[0];

  return (
    <div>
      <div className="page-head">
        <div className="grow">
          <div className="eyebrow">Équipe</div>
          <h1>Qui peut faire quoi, et quand</h1>
          <p>Contrats, compétences et besoins personnels. Un besoin décrit une contrainte d'horaire, jamais sa raison.</p>
        </div>
        {quota ? (
          <div className="card pad" style={{ padding: '10px 16px' }}>
            <div className="eyebrow">Pharmaciens adjoints</div>
            <div className="row" style={{ marginTop: 2 }}>
              <b className="num" style={{ fontSize: 20, fontFamily: 'var(--display)' }}>
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

      <div className="split" style={{ gridTemplateColumns: '340px minmax(0, 1fr)' }}>
        <div className="col" style={{ gap: 6 }}>
          {internes.map((p) => (
            <LignePersonne key={p.id} p={p} on={courant?.id === p.id} onClick={() => ouvrirPersonne(p.id)} />
          ))}
          <div className="eyebrow" style={{ margin: '12px 4px 2px' }}>Remplaçants habituels</div>
          {externes.map((p) => (
            <LignePersonne key={p.id} p={p} on={courant?.id === p.id} onClick={() => ouvrirPersonne(p.id)} />
          ))}
        </div>
        {courant ? <Fiche key={courant.id} person={courant} /> : null}
      </div>
    </div>
  );
}

function LignePersonne({ p, on, onClick }: { p: Person; on: boolean; onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="g-item" style={{ borderColor: on ? 'var(--sapin)' : undefined, boxShadow: on ? '0 0 0 3px rgba(18,55,43,0.1)' : undefined }} onClick={onClick} aria-pressed={on}>
      <Avatar person={p} lg />
      <span className="grow">
        <b>{nomComplet(p)}</b>
        <span className="small soft" style={{ display: 'block' }}>
          {QUALIFICATION_COURT[p.qualification]}
          {p.externe ? ` · ${p.tauxHoraire} € / h facturés` : ` · ${p.heuresHebdo} h${p.heuresHebdo < 35 && p.salarie ? ' (temps partiel)' : ''}`}
        </span>
      </span>
    </button>
  );
}

function Fiche({ person }: { person: Person }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { majPersonne, supprimerBesoin, deciderAbsence } = useStore();
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
            {QUALIFICATION_LABEL[person.qualification]}
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
      {demande ? <DialogueDemande personId={person.id} espace="responsable" onClose={() => setDemande(false)} /> : null}
    </div>
  );
}
