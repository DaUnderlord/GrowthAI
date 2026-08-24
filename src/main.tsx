import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { bootstrapSupabaseConfig } from './lib/supabase';
import './index.css';

async function startApp() {
  await bootstrapSupabaseConfig();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void startApp();
