
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Clock, MapPin, AlertTriangle, Plus, Trash2, Loader2, Copy, Share2, Pencil, Search, Filter, Sparkles, Calendar as CalendarIcon, ArrowRight, ChevronDown
} from 'lucide-react';
import { UserRole, Exam } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

export default function Exams() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const themeColor = user?.themeColor || '#0ea5e9';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'upcoming' | 'passed' | 'all'>('upcoming');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    subject: '', 
    date: '', 
    time: '', 
    duration: '', 
    room: '', 
    notes: '', 
    className: ''
  });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;
  const isAdmin = user?.role === UserRole.ADMIN;

  useEffect(() => {
    fetchExams();
    API.classes.list().then(setClasses);
  }, [user, adminViewClass]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const data = await API.exams.list();
      setExams(data);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger les examens.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const displayedExams = useMemo(() => {
    const now = new Date();
    return exams.filter(exam => {
      const examDate = new Date(exam.date);
      const target = exam.className || 'Général';
      
      const matchesClass = isAdmin 
        ? (adminViewClass ? (target === adminViewClass || target === 'Général') : true)
        : (target === user?.className || target === 'Général');
      
      const matchesSearch = exam.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          exam.room.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'upcoming' && examDate >= now) ||
                           (statusFilter === 'passed' && examDate < now);

      return matchesClass && matchesSearch && matchesStatus;
    }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [user, adminViewClass, exams, searchTerm, statusFilter, isAdmin]);

  const handleCopy = (exam: Exam) => {
    const d = new Date(exam.date);
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const text = `📝 *UniConnect - Rappel Examen*\n🎓 Matière: ${exam.subject}\n📅 Date: ${dateStr}\n⏰ Heure: ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}\n📍 Salle: ${exam.room}\n⏱️ Durée: ${exam.duration}`;
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Copié', message: 'Détails de l\'épreuve copiés.', type: 'success' });
    });
  };

  const handleRelay = async (exam: Exam) => {
    const structuredContent = `📝 *PROGRAMME EXAMEN UniConnect*\n\n🎓 Matière: ${exam.subject}\n📅 Date: ${new Date(exam.date).toLocaleDateString()}\n📍 Salle: ${exam.room}\n⏱️ Durée: ${exam.duration}`;
    if (navigator.share) await navigator.share({ title: exam.subject, text: structuredContent });
    else {
      await navigator.clipboard.writeText(structuredContent);
      addNotification({ title: 'Copié', message: 'Prêt pour partage.', type: 'success' });
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ 
      subject: '', 
      date: '', 
      time: '', 
      duration: '', 
      room: '', 
      notes: '', 
      className: isAdmin ? '' : (user?.className || '') 
    });
    setIsModalOpen(true);
  };

  const handleEdit = (exam: Exam) => {
    const d = new Date(exam.date);
    setEditingId(exam.id);
    setFormData({ 
      subject: exam.subject, 
      date: d.toISOString().split('T')[0], 
      time: d.toTimeString().slice(0, 5), 
      duration: exam.duration, 
      room: exam.room, 
      notes: exam.notes || '',
      className: exam.className
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const targetClass = isAdmin ? formData.className : (user?.className || 'Général');
      const isoDate = new Date(`${formData.date}T${formData.time}`).toISOString();
      const payload = { 
        subject: formData.subject, 
        date: isoDate, 
        duration: formData.duration, 
        room: formData.room, 
        notes: formData.notes,
        className: targetClass 
      };

      if (editingId) await API.exams.update(editingId, payload);
      else await API.exams.create(payload);
      
      fetchExams();
      setIsModalOpen(false);
      addNotification({ title: 'Succès', message: 'Épreuve enregistrée.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Échec de l'opération.", type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cet examen ?')) return;
    try {
      await API.exams.delete(id);
      fetchExams();
      addNotification({ title: 'Supprimé', message: 'L\'examen a été retiré.', type: 'info' });
    } catch (error) {
        addNotification({ title: 'Erreur', message: "Action impossible.", type: 'alert' });
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)] gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Calcul du calendrier...</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 py-6 z-20 backdrop-blur-md gap-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-2xl shadow-sm">
              <CalendarIcon size={24} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic">Épreuves & DS</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                {user?.className || 'Portail Académique'}
              </p>
           </div>
        </div>

        <div className="flex flex-1 items-center gap-3 max-w-xl">
           <div className="relative flex-1 group">
             <Search className="absolute left-4 top-3 text-gray-400" size={18} />
             <input type="text" placeholder="Matière, salle..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none transition-all" />
           </div>
           <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-xs font-black uppercase tracking-widest outline-none">
              <option value="upcoming">À venir</option>
              <option value="passed">Archives</option>
              <option value="all">Tout</option>
           </select>
        </div>

        {canManage && (
          <button onClick={openNewModal} className="bg-primary-500 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-xl uppercase tracking-widest">
            <Plus size={18} className="inline mr-2" /> Nouveau
          </button>
        )}
      </div>

      <div className="grid gap-6">
        {displayedExams.map((exam) => {
          const examDate = new Date(exam.date);
          const isPassed = examDate < new Date();
          const canModify = isAdmin || exam.user_id === user?.id;
          
          return (
            <div key={exam.id} className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-soft border border-gray-100 dark:border-gray-800 transition-all hover:shadow-xl group flex flex-col md:flex-row gap-8">
              <div className="flex flex-col items-center justify-center w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shrink-0">
                <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest mb-1">{examDate.toLocaleDateString('fr-FR', {weekday: 'short'})}</span>
                <span className="text-3xl font-black text-gray-900 dark:text-white leading-none">{examDate.getDate()}</span>
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">{examDate.toLocaleDateString('fr-FR', {month: 'short'})}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border tracking-widest ${isPassed ? 'bg-gray-100 text-gray-400' : 'bg-primary-50 text-primary-600'}`}>{isPassed ? 'Archive' : 'À venir'}</span>
                  <span className="text-[8px] font-black uppercase px-2 py-1 rounded-lg border border-gray-100 dark:border-gray-800 text-gray-500">{exam.className || 'Général'}</span>
                </div>
                <h3 className={`text-2xl font-black italic mb-4 ${isPassed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{exam.subject}</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-600 dark:text-gray-400"><Clock size={16} /> <span>{examDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {exam.duration}</span></div>
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-600 dark:text-gray-400"><MapPin size={16} /> <span>Salle {exam.room}</span></div>
                </div>
              </div>

              <div className="flex md:flex-col items-center justify-center gap-2 pt-6 md:pt-0 md:pl-8 border-t md:border-t-0 md:border-l border-gray-50 dark:border-gray-800">
                <button onClick={() => handleRelay(exam)} className="p-3 text-white bg-gray-900 rounded-2xl hover:scale-110 transition-all shadow-lg"><Share2 size={20} /></button>
                <button onClick={() => handleCopy(exam)} className="p-3 text-gray-400 hover:text-primary-500 rounded-2xl transition-all"><Copy size={20} /></button>
                {canModify && (
                  <>
                    <button onClick={() => handleEdit(exam)} className="p-3 text-gray-400 hover:text-blue-500 rounded-2xl transition-all"><Pencil size={20} /></button>
                    <button onClick={() => handleDelete(exam.id)} className="p-3 text-gray-400 hover:text-red-500 rounded-2xl transition-all"><Trash2 size={20} /></button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editer" : "Programmer"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input required type="text" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Matière" />
          <div className="grid grid-cols-2 gap-4">
            <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" />
            <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input required type="text" value={formData.room} onChange={e => setFormData({...formData, room: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Salle" />
            <input required type="text" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl border bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Durée" />
          </div>
          <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Audience</label>
              <select disabled={!isAdmin} value={formData.className} onChange={e => setFormData({...formData, className: e.target.value})} className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 font-black text-[10px] uppercase outline-none">
                 <option value="Général">Public</option>
                 {isAdmin ? classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option value={user?.className}>{user?.className}</option>}
              </select>
            </div>
          <button type="submit" disabled={submitting} className="w-full bg-primary-500 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest">
            {editingId ? "Sauvegarder" : "Publier l'épreuve"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
