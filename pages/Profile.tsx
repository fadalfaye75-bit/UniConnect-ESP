
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { UserAvatar } from '../components/Layout';
import { Lock, Save, Loader2, Shield, Mail, Briefcase, GraduationCap, User as UserIcon, Palette, Check, Bookmark, Megaphone, FileText, ChevronRight, ExternalLink, Trash2, StarOff, Archive } from 'lucide-react';
import { Announcement, ScheduleFile } from '../types';

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
  
  const [activeTab, setActiveTab] = useState<'info' | 'favorites'>('info');
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  
  const [personalInfo, setPersonalInfo] = useState({ name: '', schoolName: '', themeColor: '#0ea5e9' });
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  
  const [favoriteItems, setFavoriteItems] = useState<{
    announcements: Announcement[],
    schedules: ScheduleFile[]
  }>({ announcements: [], schedules: [] });

  useEffect(() => {
    if (user) {
      setPersonalInfo({ 
        name: user.name, 
        schoolName: user.schoolName || 'ESP Dakar',
        themeColor: user.themeColor || '#0ea5e9'
      });
    }
  }, [user]);

  const fetchFavorites = async () => {
    setFavLoading(true);
    try {
      const favs = await API.favorites.list();
      const annIds = favs.filter(f => f.content_type === 'announcement').map(f => f.content_id);
      const schIds = favs.filter(f => f.content_type === 'schedule').map(f => f.content_id);

      // Pour simplifier on récupère tout le flux et on filtre localement
      const [allAnns, allSchs] = await Promise.all([
        API.announcements.list(0, 1000),
        API.schedules.list()
      ]);

      setFavoriteItems({
        announcements: allAnns.filter(a => annIds.includes(a.id)),
        schedules: allSchs.filter(s => schIds.includes(s.id))
      });
    } catch (e) {
      console.warn("Failed to fetch favorites details");
    } finally {
      setFavLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'favorites') {
      fetchFavorites();
    }
  }, [activeTab]);

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

  const handleRemoveFavorite = async (id: string, type: 'announcement' | 'schedule') => {
    try {
      await API.favorites.toggle(id, type);
      if (type === 'announcement') {
        setFavoriteItems(prev => ({ ...prev, announcements: prev.announcements.filter(a => a.id !== id) }));
      } else {
        setFavoriteItems(prev => ({ ...prev, schedules: prev.schedules.filter(s => s.id !== id) }));
      }
      addNotification({ title: 'Retiré', message: 'Élément supprimé de vos favoris.', type: 'info' });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
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
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic">Mon Profil</h2>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('info')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'info' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Identité
          </button>
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'favorites' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Mes Favoris
          </button>
        </div>
      </div>

      {activeTab === 'info' ? (
        <div className="grid md:grid-cols-3 gap-8 animate-in fade-in duration-500">
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
                  <input required value={personalInfo.name} onChange={e => setPersonalInfo({...personalInfo, name: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none focus:ring-4 transition-all" placeholder="Nom Complet" />
                  <input value={personalInfo.schoolName} onChange={e => setPersonalInfo({...personalInfo, schoolName: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none focus:ring-4 transition-all" placeholder="Établissement" />
                  <button 
                    type="submit" 
                    disabled={infoLoading} 
                    className="text-white px-8 py-3.5 rounded-2xl font-black shadow-lg flex items-center gap-2 uppercase tracking-widest active:scale-95 transition-all"
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
                  <button type="submit" disabled={loading} className="bg-gray-900 dark:bg-gray-700 text-white px-8 py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95 w-full sm:w-auto">
                    {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />} Modifier
                  </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-10 animate-in slide-in-from-bottom-10 duration-500">
           {favLoading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-primary-500" size={40} />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Récupération de vos favoris...</p>
             </div>
           ) : (
             <>
               <section className="space-y-6">
                 <div className="flex items-center justify-between px-4">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.3em] flex items-center gap-3 italic">
                        <Megaphone size={18} style={{ color: personalInfo.themeColor }} /> Annonces Sauvegardées
                    </h3>
                    <span className="text-[10px] font-black px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 uppercase tracking-widest">{favoriteItems.announcements.length} éléments</span>
                 </div>
                 
                 <div className="grid gap-4">
                    {favoriteItems.announcements.length > 0 ? favoriteItems.announcements.map(ann => (
                      <div key={ann.id} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-soft border border-gray-100 dark:border-gray-700 flex items-center gap-6 group hover:border-amber-400 transition-all">
                        <div className="w-14 h-14 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center font-black text-lg text-gray-400 shrink-0">
                          {ann.author.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="font-black italic text-gray-900 dark:text-white truncate">{ann.title}</h4>
                           <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-widest">{new Date(ann.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => window.location.href = '#/announcements'} className="p-3 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-all" title="Voir l'annonce"><ExternalLink size={18}/></button>
                           <button onClick={() => handleRemoveFavorite(ann.id, 'announcement')} className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Retirer des favoris"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    )) : (
                      <div className="py-20 text-center bg-gray-50/50 dark:bg-gray-800/30 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
                         <StarOff size={32} className="mx-auto text-gray-300 mb-4" />
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aucune annonce marquée</p>
                      </div>
                    )}
                 </div>
               </section>

               <section className="space-y-6">
                 <div className="flex items-center justify-between px-4">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.3em] flex items-center gap-3 italic">
                        <FileText size={18} style={{ color: personalInfo.themeColor }} /> Emplois du Temps & Docs
                    </h3>
                    <span className="text-[10px] font-black px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 uppercase tracking-widest">{favoriteItems.schedules.length} éléments</span>
                 </div>

                 <div className="grid gap-4">
                    {favoriteItems.schedules.length > 0 ? favoriteItems.schedules.map(sch => (
                      <div key={sch.id} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-soft border border-gray-100 dark:border-gray-700 flex items-center gap-6 group hover:border-emerald-400 transition-all">
                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
                          <FileText size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="font-black italic text-gray-900 dark:text-white truncate">{sch.category} - {sch.version}</h4>
                           <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-widest">{sch.className || 'ESP Global'}</p>
                        </div>
                        <div className="flex gap-2">
                           <a href={sch.url} target="_blank" rel="noreferrer" className="p-3 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all" title="Ouvrir le document"><ExternalLink size={18}/></a>
                           <button onClick={() => handleRemoveFavorite(sch.id, 'schedule')} className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Retirer des favoris"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    )) : (
                      <div className="py-20 text-center bg-gray-50/50 dark:bg-gray-800/30 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
                         <Archive size={32} className="mx-auto text-gray-300 mb-4" />
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aucun document marqué</p>
                      </div>
                    )}
                 </div>
               </section>
             </>
           )}
        </div>
      )}
    </div>
  );
}
