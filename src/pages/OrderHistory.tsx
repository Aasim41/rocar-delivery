import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export function OrderHistory() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      if (session.user.id === 'demo-user-123') {
        setOrders([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
      
      if (data) setOrders(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-sky)] animate-spin" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-6 max-w-md mx-auto pb-32 font-sans min-h-screen relative overflow-hidden bg-[var(--bg-page)]"
    >
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[var(--color-sky)] rounded-full opacity-10 blur-[80px] pointer-events-none z-0" />

      <header className="mb-8 mt-6 relative z-10 flex items-center">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 mr-3 bg-[var(--bg-page)]/50 border border-[var(--border-color)] rounded-full text-[var(--text-main)] hover:bg-[var(--border-color)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">Order History</h1>
      </header>

      <div className="relative z-10 space-y-4">
        {orders.length > 0 ? (
          orders.map(order => (
            <div key={order.id} onClick={() => navigate(`/tracking/${order.id}?type=marketplace`)} className="glass-card p-4 cursor-pointer hover:border-[var(--color-sky)]/50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[var(--color-sky)]/10 rounded-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-[var(--color-sky)]" />
                  </div>
                  <div>
                    <p className="font-bold text-[var(--text-main)]">Order #{order.id.substring(0,6)}</p>
                    <p className="text-xs font-medium text-[var(--text-muted)] mt-0.5">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider bg-[var(--bg-page)] px-2 py-1 rounded-md border border-[var(--border-color)] text-[var(--text-main)]">
                  {order.status === 'delivered' ? 'Completed' : 'Active'}
                </span>
              </div>
              
              <div className="bg-[var(--bg-page)]/50 rounded-xl p-3 border border-[var(--border-color)]">
                {order.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm mb-1 last:mb-0">
                    <span className="font-medium text-[var(--text-main)] truncate mr-2">{item.qty}x {item.name}</span>
                    <span className="font-bold text-[var(--text-muted)]">₹{item.price * item.qty}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--border-color)]">
                <div className="flex items-center text-xs font-semibold text-[var(--text-muted)]">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  <span>{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <span className="font-bold text-[var(--text-main)]">
                  Total: ₹{order.items?.reduce((acc: number, curr: any) => acc + (curr.price * curr.qty), 0)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-card p-8 text-center mt-4">
            <Package className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
            <h3 className="font-bold text-lg text-[var(--text-main)] mb-1">No Orders Yet</h3>
            <p className="text-sm font-medium text-[var(--text-muted)]">When you place an order, it will appear here.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
