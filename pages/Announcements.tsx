
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Plus, Share2, Trash2, Loader2, Pencil, 
  Megaphone, Search, Link as LinkIcon, Paperclip, 
  Globe2, Trash, FileText, Image as ImageIcon,
  CheckCircle2, Bookmark, Eye, AlertTriangle, 
  FileSpreadsheet, ClipboardList, Check, ArrowRight, Maximize2,
  Calendar, User as UserIcon, Hash, Copy, Download, ExternalLink, X, Upload, Save
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
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingAnn, setViewingAnn] = useState<Announcement | null>(null);
  
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

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleShare = async (ann: Announcement) => {
    const priorityEmoji = ann.priority === 'urgent' ? '🚨' : ann.priority === 'important' ? '⚠️' : 'ℹ️';
    const dateStr = new Date(ann.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    
    let shareText = `${priorityEmoji} *UniConnect ESP - INFO OFFICIELLE*\n\n`;
    shareText += `📌 *Sujet :* ${ann.title.toUpperCase()}\n`;
    shareText += `🗓️ *Date :* ${dateStr}\n`;
    shareText += `👤 *Auteur :* ${ann.author}\n\n`;
    shareText += `${ann.content}\n\n`;

    if (ann.links && ann.links.length > 0) {
      shareText += `🔗 *LIENS D'ACTION :*\n`;
      ann.links.forEach(l => {
        shareText += `- ${l.label} : ${l.url}\n`;
      });
      shareText += `\n`;
    }

    if (ann.attachments && ann.attachments.length > 0) {
      shareText += `📂 *DOCUMENTS JOINTS :*\n`;
      ann.attachments.forEach(a => {
        shareText += `- Fichier : ${a}\n`;
      });
      shareText += `\n`;
    }

    shareText += `#UniConnect #ESP #Dakar`;

    if (navigator.share) {
      try {
        await navigator.share({ title: ann.title, text: shareText });
        await API.interactions.incrementShare('announcements', ann.id);
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        addNotification({ title: 'Copié', message: 'Message structuré prêt pour WhatsApp.', type: 'success' });
        await API.interactions.incrementShare('announcements', ann.id);
      } catch (err) {
        addNotification({ title: 'Erreur', message: 'Impossible de copier.', type: 'alert' });
      }
    }
  };

  const handleExportResource = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      addNotification({ title: 'Lien extrait', message: `Le lien de "${label}" est dans votre presse-papier.`, type: 'success' });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Exportation échouée.', type: 'alert' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnn.title.trim() || !newAnn.content.trim()) return;

    setSubmitting(true);
    try {
      // 1. Upload des nouveaux fichiers vers Supabase Storage
      const uploadedUrls = [];
      for (const file of selectedFiles) {
        const url = await API.storage.upload('announcement-assets', file);
        uploadedUrls.push(url);
      }

      // Fusionner les anciens (si édition) et les nouveaux uploads
      const finalAttachments = [...(newAnn.attachments || []), ...uploadedUrls];

      const finalAnn = {
        ...newAnn,
        className: isAdmin ? newAnn.className : (user?.className || 'Général'),
        links: newAnn.links.filter(l => l.label.trim() !== '' && l.url.trim() !== ''),
        attachments: finalAttachments
      };

      if (editingId) {
        await API.announcements.update(editingId, finalAnn);
        addNotification({ title: 'Mis à jour', message: 'Modifications enregistrées.', type: 'success' });
      } else {
        await API.announcements.create(finalAnn);
        addNotification({ title: 'Diffusé', message: 'L\'annonce est maintenant visible.', type: 'success' });
      }
      setIsModalOpen(false);
      setSelectedFiles([]);
      fetchAnnouncements(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error?.message || 'Action impossible.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const openAnnDetail = (ann: Announcement) => {
    setViewingAnn(ann);
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(ann.id);
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

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      {/* Header UI */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 text-white rounded-[1.8rem] flex items-center justify-center shadow-xl rotate-3" style={{ backgroundColor: themeColor }}>
              <Megaphone size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Actualités ESP</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3">Flux Officiel • DÉLÉGUÉS & ADMIN</p>
           </div>
        </div>
        
        {canCreateAtAll && (
          <button 
            onClick={() => { setEditingId(null); setNewAnn({ title: '', content: '', priority: 'normal', className: isAdmin ? '' : (user?.className || ''), links: [], attachments: [] }); setSelectedFiles([]); setIsModalOpen(true); }} 
            className="w-full sm:w-auto flex items-center justify-center gap-3 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all italic hover:brightness-110"
            style={{ backgroundColor: themeColor }}
          >
            <Plus size={20} /> Nouvelle Publication
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-gray-900 p-4 rounded-[2.5rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Filtrer les annonces..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-transparent border-none rounded-2xl text-sm font-bold outline-none italic"
          />
        </div>
        <div className="flex gap-2">
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase outline-none border-none cursor-pointer">
             <option value="all">Toutes Priorités</option>
             <option value="urgent">Urgents</option>
             <option value="important">Importants</option>
          </select>
        </div>
      </div>

      {/* Main Feed */}
      <div className="grid gap-8">
        {displayedAnnouncements.map((ann) => {
          const isUrgent = ann.priority === 'urgent';
          const isImportant = ann.priority === 'important';
          const isRead = readIds.has(ann.id);
          const isFavorite = favoriteIds.has(ann.id);
          const isLong = ann.content.length > 300;
          const contentPreview = isLong ? ann.content.substring(0, 300) + '...' : ann.content;
          
          return (
            <div 
              key={ann.id} 
              className={`group relative bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border-2 transition-all duration-500 flex flex-col md:flex-row gap-10 overflow-hidden ${
                isUrgent ? 'border-rose-100 bg-rose-50/10' : 'border-transparent hover:border-gray-100'
              } ${isRead ? 'opacity-60' : ''}`}
            >
              <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: isUrgent ? '#f43f5e' : isImportant ? '#f59e0b' : themeColor }} />

              <div className="flex flex-col items-center justify-center w-28 h-28 bg-gray-50 dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-lg shrink-0">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{new Date(ann.date).toLocaleDateString('fr-FR', {weekday: 'short'})}</span>
                  <span className="text-4xl font-black text-gray-900 dark:text-white italic">{new Date(ann.date).getDate()}</span>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{new Date(ann.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-4">
                   <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-lg tracking-widest shadow-sm ${
                      isUrgent ? 'bg-rose-500 text-white' : isImportant ? 'bg-amber-500 text-white' : 'bg-gray-500 text-white'
                   }`}>{ann.priority}</span>
                   <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{ann.author}</span>
                   <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest bg-primary-50 px-2.5 py-1 rounded-lg">{ann.className || 'Général'}</span>
                </div>

                <h3 onClick={() => openAnnDetail(ann)} className="text-2xl font-black text-gray-900 dark:text-white italic tracking-tighter mb-4 cursor-pointer hover:text-primary-500 transition-colors leading-tight">{ann.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 italic leading-relaxed text-sm whitespace-pre-wrap mb-4">{contentPreview}</p>
                
                <div className="flex flex-wrap gap-2 mb-6">
                   {(ann.links && ann.links.length > 0) && (
                     <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-100">
                        <Globe2 size={12} /> {ann.links.length} Liens
                     </div>
                   )}
                   {(ann.attachments && ann.attachments.length > 0) && (
                     <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                        <Paperclip size={12} /> {ann.attachments.length} Imports
                     </div>
                   )}
                </div>

                {isLong && (
                  <button onClick={() => openAnnDetail(ann)} className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em] flex items-center gap-2 hover:gap-4 transition-all">Consulter la suite <Maximize2 size={14} /></button>
                )}
              </div>

              <div className="flex md:flex-col items-center justify-center gap-2 p-6 md:p-0 md:pl-10 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800">
                 <button onClick={() => handleShare(ann)} className="p-3.5 bg-gray-900 text-white rounded-2xl hover:scale-110 transition-all shadow-lg active:scale-95" title="Partager"><Share2 size={20}/></button>
                 <button onClick={() => handleToggleFavorite(ann.id)} className={`p-3.5 rounded-2xl border transition-all active:scale-90 ${isFavorite ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-gray-50 text-gray-400'}`} title="Favori"><Bookmark size={20} className={isFavorite ? 'fill-current' : ''}/></button>
                 <button onClick={() => openAnnDetail(ann)} className="p-3.5 bg-primary-50 text-primary-500 rounded-2xl hover:bg-primary-500 hover:text-white transition-all active:scale-90" title="Voir les détails"><Eye size={20}/></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Creation Modal - STRICT IMPORT MODE */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Édition de l'annonce" : "Diffusion de document"}>
         <form onSubmit={handleFormSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Titre de l'information</label>
              <input required value={newAnn.title} onChange={e => setNewAnn({...newAnn, title: e.target.value})} className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none border-none focus:ring-2 focus:ring-primary-500" placeholder="ex: Emploi du temps S2 révisé" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Importance</label>
                <select value={newAnn.priority} onChange={e => setNewAnn({...newAnn, priority: e.target.value as any})} className="p-4 w-full bg-gray-50 dark:bg-gray-800 rounded-2xl font-black text-[10px] uppercase outline-none">
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Audience cible</label>
                <select disabled={!isAdmin} value={newAnn.className} onChange={e => setNewAnn({...newAnn, className: e.target.value})} className="p-4 w-full bg-gray-50 dark:bg-gray-800 rounded-2xl font-black text-[10px] uppercase outline-none">
                  <option value="Général">Toute l'établissement</option>
                  {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Message d'accompagnement</label>
              <textarea required value={newAnn.content} onChange={e => setNewAnn({...newAnn, content: e.target.value})} rows={6} className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none border-none focus:ring-2 focus:ring-primary-500 italic" placeholder="Précisez les détails ici..." />
            </div>
            
            {/* Action Links (External tools like Drive, Forms) */}
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
               <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Liens Externes (Forms, Drive)</h4>
                  <button type="button" onClick={() => setNewAnn({...newAnn, links: [...newAnn.links, {label:'', url:''}]})} className="text-[9px] font-black text-blue-500 uppercase px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">+ Ajouter</button>
               </div>
               {newAnn.links.map((link, idx) => (
                 <div key={idx} className="flex gap-2 animate-fade-in">
                    <input className="flex-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs font-bold" placeholder="Nom (ex: Formulaire)" value={link.label} onChange={e => {
                      const next = [...newAnn.links];
                      next[idx].label = e.target.value;
                      setNewAnn({...newAnn, links: next});
                    }} />
                    <input className="flex-[2] p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs font-bold" placeholder="URL" value={link.url} onChange={e => {
                      const next = [...newAnn.links];
                      next[idx].url = e.target.value;
                      setNewAnn({...newAnn, links: next});
                    }} />
                    <button type="button" onClick={() => setNewAnn({...newAnn, links: newAnn.links.filter((_, i) => i !== idx)})} className="p-3 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl"><Trash2 size={16}/></button>
                 </div>
               ))}
            </div>

            {/* IMPORT DE DOCUMENTS - PAS D'URL MANUELLE */}
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
               <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Import de Fichiers (Supabase)</h4>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[9px] font-black text-emerald-500 uppercase px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center gap-2 shadow-sm border border-emerald-100">
                    <Upload size={14} /> Sélectionner les fichiers
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
               </div>

               <div className="space-y-2">
                 {/* Files already on Supabase (if editing) */}
                 {newAnn.attachments?.map((url, idx) => (
                   <div key={`existing-${idx}`} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm text-emerald-500">
                            <Check size={16} />
                         </div>
                         <span className="text-[10px] font-black text-gray-500 uppercase truncate max-w-[200px]">Fichier déjà en ligne</span>
                      </div>
                      <button type="button" onClick={() => setNewAnn({...newAnn, attachments: newAnn.attachments.filter((_, i) => i !== idx)})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                   </div>
                 ))}

                 {/* Newly Selected Files to be uploaded */}
                 {selectedFiles.map((file, idx) => (
                   <div key={`new-${idx}`} className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 animate-pulse">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-white dark:bg-emerald-800 rounded-lg shadow-sm text-emerald-500">
                            {file.type.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}
                         </div>
                         <div className="min-w-0">
                            <p className="text-[10px] font-black text-emerald-600 truncate max-w-[150px] italic">{file.name}</p>
                            <p className="text-[8px] text-emerald-400 font-bold">À TÉLÉVERSER</p>
                         </div>
                      </div>
                      <button type="button" onClick={() => removeFile(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><X size={18}/></button>
                   </div>
                 ))}

                 {selectedFiles.length === 0 && (!newAnn.attachments || newAnn.attachments.length === 0) && (
                   <div className="py-12 text-center border-4 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl group">
                      <Paperclip size={32} className="mx-auto text-gray-200 mb-3 group-hover:text-emerald-400 transition-colors" />
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Aucun fichier à importer</p>
                   </div>
                 )}
               </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full py-5 rounded-[2.5rem] bg-primary-500 text-white font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
               {submitting ? <Loader2 className="animate-spin" /> : editingId ? <Save size={20}/> : <Megaphone size={20} />}
               {submitting ? "Téléchargement & Publication..." : editingId ? "Enregistrer les modifications" : "Lancer la diffusion officielle"}
            </button>
         </form>
      </Modal>

      {/* Reading Detail Modal */}
      <Modal isOpen={!!viewingAnn} onClose={() => setViewingAnn(null)} title="Détail de l'information">
         {viewingAnn && (
           <div className="space-y-8 animate-fade-in pr-2 custom-scrollbar max-h-[80vh] overflow-y-auto">
              <div className="space-y-4">
                 <div className="flex flex-wrap gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${viewingAnn.priority === 'urgent' ? 'bg-rose-500 text-white' : viewingAnn.priority === 'important' ? 'bg-amber-500 text-white' : 'bg-gray-500 text-white'}`}>
                      {viewingAnn.priority}
                    </span>
                    <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-primary-50 text-primary-600 border border-primary-100">
                      {viewingAnn.className || 'Global'}
                    </span>
                 </div>
                 <h2 className="text-4xl font-black text-gray-900 dark:text-white leading-tight italic tracking-tighter uppercase">{viewingAnn.title}</h2>
                 <div className="grid grid-cols-2 gap-4 border-y border-gray-100 dark:border-gray-700 py-6">
                    <div className="flex items-center gap-3">
                       <UserIcon size={18} className="text-gray-400" />
                       <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase">Émetteur</p>
                          <p className="text-xs font-black italic">{viewingAnn.author}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <Calendar size={18} className="text-gray-400" />
                       <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase">Diffusion</p>
                          <p className="text-xs font-black italic">{new Date(viewingAnn.date).toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'})}</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-gray-50/50 dark:bg-gray-800/30 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-inner">
                 <StructuredContent content={viewingAnn.content} />
              </div>

              {/* Resources Section in Detail */}
              {(viewingAnn.links && viewingAnn.links.length > 0) && (
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2 px-1">
                     <Globe2 size={16} className="text-blue-500" /> Liens d'Action & Drive
                   </h4>
                   <div className="grid sm:grid-cols-2 gap-3">
                      {viewingAnn.links.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noreferrer" className="flex items-center justify-between px-6 py-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all group shadow-sm active:scale-95">
                           <div className="flex items-center gap-3">
                              {l.url.includes('forms') ? <ClipboardList size={18} /> : l.url.includes('sheet') ? <FileSpreadsheet size={18} /> : <Hash size={18} />}
                              <span className="text-[10px] font-black uppercase tracking-widest">{l.label}</span>
                           </div>
                           <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </a>
                      ))}
                   </div>
                </div>
              )}

              {(viewingAnn.attachments && viewingAnn.attachments.length > 0) && (
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2 px-1">
                     <Paperclip size={16} className="text-emerald-500" /> Documents Importés
                   </h4>
                   <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-3">
                      {viewingAnn.attachments.map((a, i) => (
                        <div key={i} className="flex items-center justify-between p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-[2rem] border border-emerald-100 shadow-sm group">
                           <div className="flex items-center gap-4 min-w-0">
                              <div className="p-3 bg-white dark:bg-emerald-800 rounded-xl text-emerald-500 shadow-sm shrink-0">
                                {a.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <ImageIcon size={20} /> : <FileText size={20} />}
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 truncate">{a.split('/').pop()?.split('-').pop() || "Document"}</span>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => handleExportResource(a, "Document")} className="p-3 bg-white dark:bg-emerald-800 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all active:scale-90 shadow-sm" title="Copier le lien permanent">
                                <ExternalLink size={16} />
                              </button>
                              <a href={a} target="_blank" rel="noreferrer" className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all active:scale-90 shadow-lg" title="Ouvrir">
                                <Download size={16} />
                              </a>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              <div className="pt-6 flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800 pb-2">
                 <button onClick={() => handleShare(viewingAnn)} className="flex-1 flex items-center justify-center gap-3 py-5 bg-gray-900 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all">
                    <Share2 size={18} /> Diffuser Officiellement
                 </button>
                 <button onClick={() => { handleToggleFavorite(viewingAnn.id); setViewingAnn(null); }} className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all border-2 ${favoriteIds.has(viewingAnn.id) ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-gray-50 text-gray-400 hover:text-amber-500'}`}>
                    <Bookmark size={18} className={favoriteIds.has(viewingAnn.id) ? 'fill-current' : ''} /> {favoriteIds.has(viewingAnn.id) ? "Archivé" : "Sauvegarder"}
                 </button>
              </div>
           </div>
         )}
      </Modal>
    </div>
  );
}
