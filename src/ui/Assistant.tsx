import { ArrowRight, GraduationCap, LifeBuoy, Mail, MessageSquare, Phone, SendHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Espace } from '../domain/acces';
import { estCollaboratif } from '../engine/souhaits';
import { useStore } from '../store/store';
import { useUi } from '../store/ui';
import type { Memoire, Reponse } from './bot';
import { fichesPour, repondre } from './bot';
import type { Humeur } from './Solvi';
import { NomSolvi, Solvi } from './Solvi';

interface Bulle {
  id: number;
  de: 'moi' | 'bot';
  texte: string;
  reponse?: Reponse;
}

/** Questions proposées d'emblée : celles dont la réponse se lit dans le planning, selon le rôle. */
const AMORCES: Record<Espace, string[]> = {
  responsable: ['Ma journée', 'Qui travaille demain ?', 'Qui est absent ?', 'Que dois-je décider ?', 'Les heures à régulariser ?'],
  pharmacien: ['Ma journée', 'Mon prochain poste ?', 'Ma prochaine garde ?', 'Qui travaille demain ?', 'Me faire remplacer'],
  equipe: ['Ma journée', 'Mon prochain poste ?', 'Qui travaille avec moi demain ?', 'Mon compteur d’heures ?', 'Me faire remplacer'],
};

