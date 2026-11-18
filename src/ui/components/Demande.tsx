import { AlertTriangle, CalendarHeart, EyeOff, Sparkles, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { reperesAVenir } from '../../data/fetes';
import { JOURS, fmtDateCourt, fmtHHMM, mondayOf, parseHHMM, weekday } from '../../domain/time';
import type { AbsenceType, BesoinForme, BesoinStatut, MotifDemande } from '../../domain/types';
import { ABSENCE_LABEL, MOTIF_DEMANDE_LABEL } from '../../domain/types';
import { lireBesoin } from '../../engine/nlp';
import { absencesSimultanees } from '../../engine/suivi';
import { useStore } from '../../store/store';
import { NomsFormations } from './Formation';
import { useUi } from '../../store/ui';
import { Dialog, Pill } from '../kit';
import { usagePlafond } from '../views/Resoudre';

type Genre = BesoinForme | 'jour' | 'absence';
type Plage = 'journee' | 'matin' | 'aprem' | 'perso';

/** Bornes d'une indisponibilité partielle, en minutes ; rien pour la journée entière. */
function bornes(plage: Plage, de: string, a: string): { plageStart?: number; plageEnd?: number } {
  if (plage === 'matin') return { plageStart: 0, plageEnd: 13 * 60 };
  if (plage === 'aprem') return { plageStart: 13 * 60, plageEnd: 1440 };
  if (plage === 'perso') return { plageStart: parseHHMM(de) ?? 0, plageEnd: parseHHMM(a) ?? 1440 };
  return {};
}

const GENRES: { value: Genre; label: string }[] = [
  { value: 'indisponible', label: 'Ne pas travailler certains jours' },
  { value: 'finir_avant', label: 'Finir avant une heure' },
  { value: 'commencer_apres', label: 'Commencer après une heure' },
  { value: 'jour', label: 'Un jour précis' },
  { value: 'absence', label: 'Une absence de plusieurs jours' },
];

/**
 * Préréglages : un nom familier remplit le formulaire, puis disparaît.
 * Seule la contrainte d'horaire est enregistrée ; le préréglage choisi ne l'est jamais.
 */
interface Prereglage {
  nom: string;
  detail: string;
  /** La raison que le raccourci présélectionne ; une pratique personnelle reste « raison personnelle ». */
  motif: MotifDemande;
  /** Une ou deux contraintes : le Chabbat en demande deux (vendredi soir et samedi). */
  lignes: { forme: BesoinForme; jours: number[]; heure?: string; plage?: Plage; de?: string; a?: string }[];
}

const PREREGLAGES: Prereglage[] = [
  {
    nom: 'Chabbat',
    motif: 'personnel',
    detail: 'Finir avant 16 h le vendredi, ne pas travailler le samedi',
    lignes: [
      { forme: 'finir_avant', jours: [4], heure: '16:00' },
      { forme: 'indisponible', jours: [5], plage: 'journee' },
    ],
  },
  { nom: 'Prière du vendredi', motif: 'personnel', detail: 'Ne pas travailler le vendredi de 12 h à 14 h 30', lignes: [{ forme: 'indisponible', jours: [4], plage: 'perso', de: '12:00', a: '14:30' }] },
  { nom: 'Office du dimanche', motif: 'personnel', detail: 'Ne pas travailler le dimanche matin', lignes: [{ forme: 'indisponible', jours: [6], plage: 'matin' }] },
  { nom: 'Rupture du jeûne', motif: 'personnel', detail: 'Finir avant 18 h tous les jours, sur une période à préciser', lignes: [{ forme: 'finir_avant', jours: [0, 1, 2, 3, 4, 5], heure: '18:00' }] },
  { nom: 'Sortie d’école', motif: 'famille', detail: 'Finir avant 16 h 30 les lundis, mardis, jeudis et vendredis', lignes: [{ forme: 'finir_avant', jours: [0, 1, 3, 4], heure: '16:30' }] },
  { nom: 'Mercredi', motif: 'famille', detail: 'Ne pas travailler le mercredi', lignes: [{ forme: 'indisponible', jours: [2], plage: 'journee' }] },
  { nom: 'Cours du soir', motif: 'etudes', detail: 'Finir avant 17 h 30 certains soirs, à choisir', lignes: [{ forme: 'finir_avant', jours: [], heure: '17:30' }] },
];

/**
 * Formulaire unique pour tous les besoins personnels. Une demande porte toujours sa raison : une catégorie
 * choisie dans une liste, et une précision facultative. Seuls les titulaires la voient.
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
  const [plage, setPlage] = useState<Plage>('journee');
  const [plageDe, setPlageDe] = useState('12:00');
  const [plageA, setPlageA] = useState('14:00');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState('');
  const [statut, setStatut] = useState<BesoinStatut>('preference');
  const [horsPlafond, setHorsPlafond] = useState(false);
  const [typeAbsence, setTypeAbsence] = useState<AbsenceType>('conge');
  const [formation, setFormation] = useState('');
  const [phrase, setPhrase] = useState('');
  /** La raison de la demande : obligatoire pour l'équipe, facultative quand le titulaire saisit lui-même. */
  const [motif, setMotif] = useState<MotifDemande | ''>('');
  const [precision, setPrecision] = useState('');
  const [compris, setCompris] = useState<{ ok: string[]; manque: string[] } | null>(null);
  const [calendrier, setCalendrier] = useState(false);
  // Seconde contrainte d'un préréglage double (Chabbat) : envoyée avec la première.
  const [suite, setSuite] = useState<Prereglage['lignes'][number] | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const usage = usagePlafond(data, personId, today);
  // D'autres absences, demandées ou accordées, sur les dates choisies : on le dit, sans nommer personne.
  const autresSurCesDates = useMemo(() => {
    if (genre !== 'absence' || !from || !to || to < from) return 0;
    const m = absencesSimultanees(data, { id: '', personId, from, to, createdAt: '' });
    return m.demandees.length + m.accordees.length;
  }, [data, genre, personId, from, to]);
  const reperes = useMemo(() => reperesAVenir(today), [today]);
  const plein = statut === 'prioritaire' && !horsPlafond && usage.actifs >= usage.plafond;

  const valide =
    genre === 'absence' ? !!from && !!to && to >= from : genre === 'jour'
        ? !!from
        : jours.length > 0 && (genre === 'indisponible' ? plage !== 'perso' || (parseHHMM(plageDe) ?? 0) < (parseHHMM(plageA) ?? 0) : parseHHMM(heure) !== null);

  const comprendre = (): void => {
    const cible = data.personnes.filter((p) => p.id === personId);
    const l = lireBesoin(`${cible[0]?.prenom ?? ''} ${phrase}`, cible, today);
    const b = l.besoin;
    if (b) {
      setGenre(b.forme);
      setJours(b.jours);
      setFrequence(b.frequence);
      if (b.heure !== undefined) setHeure(fmtHHMM(b.heure));
      setPlage(b.plageStart === undefined ? 'journee' : b.plageStart === 0 ? 'matin' : b.plageEnd === 1440 ? 'aprem' : 'perso');
      if (b.plageStart !== undefined && b.plageStart > 0 && b.plageEnd !== undefined && b.plageEnd < 1440) {
        setPlageDe(fmtHHMM(b.plageStart));
        setPlageA(fmtHHMM(b.plageEnd));
      }
      if (b.from) setFrom(b.from);
      setTo(b.to ?? '');
      setStatut(b.statut);
    }
    setCompris({ ok: l.compris.filter((c) => !c.startsWith('Personne')), manque: l.manque.filter((m) => !m.startsWith('la personne')) });
  };

  const appliquer = (p: Prereglage): void => {
    // Un second clic sur le raccourci choisi le retire : le formulaire revient à son état de départ.
    if (choisi === p.nom) {
      setGenre('indisponible');
      setJours([]);
      setFrequence(1);
      setHeure('17:00');
      setPlage('journee');
      setPlageDe('12:00');
      setPlageA('14:00');
      setSuite(null);
      setChoisi(null);
      return;
    }
    const [a, b] = p.lignes;
    setGenre(a.forme);
    setJours(a.jours);
    setFrequence(1);
    if (a.heure) setHeure(a.heure);
    setPlage(a.plage ?? 'journee');
    if (a.de) setPlageDe(a.de);
    if (a.a) setPlageA(a.a);
    setSuite(b ?? null);
    setChoisi(p.nom);
    setMotif(p.motif);
  };

  const raison = motif ? { motif, ...(precision.trim() ? { precision: precision.trim() } : {}) } : {};
  const envoyer = (): void => {
    if (genre === 'absence') {
      declarerAbsence({ personId, from, to, type: typeAbsence, statut: responsable ? 'approuvee' : 'demandee', ...(typeAbsence === 'formation' && formation.trim() ? { libelle: formation.trim() } : {}), ...raison });
      dire(responsable ? 'Absence enregistrée. Les postes concernés sont à couvrir dans « Résoudre ».' : 'Demande d’absence envoyée au responsable.', true);
      onClose();
      return;
    }
    const jour = genre === 'jour';
    const h = parseHHMM(heure) ?? undefined;
    ajouterBesoin({
      personId,
      ...raison,
      forme: jour ? 'indisponible' : genre,
      jours: jour ? [weekday(from)] : jours,
      frequence: jour ? 1 : frequence,
      semaineRef: !jour && frequence === 2 ? mondayOf(from || today) : undefined,
      heure: genre === 'finir_avant' || genre === 'commencer_apres' ? h : undefined,
      ...(genre === 'indisponible' ? bornes(plage, plageDe, plageA) : {}),
      from: from || today,
      to: jour ? from : to || undefined,
      statut,
      horsPlafond: responsable && horsPlafond,
      decision: responsable ? 'acceptee' : 'en_attente',
      decidedAt: responsable ? new Date().toISOString() : undefined,
    });
    if (suite && !jour) {
      ajouterBesoin({
        personId,
        ...raison,
        forme: suite.forme,
        jours: suite.jours,
        frequence,
        semaineRef: frequence === 2 ? mondayOf(from || today) : undefined,
        heure: suite.heure ? (parseHHMM(suite.heure) ?? undefined) : undefined,
        ...(suite.forme === 'indisponible' ? bornes(suite.plage ?? 'journee', suite.de ?? '', suite.a ?? '') : {}),
        from: from || today,
        to: to || undefined,
        statut,
        horsPlafond: responsable && horsPlafond,
        decision: responsable ? 'acceptee' : 'en_attente',
        decidedAt: responsable ? new Date().toISOString() : undefined,
      });
    }
    dire(responsable ? 'Besoin enregistré.' : 'Demande envoyée au responsable.', true);
    onClose();
  };

  return (
    <Dialog
      size="mid"
      title={responsable ? 'Enregistrer un besoin' : 'Nouvelle demande'}
      subtitle={responsable ? 'Décrivez le besoin ; la raison est facultative quand vous l’enregistrez vous-même.' : 'Décrivez le besoin et donnez sa raison : seuls vos titulaires la voient.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn primary" disabled={!valide || plein || (!responsable && !motif)} onClick={envoyer}>
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

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field" style={{ marginBottom: 6 }}>Besoins courants (facultatif)</legend>
        <div className="row wrap" style={{ gap: 6 }}>
          {PREREGLAGES.map((p) => (
            <button key={p.nom} type="button" className={`btn sm${choisi === p.nom ? ' primary' : ''}`} aria-pressed={choisi === p.nom} title={choisi === p.nom ? 'Cliquer de nouveau pour retirer ce raccourci' : p.detail} onClick={() => appliquer(p)}>
              {choisi === p.nom ? <Check size={14} aria-hidden="true" /> : null} {p.nom}
            </button>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 6 }}>
          <EyeOff size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Un raccourci pour remplir le formulaire. <b>Le raccourci choisi n’est pas enregistré</b> : votre responsable ne voit que des horaires, par exemple « finir avant 16 h le vendredi ».
        </p>
        {choisi ? (
          <p className="notice ok small" role="status">
            <span>
              {PREREGLAGES.find((p) => p.nom === choisi)?.detail}. Ajustez les jours et les heures ci-dessous si besoin.
              {suite ? ' Deux contraintes seront envoyées ensemble.' : ''}
            </span>
          </p>
        ) : null}
      </fieldset>

      <div className="demande-raison">
        <label className="field" htmlFor="demande-motif">
          Raison de la demande{responsable ? ' (facultatif)' : ''}
          <select id="demande-motif" value={motif} onChange={(e) => setMotif(e.target.value as MotifDemande | '')} required={!responsable}>
            <option value="">Choisir une raison…</option>
            {(Object.keys(MOTIF_DEMANDE_LABEL) as MotifDemande[]).map((m) => (
              <option key={m} value={m}>
                {MOTIF_DEMANDE_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="field grow" htmlFor="demande-precision">
          Précision (facultatif)
          <input id="demande-precision" value={precision} onChange={(e) => setPrecision(e.target.value)} maxLength={120} placeholder="Exemple : rendez-vous à 15 h" />
        </label>
        <p className="tiny muted demande-raison-note">
          <EyeOff size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Une raison est demandée pour chaque demande. Seuls vos titulaires la voient ; vos collègues ne voient que vos horaires.
        </p>
      </div>

      <label className="field">
        Type de besoin
        <select
          value={genre}
          onChange={(e) => {
            setGenre(e.target.value as Genre);
            setSuite(null);
            setChoisi(null);
          }}
          data-autofocus
        >
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
              {JOURS.map((j, i) => (
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
                  <option value="perso">Une plage horaire</option>
                </select>
              </label>
            ) : null}
            {genre === 'indisponible' && plage === 'perso' ? (
              <>
                <label className="field">
                  De
                  <input type="time" step={900} value={plageDe} onChange={(e) => setPlageDe(e.target.value)} />
                </label>
                <label className="field">
                  À
                  <input type="time" step={900} value={plageA} onChange={(e) => setPlageA(e.target.value)} />
                </label>
              </>
            ) : null}
            {genre !== 'indisponible' ? (
              <label className="field">
                {genre === 'finir_avant' ? 'Finir avant' : 'Commencer après'}
                <input type="time" step={900} value={heure} onChange={(e) => setHeure(e.target.value)} />
              </label>
            ) : null}
          </div>
        </>
      ) : null}

      {autresSurCesDates ? (
        <p className="notice info small" role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            {autresSurCesDates > 1 ? `${autresSurCesDates} collègues sont déjà absents ou ont` : 'Un collègue est déjà absent ou a'} demandé ces dates. Votre demande part quand même : {responsable ? 'pensez à répondre aux deux.' : 'votre titulaire verra les deux ensemble.'}
          </span>
        </p>
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
        {genre === 'absence' && typeAbsence === 'formation' ? (
          <label className="field" htmlFor="demande-formation" style={{ flex: '1 1 240px' }}>
            Nom de la formation
            <input id="demande-formation" value={formation} onChange={(e) => setFormation(e.target.value)} placeholder="Vaccination, gestes d’urgence…" list="formations-connues" autoComplete="off" />
            <NomsFormations />
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
              Demandes prioritaires actives : {usage.actifs} / {usage.plafond}
            </Pill>
            <span className="soft">Le même plafond s'applique à toute l'équipe.</span>
          </div>
          {plein ? (
            <div className="notice warn small">
              <AlertTriangle size={15} /> Le plafond de demandes prioritaires est atteint. Choisissez « simple préférence » ou retirez une demande existante.
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
