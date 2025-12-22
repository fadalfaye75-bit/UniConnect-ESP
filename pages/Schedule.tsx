
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileSpreadsheet, Download, Clock, Upload, History, Loader2, Trash2, Save, X, Share2, Copy, Bookmark, Calendar as CalendarIcon, Sparkles, FileText, GraduationCap, BookOpen, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, ScheduleFile, ScheduleCategory } from '../types';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import Modal from '../components/Modal';

export default function Schedule() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [schedules, setSchedules] = useState<ScheduleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState<ScheduleCategory | 'Touts'>('Touts');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  
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

  const displayedSchedules = useMemo(() => {
    return schedules.filter(sch => {
      const target = sch.className || 'Général';
      const matchesClass = user?.role === UserRole.ADMIN 
        ? (adminViewClass ? (target === adminViewClass || target === 'Général') : true)
        : (target === user?.className || target === 'Général');
      
      const matchesCategory = activeCategory === 'Touts' || sch.category === activeCategory;
      
      return matchesClass && matchesCategory;
    });
  }, [user, adminViewClass, schedules, activeCategory]);

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
        
        {canManage && (
          <button onClick={() => setShowUploadModal(true)} className="bg-primary-500 text-white px-8 py-4 rounded-2xl text-sm font-black shadow-xl active:scale-95 transition-all uppercase tracking-widest">
             <Upload size={20} className="inline mr-2" /> Nouveau document
          </button>
        )}
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {displayedSchedules.map((sch) => {
            const isFavorite = favoriteIds.has(sch.id);
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
                    <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase">{sch.className || 'Global'}</p>
                </div>

                <div className="mt-auto space-y-3 relative z-10">
                    <a href={sch.url} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-black shadow-xl transition-all uppercase tracking-widest text-[10px]">
                        <Download size={18} /> Consulter
                    </a>
                </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={showUploadModal} onClose={() => !uploading && setShowUploadModal(false)} title="Diffuser un document">
         <div className="space-y-6">
            <input type="file" onChange={handleFileUpload} className="w-full p-8 border-2 border-dashed rounded-3xl cursor-pointer" />
            <select value={newFileCategory} onChange={e => setNewFileCategory(e.target.value as ScheduleCategory)} className="w-full p-4 rounded-2xl bg-gray-50 font-black text-[10px] uppercase">
                <option value="Planning">Planning</option>
                <option value="Examens">Examens</option>
                <option value="Cours">Cours</option>
            </select>
            {uploading && <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-primary-500 transition-all" style={{ width: `${uploadProgress}%` }}></div></div>}
         </div>
      </Modal>
    </div>
  );
}
