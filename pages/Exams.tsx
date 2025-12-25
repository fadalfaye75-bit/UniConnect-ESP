
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { 
  Clock, MapPin, AlertTriangle, Plus, Trash2, Loader2, Copy, Share2, Pencil, Search, Filter, Sparkles, Calendar as CalendarIcon, ArrowRight, ChevronDown, CheckCircle2, Bookmark, Save, MessageCircle, Mail
} from 'lucide-react';
import { UserRole, Exam, ClassGroup } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';

export default function Exams() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
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

  const canPost = API.auth.canPost(user);
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
      addNotification({ title: 'Erreur', message: 'Impossible de charger les épreuves.', type: 'alert' });
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
    const className = exam.className || 'Filière';
    
    const text = `🔵 JangHup – ${className}\n\n📌 AVIS D'EXAMEN : ${exam.subject.toUpperCase()}\n\n📅 Date : ${dateStr}\n⏰ Heure : ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}\n📍 Salle : ${exam.room}\n⏱️ Durée : ${exam.duration}\n\n🔗 Consulter sur JangHup : https://janghup.app/#/exams\n\n—\nPlateforme JangHup`;
    
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Copié', message: 'Format institutionnel prêt.', type: 'success' });
    });
  };

  const handleShareWhatsApp = (exam: Exam) => {
    try {
      const d = new Date(exam.date);
      const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const className = exam.className || 'Filière';
      
      const text = `🔵 *JangHup – ${className}*\n\n*📌 AVIS D'EXAMEN : ${exam.subject.toUpperCase()}*\n\n📅 *Date :* ${dateStr}\n⏰ *Heure :* ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}\n📍 *Lieu :* Salle ${exam.room}\n⏱️ *Durée :* ${exam.duration}\n\n🔗 *Consulter sur JangHup*\nhttps://janghup.app/#/exams\n\n—\nPlateforme JangHup\nCommunication académique officielle`;
      
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      API.interactions.incrementShare('exams', exam.id).catch(() => {});
    } catch (e) {
      console.error("WhatsApp share failed", e);
    }
  };

  const handleShareEmail = (exam: Exam) => {
    try {
      const targetClass = classes.find(c => c.name === exam.className);
      const recipient = targetClass?.email || '';
      const className = exam.className || 'Filière';

      const d = new Date(exam.date);
      const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const subject = `[JangHup – ${className}] Avis d'Examen : ${exam.subject}`;
      
      const body = `🔵 JangHup – ${className}\n\n📌 AVIS D'EXAMEN : ${exam.subject.toUpperCase()}\n\n📅 Date : ${dateStr}\n⏰ Heure : ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}\n📍 Lieu : Salle ${exam.room}\n⏱️ Durée : ${exam.duration}\n\n📝 Notes : ${exam.notes || 'N/A'}\n\n🔗 Consulter sur JangHup : https://janghup.app/#/exams\n\n—\nPlateforme JangHup\nCommunication académique officielle`;
      
      window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      API.interactions.incrementShare('exams', exam.id).catch(() => {});
    } catch (e) {
      console.error("Email share failed", e);
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
      addNotification({ title: 'Succès', message: 'L\'épreuve a été planifiée.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: "Action impossible.", type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Retirer cette épreuve du calendrier ?')) return;
    try {
      await API.exams.delete(id);
      fetchExams();
      addNotification({ title: 'Supprimé', message: 'Le calendrier a été mis à jour.', type: 'info' });
    } catch (error) {
        addNotification({ title: 'Erreur', message: "Impossible de supprimer.", type: 'alert' });
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-6">
        <Loader2 className="animate-spin" style={{ color: themeColor }} size={40} />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Récupération du calendrier...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 text-white rounded-[1.8rem] flex items-center justify-center shadow-xl -rotate-3" style={{ backgroundColor: '#f59e0b' }}>
              <CalendarIcon size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Calendrier Examens</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3">Portail Académique • JangHup</p>
           </div>
        </div>
        
        {canPost && (
          <button 
            onClick={openNewModal} 
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gray-900 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all italic hover:bg-black"
          >
            <Plus size={20} /> Programmer une épreuve
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-gray-900 p-4 rounded-[2.5rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Filtrer par matière ou salle..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-transparent border-none rounded-2xl text-sm font-bold outline-none italic"
          />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase outline-none border-none cursor-pointer">
             <option value="upcoming">À venir</option>
             <option value="passed">Archives</option>
             <option value="all">Tout le calendrier</option>
          </select>
        </div>
      </div>

      {/* Grid of Exams */}
      <div className="grid gap-6">
        {displayedExams.map((exam) => {
          const examDate = new Date(exam.date);
          const isPassed = examDate < new Date();
          
          const canEdit = API.auth.canEdit(user, exam);
          const canDelete = API.auth.canDelete(user);
          
          return (
            <div key={exam.id} className={`group relative bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-soft border-2 transition-all duration-500 flex flex-col md:flex-row gap-10 ${
                isPassed ? 'opacity-60 grayscale-[0.5]' : 'border-transparent hover:border-orange-100 dark:hover:border-orange-900/30'
            }`}>
              <div className="absolute top-0 left-0 w-2 h-full rounded-l-[3rem]" style={{ backgroundColor: isPassed ? '#94a3b8' : '#f59e0b' }} />

              <div className="flex flex-col items-center justify-center w-28 h-28 bg-gray-50 dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-lg shrink-0">
                  <span className="text-[9px] font-black uppercase tracking-widest mb-1 text-orange-500">
                    {examDate.toLocaleDateString('fr-FR', {weekday: 'short'})}
                  </span>
                  <span className="text-4xl font-black text-gray-900 dark:text-white italic">{examDate.getDate()}</span>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                    {examDate.toLocaleDateString('fr-FR', {month: 'short'})}
                  </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                   <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-lg tracking-widest ${
                      isPassed ? 'bg-gray-100 text-gray-500' : 'bg-orange-50 text-orange-600'
                   }`}>{isPassed ? 'Passé' : 'À venir'}</span>
                   <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest bg-primary-50 px-2.5 py-1 rounded-lg">{exam.className || 'Public'}</span>
                </div>

                <h3 className={`text-2xl font-black italic tracking-tighter leading-tight mb-6 ${isPassed ? 'text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                  {exam.subject}
                </h3>

                <div className="grid sm:grid-cols-2 gap-6">
                   <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl"><Clock size={18} /></div>
                      <div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Timing</p>
                         <p className="text-sm font-bold italic">{examDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {exam.duration}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl"><MapPin size={18} /></div>
                      <div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Emplacement</p>
                         <p className="text-sm font-bold italic">Salle {exam.room}</p>
                      </div>
                   </div>
                </div>
              </div>

              <div className="flex md:flex-col items-center justify-center gap-2 p-6 md:p-0 md:pl-10 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800">
                 <button onClick={() => handleShareWhatsApp(exam)} className="p-3.5 bg-[#25D366] text-white rounded-2xl hover:scale-110 transition-all shadow-lg active:scale-90" title="WhatsApp"><MessageCircle size={20}/></button>
                 <button onClick={() => handleShareEmail(exam)} className="p-3.5 bg-gray-900 text-white rounded-2xl hover:scale-110 transition-all shadow-lg active:scale-90" title="Email"><Mail size={20}/></button>
                 <button onClick={() => handleCopy(exam)} className="p-3.5 bg-gray-100 text-gray-600 rounded-2xl hover:scale-110 transition-all shadow-sm active:scale-90" title="Copier"><Copy size={20}/></button>
                 {canEdit && <button onClick={() => handleEdit(exam)} className="p-3.5 bg-blue-50 text-blue-500 rounded-2xl hover:bg-blue-500 hover:text-white transition-all active:scale-90" title="Éditer"><Pencil size={20}/></button>}
                 {canDelete && <button onClick={() => handleDelete(exam.id)} className="p-3.5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90" title="Supprimer"><Trash2 size={20}/></button>}
              </div>
            </div>
          );
        })}

        {displayedExams.length === 0 && (
           <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <CalendarIcon size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucune épreuve planifiée</p>
           </div>
        )}
      </div>

      {/* Creation Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Modifier l'épreuve" : "Nouvel examen"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Matière / Module</label>
            <input required type="text" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full px-5 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none italic focus:ring-4 focus:ring-orange-50" placeholder="ex: Analyse Mathématique II" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Date</label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-5 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Heure de début</label>
              <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-5 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Salle / Lieu</label>
              <input required type="text" value={formData.room} onChange={e => setFormData({...formData, room: e.target.value})} className="w-full px-5 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none italic" placeholder="Salle 102" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Durée prévue</label>
              <input required type="text" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full px-5 py-4 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none italic" placeholder="2h00" />
            </div>
          </div>
          <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Public cible</label>
              <select disabled={!isAdmin} value={formData.className} onChange={e => setFormData({...formData, className: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-black text-[10px] uppercase outline-none border-none cursor-pointer">
                 <option value="Général">Toute l'école</option>
                 {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          <button type="submit" disabled={submitting} className="w-full bg-orange-500 text-white font-black py-5 rounded-[2.5rem] shadow-xl uppercase tracking-[0.2em] italic text-xs hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-3">
            {submitting ? <Loader2 className="animate-spin" /> : editingId ? <Save size={20}/> : <CheckCircle2 size={20}/>}
            {editingId ? "Enregistrer les modifications" : "Valider la programmation"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
