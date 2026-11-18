import { AlertTriangle, CircleCheck, Hourglass, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { fmtDateCourt, fmtDuree, fmtHeure, fmtHorodatage, fmtSemaine } from '../../domain/time';
import type { RegulType } from '../../domain/types';
import { REGUL_LABEL, nomCourt } from '../../domain/types';
import type { Solde } from '../../engine/heures';
import { proposerRegularisations, semaineLibre, soldes } from '../../engine/heures';
import type { SensRegul } from '../../engine/rattrapage';
import { Regulariser } from '../components/Regulariser';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { EtiquetteRole } from '../icons';
import { Avatar, BoutonAuto, Empty, Pill } from '../kit';

const signe = (min: number): string => `${min > 0 ? '+' : '−'}${fmtDuree(Math.abs(min))}`;

/** Compteur d'heures : ce que chacun a fait de plus ou de moins que son contrat, et comment on le régularise. */
export function Heures(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { regulariser, regulariserAuto, retirerRegularisation } = useStore();
  const dire = useUi((s) => s.dire);
  const [calcul, setCalcul] = useState(false);
  const [fenetre, setFenetre] = useState<{ personId: string; sens: SensRegul } | null>(null);
  const liste = useMemo(() => soldes(data, today), [data, today]);
  const propositions = useMemo(() => proposerRegularisations(data, today), [data, today]);
  const semaine = semaineLibre(data, today);
  const historique = [...(data.regularisations ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  const personne = (id: string) => data.personnes.find((p) => p.id === id);
  // L'objectif : le moins d'heures en plus possible. On compte ce qui dépasse d'au moins une heure.
  const enPlus = liste.filter((x) => x.solde >= 60);
  const enMoins = liste.filter((x) => x.solde <= -60);
  const totalPlus = enPlus.reduce((t, x) => t + x.solde, 0);
  const totalMoins = enMoins.reduce((t, x) => t - x.solde, 0);

  const agir = (s: Solde, type: RegulType): void => {
    // Payer ou solder efface le solde d'un coup ; récupérer et rattraper passent par la fenêtre, où l'on choisit le moment.
    regulariser({ personId: s.personId, minutes: -Math.round(s.solde), type });
    const p = personne(s.personId);
    dire(`${p ? nomCourt(p) : 'Compteur'} : ${REGUL_LABEL[type].toLowerCase()}.`, true);
  };
  const laisserFaire = (): void => {
    setCalcul(true);
    window.setTimeout(() => {
      regulariserAuto();
      setCalcul(false);
      dire(`${propositions.length} compteur${propositions.length > 1 ? 's' : ''} régularisé${propositions.length > 1 ? 's' : ''} sur la semaine du ${fmtSemaine(semaine)}. Brouillon recalculé, rien n’est publié.`, true);
    }, 60);
  };

  if (!liste.length) {
    return (
      <Empty icon={<Hourglass size={30} />} title="Aucun compteur à suivre">
        Le compteur se remplit dès qu’un planning est publié pour un salarié.
      </Empty>
    );
  }
  return (
    <div>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <Hourglass size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Compteur d’heures</div>
          <h1>
            Le moins d’<span className="hl">heures en plus</span> possible
          </h1>
          <p>L’objectif : que chacun reste à son contrat. Solvéa signale tout dépassement et propose comment le résorber.</p>
        </div>
        <BoutonAuto onClick={laisserFaire} disabled={calcul || !propositions.length} occupe={calcul} focus="auto-heures" title="Calcul fait sur cet appareil : règles impératives d’abord, puis équilibre des heures.">
          {calcul ? 'Calcul en cours…' : 'Régulariser automatiquement'}
        </BoutonAuto>
      </div>

      <div className="chiffres">
        <div className="chiffre">
          <span className={`chiffre-pic${enPlus.length ? ' warn' : ' ok'}`} aria-hidden="true"><TrendingUp size={18} /></span>
          <b className="num">{fmtDuree(totalPlus)}</b>
          <span>en plus des contrats{enPlus.length ? ` · ${enPlus.length} personne${enPlus.length > 1 ? 's' : ''}` : ''}</span>
        </div>
        <div className="chiffre">
          <span className={`chiffre-pic${enMoins.length ? ' info' : ''}`} aria-hidden="true"><TrendingDown size={18} /></span>
          <b className="num">{fmtDuree(totalMoins)}</b>
          <span>en moins des contrats{enMoins.length ? ` · ${enMoins.length} personne${enMoins.length > 1 ? 's' : ''}` : ''}</span>
        </div>
        <div className="chiffre">
          <span className="chiffre-pic ok" aria-hidden="true"><CircleCheck size={18} /></span>
          <b className="num">{liste.length - enPlus.length - enMoins.length}</b>
          <span>à jour, à moins d’une heure du contrat</span>
        </div>
      </div>
      {enPlus.length ? (
        <div className="notice warn hc-alerte" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>
            <b>
              Alerte heures supplémentaires : {enPlus.map((x) => personne(x.personId)?.prenom).filter(Boolean).join(', ')}.
            </b>{' '}
            Faites-les récupérer sur la semaine du {fmtSemaine(semaine)} plutôt que de les payer : « Régulariser automatiquement » s’en charge, par demi-heures, sans rien publier.
          </span>
        </div>
      ) : propositions.length ? (
        <div className="notice info hc-alerte">
          <Hourglass size={16} aria-hidden="true" />
          <span>
            <b>
              {propositions.length} compteur{propositions.length > 1 ? 's' : ''} à régulariser.
            </b>{' '}
            « Régulariser automatiquement » les résorbe sur la semaine du {fmtSemaine(semaine)}, sans rien publier.
          </span>
        </div>
      ) : (
        <div className="notice ok hc-alerte">
          <CircleCheck size={16} aria-hidden="true" /> Aucune heure supplémentaire à résorber : tous les compteurs sont à moins d’une heure du contrat.
        </div>
      )}

      <section className="card" aria-label="Compteurs de l’équipe" data-focus="compteurs-heures">
        {liste.map((s) => {
          const p = personne(s.personId);
          if (!p) return null;
          const ecart = Math.abs(s.solde) >= 60;
          return (
            <div key={s.personId} className="decision hc" style={{ alignItems: 'center' }}>
              <Avatar person={p} />
              <div className="grow hc-qui" style={{ minWidth: 220 }}>
                <span className="hc-nom">
                  <b>{nomCourt(p)}</b> <EtiquetteRole person={p} />
                </span>
                <span className="hc-faits num">
                  <span>
                    <b>{fmtDuree(s.realise)}</b> planifiées
                  </span>
                  <span>
                    contrat <b>{fmtDuree(s.contrat)}</b>
                  </span>
                  {s.prevues.map((r) => (
                    <span key={r.id} className={`prevu${r.date ? ' date' : ''}`}>
                      {signe(r.minutes)} prévu {r.date && r.start !== undefined && r.end !== undefined ? `${fmtDateCourt(r.date)}, ${fmtHeure(r.start)} – ${fmtHeure(r.end)}` : `semaine du ${fmtSemaine(r.semaine ?? '')}`}
                    </span>
                  ))}
                </span>
                <span className="hc-jauge" aria-hidden="true">
                  <i className={s.solde >= 60 ? 'plus' : s.solde <= -60 ? 'moins' : ''} style={{ width: `${Math.min(100, s.contrat ? (s.realise / s.contrat) * 100 : 0)}%` }} />
                </span>
              </div>
              <span className={`hc-solde num ${!ecart ? 'pile' : s.solde > 0 ? 'plus' : 'moins'}`} aria-label={`Solde : ${ecart ? signe(s.solde) : 'à jour'}`}>
                {ecart ? signe(s.solde) : 'À jour'}
              </span>
              {ecart ? (
                <div className="row wrap" style={{ gap: 6 }}>
                  {s.solde > 0 ? (
                    <>
                      <button type="button" className="btn sm" data-regul="recuperation" onClick={() => setFenetre({ personId: s.personId, sens: 'recuperation' })}>
                        Faire récupérer
                      </button>
                      <button type="button" className="btn sm" onClick={() => agir(s, 'paiement')}>
                        Payer
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn sm" data-regul="rattrapage" onClick={() => setFenetre({ personId: s.personId, sens: 'rattrapage' })}>
                        Faire rattraper
                      </button>
                      <button type="button" className="btn sm" onClick={() => agir(s, 'solde')}>
                        Solder
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      {historique.length ? (
        <section className="card" style={{ marginTop: 22 }} aria-label="Régularisations enregistrées">
          <div className="card-head">
            <h2 className="h3 grow">Régularisations</h2>
            <span className="small soft">{historique.length}</span>
          </div>
          {historique.map((r) => {
            const p = personne(r.personId);
            return (
              <div key={r.id} className="decision" style={{ alignItems: 'center' }}>
                <div className="grow">
                  <b>{p ? nomCourt(p) : '—'}</b> · {REGUL_LABEL[r.type]} <span className="num">{signe(r.minutes)}</span>
                  <div className="small soft">
                    {r.date && r.start !== undefined && r.end !== undefined ? `${fmtDateCourt(r.date)}, ${fmtHeure(r.start)} – ${fmtHeure(r.end)} · ` : r.semaine ? `Semaine du ${fmtSemaine(r.semaine)} · ` : ''}
                    {fmtHorodatage(r.at)}
                  </div>
                </div>
                {r.auto ? <Pill tone="miel">Automatique</Pill> : null}
                <button type="button" className="btn ghost icon" onClick={() => retirerRegularisation(r.id)} aria-label={`Retirer la régularisation de ${p ? nomCourt(p) : ''}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </section>
      ) : null}
      {fenetre && liste.find((x) => x.personId === fenetre.personId) ? (
        <Regulariser solde={liste.find((x) => x.personId === fenetre.personId) as Solde} sens={fenetre.sens} onClose={() => setFenetre(null)} />
      ) : null}
      <p className="tiny muted" style={{ marginTop: 16, maxWidth: '80ch' }}>
        Le compteur aide à décider : il ne calcule ni majoration ni repos compensateur. La paie applique la convention collective ; faites valider le choix entre paiement et récupération par votre expert-comptable.
      </p>
    </div>
  );
}
