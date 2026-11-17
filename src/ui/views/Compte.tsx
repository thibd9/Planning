import { Check, CircleHelp, KeyRound, LogOut, Palette, Type, UserRound } from 'lucide-react';
import { useState } from 'react';
import { ESPACE_LABEL, empreinte, espaceDe, estResponsable, responsable } from '../../domain/acces';
import { QUALIFICATION_LABEL, nomComplet, nomCourt } from '../../domain/types';
import { useStore } from '../../store/store';
import type { Theme } from '../../store/ui';
import { prefsDe, useUi } from '../../store/ui';
import { EtiquetteRole } from '../icons';
import { Avatar, Pill } from '../kit';

const THEMES: { cle: Theme; nom: string; couleur: string }[] = [
  { cle: 'vert', nom: 'Vert sauge', couleur: 'linear-gradient(135deg, #0b5d3f, #157a55)' },
  { cle: 'bleu', nom: 'Bleu océan', couleur: 'linear-gradient(135deg, #1d4f91, #2b68b5)' },
  { cle: 'violet', nom: 'Violet iris', couleur: 'linear-gradient(135deg, #4b3aa8, #6252c9)' },
  { cle: 'corail', nom: 'Terre cuite', couleur: 'linear-gradient(135deg, #9c3a1c, #b9502d)' },
  { cle: 'ardoise', nom: 'Ardoise', couleur: 'linear-gradient(135deg, #2f4858, #446579)' },
];

