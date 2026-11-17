import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  CalendarOff,
  ClipboardList,
  Crown,
  DoorClosed,
  DoorOpen,
  FlaskConical,
  GraduationCap,
  Handshake,
  HeartPulse,
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
import { QUALIFICATION_COURT } from '../domain/types';

/** Une icône et une couleur par rôle : on reconnaît la fonction sans lire. */
export const ROLE_ICONE: Record<Qualification, LucideIcon> = {
  titulaire: Crown,
  adjoint: Pill,
  preparateur: FlaskConical,
  etudiant: GraduationCap,
  apprenti: Sprout,
  rayonniste: Boxes,
};
export const ROLE_COULEUR: Record<Qualification, string> = {
  titulaire: 'c-or',
  adjoint: 'c-menthe',
  preparateur: 'c-ciel',
  etudiant: 'c-lavande',
  apprenti: 'c-corail',
  rayonniste: 'c-rose',
};

/** Une icône par tâche : c'est elle qui figure sur chaque tuile du planning. */
export const ACTIVITE_ICONE: Record<Activite, LucideIcon> = {
  comptoir: Store,
  back: PackageOpen,
  admin: ClipboardList,
  formation: Presentation,
};
export const ACTIVITE_COULEUR: Record<Activite, string> = {
  comptoir: 'c-menthe',
  back: 'c-ciel',
  admin: 'c-lavande',
  formation: 'c-corail',
};
export const ACTIVITE_COURT: Record<Activite, string> = {
  comptoir: 'Comptoir',
  back: 'Réception',
  admin: 'Administratif',
  formation: 'Formation',
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

/** Étiquette de rôle : icône et libellé. */
export function EtiquetteRole({ person }: { person: Pick<Person, 'qualification' | 'externe'> }): JSX.Element {
  const Icone = iconeDe(person);
  return (
    <span className={`role-tag ${couleurDe(person)}`}>
      <span className="chip-i" aria-hidden="true">
        <Icone size={12} />
      </span>
      {person.externe ? 'Remplaçant' : QUALIFICATION_COURT[person.qualification]}
    </span>
  );
}
