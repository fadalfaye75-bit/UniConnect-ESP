
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Clock, MapPin, AlertTriangle, Plus, Trash2, Loader2, Copy, Share2, Pencil, Search, Filter, Sparkles, Calendar as CalendarIcon, ArrowRight
} from 'lucide-react';
import { UserRole, Exam } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

export default function Exams() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'upcoming' | 'passed' | 'all'>('upcoming');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    subject: '', 
    date: '', 
    time: '', 
    duration: '', 
    room: '', 
    notes: '' 
  });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  useEffect(() => {
    fetchExams();
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
      
      // Logique de visibilité : Ma classe OU Général
      const matchesClass = user?.role === UserRole.ADMIN 
        ? (adminViewClass ? (target === adminViewClass || target === 'Général') : true)
        : (target === user?.className || target === 'Général');
      
      const matchesSearch = exam.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          exam.room.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'upcoming' && examDate >= now) ||
                           (statusFilter === 'passed' && examDate < now);

      return matchesClass && matchesSearch && matchesStatus;
    }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [user, adminViewClass, exams, searchTerm, statusFilter]);

  const handleCopy = (exam: Exam) => {
    const d = new Date(exam.date);
    const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const text = `Examen: ${exam.subject}\nDate: ${dateStr} à ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}\nSalle: ${exam.room}\nDurée: ${exam.duration}`;
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Copié', message: 'Détails copiés.', type: 'success' });
    });
  };

  const handleShare = (exam: Exam) => {
    const subject = encodeURIComponent(`Examen UniConnect: ${exam.subject}`);
    const body = encodeURIComponent(`Rappel Examen\n\nMatière: ${exam.subject}\nDate: ${new Date(exam.date).toLocaleString()}\nSalle: ${exam.room}\nNotes: ${exam.notes || 'Aucune'}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ subject: '', date: '', time: '', duration: '', room: '', notes: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (exam: Exam) => {
    const d = new Date(exam.date);
    setEditingId(exam.id);
    setFormData({ subject: exam.subject, date: d.toISOString().split('T')[0], time: d.toTimeString().slice(0, 5), duration: exam.duration, room: exam.room, notes: exam.notes || '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const isoDate = new Date(`${formData.date}T${formData.time}`).toISOString();
      const payload = { subject: formData.subject, date: isoDate, duration: formData.duration, room: formData.room, notes: formData.notes };
      if (editingId) {
         await API.exams.update(editingId, payload);
         fetchExams();
         addNotification({ title: 'Succès', message: 'Examen mis à jour.', type: 'success' });
      } else {
         await API.exams.create({ ...payload, className: targetClass });
         fetchExams();
         addNotification({ title: 'Succès', message: 'Examen ajouté.', type: 'success' });
      }
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: "Opération échouée.", type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cet examen ?')) return;
    try {
      await API.exams.delete(id);
      fetchExams();
      addNotification({ title: 'Supprimé', message: 'L\'examen a été retiré.', type: 'info' });
    } catch (error) {
        addNotification({ title: 'Erreur', message: "Impossible de supprimer.", type: 'alert' });
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)] gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Synchronisation Calendrier...</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 py-6 z-20 backdrop-blur-md gap-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-2xl shadow-sm border border-orange-100 dark:border-orange-800">
              <CalendarIcon size={24} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic">Épreuves & DS</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                {user?.role === UserRole.ADMIN && adminViewClass ? adminViewClass : (user?.className || 'Vue Globale')}
              </p>
           </div>
        </div>

        <div className="flex flex-1 items-center gap-3 max-w-xl">
           <div className="relative flex-1 group">
             <Search className="absolute left-4 top-3 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
             <input 
                type="text" 
                placeholder="Matière, salle..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 focus:border-primary-300 transition-all"
             />
           </div>
           <select 
             value={statusFilter}
             onChange={e => setStatusFilter(e.target.value as any)}
             className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-xs font-black text-gray-600 dark:text-gray-300 outline-none cursor-pointer uppercase tracking-widest focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10"
           >
              <option value="upcoming">À venir</option>
              <option value="passed">Archives</option>
              <option value="all">Tout</option>
           </select>
        </div>

        {canManage && (
          <button onClick={openNewModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-xl shadow-primary-500/20 transition-all hover:-translate-y-0.5 active:scale-95 whitespace-nowrap uppercase tracking-widest">
            <Plus size={18} /> <span className="hidden sm:inline">Nouvelle Épreuve</span>
          </button>
        )}
      </div>

      <div className="grid gap-6">
        {displayedExams.map((exam) => {
          const examDate = new Date(exam.date);
          const now = new Date();
          const timeDiff = examDate.getTime() - now.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          const isUrgent = daysDiff >= 0 && daysDiff <= 3;
          const isPassed = timeDiff < 0;
          const dayString = examDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
          const capitalizedDate = dayString.charAt(0).toUpperCase() + dayString.slice(1);
          
          return (
            <div 
              key={exam.id} 
              className={`relative bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-soft border transition-all hover:shadow-xl hover:-translate-y-1 group flex flex-col md:flex-row gap-8 ${
                isUrgent ? 'border-orange-200 dark:border-orange-800/50 bg-gradient-to-br from-white to-orange-50/30' : 'border-gray-100 dark:border-gray-800'
              }`}
            >
              <div className="flex flex-col items-center justify-center w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 flex-shrink-0 group-hover:scale-110 transition-transform">
                <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">{examDate.toLocaleDateString('fr-FR', {month: 'short'})}</span>
                <span className="text-3xl font-black text-gray-900 dark:text-white leading-none">{examDate.getDate()}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border tracking-widest ${
                    isPassed ? 'bg-gray-100 text-gray-400' : 
                    isUrgent ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-primary-50 text-primary-600 border-primary-100'
                  }`}>
                    {isPassed ? 'Archive' : (isUrgent ? 'Imminent' : 'Plannifié')}
                  </span>
                  <span className="text-[8px] font-black uppercase px-2 py-1 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 tracking-widest">
                    {exam.className || 'Général'}
                  </span>
                </div>
                
                <h3 className={`text-2xl font-black tracking-tight italic mb-4 ${isPassed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                  {exam.subject}
                </h3>

                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-600 dark:text-gray-400">
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-primary-500"><Clock size={16} /></div>
                    <span>{examDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {exam.duration}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-600 dark:text-gray-400">
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-primary-500"><MapPin size={16} /></div>
                    <span>Salle {exam.room}</span>
                  </div>
                  {isUrgent && !isPassed && (
                    <div className="flex items-center gap-2 text-orange-600 text-[10px] font-black uppercase italic animate-pulse">
                      <AlertTriangle size={14} /> J-{daysDiff} restant
                    </div>
                  )}
                </div>

                {exam.notes && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-l-4 border-primary-500">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium italic">"{exam.notes}"</p>
                  </div>
                )}
              </div>

              <div className="flex md:flex-col items-center justify-end gap-2 pt-6 md:pt-0 md:pl-8 border-t md:border-t-0 md:border-l border-gray-50 dark:border-gray-800">
                <button onClick={() => handleCopy(exam)} className="p-3 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-2xl transition-all" title="Détails"><Copy size={20} /></button>
                <button onClick={() => handleShare(exam)} className="p-3 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-2xl transition-all" title="Email"><Share2 size={20} /></button>
                {canManage && (
                  <>
                    <button onClick={() => handleEdit(exam)} className="p-3 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-all"><Pencil size={20} /></button>
                    <button onClick={(e) => handleDelete(e, exam.id)} className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"><Trash2 size={20} /></button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {displayedExams.length === 0 && (
          <div className="text-center py-24 bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
             <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search size={32} className="text-gray-200" />
             </div>
             <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucun examen trouvé</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editer l'Épreuve" : "Programmer un examen"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-2xl border border-primary-100 dark:border-primary-800 mb-4 flex gap-3">
             <Sparkles className="text-primary-500 shrink-0" size={20} />
             <p className="text-[10px] text-primary-600 dark:text-primary-400 font-bold uppercase leading-relaxed">Cette épreuve sera visible instantanément par les étudiants de : <strong>{user?.role === UserRole.ADMIN && adminViewClass ? adminViewClass : (user?.className || 'Général')}</strong></p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Matière</label>
              <input required type="text" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 outline-none transition-all font-bold" placeholder="ex: Analyse Mathématique" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Date</label>
                <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 outline-none transition-all font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Heure</label>
                <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 outline-none transition-all font-bold" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Salle</label>
                <input required type="text" value={formData.room} onChange={e => setFormData({...formData, room: e.target.value})} className="w-full px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 outline-none transition-all font-bold" placeholder="Amphi B" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Durée</label>
                <input required type="text" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} placeholder="ex: 2h" className="w-full px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 outline-none transition-all font-bold" />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Notes</label>
              <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 outline-none transition-all font-bold" placeholder="Détails supplémentaires..." />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 transition-all flex justify-center items-center gap-2 active:scale-95 uppercase tracking-widest">
            {submitting ? <Loader2 className="animate-spin" /> : (editingId ? "Sauvegarder les modifications" : "Programmer l'épreuve")}
          </button>
        </form>
      </Modal>
    </div>
  );
}
