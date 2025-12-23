
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
  const [attachmentFilter, setAttachmentFilter] = useState<boolean>(false);

  const canCreate = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;
  const isAdmin = user?.role === UserRole.ADMIN;

  // Charger les IDs lus depuis le localStorage
  useEffect(() => {
    const savedReadIds = localStorage.getItem(`read_announcements_${user?.id}`);
    if (savedReadIds) {
      try {
        setReadIds(new Set(JSON.parse(savedReadIds)));
      } catch (e) {
        console.error("Failed to parse read IDs", e);
      }
    }
  }, [user?.id]);

  // Sauvegarder les IDs lus quand ils changent
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

  useEffect(() => {
    if (isModalOpen && !editingId) {
      setNewAnn(prev => ({ 
        ...prev, 
        className: isAdmin ? '' : (user?.className || ''),
        links: [],
        attachments: []
      }));
    }
  }, [isModalOpen, editingId, isAdmin, user?.className]);

  const handleAddLink = () => {
    setNewAnn(prev => ({
      ...prev,
      links: [...prev.links, { label: '', url: '' }]
    }));
  };

  const handleRemoveLink = (index: number) => {
    setNewAnn(prev => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index)
    }));
  };

  const handleLinkChange = (index: number, field: keyof ExtLinkType, value: string) => {
    setNewAnn(prev => {
      const updatedLinks = [...prev.links];
      updatedLinks[index] = { ...updatedLinks[index], [field]: value };
      return { ...prev, links: updatedLinks };
    });
  };

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
      if (next.has(id)) {
        next.delete(id);
        addNotification({ title: 'Non lu', message: 'Marqué comme non lu.', type: 'info' });
      } else {
        next.add(id);
        addNotification({ title: 'Lu', message: 'Marqué comme lu.', type: 'success' });
      }
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
        message: added ? 'Annonce sauvegardée.' : 'Marque retirée.', 
        type: 'success' 
      });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleCopyContent = async (ann: Announcement) => {
    const textToCopy = `🎓 *UniConnect ESP - ${ann.className || 'Général'}*\n📢 *${ann.title.toUpperCase()}*\n\n${ann.content}\n\n✍️ Publié par : ${ann.author}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(ann.id);
      addNotification({ title: 'Copié', message: 'Texte prêt à être partagé.', type: 'success' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      addNotification({ title: 'Erreur', message: 'Copie impossible.', type: 'alert' });
    }
  };

  const handleRelay = async (ann: Announcement) => {
    const structuredContent = `🎓 *UniConnect ESP Dakar*\n📢 *${ann.title.toUpperCase()}*\n\n"${ann.content}"\n\n📌 *Classe:* ${ann.className || 'Général'}\n✍️ *Auteur:* ${ann.author}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `UniConnect: ${ann.title}`, text: structuredContent });
      } else {
        await navigator.clipboard.writeText(structuredContent);
        addNotification({ title: 'Copié', message: 'Texte prêt pour partage manuel.', type: 'success' });
      }
      await API.interactions.incrementShare('announcements', ann.id);
    } catch (e) {
      console.debug("Share aborted");
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
      const canSee = user?.role === UserRole.ADMIN ? true : (targetClass === user?.className || targetClass === 'Général');
      if (!canSee) return false;
      const matchesSearch = ann.title.toLowerCase().includes(searchTerm.toLowerCase()) || ann.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || ann.priority === priorityFilter;
      const matchesClassFilter = classFilter === 'all' || targetClass === classFilter;
      const matchesAttachments = !attachmentFilter || (ann.attachments && ann.attachments.length > 0) || (ann.links && ann.links.length > 0);
      return matchesSearch && matchesPriority && matchesClassFilter && matchesAttachments;
    });
  }, [user, announcements, searchTerm, priorityFilter, classFilter, attachmentFilter]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-4">
        <Loader2 className="animate-spin" style={{ color: themeColor }} size={40} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic animate-pulse">Sync...</p>
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

      <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-gray-900 p-3 rounded-[2rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" placeholder="Rechercher une annonce..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-transparent border-none rounded-2xl text-sm font-bold outline-none italic"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button 
            onClick={() => setAttachmentFilter(!attachmentFilter)}
            className={`px-6 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer transition-all flex items-center gap-2 ${attachmentFilter ? 'bg-primary-500 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-400'}`}
          >
            <Paperclip size={14} /> Pièces & Liens
          </button>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-6 py-5 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer">
             <option value="all">Toutes priorités</option>
             <option value="urgent">Urgent</option>
             <option value="important">Important</option>
          </select>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="px-6 py-5 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer">
             <option value="all">Toutes classes</option>
             {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-8">
        {displayedAnnouncements.length > 0 ? displayedAnnouncements.map((ann) => {
          const isUrgent = ann.priority === 'urgent';
          const isRead = readIds.has(ann.id);
          const isFavorite = favoriteIds.has(ann.id);
          const canModify = user?.role === UserRole.ADMIN || (user?.role === UserRole.DELEGATE && ann.className === user.className);
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
                    {annDate.toLocaleDateString('fr-FR', {weekday: 'short'}).replace('.', '')}
                  </span>
                  <span className="text-4xl font-black text-gray-900 dark:text-white italic">{annDate.getDate()}</span>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                    {annDate.toLocaleDateString('fr-FR', {month: 'short'}).replace('.', '')}
                  </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[9px] font-black uppercase px-4 py-2 rounded-full bg-gray-900 text-white tracking-widest italic">
                    {ann.className || 'Général'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleToggleRead(ann.id)} 
                      className={`p-3 rounded-2xl transition-all shadow-sm ${isRead ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20' : 'bg-gray-50 text-gray-400 hover:text-emerald-500'}`}
                      title={isRead ? "Marquer comme non lu" : "Marquer comme lu"}
                    >
                      <Check size={18} strokeWidth={3} />
                    </button>
                    {canModify && (
                      <>
                        <button onClick={() => { setEditingId(ann.id); setNewAnn(ann as any); setIsModalOpen(true); }} className="p-3 bg-gray-50 text-gray-400 hover:text-blue-500 rounded-2xl"><Pencil size={18} /></button>
                        <button onClick={() => setDeleteConfirmId(ann.id)} className="p-3 bg-gray-50 text-gray-400 hover:text-red-500 rounded-2xl"><Trash2 size={18} /></button>
                      </>
                    )}
                  </div>
                </div>

                <h3 className="text-4xl font-black text-gray-900 dark:text-white mb-4 italic tracking-tighter leading-[0.9] flex flex-wrap items-center gap-2">
                  {ann.title}
                  <div className="flex gap-2">
                    {isUrgent && <span className="text-[10px] bg-rose-500 text-white px-3 py-1 rounded-full uppercase font-black align-middle">Urgent</span>}
                    {isRead && <span className="text-[10px] bg-emerald-500 text-white px-3 py-1 rounded-full uppercase font-black align-middle flex items-center gap-1 shadow-sm"><Check size={10} strokeWidth={4} /> Lu</span>}
                  </div>
                </h3>
                <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed italic mb-8 whitespace-pre-wrap">{ann.content}</p>

                {/* Section Ressources Dynamiques */}
                {((ann.links && ann.links.length > 0) || (ann.attachments && ann.attachments.length > 0)) && (
                  <div className="mb-10 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 space-y-4">
                     <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                        <Paperclip size={12} /> Ressources & Pièces Jointes
                     </p>
                     <div className="flex flex-wrap gap-3">
                        {ann.links?.map((link, idx) => {
                          const isGoogleForm = link.url.includes('forms.gle') || link.url.includes('forms/d');
                          return (
                            <a 
                              key={idx} 
                              href={link.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
                                isGoogleForm 
                                ? 'bg-indigo-600 text-white shadow-indigo-500/20 hover:bg-indigo-700' 
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700 hover:border-primary-500'
                              }`}
                            >
                               {isGoogleForm ? <FormInput size={18} /> : <LinkIcon size={18} />}
                               {link.label || 'Ouvrir le lien'}
                            </a>
                          );
                        })}
                        {ann.attachments?.map((file, idx) => (
                           <div key={idx} className="flex items-center gap-3 px-6 py-4 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl font-black text-[11px] uppercase tracking-widest">
                              <FileText size={18} />
                              Document_{idx + 1}
                              <Download size={16} className="ml-2 cursor-pointer hover:scale-110 transition-transform" />
                           </div>
                        ))}
                     </div>
                  </div>
                )}

                <div className="pt-8 border-t-2 border-dashed border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-6">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg" style={{ backgroundColor: themeColor }}>
                        {ann.author.charAt(0)}
                      </div>
                      <div>
                         <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest italic">{ann.author}</p>
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Émetteur Officiel</p>
                      </div>
                   </div>

                   <div className="flex items-center gap-3">
                      <button onClick={() => handleRelay(ann)} className="flex items-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl">
                         Partager <Share2 size={16} />
                      </button>
                      <button onClick={() => handleToggleFavorite(ann.id)} className={`p-4 rounded-2xl border-2 transition-all ${isFavorite ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-gray-50 text-gray-400'}`}>
                        <Bookmark size={20} className={isFavorite ? 'fill-current' : ''} />
                      </button>
                   </div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-[3.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
             <FilterX size={48} className="mx-auto text-gray-300 mb-6" />
             <p className="text-lg font-black text-gray-400 uppercase tracking-widest italic">Aucun avis trouvé</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Éditer l'annonce" : "Nouvelle Annonce"}>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <input required type="text" value={newAnn.title} onChange={e => setNewAnn({...newAnn, title: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-black italic outline-none border-none" placeholder="Titre de l'avis" />
          <textarea required rows={5} value={newAnn.content} onChange={e => setNewAnn({...newAnn, content: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold italic outline-none border-none" placeholder="Description détaillée..." />
          
          <div className="grid grid-cols-2 gap-4">
             <select value={newAnn.priority} onChange={e => setNewAnn({...newAnn, priority: e.target.value as AnnouncementPriority})} className="w-full px-5 py-4 rounded-xl bg-gray-50 font-black text-[10px] uppercase outline-none border-none">
                <option value="normal">Priorité : Normale</option>
                <option value="important">Priorité : Importante</option>
                <option value="urgent">Priorité : Urgente</option>
             </select>
             <select disabled={!isAdmin} value={newAnn.className} onChange={e => setNewAnn({...newAnn, className: e.target.value})} className={`w-full px-5 py-4 rounded-xl bg-gray-50 font-black text-[10px] uppercase outline-none border-none ${!isAdmin ? 'opacity-50' : ''}`}>
                <option value="">Cible : Général</option>
                {classes.map(c => <option key={c.id} value={c.name}>Cible : {c.name}</option>)}
             </select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] italic">Liens & Ressources (Forms, ect.)</h4>
               <button type="button" onClick={handleAddLink} className="p-2 text-primary-500 hover:bg-primary-50 rounded-xl transition-all">
                  <Plus size={20} />
               </button>
            </div>
            
            <div className="space-y-3">
              {newAnn.links.map((link, idx) => (
                <div key={idx} className="flex gap-3 animate-in slide-in-from-right-2 duration-300">
                   <input 
                      type="text" placeholder="Nom (ex: Formulaire)" value={link.label} onChange={e => handleLinkChange(idx, 'label', e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs font-bold italic outline-none border-none"
                   />
                   <input 
                      type="url" placeholder="URL du lien" value={link.url} onChange={e => handleLinkChange(idx, 'url', e.target.value)}
                      className="flex-[2] px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs font-bold outline-none border-none"
                   />
                   <button type="button" onClick={() => handleRemoveLink(idx)} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                      <X size={18} />
                   </button>
                </div>
              ))}
              {newAnn.links.length === 0 && (
                <p className="text-center py-4 text-[10px] text-gray-300 font-bold italic">Aucun lien externe ajouté</p>
              )}
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full text-white font-black py-5 rounded-[2rem] shadow-xl flex justify-center items-center gap-3 uppercase tracking-widest italic transition-all active:scale-95" style={{ backgroundColor: themeColor }}>
            {submitting ? <Loader2 className="animate-spin" /> : <Send size={24} />}
            {editingId ? 'Mettre à jour l\'annonce' : 'Diffuser l\'avis maintenant'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Supprimer l'annonce">
        <div className="flex flex-col items-center text-center space-y-6 py-4">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                <AlertTriangle size={40} />
            </div>
            <p className="text-sm text-gray-500 font-medium italic">Voulez-vous vraiment supprimer cette annonce ?</p>
            <div className="flex gap-4 w-full">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-4 bg-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest">Annuler</button>
                <button onClick={handleConfirmDelete} className="flex-1 px-6 py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Confirmer</button>
            </div>
        </div>
      </Modal>
    </div>
  );
}
