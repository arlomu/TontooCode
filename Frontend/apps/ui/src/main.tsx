import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Bundled fonts — the app must work offline inside Electron.
import '@fontsource-variable/public-sans';
import '@fontsource-variable/archivo';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';

import './index.css';
import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
