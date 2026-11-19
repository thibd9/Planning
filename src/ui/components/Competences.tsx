import type { LucideIcon } from 'lucide-react';
import { Award, Check, ClipboardList, Lightbulb, Lock, Stethoscope } from 'lucide-react';
import type { CompetenceId, Person } from '../../domain/types';
import { COMPETENCE_FAMILLES, COMPETENCE_LABEL, peutDetenir } from '../../domain/types';
import { COMPETENCE_ICONE } from '../icons';

/** Une icône par famille de compétences, dans l'ordre de COMPETENCE_FAMILLES. */
const FAMILLE_ICONE: LucideIcon[] = [Stethoscope, Lightbulb, ClipboardList];

/**
 * Les compétences et diplômes d'une personne, par famille : on touche une compétence pour l'ajouter ou la retirer.
 * Les actes réservés aux pharmaciens ne sont pas proposés aux autres métiers : ils sont montrés, verrouillés, avec la raison.
 * Le même composant sert au titulaire, dans la fiche, et à chacun, dans son compte.
 */
export function ChoixCompetences({ person, onChange }: { person: Pick<Person, 'competences' | 'qualification'>; onChange: (competences: CompetenceId[]) => void }): JSX.Element {
  const reservees = COMPETENCE_FAMILLES.flatMap((f) => f.cles).some((c) => !peutDetenir(person, c));
  return (
    <>
      <p className="small soft" style={{ margin: 0 }}>Touchez une compétence pour l’ajouter ou la retirer.</p>
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
                  const permis = peutDetenir(person, c);
                  const Pic = COMPETENCE_ICONE[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`comp${on ? ' on' : ''}${permis ? '' : ' reservee'}`}
                      aria-pressed={on}
                      disabled={!permis}
                      data-competence={c}
                      title={permis ? undefined : 'Réservé aux pharmaciens'}
                      onClick={() => onChange(on ? person.competences.filter((x) => x !== c) : [...person.competences, c])}
                    >
                      <Pic size={16} aria-hidden="true" />
                      <span>{COMPETENCE_LABEL[c]}</span>
                      {!permis ? <Lock size={13} className="comp-verrou" aria-hidden="true" /> : on ? <Check size={14} strokeWidth={3} className="comp-coche" aria-hidden="true" /> : null}
                      {!permis ? <span className="sr"> (réservé aux pharmaciens)</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {reservees ? (
        <p className="tiny muted comp-regle" style={{ margin: 0 }}>
          Les entretiens pharmaceutiques et les tests suivis d’une délivrance sont réservés aux pharmaciens. Un préparateur conseille et délivre au comptoir, sous le contrôle effectif d’un pharmacien présent.
        </p>
      ) : null}
    </>
  );
}
