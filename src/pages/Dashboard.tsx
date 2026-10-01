import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { 
  User, Clock, Send, ArrowDownToLine, Package, Home,
  ChevronRight, MapPin, Zap
} from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchData(user.id);
      }
    };
    fetchUser();
  }, []);

  const fetchData = async (uid: string) => {
    const { data: activeData } = await supabase
      .from('deliveries')
      .select('*')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    setActiveDelivery(activeData || null);

    const { data: recentData } = await supabase
      .from('deliveries')
      .select('*')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentDeliveries(recentData || []);
  };

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('deliveries-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `sender_id=eq.${userId}` }, () => fetchData(userId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `receiver_id=eq.${userId}` }, () => fetchData(userId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 pb-24 font-sans">
      {/* Header */}
      <header className="px-5 pt-14 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">RoCAR</h1>
          <p className="text-[11px] text-zinc-500 font-medium tracking-[0.2em] uppercase mt-0.5">Campus Logistics</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/orders')} className="w-10 h-10 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center hover:border-zinc-600 transition-colors">
            <Clock className="w-4 h-4 text-zinc-400" />
          </button>
          <button onClick={() => navigate('/profile')} className="w-10 h-10 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center hover:border-zinc-600 transition-colors">
            <User className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </header>

      <motion.main variants={stagger} initial="hidden" animate="show" className="px-5 space-y-5 max-w-md mx-auto">
        
        {/* Active Delivery Banner */}
        <AnimatePresence>
          {activeDelivery && (
            <motion.div 
              variants={fadeUp}
              initial="hidden" animate="show" exit="hidden"
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => navigate(`/tracking/${activeDelivery.id}`)}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-[0.15em] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Active Delivery
                </span>
                <span className="text-[11px] font-mono bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 border border-zinc-700">{activeDelivery.status}</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">{activeDelivery.package_details || 'Package'}</h3>
                  <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> In transit
                  </p>
                </div>
                <div className="flex items-center text-white text-[12px] font-semibold bg-white/10 px-3 py-1.5 rounded-lg">
                  Track <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fleet Status */}
        <motion.div variants={fadeUp} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center relative border border-zinc-700">
            <Zap className="w-5 h-5 text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-zinc-900" />
          </div>
          <div>
            <h3 className="font-semibold text-white tracking-tight text-[15px]">Fleet Online</h3>
            <p className="text-[12px] text-zinc-500 font-mono mt-0.5">3 carts available</p>
          </div>
        </motion.div>

        {/* Action Cards */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
          <motion.div 
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/send')}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between h-44 cursor-pointer hover:border-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white tracking-tight text-[17px]">Send</h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-tight">Dispatch a package to someone on campus</p>
            </div>
          </motion.div>

          <motion.div 
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/fetch')}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between h-44 cursor-pointer hover:border-zinc-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <ArrowDownToLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white tracking-tight text-[17px]">Fetch</h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-tight">Request a cart to collect an item for you</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Recent Activity */}
        <motion.section variants={fadeUp} className="pt-2">
          <h2 className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-4">Recent Activity</h2>
          
          {recentDeliveries.length > 0 ? (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
              {recentDeliveries.map((delivery) => (
                <motion.div 
                  key={delivery.id} 
                  variants={fadeUp}
                  className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      {delivery.sender_id === userId 
                        ? <Send className="w-4 h-4 text-zinc-300" /> 
                        : <ArrowDownToLine className="w-4 h-4 text-zinc-300" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-[13px] text-white tracking-tight">{delivery.package_details || 'Package'}</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        {delivery.sender_id === userId ? 'Sent' : 'Received'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-600">
                    {new Date(delivery.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-10 flex flex-col items-center text-center">
              <Package className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-zinc-400 font-semibold text-sm tracking-tight">No deliveries yet</p>
              <p className="text-[12px] text-zinc-600 mt-1">Send your first package to get started</p>
            </div>
          )}
        </motion.section>
      </motion.main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/50 px-8 py-3 flex justify-around items-center z-20">
        <button className="flex flex-col items-center gap-1" onClick={() => navigate('/')}>
          <Home className="w-5 h-5 text-white" />
          <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-zinc-400">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1" onClick={() => navigate('/orders')}>
          <Clock className="w-5 h-5 text-zinc-600" />
          <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-zinc-600">History</span>
        </button>
        <button className="flex flex-col items-center gap-1" onClick={() => navigate('/profile')}>
          <User className="w-5 h-5 text-zinc-600" />
          <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-zinc-600">Profile</span>
        </button>
      </nav>
    </div>
  );
}
