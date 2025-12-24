
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Trash2, Loader2, Pencil, 
  Megaphone, Search, Link as LinkIcon, Paperclip, 
  Globe2, Trash, FileText, Image as ImageIcon,
  CheckCircle2, Bookmark, Eye, AlertTriangle, 
  FileSpreadsheet, ClipboardList, Check, ArrowRight, Maximize2,
  Calendar, User as UserIcon, Hash, Copy, Download, ExternalLink, X, Upload, Save,
  PlusCircle,
  Link2
} from 'lucide-react';
import { UserRole, Announcement, AnnouncementPriority, ExternalLink as ExtLinkType } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

const StructuredContent = ({ content }: { content: string }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-4">
      {lines.map((line, i) => {
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          return (
            <div key={i} className="flex gap-3 pl-4">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 shrink-0" />
              <p className="text-gray-700 dark:text-gray-300 italic text-base leading-relaxed">{line.trim().substring(2)}</p>
            </div>
          );
        }
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={i} className="text-gray-700 dark:text-gray-300 italic text-base leading-relaxed min-h-[1.5rem]">
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-black text-gray-900 dark:text-white not-italic">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

export default function Announcements() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const themeColor = user?.themeColor || '#0ea5e9';
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingAnn, setViewingAnn] = useState<Announcement | null>(null);
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

  // State local pour l'ajout de lien en cours dans le modal
  const [tempLink, setTempLink] = useState({ label: '', url: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');

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

  const handleAddLink = () => {
    if (!tempLink.label || !tempLink.url) return;
    setNewAnn({
      ...newAnn,
      links: [...(newAnn.links || []), { ...tempLink }]
    });
    setTempLink({ label: '', url: '' });
  };

  const handleRemoveLink = (index: number) => {
    const updatedLinks = [...(newAnn.links || [])];
    updatedLinks.splice(index, 1);
    setNewAnn({ ...newAnn, links: updatedLinks });
  };

  const handleShare = async (ann: Announcement) => {
    if (processingIds.has(ann.id)) return;
    setProcessingIds(prev => new Set(prev).add(ann.id));

    try {
      const priorityEmoji = ann.priority === 'urgent' ? '🚨' : ann.priority === 'important' ? '⚠️' : 'ℹ️';
      let shareText = `${priorityEmoji} *UniConnect ESP - INFO*\n\n*${ann.title.toUpperCase()}*\n\n${ann.content}\n\n#UniConnect #ESP`;

      if (navigator.share) {
        await navigator.share({ title: ann.title, text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        addNotification({ title: 'Copié', message: 'Prêt pour partage.', type: 'success' });
      }
      await API.interactions.incrementShare('announcements', ann.id);
    } catch (err) {
      console.warn("Share failed");
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(ann.id);
        return next;
      });
    }
  };

  const handleToggleFavorite = async (id: string) => {
    if (processingIds.has(id)) return;
    setProcessingIds(prev => new Set(prev).add(id));

    try {
      const added = await API.favorites.toggle(id, 'announcement');
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (added) next.add(id); else next.delete(id);
        return next;
      });
      addNotification({ title: added ? 'Favori ajouté' : 'Favori retiré', message: 'Effectué.', type: 'success' });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !newAnn.title.trim() || !newAnn.content.trim()) return;

    setSubmitting(true);
    try {
      const finalAnn = {
        ...newAnn,
        className: isAdmin ? newAnn.className : (user?.className || 'Général'),
        date: new Date().toISOString()
      };

      if (editingId) {
        await API.announcements.update(editingId, finalAnn);
      } else {
        await API.announcements.create(finalAnn);
      }
      setIsModalOpen(false);
      fetchAnnouncements(false);
      addNotification({ title: 'Succès', message: 'Publication effectuée.', type: 'success' });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error?.message || 'Action impossible.', type: 'alert' });
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
      return matchesSearch && matchesPriority && matchesClassFilter;
    });
  }, [user, announcements, searchTerm, priorityFilter, classFilter, isAdmin]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-6">
        <Loader2 className="animate-spin" style={{ color: themeColor }} size={40} />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Chargement...</span>
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
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Actualités ESP</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3">ESP Dakar • Info Officielle</p>
           </div>
        </div>
        
        {canCreateAtAll && (
          <button 
            disabled={submitting}
            onClick={() => { setEditingId(null); setNewAnn({ title: '', content: '', priority: 'normal', className: isAdmin ? '' : (user?.className || ''), links: [], attachments: [] }); setIsModalOpen(true); }} 
            className="w-full sm:w-auto flex items-center justify-center gap-3 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all italic hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: themeColor }}
          >
            <Plus size={20} /> Nouvelle Publication
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-gray-900 p-4 rounded-[2.5rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-transparent border-none rounded-2xl text-sm font-bold outline-none italic"
          />
        </div>
      </div>

      <div className="grid gap-8">
        {displayedAnnouncements.map((ann) => (
            <div key={ann.id} className="group relative bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border-2 border-transparent hover:border-gray-100 transition-all flex flex-col md:flex-row gap-10 overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: ann.priority === 'urgent' ? '#f43f5e' : themeColor }} />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                   <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-lg tracking-widest text-white ${ann.priority === 'urgent' ? 'bg-rose-500' : 'bg-gray-500'}`}>{ann.priority}</span>
                   <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{ann.author}</span>
                </div>
                <h3 onClick={() => setViewingAnn(ann)} className="text-2xl font-black text-gray-900 dark:text-white italic tracking-tighter mb-4 cursor-pointer hover:text-primary-500 transition-colors leading-tight">{ann.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 italic text-sm line-clamp-3 mb-6">{ann.content}</p>
                <div className="flex items-center gap-4">
                   <button onClick={() => setViewingAnn(ann)} className="text-[10px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-2">Lire la suite <Maximize2 size={14} /></button>
                   {ann.links && ann.links.length > 0 && (
                     <span className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                       <Link2 size={12} /> {ann.links.length} lien(s)
                     </span>
                   )}
                </div>
              </div>
              <div className="flex md:flex-col items-center justify-center gap-2 p-6 md:p-0 md:pl-10 border-t md:border-t-0 md:border-l border-gray-100">
                 <button disabled={processingIds.has(ann.id)} onClick={() => handleShare(ann)} className="p-3.5 bg-gray-900 text-white rounded-2xl active:scale-90 transition-all">
                   {processingIds.has(ann.id) ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20}/>}
                 </button>
                 <button disabled={processingIds.has(ann.id)} onClick={() => handleToggleFavorite(ann.id)} className={`p-3.5 rounded-2xl border transition-all active:scale-90 ${favoriteIds.has(ann.id) ? 'bg-amber-50 text-amber-500 border-amber-200' : 'bg-gray-50 text-gray-400'}`}>
                    <Bookmark size={20} className={favoriteIds.has(ann.id) ? 'fill-current' : ''}/>
                 </button>
              </div>
            </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer une diffusion">
         <form onSubmit={handleFormSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Titre</label>
              <input required value={newAnn.title} onChange={e => setNewAnn({...newAnn, title: e.target.value})} className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none" placeholder="Sujet..." />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Priorité</label>
                <select value={newAnn.priority} onChange={e => setNewAnn({...newAnn, priority: e.target.value as any})} className="p-4 w-full bg-gray-50 dark:bg-gray-800 rounded-2xl font-black text-[10px] uppercase outline-none">
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Cible</label>
                <select disabled={!isAdmin} value={newAnn.className} onChange={e => setNewAnn({...newAnn, className: e.target.value})} className="p-4 w-full bg-gray-50 dark:bg-gray-800 rounded-2xl font-black text-[10px] uppercase outline-none">
                  <option value="Général">Toute l'ESP</option>
                  {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Contenu</label>
              <textarea required value={newAnn.content} onChange={e => setNewAnn({...newAnn, content: e.target.value})} rows={6} className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none italic" placeholder="Message..." />
            </div>

            {/* Section Liens Optionnels */}
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] border border-gray-100 dark:border-gray-700">
               <label className="block text-[10px] font-black text-gray-500 uppercase mb-4 tracking-widest">Liens utiles (Optionnel)</label>
               <div className="space-y-4 mb-4">
                  {newAnn.links?.map((link, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-sm">
                      <div className="min-w-0">
                         <p className="text-[10px] font-black text-primary-500 uppercase truncate">{link.label}</p>
                         <p className="text-[9px] text-gray-400 truncate italic">{link.url}</p>
                      </div>
                      <button type="button" onClick={() => handleRemoveLink(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={tempLink.label} onChange={e => setTempLink({...tempLink, label: e.target.value})} className="px-4 py-3 bg-white dark:bg-gray-700 rounded-xl text-[10px] font-bold outline-none" placeholder="Libellé (ex: Document PDF)" />
                  <div className="flex gap-2">
                    <input value={tempLink.url} onChange={e => setTempLink({...tempLink, url: e.target.value})} className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 rounded-xl text-[10px] font-bold outline-none" placeholder="Lien (URL)" />
                    <button type="button" onClick={handleAddLink} className="p-3 bg-primary-500 text-white rounded-xl active:scale-95 transition-all">
                       <Plus size={16} />
                    </button>
                  </div>
               </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full py-5 rounded-[2.5rem] bg-primary-500 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
               {submitting ? <Loader2 className="animate-spin" /> : "Publier maintenant"}
            </button>
         </form>
      </Modal>

      <Modal isOpen={!!viewingAnn} onClose={() => setViewingAnn(null)} title="Information">
         {viewingAnn && (
           <div className="space-y-8">
              <div className="space-y-2">
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg text-white ${viewingAnn.priority === 'urgent' ? 'bg-rose-500' : 'bg-gray-500'}`}>{viewingAnn.priority}</span>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase italic leading-tight">{viewingAnn.title}</h2>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest italic">{viewingAnn.author} • {new Date(viewingAnn.date).toLocaleDateString()}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-inner-soft">
                 <StructuredContent content={viewingAnn.content} />
              </div>

              {/* Affichage des liens dans la vue détaillée */}
              {viewingAnn.links && viewingAnn.links.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ressources jointes</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {viewingAnn.links.map((link, idx) => (
                      <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl hover:border-primary-300 hover:shadow-soft transition-all group">
                         <div className="min-w-0">
                           <p className="text-xs font-black text-gray-800 dark:text-white italic truncate">{link.label}</p>
                           <p className="text-[9px] text-gray-400 truncate italic mt-0.5">Lien externe</p>
                         </div>
                         <ExternalLink size={16} className="text-primary-500 group-hover:scale-110 transition-transform" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                 <button onClick={() => handleShare(viewingAnn)} className="flex-1 py-5 bg-gray-900 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl">Partager</button>
                 <button onClick={() => handleToggleFavorite(viewingAnn.id)} className={`flex-1 py-5 border-2 rounded-[2rem] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all ${favoriteIds.has(viewingAnn.id) ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-white text-gray-400 border-gray-100'}`}>
                   {favoriteIds.has(viewingAnn.id) ? 'Enregistré' : 'Favori'}
                 </button>
              </div>
           </div>
         )}
      </Modal>
    </div>
  );
}
