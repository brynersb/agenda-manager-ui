import '@fontsource-variable/public-sans';
import '@fontsource-variable/schibsted-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './index.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AuthProvider } from '@/auth/auth-provider';
import { applyUiTheme, readAppearance } from '@/hooks/use-preferences';
import { queryClient } from '@/lib/query-client';
import { App } from './App';

// O tema vai para o <html> antes do primeiro render, para não piscar o outro.
applyUiTheme(readAppearance().uiTheme);

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado.');

createRoot(root).render(
  <AuthProvider>
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  </AuthProvider>,
);
