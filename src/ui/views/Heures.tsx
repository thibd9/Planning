import { CircleCheck, Hourglass, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { fmtDuree, fmtHorodatage, fmtSemaine } from '../../domain/time';
import type { RegulType } from '../../domain/types';
import { REGUL_LABEL, nomCourt } from '../../domain/types';
import type { Solde } from '../../engine/heures';
import { proposerRegularisations, semaineLibre, soldes } from '../../engine/heures';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { EtiquetteRole } from '../icons';
import { Avatar, BoutonIA, Empty, Pill } from '../kit';

const signe = (min: number): string => `${min > 0 ? '+' : '−'}${fmtDuree(Math.abs(min))}`;

/** Compteur d'heures : ce que chacun a fait de plus ou de moins que son contrat, et comment on le régularise. */
export function Heures(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { regulariser, regulariserAuto, retirerRegularisation } = useStore();
  const dire = useUi((s) => s.dire);
  const [calcul, setCalcul] = useState(false);
  const liste = useMemo(() => soldes(data, today), [data, today]);
  const propositions = useMemo(() => proposerRegularisations(data, today), [data, today]);
  const semaine = semaineLibre(data, today);
  const historique = [...(data.regularisations ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  const personne = (id: string) => data.personnes.find((p) => p.id === id);

  const agir = (s: Solde, type: RegulType): void => {
    // Payer ou solder efface le solde ; récupérer ou rattraper le planifie sur la prochaine semaine à construire.
    const planifie = type === 'recuperation' || type === 'rattrapage';
    const borne = planifie ? Math.max(-480, Math.min(480, s.solde)) : s.solde;
    regulariser({ personId: s.personId, minutes: -Math.round(borne), type, semaine: planifie ? semaine : undefined });
    const p = personne(s.personId);
    dire(`${p ? nomCourt(p) : 'Compteur'} : ${REGUL_LABEL[type].toLowerCase()}${planifie ? `, semaine du ${fmtSemaine(semaine)}` : ''}.`, true);
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
            Qui a fait <span className="hl">plus ou moins</span> ?
          </h1>
          <p>Heures planifiées et publiées, face au contrat. Vous régularisez à la main, ou vous laissez Solvéa répartir sur la prochaine semaine à construire.</p>
        </div>
        <BoutonIA onClick={laisserFaire} disabled={calcul || !propositions.length} occupe={calcul} focus="ia-heures" title="Calcul fait sur cet appareil par le moteur de Solvéa : règles impératives d’abord, puis équilibre des heures.">
          {calcul ? 'Calcul en cours…' : 'Laisser l’IA Solvéa faire'}
        </BoutonIA>
      </div>

      {propositions.length ? (
        <div className="notice info" style={{ marginBottom: 18 }}>
          <Hourglass size={16} aria-hidden="true" />
          <span>
            <b>
              {propositions.length} compteur{propositions.length > 1 ? 's' : ''} à régulariser.
            </b>{' '}
            L’IA Solvéa les résorbe sur la semaine du {fmtSemaine(semaine)}, la première qui n’est pas publiée, par demi-heures et sans dépasser 8 h d’écart au contrat. Le brouillon de cette semaine est recalculé ; vous le relisez avant de publier.
          </span>
        </div>
      ) : (
        <div className="notice ok" style={{ marginBottom: 18 }}>
          <CircleCheck size={16} aria-hidden="true" /> Tous les compteurs sont à moins d’une heure du contrat.
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
              <div className="grow" style={{ minWidth: 190 }}>
                <b>{nomCourt(p)}</b> <EtiquetteRole person={p} />
                <div className="small soft num">
                  {fmtDuree(s.realise)} planifiées pour {fmtDuree(s.contrat)} au contrat
                  {s.prevues.map((r) => ` · ${signe(r.minutes)} prévu semaine du ${fmtSemaine(r.semaine ?? '')}`).join('')}
                </div>
              </div>
              <span className={`hc-solde num ${!ecart ? 'pile' : s.solde > 0 ? 'plus' : 'moins'}`} aria-label={`Solde : ${ecart ? signe(s.solde) : 'à jour'}`}>
                {ecart ? signe(s.solde) : 'À jour'}
              </span>
              {ecart ? (
                <div className="row wrap" style={{ gap: 6 }}>
                  {s.solde > 0 ? (
                    <>
                      <button type="button" className="btn sm" onClick={() => agir(s, 'recuperation')}>
                        Faire récupérer
                      </button>
                      <button type="button" className="btn sm" onClick={() => agir(s, 'paiement')}>
                        Payer
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn sm" onClick={() => agir(s, 'rattrapage')}>
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
                    {r.semaine ? `Semaine du ${fmtSemaine(r.semaine)} · ` : ''}
                    {fmtHorodatage(r.at)}
                  </div>
                </div>
                {r.auto ? <Pill tone="miel">IA Solvéa</Pill> : null}
                <button type="button" className="btn ghost icon" onClick={() => retirerRegularisation(r.id)} aria-label={`Retirer la régularisation de ${p ? nomCourt(p) : ''}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </section>
      ) : null}
      <p className="tiny muted" style={{ marginTop: 16, maxWidth: '80ch' }}>
        Le compteur aide à décider : il ne calcule ni majoration ni repos compensateur. La paie applique la convention collective ; faites valider le choix entre paiement et récupération par votre expert-comptable.
      </p>
    </div>
  );
}
