import type { Etape, OutilsVisite } from '../Parcours';

/**
 * « Écran par écran » : le quotidien du titulaire, champ par champ. Un chapitre par écran ; dans chaque étape, Solvi
 * montre chaque champ (geste « expliquer ») : ce qu'on y met, à quoi il sert, avec un exemple quand c'est utile.
 */
export function ecransSuivre(o: OutilsVisite): Etape[] {
  o.buts({ 'Construire': 'La grille de la semaine et la fenêtre d’un poste, champ par champ.' });
  return [
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'La fenêtre d’un poste',
      texte: () => 'Un « + » ouvre la fenêtre d’un poste. Voici ce que contient chacun de ses champs.',
      jouer: () => {
        o.avecPlanning();
        o.semaineUne();
      },
      gestes: [
        { faire: 'cliquer', sur: '.plan-grid .add', dit: 'Cliquez sur le « + » d’une case', sert: 'Il ouvre un poste pour cette personne, ce jour-là.' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'expliquer', sur: o.parLibelle('Début', '.dialog'), quoi: 'l’heure d’arrivée de la personne.', sert: 'Le poste commence à cette heure ; un poste type la remplit tout seul.', exemple: '8 h 30' },
        { faire: 'expliquer', sur: o.parLibelle('Fin', '.dialog'), quoi: 'l’heure de départ.', sert: 'Elle doit suivre l’heure de début. La durée de travail s’affiche en bas de la fenêtre.', exemple: '16 h 30' },
      ],
    },
  ];
}
