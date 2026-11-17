import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  CalendarOff,
  ClipboardCheck,
  ClipboardList,
  Crown,
  DoorClosed,
  DoorOpen,
  FlaskConical,
  GraduationCap,
  Handshake,
  HeartPulse,
  Medal,
  Megaphone,
  MessagesSquare,
  PackageOpen,
  PhoneCall,
  Pill,
  Presentation,
  Sprout,
  Store,
  Syringe,
  TestTubeDiagonal,
  TreePalm,
  UserRoundPlus,
} from 'lucide-react';
import type { AbsenceType, Activite, GardeType, MissionType, Person, Qualification } from '../domain/types';
import { estResponsable, libelleRole } from '../domain/acces';
import { useStore } from '../store/store';

/** Une icône et une couleur par rôle : on reconnaît la fonction sans lire. */
export const ROLE_ICONE: Record<Qualification, LucideIcon> = {
  titulaire: Crown,
  adjoint: Pill,
  preparateur: FlaskConical,
  etudiant: GraduationCap,
  apprenti: Sprout,
  rayonniste: Boxes,
  animateur: Megaphone,
};
/** Une couleur par poste, la même dans tous les thèmes : on repère qui est qui sans lire. */
export const ROLE_COULEUR: Record<Qualification, string> = {
  titulaire: 'c-fort',
  adjoint: 'r-adjoint',
  preparateur: 'r-prepa',
  etudiant: 'r-etudiant',
  apprenti: 'r-apprenti',
  rayonniste: 'r-rayon',
  animateur: 'r-anim',
};

/** Une icône par tâche : c'est elle qui figure sur chaque tuile du planning. */
export const ACTIVITE_ICONE: Record<Activite, LucideIcon> = {
  comptoir: Store,
  back: PackageOpen,
  admin: ClipboardList,
  formation: Presentation,
  inventaire: ClipboardCheck,
};
export const ACTIVITE_COULEUR: Record<Activite, string> = {
  comptoir: 'c-moyen',
  back: 'c-clair',
  admin: 'c-clair',
  formation: 'c-gris',
  inventaire: 'c-clair',
};
export const ACTIVITE_COURT: Record<Activite, string> = {
  comptoir: 'Comptoir',
  back: 'Réception',
  admin: 'Administratif',
  formation: 'Formation',
  inventaire: 'Inventaire',
};

export const MISSION_ICONE: Record<MissionType, LucideIcon> = {
  vaccination: Syringe,
  trod: TestTubeDiagonal,
  entretien: MessagesSquare,
  rdv_labo: Handshake,
};
export const GARDE_ICONE: Record<GardeType, LucideIcon> = {
  volets_ouverts: DoorOpen,
  volets_fermes: DoorClosed,
  astreinte: PhoneCall,
};
export const ABSENCE_ICONE: Record<AbsenceType, LucideIcon> = {
  conge: TreePalm,
  maladie: HeartPulse,
  formation: Presentation,
  autre: CalendarOff,
};

export const couleurDe = (p: Pick<Person, 'qualification' | 'externe'> | undefined): string => (!p ? 'c-gris' : p.externe ? 'c-gris' : ROLE_COULEUR[p.qualification]);
export const iconeDe = (p: Pick<Person, 'qualification' | 'externe'> | undefined): LucideIcon => (!p ? UserRoundPlus : p.externe ? UserRoundPlus : ROLE_ICONE[p.qualification]);

/** Pastille de rôle : icône seule (décorative) ; le libellé du rôle est toujours écrit à côté. */
export function PastilleRole({ person, lg }: { person: Pick<Person, 'qualification' | 'externe'> | undefined; lg?: boolean }): JSX.Element {
  const Icone = iconeDe(person);
  return (
    <span className={`chip-i ${couleurDe(person)}${lg ? ' lg' : ''}`} aria-hidden="true">
      <Icone size={lg ? 22 : 15} />
    </span>
  );
}

/** Étiquette de rôle : icône et libellé. Le titulaire principal porte la couronne, le titulaire secondaire la médaille. */
export function EtiquetteRole({ person }: { person: Person }): JSX.Element {
  const data = useStore((s) => s.data);
  const secondaire = person.qualification === 'titulaire' && !person.externe && !estResponsable(data, person);
  const Icone = secondaire ? Medal : iconeDe(person);
  return (
    <span className={`role-tag ${secondaire ? 'c-moyen' : couleurDe(person)}`}>
      <span className="chip-i" aria-hidden="true">
        <Icone size={12} />
      </span>
      {libelleRole(data, person)}
    </span>
  );
}
