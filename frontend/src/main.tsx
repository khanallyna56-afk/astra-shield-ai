import CssBaseline from '@mui/material/CssBaseline';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { LiveProvider } from './api/live';
import './index.css';
import { theme } from './theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 10_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <LiveProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </LiveProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  </StrictMode>,
);
