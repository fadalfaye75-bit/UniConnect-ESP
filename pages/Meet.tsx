
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
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  
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
      addNotification({ title: 'Erreur', message: 'Impossible de charger.', type: 'alert' });
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
      addNotification({ title: 'Copié', message: 'Lien prêt.', type: 'success' });
    });
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ 
      title: '', 
      platform: 'Google Meet', 
      url: '', 
      day: '', 
      time: '',
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
      addNotification({ title: 'Succès', message: 'Salle configurée.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Échec de l'action.", type: 'alert' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette session ?')) return;
    try {
      await API.meet.delete(id);
      fetchMeetings();
      addNotification({ title: 'Supprimé', message: 'Lien retiré.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Action impossible.", type: 'alert' });
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary-500" size={40} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-8">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl"><Radio size={24} className="animate-pulse" /></div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic">Directs</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase mt-1">{user?.className || 'ESP'}</p>
           </div>
        </div>
        <div className="flex items-center gap-3 flex-1 max-w-xl">
           <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-5 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 rounded-2xl text-sm outline-none" />
           <select value={dayFilter} onChange={e => setDayFilter(e.target.value)} className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 rounded-2xl text-xs font-black uppercase">
              <option value="all">Tous les jours</option>
              {['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map(d => <option key={d} value={d}>{d}</option>)}
           </select>
        </div>
        {canManage && (
          <button onClick={openNewModal} className="bg-primary-500 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-xl uppercase">
            <Plus size={18} className="inline mr-2" /> Nouveau
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedLinks.map(link => {
          const canModify = isAdmin || link.user_id === user?.id;
          return (
            <div key={link.id} className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-soft border border-gray-100 group transition-all flex flex-col">
               <div className="flex justify-between items-start mb-6">
                  <span className="text-[8px] font-black text-emerald-500 uppercase px-3 py-1.5 bg-emerald-50 rounded-xl">{link.platform}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleCopy(link)} className="p-2 text-gray-400 hover:text-emerald-500"><Copy size={14}/></button>
                      {canModify && (
                          <>
                              <button onClick={() => handleEdit(link)} className="p-2 text-gray-400 hover:text-blue-500"><Pencil size={14}/></button>
                              <button onClick={() => handleDelete(link.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                          </>
                      )}
                  </div>
               </div>
               <h3 className="text-xl font-black italic mb-4 leading-tight">{link.title}</h3>
               <div className="flex items-center gap-3 text-xs font-bold text-gray-500 mb-8"><Clock size={16} /> <span>{link.time}</span></div>
               <div className="mt-auto flex gap-3">
                  <a href={link.url} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white py-3.5 rounded-2xl font-black shadow-lg uppercase text-[10px]">Rejoindre <ExternalLink size={14} /></a>
                  <button onClick={() => { if(navigator.share) navigator.share({title: link.title, url: link.url}); }} className="p-3.5 bg-gray-50 text-gray-400 rounded-2xl"><Share2 size={18} /></button>
               </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier" : "Programmer"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-5 py-3 rounded-2xl border bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Titre" />
          <select required value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} className="w-full px-5 py-3 rounded-2xl border bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none">
             <option value="Google Meet">Google Meet</option>
             <option value="Zoom">Zoom</option>
             <option value="Teams">Teams</option>
          </select>
          <input required type="url" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} className="w-full px-5 py-3 rounded-2xl border bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Lien URL" />
          <div className="grid grid-cols-2 gap-4">
            <select required value={formData.day} onChange={e => setFormData({...formData, day: e.target.value})} className="w-full px-5 py-3 rounded-2xl border bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none">
               <option value="">Jour</option>
               {['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-5 py-3 rounded-2xl border bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Audience</label>
            <select disabled={!isAdmin} value={formData.className} onChange={e => setFormData({...formData, className: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 font-black text-[10px] uppercase outline-none">
               <option value="Général">Public</option>
               {isAdmin ? classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option value={user?.className}>{user?.className}</option>}
            </select>
          </div>
          <button type="submit" className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl uppercase">Confirmer</button>
        </form>
      </Modal>
    </div>
  );
}