/** Solvi, l'assistant de Solvéa : on lui pose une question, il répond d'après le planning ou d'après ses fiches, et il y emmène. */
export function Assistant({ espace, prenom, personId }: { espace: Espace; prenom: string; personId: string }): JSX.Element | null {
  const { assistant, ouvrirAssistant, vue, parcours, tour, assistantEnVisite, ouvrirTutoriels } = useUi();
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const [question, setQuestion] = useState('');
  const [fil, setFil] = useState<Bulle[]>([]);
  const [reflexion, setReflexion] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const bas = useRef<HTMLDivElement>(null);
  const compteur = useRef(0);
  // Ce que Solvi retient d'une question à l'autre : « et demain ? », « oui », « et Karim ? ».
  const memoire = useRef<Memoire | undefined>(undefined);

  const fiches = useMemo(() => fichesPour(espace, estCollaboratif(data.officine)), [espace, data.officine]);
  // Les suggestions du début : l'écran en cours d'abord, puis les questions qui se lisent dans le planning.
  const amorces = useMemo(() => [...new Set([...fiches.filter((f) => f.ecrans?.includes(vue)).slice(0, 2).map((f) => f.question), ...AMORCES[espace]])].slice(0, 6), [fiches, vue, espace]);

  useEffect(() => {
    if (!assistant) return;
    champ.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        ouvrirAssistant(false);
        bouton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assistant, ouvrirAssistant]);
  useEffect(() => {
    bas.current?.scrollIntoView({ block: 'end' });
  }, [fil, reflexion]);
  // Une autre personne se connecte : la conversation repart de zéro.
  useEffect(() => {
    setFil([]);
    memoire.current = undefined;
  }, [personId]);

  const demander = (texte: string): void => {
    const q = texte.trim();
    if (!q) return;
    setQuestion('');
    setFil((f) => f.concat({ id: ++compteur.current, de: 'moi', texte: q }));
    setReflexion(true);
    const reponse = repondre(q, { data, today, moi: personId, espace, fiches, memoire: memoire.current });
    memoire.current = reponse.memoire;
    window.setTimeout(() => {
      setFil((f) => f.concat({ id: ++compteur.current, de: 'bot', texte: reponse.texte, reponse }));
      setReflexion(false);
    }, 380);
  };

  // Pendant un tutoriel, la place est à la visite : le bouton ne s'affiche que si l'étape le présente.
  // Solvi réfléchit pendant qu'il cherche, s'interroge quand il n'a pas compris, sourit quand il a répondu.
  const derniere = [...fil].reverse().find((b) => b.de !== 'moi');
  const humeurBot: Humeur = reflexion ? 'reflechi' : !derniere ? 'heureux' : (derniere.reponse?.humeur ?? 'content');
  const support = data.officine.support;
  const courriel = support?.email?.trim();
  const telephone = support?.telephone?.trim();
  if (tour !== null || (parcours !== null && !assistant && !assistantEnVisite)) return null;
  return (
    <div className="assistant no-print">
      {assistant ? (
        <section className="aide-panneau" role="dialog" aria-label="Solvi, votre assistant">
          <div className="aide-tete">
            <span className="aide-logo" aria-hidden="true">
              <Solvi size={52} humeur={humeurBot} vivant />
            </span>
            <div className="grow">
              <h2>
                <NomSolvi />
              </h2>
              <p>Votre assistant. Posez votre question.</p>
            </div>
            <button type="button" className="dialog-fermer" onClick={() => ouvrirAssistant(false)} aria-label="Fermer l’assistant">
              <X size={18} />
            </button>
          </div>
          <div className="aide-fil" role="log" aria-live="polite" aria-label="Conversation">
            <div className="aide-bulle bot">
              <p>Bonjour {prenom}. Que voulez-vous savoir ?</p>
            </div>
            {!fil.length ? (
              <div className="aide-puces">
                {amorces.map((a) => (
                  <button key={a} type="button" className="aide-puce" onClick={() => demander(a)}>
                    {a}
                  </button>
                ))}
              </div>
            ) : null}
            {fil.map((b) =>
              b.de === 'moi' ? (
                <div key={b.id} className="aide-bulle moi">
                  <p>{b.texte}</p>
                </div>
              ) : (
                <div key={b.id} className="aide-bulle bot">
                  <p>{b.texte}</p>
                  {b.reponse?.lignes?.length ? (
                    <ul>
                      {b.reponse.lignes.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  ) : null}
                  {b.reponse?.bouton ? (
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={() => {
                        b.reponse?.bouton?.aller(useUi.getState(), espace);
                        ouvrirAssistant(false);
                      }}
                    >
                      {b.reponse.bouton.label} <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                  {b.reponse?.support ? (
                    <div className="aide-support">
                      {courriel ? (
                        <a className="btn sm" href={`mailto:${courriel}`}>
                          <Mail size={14} aria-hidden="true" /> Écrire {support?.nom?.trim() ? `à ${support.nom.trim()}` : 'au support'}
                        </a>
                      ) : null}
                      {telephone ? (
                        <a className="btn sm" href={`tel:${telephone.replace(/[^+\d]/g, '')}`}>
                          <Phone size={14} aria-hidden="true" /> {telephone}
                        </a>
                      ) : null}
                      {!courriel && !telephone && espace !== 'responsable' ? (
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => {
                            useUi.getState().aller('messages');
                            ouvrirAssistant(false);
                          }}
                        >
                          <MessageSquare size={14} aria-hidden="true" /> Écrire à mon titulaire
                        </button>
                      ) : null}
                      {!courriel && !telephone && espace === 'responsable' ? (
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => {
                            useUi.getState().aller('officine');
                            ouvrirAssistant(false);
                            window.setTimeout(() => document.querySelector('[data-focus="support"]')?.scrollIntoView({ block: 'center' }), 80);
                          }}
                        >
                          <LifeBuoy size={14} aria-hidden="true" /> Indiquer un contact de support
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {b.reponse?.suites?.length ? (
                    <div className="aide-puces">
                      {b.reponse.suites.map((s) => (
                        <button key={s} type="button" className="aide-puce" onClick={() => demander(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ),
            )}
            {reflexion ? (
              <div className="aide-bulle bot attente" aria-label="Solvi cherche">
                <i />
                <i />
                <i />
              </div>
            ) : null}
            <div ref={bas} />
          </div>
          <form
            className="aide-saisie"
            onSubmit={(e) => {
              e.preventDefault();
              demander(question);
            }}
          >
            <label className="sr" htmlFor="aide-question">
              Votre question
            </label>
            <input ref={champ} id="aide-question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Votre question, avec vos mots" autoComplete="off" />
            <button type="submit" className="aide-envoyer" disabled={!question.trim()} aria-label="Envoyer la question">
              <SendHorizontal size={18} aria-hidden="true" />
            </button>
          </form>
          <div className="aide-pied">
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                ouvrirAssistant(false);
                ouvrirTutoriels(true);
              }}
            >
              <GraduationCap size={15} aria-hidden="true" /> Visites guidées
            </button>
            <span className="tiny muted">Réponses calculées sur cet appareil.</span>
          </div>
        </section>
      ) : null}
      <button ref={bouton} type="button" className={`aide-fab${assistant ? ' on' : ''}`} onClick={() => ouvrirAssistant(!assistant)} aria-expanded={assistant} data-focus="assistant" title="Solvi, votre assistant">
        <Solvi size={54} humeur={assistant ? humeurBot : 'neutre'} />
        <span className="aide-mot">Aide</span>
        <span className="sr">, Solvi, votre assistant</span>
      </button>
    </div>
  );
}
