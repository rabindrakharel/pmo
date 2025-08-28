import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import App from './App.tsx';
import './index.css';

// Initialize auth state on app load
const AuthInitializer = () => {
  const { refreshUser } = useAuthStore();
  
  React.useEffect(() => {
    // Check for existing authentication on app start
    refreshUser();
  }, [refreshUser]);

  return null;
};

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      <App />
      <Toaster 
        position="top-right" 
        expand={false}
        richColors
        closeButton
      />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </BrowserRouter>
);