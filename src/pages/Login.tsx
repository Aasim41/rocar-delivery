import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Store, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<'buyer' | 'shop_owner'>('buyer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (isSignUp) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: role,
          }
        }
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        if (data.session) {
          // Success, App.tsx handles redirect
        } else {
          setMessage('Please check your email to verify your account. (If email confirmation is disabled, you can log in now!)');
          setIsSignUp(false);
        }
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      }
      // If successful, App.tsx's auth listener will handle the redirect.
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Soft Glassmorphic background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[var(--color-sky)] rounded-full opacity-20 blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-[var(--color-green)] rounded-full opacity-20 blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[40%] left-[60%] w-64 h-64 bg-[var(--color-yellow)] rounded-full opacity-10 blur-[80px] pointer-events-none z-0" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 glass-panel flex items-center justify-center mx-auto mb-6 rounded-3xl">
            <ShieldCheck className="w-10 h-10 text-[var(--color-sky)] drop-shadow-md" />
          </div>
          <h1 className="text-4xl font-bold text-[var(--text-main)] tracking-tight mb-2">Delivery Robot</h1>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2 className="auth-form-title">
            {isSignUp ? 'Create an account' : 'Sign in'}
          </h2>

          <div className="input-container">
            <input
              type="email"
              required
              placeholder="Email Address (@gmail.com)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {email.length > 0 && !email.toLowerCase().endsWith('@gmail.com') && (
              <p className="text-[var(--color-red)] text-xs mt-1 text-left font-medium opacity-80 px-2">
                Please use a valid @gmail.com address.
              </p>
            )}
          </div>
          
          <div className="input-container">
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <AnimatePresence>
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-sm font-semibold text-[var(--text-muted)] tracking-wide mb-2 mt-4 text-center">I am a...</label>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <button
                    type="button"
                    onClick={() => setRole('buyer')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                      role === 'buyer' 
                      ? 'bg-[var(--color-sky)]/10 border-[var(--color-sky)] text-[var(--color-sky)]' 
                      : 'bg-[var(--bg-page)] border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-page)]/80'
                    }`}
                  >
                    <User className="w-5 h-5 mb-1" />
                    <span className="font-semibold text-xs">Buyer</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setRole('shop_owner')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                      role === 'shop_owner' 
                      ? 'bg-[var(--color-sky)]/10 border-[var(--color-sky)] text-[var(--color-sky)]' 
                      : 'bg-[var(--bg-page)] border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-page)]/80'
                    }`}
                  >
                    <Store className="w-5 h-5 mb-1" />
                    <span className="font-semibold text-xs">Shop Owner</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <p className="text-[var(--color-red)] bg-[var(--color-red)]/10 p-3 rounded-xl border border-[var(--color-red)]/20 text-sm text-center mt-4">{error}</p>}
          {message && <p className="text-[var(--color-green)] bg-[var(--color-green)]/10 p-3 rounded-xl border border-[var(--color-green)]/20 text-sm text-center mt-4">{message}</p>}

          <button
            type="submit"
            disabled={loading || !email.toLowerCase().endsWith('@gmail.com')}
            className="auth-submit disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              isSignUp ? 'Sign Up' : 'Sign In'
            )}
          </button>
          
          <p className="signup-link">
            {isSignUp ? 'Already have an account?' : 'No account?'}
            <button 
              type="button" 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setMessage('');
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
