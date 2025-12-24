
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileSpreadsheet, Download, Clock, Upload, History, Loader2, Trash2, Save, X, Share2, Copy, Bookmark, Calendar as CalendarIcon, Sparkles, FileText, GraduationCap, BookOpen, Layers, Filter, CalendarDays, ChevronDown, Star, ExternalLink, Archive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, ScheduleFile, ScheduleCategory } from '../types';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import Modal from '../components/Modal';

const getMonday = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

const CATEGORY_STYLES = {
  'Planning': { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600', icon: CalendarDays },
  'Examens': { color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-600', icon: GraduationCap },
  'Cours': { color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-600', icon: BookOpen },
  'Autre': { color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-600', icon: Layers }
};

export default function Schedule() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const themeColor = user?.themeColor || '#0ea5e9';
  
  const [schedules, setSchedules] = useState<ScheduleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ScheduleCategory | 'Toutes'>('Toutes');
  const [activeWeek, setActiveWeek] = useState<string>('all');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newFileCategory, setNewFileCategory] = useState<ScheduleCategory>('Planning');
  const [newFileVersion, setNewFileVersion] = useState('');

  const isAdmin = user?.role === UserRole.ADMIN;
  const canPost = API.auth.canPost(user);

  const fetchSchedules = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true);
      const data = await API.schedules.list();
      setSchedules(data);
      const favs = await API.favorites.list();
      setFavoriteIds(new Set(favs.filter(f => f.content_type === 'schedule').map(f => f.content_id)));
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Chargement échoué.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchSchedules(true);
  }, [user, adminViewClass, fetchSchedules]);

  const handleShare = async (sch: ScheduleFile) => {
    const dateStr = new Date(sch.uploadDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const shareText = `📂 *UniConnect ESP - Document Partagé*\n\n📁 *Catégorie:* ${sch.category}\n📄 *Version:* ${sch.version}\n🏫 *Classe:* ${sch.className || 'Global'}\n🗓️ *Date:* ${dateStr}\n\n📥 *Téléchargement:* ${sch.url}\n\n#ESP #Documents`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Document: ${sch.version}`,
          text: shareText
        });
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        addNotification({ title: 'Lien copié', message: 'Détails du document prêts pour WhatsApp/Slack.', type: 'success' });
      } catch (err) {
        addNotification({ title: 'Erreur', message: 'Impossible de copier les infos.', type: 'alert' });
      }
    }
  };

  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    schedules.forEach(s => { weeks.add(getMonday(new Date(s.uploadDate))); });
    return Array.from(weeks).sort((a, b) => b.localeCompare(a));
  }, [schedules]);

  const displayedSchedules = useMemo(() => {
    return schedules.filter(sch => {
      const target = sch.className || 'Général';
      if (!isAdmin && target !== 'Général' && target !== user?.className) return false;
      
      const matchesCategory = activeCategory === 'Toutes' || sch.category === activeCategory;
      const matchesWeek = activeWeek === 'all' || getMonday(new Date(sch.uploadDate)) === activeWeek;
      const matchesFavorites = !showOnlyFavorites || favoriteIds.has(sch.id);
      
      return matchesCategory && matchesWeek && matchesFavorites;
    });
  }, [user, isAdmin, schedules, activeCategory, activeWeek, showOnlyFavorites, favoriteIds]);

  const handleToggleFavorite = async (id: string) => {
    try {
      const added = await API.favorites.toggle(id, 'schedule');
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (added) next.add(id); else next.delete(id);
        return next;
      });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    try {
      const targetClass = isAdmin ? (adminViewClass || 'Général') : (user?.className || 'Général');
      await API.schedules.create({
        version: newFileVersion || `V${schedules.length + 1}`,
        url: "https://example.com/doc.pdf", // Simulée
        className: targetClass,
        category: newFileCategory
      });
      fetchSchedules();
      setShowUploadModal(false);
      setNewFileVersion('');
      addNotification({ title: 'Succès', message: 'Document publié.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Échec de l'envoi.", type: 'alert' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer définitivement ce document ?")) return;
    try {
      await API.schedules.delete(id);
      fetchSchedules();
      addNotification({ title: 'Supprimé', message: 'Le fichier a été archivé.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-6">
        <Loader2 className="animate-spin" style={{ color: themeColor }} size={40} />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Indexation des documents...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 text-white rounded-[1.8rem] flex items-center justify-center shadow-xl rotate-3" style={{ backgroundColor: '#10b981' }}>
              <Archive size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Dépôt de Documents</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3">Archives & Plannings • {user?.className || 'Global'}</p>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setShowOnlyFavorites(!showOnlyFavorites)} className={`p-5 rounded-2xl transition-all shadow-lg active:scale-95 ${showOnlyFavorites ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-900 text-gray-400 border border-gray-100 dark:border-gray-800'}`}>
            <Star size={24} className={showOnlyFavorites ? 'fill-current' : ''} />
          </button>
          {canPost && (
            <button onClick={() => setShowUploadModal(true)} className="flex items-center justify-center gap-3 bg-gray-900 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all italic hover:bg-black">
               <Upload size={20} /> Diffuser un fichier
            </button>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-gray-900 p-4 rounded-[2.5rem] shadow-soft border border-gray-50 dark:border-gray-800">
          <select value={activeCategory} onChange={e => setActiveCategory(e.target.value as any)} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none border-none cursor-pointer">
             <option value="Toutes">Tous les types</option>
             <option value="Planning">Emplois du Temps</option>
             <option value="Examens">Calendriers d'Examens</option>
             <option value="Cours">Supports de Cours</option>
             <option value="Autre">Autres Ressources</option>
          </select>
          <select value={activeWeek} onChange={e => setActiveWeek(e.target.value)} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none border-none cursor-pointer">
             <option value="all">Toutes les archives</option>
             {availableWeeks.map(week => <option key={week} value={week}>Semaine du {new Date(week).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}</option>)}
          </select>
      </div>

      {/* Results Grid */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {displayedSchedules.map((sch) => {
          // Suppression réservée aux administrateurs (sync RLS)
          const canDelete = API.auth.canDelete(user);
          const style = CATEGORY_STYLES[sch.category] || CATEGORY_STYLES['Autre'];
          const CatIcon = style.icon;

          return (
            <div key={sch.id} className="group relative bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border-2 border-transparent hover:border-emerald-100 transition-all flex flex-col overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 dark:bg-gray-800 -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-30"></div>
                
                <div className="flex justify-between items-start mb-10 relative z-10">
                    <div className={`p-5 ${style.bg} ${style.text} rounded-[1.8rem] shadow-sm`}>
                      <CatIcon size={24} />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                         <button onClick={() => handleShare(sch)} className="p-3 bg-white dark:bg-gray-800 text-gray-400 hover:text-primary-500 rounded-xl border transition-all" title="Partager"><Share2 size={18}/></button>
                         <button onClick={() => handleToggleFavorite(sch.id)} className={`p-3 rounded-xl border transition-all ${favoriteIds.has(sch.id) ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-white dark:bg-gray-900 text-gray-400'}`}><Bookmark size={18}/></button>
                         {canDelete && <button onClick={() => handleDelete(sch.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18}/></button>}
                    </div>
                </div>

                <div className="flex-1 relative z-10">
                  <span className={`text-[8px] font-black uppercase tracking-widest mb-3 inline-block px-3 py-1 rounded-full ${style.bg} ${style.text}`}>
                    {sch.category}
                  </span>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight italic tracking-tighter mb-4">{sch.version}</h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-8">{new Date(sch.uploadDate).toLocaleDateString()} • {sch.className || 'ESP'}</p>
                </div>

                <a href={sch.url} target="_blank" rel="noreferrer" className="relative z-10 w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest italic shadow-xl active:scale-95 transition-all hover:bg-black">
                    <Download size={18} /> Télécharger
                </a>
            </div>
          );
        })}

        {displayedSchedules.length === 0 && (
           <div className="sm:col-span-2 lg:col-span-3 py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <FileText size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucun document ne correspond aux filtres</p>
           </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Diffuser une ressource">
         <div className="space-y-8">
            <div className="p-16 border-4 border-dashed border-gray-100 dark:border-gray-700 rounded-[3rem] flex flex-col items-center justify-center gap-6 hover:border-emerald-400 transition-all cursor-pointer relative group bg-gray-50/50 dark:bg-gray-800/30">
               {uploading ? <Loader2 size={64} className="text-emerald-500 animate-spin" /> : <Upload size={64} className="text-gray-200 group-hover:text-emerald-500 transition-colors" />}
               <p className="text-xs font-black text-gray-400 uppercase tracking-widest group-hover:text-emerald-600">Cliquer pour charger le PDF</p>
               <input type="file" disabled={uploading} onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Titre / Version du document</label>
                <input value={newFileVersion} onChange={e => setNewFileVersion(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold italic text-sm outline-none border-none" placeholder="ex: Semaine du 25 Mai 2025" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Type de document</label>
                <select value={newFileCategory} onChange={e => setNewFileCategory(e.target.value as any)} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-black text-[10px] uppercase outline-none border-none cursor-pointer">
                   <option value="Planning">Planning Hebdomadaire</option>
                   <option value="Examens">Calendrier d'Examens</option>
                   <option value="Cours">Supports de Cours</option>
                   <option value="Autre">Autre Document</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex gap-4">
               <Sparkles size={24} className="shrink-0" />
               <p className="text-[10px] font-bold italic leading-relaxed uppercase tracking-tight">Le document sera immédiatement visible pour tous les étudiants de la filière sélectionnée.</p>
            </div>
         </div>
      </Modal>
    </div>
  );
}
