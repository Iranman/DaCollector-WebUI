import { ReactNode } from 'react';
import { ConfirmProvider } from './ui/ConfirmProvider';
import { ToastProvider } from './ui/ToastProvider';
import { LiveStateProvider } from '../lib/liveState';

interface AppProvidersProps {
  children: ReactNode;
  liveStateEnabled: boolean;
}

export default function AppProviders({ children, liveStateEnabled }: AppProvidersProps) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <LiveStateProvider enabled={liveStateEnabled}>
          {children}
        </LiveStateProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
