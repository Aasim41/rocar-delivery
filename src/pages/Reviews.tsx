import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MOCK_REVIEWS = [
  { id: 1, user: 'John D.', shop: 'RoCAR Cafe', rating: 5, comment: 'Autonomous delivery was incredibly fast and food was hot!', date: 'Today' },
  { id: 2, user: 'Sarah M.', shop: 'Burger Hub', rating: 4, comment: 'Great burgers, the cart arrived exactly at the pin.', date: 'Yesterday' },
  { id: 3, user: 'Ahmed K.', shop: 'Pizza Express', rating: 5, comment: 'Loved tracking the cart on the map. Very futuristic.', date: '2 days ago' },
  { id: 4, user: 'Emily R.', shop: 'Taco Haven', rating: 3, comment: 'Food was okay, but the delivery robot got a bit confused at my gate.', date: '3 days ago' },
];

export function Reviews() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'my-reviews'>('all');

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-6 max-w-md mx-auto pb-32 font-sans min-h-screen relative overflow-hidden bg-[var(--bg-page)]"
    >
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[var(--color-sky)] rounded-full opacity-10 blur-[80px] pointer-events-none z-0" />

      <header className="mb-6 mt-6 relative z-10 flex items-center">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 mr-3 bg-[var(--bg-page)]/50 border border-[var(--border-color)] rounded-full text-[var(--text-main)] hover:bg-[var(--border-color)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">Reviews</h1>
      </header>

      <div className="relative z-10 mb-6 flex space-x-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition-colors ${
            activeTab === 'all' 
              ? 'bg-[var(--color-sky)] text-white' 
              : 'bg-[var(--bg-page)]/50 text-[var(--text-muted)] border border-[var(--border-color)]'
          }`}
        >
          Community Ratings
        </button>
        <button
          onClick={() => setActiveTab('my-reviews')}
          className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition-colors ${
            activeTab === 'my-reviews' 
              ? 'bg-[var(--color-sky)] text-white' 
              : 'bg-[var(--bg-page)]/50 text-[var(--text-muted)] border border-[var(--border-color)]'
          }`}
        >
          My Reviews
        </button>
      </div>

      <div className="relative z-10 space-y-4">
        {activeTab === 'all' ? (
          MOCK_REVIEWS.map(review => (
            <div key={review.id} className="glass-card p-4 hover:border-[var(--color-sky)]/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-[var(--text-main)]">{review.user}</p>
                  <p className="text-xs font-medium text-[var(--text-muted)]">to {review.shop}</p>
                </div>
                <div className="flex items-center bg-[var(--bg-page)] px-2 py-1 rounded-lg border border-[var(--border-color)]">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 mr-1" />
                  <span className="font-bold text-[var(--text-main)] text-sm">{review.rating}.0</span>
                </div>
              </div>
              <p className="text-sm text-[var(--text-main)] mt-3 leading-relaxed flex items-start">
                <MessageSquare className="w-4 h-4 mr-2 mt-0.5 text-[var(--color-sky)] opacity-70 shrink-0" />
                "{review.comment}"
              </p>
              <div className="mt-3 text-right">
                <span className="text-xs text-[var(--text-muted)] font-medium">{review.date}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-card p-8 text-center mt-4">
            <Star className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
            <h3 className="font-bold text-lg text-[var(--text-main)] mb-1">No Reviews Yet</h3>
            <p className="text-sm font-medium text-[var(--text-muted)]">Your past order ratings will appear here.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
