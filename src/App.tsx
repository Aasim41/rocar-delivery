import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { SendPackage } from './pages/SendPackage';
import { FetchPackage } from './pages/FetchPackage';
import { OrderTracking } from './pages/OrderTracking';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { OrderHistory } from './pages/OrderHistory';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { registerPushNotifications, initPushNotificationListeners } from './lib/pushNotifications';

function AppRoutes() {
  const location = useLocation();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    return localStorage.getItem('hasSeenOnboarding') === 'true';
  });

  useEffect(() => {
    // Initialize push notifications listeners on native devices
    initPushNotificationListeners();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        ensureUserProfile(session.user);
        registerPushNotifications();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          ensureUserProfile(session.user);
          registerPushNotifications();
        }
        setLoading(false);
      }
    );

    // Deep linking for Google OAuth login
    CapacitorApp.addListener('appUrlOpen', async (event: any) => {
      const url = event.url;
      if (url.includes('rocar://login')) {
        const hash = url.split('#')[1];
        if (hash) {
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
            await Browser.close();
          }
        }
      }
    }).catch(() => {});

    return () => subscription.unsubscribe();
  }, []);

  const ensureUserProfile = async (user: any) => {
    try {
      const { data, error } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
      
      if (!data && !error) {
        // User doesn't exist in public.users yet, create them
        const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        const { error: insertError } = await supabase.from('users').insert([{ 
          id: user.id, 
          name: name,
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url
        }]);
        if (insertError) {
          console.error("Failed to insert user profile:", insertError);
          toast.error("Error creating user profile");
        }
      }
    } catch (err) {
      console.error("Error ensuring user profile:", err);
    }
  };

  const onOnboardingComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setHasSeenOnboarding(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  // Auth routing logic
  if (!session) {
    if (!hasSeenOnboarding && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
    if (hasSeenOnboarding && location.pathname !== '/login') {
      return <Navigate to="/login" replace />;
    }
  } else {
    // If logged in, block access to auth routes
    if (location.pathname === '/login' || location.pathname === '/onboarding') {
      return <Navigate to="/" replace />;
    }
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/onboarding" element={<Onboarding onComplete={onOnboardingComplete} />} />
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/send" element={<SendPackage />} />
        <Route path="/fetch" element={<FetchPackage />} />
        <Route path="/tracking/:id" element={<OrderTracking />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/orders" element={<OrderHistory />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{ 
        style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' }
      }} />
      <AppRoutes />
    </BrowserRouter>
  );
}
