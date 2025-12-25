
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { UserAvatar } from '../components/Layout';
import { Lock, Save, Loader2, Shield, Mail, Briefcase, GraduationCap, User as UserIcon, Palette, Check, Bookmark, Megaphone, FileText, ChevronRight, ExternalLink, Trash2, StarOff, Archive, CheckCircle2, MapPin, School, Eye, EyeOff, Copy, ClipboardCheck, LogOut } from 'lucide-react';
import { Announcement, ScheduleFile, ClassGroup } from '../types';

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
  const { user, updateCurrentUser, logout } = useAuth();
  const { addNotification } = useNotification();
  
  const [activeTab, setActiveTab] = useState<'info' | 'favorites'>('info');
  const [loadingPass, setLoadingPass] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  
  const [personalInfo, setPersonalInfo] = useState({ name: '', schoolName: '', themeColor: '#0ea5e9' });
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userClass, setUserClass] = useState<ClassGroup | null>(null);
  
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
      
      API.classes.list().then(list => {
        const found = list.find(c => c.name === user.className);
        if (found) setUserClass(found);
      });
    }
  }, [user]);

  const fetchFavorites = useCallback(async () => {
    setFavLoading(true);
    try {
      const favs = await API.favorites.list();
      const annIds = favs.filter(f => f.content_type === 'announcement').map(f => f.content_id);
      const schIds = favs.filter(f => f.content_type === 'schedule').map(f => f.content_id);

      const [allAnns, allSchs] = await Promise.all([
        API.announcements.list(0, 1000),
        API.schedules.list()
      ]);

      setFavoriteItems({
        announcements: allAnns.filter(a => annIds.includes(a.id)),
        schedules: allSchs.filter(s => schIds.includes(s.id))
      });
    } catch (e) {
      console.warn("Fav fetch issues");
    } finally {
      setFavLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'favorites') {
      fetchFavorites();
    }
  }, [activeTab, fetchFavorites]);

  const handleInfoChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoLoading(true);
    try {
      await updateCurrentUser({ 
        name: personalInfo.name, 
        schoolName: personalInfo.schoolName,
        themeColor: personalInfo.themeColor
      });
      addNotification({ title: 'Succès', message: 'Profil mis à jour.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    } finally {
      setInfoLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Voulez-vous vraiment quitter le portail ?")) {
      await logout();
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
      addNotification({ title: 'Retiré', message: 'Favori supprimé.', type: 'info' });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleCopyPassword = () => {
    if (!passwords.newPassword) return;
    navigator.clipboard.writeText(passwords.newPassword);
    setCopied(true);
    addNotification({ title: 'Copié', message: 'Mot de passe prêt.', type: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      addNotification({ title: 'Attention', message: 'Les mots de passe ne correspondent pas.', type: 'alert' });
      return;
    }
    if (passwords.newPassword.length < 6) {
      addNotification({ title: 'Sécurité', message: 'Le mot de passe doit comporter au moins 6 caractères.', type: 'warning' });
      return;
    }
    
    setLoadingPass(true);
    try {
      if(user) await API.auth.updatePassword(user.id, passwords.newPassword);
      addNotification({ title: 'Sécurisé', message: 'Votre mot de passe a été modifié avec succès.', type: 'success' });
      setPasswords({ newPassword: '', confirmPassword: '' });
      setShowPassword(false);
    } catch (error: any) {
      addNotification({ 
        title: 'Erreur Sécurité', 
        message: error.message || 'Échec de la modification.', 
        type: 'alert' 
      });
    } finally {
      setLoadingPass(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-32 animate-fade-in">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-10">
        <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase leading-none">Mon Profil</h2>
        <div className="flex bg-white dark:bg-gray-800 p-2 rounded-[2rem] shadow-soft border border-gray-50 dark:border-gray-700">
          <button 
            onClick={() => setActiveTab('info')}
            className={`px-8 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'info' ? 'bg-gray-900 text-white shadow-xl' : 'text-gray-400 hover:text-gray-900'}`}
          >
            Identité & Thème
          </button>
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`px-8 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'favorites' ? 'bg-gray-900 text-white shadow-xl' : 'text-gray-400 hover:text-gray-900'}`}
          >
            Mes Favoris
          </button>
        </div>
      </div>

      {activeTab === 'info' ? (
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-[3.5rem] shadow-soft border border-gray-100 dark:border-gray-800 p-10 flex flex-col items-center text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-32 opacity-20 transition-all duration-1000 group-hover:h-40" style={{ backgroundColor: personalInfo.themeColor }}></div>
              <div className="relative z-10 mb-8 transform group-hover:scale-105 transition-transform duration-500">
                  <div 
                    className="w-36 h-36 rounded-[3rem] flex items-center justify-center text-5xl font-black text-white shadow-2xl border-4 border-white dark:border-gray-900"
                    style={{ backgroundColor: personalInfo.themeColor }}
                  >
                    {user?.name.charAt(0)}
                  </div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white truncate w-full italic tracking-tighter leading-tight">{user?.name}</h3>
              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-primary-500 bg-primary-50 px-4 py-1.5 rounded-full">{user?.role}</p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 p-8 space-y-6">
              <div className="flex items-center gap-5 text-gray-600 dark:text-gray-400">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-sm" style={{ color: personalInfo.themeColor }}><Mail size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Contact</p>
                    <p className="truncate font-bold italic text-sm">{user?.email}</p>
                  </div>
              </div>
              <div className="flex items-center gap-5 text-gray-600 dark:text-gray-400">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-sm" style={{ color: personalInfo.themeColor }}><GraduationCap size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Section</p>
                    <p className="font-bold italic text-sm truncate">{user?.className}</p>
                  </div>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/10 rounded-[3rem] p-8 border border-red-100 dark:border-red-900/30 text-center">
               <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">Fin de session</h4>
               <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-gray-800 text-red-600 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-sm hover:bg-red-600 hover:text-white transition-all active:scale-95 italic"
               >
                  <LogOut size={16} /> Quitter UniConnect
               </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-gray-900 rounded-[3.5rem] shadow-soft border border-gray-100 dark:border-gray-800 p-10">
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center gap-3 italic">
                <Palette size={24} style={{ color: personalInfo.themeColor }} /> Thème & Identité Visuelle
              </h3>
              
              <div className="mb-10 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Couleurs Disponibles</label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                    {THEME_COLORS.map((t) => (
                      <button
                        key={t.color}
                        onClick={() => setPersonalInfo({...personalInfo, themeColor: t.color})}
                        className={`relative h-12 rounded-xl transition-all flex items-center justify-center group ${personalInfo.themeColor === t.color ? 'ring-4 ring-offset-4 ring-gray-100 scale-110 shadow-lg' : 'hover:scale-105 shadow-sm'}`}
                        style={{ backgroundColor: t.color }}
                      >
                        {personalInfo.themeColor === t.color && <Check size={20} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {userClass && userClass.color && (
                  <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center gap-6 group">
                     <div className="w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: userClass.color }}>
                        <School size={32} />
                     </div>
                     <div className="flex-1 text-center sm:text-left">
                        <h4 className="text-sm font-black italic text-gray-900 dark:text-white uppercase tracking-tight">Thème de votre filière</h4>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">Utilisez la couleur officielle de la {userClass.name}.</p>
                     </div>
                     <button 
                        type="button" 
                        onClick={() => setPersonalInfo({...personalInfo, themeColor: userClass.color!})}
                        className="px-6 py-3 bg-white dark:bg-gray-700 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 hover:bg-gray-900 hover:text-white transition-all active:scale-95"
                     >
                       Appliquer
                     </button>
                  </div>
                )}
              </div>

              <form onSubmit={handleInfoChange} className="space-y-8">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Nom d'affichage</label>
                      <input required value={personalInfo.name} onChange={e => setPersonalInfo({...personalInfo, name: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold italic text-sm outline-none border-none focus:ring-4 focus:ring-primary-50 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Établissement</label>
                      <input value={personalInfo.schoolName} onChange={e => setPersonalInfo({...personalInfo, schoolName: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold italic text-sm outline-none border-none focus:ring-4 focus:ring-primary-50 transition-all" />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={infoLoading} 
                    className="w-full sm:w-auto text-white px-12 py-5 rounded-[2rem] font-black shadow-2xl flex items-center justify-center gap-3 uppercase tracking-widest italic text-xs active:scale-95 transition-all hover:brightness-110"
                    style={{ backgroundColor: personalInfo.themeColor, boxShadow: `0 15px 30px -5px ${personalInfo.themeColor}55` }}
                  >
                    {infoLoading ? <Loader2 className="animate-spin" /> : <Save size={20} />} Enregistrer le profil
                  </button>
              </form>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-[3.5rem] shadow-soft border border-gray-100 dark:border-gray-800 p-10">
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-10 uppercase tracking-widest flex items-center gap-3 italic">
                <Shield size={24} style={{ color: personalInfo.themeColor }} /> Accès & Sécurité
              </h3>
              <form onSubmit={handlePasswordChange} className="space-y-8">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Nouveau mot de passe</label>
                      <div className="relative">
                        <input required type={showPassword ? "text" : "password"} value={passwords.newPassword} onChange={e => setPasswords({...passwords, newPassword: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none border-none focus:ring-4 focus:ring-gray-100 transition-all pr-24" placeholder="••••••••" />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button type="button" onClick={handleCopyPassword} disabled={!passwords.newPassword} className="p-2 text-gray-400 hover:text-primary-500 transition-colors disabled:opacity-30">
                            {copied ? <ClipboardCheck size={18} className="text-emerald-500" /> : <Copy size={18} />}
                          </button>
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Confirmer le code</label>
                      <input required type={showPassword ? "text" : "password"} value={passwords.confirmPassword} onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none border-none focus:ring-4 focus:ring-gray-100 transition-all" placeholder="••••••••" />
                    </div>
                  </div>
                  <button type="submit" disabled={loadingPass} className="w-full sm:w-auto bg-gray-900 dark:bg-black text-white px-12 py-5 rounded-[2rem] font-black flex items-center justify-center gap-3 uppercase tracking-widest italic text-xs active:scale-95 transition-all shadow-xl">
                    {loadingPass ? <Loader2 className="animate-spin" /> : <Lock size={20} />} Mettre à jour la sécurité
                  </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-12 animate-in slide-in-from-bottom-5 duration-700">
           {favLoading ? (
             <div className="flex flex-col items-center justify-center py-32 gap-6">
                <Loader2 className="animate-spin text-amber-500" size={50} />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Indexation des éléments favoris...</p>
             </div>
           ) : (
             <>
               <section className="space-y-8">
                 <div className="flex items-center justify-between px-6">
                    <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] flex items-center gap-4 italic">
                        <Megaphone size={18} style={{ color: personalInfo.themeColor }} /> Actualités Épinglées
                    </h3>
                    <span className="text-[10px] font-black px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full uppercase tracking-widest shadow-sm">{favoriteItems.announcements.length} ARCHIVÉS</span>
                 </div>
                 
                 <div className="grid gap-6">
                    {favoriteItems.announcements.length > 0 ? favoriteItems.announcements.map(ann => (
                      <div key={ann.id} className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-soft border-2 border-transparent hover:border-amber-100 transition-all flex items-center gap-10 group overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400 opacity-50" />
                        <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-3xl flex items-center justify-center font-black text-2xl text-gray-300 shrink-0 shadow-inner group-hover:rotate-6 transition-transform">
                          {ann.author.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="text-xl font-black italic text-gray-900 dark:text-white truncate group-hover:text-amber-600 transition-colors">{ann.title}</h4>
                           <p className="text-[10px] font-bold text-gray-400 uppercase mt-2 tracking-[0.2em]">{new Date(ann.date).toLocaleDateString('fr-FR', {day:'numeric', month:'long'})} • PAR {ann.author}</p>
                        </div>
                        <div className="flex gap-3 relative z-10">
                           <button onClick={() => window.location.hash = '#/announcements'} className="p-4 text-gray-400 hover:text-amber-500 bg-gray-50 dark:bg-gray-800 rounded-2xl transition-all shadow-sm active:scale-90"><ExternalLink size={20}/></button>
                           <button onClick={() => handleRemoveFavorite(ann.id, 'announcement')} className="p-4 text-red-400 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-900/10 rounded-2xl transition-all shadow-sm active:scale-90"><Trash2 size={20}/></button>
                        </div>
                      </div>
                    )) : (
                      <div className="py-24 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                         <StarOff size={48} className="mx-auto text-gray-100 mb-6" />
                         <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucune actualité en favori</p>
                      </div>
                    )}
                 </div>
               </section>

               <section className="space-y-8">
                 <div className="flex items-center justify-between px-6">
                    <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] flex items-center gap-4 italic">
                        <FileText size={18} style={{ color: personalInfo.themeColor }} /> Ressources & Documents
                    </h3>
                    <span className="text-[10px] font-black px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full uppercase tracking-widest shadow-sm">{favoriteItems.schedules.length} DOCUMENTS</span>
                 </div>

                 <div className="grid gap-6">
                    {favoriteItems.schedules.length > 0 ? favoriteItems.schedules.map(sch => (
                      <div key={sch.id} className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-soft border-2 border-transparent hover:border-emerald-100 transition-all flex items-center gap-10 group overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-400 opacity-50" />
                        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-3xl flex items-center justify-center shrink-0 shadow-inner group-hover:-rotate-6 transition-transform">
                          <FileText size={32} />
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="text-xl font-black italic text-gray-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">{sch.category} - {sch.version}</h4>
                           <p className="text-[10px] font-bold text-gray-400 uppercase mt-2 tracking-[0.2em]">{sch.className || 'ESP Global'} • MIS À JOUR LE {new Date(sch.uploadDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-3 relative z-10">
                           <a href={sch.url} target="_blank" rel="noreferrer" className="p-4 text-emerald-500 hover:text-white hover:bg-emerald-500 bg-emerald-50 dark:bg-red-900/10 rounded-2xl transition-all shadow-sm active:scale-90"><ExternalLink size={20}/></a>
                           <button onClick={() => handleRemoveFavorite(sch.id, 'schedule')} className="p-4 text-red-400 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-900/10 rounded-2xl transition-all shadow-sm active:scale-90"><Trash2 size={20}/></button>
                        </div>
                      </div>
                    )) : (
                      <div className="py-24 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                         <Archive size={48} className="mx-auto text-gray-100 mb-6" />
                         <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucun document archivé</p>
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
