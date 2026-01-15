import React, { useState } from 'react';
import { Bus, Mail, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

interface LoginPageProps {
  onLogin: (email: string, password?: string) => boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const success = onLogin(email, password);
      if (!success) {
        setError('Invalid email or password');
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full bg-[#0f172a] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <motion.div animate={{ scale: [1, 1.2, 1], x: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity }} className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-yellow-400/20 rounded-full blur-[120px]" />
      
      <div className="w-full max-w-md z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-yellow-400 rounded-3xl flex items-center justify-center shadow-2xl mb-4 rotate-3"><Bus className="w-10 h-10 text-slate-900" /></div>
          <h1 className="text-3xl font-black text-white">CollegeBus <span className="text-yellow-400">Tracker</span></h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-2xl rounded-[3rem] p-10 shadow-2xl border border-white/10">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-white">Sign In</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
              <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"/><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@college.edu" className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 text-white outline-none focus:border-yellow-400/50 transition-colors" required /></div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
              <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"/><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 text-white outline-none focus:border-yellow-400/50 transition-colors" required /></div>
            </div>
            
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs font-bold text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                {error}
              </motion.div>
            )}

            <button type="submit" disabled={isLoading} className="w-full bg-yellow-400 text-slate-900 font-black py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-yellow-300 transition-all shadow-xl disabled:opacity-70 disabled:cursor-not-allowed">
              {isLoading ? <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> : "LOG IN"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;