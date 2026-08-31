import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DebugFetchPage } from './components/DebugFetchPage';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{window.location.hash === '#/debug' ? <DebugFetchPage /> : <App />}</StrictMode>,
);
