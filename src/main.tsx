import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './ui/styles.css';

// La langue de la page est déclarée même quand l'hébergeur fournit son propre squelette HTML.
document.documentElement.lang = 'fr';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
