import { ChevronDown, PillBottle, Scale, ShieldCheck, Users } from 'lucide-react';
import { JOURS, fmtDecimal, fmtHeure } from '../../domain/time';
import type { InfosOfficine } from '../../domain/types';
import type { BilanMetier, VerdictEffectif } from '../../engine/dimensionnement';
import { HYPOTHESES, dimensionnement } from '../../engine/dimensionnement';
import { useStore } from '../../store/store';
import { Accordeon } from './Accordeon';

const VERDICT: Record<VerdictEffectif, { mot: string; ton: string; phrase: string }> = {
  manque: { mot: 'Il en manque', ton: 'danger', phrase: 'Les contrats ne couvrent pas le besoin : le planning tiendra mal dès la première absence.' },
  juste: { mot: 'C’est juste', ton: 'warn', phrase: 'Le besoin est couvert de justesse : un congé ou un arrêt suffit à créer un trou.' },
  bon: { mot: 'Assez', ton: 'ok', phrase: 'Les contrats couvrent le besoin, absences comprises.' },
  large: { mot: 'Plus qu’il n’en faut', ton: 'info', phrase: 'Les contrats dépassent nettement le besoin : il y a de la marge pour des services ou des projets.' },
};
const etp = (n: number): string => `${fmtDecimal(n, 1)} temps plein`;
/** Le verdict au fil d'une phrase : « assez », « il en manque ». */
const verdictEnClair = (v: VerdictEffectif): string => VERDICT[v].mot.charAt(0).toLowerCase() + VERDICT[v].mot.slice(1);
/** « lundi à vendredi », « samedi », « lundi, mercredi ». */
export const joursEnClair = (jours: number[]): string => {
  const j = [...jours].sort((a, b) => a - b);
  const suite = j.every((x, k) => k === 0 || x === j[k - 1] + 1);
  return j.length > 2 && suite ? `${JOURS[j[0]]} à ${JOURS[j[j.length - 1]]}` : j.map((x) => JOURS[x]).join(', ');
};

function Bilan({ id, titre, icone, bilan, precision }: { id: string; titre: string; icone: JSX.Element; bilan: BilanMetier; precision?: string }): JSX.Element {
  const v = VERDICT[bilan.verdict];
  const max = Math.max(bilan.besoin, bilan.dispo, 0.1) * 1.15;
  return (
    <div className={`dim-bilan v-${bilan.verdict}`} id={id}>
      <div className="dim-bilan-tete">
        <span className="ico" aria-hidden="true">
          {icone}
        </span>
        <h3 className="grow">{titre}</h3>
        <span className={`pill ${v.ton}`}>{v.mot}</span>
      </div>
      <p className="dim-chiffres num">
        <b>{fmtDecimal(bilan.dispo, 1)}</b> temps plein au contrat, pour <b>{fmtDecimal(bilan.besoin, 1)}</b> qu’il faut
      </p>
      <div className="dim-barre" role="img" aria-label={`${etp(bilan.dispo)} au contrat, ${etp(bilan.besoin)} nécessaires`}>
        <i style={{ width: `${(bilan.dispo / max) * 100}%` }} />
        <span className="dim-repere" style={{ left: `${(bilan.besoin / max) * 100}%` }} />
      </div>
      <p className="small soft">
        {v.phrase}
        {precision ? ` ${precision}` : ''}
      </p>
    </div>
  );
}

/**
 * L'équipe est-elle bien dimensionnée ? Réservé aux titulaires. Une rubrique en accordéon de la page « Réglages ».
 * Trois chiffres à saisir, un repère pour les pharmaciens, un pour le reste du comptoir, et tout le calcul à découvert.
 */
