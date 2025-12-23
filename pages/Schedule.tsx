
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileSpreadsheet, Download, Clock, Upload, History, Loader2, Trash2, Save, X, Share2, Copy, Bookmark, Calendar as CalendarIcon, Sparkles, FileText, GraduationCap, BookOpen, Layers, Filter, CalendarDays, ChevronDown, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, ScheduleFile, ScheduleCategory } from '../types';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import Modal from '../components/Modal';

// Helper to get the Monday of a given date for week grouping
const getMonday = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

export default function Schedule() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [schedules, setSchedules] = useState<ScheduleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState<ScheduleCategory | 'Toutes'>('Toutes');
  const [activeWeek, setActiveWeek] = useState<string>('all');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newFileCategory, setNewFileCategory] = useState<ScheduleCategory>('Planning');

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  const fetchSchedules = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true);
      const data = await API.schedules.list();
      setSchedules(data.sort((a,b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
      
      const favs = await API.favorites.list();
      setFavoriteIds(new Set(favs.filter(f => f.content_type === 'schedule').map(f => f.content_id)));
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger les fichiers.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchSchedules(true);
  }, [user, adminViewClass, fetchSchedules]);

  // Extract unique weeks for the filter dropdown
  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    schedules.forEach(s => {
      weeks.add(getMonday(new Date(s.uploadDate)));
    });
    return Array.from(weeks).sort((a, b) => b.localeCompare(a));
  }, [schedules]);

  const displayedSchedules = useMemo(() => {
    return schedules.filter(sch => {
      const target = sch.className || 'Général';
      const matchesClass = user?.role === UserRole.ADMIN 
        ? (adminViewClass ? (target === adminViewClass || target === 'Général') : true)
        : (target === user?.className || target === 'Général');
      
      const matchesCategory = activeCategory === 'Toutes' || sch.category === activeCategory;
      const matchesWeek = activeWeek === 'all' || getMonday(new Date(sch.uploadDate)) === activeWeek;
      const matchesFavorites = !showOnlyFavorites || favoriteIds.has(sch.id);
      
      return matchesClass && matchesCategory && matchesWeek && matchesFavorites;
    });
  }, [user, adminViewClass, schedules, activeCategory, activeWeek, showOnlyFavorites, favoriteIds]);

  const handleToggleFavorite = async (id: string) => {
    try {
      const added = await API.favorites.toggle(id, 'schedule');
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (added) next.add(id);
        else next.delete(id);
        return next;
      });
      addNotification({ 
        title: added ? 'Ajouté aux favoris' : 'Retiré des favoris', 
        message: added ? 'Document sauvegardé.' : 'Favori retiré.', 
        type: 'success' 
      });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleRelay = async (sch: ScheduleFile) => {
    const structuredContent = `📄 *UniConnect - Nouveau Document*\n\n📂 *Type:* ${sch.category}\n🔢 *Version:* ${sch.version}\n🎓 *Classe:* ${sch.className || 'ESP Dakar'}\n📅 *Publié le:* ${new Date(sch.uploadDate).toLocaleDateString()}\n\n📥 _Consultable directement sur le portail étudiant UniConnect._`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `UniConnect: ${sch.category}`,
          text: structuredContent
        });
      } else {
        await navigator.clipboard.writeText(structuredContent);
        addNotification({ title: 'Contenu copié', message: 'Fiche du document prête pour diffusion.', type: 'success' });
      }
    } catch (e) {
      console.debug("Share document ended", e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 5, 98));
    }, 50);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      clearInterval(progressInterval);
      setUploadProgress(100);

      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const countInCategory = schedules.filter(s => s.category === newFileCategory).length;
      
      await API.schedules.create({
        version: `V${countInCategory + 1}`,
        url: "https://example.com/document-esp.pdf",
        className: targetClass,
        category: newFileCategory
      });

      fetchSchedules();
      addNotification({ title: 'Publié', message: 'Document disponible.', type: 'success' });
      setShowUploadModal(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: "Échec.", type: 'alert' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer ce document ?")) return;
    try {
      await API.schedules.delete(id);
      fetchSchedules();
      addNotification({ title: 'Supprimé', message: 'Le fichier a été retiré.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const getCategoryIcon = (cat: ScheduleCategory) => {
    switch(cat) {
        case 'Planning': return <Clock size={20} />;
        case 'Examens': return <GraduationCap size={20} />;
        case 'Cours': return <BookOpen size={20} />;
        default: return <FileText size={20} />;
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Indexation des documents...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-24 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 py-8 z-20 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg">
              <CalendarIcon size={30} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none">Emplois du Temps</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">
                {user?.role === UserRole.ADMIN && adminViewClass ? adminViewClass : (user?.className || 'Portail Académique')}
              </p>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`p-4 rounded-2xl transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border-2 ${showOnlyFavorites ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 hover:border-amber-400'}`}
          >
            <Star size={16} className={showOnlyFavorites ? 'fill-current' : ''} />
            <span className="hidden sm:inline">Mes Favoris</span>
          </button>
          
          {canManage && (
            <button onClick={() => setShowUploadModal(true)} className="bg-primary-500 text-white px-8 py-4 rounded-2xl text-sm font-black shadow-xl active:scale-95 transition-all uppercase tracking-widest">
               <Upload size={20} className="inline mr-2" /> <span className="hidden sm:inline">Nouveau document</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl text-primary-500">
           <Filter size={20} />
           <span className="text-[10px] font-black uppercase tracking-widest">Filtres</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
           <div className="relative group">
              <Layers className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select 
                value={activeCategory} 
                onChange={e => setActiveCategory(e.target.value as any)}
                className="w-full pl-14 pr-6 py-4 bg-transparent border-2 border-gray-50 dark:border-gray-800 rounded-2xl text-xs font-black uppercase tracking-widest outline-none cursor-pointer focus:border-primary-400 transition-all appearance-none italic"
              >
                 <option value="Toutes">Toutes les catégories</option>
                 <option value="Planning">Planning hebdomadaire</option>
                 <option value="Examens">Calendrier Examens</option>
                 <option value="Cours">Supports de Cours</option>
                 <option value="Autre">Autres documents</option>
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
           </div>

           <div className="relative group">
              <CalendarDays className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select 
                value={activeWeek} 
                onChange={e => setActiveWeek(e.target.value)}
                className="w-full pl-14 pr-6 py-4 bg-transparent border-2 border-gray-50 dark:border-gray-800 rounded-2xl text-xs font-black uppercase tracking-widest outline-none cursor-pointer focus:border-primary-400 transition-all appearance-none italic"
              >
                 <option value="all">Toutes les semaines</option>
                 {availableWeeks.map(week => (
                   <option key={week} value={week}>
                     Semaine du {new Date(week).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                   </option>
                 ))}
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
           </div>
        </div>
      </div>

      {/* Grid Section */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {displayedSchedules.length > 0 ? displayedSchedules.map((sch) => {
            const isFavorite = favoriteIds.has(sch.id);
            const uploadDate = new Date(sch.uploadDate);
            return (
            <div key={sch.id} className="group bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-soft border border-gray-100 dark:border-gray-800 hover:border-emerald-400 transition-all flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-start mb-8 relative z-10">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-2xl">
                        {getCategoryIcon(sch.category)}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => handleRelay(sch)} className="p-2.5 bg-gray-900 text-white rounded-xl shadow-lg hover:scale-110 transition-all"><Share2 size={16}/></button>
                         <button onClick={() => handleToggleFavorite(sch.id)} className={`p-2.5 rounded-xl border transition-all ${isFavorite ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-gray-100 text-gray-400 hover:text-amber-500'}`}><Bookmark size={16} className={isFavorite ? 'fill-current' : ''} /></button>
                         {canManage && <button onClick={(e) => handleDelete(e, sch.id)} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16}/></button>}
                    </div>
                </div>

                <div className="mb-8 relative z-10">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">{sch.category}</span>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight tracking-tighter italic">{sch.category} - {sch.version}</h3>
                    <div className="flex items-center gap-2 mt-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider italic">
                       <Clock size={12} /> Publié le {uploadDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                </div>

                <div className="mt-auto space-y-3 relative z-10">
                    <a href={sch.url} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-black shadow-xl transition-all uppercase tracking-widest text-[10px] italic">
                        <Download size={18} /> Consulter le document
                    </a>
                </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-24 text-center bg-white dark:bg-gray-900 rounded-[3.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800 animate-fade-in">
             <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <CalendarIcon size={32} className="text-gray-200" />
             </div>
             <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">
               {showOnlyFavorites ? "Vous n'avez aucun document en favoris" : "Aucun document pour cette sélection"}
             </p>
             <button onClick={() => { setActiveCategory('Toutes'); setActiveWeek('all'); setShowOnlyFavorites(false); }} className="mt-6 text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:underline">Réinitialiser les filtres</button>
          </div>
        )}
      </div>

      <Modal isOpen={showUploadModal} onClose={() => !uploading && setShowUploadModal(false)} title="Diffuser un document">
         <div className="space-y-6">
            <div className="p-10 border-4 border-dashed border-gray-100 dark:border-gray-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-primary-400 transition-colors cursor-pointer relative group">
               <FileUp size={48} className="text-gray-200 group-hover:text-primary-500 transition-colors" />
               <p className="text-xs font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-600">Glisser ou cliquer pour charger</p>
               <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            
            <div className="space-y-2">
               <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Catégorie du document</label>
               <select value={newFileCategory} onChange={e => setNewFileCategory(e.target.value as ScheduleCategory)} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-black text-[10px] uppercase outline-none border-none">
                   <option value="Planning">Planning</option>
                   <option value="Examens">Calendrier Examens</option>
                   <option value="Cours">Support de Cours</option>
                   <option value="Autre">Autre document</option>
               </select>
            </div>

            {uploading && (
               <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary-500">
                     <span>Traitement en cours...</span>
                     <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                     <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
               </div>
            )}
         </div>
      </Modal>
    </div>
  );
}

// Re-using icon for upload modal
const FileUp = ({ size, className }: { size: number, className: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
