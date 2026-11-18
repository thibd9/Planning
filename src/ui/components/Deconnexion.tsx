import type { LucideIcon } from 'lucide-react';
import { ArrowLeftRight, CalendarCheck, CircleCheck, Handshake, ListChecks, LogOut, MessageSquare, PencilRuler } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import type { Espace } from '../../domain/acces';
import { addDays, mondayOf } from '../../domain/time';
import type { AppData, ISODate, Person } from '../../domain/types';
import { decisions } from '../../engine/decisions';
import type { Vue } from '../../store/ui';
import { Dialog } from '../kit';

interface Sujet {
  cle: string;
  icone: LucideIcon;
  texte: string;
  detail: string;
  vue: Vue;
  sujet?: string;
}

/** Ce qui reste en cours pour cette personne : rien n'est perdu en se déconnectant, mais elle doit le savoir. */
export function sujetsEnCours(data: AppData, today: ISODate, moi: Person, espace: Espace): Sujet[] {
  const out: Sujet[] = [];
  const s = (n: number): string => (n > 1 ? 's' : '');
  if (espace === 'responsable') {
    const d = decisions(data, today);
    if (d.accords.length) out.push({ cle: 'accords', icone: Handshake, texte: `${d.accords.length} accord${s(d.accords.length)} à donner`, detail: 'Un autre titulaire attend votre réponse.', vue: 'resoudre', sujet: 'accords' });
    if (d.trous.length) out.push({ cle: 'trous', icone: ListChecks, texte: `${d.trous.length} poste${s(d.trous.length)} à couvrir`, detail: 'Une absence a découvert le planning.', vue: 'resoudre', sujet: 'absences' });
    if (d.remplacements.length) out.push({ cle: 'rempl', icone: ArrowLeftRight, texte: `${d.remplacements.length} demande${s(d.remplacements.length)} de remplacement`, detail: 'L’équipe attend votre réponse.', vue: 'resoudre', sujet: 'remplacements' });
    const demandes = d.absences.length + d.besoins.length;
    if (demandes) out.push({ cle: 'demandes', icone: ListChecks, texte: `${demandes} demande${s(demandes)} de l’équipe`, detail: 'Congés et horaires à accepter ou refuser.', vue: 'resoudre', sujet: 'demandes' });
    // Un brouillon existe mais n'est pas publié : l'équipe ne le voit pas encore.
    const lundi = mondayOf(today);
    const brouillons = [0, 1, 2, 3, 4, 5].map((w) => addDays(lundi, 7 * w)).filter((m) => data.semaines[m]?.statut !== 'publie' && data.shifts.some((x) => x.date >= m && x.date <= addDays(m, 6)));
    if (brouillons.length) out.push({ cle: 'brouillons', icone: PencilRuler, texte: `${brouillons.length} planning${s(brouillons.length)} en brouillon`, detail: 'Enregistré, mais pas encore publié : l’équipe ne le voit pas.', vue: 'construire' });
    if (d.publications.length && !brouillons.length) out.push({ cle: 'publier', icone: CalendarCheck, texte: `${d.publications.length} planning${s(d.publications.length)} à publier`, detail: 'Le délai de prévenance approche.', vue: 'resoudre', sujet: 'publications' });
  } else {
    const appels = data.remplacements.filter((r) => r.statut === 'ouverte' && r.date >= today && (r.sollicites ?? []).includes(moi.id) && !r.volontaires.includes(moi.id) && !(r.indisponibles ?? []).includes(moi.id));
    if (appels.length) out.push({ cle: 'appels', icone: ArrowLeftRight, texte: `${appels.length} demande${s(appels.length)} de remplacement sans réponse`, detail: 'Un collègue ou votre titulaire attend votre oui ou votre non.', vue: 'moi' });
  }
  const nonLus = data.messages.filter((m) => (m.a === moi.id || m.a === 'equipe') && m.de !== moi.id && !m.luPar.includes(moi.id)).length;
  if (nonLus) out.push({ cle: 'messages', icone: MessageSquare, texte: `${nonLus} message${s(nonLus)} non lu${s(nonLus)}`, detail: 'Ils vous attendront à votre retour.', vue: 'messages' });
  return out;
}

/** Avant de se déconnecter : ce qui reste en cours, avec un accès direct. Rien n'est perdu, tout est enregistré. */
export function DialogueDeconnexion({ data, today, moi, espace, onRester, onPartir, onVoir }: { data: AppData; today: ISODate; moi: Person; espace: Espace; onRester: () => void; onPartir: () => void; onVoir: (vue: Vue, sujet?: string) => void }): JSX.Element | null {
  const sujets = useMemo(() => sujetsEnCours(data, today, moi, espace), [data, today, moi, espace]);
  // Rien en cours : on ne retient personne.
  useEffect(() => {
    if (!sujets.length) onPartir();
  }, [sujets.length, onPartir]);
  if (!sujets.length) return null;
  return (
    <Dialog
      title="Avant de vous déconnecter"
      subtitle={`${sujets.length} sujet${sujets.length > 1 ? 's' : ''} en cours. Prenez le temps de les traiter, ou retrouvez-les à votre retour.`}
      onClose={onRester}
      footer={
        <>
          <button type="button" className="btn" onClick={onPartir}>
            <LogOut size={15} aria-hidden="true" /> Me déconnecter quand même
          </button>
          <button type="button" className="btn primary" onClick={onRester} data-autofocus>
            Rester et finir
          </button>
        </>
      }
    >
      <div className="notice ok">
        <CircleCheck size={17} aria-hidden="true" />
        <span>
          <b>Rien ne sera perdu.</b> Tout ce que vous avez fait est déjà enregistré sur cet appareil, brouillons compris.
        </span>
      </div>
      <ul className="dx-liste">
        {sujets.map((x) => (
          <li key={x.cle}>
            <span className="dx-pic" aria-hidden="true">
              <x.icone size={18} />
            </span>
            <span className="grow">
              <b>{x.texte}</b>
              <span className="small soft">{x.detail}</span>
            </span>
            <button type="button" className="btn sm" onClick={() => onVoir(x.vue, x.sujet)}>
              Traiter
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
