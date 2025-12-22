
import React, { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, Download, Clock, Upload, History, Loader2, Trash2, Save, X, Share2, Copy, Calendar as CalendarIcon, Sparkles, FileText, GraduationCap, BookOpen, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, ScheduleFile, ScheduleCategory } from '../types';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
// Added missing Modal import
import Modal from '../components/Modal';

export default function Schedule() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [schedules, setSchedules] = useState<ScheduleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState<ScheduleCategory | 'Touts'>('Touts');
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newFileCategory, setNewFileCategory] = useState<ScheduleCategory>('Planning');

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

  useEffect(() => {
    fetchSchedules();
  }, [user, adminViewClass]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const data = await API.schedules.list();
      setSchedules(data.sort((a,b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger les fichiers.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const displayedSchedules = useMemo(() => {
    return schedules.filter(sch => {
      const target = sch.className || 'Général';
      const matchesClass = user?.role === UserRole.ADMIN 
        ? (adminViewClass ? (target === adminViewClass || target === 'Général') : true)
        : (target === user?.className || target === 'Général');
      
      const matchesCategory = activeCategory === 'Touts' || sch.category === activeCategory;
      
      return matchesClass && matchesCategory;
    });
  }, [user, adminViewClass, schedules, activeCategory]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);

    const totalDuration = 1500; 
    const intervalTime = 50;
    const steps = totalDuration / intervalTime;
    let currentStep = 0;

    const progressInterval = setInterval(() => {
      currentStep++;
      const progress = Math.min(Math.round((currentStep / steps) * 100), 98); 
      setUploadProgress(progress);
    }, intervalTime);

    try {
      await new Promise(resolve => setTimeout(resolve, totalDuration));
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const countInCategory = schedules.filter(s => s.category === newFileCategory).length;
      const newVersionNum = countInCategory + 1;
      
      // Simulé : Dans un vrai cas, on uploaderait le fichier ici
      const fakeUrl = "https://example.com/document-esp.pdf"; 

      await API.schedules.create({
        version: `V${newVersionNum}`,
        url: fakeUrl,
        className: targetClass,
        category: newFileCategory
      });

      fetchSchedules();
      addNotification({ title: 'Fichier publié', message: `Le document (${newFileCategory}) est maintenant disponible.`, type: 'success' });
      setShowUploadModal(false);

    } catch (error: any) {
      addNotification({ title: 'Erreur', message: "Échec du transfert.", type: 'alert' });
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        e.target.value = '';
      }, 300); 
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer ce document définitivement ?")) return;

    try {
      await API.schedules.delete(id);
      fetchSchedules();
      addNotification({ title: 'Supprimé', message: 'Le fichier a été retiré des archives.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleCopyLink = (sch: ScheduleFile) => {
     navigator.clipboard.writeText(sch.url).then(() => {
        addNotification({ title: 'Lien copié', message: 'URL du document prête à l\'envoi.', type: 'success' });
     });
  };

  const getCategoryIcon = (cat: ScheduleCategory) => {
    switch(cat) {
        case 'Planning': return <Clock size={20} />;
        case 'Examens': return <GraduationCap size={20} />;
        case 'Cours': return <BookOpen size={20} />;
        default: return <FileText size={20} />;
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Indexation des documents...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-24 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 py-8 z-20 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CalendarIcon size={30} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none">Emplois du Temps</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">
                {user?.role === UserRole.ADMIN && adminViewClass ? adminViewClass : (user?.className || 'Portail Académique')}
              </p>
           </div>
        </div>
        
        {canManage && (
          <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-3 bg-primary-500 hover:bg-primary-600 text-white px-8 py-4 rounded-2xl text-sm font-black shadow-xl shadow-primary-500/20 transition-all active:scale-95 uppercase tracking-widest">
             <Upload size={20} /> Nouveau document
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-2">
         {['Touts', 'Planning', 'Examens', 'Cours', 'Autre'].map((cat) => (
            <button 
                key={cat} 
                onClick={() => setActiveCategory(cat as any)}
                className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                    activeCategory === cat 
                    ? 'bg-gray-900 text-white border-gray-900 shadow-lg' 
                    : 'bg-white text-gray-500 border-gray-100 hover:border-primary-400'
                }`}
            >
                {cat}
            </button>
         ))}
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {displayedSchedules.map((sch, idx) => (
            <div key={sch.id} className="group bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-soft border border-gray-100 dark:border-gray-800 hover:border-emerald-400 hover:shadow-2xl transition-all relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 -mr-12 -mt-12 rounded-full group-hover:scale-125 transition-transform duration-700"></div>
                
                <div className="flex justify-between items-start mb-8 relative z-10">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm group-hover:scale-110 transition-transform">
                        {getCategoryIcon(sch.category)}
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black uppercase text-gray-300 tracking-[0.2em] mb-1">VERSION</span>
                        <span className="text-sm font-black text-gray-900 dark:text-white">{sch.version}</span>
                    </div>
                </div>

                <div className="mb-8 relative z-10">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">{sch.category}</span>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight tracking-tighter italic">Document de session - {sch.className || 'Global'}</h3>
                    <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-gray-400 italic">
                        <Clock size={12} /> Publié le {new Date(sch.uploadDate).toLocaleDateString()}
                    </div>
                </div>

                <div className="mt-auto space-y-3 relative z-10">
                    <a 
                        href={sch.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 uppercase tracking-widest text-[10px]"
                    >
                        <Download size={18} /> Consulter
                    </a>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button onClick={() => handleCopyLink(sch)} className="flex-1 p-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-500 rounded-xl transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase">
                            <Copy size={14} /> Lien
                        </button>
                        {canManage && (
                            <button onClick={(e) => handleDelete(e, sch.id)} className="p-3.5 bg-red-50 hover:bg-red-500 hover:text-white text-red-400 rounded-xl transition-all flex items-center justify-center">
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        ))}

        {displayedSchedules.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
             <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-8">
                <Layers size={48} className="text-gray-200" />
             </div>
             <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic opacity-50">Aucun document dans cette catégorie</p>
          </div>
        )}
      </div>

      {/* Modal d'upload */}
      <Modal isOpen={showUploadModal} onClose={() => !uploading && setShowUploadModal(false)} title="Diffuser un document académique">
         <div className="space-y-6">
            <div className="bg-primary-50 dark:bg-primary-900/10 p-5 rounded-2xl border border-primary-100 flex gap-4">
                <Sparkles className="text-primary-500 shrink-0" size={24} />
                <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase leading-relaxed">Le fichier sera archivé et notifié aux étudiants concernés.</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nature du document</label>
                    <div className="grid grid-cols-2 gap-3">
                        {['Planning', 'Examens', 'Cours', 'Autre'].map(cat => (
                            <button 
                                key={cat}
                                onClick={() => setNewFileCategory(cat as ScheduleCategory)}
                                className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                    newFileCategory === cat 
                                    ? 'bg-gray-900 text-white border-gray-900' 
                                    : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-primary-300'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-4">
                    {uploading ? (
                        <div className="space-y-4 py-8 animate-in fade-in">
                            <div className="flex justify-between text-[10px] font-black text-primary-600 uppercase tracking-widest">
                                <span>TÉLÉCHARGEMENT EN COURS...</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div className="h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-100">
                                <div className="h-full bg-primary-500 transition-all duration-300 shadow-lg" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        </div>
                    ) : (
                        <label className="w-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-200 rounded-[2.5rem] hover:border-primary-400 hover:bg-primary-50/20 cursor-pointer transition-all group">
                            <div className="p-5 bg-primary-50 rounded-3xl text-primary-500 group-hover:scale-110 transition-transform mb-4">
                                <Upload size={32} />
                            </div>
                            <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Sélectionner un fichier</span>
                            <span className="text-[10px] font-bold text-gray-400 mt-2">PDF, Excel ou Image supportés</span>
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                    )}
                </div>
            </div>

            <button onClick={() => setShowUploadModal(false)} disabled={uploading} className="w-full py-4 text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-[0.2em] transition-all">
                ANNULER
            </button>
         </div>
      </Modal>
    </div>
  );
}