/** Mon compte : profil, apparence, code d'accès, déconnexion. Accessible à tous les rôles. */
export function Compte({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const majPersonne = useStore((s) => s.majPersonne);
  const { preferences, setPreferences, deconnecter, dire, setTour, aller } = useUi();
  const person = data.personnes.find((p) => p.id === personId);
  const prefs = prefsDe(preferences, personId);
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [erreurCode, setErreurCode] = useState('');
  if (!person) return <p>Profil introuvable.</p>;
  const espace = espaceDe(data, person);
  const chef = responsable(data);

  const enregistrerCode = async (retirer: boolean): Promise<void> => {
    if (person.code && (await empreinte(actuel)) !== person.code) return setErreurCode('Le code actuel ne correspond pas.');
    if (!retirer && !/^\d{4,8}$/.test(nouveau)) return setErreurCode('Le nouveau code doit compter 4 à 8 chiffres.');
    majPersonne({ ...person, code: retirer ? undefined : await empreinte(nouveau) });
    setActuel('');
    setNouveau('');
    setErreurCode('');
    dire(retirer ? 'Code d’accès retiré.' : 'Code d’accès enregistré.');
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-head">
        <span className="page-ico c-gris" aria-hidden="true">
          <UserRound size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Mon compte</div>
          <h1>
            Mes <span className="hl">paramètres</span>
          </h1>
        </div>
      </div>

      <div className="col" style={{ gap: 18 }}>
        <section className="card pad row wrap" aria-labelledby="c-profil">
          <Avatar person={person} lg />
          <div className="grow">
            <h2 id="c-profil" style={{ fontSize: 19 }}>{nomComplet(person)}</h2>
            <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
              <EtiquetteRole person={person} />
              <Pill>{ESPACE_LABEL[espace]}</Pill>
              {estResponsable(data, person) ? <Pill tone="miel">Responsable de l’officine</Pill> : person.gestion ? <Pill tone="iris">Accès gestion accordé</Pill> : null}
            </div>
            <p className="small soft" style={{ marginTop: 8 }}>
              {QUALIFICATION_LABEL[person.qualification]} · {person.salarie ? `${person.heuresHebdo} h par semaine` : 'non salarié'} · {data.officine.nom}
              {!estResponsable(data, person) && espace !== 'responsable' && chef ? ` · Seul ${nomCourt(chef)} peut vous donner l’accès à la gestion.` : ''}
            </p>
          </div>
          <button type="button" className="btn" onClick={deconnecter}>
            <LogOut size={16} aria-hidden="true" /> Se déconnecter
          </button>
        </section>

        <section className="card" aria-labelledby="c-apparence">
          <div className="card-head">
            <span className="ico" aria-hidden="true">
              <Palette size={18} />
            </span>
            <div>
              <h2 id="c-apparence" className="h3">Apparence</h2>
              <div className="small soft">Vos réglages ne changent que votre espace.</div>
            </div>
          </div>
          <div className="card-body col" style={{ gap: 20 }}>
            <fieldset>
              <legend className="field" style={{ marginBottom: 8 }}>Couleur du thème</legend>
              <div className="choix">
                {THEMES.map((t) => (
                  <label key={t.cle} htmlFor={`theme-${t.cle}`}>
                    <input id={`theme-${t.cle}`} type="radio" name="theme" checked={prefs.theme === t.cle} onChange={() => setPreferences(personId, { theme: t.cle })} />
                    <span className="pastille" style={{ background: t.couleur }} aria-hidden="true" />
                    {t.nom}
                    <Check size={16} className="coche" aria-hidden="true" />
                  </label>
                ))}
              </div>
              <p className="tiny muted" style={{ marginTop: 8 }}>Chaque couleur a été vérifiée pour rester lisible (contraste d’au moins 4,5:1 sur le texte).</p>
            </fieldset>
            <fieldset>
              <legend className="field" style={{ marginBottom: 8 }}>
                <span className="row" style={{ gap: 6 }}>
                  <Type size={15} aria-hidden="true" /> Taille du texte
                </span>
              </legend>
              <div className="choix" style={{ maxWidth: 420 }}>
                {(['normal', 'grand'] as const).map((t) => (
                  <label key={t} htmlFor={`texte-${t}`}>
                    <input id={`texte-${t}`} type="radio" name="texte" checked={prefs.texte === t} onChange={() => setPreferences(personId, { texte: t })} />
                    <span style={{ fontSize: t === 'grand' ? 17 : 14 }}>{t === 'grand' ? 'Grand' : 'Normal'}</span>
                    <Check size={16} className="coche" aria-hidden="true" />
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="card" aria-labelledby="c-code">
          <div className="card-head">
            <span className="ico sun" aria-hidden="true">
              <KeyRound size={18} />
            </span>
            <div className="grow">
              <h2 id="c-code" className="h3">Code d’accès</h2>
              <div className="small soft">{person.code ? 'Un code protège votre profil à la connexion.' : 'Aucun code : votre profil s’ouvre d’un clic.'}</div>
            </div>
            {person.code ? <Pill tone="ok">Activé</Pill> : <Pill>Non défini</Pill>}
          </div>
          <form
            className="card-body col"
            onSubmit={(e) => {
              e.preventDefault();
              void enregistrerCode(false);
            }}
          >
            <div className="row wrap" style={{ alignItems: 'flex-end' }}>
              {person.code ? (
                <label className="field" htmlFor="code-actuel">
                  Code actuel
                  <input id="code-actuel" type="password" inputMode="numeric" autoComplete="current-password" value={actuel} onChange={(e) => setActuel(e.target.value)} style={{ width: 170 }} />
                </label>
              ) : null}
              <label className="field" htmlFor="code-nouveau">
                {person.code ? 'Nouveau code' : 'Choisir un code'}
                <input id="code-nouveau" type="password" inputMode="numeric" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} aria-describedby="code-aide" style={{ width: 170 }} />
              </label>
              <button type="submit" className="btn primary" disabled={!nouveau}>
                Enregistrer le code
              </button>
              {person.code ? (
                <button type="button" className="btn danger" onClick={() => void enregistrerCode(true)}>
                  Retirer le code
                </button>
              ) : null}
            </div>
            <p className="tiny muted" id="code-aide">4 à 8 chiffres. Seule une empreinte du code est conservée, sur cet appareil.</p>
            {erreurCode ? (
              <p className="erreur" role="alert">
                {erreurCode}
              </p>
            ) : null}
          </form>
        </section>

        {espace === 'responsable' ? (
          <section className="card pad row wrap">
            <span className="ico sky" aria-hidden="true">
              <CircleHelp size={18} />
            </span>
            <div className="grow">
              <h2 className="h3">Tutoriel</h2>
              <p className="small soft">Dix étapes pour retrouver chaque espace de gestion.</p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                aller('resoudre');
                setTour(0);
              }}
            >
              Relancer le tutoriel
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
