
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Copy, Trash2, Loader2, Pencil, 
  Megaphone, Search, Filter, ChevronDown, Sparkles, FilterX, Send, Shield, Calendar as CalendarIcon, X, Link as LinkIcon, Paperclip, ExternalLink, Globe, FileText, Check, ArrowRight, Bookmark, ThumbsUp, Eye,
  AlertTriangle, Zap, Info, FormInput, FileUp, Download
} from 'lucide-react';
import { UserRole, Announcement, AnnouncementPriority, ExternalLink as ExtLinkType } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

export default function Announcements() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const themeColor = user?.themeColor || '#0ea5e9';
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAnn, setNewAnn] = useState({ 
    title: '', 
    content: '', 
    priority: 'normal' as AnnouncementPriority, 
    className: '',
    links: [] as ExtLinkType[],
    attachments: [] as string[]
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [attachmentFilter, setAttachmentFilter] = useState<boolean>(false);

  const isAdmin = user?.role === UserRole.ADMIN;
  const canCreateAtAll = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  const availableClassOptions = useMemo(() => {
    if (isAdmin) return classes;
    return classes.filter(c => c.name === user?.className);
  }, [classes, isAdmin, user?.className]);

  useEffect(() => {
    const savedReadIds = localStorage.getItem(`read_announcements_${user?.id}`);
    if (savedReadIds) {
      try { setReadIds(new Set(JSON.parse(savedReadIds))); } catch (e) {}
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`read_announcements_${user?.id}`, JSON.stringify(Array.from(readIds)));
    }
  }, [readIds, user?.id]);

  const fetchAnnouncements = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true);
      const data = await API.announcements.list(0, 50);
      setAnnouncements(data);
      const favs = await API.favorites.list();
      setFavoriteIds(new Set(favs.filter(f => f.content_type === 'announcement').map(f => f.content_id)));
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Chargement échoué.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchAnnouncements(true);
    API.classes.list().then(setClasses);
    const subscription = API.announcements.subscribe(() => fetchAnnouncements(false));
    return () => { subscription.unsubscribe(); };
  }, [fetchAnnouncements]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalAnn = {
        ...newAnn,
        className: isAdmin ? newAnn.className : (user?.className || 'Général'),
        links: newAnn.links.filter(l => l.label && l.url)
      };

      if (editingId) {
        await API.announcements.update(editingId, finalAnn);
        addNotification({ title: 'Mis à jour', message: 'L\'annonce a été modifiée.', type: 'success' });
      } else {
        await API.announcements.create(finalAnn);
        addNotification({ title: 'Publié', message: 'L\'annonce est en ligne.', type: 'success' });
      }
      setIsModalOpen(false);
      fetchAnnouncements(false);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Opération échouée.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const added = await API.favorites.toggle(id, 'announcement');
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (added) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleRelay = async (ann: Announcement) => {
    const text = `🎓 *UniConnect ESP*\n📢 *${ann.title.toUpperCase()}*\n\n${ann.content}\n\n📌 *Classe:* ${ann.className || 'Général'}`;
    if (navigator.share) await navigator.share({ title: ann.title, text });
    else {
      await navigator.clipboard.writeText(text);
      addNotification({ title: 'Copié', message: 'Lien prêt pour partage.', type: 'success' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setSubmitting(true);
    try {
        await API.announcements.delete(deleteConfirmId);
        addNotification({ title: 'Supprimé', message: 'L\'annonce a été retirée.', type: 'info' });
        fetchAnnouncements(false);
        setDeleteConfirmId(null);
    } catch (e) {
        addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    } finally {
        setSubmitting(false);
    }
  };

  const displayedAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      const targetClass = ann.className || 'Général';
      if (!isAdmin && targetClass !== 'Général' && targetClass !== user?.className) return false;
      
      const matchesSearch = ann.title.toLowerCase().includes(searchTerm.toLowerCase()) || ann.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || ann.priority === priorityFilter;
      const matchesClassFilter = classFilter === 'all' || targetClass === classFilter;
      const matchesAttachments = !attachmentFilter || (ann.attachments && ann.attachments.length > 0) || (ann.links && ann.links.length > 0);
      return matchesSearch && matchesPriority && matchesClassFilter && matchesAttachments;
    });
  }, [user, announcements, searchTerm, priorityFilter, classFilter, attachmentFilter, isAdmin]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-4">
        <Loader2 className="animate-spin" style={{ color: themeColor }} size={40} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Chargement du flux...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 text-white rounded-[1.8rem] flex items-center justify-center shadow-xl rotate-3" style={{ backgroundColor: themeColor }}>
              <Megaphone size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Annonces</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3">Flux {user?.className || 'Global'}</p>
           </div>
        </div>
        
        {canCreateAtAll && (
          <button 
            onClick={() => { setEditingId(null); setNewAnn({ title: '', content: '', priority: 'normal', className: isAdmin ? '' : (user?.className || ''), links: [], attachments: [] }); setIsModalOpen(true); }} 
            className="w-full sm:w-auto flex items-center justify-center gap-3 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all italic"
            style={{ backgroundColor: themeColor }}
          >
            <Plus size={20} /> Nouveau Message
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-gray-900 p-3 rounded-[2rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-transparent border-none rounded-2xl text-sm font-bold outline-none italic"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button 
            onClick={() => setAttachmentFilter(!attachmentFilter)}
            className={`px-6 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${attachmentFilter ? 'bg-primary-500 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-400'}`}
          >
            <Paperclip size={14} /> Pièces & Liens
          </button>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-6 py-5 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none">
             <option value="all">Priorités</option>
             <option value="urgent">Urgent</option>
             <option value="important">Important</option>
          </select>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="px-6 py-5 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none">
             <option value="all">Ma Sélection</option>
             <option value="Général">Général</option>
             {availableClassOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-8">
        {displayedAnnouncements.map((ann) => {
          const isUrgent = ann.priority === 'urgent';
          const isRead = readIds.has(ann.id);
          const isFavorite = favoriteIds.has(ann.id);
          const canModify = isAdmin || ann.user_id === user?.id;
          const annDate = new Date(ann.date);
          
          return (
            <div 
              key={ann.id} 
              className={`group relative bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border-2 transition-all duration-500 flex flex-col md:flex-row gap-10 overflow-hidden ${
                isUrgent ? 'border-rose-100 bg-rose-50/10' : 'border-transparent hover:border-gray-100'
              } ${isRead ? 'opacity-60' : ''}`}
            >
              <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: isUrgent ? '#f43f5e' : themeColor }} />

              <div className="flex flex-col items-center justify-center w-28 h-28 bg-gray-50 dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-lg shrink-0">
                  <span className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: themeColor }}>
                    {annDate.toLocaleDateString('fr-FR', {weekday: 'short'})}
                  </span>
                  <span className="text-4xl font-black text-gray-900 dark:text-white italic">{annDate.getDate()}</span>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                    {annDate.toLocaleDateString('fr-FR', {month: 'short'})}
                  </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                   <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-lg tracking-widest ${
                      isUrgent ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-400'
                   }`}>{ann.priority}</span>
                   <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Auteur: {ann.author}</span>
                   <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-lg">{ann.className || 'Général'}</span>
                </div>

                <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight italic tracking-tighter mb-4 group-hover:text-primary-500 transition-colors">{ann.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 italic leading-relaxed text-sm whitespace-pre-wrap mb-8">{ann.content}</p>

                {(ann.links && ann.links.length > 0) && (
                  <div className="flex flex-wrap gap-2 mb-8">
                     {ann.links.map((l, i) => (
                       <a key={i} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary-500 rounded-xl transition-all border border-transparent hover:border-primary-200">
                         <LinkIcon size={12} /> {l.label}
                       </a>
                     ))}
                  </div>
                )}
              </div>

              <div className="flex md:flex-col items-center justify-center gap-2 p-6 md:p-0 md:pl-10 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800">
                 <button onClick={() => handleRelay(ann)} className="p-3.5 bg-gray-900 text-white rounded-2xl hover:scale-110 transition-all shadow-lg"><Share2 size={20}/></button>
                 <button onClick={() => handleToggleFavorite(ann.id)} className={`p-3.5 rounded-2xl border transition-all ${isFavorite ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-gray-50 text-gray-400 hover:text-amber-500'}`}><Bookmark size={20} className={isFavorite ? 'fill-current' : ''}/></button>
                 <button onClick={() => handleToggleRead(ann.id)} className={`p-3.5 rounded-2xl border transition-all ${isRead ? 'bg-emerald-50 border-emerald-200 text-emerald-500' : 'bg-gray-50 text-gray-400 hover:text-emerald-500'}`}><Eye size={20}/></button>
                 {canModify && (
                   <div className="flex md:flex-col gap-2">
                      <button onClick={() => { setEditingId(ann.id); setNewAnn({ ...ann, className: ann.className || '' }); setIsModalOpen(true); }} className="p-3.5 bg-blue-50 text-blue-500 rounded-2xl hover:bg-blue-500 hover:text-white transition-all"><Pencil size={20}/></button>
                      <button onClick={() => setDeleteConfirmId(ann.id)} className="p-3.5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20}/></button>
                   </div>
                 )}
              </div>
            </div>
          );
        }) : (
           <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <Megaphone size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucune annonce trouvée pour votre classe</p>
           </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Éditer l'annonce" : "Diffuser un message"}>
         <form onSubmit={handleFormSubmit} className="space-y-6">
            <div>
               <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Sujet de l'annonce</label>
               <input required value={newAnn.title} onChange={e => setNewAnn({...newAnn, title: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none border-none italic" placeholder="Titre explicite..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Priorité</label>
                  <select value={newAnn.priority} onChange={e => setNewAnn({...newAnn, priority: e.target.value as any})} className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl font-black text-[10px] uppercase outline-none border-none">
                     <option value="normal">Normal</option>
                     <option value="important">Important</option>
                     <option value="urgent">Urgent</option>
                  </select>
               </div>
               <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Audience</label>
                  <select 
                    disabled={!isAdmin} 
                    value={newAnn.className} 
                    onChange={e => setNewAnn({...newAnn, className: e.target.value})} 
                    className={`w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl font-black text-[10px] uppercase outline-none border-none ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                     <option value="Général">Public (Tout l'ESP)</option>
                     {isAdmin ? (
                       classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                     ) : (
                       <option value={user?.className}>{user?.className}</option>
                     )}
                  </select>
               </div>
            </div>

            <div>
               <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Contenu détaillé</label>
               <textarea required value={newAnn.content} onChange={e => setNewAnn({...newAnn, content: e.target.value})} rows={6} className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none border-none italic" placeholder="Écrivez ici..." />
            </div>

            <button type="submit" disabled={submitting} className="w-full py-4 rounded-[2rem] bg-primary-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">
               {submitting ? <Loader2 className="animate-spin mx-auto" /> : (editingId ? "Sauvegarder les modifications" : "Publier l'annonce")}
            </button>
         </form>
      </Modal>

      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Confirmer la suppression">
         <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
               <AlertTriangle size={40} />
            </div>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-300 italic leading-relaxed">Cette action est irréversible. L'annonce sera retirée du flux pour tous les utilisateurs.</p>
            <div className="flex gap-3">
               <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 rounded-2xl bg-gray-50 font-black text-[10px] uppercase tracking-widest">Annuler</button>
               <button onClick={handleConfirmDelete} className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg">Supprimer</button>
            </div>
         </div>
      </Modal>
    </div>
  );
}
