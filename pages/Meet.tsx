
import React, { useState, useEffect, useMemo } from 'react';
import { Video, ExternalLink, Plus, Trash2, Calendar, Copy, Loader2, Link as LinkIcon, Share2, Pencil, Search, Filter, Radio, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, MeetLink } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';

export default function Meet() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [meetings, setMeetings] = useState<MeetLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', platform: 'Google Meet', url: '', day: '', time: '' });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  useEffect(() => {
    fetchMeetings();
  }, [user, adminViewClass]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const data = await API.meet.list();
      setMeetings(data);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const displayedLinks = useMemo(() => {
    return meetings.filter(link => {
      const target = link.className || 'Général';
      const matchesClass = user?.role === UserRole.ADMIN 
        ? (adminViewClass ? (target === adminViewClass || target === 'Général') : true)
        : (target === user?.className || target === 'Général');
      
      const matchesSearch = link.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          link.platform.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDay = dayFilter === 'all' || link.time.includes(dayFilter);

      return matchesClass && matchesSearch && matchesDay;
    });
  }, [user, adminViewClass, meetings, searchTerm, dayFilter]);

  const handleCopy = (link: MeetLink) => {
    navigator.clipboard.writeText(`${link.title} - ${link.url}`).then(() => {
      addNotification({ title: 'Lien copié', message: 'URL prête à être partagée.', type: 'success' });
    });
  };

  const handleShare = (link: MeetLink) => {
    const text = `Rejoignez le cours : ${link.title}\nLien : ${link.url}\nHeure : ${link.time}`;
    if (navigator.share) {
        navigator.share({ title: link.title, text, url: link.url });
    } else {
        window.location.href = `mailto:?subject=${encodeURIComponent(link.title)}&body=${encodeURIComponent(text)}`;
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ title: '', platform: 'Google Meet', url: '', day: '', time: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (link: MeetLink) => {
    setEditingId(link.id);
    const parts = link.time.split(' ');
    setFormData({ title: link.title, platform: link.platform as string, url: link.url, day: parts[0] || '', time: parts[1] || '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const timeString = `${formData.day} ${formData.time}`;
      if (editingId) {
        await API.meet.update(editingId, { title: formData.title, platform: formData.platform as any, url: formData.url, time: timeString });
        addNotification({ title: 'Succès', message: 'Réunion mise à jour.', type: 'success' });
      } else {
        await API.meet.create({ title: formData.title, platform: formData.platform as any, url: formData.url, time: timeString, className: targetClass });
        addNotification({ title: 'Succès', message: 'Réunion ajoutée.', type: 'success' });
      }
      fetchMeetings();
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Echec.", type: 'alert' });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cette session ?')) return;
    try {
      await API.meet.delete(id);
      fetchMeetings();
      addNotification({ title: 'Supprimé', message: 'Lien retiré.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Impossible de supprimer.", type: 'alert' });
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)] gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Recherche des salles...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 py-6 z-20 backdrop-blur-md gap-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-800">
              <Radio size={24} className="animate-pulse" />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic">Directs & Visio</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Salles de cours virtuelles</p>
           </div>
        </div>

        <div className="flex flex-1 items-center gap-3 max-w-xl">
           <div className="relative flex-1 group">
             <Search className="absolute left-4 top-3 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
             <input 
                type="text" 
                placeholder="Chercher une session..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 focus:border-primary-300 transition-all"
             />
           </div>
           <select 
             value={dayFilter}
             onChange={e => setDayFilter(e.target.value)}
             className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-xs font-black text-gray-600 dark:text-gray-300 outline-none cursor-pointer uppercase tracking-widest focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10"
           >
              <option value="all">Jour (Tous)</option>
              <option value="Lundi">Lundi</option>
              <option value="Mardi">Mardi</option>
              <option value="Mercredi">Mercredi</option>
              <option value="Jeudi">Jeudi</option>
              <option value="Vendredi">Vendredi</option>
              <option value="Samedi">Samedi</option>
           </select>
        </div>

        {canManage && (
          <button onClick={openNewModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-xl shadow-primary-500/20 transition-all hover:-translate-y-0.5 active:scale-95 whitespace-nowrap uppercase tracking-widest">
            <Plus size={18} /> <span className="hidden sm:inline">Créer une salle</span>
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedLinks.map(link => (
          <div key={link.id} className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-soft border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:border-emerald-400 transition-all group flex flex-col relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 -mr-16 -mt-16 rounded-full group-hover:scale-110 transition-transform"></div>
             
             <div className="flex justify-between items-start mb-6 relative z-10">
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em] px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                    {link.platform}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleCopy(link)} className="p-2 text-gray-400 hover:text-emerald-500 transition-colors"><Copy size={14}/></button>
                    {canManage && (
                        <>
                            <button onClick={() => handleEdit(link)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors"><Pencil size={14}/></button>
                            <button onClick={(e) => handleDelete(e, link.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                        </>
                    )}
                </div>
             </div>

             <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4 line-clamp-2 leading-tight tracking-tight italic group-hover:text-emerald-600 transition-colors">{link.title}</h3>
             
             <div className="flex items-center gap-3 text-xs font-bold text-gray-500 mb-8">
                <Clock size={16} className="text-emerald-500" />
                <span>{link.time}</span>
                <span className="text-[10px] opacity-40 uppercase tracking-widest font-black ml-auto">{link.className || 'Général'}</span>
             </div>

             <div className="mt-auto flex gap-3 relative z-10">
                <a 
                    href={link.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-2xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 uppercase text-[10px] tracking-widest"
                >
                    Rejoindre <ExternalLink size={14} />
                </a>
                <button onClick={() => handleShare(link)} className="p-3.5 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-emerald-500 rounded-2xl transition-all">
                    <Share2 size={18} />
                </button>
             </div>
          </div>
        ))}

        {displayedLinks.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
             <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Video size={32} className="text-gray-200" />
             </div>
             <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucun cours en direct trouvé</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier la réunion" : "Programmer une Visio"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800 mb-4 flex gap-3">
             <Sparkles className="text-emerald-500 shrink-0" size={20} />
             <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase leading-relaxed">Les étudiants recevront une notification dès la publication.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Titre de la session</label>
              <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-900/10 outline-none transition-all font-bold" placeholder="ex: Travaux Pratiques de Physique" />
            </div>
            
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Plateforme</label>
              <select required value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} className="w-full px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-900/10 outline-none transition-all font-bold">
                 <option value="Google Meet">Google Meet</option>
                 <option value="Zoom">Zoom</option>
                 <option value="Teams">Teams</option>
                 <option value="Other">Autre / Jitsi</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Lien URL</label>
              <div className="relative group">
                <LinkIcon className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
                <input required type="url" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} className="w-full pl-12 pr-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-900/10 outline-none transition-all font-bold" placeholder="https://meet.google.com/..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Jour</label>
                  <select required value={formData.day} onChange={e => setFormData({...formData, day: e.target.value})} className="w-full px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-900/10 outline-none transition-all font-bold">
                      <option value="">Choisir...</option>
                      <option value="Lundi">Lundi</option>
                      <option value="Mardi">Mardi</option>
                      <option value="Mercredi">Mercredi</option>
                      <option value="Jeudi">Jeudi</option>
                      <option value="Vendredi">Vendredi</option>
                      <option value="Samedi">Samedi</option>
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Heure</label>
                  <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-900/10 outline-none transition-all font-bold" />
               </div>
            </div>
          </div>

          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex justify-center items-center gap-2 active:scale-95 uppercase tracking-widest">
            {editingId ? 'Mettre à jour la salle' : 'Programmer la session Direct'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
