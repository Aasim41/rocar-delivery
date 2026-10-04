import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { supabase } from '../lib/supabase';
import { 
  User, Clock, Send, ArrowDownToLine, Package, Home,
  ChevronRight, MapPin, Zap, Radio
} from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);

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

  // GSAP: Ambient breathing floating orbs
  useGSAP(() => {
    if (orb1Ref.current) {
      gsap.to(orb1Ref.current, {
        x: '+=30',
        y: '+=25',
        scale: 1.15,
        opacity: 0.65,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }

    if (orb2Ref.current) {
      gsap.to(orb2Ref.current, {
        x: '-=25',
        y: '-=30',
        scale: 1.2,
        opacity: 0.5,
        duration: 11,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="min-h-screen bg-[#050814] text-slate-200 pb-28 font-sans relative overflow-hidden select-none">
      
      {/* GSAP Ambient Fading Gradient Orbs */}
      <div 
        ref={orb1Ref}
        className="pointer-events-none absolute -top-24 -left-20 w-96 h-96 rounded-full bg-gradient-to-br from-blue-700/20 via-indigo-900/15 to-transparent blur-3xl opacity-40 z-0"
      />
      <div 
        ref={orb2Ref}
        className="pointer-events-none absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-gradient-to-tl from-rose-950/30 via-red-900/15 to-transparent blur-3xl opacity-35 z-0"
      />
      <div 
        className="pointer-events-none absolute bottom-10 left-1/4 w-80 h-80 rounded-full bg-gradient-to-tr from-sky-950/20 via-blue-900/10 to-transparent blur-3xl opacity-30 z-0"
      />

      {/* Header */}
      <header className="gsap-header px-6 pt-14 pb-4 flex justify-between items-center relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              RoCAR
            </h1>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
          </div>
          <p className="text-[10px] text-blue-300/60 font-semibold tracking-[0.25em] uppercase mt-0.5">
            Autonomous Logistics
          </p>
        </div>
        <div className="flex gap-2.5">
          <button 
            onClick={() => navigate('/orders')} 
            className="w-10 h-10 bg-[#0c142b]/80 border border-[#1e2c55]/80 rounded-full flex items-center justify-center hover:border-blue-500/50 hover:bg-[#121e42] transition-all shadow-md active:scale-95"
          >
            <Clock className="w-4 h-4 text-slate-300" />
          </button>
          <button 
            onClick={() => navigate('/profile')} 
            className="w-10 h-10 bg-[#0c142b]/80 border border-[#1e2c55]/80 rounded-full flex items-center justify-center hover:border-blue-500/50 hover:bg-[#121e42] transition-all shadow-md active:scale-95"
          >
            <User className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </header>

      <main className="px-5 space-y-4 max-w-md mx-auto relative z-10">
        
        {/* Active Delivery Banner — Deep Fusion Gradient (Navy to Dark Burgundy) */}
        <AnimatePresence>
          {activeDelivery && (
            <div 
              className="gsap-banner cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => navigate(`/tracking/${activeDelivery.id}`)}
            >
              <div className="card-fusion-glass rounded-2xl p-4 relative overflow-hidden group">
                {/* Subtle top edge highlight */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
                
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-[0.15em] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" /> Active Delivery
                  </span>
                  <span className="text-[10px] font-mono bg-[#0d1633] px-2.5 py-0.5 rounded-full text-blue-200 border border-blue-900/60 font-medium">
                    {activeDelivery.status}
                  </span>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight group-hover:text-blue-200 transition-colors">
                      {activeDelivery.package_details || 'Package'}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-rose-400" /> In transit via RoCAR
                    </p>
                  </div>
                  <div className="flex items-center text-white text-[12px] font-bold bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl group-hover:bg-white/20 transition-all shadow-sm">
                    Track <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Fleet Status Card — Deep Navy Glass */}
        <div className="gsap-fleet card-navy-glass rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-950 to-[#070e24] flex items-center justify-center relative border border-blue-800/40 shadow-inner">
              <Zap className="w-5 h-5 text-emerald-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#050814] shadow-[0_0_6px_#34d399]" />
            </div>
            <div>
              <h3 className="font-bold text-white tracking-tight text-[15px] flex items-center gap-1.5">
                Fleet Online
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">3 autonomous carts ready</p>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
            <Radio className="w-3 h-3 animate-pulse" /> Live
          </div>
        </div>

        {/* Action Cards: SEND (Dark Navy) & FETCH (Dark Crimson / Wine) */}
        <div className="grid grid-cols-2 gap-3.5 pt-1">
          
          {/* SEND PACKAGE CARD — Deep Midnight Navy Gradient */}
          <div 
            onClick={() => navigate('/send')}
            className="card-navy-glass rounded-2xl p-5 flex flex-col justify-between h-44 cursor-pointer hover:border-blue-400 hover:shadow-[0_8px_30px_rgba(20,40,90,0.5)] transition-all duration-200 active:scale-[0.97] group relative overflow-hidden"
          >
            {/* Subtle corner light flare */}
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-blue-500/20 rounded-full blur-xl group-hover:bg-blue-400/30 transition-all pointer-events-none" />

            <div className="w-12 h-12 rounded-2xl bg-blue-950/90 border border-blue-600/50 flex items-center justify-center text-blue-300 group-hover:text-white group-hover:bg-blue-900/80 transition-all shadow-md">
              <Send className="w-5 h-5" />
            </div>
            <div className="relative z-10">
              <h3 className="font-black text-white tracking-tight text-[18px] group-hover:text-blue-100 transition-colors">
                Send
              </h3>
              <p className="text-[11px] text-blue-200/70 mt-1 leading-snug">
                Dispatch item to someone on campus
              </p>
            </div>
          </div>

          {/* FETCH ITEM CARD — Deep Dark Crimson / Burgundy / Wine Gradient */}
          <div 
            onClick={() => navigate('/fetch')}
            className="card-crimson-glass rounded-2xl p-5 flex flex-col justify-between h-44 cursor-pointer hover:border-rose-400 hover:shadow-[0_8px_30px_rgba(70,12,25,0.5)] transition-all duration-200 active:scale-[0.97] group relative overflow-hidden"
          >
            {/* Subtle corner light flare */}
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-rose-600/20 rounded-full blur-xl group-hover:bg-rose-500/30 transition-all pointer-events-none" />

            <div className="w-12 h-12 rounded-2xl bg-rose-950/90 border border-rose-600/50 flex items-center justify-center text-rose-300 group-hover:text-white group-hover:bg-rose-900/80 transition-all shadow-md">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div className="relative z-10">
              <h3 className="font-black text-white tracking-tight text-[18px] group-hover:text-rose-100 transition-colors">
                Fetch
              </h3>
              <p className="text-[11px] text-rose-200/70 mt-1 leading-snug">
                Request an empty cart to collect an item
              </p>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <section className="gsap-activity pt-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              Recent Activity
            </h2>
            <button 
              onClick={() => navigate('/orders')} 
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          {recentDeliveries.length > 0 ? (
            <div className="space-y-2">
              {recentDeliveries.map((delivery) => (
                <div 
                  key={delivery.id} 
                  onClick={() => navigate(`/tracking/${delivery.id}`)}
                  className="bg-[#0b1328]/70 hover:bg-[#0f1936]/80 border border-[#1c2950]/60 hover:border-blue-900/80 p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] backdrop-blur-md shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                      delivery.sender_id === userId 
                        ? 'bg-blue-950/60 border-blue-800/40 text-blue-300' 
                        : 'bg-rose-950/60 border-rose-900/40 text-rose-300'
                    }`}>
                      {delivery.sender_id === userId 
                        ? <Send className="w-4 h-4" /> 
                        : <ArrowDownToLine className="w-4 h-4" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-[13px] text-white tracking-tight">{delivery.package_details || 'Package'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                        {delivery.sender_id === userId ? 'Sent Package' : 'Fetched Item'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 bg-[#070d1e] px-2 py-0.5 rounded border border-[#162242]">
                    {new Date(delivery.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0a1226]/50 border border-[#19264a]/60 border-dashed rounded-2xl p-9 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#0e1936] flex items-center justify-center mb-3 text-slate-500">
                <Package className="w-6 h-6" />
              </div>
              <p className="text-slate-300 font-bold text-sm tracking-tight">No deliveries yet</p>
              <p className="text-[12px] text-slate-500 mt-1 max-w-[200px]">Send or fetch your first package on campus!</p>
            </div>
          )}
        </section>
      </main>

      {/* Floating Bottom Nav — Frosted Midnight Navy Glass */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#060b18]/90 backdrop-blur-2xl border-t border-[#162244]/80 px-8 py-3.5 flex justify-around items-center z-40">
        <button className="flex flex-col items-center gap-1 group" onClick={() => navigate('/')}>
          <div className="p-1 rounded-xl bg-blue-500/10 text-blue-400">
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-blue-400">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors" onClick={() => navigate('/orders')}>
          <div className="p-1">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold tracking-[0.15em] uppercase">History</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors" onClick={() => navigate('/profile')}>
          <div className="p-1">
            <User className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold tracking-[0.15em] uppercase">Profile</span>
        </button>
      </nav>
    </div>
  );
}
