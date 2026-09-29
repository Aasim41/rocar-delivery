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
import { registerPushNotifications, initPushNotificationListeners } from './lib/pushNotifications';
import { Loader2 } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

function AppRoutes() {
  const location = useLocation();
  const [session, setSession] = useState<any>(null);
  const [_userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    return localStorage.getItem('demo_mode') === 'buyer' || localStorage.getItem('has_seen_onboarding') === 'true';
  });

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) {
        fetchUserProfile(currentSession.user.id, currentSession);
        initPushNotificationListeners();
        registerPushNotifications();
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        fetchUserProfile(currentSession.user.id, currentSession);
        initPushNotificationListeners();
        registerPushNotifications();
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    // Handle Deep Link for Google OAuth in Native APK
    import('@capacitor/app').then(({ App: CapacitorApp }) => {
      CapacitorApp.addListener('appUrlOpen', async (event) => {
        if (event.url.includes('#access_token=')) {
          // Close the Capacitor Browser overlay that we opened for OAuth
          import('@capacitor/browser').then(({ Browser }) => {
            Browser.close().catch(() => {});
          });
          
          const url = new URL(event.url);
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
          }
        }
      });
    }).catch(() => {});

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string, currentSession: any) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        const roleToInsert = currentSession?.user?.user_metadata?.role || 'buyer';
        const nameToInsert = localStorage.getItem('onboarding_name') || '';
        const ageStr = localStorage.getItem('onboarding_age');
        const ageToInsert = ageStr ? parseInt(ageStr, 10) : null;
        
        const { data: newData, error: insertError } = await supabase
          .from('users')
          .insert([{ 
            id: userId, 
            role: roleToInsert,
            name: nameToInsert,
            age: ageToInsert
          }])
          .select('role')
          .single();
        
        if (!insertError && newData) {
          setUserRole(newData.role || roleToInsert);
        } else {
          if (insertError) {
             toast.error(`Database Insert Error: ${insertError.message} (Code: ${insertError.code})`);
             console.error("Insert error:", insertError);
          }
          setUserRole(roleToInsert);
        }
      } else if (data) {
        setUserRole(data.role || 'buyer');
        
        const nameToInsert = localStorage.getItem('onboarding_name');
        const ageStr = localStorage.getItem('onboarding_age');
        
        if (nameToInsert || ageStr) {
           const updates: any = {};
           if (nameToInsert) updates.name = nameToInsert;
           if (ageStr) updates.age = parseInt(ageStr, 10);
           
           if (Object.keys(updates).length > 0) {
              const { error: updateError } = await supabase.from('users').update(updates).eq('id', userId);
              if (updateError) {
                toast.error(`Database Update Error: ${updateError.message} (Code: ${updateError.code})`);
                console.error("Update error:", updateError);
              } else {
                localStorage.removeItem('onboarding_name');
                localStorage.removeItem('onboarding_age');
              }
           }
        }
      } else {
        setUserRole('buyer');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
      </div>
    );
  }

  if (!hasSeenOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (hasSeenOnboarding && !session && location.pathname !== '/login' && location.pathname !== '/onboarding') {
    return <Navigate to="/login" replace />;
  }

  if (session && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/onboarding" element={<Onboarding onComplete={() => setHasSeenOnboarding(true)} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/send" element={<SendPackage />} />
          <Route path="/fetch" element={<FetchPackage />} />
          <Route path="/tracking/:id" element={<OrderTracking />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/orders" element={<OrderHistory />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-[var(--bg-page)] font-sans">
        <main className="flex-1 overflow-x-hidden">
          <AppRoutes />
        </main>
        <Toaster position="top-center" reverseOrder={false} />
      </div>
    </BrowserRouter>
  );
}

export default App;
