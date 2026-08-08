import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { ParcelPickup } from './pages/ParcelPickup';
import { Marketplace } from './pages/Marketplace';
import { OrderTracking } from './pages/OrderTracking';
import { Login } from './pages/Login';
import { ShopPortal } from './pages/ShopPortal';
import { Profile } from './pages/Profile';
import { Navigation } from './components/Navigation';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const location = useLocation();
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<'buyer' | 'shop_owner' | null>(null);
  const [loading, setLoading] = useState(true);

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    // Initialize theme from local storage
    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) fetchUserProfile(currentSession.user.id, currentSession);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        fetchUserProfile(currentSession.user.id, currentSession);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

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
        // User record doesn't exist yet, this is a new signup
        // Create profile using the role passed during signup (default to buyer if missing)
        const roleToInsert = currentSession?.user?.user_metadata?.role || 'buyer';
        const nameToInsert = localStorage.getItem('onboarding_name') || '';
        const ageStr = localStorage.getItem('onboarding_age');
        const ageToInsert = ageStr ? parseInt(ageStr, 10) : null;
        const addressToInsert = localStorage.getItem('onboarding_address');
        const initialLocations = addressToInsert ? [{ name: addressToInsert }] : [];
        
        const { data: newData, error: insertError } = await supabase
          .from('users')
          .insert([{ 
            id: userId, 
            role: roleToInsert,
            name: nameToInsert,
            age: ageToInsert,
            saved_locations: initialLocations
          }])
          .select('role')
          .single();
        
        if (!insertError && newData) {
          setUserRole(newData.role || roleToInsert);
        } else {
          if (insertError) {
             alert(`Database Insert Error: ${insertError.message} (Code: ${insertError.code})`);
             console.error("Insert error:", insertError);
          }
          // If insert fails, fallback to the role they signed up with so they see the right UI
          setUserRole(roleToInsert);
        }
      } else if (data) {
        setUserRole(data.role || 'buyer');
        
        // If we just finished onboarding and have data in local storage, sync it to the existing profile
        const nameToInsert = localStorage.getItem('onboarding_name');
        const ageStr = localStorage.getItem('onboarding_age');
        const addressToInsert = localStorage.getItem('onboarding_address');
        
        if (nameToInsert || ageStr || addressToInsert) {
           const updates: any = {};
           if (nameToInsert) updates.name = nameToInsert;
           if (ageStr) updates.age = parseInt(ageStr, 10);
           if (addressToInsert) {
              // Fetch full profile to get current locations
              const { data: fullProfile } = await supabase.from('users').select('saved_locations').eq('id', userId).single();
              const currentLocations = (fullProfile && fullProfile.saved_locations) ? fullProfile.saved_locations : [];
              if (!currentLocations.some((loc: any) => loc.name === addressToInsert)) {
                  updates.saved_locations = [...currentLocations, { name: addressToInsert }];
              }
           }
           
           if (Object.keys(updates).length > 0) {
              const { error: updateError } = await supabase.from('users').update(updates).eq('id', userId);
              if (updateError) {
                alert(`Database Update Error: ${updateError.message} (Code: ${updateError.code})`);
                console.error("Update error:", updateError);
              } else {
                localStorage.removeItem('onboarding_name');
                localStorage.removeItem('onboarding_age');
                localStorage.removeItem('onboarding_address');
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

  // Shop owners are forced to the shop portal
  if (userRole === 'shop_owner' && location.pathname !== '/shop-portal') {
    return <Navigate to="/shop-portal" replace />;
  }

  // Buyers are forced out of shop portal
  if (userRole === 'buyer' && location.pathname === '/shop-portal') {
    return <Navigate to="/" replace />;
  }

  // If they are on login but already logged in, redirect them out
  if (session && location.pathname === '/login') {
    return <Navigate to={userRole === 'shop_owner' ? '/shop-portal' : '/'} replace />;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/onboarding" element={<Onboarding onComplete={() => setHasSeenOnboarding(true)} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/shop-portal" element={<ShopPortal />} />
          <Route path="/" element={<Home />} />
          <Route path="/parcel-pickup" element={<ParcelPickup />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/tracking/:id" element={<OrderTracking />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </AnimatePresence>

      {/* Navigation only shown for buyers outside of onboarding/login */}
      {userRole === 'buyer' && location.pathname !== '/onboarding' && location.pathname !== '/login' && <Navigation />}
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
      </div>
    </BrowserRouter>
  );
}

export default App;
