
import React, { useState, useEffect, useMemo } from 'react';
import { Video, ExternalLink, Plus, Trash2, Calendar, Copy, Loader2, Link as LinkIcon, Share2, Pencil, Search, Filter, Radio, Sparkles, Clock, ArrowRight, VideoOff, CheckCircle2, Save, MessageCircle, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, MeetLink, ClassGroup } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';

const PLATFORM_ICONS = {
  'Google Meet': { color: '#0ea5e9', bg: 'bg-blue-50' },
  'Zoom': { color: '#2563eb', bg: 'bg-blue-100' },
  'Teams': { color: '#4f46e5', bg: 'bg-indigo-100' },
  'Other': { color: '#10b981', bg: 'bg-emerald-100' }
};

export default function Meet() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const themeColor = user?.themeColor || '#0ea5e9';
  
  const [meetings, setMeetings] = useState<MeetLink[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setSetDayFilter] = useState('all');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', platform: 'Google Meet', url: '', day: '', time: '', className: '' });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;
  const isAdmin = user?.role === UserRole.ADMIN;

  useEffect(() => {
    fetchMeetings();
    API.classes.list().then(setClasses);
  }, [user, adminViewClass]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const data = await API.meet.list();
      setMeetings(data);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Chargement échoué.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const displayedLinks = useMemo(() => {
    return meetings.filter(link => {
      const target = link.className || 'Général';
      if (!isAdmin && target !== 'Général' && target !== user?.className) return false;
      
      const matchesSearch = link.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          link.platform.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDay = dayFilter === 'all' || link.time.includes(dayFilter);
      return matchesSearch && matchesDay;
    });
  }, [user, isAdmin, meetings, searchTerm, dayFilter]);

  const handleCopy = (link: MeetLink) => {
    navigator.clipboard.writeText(link.url).then(() => {
      addNotification({ title: 'Lien copié', message: 'Vous pouvez maintenant le partager.', type: 'success' });
    });
  };

  const handleShareWhatsApp = (link: MeetLink) => {
    try {
      const className = link.className || 'Filière';
      
      const text = `🔵 *JangHup – ${className}*\n\n*📽️ SESSION EN DIRECT : ${link.title.toUpperCase()}*\n\n📅 *Horaire :* ${link.time}\n🧩 *Plateforme :* ${link.platform}\n\n🔗 *Lien de connexion :*\n${link.url}\n\n—\nPlateforme JangHup\nCommunication académique officielle`;
      
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      API.interactions.incrementShare('meet_links', link.id).catch(() => {});
    } catch (e) {
      console.error("WhatsApp share failed", e);
    }
  };

  const handleShareEmail = (link: MeetLink) => {
    try {
      const targetClass = classes.find(c => c.name === link.className);
      const recipient = targetClass?.email || '';
      const className = link.className || 'Filière';

      const subject = `[JangHup – ${className}] Session Direct : ${link.title}`;
      const body = `🔵 JangHup – ${className}\n\n📽️ SESSION EN DIRECT : ${link.title.toUpperCase()}\n\n📅 Horaire : ${link.time}\n🧩 Plateforme : ${link.platform}\n\n🔗 Lien de connexion : ${link.url}\n\n—\nPlateforme JangHup\nCommunication académique officielle`;
      
      window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      API.interactions.incrementShare('meet_links', link.id).catch(() => {});
    } catch (e) {
      console.error("Email share failed", e);
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ 
      title: '', platform: 'Google Meet', url: '', day: '', time: '',
      className: isAdmin ? '' : (user?.className || '')
    });
    setIsModalOpen(true);
  };

  const handleEdit = (link: MeetLink) => {
    setEditingId(link.id);
    const parts = link.time.split(' ');
    setFormData({ 
      title: link.title, platform: link.platform, url: link.url, 
      day: parts[0] || '', time: parts[1] || '',
      className: link.className
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const targetClass = isAdmin ? formData.className : (user?.className || 'Général');
      const payload = { 
        title: formData.title, platform: formData.platform as any, url: formData.url, 
        time: `${formData.day} ${formData.time}`, className: targetClass 
      };

      if (editingId) await API.meet.update(editingId, payload);
      else await API.meet.create(payload);
      
      fetchMeetings();
      setIsModalOpen(false);
      addNotification({ title: 'Succès', message: 'Salon mis à jour.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Action impossible.", type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Fermer définitivement ce salon ?')) return;
    try {
      await API.meet.delete(id);
      fetchMeetings();
      addNotification({ title: 'Supprimé', message: 'Lien retiré.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Échec suppression.", type: 'alert' });
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-6">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Ouverture des salons...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 text-white rounded-[1.8rem] flex items-center justify-center shadow-xl rotate-3" style={{ backgroundColor: '#10b981' }}>
              <Radio size={32} className="animate-pulse" />
           </div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Salons Virtuels</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3">Directs & Visioconférences • JangHup</p>
           </div>
        </div>
        
        {canManage && (
          <button onClick={openNewModal} className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gray-900 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all italic hover:bg-black">
            <Plus size={20} /> Nouvelle session live
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-gray-900 p-4 rounded-[2.5rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Rechercher un module ou une plateforme..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-transparent border-none rounded-2xl text-sm font-bold outline-none italic"
          />
        </div>
        <div className="flex gap-2">
          <select value={dayFilter} onChange={e => setSetDayFilter(e.target.value)} className="px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase outline-none border-none cursor-pointer">
             <option value="all">Tous les jours</option>
             {['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Grid of Meetings */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {displayedLinks.map(link => {
          const canModify = isAdmin || link.user_id === user?.id;
          const platStyle = PLATFORM_ICONS[link.platform as keyof typeof PLATFORM_ICONS] || PLATFORM_ICONS['Other'];
          
          return (
            <div key={link.id} className="group relative bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border-2 border-transparent hover:border-emerald-100 transition-all flex flex-col overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full rounded-l-[3.5rem]" style={{ backgroundColor: platStyle.color }} />
               <div className="absolute top-0 right-0 w-48 h-48 bg-gray-50 dark:bg-gray-800 -mr-24 -mt-24 rounded-full group-hover:scale-125 transition-transform duration-1000 opacity-20" />
               
               <div className="flex justify-between items-start mb-8 relative z-10">
                  <span className={`text-[8px] font-black uppercase px-4 py-1.5 ${platStyle.bg} rounded-full tracking-widest shadow-sm`} style={{ color: platStyle.color }}>
                    {link.platform}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                      <button onClick={() => handleShareWhatsApp(link)} className="p-3 text-gray-400 hover:text-emerald-500 bg-gray-50 dark:bg-gray-800 rounded-xl" title="WhatsApp"><MessageCircle size={16}/></button>
                      <button onClick={() => handleShareEmail(link)} className="p-3 text-gray-400 hover:text-gray-900 bg-gray-50 dark:bg-gray-800 rounded-xl" title="Email"><Mail size={16}/></button>
                      <button onClick={() => handleCopy(link)} className="p-3 text-gray-400 hover:text-emerald-500 bg-gray-50 dark:bg-gray-800 rounded-xl" title="Copier le lien"><Copy size={16}/></button>
                      {canModify && (
                          <>
                              <button onClick={() => handleEdit(link)} className="p-3 text-gray-400 hover:text-blue-500 bg-gray-50 dark:bg-gray-800 rounded-xl" title="Modifier"><Pencil size={16}/></button>
                              <button onClick={() => handleDelete(link.id)} className="p-3 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-800 rounded-xl" title="Supprimer"><Trash2 size={16}/></button>
                          </>
                      )}
                  </div>
               </div>

               <div className="flex-1 relative z-10">
                  <h3 className="text-2xl font-black italic tracking-tighter leading-tight mb-4 group-hover:text-emerald-600 transition-colors">{link.title}</h3>
                  <div className="flex flex-col gap-2 mb-10">
                     <div className="flex items-center gap-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <Clock size={16} /> <span>{link.time}</span>
                     </div>
                     <div className="flex items-center gap-3 text-[10px] font-black text-primary-500 uppercase tracking-widest">
                        <CheckCircle2 size={16} /> <span>{link.className || 'Public'}</span>
                     </div>
                  </div>
               </div>

               <div className="mt-auto flex gap-3 relative z-10">
                  <a href={link.url} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-3 bg-emerald-500 text-white py-5 rounded-[2rem] font-black shadow-xl uppercase italic text-[10px] tracking-widest hover:bg-emerald-600 transition-all active:scale-95">
                    Accéder au direct <ExternalLink size={18} />
                  </a>
               </div>
            </div>
          );
        })}

        {displayedLinks.length === 0 && (
           <div className="sm:col-span-2 lg:col-span-3 py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <VideoOff size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucun direct programmé pour le moment</p>
           </div>
        )}
      </div>

      {/* Creation Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier la session" : "Nouveau direct"}>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Intitulé du cours / Événement</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-6 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold italic text-sm outline-none focus:ring-4 focus:ring-emerald-50" placeholder="ex: Séminaire Cybersécurité" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Plateforme</label>
              <select required value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-black text-[10px] uppercase outline-none border-none cursor-pointer">
                 <option value="Google Meet">Google Meet</option>
                 <option value="Zoom">Zoom</option>
                 <option value="Teams">Teams</option>
                 <option value="Other">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Lien de la réunion</label>
              <input required type="url" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} className="w-full px-6 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="https://meet.google.com/..." />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Jour</label>
              <select required value={formData.day} onChange={e => setFormData({...formData, day: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-black text-[10px] uppercase outline-none border-none cursor-pointer">
                 <option value="">Sélectionner...</option>
                 {['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Heure de début</label>
              <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-6 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Audience</label>
            <select disabled={!isAdmin} value={formData.className} onChange={e => setFormData({...formData, className: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-black text-[10px] uppercase outline-none border-none cursor-pointer">
               <option value="Général">Public (Global)</option>
               {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-emerald-500 text-white font-black py-5 rounded-[2.5rem] shadow-xl uppercase tracking-[0.2em] italic text-xs hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-3">
             {submitting ? <Loader2 className="animate-spin" /> : <Save size={20}/>}
             {editingId ? "Sauvegarder les modifications" : "Publier le salon"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
