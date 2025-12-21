
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { Lock, Save, Loader2, Shield, Mail, Briefcase, GraduationCap, RefreshCcw, User as UserIcon } from 'lucide-react';

export default function Profile() {
  const { user, updateCurrentUser } = useAuth();
  const { addNotification } = useNotification();
  
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  
  const [personalInfo, setPersonalInfo] = useState({ name: '', schoolName: '' });
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });

  useEffect(() => {
    if (user) {
      setPersonalInfo({ name: user.name, schoolName: user.schoolName || 'ESP Dakar' });
    }
  }, [user]);

  const handleInfoChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalInfo.name.trim()) {
      addNotification({ title: 'Erreur', message: 'Le nom ne peut pas être vide.', type: 'alert' });
      return;
    }

    setInfoLoading(true);
    try {
      await updateCurrentUser({ name: personalInfo.name, schoolName: personalInfo.schoolName });
      addNotification({ title: 'Profil mis à jour', message: 'Vos modifications ont été enregistrées. Votre avatar a été synchronisé.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de mettre à jour vos informations.', type: 'alert' });
    } finally {
      setInfoLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      addNotification({ title: 'Erreur', message: 'Les mots de passe ne correspondent pas.', type: 'alert' });
      return;
    }

    if (passwords.newPassword.length < 6) {
      addNotification({ title: 'Erreur', message: 'Le mot de passe doit faire au moins 6 caractères.', type: 'alert' });
      return;
    }

    setLoading(true);
    try {
      if(user) await API.auth.updatePassword(user.id, passwords.newPassword);
      addNotification({ title: 'Succès', message: 'Mot de passe modifié.', type: 'success' });
      setPasswords({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Échec de la modification du mot de passe.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const refreshAvatarManually = async () => {
    if (!user) return;
    try {
      setInfoLoading(true);
      await updateCurrentUser({ name: user.name });
      addNotification({ title: 'Avatar synchronisé', message: 'Vos initiales ont été mises à jour.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Échec de synchronisation.', type: 'alert' });
    } finally {
      setInfoLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Mon Profil</h2>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          
          {/* Profile Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary-50 to-transparent dark:from-primary-900/10"></div>
             
            <div className="relative group z-10">
                <img 
                  src={user?.avatar} 
                  alt="Profile" 
                  className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 shadow-lg mb-4 object-cover bg-gray-100" 
                />
                <button 
                  onClick={refreshAvatarManually}
                  disabled={infoLoading}
                  className="absolute bottom-4 right-0 bg-primary-400 text-white p-2 rounded-full border-4 border-white dark:border-gray-800 shadow-sm hover:bg-primary-500 transition-colors disabled:opacity-50"
                  title="Rafraîchir les initiales"
                >
                    <RefreshCcw size={16} className={infoLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate w-full px-2">{user?.name}</h3>
            <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                user?.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                user?.role === 'DELEGATE' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
            }`}>
                {user?.role}
            </span>
          </div>

          {/* Stats / Info Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-6 space-y-5">
             <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-50 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-lg"><Mail size={18} /></div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Email</p>
                    <p className="truncate font-medium text-gray-800 dark:text-white">{user?.email}</p>
                </div>
             </div>
             <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-50 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-lg"><GraduationCap size={18} /></div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Classe</p>
                    <p className="font-medium text-gray-800 dark:text-white">{user?.className}</p>
                </div>
             </div>
             <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-lg"><Briefcase size={18} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Établissement</p>
                  <p className="font-medium text-gray-800 dark:text-white">{user?.schoolName || 'ESP Dakar'}</p>
                </div>
             </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          {/* Personal Info Form */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-8">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100 dark:border-gray-700">
               <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-600 dark:text-primary-300">
                   <UserIcon size={24} />
               </div>
               <div>
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">Informations personnelles</h3>
                   <p className="text-sm text-gray-500">Mettez à jour votre nom et votre établissement.</p>
               </div>
            </div>
            
            <form onSubmit={handleInfoChange} className="space-y-6 max-w-lg">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nom Complet</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      required
                      value={personalInfo.name}
                      onChange={e => setPersonalInfo({...personalInfo, name: e.target.value})}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:border-primary-300 transition-all"
                      placeholder="Prénom Nom"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Établissement</label>
                  <div className="relative group">
                    <Briefcase className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      value={personalInfo.schoolName}
                      onChange={e => setPersonalInfo({...personalInfo, schoolName: e.target.value})}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:border-primary-300 transition-all"
                      placeholder="ESP Dakar"
                    />
                  </div>
                </div>

                <div className="pt-2">
                   <button 
                     type="submit" 
                     disabled={infoLoading}
                     className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                   >
                     {infoLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                     Enregistrer le profil
                   </button>
                </div>
            </form>
          </div>

          {/* Security Form */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-8">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100 dark:border-gray-700">
               <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
                   <Shield size={24} />
               </div>
               <div>
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sécurité du compte</h3>
                   <p className="text-sm text-gray-500">Mettez à jour votre mot de passe pour sécuriser votre accès.</p>
               </div>
            </div>
            
            <form onSubmit={handlePasswordChange} className="space-y-6 max-w-lg">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nouveau mot de passe</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input 
                      type="password" 
                      required
                      value={passwords.newPassword}
                      onChange={e => setPasswords({...passwords, newPassword: e.target.value})}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:border-primary-300 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Confirmer le mot de passe</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input 
                      type="password" 
                      required
                      value={passwords.confirmPassword}
                      onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:border-primary-300 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-2">
                   <button 
                     type="submit" 
                     disabled={loading}
                     className="bg-gray-900 dark:bg-gray-700 hover:bg-black dark:hover:bg-gray-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                   >
                     {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                     Modifier le mot de passe
                   </button>
                </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
