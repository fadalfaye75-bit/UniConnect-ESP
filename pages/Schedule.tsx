
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileSpreadsheet, Download, Clock, Upload, History, Loader2, Trash2, Save, X, Share2, Copy, Bookmark, Calendar as CalendarIcon, Sparkles, FileText, GraduationCap, BookOpen, Layers, Filter, CalendarDays, ChevronDown, Star } from 'lucide-react';
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

  const isAdmin = user?.role === UserRole.ADMIN;
  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  const fetchSchedules = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true);
      const data = await API.schedules.list();
      setSchedules(data.sort((a,b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
      
      const favs = await API.favorites.list();
      setFavoriteIds(new Set(favs.filter(f => f.content_type === 'schedule').map(f => f.content_id)));
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchSchedules(true);
  }, [user, adminViewClass, fetchSchedules]);

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
    setUploadProgress(20);
    try {
      const targetClass = isAdmin ? (adminViewClass || 'Général') : (user?.className || 'Général');
      await API.schedules.create({
        version: `V${schedules.length + 1}`,
        url: "https://example.com/doc.pdf",
        className: targetClass,
        category: newFileCategory
      });
      fetchSchedules();
      setShowUploadModal(false);
      addNotification({ title: 'Publié', message: 'Document disponible.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Échec de l'envoi.", type: 'alert' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer ce document ?")) return;
    try {
      await API.schedules.delete(id);
      fetchSchedules();
      addNotification({ title: 'Supprimé', message: 'Le fichier a été retiré.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary-500" size={40} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-8">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><CalendarIcon size={30} /></div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter italic">Documents</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{user?.className || 'Filière'}</p>
           </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowOnlyFavorites(!showOnlyFavorites)} className={`p-4 rounded-2xl transition-all border-2 ${showOnlyFavorites ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white dark:bg-gray-800 border-gray-100 text-gray-400'}`}>
            <Star size={16} className={showOnlyFavorites ? 'fill-current' : ''} />
          </button>
          {canManage && (
            <button onClick={() => setShowUploadModal(true)} className="bg-primary-500 text-white px-8 py-4 rounded-2xl text-sm font-black shadow-xl">
               <Upload size={20} className="inline mr-2" /> Nouveau
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-gray-900 p-4 rounded-[2.5rem] shadow-soft">
          <select value={activeCategory} onChange={e => setActiveCategory(e.target.value as any)} className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-xs font-black uppercase outline-none">
             <option value="Toutes">Toutes catégories</option>
             <option value="Planning">Planning</option>
             <option value="Examens">Examens</option>
             <option value="Cours">Cours</option>
          </select>
          <select value={activeWeek} onChange={e => setActiveWeek(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-xs font-black uppercase outline-none">
             <option value="all">Toutes dates</option>
             {availableWeeks.map(week => <option key={week} value={week}>{new Date(week).toLocaleDateString()}</option>)}
          </select>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {displayedSchedules.map((sch) => {
          const canDelete = isAdmin || sch.user_id === user?.id;
          return (
            <div key={sch.id} className="group bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-soft border border-gray-100 dark:border-gray-800 hover:border-emerald-400 transition-all flex flex-col">
                <div className="flex justify-between items-start mb-8">
                    <div className="p-4 bg-emerald-50 text-emerald-500 rounded-2xl"><FileText size={20} /></div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => handleToggleFavorite(sch.id)} className={`p-2.5 rounded-xl border ${favoriteIds.has(sch.id) ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-gray-50'}`}><Bookmark size={16}/></button>
                         {canDelete && <button onClick={() => handleDelete(sch.id)} className="p-2.5 bg-red-50 text-red-500 rounded-xl"><Trash2 size={16}/></button>}
                    </div>
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight italic">{sch.category} - {sch.version}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase mt-4 tracking-widest">{new Date(sch.uploadDate).toLocaleDateString()} • {sch.className || 'ESP'}</p>
                <a href={sch.url} target="_blank" rel="noreferrer" className="mt-8 w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                    <Download size={18} /> Consulter
                </a>
            </div>
          );
        })}
      </div>

      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Diffuser">
         <form className="space-y-6">
            <div className="p-10 border-4 border-dashed border-gray-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-primary-400 transition-colors cursor-pointer relative">
               <Upload size={48} className="text-gray-200" />
               <p className="text-xs font-black text-gray-400 uppercase">Charger un document</p>
               <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <select value={newFileCategory} onChange={e => setNewFileCategory(e.target.value as any)} className="w-full p-4 bg-gray-50 rounded-2xl font-black text-[10px] uppercase outline-none">
               <option value="Planning">Planning</option>
               <option value="Examens">Examens</option>
               <option value="Cours">Supports</option>
            </select>
         </form>
      </Modal>
    </div>
  );
}
