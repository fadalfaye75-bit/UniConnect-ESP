
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Copy, Trash2, Loader2, Pencil, 
  Megaphone, Search, Filter, ChevronDown, Sparkles, FilterX, Send, Shield, Calendar as CalendarIcon, X, Link as LinkIcon, Paperclip, ExternalLink, Globe, FileText, Check
} from 'lucide-react';
import { UserRole, Announcement, AnnouncementPriority, ExternalLink as ExtLinkType } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

const PAGE_SIZE = 15;

export default function Announcements() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
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
  const [readIds, setReadIds] = useState<string[]>([]);

  const canCreate = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  const fetchAnnouncements = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true);
      const data = await API.announcements.list(0, 50);
      setAnnouncements(data);
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
    if (user) {
        const storedReads = localStorage.getItem(`uniconnect_read_anns_${user.id}`);
        if (storedReads) try { setReadIds(JSON.parse(storedReads)); } catch(e) {}
    }
    return () => { subscription.unsubscribe(); };
  }, [user, adminViewClass, fetchAnnouncements]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setNewAnn({
      title: '',
      content: '',
      priority: 'normal',
      className: user?.role === UserRole.DELEGATE ? user.className : 'Général',
      links: [],
      attachments: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, ann: Announcement) => {
    e.stopPropagation();
    setEditingId(ann.id);
    setNewAnn({
      title: ann.title,
      content: ann.content,
      priority: ann.priority,
      className: ann.className,
      links: ann.links || [],
      attachments: ann.attachments || []
    });
    setIsModalOpen(true);
  };

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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer définitivement cette annonce ?")) return;
    try {
      await API.announcements.delete(id);
      addNotification({ title: 'Supprimé', message: 'L\'avis a été retiré.', type: 'info' });
      fetchAnnouncements(false);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action non autorisée ou impossible.', type: 'alert' });
    }
  };

  const handleCopy = (e: React.MouseEvent, ann: Announcement) => {
    e.stopPropagation();
    const text = `📢 ${ann.title.toUpperCase()}\n\n${ann.content}\n\n🎓 ESP Dakar - ${ann.className}\n📅 ${new Date(ann.date).toLocaleDateString()}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(ann.id);
      addNotification({ title: 'Copié', message: 'Contenu copié dans le presse-papier.', type: 'success' });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleShare = (e: React.MouseEvent, ann: Announcement) => {
    e.stopPropagation();
    const shareData = {
      title: `UniConnect ESP : ${ann.title}`,
      text: ann.content,
      url: window.location.href
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent(ann.title)}&body=${encodeURIComponent(ann.content)}`;
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
    <div className="flex flex-col justify-center items-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Indexation des avis...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-950/95 py-6 backdrop-blur-md gap-6 border-b border-gray-100 dark:border-gray-800">
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

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-3 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
          <input 
            type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2">
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none">
             <option value="all">Toutes Priorités</option>
             <option value="urgent">Urgent</option>
             <option value="important">Important</option>
             <option value="normal">Normal</option>
          </select>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="px-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none">
             <option value="all">Toutes Classes</option>
             <option value="Général">Général</option>
             {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-6">
        {displayedAnnouncements.map((ann) => {
          const isUnread = user?.role === UserRole.STUDENT && !readIds.includes(ann.id);
          const canModify = user?.role === UserRole.ADMIN || (user?.role === UserRole.DELEGATE && ann.className === user.className);
          const isCopied = copiedId === ann.id;
          
          return (
            <div 
              key={ann.id} 
              className={`group relative rounded-[2.5rem] border p-8 transition-all duration-300 flex flex-col gap-6 hover:-translate-y-1 hover:shadow-2xl ${
                isUnread ? 'bg-white border-primary-200 shadow-lg shadow-primary-500/5' : 'bg-gray-50/50 border-gray-100 dark:border-gray-800 shadow-soft'
              }`}
            >
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex flex-col items-center justify-center w-20 h-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 flex-shrink-0 shadow-sm group-hover:rotate-2 transition-transform">
                    <span className="text-[9px] font-black text-gray-400 uppercase">{new Date(ann.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                    <span className="text-2xl font-black text-gray-900 dark:text-white leading-none">{new Date(ann.date).getDate()}</span>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-widest ${
                        ann.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-100' : 
                        ann.priority === 'important' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-primary-50 text-primary-600 border-primary-100'
                      }`}>
                        {ann.priority}
                      </span>
                      <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-gray-100 bg-white text-gray-400">
                        {ann.className || 'Général'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleCopy(e, ann)} 
                        className={`p-2 rounded-xl transition-all ${isCopied ? 'text-green-500 bg-green-50 shadow-inner' : 'text-gray-400 hover:text-primary-500 hover:bg-primary-50'}`} 
                        title="Copier le texte"
                      >
                        {isCopied ? <Check size={16} className="animate-in zoom-in" /> : <Copy size={16} />}
                      </button>
                      <button onClick={(e) => handleShare(e, ann)} className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all" title="Partager"><Share2 size={16} /></button>
                      {canModify && (
                        <>
                          <button onClick={(e) => handleOpenEdit(e, ann)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all" title="Modifier"><Pencil size={16} /></button>
                          <button onClick={(e) => handleDelete(e, ann.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Supprimer"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 italic tracking-tighter leading-tight group-hover:text-primary-600 transition-colors">
                    {ann.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic opacity-90 mb-6">{ann.content}</p>

                  {(ann.links?.length || 0) + (ann.attachments?.length || 0) > 0 && (
                    <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
                      {ann.links?.map((link, i) => (
                        <a key={i} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary-100 hover:bg-primary-500 hover:text-white transition-all shadow-sm">
                          <LinkIcon size={12} /> {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier l'avis" : "Diffuser une annonce"}>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <input required type="text" value={newAnn.title} onChange={e => setNewAnn({...newAnn, title: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold outline-none focus:ring-4 focus:ring-primary-100 transition-all" placeholder="Sujet de l'annonce..." />
          <textarea required rows={4} value={newAnn.content} onChange={e => setNewAnn({...newAnn, content: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold outline-none italic focus:ring-4 focus:ring-primary-100 transition-all" placeholder="Contenu du message..." />
          <div className="grid grid-cols-2 gap-4">
             <select value={newAnn.priority} onChange={e => setNewAnn({...newAnn, priority: e.target.value as any})} className="px-5 py-3 rounded-2xl bg-gray-50 font-black text-[10px] uppercase outline-none">
                <option value="normal">Priorité : Normal</option>
                <option value="important">Priorité : Important</option>
                <option value="urgent">Priorité : Urgent</option>
             </select>
             <select value={newAnn.className} onChange={e => setNewAnn({...newAnn, className: e.target.value})} className="px-5 py-3 rounded-2xl bg-gray-50 font-black text-[10px] uppercase outline-none">
                <option value="Général">Cible : Général</option>
                {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
             </select>
          </div>
          <button type="submit" disabled={submitting} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 transition-all uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" /> : (editingId ? <Pencil size={18} /> : <Send size={18} />)}
            {submitting ? 'Traitement...' : (editingId ? 'Mettre à jour l\'avis' : 'Diffuser maintenant')}
          </button>
        </form>
      </Modal>
    </div>
  );
}
