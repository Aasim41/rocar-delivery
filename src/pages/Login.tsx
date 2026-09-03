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

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

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

        <div className="auth-form">
          <h2 className="auth-form-title">
            {isSignUp ? 'Create an account' : 'Sign in'}
          </h2>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-xl py-3.5 px-4 font-bold transition-all hover:bg-gray-50 dark:hover:bg-zinc-800 shadow-sm disabled:opacity-50 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          </button>
          
          <div className="relative flex items-center my-6">
            <div className="flex-grow border-t border-[var(--border-color)]"></div>
            <span className="flex-shrink-0 mx-4 text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">Or continue with email</span>
            <div className="flex-grow border-t border-[var(--border-color)]"></div>
          </div>

          <form onSubmit={handleSubmit}>
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
    </div>
  );
}
