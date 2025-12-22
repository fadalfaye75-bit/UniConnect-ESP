
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { UserAvatar } from '../components/Layout';
import { Lock, Save, Loader2, Shield, Mail, Briefcase, GraduationCap, User as UserIcon } from 'lucide-react';

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
    setInfoLoading(true);
    try {
      await updateCurrentUser({ name: personalInfo.name, schoolName: personalInfo.schoolName });
      addNotification({ title: 'Profil mis à jour', message: 'Vos modifications ont été enregistrées.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de mettre à jour.', type: 'alert' });
    } finally {
      setInfoLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      addNotification({ title: 'Erreur', message: 'Mots de passe différents.', type: 'alert' });
      return;
    }
    setLoading(true);
    try {
      if(user) await API.auth.updatePassword(user.id, passwords.newPassword);
      addNotification({ title: 'Succès', message: 'Mot de passe modifié.', type: 'success' });
      setPasswords({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Échec de la modification.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic">Mon Profil</h2>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-700 p-8 flex flex-col items-center text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary-50 to-transparent dark:from-primary-900/10"></div>
             <div className="relative z-10 mb-6">
                <UserAvatar name={user?.name || "U"} className="w-32 h-32" textClassName="text-4xl" />
             </div>
             <h3 className="text-xl font-black text-gray-900 dark:text-white truncate w-full italic leading-tight">{user?.name}</h3>
             <span className="mt-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-primary-50 text-primary-600 dark:bg-primary-900/30">
                {user?.role}
             </span>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-soft border border-gray-100 dark:border-gray-700 p-6 space-y-4">
             <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-xl"><Mail size={18} /></div>
                <p className="truncate font-bold italic">{user?.email}</p>
             </div>
             <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-500 rounded-xl"><GraduationCap size={18} /></div>
                <p className="font-bold italic">{user?.className}</p>
             </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-700 p-8">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-2">
               <UserIcon size={20} className="text-primary-500" /> Identité
            </h3>
            <form onSubmit={handleInfoChange} className="space-y-6">
                <input required value={personalInfo.name} onChange={e => setPersonalInfo({...personalInfo, name: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none" placeholder="Nom Complet" />
                <input value={personalInfo.schoolName} onChange={e => setPersonalInfo({...personalInfo, schoolName: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none" placeholder="Établissement" />
                <button type="submit" disabled={infoLoading} className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-primary-500/20 flex items-center gap-2 uppercase tracking-widest active:scale-95">
                  {infoLoading ? <Loader2 className="animate-spin" /> : <Save size={20} />} Enregistrer
                </button>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-700 p-8">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-2">
               <Shield size={20} className="text-primary-500" /> Sécurité
            </h3>
            <form onSubmit={handlePasswordChange} className="space-y-6">
                <input required type="password" value={passwords.newPassword} onChange={e => setPasswords({...passwords, newPassword: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none" placeholder="Nouveau mot de passe" />
                <input required type="password" value={passwords.confirmPassword} onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none" placeholder="Confirmer" />
                <button type="submit" disabled={loading} className="bg-gray-900 dark:bg-gray-700 text-white px-8 py-3.5 rounded-2xl font-black flex items-center gap-2 uppercase tracking-widest active:scale-95">
                  {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />} Modifier
                </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
