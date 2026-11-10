import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { LanguageProvider } from './i18n/Language.tsx';
import './styles.css';
import './base-theme.css';
import './fifths-time.css';
import './workspace-redesign.css';
import './orbital-language.css';
import './bright-theme.css';
import './transitions.css';
import './touch-companion.css';
import './session.css';
import './playlist-score.css';
import './note-colors.css';

createRoot(document.getElementById('root')!).render(<StrictMode><LanguageProvider><App/></LanguageProvider></StrictMode>);
