import { AlertTriangle, CalendarHeart, EyeOff, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { reperesAVenir } from '../../data/fetes';
import { JOURS, fmtDateCourt, fmtHHMM, mondayOf, parseHHMM, weekday } from '../../domain/time';
import type { AbsenceType, BesoinForme, BesoinStatut } from '../../domain/types';
import { ABSENCE_LABEL } from '../../domain/types';
import { lireBesoin } from '../../engine/nlp';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Dialog, Pill } from '../kit';
import { usagePlafond } from '../views/Resoudre';

type Genre = BesoinForme | 'jour' | 'absence';

const GENRES: { value: Genre; label: string }[] = [
  { value: 'indisponible', label: 'Ne pas travailler certains jours' },
  { value: 'finir_avant', label: 'Finir avant une heure' },
  { value: 'commencer_apres', label: 'Commencer après une heure' },
  { value: 'jour', label: 'Un jour précis' },
  { value: 'absence', label: 'Une absence de plusieurs jours' },
];

/**
 * Formulaire unique pour tous les besoins personnels. Il n'y a ni champ « motif » ni texte libre :
 * garde d'enfant, pratique religieuse, soin, transport ou cours du soir passent par le même chemin.
 */
export function DialogueDemande({ personId, espace, onClose }: { personId: string; espace: 'responsable' | 'salarie'; onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { ajouterBesoin, declarerAbsence } = useStore();
  const dire = useUi((s) => s.dire);
  const responsable = espace === 'responsable';
  const [genre, setGenre] = useState<Genre>('indisponible');
  const [jours, setJours] = useState<number[]>([]);
  const [frequence, setFrequence] = useState<1 | 2>(1);
  const [heure, setHeure] = useState('17:00');
  const [plage, setPlage] = useState<'journee' | 'matin' | 'aprem'>('journee');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState('');
  const [statut, setStatut] = useState<BesoinStatut>('preference');
  const [horsPlafond, setHorsPlafond] = useState(false);
  const [typeAbsence, setTypeAbsence] = useState<AbsenceType>('conge');
  const [phrase, setPhrase] = useState('');
  const [compris, setCompris] = useState<{ ok: string[]; manque: string[] } | null>(null);
  const [calendrier, setCalendrier] = useState(false);
  const usage = usagePlafond(data, personId, today);
  const reperes = useMemo(() => reperesAVenir(today), [today]);
  const plein = statut === 'prioritaire' && !horsPlafond && usage.actifs >= usage.plafond;

  const valide =
    genre === 'absence' ? !!from && !!to && to >= from : genre === 'jour' ? !!from : jours.length > 0 && (genre === 'indisponible' || parseHHMM(heure) !== null);

  const comprendre = (): void => {
    const cible = data.personnes.filter((p) => p.id === personId);
    const l = lireBesoin(`${cible[0]?.prenom ?? ''} ${phrase}`, cible, today);
    const b = l.besoin;
    if (b) {
      setGenre(b.forme);
      setJours(b.jours);
      setFrequence(b.frequence);
      if (b.heure !== undefined) setHeure(fmtHHMM(b.heure));
      setPlage(b.plageStart === 0 ? 'matin' : b.plageEnd === 1440 ? 'aprem' : 'journee');
      if (b.from) setFrom(b.from);
      setTo(b.to ?? '');
      setStatut(b.statut);
    }
    setCompris({ ok: l.compris.filter((c) => !c.startsWith('Personne')), manque: l.manque.filter((m) => !m.startsWith('la personne')) });
  };

  const envoyer = (): void => {
    if (genre === 'absence') {
      declarerAbsence({ personId, from, to, type: typeAbsence, statut: responsable ? 'approuvee' : 'demandee' });
      dire(responsable ? 'Absence enregistrée. Les postes concernés sont à couvrir dans « Résoudre ».' : 'Demande d’absence envoyée au responsable.', true);
      onClose();
      return;
    }
    const jour = genre === 'jour';
    const h = parseHHMM(heure) ?? undefined;
    ajouterBesoin({
      personId,
      forme: jour ? 'indisponible' : genre,
      jours: jour ? [weekday(from)] : jours,
      frequence: jour ? 1 : frequence,
      semaineRef: !jour && frequence === 2 ? mondayOf(from || today) : undefined,
      heure: genre === 'finir_avant' || genre === 'commencer_apres' ? h : undefined,
      plageStart: genre === 'indisponible' && plage !== 'journee' ? (plage === 'matin' ? 0 : 13 * 60) : undefined,
      plageEnd: genre === 'indisponible' && plage !== 'journee' ? (plage === 'matin' ? 13 * 60 : 1440) : undefined,
      from: from || today,
      to: jour ? from : to || undefined,
      statut,
      horsPlafond: responsable && horsPlafond,
      decision: responsable ? 'acceptee' : 'en_attente',
      decidedAt: responsable ? new Date().toISOString() : undefined,
    });
    dire(responsable ? 'Besoin enregistré.' : 'Demande envoyée au responsable.', true);
    onClose();
  };

  return (
    <Dialog
      size="mid"
      title={responsable ? 'Enregistrer un besoin' : 'Nouvelle demande'}
      subtitle="Décrivez le besoin, jamais sa raison : aucun motif n'est demandé ni conservé."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn primary" disabled={!valide || plein} onClick={envoyer}>
            {responsable ? 'Enregistrer' : 'Envoyer au responsable'}
          </button>
        </>
      }
    >
      {responsable ? (
        <div className="col" style={{ gap: 8 }}>
          <label className="field">
            Dicter en langage courant (facultatif)
            <div className="row">
              <input className="grow" value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Souhaite finir avant 17 h un mercredi sur deux jusqu'à fin juin" onKeyDown={(e) => e.key === 'Enter' && phrase && comprendre()} />
              <button type="button" className="btn" disabled={!phrase.trim()} onClick={comprendre}>
                <Sparkles size={15} /> Comprendre
              </button>
            </div>
          </label>
          {compris ? (
            <div className={`notice ${compris.manque.length ? 'warn' : 'ok'} small`}>
              <Sparkles size={15} />
              <div>
                {compris.ok.length ? <div>Compris : {compris.ok.join(' · ')}.</div> : null}
                {compris.manque.length ? <div>Il manque : {compris.manque.join(' ; ')}.</div> : <div>Vérifiez le formulaire ci-dessous avant d'enregistrer. La phrase n'est pas conservée.</div>}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="field">
        Type de besoin
        <select value={genre} onChange={(e) => setGenre(e.target.value as Genre)} data-autofocus>
          {GENRES.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>

      {genre !== 'jour' && genre !== 'absence' ? (
        <>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field" style={{ marginBottom: 6 }}>Jours concernés</legend>
            <div className="row wrap" style={{ gap: 6 }}>
              {JOURS.slice(0, 6).map((j, i) => (
                <button key={j} type="button" className={`btn sm${jours.includes(i) ? ' primary' : ''}`} aria-pressed={jours.includes(i)} onClick={() => setJours((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i].sort()))}>
                  {j}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="row wrap" style={{ alignItems: 'flex-end' }}>
            <label className="field">
              Rythme
              <select value={frequence} onChange={(e) => setFrequence(Number(e.target.value) as 1 | 2)}>
                <option value={1}>Chaque semaine</option>
                <option value={2}>Une semaine sur deux</option>
              </select>
            </label>
            {genre === 'indisponible' ? (
              <label className="field">
                Partie de la journée
                <select value={plage} onChange={(e) => setPlage(e.target.value as typeof plage)}>
                  <option value="journee">Journée entière</option>
                  <option value="matin">Matin (jusqu'à 13 h)</option>
                  <option value="aprem">Après-midi (dès 13 h)</option>
                </select>
              </label>
            ) : (
              <label className="field">
                {genre === 'finir_avant' ? 'Finir avant' : 'Commencer après'}
                <input type="time" step={900} value={heure} onChange={(e) => setHeure(e.target.value)} />
              </label>
            )}
          </div>
        </>
      ) : null}

      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <label className="field">
          {genre === 'jour' ? 'Date' : genre === 'absence' ? 'Premier jour' : 'À partir du'}
          <input type="date" value={from} min={responsable ? undefined : today} onChange={(e) => setFrom(e.target.value)} />
        </label>
        {genre !== 'jour' ? (
          <label className="field">
            {genre === 'absence' ? 'Dernier jour' : 'Jusqu’au (facultatif)'}
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        ) : null}
        {genre === 'absence' ? (
          <label className="field">
            Nature
            <select value={typeAbsence} onChange={(e) => setTypeAbsence(e.target.value as AbsenceType)}>
              {(Object.keys(ABSENCE_LABEL) as AbsenceType[])
                .filter((t) => responsable || t === 'conge' || t === 'formation')
                .map((t) => (
                  <option key={t} value={t}>
                    {ABSENCE_LABEL[t]}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        {genre === 'jour' || genre === 'absence' ? (
          <button type="button" className="btn sm ghost" onClick={() => setCalendrier((c) => !c)} aria-expanded={calendrier}>
            <CalendarHeart size={15} /> Repères de calendrier
          </button>
        ) : null}
      </div>

      {calendrier && (genre === 'jour' || genre === 'absence') ? (
        <div className="notice" style={{ flexDirection: 'column', gap: 8 }}>
          <div className="row small">
            <EyeOff size={15} />
            <span>
              Fêtes et jours particuliers de toutes traditions, pour retrouver une date. <b>Votre choix n'est pas enregistré</b> : seule la date part dans la demande.
            </span>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {reperes.map((r) => (
              <button
                key={r.date + r.nom}
                type="button"
                className="btn sm"
                onClick={() => {
                  setFrom(r.date);
                  if (genre === 'absence') setTo(r.date);
                  setCalendrier(false);
                }}
              >
                {r.nom} · <span className="muted">{fmtDateCourt(r.date)}{r.indicative ? ' ≈' : ''}</span>
              </button>
            ))}
          </div>
          <span className="tiny muted">≈ date indicative, qui peut varier d'un jour selon le calendrier suivi. Vérifiez-la avant d'envoyer.</span>
        </div>
      ) : null}

      {genre !== 'absence' ? (
        <div className="col" style={{ gap: 8 }}>
          <label className="field" style={{ maxWidth: 340 }}>
            Importance
            <select value={statut} onChange={(e) => setStatut(e.target.value as BesoinStatut)}>
              <option value="preference">Simple préférence</option>
              <option value="prioritaire">Préférence prioritaire</option>
              {responsable ? <option value="reconnue">Indisponibilité reconnue (impérative)</option> : null}
            </select>
          </label>
          <div className="row wrap small">
            <Pill tone={plein ? 'warn' : undefined}>
              Souhaits prioritaires actifs : {usage.actifs} / {usage.plafond}
            </Pill>
            <span className="soft">Le même plafond s'applique à toute l'équipe.</span>
          </div>
          {plein ? (
            <div className="notice warn small">
              <AlertTriangle size={15} /> Le plafond de souhaits prioritaires est atteint. Choisissez « simple préférence » ou retirez un souhait existant.
            </div>
          ) : null}
          {responsable ? (
            <label className="check small">
              <input type="checkbox" checked={horsPlafond} onChange={(e) => setHorsPlafond(e.target.checked)} />
              <span>
                Droit légal ou aménagement validé par une personne habilitée
                <span className="soft" style={{ display: 'block' }}>N'entre jamais dans le plafond : on ne dépense pas de « points » pour un droit. Aucun diagnostic ni justificatif n'est stocké ici.</span>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
