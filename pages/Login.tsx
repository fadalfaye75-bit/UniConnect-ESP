import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Loader2, AlertCircle, ChevronRight, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      await login(cleanEmail, password);
    } catch (err: any) {
      console.error("Erreur de connexion capturée:", err);
      
      let message = "Une erreur est survenue.";
      
      if (typeof err === 'string') {
        message = err;
      } else if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === 'object') {
        message = err.message || err.error_description || JSON.stringify(err);
      }

      // Formatage convivial
      if (message.includes("Invalid login credentials") || message.includes("invalid_credentials")) {
        setError("Email ou mot de passe incorrect. Veuillez vérifier vos accès.");
      } else if (message.includes("infinite recursion")) {
        setError("Erreur système (Récursion RLS). Veuillez appliquer le correctif SQL dans le README.");
      } else if (message.includes("Email not confirmed")) {
        setError("Votre adresse email n'est pas encore confirmée.");
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary-50 to-transparent dark:from-gray-800 dark:to-transparent -z-0"></div>
      
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-soft p-8 border border-gray-100 dark:border-gray-700 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary-50 text-primary-400 mb-6 shadow-sm border border-primary-100 dark:border-gray-700 dark:bg-gray-800/50">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
             </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">UniConnect ESP</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm leading-relaxed">
            Plateforme de gestion centralisée de l'ESP Dakar.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-1">
            <AlertCircle size={18} className="flex-shrink-0" /> 
            <span className="flex-1 font-medium break-words">{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Universitaire</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-400 transition-colors" size={18} />
              <input 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="prenom.nom@esp.sn"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white outline-none focus:bg-white focus:ring-4 focus:ring-primary-50 focus:border-primary-300 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Mot de passe</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-400 transition-colors" size={18} />
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-12 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white outline-none focus:bg-white focus:ring-4 focus:ring-primary-50 focus:border-primary-300 transition-all"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-95"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Se Connecter'}
            {!isLoading && <ChevronRight size={18} />}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 dark:border-gray-700 pt-6">
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Portail Officiel ESP Dakar</p>
        </div>
      </div>
    </div>
  );
}
