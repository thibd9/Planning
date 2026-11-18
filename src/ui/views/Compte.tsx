import { Check, CircleHelp, KeyRound, LogOut, Moon, Palette, Type, UserRound } from 'lucide-react';
import { useState } from 'react';
import { ESPACE_LABEL, empreinte, espaceDe, estResponsable, libelleRole, responsable } from '../../domain/acces';
import { nomComplet, nomCourt } from '../../domain/types';
import { useStore } from '../../store/store';
import type { Mode, Theme } from '../../store/ui';
import { prefsDe, themeDuProfil, useUi } from '../../store/ui';
import { EtiquetteRole } from '../icons';
import { Avatar, MotDePasse, Pill } from '../kit';

// Chaque thème tient en deux couleurs ; les mêmes que dans la feuille de style.
const THEMES: { cle: Theme; nom: string; a: string; b: string }[] = [
  { cle: 'ciel', nom: 'Bleu ciel', a: '#1f6bb8', b: '#2474c4' },
  { cle: 'bleu', nom: 'Bleu marine', a: '#1b4f7f', b: '#2a6aa3' },
  { cle: 'indigo', nom: 'Indigo', a: '#3730a3', b: '#4338ca' },
  { cle: 'solvea', nom: 'Violet', a: '#5213dd', b: '#7a1cf5' },
  { cle: 'rose', nom: 'Framboise', a: '#a61e5c', b: '#bf2a6e' },
  { cle: 'corail', nom: 'Terracotta', a: '#a6401f', b: '#b84a26' },
  { cle: 'ambre', nom: 'Ambre', a: '#8a5a00', b: '#9a6500' },
  { cle: 'emeraude', nom: 'Émeraude', a: '#17694a', b: '#1e7d59' },
  { cle: 'sarcelle', nom: 'Bleu-vert', a: '#0a5a63', b: '#127680' },
  { cle: 'ardoise', nom: 'Ardoise', a: '#2f4858', b: '#446579' },
];
const MODES: { cle: Mode; nom: string }[] = [
  { cle: 'clair', nom: 'Clair' },
  { cle: 'sombre', nom: 'Sombre' },
  { cle: 'auto', nom: 'Comme l’appareil' },
];

/** Mon compte : profil, apparence, code d'accès, déconnexion. Accessible à tous les rôles. */
export function Compte({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const definirMotDePasse = useStore((s) => s.definirMotDePasse);
  const { preferences, setPreferences, deconnecter, dire, setTour, aller } = useUi();
  const person = data.personnes.find((p) => p.id === personId);
  const cle = person?.identifiant ?? personId;
  const couleurProfil = themeDuProfil(data, person);
  const prefs = prefsDe(preferences, cle, couleurProfil);
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [erreurCode, setErreurCode] = useState('');
  if (!person) return <p>Profil introuvable.</p>;
  const espace = espaceDe(data, person);
  const chef = responsable(data);

  const enregistrerCode = (): void => {
    if (person.code && empreinte(actuel) !== person.code) return setErreurCode('Le mot de passe actuel ne correspond pas.');
    if (nouveau.length < 6) return setErreurCode('Le nouveau mot de passe doit compter au moins 6 caractères.');
    definirMotDePasse(person.identifiant ?? '', empreinte(nouveau));
    setActuel('');
    setNouveau('');
    setErreurCode('');
    dire('Mot de passe enregistré.');
  };

  return (
    <div className="page page-compte">
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
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
              {!estResponsable(data, person) && person.gestion ? <Pill tone="iris">Accès gestion accordé</Pill> : null}
            </div>
            <p className="small soft" style={{ marginTop: 8 }}>
              {libelleRole(data, person)} · {person.salarie ? `${person.heuresHebdo} h par semaine` : 'non salarié'} · {data.officine.nom}
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
              <legend className="field" style={{ marginBottom: 8 }}>
                <span className="row" style={{ gap: 6 }}>
                  <Moon size={15} aria-hidden="true" /> Mode
                </span>
              </legend>
              <div className="choix" style={{ maxWidth: 560 }}>
                {MODES.map((m) => (
                  <label key={m.cle} htmlFor={`mode-${m.cle}`}>
                    <input id={`mode-${m.cle}`} type="radio" name="mode" checked={prefs.mode === m.cle} onChange={() => setPreferences(cle, { mode: m.cle })} />
                    {m.nom}
                    <Check size={16} className="coche" aria-hidden="true" />
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="field" style={{ marginBottom: 8 }}>Couleur du thème</legend>
              <div className="choix themes">
                {THEMES.map((t) => (
                  <label key={t.cle} htmlFor={`theme-${t.cle}`}>
                    <input id={`theme-${t.cle}`} type="radio" name="theme" checked={prefs.theme === t.cle} onChange={() => setPreferences(cle, { theme: t.cle })} />
                    <span className="pastille" style={{ background: `linear-gradient(135deg, ${t.a}, ${t.b})` }} aria-hidden="true" />
                    {t.nom}
                    {t.cle === couleurProfil ? <span className="tiny soft theme-profil">votre profil</span> : null}
                    <Check size={16} className="coche" aria-hidden="true" />
                  </label>
                ))}
              </div>
              <p className="tiny muted" style={{ marginTop: 8 }}>Chaque profil a sa couleur de base : on reconnaît d’un coup d’œil l’espace où l’on se trouve. Vous pouvez en choisir une autre. Le logo, les boutons et les bannières la suivent, en clair comme en sombre.</p>
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
                    <input id={`texte-${t}`} type="radio" name="texte" checked={prefs.texte === t} onChange={() => setPreferences(cle, { texte: t })} />
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
            <span className="ico" aria-hidden="true">
              <KeyRound size={18} />
            </span>
            <div className="grow">
              <h2 id="c-code" className="h3">Connexion</h2>
              <div className="small soft">
                Identifiant : <b>{person.identifiant}</b>
              </div>
            </div>
            {person.provisoire ? <Pill tone="warn">Mot de passe provisoire</Pill> : <Pill tone="ok">Mot de passe personnel</Pill>}
          </div>
          <form
            className="card-body col"
            onSubmit={(e) => {
              e.preventDefault();
              enregistrerCode();
            }}
          >
            <div className="row wrap" style={{ alignItems: 'flex-end' }}>
              <label className="field" htmlFor="code-actuel">
                Mot de passe actuel
                <MotDePasse id="code-actuel" autoComplete="current-password" value={actuel} onChange={(e) => setActuel(e.target.value)} style={{ width: 200 }} />
              </label>
              <label className="field" htmlFor="code-nouveau">
                Nouveau mot de passe
                <MotDePasse id="code-nouveau" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} aria-describedby="code-aide" style={{ width: 200 }} />
              </label>
              <button type="submit" className="btn primary" disabled={!nouveau || !actuel}>
                Changer le mot de passe
              </button>
            </div>
            <p className="tiny muted" id="code-aide">Au moins 6 caractères. Seule une empreinte est conservée, sur cet appareil.</p>
            {erreurCode ? (
              <p className="erreur" role="alert">
                {erreurCode}
              </p>
            ) : null}
            {estResponsable(data, person) && data.officine.secours ? (
              <p className="notice small">
                <KeyRound size={16} aria-hidden="true" />
                <span>
                  Clé de secours : <b style={{ letterSpacing: '0.08em' }}>{data.officine.secours}</b>. Notez-la : elle seule permet de redéfinir votre mot de passe si vous l’oubliez.
                </span>
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
                aller('tableau');
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
