
import React, { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, Download, Clock, Upload, History, Loader2, Trash2, Save, X, Share2, Copy, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, ScheduleFile } from '../types';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';

export default function Schedule() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [schedules, setSchedules] = useState<ScheduleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
      addNotification({ title: 'Erreur', message: 'Impossible de charger.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  };

  const displayedSchedules = useMemo(() => {
    return schedules.filter(sch => {
      const target = sch.className || 'Général';
      if (user?.role === UserRole.ADMIN) {
        return adminViewClass ? (target === adminViewClass || target === 'Général') : true;
      }
      return target === user?.className || target === 'Général';
    });
  }, [user, adminViewClass, schedules]);

  const currentSchedule = displayedSchedules[0];
  const history = displayedSchedules.slice(1);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    if (!window.confirm('Mettre en ligne une nouvelle version de l\'emploi du temps ?')) {
      e.target.value = ''; 
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const totalDuration = 2000; 
    const intervalTime = 50;
    const steps = totalDuration / intervalTime;
    let currentStep = 0;

    const progressInterval = setInterval(() => {
      currentStep++;
      const progress = Math.min(Math.round((currentStep / steps) * 100), 95); 
      setUploadProgress(progress);
    }, intervalTime);

    try {
      await new Promise(resolve => setTimeout(resolve, totalDuration));
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      const targetClass = (user?.role === UserRole.ADMIN && adminViewClass) ? adminViewClass : (user?.className || 'Général');
      const newVersionNum = currentSchedule ? parseInt(currentSchedule.version.replace(/[^0-9]/g, '')) + 1 : 1;
      
      const fakeUrl = "https://example.com/emploi-du-temps-esp.pdf"; 

      await API.schedules.create({
        version: `V${newVersionNum}`,
        url: fakeUrl,
        className: targetClass
      });

      fetchSchedules();
      addNotification({ title: 'Succès', message: `Version V${newVersionNum} publiée pour ${targetClass}.`, type: 'success' });

    } catch (error: any) {
      addNotification({ title: 'Erreur', message: "Échec du téléchargement.", type: 'alert' });
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        e.target.value = '';
      }, 500); 
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer cet emploi du temps ?")) return;

    try {
      await API.schedules.delete(id);
      fetchSchedules();
      addNotification({ title: 'Supprimé', message: 'Fichier retiré des archives.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de supprimer.', type: 'alert' });
    }
  };

  const handleCopyLink = (sch: ScheduleFile) => {
     navigator.clipboard.writeText(sch.url).then(() => {
        addNotification({ title: 'Lien copié', message: 'URL du fichier copiée.', type: 'success' });
     });
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)] gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Indexation des documents...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-8">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-800">
              <CalendarIcon size={24} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic">Emploi du Temps</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                {user?.role === UserRole.ADMIN && adminViewClass ? adminViewClass : (user?.className || 'Tous les départements')}
              </p>
           </div>
        </div>
        
        {canManage && (
          <div className="flex-shrink-0">
            {uploading ? (
              <div className="flex flex-col items-end justify-center w-64 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-[10px] font-black text-primary-600 dark:text-primary-400 mb-2 uppercase tracking-widest">
                   <Loader2 size={14} className="animate-spin" />
                   <span>Publication {uploadProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <label className="cursor-pointer flex items-center gap-3 bg-primary-500 hover:bg-primary-600 text-white px-8 py-4 rounded-[1.5rem] text-sm font-black shadow-xl shadow-primary-500/20 transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-widest">
                <Upload size={20} />
                <span>Publier une version</span>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} />
              </label>
            )}
          </div>
        )}
      </div>

      {!currentSchedule ? (
        <div className="text-center py-32 bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
           <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-8">
              <FileSpreadsheet size={40} className="text-gray-200" />
           </div>
           <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest italic">Aucun document publié</h3>
           <p className="text-gray-400 text-xs mt-3 font-bold">Le secrétariat n'a pas encore mis à jour l'emploi du temps pour cette sélection.</p>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-900 p-12 rounded-[3.5rem] shadow-soft border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 -mr-32 -mt-32 rounded-full group-hover:scale-110 transition-transform duration-700"></div>
              
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 mb-12 relative z-10">
                <div className="p-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-[2.5rem] text-emerald-500 border border-emerald-100 dark:border-emerald-800 shadow-xl shadow-emerald-500/10">
                  <FileSpreadsheet size={48} />
                </div>
                <div className="text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-3">
                    <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1.5">
                       <Sparkles size={12} /> Version Actuelle
                    </span>
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border border-gray-200 dark:border-gray-700">
                       {currentSchedule.className || 'ESP Dakar'}
                    </span>
                  </div>
                  <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter italic">Planning de la Semaine</h3>
                  <p className="text-gray-400 dark:text-gray-500 mt-2 text-sm font-bold">Dernière mise à jour : {new Date(currentSchedule.uploadDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-12 relative z-10 bg-gray-50 dark:bg-gray-800/50 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700">
                <div>
                  <span className="block text-[10px] text-gray-400 uppercase font-black tracking-widest mb-2 italic">ID Version</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">{currentSchedule.version}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-gray-400 uppercase font-black tracking-widest mb-2 italic">Fichier PDF</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">Prêt</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                <a 
                    href={currentSchedule.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex-[2] flex items-center justify-center gap-3 bg-gray-900 dark:bg-white dark:text-gray-900 hover:scale-[1.02] text-white py-5 rounded-[1.8rem] font-black shadow-2xl transition-all active:scale-95 uppercase tracking-widest text-xs"
                >
                  <Download size={20} /> Télécharger le PDF
                </a>
                <button 
                    onClick={() => handleCopyLink(currentSchedule)} 
                    className="flex-1 p-5 rounded-[1.8rem] bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2"
                >
                    <Copy size={20} /> Copier Lien
                </button>
                {canManage && (
                     <button onClick={(e) => handleDelete(e, currentSchedule.id)} className="p-5 rounded-[1.8rem] bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 transition-all active:scale-95">
                        <Trash2 size={20} />
                     </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
             <div className="flex items-center justify-between px-2">
                <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-[0.3em]">Historique des versions</h3>
                <History size={16} className="text-gray-300" />
             </div>
             <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {history.map(sch => (
                    <div key={sch.id} className="flex items-center justify-between p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 hover:border-primary-400 hover:shadow-lg transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-black text-xs flex items-center justify-center border border-gray-100 dark:border-gray-700">{sch.version}</div>
                        <div className="flex flex-col">
                           <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{new Date(sch.uploadDate).toLocaleDateString()}</span>
                           <span className="text-[10px] font-bold text-gray-400 uppercase">{sch.className || 'Global'}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <a href={sch.url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-emerald-500 transition-colors"><Download size={18} /></a>
                        {canManage && <button onClick={(e) => handleDelete(e, sch.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>}
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="p-12 text-center text-gray-400 border border-dashed border-gray-100 dark:border-gray-800 rounded-3xl">
                        <History size={32} className="mx-auto mb-4 opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest italic">Aucune archive</p>
                    </div>
                  )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
