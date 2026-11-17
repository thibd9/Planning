import { ArrowLeft, ArrowRight, FlaskConical, Play, RotateCcw, X } from 'lucide-react';
import { useEffect } from 'react';
import { addDays, mondayOf } from '../domain/time';
import type { AppData, Remplacement } from '../domain/types';
import { evaluerRemplacement, peutRemplacer } from '../engine/remplacement';
import { useStore } from '../store/store';
import type { Vue } from '../store/ui';
import { useUi } from '../store/ui';

/** Les quatre regards de l'environnement de test, avec des personnes déjà créées. */
export const ROLES_TEST: { cle: string; id: string; identifiant: string; court: string; titre: string; nom: string; detail: string }[] = [
  { cle: 't1', id: 'p_helene', identifiant: 'helene.marchetti', court: 'Titulaire 1', titre: 'Titulaire principale', nom: 'Hélène Marchetti', detail: 'Tous les droits : tableau de bord, plannings, équipe, gardes, réglages.' },
  { cle: 't2', id: 'p_antoine', identifiant: 'antoine.mercier', court: 'Titulaire 2', titre: 'Titulaire secondaire', nom: 'Antoine Mercier', detail: 'Son planning et ses gardes. La gestion seulement si la titulaire principale l’accorde.' },
  { cle: 'ph', id: 'p_karim', identifiant: 'karim.benali', court: 'Pharmacien', titre: 'Pharmacien adjoint', nom: 'Karim Benali', detail: 'Son planning, le planning publié, ses gardes, ses messages.' },
  { cle: 'pr', id: 'p_camille', identifiant: 'camille.roussel', court: 'Préparateur', titre: 'Préparatrice', nom: 'Camille Roussel', detail: 'Ses horaires, ses demandes, les remplacements, ses messages.' },
];

/** Ouvre l'environnement de test dans la peau d'une personne ; l'écran d'arrivée dépend de ses droits. */
export function voirComme(identifiant: string, vue?: Vue): void {
  const { data } = useStore.getState();
  const p = data.personnes.find((x) => x.identifiant === identifiant);
  const gere = !!p && (data.officine.responsableId === p.id || !!p.gestion);
  useUi.getState().setTour(null);
  useUi.getState().connecter(identifiant, vue ?? (gere ? 'tableau' : 'moi'));
}

const store = (): ReturnType<typeof useStore.getState> => useStore.getState();
const demandeDeCamille = (d: AppData): Remplacement | undefined => d.remplacements.find((r) => r.demandeur === 'p_camille' && r.statut === 'ouverte');
const prenom = (d: AppData, id: string | undefined): string => d.personnes.find((p) => p.id === id)?.prenom ?? 'un collègue';

/** Collègue libre qui peut reprendre le poste sans enfreindre une règle ; à qualification égale d'abord. */
function volontairePour(d: AppData, r: Remplacement): string | undefined {
  const demandeur = d.personnes.find((p) => p.id === r.demandeur);
  const possibles = d.personnes.filter((p) => peutRemplacer(d, r, p) && evaluerRemplacement(d, r, p.id).ok);
  return (possibles.find((p) => p.qualification === demandeur?.qualification) ?? possibles[0])?.id;
}

/** Premier poste publié à venir de Camille qu'un autre préparateur, de préférence, peut reprendre. */
function posteARemplacer(d: AppData, today: string): string | null {
  const postes = d.shifts.filter((s) => s.personId === 'p_camille' && s.date > today && d.semaines[mondayOf(s.date)]?.statut === 'publie').sort((a, b) => a.date.localeCompare(b.date));
  const essai = (s: (typeof postes)[number]): Remplacement => ({ id: 'essai', shiftId: s.id, demandeur: 'p_camille', date: s.date, start: s.start, end: s.end, creeLe: '', volontaires: [], statut: 'ouverte' });
  const prepa = postes.find((s) => d.personnes.find((p) => p.id === volontairePour(d, essai(s)))?.qualification === 'preparateur');
  return (prepa ?? postes.find((s) => volontairePour(d, essai(s))))?.id ?? null;
}

interface Etape {
  qui: string;
  titre: string;
  texte: (d: AppData) => string;
  jouer: () => void;
}

