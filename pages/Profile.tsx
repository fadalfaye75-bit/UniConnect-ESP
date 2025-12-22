
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { UserAvatar } from '../components/Layout';
import { Lock, Save, Loader2, Shield, Mail, Briefcase, GraduationCap, User as UserIcon, Palette, Check } from 'lucide-react';

const THEME_COLORS = [
  { name: 'Bleu ESP', color: '#0ea5e9' },
  { name: 'Émeraude', color: '#10b981' },
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Rose', color: '#f43f5e' },
  { name: 'Ambre', color: '#f59e0b' },
  { name: 'Violet', color: '#8b5cf6' },
  { name: 'Graphite', color: '#475569' },
  { name: 'Cerise', color: '#e11d48' },
];

export default function Profile() {
  const { user, updateCurrentUser } = useAuth();
  const { addNotification } = useNotification();
  
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  
  const [personalInfo, setPersonalInfo] = useState({ name: '', schoolName: '', themeColor: '#0ea5e9' });
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });

  useEffect(() => {
    if (user) {
      setPersonalInfo({ 
        name: user.name, 
        schoolName: user.schoolName || 'ESP Dakar',
        themeColor: user.themeColor || '#0ea5e9'
      });
    }
  }, [user]);

  const handleInfoChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoLoading(true);
    try {
      await updateCurrentUser({ 
        name: personalInfo.name, 
        schoolName: personalInfo.schoolName,
        themeColor: personalInfo.themeColor
      });
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
             <div className="absolute top-0 left-0 w-full h-24 opacity-20" style={{ backgroundColor: personalInfo.themeColor }}></div>
             <div className="relative z-10 mb-6">
                <div 
                  className="w-32 h-32 rounded-3xl flex items-center justify-center text-4xl font-black text-white shadow-xl transition-all duration-500"
                  style={{ backgroundColor: personalInfo.themeColor }}
                >
                  {user?.name.charAt(0)}
                </div>
             </div>
             <h3 className="text-xl font-black text-gray-900 dark:text-white truncate w-full italic leading-tight">{user?.name}</h3>
             <span className="mt-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-gray-100 dark:bg-gray-700">
                {user?.role}
             </span>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-soft border border-gray-100 dark:border-gray-700 p-6 space-y-4">
             <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl" style={{ color: personalInfo.themeColor }}><Mail size={18} /></div>
                <p className="truncate font-bold italic">{user?.email}</p>
             </div>
             <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl" style={{ color: personalInfo.themeColor }}><GraduationCap size={18} /></div>
                <p className="font-bold italic">{user?.className}</p>
             </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-700 p-8">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-2">
               <Palette size={20} style={{ color: personalInfo.themeColor }} /> Thème de Filière
            </h3>
            <div className="grid grid-cols-4 gap-3 mb-8">
              {THEME_COLORS.map((t) => (
                <button
                  key={t.color}
                  onClick={() => setPersonalInfo({...personalInfo, themeColor: t.color})}
                  className={`relative h-14 rounded-2xl transition-all flex items-center justify-center group ${personalInfo.themeColor === t.color ? 'ring-4 ring-offset-2 scale-105' : 'hover:scale-105'}`}
                  /* Fix: removed invalid 'ringColor' property */
                  style={{ backgroundColor: t.color }}
                >
                  {personalInfo.themeColor === t.color && <Check size={20} className="text-white" />}
                  <span className="absolute bottom-full mb-2 bg-gray-900 text-white text-[8px] font-black uppercase px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20">
                    {t.name}
                  </span>
                </button>
              ))}
            </div>

            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-2">
               <UserIcon size={20} style={{ color: personalInfo.themeColor }} /> Identité
            </h3>
            <form onSubmit={handleInfoChange} className="space-y-6">
                {/* Fix: removed invalid 'focusRingColor' style property */}
                <input required value={personalInfo.name} onChange={e => setPersonalInfo({...personalInfo, name: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none focus:ring-4 transition-all" placeholder="Nom Complet" />
                {/* Fix: removed invalid 'focusRingColor' style property */}
                <input value={personalInfo.schoolName} onChange={e => setPersonalInfo({...personalInfo, schoolName: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none focus:ring-4 transition-all" placeholder="Établissement" />
                <button 
                  type="submit" 
                  disabled={infoLoading} 
                  className="text-white px-8 py-3.5 rounded-2xl font-black shadow-lg flex items-center gap-2 uppercase tracking-widest active:scale-95 transition-all"
                  /* Fix: removed invalid 'shadowColor' property and replaced with 'boxShadow' */
                  style={{ backgroundColor: personalInfo.themeColor, boxShadow: `0 10px 15px -3px ${personalInfo.themeColor}33` }}
                >
                  {infoLoading ? <Loader2 className="animate-spin" /> : <Save size={20} />} Enregistrer
                </button>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-700 p-8">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-2">
               <Shield size={20} style={{ color: personalInfo.themeColor }} /> Sécurité
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
