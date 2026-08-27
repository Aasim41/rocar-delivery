import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Clock, ArrowLeft, Loader2, Star, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export function OrderHistory() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingModal, setRatingModal] = useState<{ isOpen: boolean; orderId: string | null }>({ isOpen: false, orderId: null });
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState('');
  
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

  const handleSubmitReview = () => {
    toast.success(`Review submitted! You rated ${ratingValue} stars.`);
    setRatingModal({ isOpen: false, orderId: null });
    setReviewText('');
    setRatingValue(5);
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
            <div key={order.id} className="glass-card p-4 hover:border-[var(--color-sky)]/50 transition-colors">
              <div 
                className="cursor-pointer"
                onClick={() => navigate(`/tracking/${order.id}?type=marketplace`)}
              >
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

              {/* RATINGS & REVIEWS SECTION */}
              {order.status === 'delivered' && (
                <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex justify-end">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setRatingModal({ isOpen: true, orderId: order.id }); }}
                    className="flex items-center text-sm font-bold text-[var(--color-sky)] hover:text-sky-400 transition-colors"
                  >
                    <Star className="w-4 h-4 mr-1" />
                    Rate Order
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-[var(--text-muted)] text-center py-10 font-medium">No previous orders found.</p>
        )}
      </div>

      {/* RATING MODAL */}
      <AnimatePresence>
        {ratingModal.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-[var(--bg-page)] border border-[var(--border-color)] p-6 rounded-2xl w-full max-w-sm relative"
            >
              <button 
                onClick={() => setRatingModal({ isOpen: false, orderId: null })}
                className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl font-bold text-[var(--text-main)] mb-1">Rate Delivery</h2>
              <p className="text-sm text-[var(--text-muted)] mb-6">How was your RoCAR experience?</p>
              
              <div className="flex justify-center space-x-2 mb-6">
                {[1, 2, 3, 4, 5].map(star => (
                  <button 
                    key={star} 
                    onClick={() => setRatingValue(star)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star className={`w-8 h-8 ${star <= ratingValue ? 'fill-yellow-400 text-yellow-400' : 'text-[var(--border-color)]'}`} />
                  </button>
                ))}
              </div>
              
              <textarea
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder="Leave a review (optional)..."
                className="w-full bg-[var(--bg-page)]/50 border border-[var(--border-color)] rounded-xl p-3 text-[var(--text-main)] text-sm mb-4 h-24 focus:outline-none focus:border-[var(--color-sky)]"
              />
              
              <button 
                onClick={handleSubmitReview}
                className="w-full bg-[var(--color-sky)] text-white font-bold py-3 rounded-xl hover:bg-sky-600 transition-colors"
              >
                Submit Review
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