const ETAPES: Etape[] = [
  {
    qui: 'Hélène · titulaire principale',
    titre: 'La journée commence sur le tableau de bord',
    texte: () => 'Hélène voit d’un coup d’œil les décisions en attente, la couverture pharmacien de la semaine et l’équipe du jour. Elle seule a tous les droits.',
    jouer: () => voirComme('helene.marchetti', 'tableau'),
  },
  {
    qui: 'Camille · préparatrice',
    titre: 'Une préparatrice consulte ses horaires',
    texte: (d) => {
      const r = demandeDeCamille(d);
      return r ? 'Aujourd’hui, demain, la suite : tout est en haut de « Mon planning ». Camille vient de demander à être remplacée sur un de ses postes, sans donner de raison (carte « Me faire remplacer »).' : 'Aujourd’hui, demain, la suite : tout est en haut de « Mon planning », avec la carte « Me faire remplacer ».';
    },
    jouer: () => {
      const s = store();
      if (!demandeDeCamille(s.data)) {
        const cible = posteARemplacer(s.data, s.today);
        const poste = s.data.shifts.find((x) => x.id === cible);
        if (poste) s.demanderRemplacement(poste);
      }
      voirComme('camille.roussel', 'moi');
    },
  },
  {
    qui: 'Un collègue',
    titre: 'Un collègue libre se propose',
    texte: (d) => {
      const r = demandeDeCamille(d);
      return r?.volontaires.length ? `${prenom(d, r.volontaires[0])} voit la demande de Camille en haut de son planning et vient de cliquer sur « Je me propose ». Rien n’est encore décidé : la titulaire doit valider.` : 'Les collègues qui ont la bonne qualification voient la demande en haut de leur planning et peuvent se proposer.';
    },
    jouer: () => {
      const s = store();
      const r = demandeDeCamille(s.data);
      if (!r) return voirComme('camille.roussel', 'moi');
      const volontaire = r.volontaires[0] ?? volontairePour(s.data, r);
      if (!volontaire) return voirComme('camille.roussel', 'moi');
      if (!r.volontaires.includes(volontaire)) s.seProposer(r.id, volontaire, true);
      voirComme(s.data.personnes.find((p) => p.id === volontaire)?.identifiant ?? 'camille.roussel', 'moi');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'La titulaire valide le remplacement',
    texte: (d) => {
      const r = demandeDeCamille(d);
      return r?.volontaires.length ? `Dans « Résoudre », section « Demandes de remplacement » : le moteur a relu les règles pour ${prenom(d, r.volontaires[0])}. Cliquez sur « Valider avec ${prenom(d, r.volontaires[0])} » : les deux personnes sont prévenues.` : 'Dans « Résoudre », chaque décision annonce ses conséquences avant d’être prise : absences à couvrir, remplacements, demandes, gardes.';
    },
    jouer: () => voirComme('helene.marchetti', 'resoudre'),
  },
  {
    qui: 'Karim · pharmacien adjoint',
    titre: 'Un pharmacien suit ses gardes',
    texte: () => 'Karim n’a pas accès à la gestion. Il voit son planning, le planning publié de l’équipe et « Mes gardes » : dates, repos qui suit, récupérations.',
    jouer: () => voirComme('karim.benali', 'mesgardes'),
  },
  {
    qui: 'Antoine · titulaire secondaire',
    titre: 'Un titulaire secondaire, sans accès à la gestion',
    texte: () => 'Antoine est titulaire, mais pas titulaire principal. Tant qu’Hélène ne lui a rien accordé, son menu se limite à son planning, au planning de l’équipe, à ses gardes et aux messages.',
    jouer: () => {
      const s = store();
      const antoine = s.data.personnes.find((p) => p.id === 'p_antoine');
      if (antoine?.gestion) s.majPersonne({ ...antoine, gestion: false });
      voirComme('antoine.mercier', 'moi');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'La titulaire principale lui donne l’accès',
    texte: () => 'Dans la fiche d’Antoine, rubrique « Droits d’accès », Hélène vient de cocher « Peut modifier les plannings, l’équipe, les gardes et les réglages ». Elle seule peut le faire, et le retirer.',
    jouer: () => {
      const s = store();
      const antoine = s.data.personnes.find((p) => p.id === 'p_antoine');
      if (antoine && !antoine.gestion) s.majPersonne({ ...antoine, gestion: true });
      voirComme('helene.marchetti', 'equipe');
      useUi.getState().ouvrirPersonne('p_antoine');
    },
  },
  {
    qui: 'Antoine · titulaire secondaire',
    titre: 'Antoine gère maintenant la pharmacie',
    texte: () => 'Même personne, même identifiant : son menu contient désormais le tableau de bord, « Résoudre », « Construire », les gardes et l’équipe.',
    jouer: () => voirComme('antoine.mercier', 'tableau'),
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Construire la semaine prochaine',
    texte: () => 'Cliquez sur « Proposer un planning » : trois propositions comparables (équité, souhaits, coût). Les couleurs situent chaque poste dans la journée ; survolez un jour signalé dans « Couverture » pour lire le problème.',
    jouer: () => {
      voirComme('helene.marchetti', 'construire');
      useUi.getState().setSemaine(addDays(mondayOf(store().today), 7));
    },
  },
];

/** Lance le parcours de test sur un environnement remis à neuf. */
export function lancerParcours(): void {
  store().chargerExemple(true);
  useUi.getState().setParcours(0);
  ETAPES[0].jouer();
}

/** Parcours de test : une histoire en neuf étapes qui change de personne à chaque étape. */
export function Parcours(): JSX.Element | null {
  const { parcours, setParcours } = useUi();
  const data = useStore((s) => s.data);
  const etape = parcours !== null ? ETAPES[parcours] : null;

  useEffect(() => {
    if (parcours !== null) ETAPES[parcours]?.jouer();
  }, [parcours]);

  if (!etape || parcours === null || !data.demo) return null;
  const dernier = parcours === ETAPES.length - 1;
  return (
    <aside className="parcours-test no-print" aria-label="Parcours de test">
      <div className="row" style={{ gap: 10 }}>
        <span className="pt-n num" aria-hidden="true">
          {parcours + 1}
        </span>
        <div className="grow">
          <div className="eyebrow">
            Parcours de test · étape {parcours + 1} sur {ETAPES.length}
          </div>
          <div className="small" style={{ fontWeight: 650 }}>{etape.qui}</div>
        </div>
        <button type="button" className="btn ghost icon sm" onClick={() => setParcours(null)} aria-label="Quitter le parcours de test">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div aria-live="polite">
        <h2 className="h3" style={{ marginBottom: 4 }}>{etape.titre}</h2>
        <p className="small">{etape.texte(data)}</p>
      </div>
      <div className="pt-barre" aria-hidden="true">
        <i style={{ width: `${((parcours + 1) / ETAPES.length) * 100}%` }} />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn sm" disabled={parcours === 0} onClick={() => setParcours(parcours - 1)}>
          <ArrowLeft size={15} aria-hidden="true" /> Précédent
        </button>
        <span className="grow" />
        {dernier ? (
          <button type="button" className="btn sm primary" onClick={() => setParcours(null)}>
            Terminer
          </button>
        ) : (
          <button type="button" className="btn sm primary" onClick={() => setParcours(parcours + 1)}>
            Étape suivante <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </aside>
  );
}

/** Bandeau de l'environnement de test : changer de regard en un clic, lancer ou relancer le parcours. */
export function BandeauTest({ moi }: { moi: string }): JSX.Element {
  const { parcours, setParcours } = useUi();
  return (
    <div className="bandeau-test no-print" role="region" aria-label="Environnement de test">
      <span className="bt-titre">
        <FlaskConical size={16} aria-hidden="true" /> Environnement de test
      </span>
      <div className="seg" role="group" aria-label="Voir l’application comme">
        {ROLES_TEST.map((r) => (
          <button key={r.cle} type="button" className={moi === r.id ? 'on' : ''} aria-pressed={moi === r.id} title={`${r.nom} · ${r.titre}`} onClick={() => voirComme(r.identifiant)}>
            {r.court}
          </button>
        ))}
      </div>
      <span className="grow" />
      {parcours === null ? (
        <button type="button" className="btn sm primary" onClick={() => setParcours(0)}>
          <Play size={14} aria-hidden="true" /> Lancer le parcours de test
        </button>
      ) : null}
      <button type="button" className="btn sm" onClick={lancerParcours} title="Remet les données d’exemple à neuf et reprend à l’étape 1">
        <RotateCcw size={14} aria-hidden="true" /> Réinitialiser
      </button>
    </div>
  );
}
