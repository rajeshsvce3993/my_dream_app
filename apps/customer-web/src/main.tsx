import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { LocaleProvider } from './context/LocaleContext';
import { LocationProvider } from './context/LocationContext';
import './styles.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <LocationProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </LocationProvider>
      </LocaleProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
