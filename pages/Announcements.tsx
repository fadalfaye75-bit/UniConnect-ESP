
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Copy, Trash2, Loader2, Pencil, 
  Megaphone, Search, Filter, ChevronDown, Sparkles, FilterX, Send, Shield, Calendar as CalendarIcon, X, Link as LinkIcon, Paperclip, ExternalLink, Globe, FileText, Check, ArrowRight, Bookmark, ThumbsUp, Eye,
  AlertTriangle, Zap, Info
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const canCreate = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

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
      if (editingId) {
        await API.announcements.update(editingId, newAnn);
        addNotification({ title: 'Mis à jour', message: 'L\'annonce a été modifiée.', type: 'success' });
      } else {
        await API.announcements.create(newAnn);
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
      addNotification({ 
        title: added ? 'Ajouté aux favoris' : 'Retiré des favoris', 
        message: added ? 'Annonce sauvegardée dans votre profil.' : 'L\'annonce n\'est plus marquée.', 
        type: 'success' 
      });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleCopyContent = async (ann: Announcement) => {
    const textToCopy = `🎓 *UniConnect ESP - ${ann.className || 'Général'}*\n📢 *${ann.title.toUpperCase()}*\n\n${ann.content}\n\n✍️ Publié par : ${ann.author}\n📅 Date : ${new Date(ann.date).toLocaleDateString('fr-FR')}`;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(ann.id);
      addNotification({ title: 'Contenu copié', message: 'Le texte est prêt à être partagé.', type: 'success' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      addNotification({ title: 'Erreur', message: 'Copie impossible.', type: 'alert' });
    }
  };

  const handleRelay = async (ann: Announcement) => {
    const priorityEmoji = ann.priority === 'urgent' ? '🚨' : ann.priority === 'important' ? '⚡' : '📢';
    const structuredContent = `🎓 *UniConnect ESP Dakar*\n\n${priorityEmoji} *${ann.title.toUpperCase()}*\n\n"${ann.content}"\n\n📌 *Classe:* ${ann.className || 'Général'}\n✍️ *Auteur:* ${ann.author}\n📅 *Date:* ${new Date(ann.date).toLocaleDateString('fr-FR')}\n\n_Partagé via UniConnect_`;

    const copyToClipboardFallback = async () => {
      try {
        await navigator.clipboard.writeText(structuredContent);
        addNotification({ 
          title: 'Contenu copié', 
          message: 'Le texte structuré est prêt dans votre presse-papiers pour un partage manuel.', 
          type: 'success' 
        });
      } catch (err) {
        addNotification({ title: 'Erreur', message: 'Impossible de copier le contenu.', type: 'alert' });
      }
    };

    try {
      if (navigator.share) {
        await navigator.share({
          title: `UniConnect: ${ann.title}`,
          text: structuredContent
        });
      } else {
        await copyToClipboardFallback();
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        await copyToClipboardFallback();
      }
    } finally {
      await API.interactions.incrementShare('announcements', ann.id);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setSubmitting(true);
    try {
        await API.announcements.delete(deleteConfirmId);
        addNotification({ title: 'Supprimé', message: 'L\'annonce a été retirée du flux.', type: 'info' });
        fetchAnnouncements(false);
        setDeleteConfirmId(null);
    } catch (e) {
        addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    } finally {
        setSubmitting(false);
    }
  };

  const renderPriorityBadge = (priority: AnnouncementPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-rose-500/30 ml-3 align-middle animate-pulse">
            <AlertTriangle size={12} strokeWidth={3} /> Urgent
          </span>
        );
      case 'important':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/30 ml-3 align-middle">
            <Zap size={12} fill="currentColor" /> Important
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-wider border border-gray-200 dark:border-gray-700 ml-3 align-middle">
            <Info size={12} /> Info
          </span>
        );
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
      return matchesSearch && matchesPriority && matchesClassFilter;
    });
  }, [user, announcements, searchTerm, priorityFilter, classFilter]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-4">
        <Loader2 className="animate-spin" style={{ color: themeColor }} size={40} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse italic">Synchronisation du flux...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div 
             className="w-16 h-16 text-white rounded-[1.8rem] flex items-center justify-center shadow-xl rotate-3"
             style={{ backgroundColor: themeColor, boxShadow: `0 20px 30px -10px ${themeColor}66` }}
           >
              <Megaphone size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none uppercase">Mur d'Annonces</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
                 <Globe size={12} /> ESP DAKAR • FLUX CENTRALISÉ
              </p>
           </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
           {canCreate && (
             <button 
               onClick={() => { setEditingId(null); setIsModalOpen(true); }} 
               className="w-full sm:w-auto flex items-center justify-center gap-3 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all italic"
               style={{ backgroundColor: themeColor, boxShadow: `0 15px 20px -5px ${themeColor}44` }}
             >
               <Plus size={20} /> Nouvelle Annonce
             </button>
           )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-gray-900 p-3 rounded-[2rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Filtrer le journal..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-transparent border-none rounded-2xl text-sm font-bold outline-none italic"
          />
        </div>
        <div className="flex gap-2">
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-6 py-5 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer">
             <option value="all">Priorité</option>
             <option value="urgent">Urgent</option>
             <option value="important">Important</option>
             <option value="normal">Normal</option>
          </select>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="px-6 py-5 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer">
             <option value="all">Classe</option>
             <option value="Général">Général</option>
             {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-8">
        {displayedAnnouncements.map((ann) => {
          const isUrgent = ann.priority === 'urgent';
          const isRead = readIds.has(ann.id);
          const isCopied = copiedId === ann.id;
          const isFavorite = favoriteIds.has(ann.id);
          const canModify = user?.role === UserRole.ADMIN || (user?.role === UserRole.DELEGATE && ann.className === user.className);
          const annDate = new Date(ann.date);
          
          return (
            <div 
              key={ann.id} 
              className={`group relative bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border-2 transition-all duration-500 ease-out flex flex-col md:flex-row gap-10 overflow-hidden hover:scale-[1.01] hover:shadow-premium ${
                isUrgent ? 'border-rose-100 bg-rose-50/10' : 'border-transparent hover:border-gray-100'
              } ${isRead ? 'opacity-60 grayscale-[0.5]' : ''}`}
            >
              <div 
                className="absolute top-0 left-0 w-2 h-full"
                style={{ backgroundColor: isUrgent ? '#f43f5e' : themeColor }}
              />

              <div className="flex flex-col items-center justify-center w-28 h-28 bg-gray-50 dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shrink-0">
                  <span className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: themeColor }}>
                    {annDate.toLocaleDateString('fr-FR', {weekday: 'short'}).replace('.', '')}
                  </span>
                  <span className="text-4xl font-black text-gray-900 dark:text-white leading-none tracking-tighter italic">
                    {annDate.getDate()}
                  </span>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                    {annDate.toLocaleDateString('fr-FR', {month: 'short'}).replace('.', '')}
                  </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-wrap gap-3">
                    <span className="text-[9px] font-black uppercase px-4 py-2 rounded-full bg-gray-900 text-white tracking-widest italic">
                      {ann.className || 'Général'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleToggleRead(ann.id)} 
                      className={`p-3 rounded-2xl transition-all ${isRead ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-400 hover:text-emerald-500'}`}
                      title={isRead ? "Marquer comme non lu" : "Marquer comme lu"}
                    >
                      <Check size={18} strokeWidth={3} />
                    </button>
                    {canModify && (
                      <>
                        <button onClick={() => { setEditingId(ann.id); setNewAnn(ann as any); setIsModalOpen(true); }} className="p-3 bg-gray-50 text-gray-400 hover:text-blue-500 rounded-2xl transition-all"><Pencil size={18} /></button>
                        <button onClick={() => setDeleteConfirmId(ann.id)} className="p-3 bg-gray-50 text-gray-400 hover:text-red-500 rounded-2xl transition-all"><Trash2 size={18} /></button>
                      </>
                    )}
                  </div>
                </div>

                <h3 className="text-4xl font-black text-gray-900 dark:text-white mb-6 italic tracking-tighter leading-[0.9] group-hover:translate-x-2 transition-transform duration-500 flex flex-wrap items-center">
                  {ann.title}
                  {renderPriorityBadge(ann.priority)}
                </h3>
                <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed italic opacity-90 mb-10 whitespace-pre-wrap">{ann.content}</p>

                <div className="pt-8 border-t-2 border-dashed border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-6">
                   <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg"
                        style={{ backgroundColor: themeColor }}
                      >
                        {ann.author.charAt(0)}
                      </div>
                      <div className="min-w-0">
                         <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest italic">{ann.author}</p>
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Délégué de classe</p>
                      </div>
                   </div>

                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleRelay(ann)}
                        className="flex items-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                      >
                         Relayer Directement <Share2 size={16} />
                      </button>
                      
                      <button 
                        onClick={() => handleCopyContent(ann)}
                        className={`p-4 rounded-2xl transition-all border-2 ${isCopied ? 'bg-emerald-50 border-emerald-200 text-emerald-500' : 'bg-gray-50 dark:bg-gray-800 border-transparent text-gray-400 hover:text-primary-500'}`}
                        title="Copier le texte"
                      >
                        {isCopied ? <Check size={20} strokeWidth={3} /> : <Copy size={20} />}
                      </button>

                      <button 
                        onClick={() => handleToggleFavorite(ann.id)}
                        className={`p-4 rounded-2xl transition-all border-2 ${isFavorite ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-gray-50 dark:bg-gray-800 border-transparent text-gray-400 hover:text-amber-500'}`}
                        title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                      >
                        <Bookmark size={20} className={isFavorite ? 'fill-current' : ''} />
                      </button>
                   </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Publication/Édition */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Éditer l'avis" : "Publier une annonce"}>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <input required type="text" value={newAnn.title} onChange={e => setNewAnn({...newAnn, title: e.target.value})} className="w-full px-6 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-black italic outline-none" placeholder="Titre de l'avis" />
          <textarea required rows={5} value={newAnn.content} onChange={e => setNewAnn({...newAnn, content: e.target.value})} className="w-full px-6 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold italic outline-none" placeholder="Message détaillé..." />
          <div className="grid grid-cols-2 gap-4">
             <select value={newAnn.priority} onChange={e => setNewAnn({...newAnn, priority: e.target.value as AnnouncementPriority})} className="w-full px-5 py-4 rounded-xl bg-gray-50 font-black text-[10px] uppercase outline-none">
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
             </select>
             <select value={newAnn.className} onChange={e => setNewAnn({...newAnn, className: e.target.value})} className="w-full px-5 py-4 rounded-xl bg-gray-50 font-black text-[10px] uppercase outline-none">
                <option value="">Général</option>
                {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
             </select>
          </div>
          <button type="submit" className="w-full text-white font-black py-5 rounded-[2rem] shadow-xl flex justify-center items-center gap-3 uppercase tracking-widest italic transition-all" style={{ backgroundColor: themeColor }}>
            {submitting ? <Loader2 className="animate-spin" /> : <Send size={24} />}
            {editingId ? 'Mettre à jour' : 'Diffuser l\'annonce'}
          </button>
        </form>
      </Modal>

      {/* Modal de Confirmation de Suppression */}
      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Confirmer la suppression">
        <div className="flex flex-col items-center text-center space-y-6 py-4">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center animate-bounce">
                <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase italic">Attention</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium italic">
                    Êtes-vous certain de vouloir supprimer cette annonce ? Cette action est irréversible et retirera l'information du flux de tous les étudiants.
                </p>
            </div>
            <div className="flex gap-4 w-full pt-4">
                <button 
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                    Annuler
                </button>
                <button 
                    onClick={handleConfirmDelete}
                    disabled={submitting}
                    className="flex-1 px-6 py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                >
                    {submitting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    Confirmer
                </button>
            </div>
        </div>
      </Modal>
    </div>
  );
}
