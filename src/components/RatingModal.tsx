import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, feedback: string) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

export function RatingModal({ isOpen, onClose, onSubmit }: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating, feedback);
      setRating(0);
      setHoverRating(0);
      setFeedback('');
    }
  };

  const currentDisplayRating = hoverRating > 0 ? hoverRating : rating;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-main)' }}
          >
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold">How was your delivery?</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                Please rate your experience with our delivery robot
              </p>
            </div>

            <div className="mb-6 flex flex-col items-center gap-3">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yellow)] focus-visible:ring-offset-2 rounded-full p-1 transition-transform hover:scale-110"
                  >
                    <svg
                      className="h-10 w-10 transition-colors"
                      viewBox="0 0 24 24"
                      fill={star <= currentDisplayRating ? 'var(--color-yellow)' : 'transparent'}
                      stroke={star <= currentDisplayRating ? 'var(--color-yellow)' : 'var(--border-color)'}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                ))}
              </div>
              <div className="h-6 font-medium" style={{ color: 'var(--color-yellow)' }}>
                {currentDisplayRating > 0 ? RATING_LABELS[currentDisplayRating] : ''}
              </div>
            </div>

            <div className="mb-6">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Leave some optional feedback..."
                className="w-full resize-none rounded-xl border p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-yellow)]"
                style={{ 
                  backgroundColor: 'var(--bg-page)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-main)'
                }}
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors hover:bg-black/5"
                style={{ 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-main)'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={rating === 0}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-yellow)' }}
              >
                Submit
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
