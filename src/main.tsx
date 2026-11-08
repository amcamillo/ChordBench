import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import './styles.css';
import './base-theme.css';
import './fifths-time.css';
import './workspace-redesign.css';
import './orbital-language.css';
import './bright-theme.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
