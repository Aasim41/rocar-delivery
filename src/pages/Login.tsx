import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { supabase } from '../lib/supabase';
import { Package, Loader2 } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  useGSAP(() => {
    if (orb1Ref.current) {
      gsap.to(orb1Ref.current, {
        x: '+=30',
        y: '+=20',
        scale: 1.15,
        opacity: 0.5,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }
    if (orb2Ref.current) {
      gsap.to(orb2Ref.current, {
        x: '-=25',
        y: '-=20',
        scale: 1.2,
        opacity: 0.4,
        duration: 11,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }
  }, { scope: containerRef });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true });
    });
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'rocar://login'
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        if (!name.trim()) throw new Error('Name is required');
        
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name }
          }
        });
        
        if (signUpError) throw signUpError;
        
        // Ensure user profile is created in public.users
        if (data.user) {
          await supabase.from('users').upsert({
            id: data.user.id,
            email: data.user.email,
            name: name,
          });
        }
        
        // Wait for session to establish
        const { data: { session } } = await supabase.auth.getSession();
        if (session) navigate('/', { replace: true });
        else setError("Check your email for a confirmation link.");
        
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) throw signInError;
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-[#050814] flex flex-col items-center justify-center p-6 text-white relative overflow-hidden font-sans select-none">
      
      {/* GSAP Ambient Fading Gradient Orbs */}
      <div 
        ref={orb1Ref}
        className="pointer-events-none absolute -top-24 -left-20 w-96 h-96 rounded-full bg-gradient-to-br from-blue-700/25 via-indigo-900/15 to-transparent blur-3xl opacity-40 z-0"
      />
      <div 
        ref={orb2Ref}
        className="pointer-events-none absolute -bottom-24 -right-20 w-96 h-96 rounded-full bg-gradient-to-tl from-rose-950/30 via-red-900/15 to-transparent blur-3xl opacity-35 z-0"
      />

      <div className="w-full max-w-sm z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl card-fusion-glass border border-indigo-700/50 flex items-center justify-center shadow-[0_0_30px_rgba(30,58,138,0.3)] mb-6 relative">
            <Package size={30} className="text-white absolute" />
            <div className="absolute inset-0 border border-blue-400/20 rounded-2xl animate-ping opacity-30" />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
            AutoDrop
          </h1>
          <p className="text-blue-300/60 text-xs mt-1.5 tracking-[0.2em] font-semibold uppercase">Campus Autonomous Logistics</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-400 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          {isSignUp && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/70 border border-indigo-950/70 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
              required
            />
          )}
          
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900/70 border border-indigo-950/70 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
            required
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900/70 border border-indigo-950/70 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
            required
            minLength={6}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-zinc-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 text-sm shadow-lg"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-px bg-indigo-950/60 flex-1" />
          <span className="text-[11px] text-blue-300/40 uppercase font-semibold tracking-wider">Or continue with</span>
          <div className="h-px bg-indigo-950/60 flex-1" />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-6 w-full card-navy-glass border border-indigo-900/40 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-3 hover:bg-indigo-950/40 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google
        </button>

        <p className="mt-8 text-center text-xs text-slate-500">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-white hover:underline font-semibold focus:outline-none ml-1"
          >
            {isSignUp ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
