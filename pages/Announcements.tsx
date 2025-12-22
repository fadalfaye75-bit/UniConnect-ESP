
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Copy, Trash2, Loader2, Pencil, 
  Megaphone, Search, Filter, ChevronDown, Sparkles, FilterX, Send, Shield, Calendar as CalendarIcon, X, Link as LinkIcon, Paperclip, ExternalLink, Globe, FileText, Check, ArrowRight
} from 'lucide-react';
import { UserRole, Announcement, AnnouncementPriority, ExternalLink as ExtLinkType } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

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
    return () => {
      subscription.unsubscribe();
    };
  }, [user, adminViewClass, fetchAnnouncements]);

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

  const handleCopy = (e: React.MouseEvent, ann: Announcement) => {
    e.stopPropagation();
    const text = `📢 ${ann.title.toUpperCase()}\n\n${ann.content}\n\n🎓 ${user?.schoolName || 'ESP Dakar'} - ${ann.className}\n📅 ${new Date(ann.date).toLocaleDateString()}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(ann.id);
      addNotification({ title: 'Copié', message: 'Contenu copié.', type: 'success' });
      setTimeout(() => setCopiedId(null), 2000);
    });
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
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse italic">Indexation du mur d'avis...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-32">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 py-6 z-20 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
           <div className="p-4 bg-primary-500 text-white rounded-[1.5rem] shadow-xl shadow-primary-500/20">
              <Megaphone size={30} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none">Journal des Avis</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2 italic">Actualités du campus {user?.schoolName}</p>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
          {canCreate && (
            <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
               <Plus size={18} /> Publier un avis
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Rechercher par mot-clé..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[1.5rem] text-sm font-bold outline-none focus:ring-4 focus:ring-primary-50 transition-all shadow-soft"
          />
        </div>
        <div className="flex gap-2">
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-6 py-4 bg-white dark:bg-gray-900 border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none shadow-soft cursor-pointer">
             <option value="all">Priorité (Tout)</option>
             <option value="urgent">Urgent</option>
             <option value="important">Important</option>
             <option value="normal">Normal</option>
          </select>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="px-6 py-4 bg-white dark:bg-gray-900 border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none shadow-soft cursor-pointer">
             <option value="all">Classe (Tout)</option>
             <option value="Général">Général</option>
             {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-8">
        {displayedAnnouncements.map((ann) => {
          const isUrgent = ann.priority === 'urgent';
          const isImportant = ann.priority === 'important';
          const canModify = user?.role === UserRole.ADMIN || (user?.role === UserRole.DELEGATE && ann.className === user.className);
          
          return (
            <div 
              key={ann.id} 
              className={`group relative bg-white dark:bg-gray-900 rounded-[3rem] p-10 border-l-[8px] shadow-soft transition-all duration-500 hover:shadow-premium hover:-translate-y-2 hover:scale-[1.01] flex flex-col md:flex-row gap-10 ${
                isUrgent ? 'border-rose-500 bg-gradient-to-br from-white to-rose-50/30' : 
                isImportant ? 'border-amber-500 bg-gradient-to-br from-white to-amber-50/10' : 'border-blue-500'
              }`}
            >
              {/* Animation focus visual bar */}
              <div className={`absolute top-0 left-0 w-2 h-0 group-hover:h-full transition-all duration-500 ${
                  isUrgent ? 'bg-rose-600' : isImportant ? 'bg-amber-600' : 'bg-blue-600'
              }`}></div>

              <div className="flex flex-col items-center justify-center w-24 h-24 bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-lg group-hover:rotate-3 group-hover:shadow-xl transition-all duration-500 shrink-0">
                  <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isUrgent ? 'text-rose-500' : 'text-gray-400'}`}>{new Date(ann.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                  <span className="text-4xl font-black text-gray-900 dark:text-white leading-none tracking-tighter">{new Date(ann.date).getDate()}</span>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border tracking-[0.2em] transition-all duration-300 group-hover:scale-105 ${
                      isUrgent ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20' : 
                      isImportant ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-primary-50 text-primary-600 border-primary-100'
                    }`}>
                      {ann.priority}
                    </span>
                    <span className="text-[9px] font-black uppercase px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700 tracking-widest">
                      {ann.className || 'Général'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                    <button onClick={(e) => handleCopy(e, ann)} className={`p-3 rounded-2xl transition-all ${copiedId === ann.id ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-400 hover:text-primary-500 hover:bg-white hover:shadow-md'}`}>
                      {copiedId === ann.id ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    {canModify && (
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(ann.id); setNewAnn(ann as any); setIsModalOpen(true); }} className="p-3 bg-gray-50 text-gray-400 hover:text-blue-500 hover:bg-white hover:shadow-md rounded-2xl transition-all"><Pencil size={18} /></button>
                    )}
                  </div>
                </div>

                <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 italic tracking-tighter leading-tight group-hover:text-primary-600 transition-colors duration-300">
                  {ann.title}
                </h3>
                <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed italic opacity-90 mb-8 whitespace-pre-wrap">{ann.content}</p>

                <div className="pt-8 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                   <div className="flex items-center gap-3 group/author">
                      <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-xl flex items-center justify-center font-black text-sm transition-transform group-hover/author:scale-110">{ann.author.charAt(0)}</div>
                      <div className="min-w-0">
                         <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest italic leading-none">{ann.author}</p>
                         <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1">{user?.schoolName || 'ESP DAKAR'}</p>
                      </div>
                   </div>
                   <button onClick={(e) => { e.stopPropagation(); addNotification({ title: 'Partagé', message: 'L\'avis a été partagé.', type: 'info' }); }} className="flex items-center gap-3 px-6 py-3 bg-gray-900 text-white dark:bg-gray-800 dark:text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl hover:shadow-primary-500/20">
                      Relayer <Share2 size={14} className="group-hover:rotate-12 transition-transform" />
                   </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
