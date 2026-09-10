import { consumeImportFragment } from './domain/chatgpt';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';
const initialImport = consumeImportFragment(window);
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App initialImport={initialImport} /></ErrorBoundary></StrictMode>);
