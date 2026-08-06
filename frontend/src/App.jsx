import { Landmark, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import AuthScreen from './AuthScreen';
import Dashboard from './Dashboard';

function Shell() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="bg-gradient-to-br from-brand-600 to-mint-600 text-white p-3 rounded-2xl animate-logo-pulse">
            <Landmark className="w-6 h-6" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
