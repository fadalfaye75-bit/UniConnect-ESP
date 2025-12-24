
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, Upload, Loader2, Trash2, Share2, FileText, CalendarDays, Star, Search, ShieldCheck, CheckCircle2, History, Eye, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, ScheduleFile } from '../types';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import Modal from '../components/Modal';

export default function Schedule() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  
  const [schedules, setSchedules] = useState<ScheduleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<ScheduleFile | null>(null);
  
  const [newFile, setNewFile] = useState({
    title: '',
    file: null as File | null
  });

  const isAdmin = user?.role === UserRole.ADMIN;
  const canPost = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  const fetchSchedules = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const data = await API.schedules.list();
      // Filtrage strict : on n'affiche que les plannings
      const filteredData = data.filter(s => s.category === 'Planning');
      setSchedules(filteredData);
      
      const favs = await API.favorites.list();
      setFavoriteIds(new Set(favs.filter(f => f.content_type === 'schedule').map(f => f.content_id)));
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de synchroniser les plannings.', type: 'alert' });
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchSchedules(true);
  }, [fetchSchedules]);

  const displayedSchedules = useMemo(() => {
    return schedules.filter(sch => {
      const target = sch.className || 'Général';
      if (!isAdmin && target !== 'Général' && target !== user?.className) return false;
      
      const matchesSearch = sch.version.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFavorites = !showOnlyFavorites || favoriteIds.has(sch.id);
      
      return matchesSearch && matchesFavorites;
    });
  }, [user, isAdmin, schedules, searchTerm, favoriteIds, showOnlyFavorites]);

  const latestVersions = useMemo(() => {
    const map = new Map<string, string>();
    schedules.forEach(s => {
      const key = `${s.className}-Planning`;
      const existing = map.get(key);
      if (!existing || new Date(s.uploadDate) > new Date(schedules.find(x => x.id === existing)!.uploadDate)) {
        map.set(key, s.id);
      }
    });
    return new Set(map.values());
  }, [schedules]);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFile.file || !newFile.title) {
      addNotification({ title: 'Manquant', message: 'Fichier et titre requis.', type: 'warning' });
      return;
    }

    setUploading(true);
    try {
      const targetClass = user?.className || 'Général';
      const sameTypeCount = schedules.filter(s => s.className === targetClass).length;
      const versionLabel = `${newFile.title} (V${sameTypeCount + 1})`;

      // Création d'une URL de blob locale pour permettre l'aperçu/téléchargement réel
      const localUrl = URL.createObjectURL(newFile.file);

      await API.schedules.create({
        version: versionLabel,
        url: localUrl, // On stocke l'URL locale pour la démo interactive
        className: targetClass,
        category: 'Planning'
      });

      addNotification({ title: 'Publié', message: `Le planning hebdomadaire ${versionLabel} est en ligne.`, type: 'success' });
      setShowUploadModal(false);
      setNewFile({ title: '', file: null });
      fetchSchedules();
    } catch (err: any) {
      addNotification({ title: 'Échec', message: err.message, type: 'alert' });
    } finally {
      setUploading(false);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const isAdded = await API.favorites.toggle(id, 'schedule');
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (isAdded) next.add(id); else next.delete(id);
        return next;
      });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Archiver ce planning ?")) return;
    try {
      await API.schedules.delete(id);
      fetchSchedules();
      addNotification({ title: 'Archivé', message: 'Document retiré avec succès.', type: 'info' });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action refusée.', type: 'alert' });
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[60vh] gap-6">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse italic">Synchronisation des plannings...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-32 animate-fade-in custom-scrollbar">
      {/* Header Premium */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-12">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 text-white rounded-[2.2rem] flex items-center justify-center shadow-premium rotate-3 relative overflow-hidden group" style={{ backgroundColor: '#10b981' }}>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              <CalendarDays size={36} className="relative z-10" />
           </div>
           <div>
              <h2 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase leading-none">Planning</h2>
              <div className="flex items-center gap-3 mt-4">
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-2">
                   <ShieldCheck size={12}/> Emplois du Temps Officiels
                 </span>
                 <span className="w-1 h-1 bg-gray-300 rounded-full" />
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">{user?.className}</span>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`p-5 rounded-[1.8rem] transition-all active:scale-95 shadow-soft border ${showOnlyFavorites ? 'bg-amber-500 text-white border-amber-600 shadow-amber-200' : 'bg-white dark:bg-gray-900 text-gray-400 border-gray-100 dark:border-gray-800'}`}
          >
            <Star size={24} className={showOnlyFavorites ? 'fill-current' : ''} />
          </button>
          {canPost && (
            <button 
              onClick={() => setShowUploadModal(true)}
              className="group relative overflow-hidden bg-gray-900 text-white px-10 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-premium active:scale-95 transition-all italic"
            >
               <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
               <span className="relative z-10 flex items-center gap-3"><Upload size={18} /> Diffuser une semaine</span>
            </button>
          )}
        </div>
      </div>

      {/* Barre de Recherche Sticky */}
      <div className="bg-white/80 dark:bg-gray-900/80 sticky-header p-4 rounded-[2.5rem] shadow-soft border border-gray-50 dark:border-gray-800 sticky top-4 z-20">
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Rechercher par date ou titre de semaine..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-transparent border-none rounded-2xl text-sm font-bold italic outline-none"
          />
        </div>
      </div>

      {/* Grid des Plannings */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {displayedSchedules.map((sch, idx) => {
          const isLatest = latestVersions.has(sch.id);
          const isFav = favoriteIds.has(sch.id);

          return (
            <div key={sch.id} className={`stagger-item stagger-${(idx % 3) + 1} group relative bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border-2 transition-all duration-500 flex flex-col overflow-hidden ${isLatest ? 'border-emerald-100 dark:border-emerald-900/30' : 'border-transparent hover:border-gray-100 dark:hover:border-gray-800'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/10 -mr-16 -mt-16 rounded-full group-hover:scale-125 transition-transform duration-1000 opacity-20"></div>
                
                <div className="flex justify-between items-start mb-10 relative z-10">
                    <div className="p-5 bg-emerald-50 text-emerald-600 rounded-[1.8rem] shadow-sm transform group-hover:-rotate-6 transition-transform">
                      <CalendarDays size={24} />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                         <button onClick={() => handleToggleFavorite(sch.id)} className={`p-3 rounded-xl border transition-all ${isFav ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-white dark:bg-gray-800 text-gray-400 hover:text-amber-500'}`}><Star size={18} className={isFav ? 'fill-current' : ''}/></button>
                         {isAdmin && <button onClick={() => handleDelete(sch.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18}/></button>}
                    </div>
                </div>

                <div className="flex-1 relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                     <span className="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600">Planning Hebdo</span>
                     {isLatest && <span className="text-[8px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-500 text-white rounded-lg animate-pulse">ACTUEL</span>}
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight italic tracking-tighter line-clamp-2">{sch.version}</h3>
                  <div className="flex flex-col gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                     <div className="flex items-center gap-2"><History size={12}/> {new Date(sch.uploadDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</div>
                     <div className="flex items-center gap-2"><ShieldCheck size={12}/> {sch.className || 'ESP'}</div>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-3 relative z-10">
                   <button 
                      onClick={() => setPreviewFile(sch)}
                      className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest italic hover:bg-gray-100 transition-all active:scale-95"
                    >
                      <Eye size={16} /> Aperçu
                   </button>
                   <a 
                      href={sch.url} target="_blank" rel="noreferrer" download
                      className="flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest italic shadow-lg hover:bg-black transition-all active:scale-95"
                    >
                      <Download size={16} /> Ouvrir
                   </a>
                </div>
            </div>
          );
        })}

        {displayedSchedules.length === 0 && (
           <div className="sm:col-span-2 lg:col-span-3 py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <History size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic opacity-50">Aucun planning disponible pour cette section</p>
           </div>
        )}
      </div>

      {/* Modal Upload */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Diffuser une semaine">
         <form onSubmit={handleFileUpload} className="space-y-8">
            <div className={`p-12 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-6 transition-all relative group bg-gray-50/50 dark:bg-gray-800/30 ${newFile.file ? 'border-emerald-400' : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'}`}>
               {uploading ? (
                 <div className="flex flex-col items-center gap-4">
                    <Loader2 size={64} className="text-emerald-500 animate-spin" />
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest animate-pulse">Indexation sécurisée...</p>
                 </div>
               ) : (
                 <>
                   <Upload size={64} className={`${newFile.file ? 'text-emerald-500' : 'text-gray-200'} group-hover:scale-110 transition-transform`} />
                   <div className="text-center">
                     <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-2">
                       {newFile.file ? newFile.file.name : 'Déposer le planning'}
                     </p>
                     <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Format PDF ou Image recommandé (Max 10Mo)</p>
                   </div>
                 </>
               )}
               <input 
                  type="file" disabled={uploading} 
                  onChange={e => e.target.files && setNewFile({...newFile, file: e.target.files[0]})} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Référence Temporelle</label>
                <input required value={newFile.title} onChange={e => setNewFile({...newFile, title: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold italic text-sm outline-none border-none shadow-inner-soft focus:ring-4 focus:ring-emerald-50" placeholder="ex: Semaine du 12 Juin" />
              </div>
            </div>

            <button type="submit" disabled={uploading || !newFile.file} className="w-full bg-emerald-600 text-white font-black py-5 rounded-[2.5rem] uppercase italic tracking-widest shadow-xl active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3">
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              <span>Lancer la diffusion</span>
            </button>
         </form>
      </Modal>

      {/* Modal Aperçu Réel */}
      <Modal isOpen={!!previewFile} onClose={() => setPreviewFile(null)} title="Consultation Planning">
         {previewFile && (
            <div className="space-y-8 animate-fade-in flex flex-col h-full">
               <div className="flex items-center gap-5 p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
                  <div className="w-16 h-16 bg-white dark:bg-gray-900 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm"><FileText size={32}/></div>
                  <div className="min-w-0">
                     <h4 className="text-xl font-black italic text-gray-900 dark:text-white truncate">{previewFile.version}</h4>
                     <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Planning Hebdomadaire • {previewFile.className}</p>
                  </div>
               </div>

               <div className="flex-1 min-h-[500px] bg-gray-100 dark:bg-gray-950 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 flex items-center justify-center relative overflow-hidden">
                  {/* Utilisation d'un iframe ou img pour l'aperçu réel */}
                  <iframe 
                    src={previewFile.url} 
                    className="w-full h-full border-none rounded-[2.5rem]" 
                    title="Document Viewer"
                    onError={() => addNotification({title: 'Erreur', message: 'Impossible d\'afficher l\'aperçu direct.', type: 'warning'})}
                  >
                    <div className="p-12 text-center space-y-4">
                       <FileText size={64} className="mx-auto text-gray-300" />
                       <p className="text-sm font-black italic text-gray-400 uppercase tracking-widest">Le navigateur ne supporte pas l'aperçu direct.</p>
                       <a href={previewFile.url} target="_blank" rel="noreferrer" className="text-emerald-500 font-black uppercase text-[10px] tracking-widest hover:underline">Télécharger pour voir</a>
                    </div>
                  </iframe>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => { if(navigator.share) navigator.share({title: previewFile.version, url: previewFile.url}); }} className="py-4 bg-gray-50 dark:bg-gray-800 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-gray-100 transition-all"><Share2 size={18}/> Partager</button>
                  <a href={previewFile.url} download={`${previewFile.version}.pdf`} className="py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all"><Download size={18}/> Télécharger</a>
               </div>
            </div>
         )}
      </Modal>
    </div>
  );
}
