
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Download, Upload, Loader2, Trash2, Share2, FileText, CalendarDays, 
  Star, Search, ShieldCheck, CheckCircle2, History, Eye, X, 
  Plus, Calendar as CalendarIcon, Grid, List, Save, FileSpreadsheet,
  Clock, MapPin, User as UserIcon, Palette, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, ScheduleFile, ScheduleSlot } from '../types';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import Modal from '../components/Modal';
import * as XLSX from 'xlsx';

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8h to 20h

const CATEGORY_COLORS = [
  { name: 'Bleu', color: '#0ea5e9', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  { name: 'Émeraude', color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { name: 'Violet', color: '#8b5cf6', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  { name: 'Ambre', color: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { name: 'Rose', color: '#f43f5e', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  { name: 'Graphite', color: '#64748b', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' },
];

export default function Schedule() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  
  const [viewMode, setViewMode] = useState<'grid' | 'files'>('grid');
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [schedules, setSchedules] = useState<ScheduleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Partial<ScheduleSlot> | null>(null);
  
  const [newFile, setNewFile] = useState({
    title: '',
    file: null as File | null
  });

  const canEdit = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;
  const currentClassName = user?.className || 'Général';

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [files, gridSlots] = await Promise.all([
        API.schedules.list(),
        API.schedules.getSlots(currentClassName)
      ]);
      setSchedules(files.filter(s => s.category === 'Planning'));
      setSlots(gridSlots);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Impossible de synchroniser les données.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  }, [currentClassName, addNotification]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Parsing Excel
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      // Format attendu: Ligne 1: Jour, Ligne 2: Début, Ligne 3: Fin, Ligne 4: Matière, Ligne 5: Prof, Ligne 6: Salle
      const parsedSlots: ScheduleSlot[] = [];
      data.slice(1).forEach((row, idx) => {
        if (row[0] && row[1] && row[3]) {
          const dayIdx = DAYS.findIndex(d => d.toLowerCase() === String(row[0]).toLowerCase());
          if (dayIdx !== -1) {
            parsedSlots.push({
              id: `new-${idx}`,
              day: dayIdx,
              startTime: String(row[1]),
              endTime: String(row[2]),
              subject: String(row[3]),
              teacher: row[4] ? String(row[4]) : '',
              room: row[5] ? String(row[5]) : '',
              color: CATEGORY_COLORS[parsedSlots.length % CATEGORY_COLORS.length].color
            });
          }
        }
      });

      if (parsedSlots.length > 0) {
        setSlots(parsedSlots);
        addNotification({ title: 'Excel importé', message: `${parsedSlots.length} créneaux détectés. N'oubliez pas d'enregistrer.`, type: 'success' });
      } else {
        addNotification({ title: 'Format invalide', message: 'Aucun créneau valide trouvé dans le fichier.', type: 'warning' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveGrid = async () => {
    setSaving(true);
    try {
      await API.schedules.saveSlots(currentClassName, slots);
      addNotification({ title: 'Enregistré', message: 'L\'emploi du temps a été mis à jour.', type: 'success' });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Sauvegarde échouée.', type: 'alert' });
    } finally {
      setSaving(false);
    }
  };

  const handleSlotAction = (slot: Partial<ScheduleSlot>) => {
    if (!canEdit) return;
    setSelectedSlot(slot);
    setShowEditModal(true);
  };

  const updateSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    if (selectedSlot.id?.startsWith('new-') || !selectedSlot.id) {
      const newS = { ...selectedSlot, id: Math.random().toString(36).substr(2, 9) } as ScheduleSlot;
      setSlots(prev => [...prev, newS]);
    } else {
      setSlots(prev => prev.map(s => s.id === selectedSlot.id ? selectedSlot as ScheduleSlot : s));
    }
    setShowEditModal(false);
  };

  const removeSlot = (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id));
    setShowEditModal(false);
  };

  // Rendu de la cellule du calendrier
  const renderCell = (dayIndex: number, hour: number) => {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    const slotAtTime = slots.find(s => s.day === dayIndex && s.startTime === timeStr);

    if (slotAtTime) {
      const style = CATEGORY_COLORS.find(c => c.color === slotAtTime.color) || CATEGORY_COLORS[0];
      // Calcul de la hauteur basé sur la durée (simplifié: 1h par défaut)
      return (
        <div 
          key={slotAtTime.id}
          onClick={() => handleSlotAction(slotAtTime)}
          className={`absolute inset-x-1 top-1 p-3 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md z-10 ${style.bg} ${style.border} ${style.text}`}
          style={{ height: 'calc(100% - 8px)' }}
        >
          <p className="text-[10px] font-black uppercase tracking-tighter truncate">{slotAtTime.subject}</p>
          <div className="flex items-center gap-1 mt-1 opacity-70">
            <MapPin size={10} />
            <span className="text-[9px] font-bold">{slotAtTime.room || 'TBA'}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 opacity-70">
            <UserIcon size={10} />
            <span className="text-[9px] font-bold truncate">{slotAtTime.teacher || 'Prof.'}</span>
          </div>
        </div>
      );
    }

    return canEdit ? (
      <button 
        onClick={() => handleSlotAction({ day: dayIndex, startTime: timeStr, endTime: `${(hour + 1).toString().padStart(2, '0')}:00`, subject: '', color: CATEGORY_COLORS[0].color })}
        className="w-full h-full opacity-0 hover:opacity-100 flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50/30 transition-all rounded-lg"
      >
        <Plus size={16} />
      </button>
    ) : null;
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-500" size={40} /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-12">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-primary-500 text-white rounded-3xl flex items-center justify-center shadow-lg transform -rotate-3"><CalendarIcon size={32} /></div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white italic uppercase tracking-tighter">Emploi du Temps</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{currentClassName} • Semaine Type</p>
           </div>
        </div>

        <div className="flex bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
           <button onClick={() => setViewMode('grid')} className={`px-6 py-3 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'grid' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>
              <Grid size={16} /> Calendrier
           </button>
           <button onClick={() => setViewMode('files')} className={`px-6 py-3 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'files' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>
              <List size={16} /> Documents
           </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="space-y-8">
           {/* Grid Controls */}
           <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4">
                 <div className="flex -space-x-2">
                    {CATEGORY_COLORS.slice(0, 4).map(c => (
                       <div key={c.color} className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900" style={{ backgroundColor: c.color }} />
                    ))}
                 </div>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Code couleur auto</p>
              </div>

              {canEdit && (
                <div className="flex items-center gap-3">
                   <label className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-emerald-100 transition-all">
                      <FileSpreadsheet size={16} /> Importer Excel
                      <input type="file" hidden accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} />
                   </label>
                   <button 
                    onClick={handleSaveGrid}
                    disabled={saving}
                    className="flex items-center gap-2 bg-primary-500 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary-500/20 active:scale-95 transition-all"
                   >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                      Enregistrer les changements
                   </button>
                </div>
              )}
           </div>

           {/* Interactive Calendar Grid */}
           <div className="bg-white dark:bg-gray-900 rounded-[3.5rem] shadow-premium border border-gray-50 dark:border-gray-800 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[1000px]">
                  {/* Grid Header */}
                  <div className="grid grid-cols-[80px_repeat(6,1fr)] bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                    <div className="h-16 flex items-center justify-center border-r border-gray-100 dark:border-gray-700">
                      <Clock size={18} className="text-gray-400" />
                    </div>
                    {DAYS.map((day, idx) => (
                      <div key={day} className="h-16 flex items-center justify-center font-black italic uppercase text-xs tracking-widest text-gray-900 dark:text-white border-r border-gray-100 dark:border-gray-700 last:border-0">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Grid Body */}
                  {HOURS.map((hour) => (
                    <div key={hour} className="grid grid-cols-[80px_repeat(6,1fr)] border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div className="h-24 flex items-center justify-center bg-gray-50/30 dark:bg-gray-800/30 border-r border-gray-100 dark:border-gray-700">
                        <span className="text-[11px] font-black text-gray-400">{hour.toString().padStart(2, '0')}:00</span>
                      </div>
                      {DAYS.map((_, dayIdx) => (
                        <div key={dayIdx} className="h-24 relative border-r border-gray-100 dark:border-gray-700 last:border-0 group">
                           {renderCell(dayIdx, hour)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
           </div>

           {/* Legend / Info */}
           <div className="flex justify-center">
              <div className="inline-flex items-center gap-6 px-10 py-5 bg-white dark:bg-gray-900 rounded-full shadow-soft border border-gray-50 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">En direct : Semaine Active</span>
                  </div>
                  <div className="w-px h-4 bg-gray-200" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Section {currentClassName} • ESP DAKAR</p>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-8">
           <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" placeholder="Trouver un document archivé..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
                className="w-full pl-16 pr-6 py-4 bg-white dark:bg-gray-900 rounded-[2rem] text-sm font-bold border-none outline-none shadow-soft" 
              />
           </div>

           <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {schedules.map((sch) => (
              <div key={sch.id} className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-soft border border-gray-100 dark:border-gray-800 flex flex-col hover:shadow-premium transition-all">
                  <div className="flex justify-between items-start mb-6">
                      <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><FileText size={24} /></div>
                  </div>
                  <h3 className="text-xl font-black italic text-gray-900 dark:text-white mb-2">{sch.version}</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8">{new Date(sch.uploadDate).toLocaleDateString()}</p>
                  
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <a href={sch.url} target="_blank" rel="noreferrer" className="py-3 bg-gray-50 dark:bg-gray-800 text-gray-500 rounded-xl font-black uppercase text-[9px] tracking-widest text-center">Aperçu</a>
                    <a href={sch.url} download={`${sch.version}.pdf`} className="py-3 bg-primary-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest text-center">Télécharger</a>
                  </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modale d'Édition de Créneau */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(null)} title="Détails du créneau">
         {selectedSlot && (
            <form onSubmit={updateSlot} className="space-y-6">
               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Matière / Module</label>
                  <input 
                    required 
                    value={selectedSlot.subject} 
                    onChange={e => setSelectedSlot({...selectedSlot, subject: e.target.value})}
                    className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none border-none focus:ring-2 focus:ring-primary-500" 
                    placeholder="ex: Algorithmique" 
                  />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Salle</label>
                    <input 
                      value={selectedSlot.room} 
                      onChange={e => setSelectedSlot({...selectedSlot, room: e.target.value})}
                      className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none border-none" 
                      placeholder="Salle 102" 
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Enseignant</label>
                    <input 
                      value={selectedSlot.teacher} 
                      onChange={e => setSelectedSlot({...selectedSlot, teacher: e.target.value})}
                      className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none border-none" 
                      placeholder="M. Diallo" 
                    />
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Couleur</label>
                  <div className="flex gap-2">
                     {CATEGORY_COLORS.map(c => (
                        <button 
                          key={c.color}
                          type="button"
                          onClick={() => setSelectedSlot({...selectedSlot, color: c.color})}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${selectedSlot.color === c.color ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'opacity-60'}`}
                          style={{ backgroundColor: c.color }}
                        />
                     ))}
                  </div>
               </div>

               <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-primary-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Valider</button>
                  {selectedSlot.id && (
                    <button type="button" onClick={() => removeSlot(selectedSlot.id!)} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20}/></button>
                  )}
               </div>
            </form>
         )}
      </Modal>
    </div>
  );
}