export function Dimensionnement(): JSX.Element {
  const officine = useStore((s) => s.data.officine);
  const personnes = useStore((s) => s.data.personnes);
  const majOfficine = useStore((s) => s.majOfficine);
  const infos: InfosOfficine = officine.infos ?? {};
  const d = dimensionnement(officine, personnes);
  const ecrire = (cle: keyof InfosOfficine, texte: string, max: number): void => {
    const v = Math.round(Number(texte.replace(',', '.')));
    const suite = { ...infos, [cle]: texte.trim() && v > 0 ? Math.min(v, max) : undefined };
    const propre = Object.fromEntries(Object.entries(suite).filter(([, x]) => x !== undefined && x !== false && x !== 0));
    majOfficine({ infos: Object.keys(propre).length ? (propre as InfosOfficine) : undefined });
  };
  const H = HYPOTHESES;
  const p = d.pharmaciens;
  // Fermée, la rubrique dit l'essentiel : combien au comptoir, et si les contrats suivent.
  const resume =
    d.source === 'aucune'
      ? 'À compléter : indiquez les clients servis par jour, ou la surface de vente'
      : `${d.comptoir.ordinaire} au comptoir à l’heure ordinaire, ${d.comptoir.pointe} à la pointe · pharmaciens : ${verdictEnClair(p.verdict)} · préparateurs et comptoir : ${verdictEnClair(d.equipe.verdict)}`;
  return (
    <Accordeon
      id="dimensionnement"
      focus="dimensionnement"
      icone={Scale}
      titre={
        <span id="dim-titre" role="heading" aria-level={3}>
          L’équipe est-elle bien dimensionnée ?
        </span>
      }
      resume={resume}
    >
      <p className="of-intro">
        Un repère pour vous, titulaire. Il part des clients à servir, pas du mobilier : les caisses ne sont qu’un plafond. Ce n’est pas une norme, et toutes les hypothèses sont écrites plus bas.
      </p>

      <div className="of-grille">
        <label className="field" htmlFor="dim-passages">
          Clients servis par jour
          <input id="dim-passages" type="number" inputMode="numeric" min={0} max={5000} step={10} className="num" value={infos.passagesJour ?? ''} onChange={(e) => ecrire('passagesJour', e.target.value, 5000)} placeholder="-" aria-describedby="dim-passages-aide" />
          <span className="aide" id="dim-passages-aide">En moyenne, un jour ordinaire. Votre logiciel de gestion le donne.</span>
        </label>
        <label className="field" htmlFor="dim-minutes">
          Temps moyen par client
          <span className="champ-unite">
            <input id="dim-minutes" type="number" inputMode="numeric" min={1} max={30} step={1} className="num" value={infos.minutesParClient ?? ''} onChange={(e) => ecrire('minutesParClient', e.target.value, 30)} placeholder={String(infos.robot ? H.minutesParClientRobot : H.minutesParClient)} aria-describedby="dim-minutes-aide" />
            <span className="unite">min</span>
          </span>
          <span className="aide" id="dim-minutes-aide">Facultatif. Sans valeur : {H.minutesParClient} minutes, {H.minutesParClientRobot} avec un robot.</span>
        </label>
        <label className="field" htmlFor="dim-activite">
          Activité annuelle hors taxes
          <span className="champ-unite">
            <input id="dim-activite" type="number" inputMode="numeric" min={0} max={50000000} step={10000} className="num" value={infos.activiteAnnuelle ?? ''} onChange={(e) => ecrire('activiteAnnuelle', e.target.value, 50000000)} placeholder="-" aria-describedby="dim-activite-aide" />
            <span className="unite">€</span>
          </span>
          <span className="aide" id="dim-activite-aide">Facultatif : pour le nombre minimal de pharmaciens. Reste sur cet appareil.</span>
        </label>
      </div>

      {d.source === 'aucune' ? (
        <p className="dim-attente" id="dim-attente">
          {d.remarques[0]}
        </p>
      ) : (
        <>
          <div className="dim-comptoir" id="dim-comptoir">
            <div>
              <span className="l">Au comptoir, heure ordinaire</span>
              <b className="num">{d.comptoir.ordinaire}</b>
              <span className="d">personne{d.comptoir.ordinaire > 1 ? 's' : ''} en même temps</span>
            </div>
            <div>
              <span className="l">À l’heure de pointe</span>
              <b className="num">{d.comptoir.pointe}</b>
              <span className="d">personne{d.comptoir.pointe > 1 ? 's' : ''} en même temps</span>
            </div>
            <div>
              <span className="l">Jamais moins de</span>
              <b className="num">{d.comptoir.plancher}</b>
              <span className="d">dont un pharmacien</span>
            </div>
            <div>
              <span className="l">Plafond utile</span>
              <b className="num">{d.comptoir.plafond ?? '-'}</b>
              <span className="d">{d.comptoir.plafond ? 'vos postes, plus une personne hors comptoir' : 'indiquez vos postes de comptoir'}</span>
            </div>
          </div>

          <div className="dim-bilans">
            <Bilan
              id="dim-pharmaciens"
              titre="Pharmaciens"
              icone={<ShieldCheck size={18} />}
              bilan={p}
              precision={`Un pharmacien présent sur vos ${fmtDecimal(d.heuresOuverture, 1)} heures d’ouverture par semaine${p.ensemble > 1 ? `, et ${p.ensemble} en même temps à l’heure de pointe` : ''}.`}
            />
            <Bilan id="dim-equipe" titre="Préparateurs et comptoir" icone={<Users size={18} />} bilan={d.equipe} precision="Préparateurs, étudiants, apprentis et animateurs, chacun compté pour ce qu’il apporte au comptoir." />
          </div>
        </>
      )}

      {p.adjointsRequis !== null ? (
        <p className={`dim-regle${p.adjointsCouverts + 1e-9 < p.adjointsRequis ? ' alerte' : ''}`} id="dim-adjoints">
          <PillBottle size={16} aria-hidden="true" />
          <span>
            <b>Règle officielle.</b> Avec cette activité, il faut au moins <b className="num">{p.adjointsRequis}</b> pharmacien{p.adjointsRequis > 1 ? 's' : ''} en équivalent temps plein, en plus du titulaire (un par tranche révolue de {fmtDecimal(H.trancheAdjoint / 1_000_000, 1)} million d’euros, arrêté du 21 février 2022). Vous en comptez <b className="num">{fmtDecimal(p.adjointsCouverts, 1)}</b>
            , titulaires associés à temps plein compris. Vérifiez le texte en vigueur : les seuils peuvent être révisés.
          </span>
        </p>
      ) : null}

      {d.remarques.filter((r) => d.source !== 'aucune' && !/^Règle officielle/.test(r)).length ? (
        <ul className="of-remarques" id="dim-remarques">
          {d.remarques
            .filter((r) => !/^Règle officielle/.test(r))
            .map((r) => (
              <li key={r}>{r}</li>
            ))}
        </ul>
      ) : null}

      {d.ecarts.length ? (
        <div className="dim-ecarts" id="dim-ecarts">
          <h3 className="eq-titre">Vos réglages « combien de personnes au comptoir »</h3>
          <ul>
            {d.ecarts.map((e) => (
              <li key={`${e.jours.join('')}-${e.start}`}>
                <b className="cap1">{joursEnClair(e.jours)}</b>, {fmtHeure(e.start)} à {fmtHeure(e.end)} : vous demandez {e.minEquipe} personne{e.minEquipe > 1 ? 's' : ''} au minimum.{' '}
                {e.sens === 'bas' ? `Le repère est de ${e.repere} à l’heure ordinaire : ce minimum paraît bas.` : `Vos postes n’en accueillent utilement que ${e.repere} : ce minimum paraît haut.`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="dim-calcul">
        <summary>
          <ChevronDown size={16} aria-hidden="true" className="chev" /> D’où vient ce calcul
        </summary>
        <ol>
          <li>
            <b>Le service.</b> Clients par jour × temps par client ({fmtDecimal(d.minutesParClient, 0)} min), en considérant qu’une personne au comptoir sert {fmtDecimal(H.occupation * 100, 0)} % de son temps : au-delà, la file s’allonge.
          </li>
          <li>
            <b>La pointe.</b> À l’heure la plus chargée, on sert {fmtDecimal(H.pointe, 1)} fois plus de clients que la moyenne ; ces heures font {fmtDecimal(H.partPointe * 100, 0)} % de l’ouverture.
          </li>
          <li>
            <b>Hors comptoir.</b> Commandes, réception, rangement, préparatoire : {fmtDecimal(H.horsComptoir * 100, 0)} % de travail en plus, {fmtDecimal(H.horsComptoirRobot * 100, 0)} % avec un robot.
          </li>
          <li>
            <b>Le plafond.</b> Vos postes de comptoir (à défaut vos caisses), plus une personne hors comptoir. Au-delà, une personne de plus n’a pas où servir.
          </li>
          <li>
            <b>Les pharmaciens.</b> Un présent à toute heure d’ouverture, et un de plus à la pointe au-delà de {H.encadrement} personnes au comptoir. Un pharmacien présent sert {fmtDecimal(H.pharmacienAuComptoir * 100, 0)} % de son temps ; le reste va au contrôle et à la gestion.
          </li>
          <li>
            <b>Les absences.</b> Congés, formation, arrêts : {fmtDecimal(H.absences * 100, 0)} % d’heures en plus au contrat, sur une base de {H.tempsPlein} heures par semaine.
          </li>
          <li>
            <b>Ce que chacun apporte au comptoir.</b> Un préparateur compte pour 1, un étudiant en pharmacie pour 0,8, un apprenti et un animateur pour 0,5. Un rayonniste n’est pas compté au comptoir.
          </li>
          <li>
            <b>Sans nombre de clients.</b> Le calcul se rabat sur la surface de vente (une personne pour {H.m2ParPersonne} m²) : c’est grossier, et c’est dit.
          </li>
        </ol>
      </details>
    </Accordeon>
  );
}
