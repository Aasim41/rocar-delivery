import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Package, MapPin, Calendar, Send, ArrowDownToLine, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Delivery {
  id: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  package_details: string;
  status: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function OrderHistory() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useGSAP(() => {
    if (orb1Ref.current) {
      gsap.to(orb1Ref.current, {
        x: '+=20',
        y: '+=15',
        scale: 1.1,
        opacity: 0.5,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }
    if (orb2Ref.current) {
      gsap.to(orb2Ref.current, {
        x: '-=20',
        y: '-=15',
        scale: 1.15,
        opacity: 0.4,
        duration: 11,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }
  }, { scope: containerRef });

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setUserId(user.id);
        const { data } = await supabase
          .from('deliveries')
          .select('*')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order('created_at', { ascending: false });
        setDeliveries(data || []);
      } catch (err) {
        console.error('Failed to load deliveries', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const completedDeliveries = deliveries.filter(d => d.status === 'completed');
  const totalDeliveries = completedDeliveries.length;
  
  const distanceSaved = completedDeliveries.reduce((sum, d) => {
    if (d.pickup_lat && d.pickup_lng && d.dropoff_lat && d.dropoff_lng) {
      return sum + haversineKm(d.pickup_lat, d.pickup_lng, d.dropoff_lat, d.dropoff_lng);
    }
    return sum;
  }, 0);

  const thisMonthCount = completedDeliveries.filter(d => {
    const dDate = new Date(d.created_at);
    const now = new Date();
    return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
  }).length;

  const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#050814] text-slate-200 pb-20 font-sans relative overflow-hidden select-none">
      {/* GSAP Ambient Gradient Orbs */}
      <div 
        ref={orb1Ref}
        className="pointer-events-none absolute -top-20 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-blue-700/20 via-indigo-900/15 to-transparent blur-3xl opacity-40 z-0"
      />
      <div 
        ref={orb2Ref}
        className="pointer-events-none absolute top-1/2 -right-20 w-80 h-80 rounded-full bg-gradient-to-tl from-rose-950/25 via-red-900/15 to-transparent blur-3xl opacity-35 z-0"
      />

      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#050814]/80 backdrop-blur-xl border-b border-indigo-950/50">
        <div className="flex items-center px-5 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-indigo-950/40 text-slate-300">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent ml-2">
            Delivery History
          </h1>
        </div>
      </header>

      {/* Stats Banner */}
      <div className="w-full overflow-x-auto pt-6 pb-2 scrollbar-hide relative z-10">
        <div className="flex gap-3 px-5 min-w-max">
          <div className="card-navy-glass border border-indigo-900/40 rounded-2xl p-4 flex flex-col min-w-[135px]">
            <Package size={18} className="text-blue-400 mb-2" />
            <div className="text-2xl font-bold font-mono text-white">{totalDeliveries}</div>
            <div className="text-[11px] text-blue-300/60 mt-1 font-medium">Total Deliveries</div>
          </div>
          <div className="card-crimson-glass border border-rose-900/40 rounded-2xl p-4 flex flex-col min-w-[135px]">
            <MapPin size={18} className="text-rose-400 mb-2" />
            <div className="text-2xl font-bold font-mono text-white">{distanceSaved.toFixed(1)} <span className="text-xs text-rose-300/60">km</span></div>
            <div className="text-[11px] text-rose-300/60 mt-1 font-medium">Distance Saved</div>
          </div>
          <div className="card-navy-glass border border-indigo-900/40 rounded-2xl p-4 flex flex-col min-w-[135px]">
            <Calendar size={18} className="text-indigo-400 mb-2" />
            <div className="text-2xl font-bold font-mono text-white">{thisMonthCount}</div>
            <div className="text-[11px] text-indigo-300/60 mt-1 font-medium">This Month</div>
          </div>
        </div>
      </div>

      {/* Delivery List */}
      <div className="px-5 py-6 relative z-10">
        {deliveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 card-navy-glass border border-indigo-900/40 rounded-full flex items-center justify-center mb-5">
              <Package size={28} className="text-blue-400" />
            </div>
            <h2 className="text-base font-bold tracking-tight text-white mb-1">No deliveries yet</h2>
            <p className="text-[13px] text-slate-500 mb-8">You haven't sent or received any packages.</p>
            <button 
              onClick={() => navigate('/send')}
              className="bg-white text-zinc-900 font-semibold px-6 py-3 rounded-xl text-sm hover:bg-slate-200 transition-colors"
            >
              Send your first package
            </button>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2.5">
            {deliveries.map((delivery) => {
              const isSender = delivery.sender_id === userId;
              return (
                <motion.div
                  key={delivery.id}
                  variants={fadeUp}
                  onClick={() => navigate(`/tracking/${delivery.id}`)}
                  className="card-navy-glass border border-indigo-900/35 hover:border-indigo-700/60 rounded-2xl p-3.5 flex items-center gap-3.5 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    isSender 
                      ? 'bg-blue-950/60 border-blue-800/40 text-blue-400' 
                      : 'bg-rose-950/60 border-rose-800/40 text-rose-400'
                  }`}>
                    {isSender ? <Send size={16} /> : <ArrowDownToLine size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-white truncate tracking-tight">
                      {delivery.package_details || 'Campus Delivery'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        delivery.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        delivery.status === 'in_transit' || delivery.status === 'delivering' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-slate-900/80 text-slate-400 border border-indigo-950/50'
                      }`}>
                        {delivery.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-blue-300/50 font-mono whitespace-nowrap">
                    {timeAgo(delivery.created_at)}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
