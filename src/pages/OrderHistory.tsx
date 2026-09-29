import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="flex items-center px-5 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-zinc-900 text-zinc-400">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-white ml-2">Delivery History</h1>
        </div>
      </header>

      {/* Stats Banner */}
      <div className="w-full overflow-x-auto pt-6 pb-2 scrollbar-hide">
        <div className="flex gap-3 px-5 min-w-max">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col min-w-[130px]">
            <Package size={18} className="text-zinc-400 mb-2" />
            <div className="text-2xl font-bold font-mono text-white">{totalDeliveries}</div>
            <div className="text-[11px] text-zinc-600 mt-1 font-medium">Total Deliveries</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col min-w-[130px]">
            <MapPin size={18} className="text-amber-400 mb-2" />
            <div className="text-2xl font-bold font-mono text-white">{distanceSaved.toFixed(1)} <span className="text-sm text-zinc-500">km</span></div>
            <div className="text-[11px] text-zinc-600 mt-1 font-medium">Distance Saved</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col min-w-[130px]">
            <Calendar size={18} className="text-zinc-400 mb-2" />
            <div className="text-2xl font-bold font-mono text-white">{thisMonthCount}</div>
            <div className="text-[11px] text-zinc-600 mt-1 font-medium">This Month</div>
          </div>
        </div>
      </div>

      {/* Delivery List */}
      <div className="px-5 py-6">
        {deliveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mb-5">
              <Package size={28} className="text-zinc-600" />
            </div>
            <h2 className="text-base font-bold tracking-tight text-white mb-1">No deliveries yet</h2>
            <p className="text-[13px] text-zinc-600 mb-8">You haven't sent or received any packages.</p>
            <button 
              onClick={() => navigate('/send')}
              className="bg-white text-zinc-900 font-semibold px-6 py-3 rounded-xl text-sm hover:bg-zinc-200 transition-colors"
            >
              Send your first package
            </button>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2">
            {deliveries.map((delivery) => {
              const isSender = delivery.sender_id === userId;
              return (
                <motion.div
                  key={delivery.id}
                  variants={fadeUp}
                  onClick={() => navigate(`/tracking/${delivery.id}`)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex items-center gap-3 cursor-pointer hover:border-zinc-700 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    {isSender ? <Send size={16} className="text-zinc-300" /> : <ArrowDownToLine size={16} className="text-zinc-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-white truncate tracking-tight">
                      {delivery.package_details || 'Package'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        delivery.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        delivery.status === 'in_transit' || delivery.status === 'delivering' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-zinc-800 text-zinc-500'
                      }`}>
                        {delivery.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-600 font-mono whitespace-nowrap">
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
