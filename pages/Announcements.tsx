
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Trash2, Loader2, Pencil, 
  Megaphone, Search, X, Link as LinkIcon, Paperclip, 
  Globe2, Trash, FileText, Image as ImageIcon,
  CheckCircle2, Bookmark, Eye, AlertTriangle, 
  FileSpreadsheet, ClipboardList, Check
} from 'lucide-react';
import { UserRole, Announcement, AnnouncementPriority, ExternalLink as ExtLinkType } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

export default function Announcements() {
  const { user } = useAuth();
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
    if (!newAnn.title.trim() || !newAnn.content.trim()) {
      addNotification({ title: 'Attention', message: 'Titre et contenu requis.', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const finalAnn = {
        ...newAnn,
        className: isAdmin ? newAnn.className : (user?.className || 'Général'),
        links: newAnn.links.filter(l => l.label.trim() !== '' && l.url.trim() !== ''),
        attachments: newAnn.attachments.filter(a => a.trim() !== '')
      };

      if (editingId) {
        await API.announcements.update(editingId, finalAnn);
        addNotification({ title: 'Mis à jour', message: 'Modifications enregistrées.', type: 'success' });
      } else {
        await API.announcements.create(finalAnn);
        addNotification({ title: 'Diffusé', message: 'L\'annonce est maintenant visible.', type: 'success' });
      }
      setIsModalOpen(false);
      fetchAnnouncements(false);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de finaliser la diffusion.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const added = await API.favorites.toggle(id, 'announcement');
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (added) next.add(id); else next.delete(id);
        return next;
      });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setSubmitting(true);
    try {
        await API.announcements.delete(deleteConfirmId);
        addNotification({ title: 'Retiré', message: 'L\'annonce a été supprimée.', type: 'info' });
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
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 text-white rounded-[1.8rem] flex items-center justify-center shadow-xl rotate-3" style={{ backgroundColor: themeColor }}>
              <Megaphone size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Annonces</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3">Portail {user?.className || 'Global'}</p>
           </div>
        </div>
        
        {canCreateAtAll && (
          <button 
            onClick={() => { setEditingId(null); setNewAnn({ title: '', content: '', priority: 'normal', className: isAdmin ? '' : (user?.className || ''), links: [], attachments: [] }); setIsModalOpen(true); }} 
            className="w-full sm:w-auto flex items-center justify-center gap-3 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all italic hover:brightness-110"
            style={{ backgroundColor: themeColor }}
          >
            <Plus size={20} /> Nouvelle Diffusion
          </button>
        )}
      </div>

      {/* Dynamic Filters */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-gray-900 p-3 rounded-[2.5rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Rechercher une annonce..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-transparent border-none rounded-2xl text-sm font-bold outline-none italic"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button 
            onClick={() => setAttachmentFilter(!attachmentFilter)}
            className={`px-6 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${attachmentFilter ? 'bg-primary-500 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-400'}`}
          >
            <Paperclip size={14} /> Ressources
          </button>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-6 py-5 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase outline-none border-none cursor-pointer">
             <option value="all">Priorités</option>
             <option value="urgent">Urgents</option>
             <option value="important">Importants</option>
          </select>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="px-6 py-5 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase outline-none border-none cursor-pointer">
             <option value="all">Filières</option>
             <option value="Général">Public</option>
             {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Main Feed */}
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
                   <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Par: {ann.author}</span>
                   <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-lg">{ann.className || 'Général'}</span>
                </div>

                <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight italic tracking-tighter mb-4 group-hover:text-primary-500 transition-colors">{ann.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 italic leading-relaxed text-sm whitespace-pre-wrap mb-8">{ann.content}</p>

                <div className="space-y-4">
                  {(ann.links && ann.links.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                       {ann.links.map((l, i) => (
                         <a key={i} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-50 dark:bg-blue-900/10 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-white hover:bg-blue-600 rounded-xl transition-all border border-blue-100 shadow-sm active:scale-95">
                           {l.url.includes('forms') ? <ClipboardList size={14} /> : l.url.includes('sheet') ? <FileSpreadsheet size={14} /> : <Globe2 size={14} />} {l.label}
                         </a>
                       ))}
                    </div>
                  )}

                  {(ann.attachments && ann.attachments.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                       {ann.attachments.map((a, i) => (
                         <div key={i} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 dark:bg-emerald-900/10 text-[10px] font-black uppercase tracking-widest text-emerald-600 rounded-xl border border-emerald-100">
                           {a.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <ImageIcon size={14} /> : <FileText size={14} />} {a}
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Interaction Panel */}
              <div className="flex md:flex-col items-center justify-center gap-2 p-6 md:p-0 md:pl-10 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800">
                 <button onClick={() => { if(navigator.share) navigator.share({title: ann.title, text: ann.content}); }} className="p-3.5 bg-gray-900 text-white rounded-2xl hover:scale-110 transition-all shadow-lg active:scale-90" title="Partager"><Share2 size={20}/></button>
                 <button onClick={() => handleToggleFavorite(ann.id)} className={`p-3.5 rounded-2xl border transition-all active:scale-90 ${isFavorite ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-gray-50 text-gray-400 hover:text-amber-500'}`} title="Favori"><Bookmark size={20} className={isFavorite ? 'fill-current' : ''}/></button>
                 <button onClick={() => handleToggleRead(ann.id)} className={`p-3.5 rounded-2xl border transition-all active:scale-90 ${isRead ? 'bg-emerald-50 border-emerald-200 text-emerald-500' : 'bg-gray-50 text-gray-400 hover:text-emerald-500'}`} title="Lu"><Eye size={20}/></button>
                 {canModify && (
                   <div className="flex md:flex-col gap-2">
                      <button onClick={() => { setEditingId(ann.id); setNewAnn({ ...ann, className: ann.className || '' }); setIsModalOpen(true); }} className="p-3.5 bg-blue-50 text-blue-500 rounded-2xl hover:bg-blue-500 hover:text-white transition-all active:scale-90" title="Éditer"><Pencil size={20}/></button>
                      <button onClick={() => setDeleteConfirmId(ann.id)} className="p-3.5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90" title="Supprimer"><Trash2 size={20}/></button>
                   </div>
                 )}
              </div>
            </div>
          );
        })}

        {displayedAnnouncements.length === 0 && (
           <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <Megaphone size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucun message pour votre sélection</p>
           </div>
        )}
      </div>

      {/* Modern Creation Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Éditer l'annonce" : "Diffuser un message"}>
         <form onSubmit={handleFormSubmit} className="space-y-6 max-h-[80vh] custom-scrollbar overflow-y-auto pr-2 px-1">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Sujet de l'annonce</label>
                <input required value={newAnn.title} onChange={e => setNewAnn({...newAnn, title: e.target.value})} className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none border-2 border-transparent focus:border-primary-500 transition-all italic" placeholder="Titre explicite..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Urgence</label>
                  <select value={newAnn.priority} onChange={e => setNewAnn({...newAnn, priority: e.target.value as any})} className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-black text-[10px] uppercase outline-none cursor-pointer border-none">
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
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-black text-[10px] uppercase outline-none cursor-pointer border-none disabled:opacity-50"
                  >
                    <option value="Général">Public (Global)</option>
                    {isAdmin ? classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option value={user?.className}>{user?.className}</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Contenu principal</label>
                <textarea required value={newAnn.content} onChange={e => setNewAnn({...newAnn, content: e.target.value})} rows={4} className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none border-2 border-transparent focus:border-primary-500 transition-all italic" placeholder="Détaillez votre message..." />
              </div>
            </div>

            {/* Link Manager Section */}
            <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Globe2 size={16} className="text-blue-500" />
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Outils Collaboratifs (Forms, Sheets...)</label>
                  </div>
                  <button type="button" onClick={() => setNewAnn({...newAnn, links: [...newAnn.links, {label: '', url: ''}]})} className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg active:scale-95 transition-all">
                    <Plus size={12} /> Ajouter
                  </button>
               </div>
               <div className="space-y-3">
                 {newAnn.links.map((link, idx) => (
                    <div key={idx} className="flex gap-2 animate-in slide-in-from-right-5 duration-300">
                       <input 
                          className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-[11px] outline-none" 
                          placeholder="Label" 
                          value={link.label}
                          onChange={e => {
                             const next = [...newAnn.links];
                             next[idx].label = e.target.value;
                             setNewAnn({ ...newAnn, links: next });
                          }}
                       />
                       <input 
                          className="flex-[2] px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-[11px] outline-none" 
                          placeholder="URL complète" 
                          value={link.url}
                          onChange={e => {
                             const next = [...newAnn.links];
                             next[idx].url = e.target.value;
                             setNewAnn({ ...newAnn, links: next });
                          }}
                       />
                       <button type="button" onClick={() => setNewAnn({...newAnn, links: newAnn.links.filter((_, i) => i !== idx)})} className="p-3 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl active:scale-90 transition-all">
                          <Trash size={16} />
                       </button>
                    </div>
                 ))}
               </div>
            </div>

            {/* Document Manager Section */}
            <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Paperclip size={16} className="text-emerald-500" />
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Documents & Médias (Exportations...)</label>
                  </div>
                  <button type="button" onClick={() => setNewAnn({...newAnn, attachments: [...newAnn.attachments, '']})} className="text-[9px] font-black text-emerald-600 uppercase flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg active:scale-95 transition-all">
                    <Plus size={12} /> Ajouter
                  </button>
               </div>
               <div className="space-y-3">
                 {newAnn.attachments.map((file, idx) => (
                    <div key={idx} className="flex gap-2 animate-in slide-in-from-right-5 duration-300">
                       <input 
                          className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-[11px] outline-none" 
                          placeholder="Nom ou URL du document (ex: Planning.jpg)" 
                          value={file}
                          onChange={e => {
                             const next = [...newAnn.attachments];
                             next[idx] = e.target.value;
                             setNewAnn({ ...newAnn, attachments: next });
                          }}
                       />
                       <button type="button" onClick={() => setNewAnn({...newAnn, attachments: newAnn.attachments.filter((_, i) => i !== idx)})} className="p-3 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl active:scale-90 transition-all">
                          <Trash size={16} />
                       </button>
                    </div>
                 ))}
               </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full py-5 rounded-[2.5rem] bg-primary-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary-500/20 active:scale-95 transition-all hover:bg-primary-600 flex items-center justify-center gap-3">
               {submitting ? <Loader2 className="animate-spin" size={20} /> : (editingId ? <Check size={20} /> : <Check size={20} />)}
               {submitting ? "Finalisation..." : (editingId ? "Sauvegarder" : "Publier l'Annonce")}
            </button>
         </form>
      </Modal>

      {/* Confirmation Modal */}
      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Retirer cette annonce">
         <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
               <AlertTriangle size={40} />
            </div>
            <div className="space-y-2 px-4">
              <h4 className="text-lg font-black italic text-gray-900 dark:text-white">Confirmer la suppression</h4>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 italic">Cette action est irréversible. L'annonce sera retirée pour tous les membres.</p>
            </div>
            <div className="flex gap-3">
               <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-black text-[10px] uppercase tracking-widest text-gray-400">Conserver</button>
               <button onClick={handleConfirmDelete} disabled={submitting} className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center">
                 {submitting ? <Loader2 className="animate-spin" size={16}/> : "Confirmer"}
               </button>
            </div>
         </div>
      </Modal>
    </div>
  );
}
