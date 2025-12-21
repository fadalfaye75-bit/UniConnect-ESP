
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Copy, Trash2, Loader2, Pencil, 
  Megaphone, Search, Filter, ChevronDown, Sparkles, FilterX, Send, Shield, Calendar as CalendarIcon, X
} from 'lucide-react';
import { UserRole, Announcement, AnnouncementPriority } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

const PAGE_SIZE = 15;

export default function Announcements() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newAnn, setNewAnn] = useState({ title: '', content: '', priority: 'normal' as AnnouncementPriority, className: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);

  const canCreate = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  const fetchAnnouncements = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) {
          setLoading(true);
          setPage(0);
      } else {
          setLoadingMore(true);
      }
      const data = await API.announcements.list(pageNum, PAGE_SIZE);
      if (isRefresh) setAnnouncements(data);
      else setAnnouncements(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Chargement échoué.', type: 'alert' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchAnnouncements(0, true);
    API.classes.list().then(setClasses);
    const subscription = API.announcements.subscribe(() => fetchAnnouncements(0, true));
    if (user) {
        const storedReads = localStorage.getItem(`uniconnect_read_anns_${user.id}`);
        if (storedReads) try { setReadIds(JSON.parse(storedReads)); } catch(e) {}
    }
    return () => subscription.unsubscribe();
  }, [user, adminViewClass, fetchAnnouncements]);

  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(() => setIsFiltering(false), 400);
    return () => clearTimeout(timer);
  }, [searchTerm, priorityFilter, classFilter, startDate, endDate]);

  const handleOpenCreate = () => {
    setNewAnn({
      title: '',
      content: '',
      priority: 'normal',
      className: user?.role === UserRole.DELEGATE ? user.className : 'Général'
    });
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.announcements.create(newAnn);
      setIsModalOpen(false);
      addNotification({ title: 'Publié', message: 'L\'annonce est en ligne.', type: 'success' });
      fetchAnnouncements(0, true);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Échec de publication.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cette annonce ? Cette action est irréversible et l'avis disparaîtra du mur pour tous les utilisateurs.")) return;
    
    try {
      await API.announcements.delete(id);
      addNotification({ title: 'Annonce supprimée', message: 'Le message a été retiré avec succès.', type: 'info' });
      fetchAnnouncements(0, true);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Une erreur est survenue lors de la suppression.', type: 'alert' });
    }
  };

  const displayedAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      const targetClass = ann.className || 'Général';
      const canSee = user?.role === UserRole.ADMIN ? true : (targetClass === user?.className || targetClass === 'Général');
      if (!canSee) return false;
      
      const matchesSearch = ann.title.toLowerCase().includes(searchTerm.toLowerCase()) || ann.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || ann.priority === priorityFilter;
      const matchesClassFilter = classFilter === 'all' || targetClass === classFilter;
      
      // Filtrage par date
      const annDate = new Date(ann.date);
      let matchesDate = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (annDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (annDate > end) matchesDate = false;
      }

      return matchesSearch && matchesPriority && matchesClassFilter && matchesDate;
    });
  }, [user, announcements, searchTerm, priorityFilter, classFilter, startDate, endDate]);

  const handleMarkAsRead = (id: string) => {
    if (user?.role === UserRole.STUDENT && !readIds.includes(id)) {
        const next = [...readIds, id];
        setReadIds(next);
        localStorage.setItem(`uniconnect_read_anns_${user.id}`, JSON.stringify(next));
    }
  };

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Indexation des avis...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-950/95 py-6 backdrop-blur-md gap-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
             <h2 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3 italic">
               <Megaphone className="text-primary-500" size={32} /> Le Mur d'Avis
             </h2>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 ml-11">Flux centralisé de l'ESP</p>
          </div>
          
          <div className="flex items-center gap-3">
             {canCreate && (
                <button onClick={handleOpenCreate} className="flex items-center gap-2 bg-primary-500 text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
                   <Plus size={18} /> Publier
                </button>
             )}
          </div>
        </div>

        {/* Barre de Recherche et Filtres Avancés */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
             <div className="relative flex-1 group">
               <Search className="absolute left-4 top-3 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
               <input 
                  type="text" placeholder="Rechercher dans les avis..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 transition-all font-medium"
               />
             </div>
             
             <div className="flex flex-wrap items-center gap-2">
                <select 
                   value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                   className="px-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-[10px] font-black text-gray-600 dark:text-gray-300 outline-none uppercase tracking-widest cursor-pointer hover:border-primary-300"
                >
                   <option value="all">Priorité (Toutes)</option>
                   <option value="normal">Normal</option>
                   <option value="important">Important</option>
                   <option value="urgent">Urgent</option>
                </select>

                <select 
                   value={classFilter} onChange={e => setClassFilter(e.target.value)}
                   className="px-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-[10px] font-black text-gray-600 dark:text-gray-300 outline-none uppercase tracking-widest cursor-pointer hover:border-primary-300"
                >
                   <option value="all">Classe (Toutes)</option>
                   <option value="Général">Général</option>
                   {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
             </div>
          </div>

          {/* Filtre de Plage de Dates */}
          <div className="flex flex-wrap items-center gap-4 bg-white/50 dark:bg-gray-900/50 p-3 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
              <CalendarIcon size={14} className="text-primary-500" />
              Période :
            </div>
            
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
              <span className="text-gray-400 text-xs font-black">→</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>

            {(startDate || endDate) && (
              <button 
                onClick={clearDateFilters}
                className="flex items-center gap-1.5 text-[9px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 px-3 py-1.5 rounded-xl transition-all"
              >
                <X size={14} /> Réinitialiser
              </button>
            )}
            
            <div className="ml-auto text-[9px] font-black text-gray-400 uppercase tracking-widest hidden sm:block">
              {displayedAnnouncements.length} avis filtrés
            </div>
          </div>
        </div>
      </div>

      <div className={`grid gap-6 transition-all duration-500 ${isFiltering ? 'opacity-40 translate-y-2' : 'opacity-100'}`}>
        {displayedAnnouncements.map((ann, index) => {
          const isUnread = user?.role === UserRole.STUDENT && !readIds.includes(ann.id);
          const canDelete = user?.role === UserRole.ADMIN || (user?.role === UserRole.DELEGATE && ann.className === user.className);
          
          return (
            <div 
              key={ann.id} 
              onClick={() => handleMarkAsRead(ann.id)}
              className={`group relative rounded-[2.5rem] border p-8 transition-all duration-500 flex flex-col md:flex-row gap-8 hover:-translate-y-1 hover:shadow-2xl animate-fade-in ${
                isUnread ? 'bg-white border-primary-200 shadow-xl' : 'bg-gray-50/50 border-gray-100 dark:border-gray-800'
              }`}
              style={{ animationDelay: `${Math.min(index % PAGE_SIZE, 10) * 60}ms`, animationFillMode: 'backwards' }}
            >
              {isUnread && (
                  <div className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1 bg-primary-500 text-white text-[9px] font-black uppercase rounded-full shadow-lg shadow-primary-500/20">
                      <Sparkles size={12} /> Nouveau
                  </div>
              )}
              <div className="flex flex-col items-center justify-center w-20 h-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 flex-shrink-0 shadow-sm transition-transform group-hover:scale-110">
                  <span className="text-[9px] font-black text-gray-400 uppercase">{new Date(ann.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white leading-none">{new Date(ann.date).getDate()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest ${
                    ann.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-100' : 
                    ann.priority === 'important' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-primary-50 text-primary-600 border-primary-100'
                  }`}>
                    {ann.priority}
                  </span>
                  <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-400 tracking-widest">
                    {ann.className || 'Général'}
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                     <span className="text-[8px] font-black uppercase text-gray-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Posté par {ann.author}</span>
                     {canDelete && (
                       <button 
                         onClick={(e) => handleDelete(e, ann.id)}
                         className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                         title="Supprimer l'annonce"
                       >
                         <Trash2 size={16} />
                       </button>
                     )}
                  </div>
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter italic leading-tight group-hover:text-primary-600 transition-colors">
                  {ann.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium italic opacity-90">{ann.content}</p>
              </div>
            </div>
          );
        })}

        {displayedAnnouncements.length === 0 && !isFiltering && (
           <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 animate-fade-in">
              <FilterX size={64} className="mx-auto text-gray-100 dark:text-gray-800 mb-6 opacity-10" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic opacity-60">Aucun avis trouvé pour cette période</p>
           </div>
        )}
      </div>

      {hasMore && displayedAnnouncements.length > 0 && !searchTerm && (
          <div className="flex justify-center pt-8">
              <button 
                onClick={() => fetchAnnouncements(page + 1)} disabled={loadingMore}
                className="group flex items-center gap-3 px-10 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black rounded-[2rem] shadow-2xl transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-[0.2em]"
              >
                {loadingMore ? <Loader2 className="animate-spin" size={18} /> : <ChevronDown size={18} className="group-hover:translate-y-0.5 transition-transform" />}
                Afficher plus d'avis
              </button>
          </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Diffuser une annonce">
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Sujet</label>
            <input required type="text" value={newAnn.title} onChange={e => setNewAnn({...newAnn, title: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold outline-none focus:ring-4 focus:ring-primary-50 transition-all" placeholder="Titre de l'avis..." />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Contenu</label>
            <textarea required rows={5} value={newAnn.content} onChange={e => setNewAnn({...newAnn, content: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold outline-none italic focus:ring-4 focus:ring-primary-50 transition-all" placeholder="Détails du message..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Priorité</label>
                <select value={newAnn.priority} onChange={e => setNewAnn({...newAnn, priority: e.target.value as any})} className="w-full px-5 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-primary-50 transition-all">
                   <option value="normal">Normal</option>
                   <option value="important">Important</option>
                   <option value="urgent">Urgent</option>
                </select>
             </div>
             <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Cible</label>
                {user?.role === UserRole.ADMIN ? (
                   <select value={newAnn.className} onChange={e => setNewAnn({...newAnn, className: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-primary-50 transition-all">
                      <option value="Général">Général</option>
                      {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                   </select>
                ) : (
                   <div className="w-full px-5 py-3 rounded-2xl bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800 flex items-center gap-2">
                      <Shield size={14} className="text-primary-500" />
                      <span className="text-[10px] font-black text-primary-600 uppercase">{user?.className}</span>
                   </div>
                )}
             </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 transition-all flex justify-center items-center gap-2 uppercase tracking-widest active:scale-95">
            {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
            {submitting ? 'Diffusion...' : 'Envoyer l\'annonce'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
