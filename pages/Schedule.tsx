
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Download, Upload, Loader2, Trash2, FileText, 
  Search, Plus, Grid, List, Save, FileSpreadsheet,
  Clock, MapPin, User as UserIcon, Palette, AlertCircle, Info, CheckCircle2,
  Calendar as CalendarIcon, RotateCcw, HelpCircle, Coffee, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, ScheduleFile, ScheduleSlot } from '../types';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import Modal from '../components/Modal';
import * as XLSX from 'xlsx';

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// Grille calée sur le rythme ESP strict
const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
  "12:30", "13:00", "13:30", "14:00", 
  "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"
];

const CATEGORY_COLORS = [
  { name: 'Bleu', color: '#0ea5e9', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  { name: 'Émeraude', color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { name: 'Violet', color: '#8b5cf6', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  { name: 'Ambre', color: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { name: 'Rose', color: '#f43f5e', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
];

const normalizeTime = (raw: any): string => {
  if (!raw) return "";
  let time = raw.toString().toLowerCase().trim().replace('h', ':').replace('H', ':');
  
  if (time === "8" || time === "08") return "08:00";
  if (time === "12") return "12:00";
  if (time.startsWith("14:3")) return "14:30";
  if (time.startsWith("18:3")) return "18:30";

  const parts = time.split(':');
  let h = parseInt(parts[0], 10);
  let m = parts[1] ? parseInt(parts[1], 10) : 0;
  
  if (m > 0 && m < 45) m = 30;
  else if (m >= 45) { h += 1; m = 0; }
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export default function Schedule() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  
  const [viewMode, setViewMode] = useState<'grid' | 'files'>('grid');
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [schedules, setSchedules] = useState<ScheduleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Partial<ScheduleSlot> | null>(null);
  
  const canEdit = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;
  const currentClassName = user?.className || 'Général';

  const fetchAllData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [files, gridSlots] = await Promise.all([
        API.schedules.list(),
        API.schedules.getSlots(currentClassName)
      ]);
      setSchedules(files.filter(s => s.category === 'Planning'));
      setSlots(gridSlots);
      setHasUnsavedChanges(false);
    } catch (error) {
      addNotification({ title: 'Erreur Sync', message: 'Vérifiez la base de données.', type: 'alert' });
    } finally {
      setLoading(false);
    }
  }, [currentClassName, addNotification]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(data.length, 30); i++) {
          if (data[i].some(cell => String(cell).toLowerCase().includes('lundi'))) {
            headerRowIdx = i;
            break;
          }
        }
        if (headerRowIdx === -1) throw new Error("Format ESP non reconnu (Lundi absent).");

        const dayCols: { [key: number]: number } = {};
        data[headerRowIdx].forEach((cell, colIdx) => {
          const val = String(cell).toLowerCase();
          const dayIdx = DAYS.findIndex(d => val.includes(d.toLowerCase()));
          if (dayIdx !== -1) dayCols[dayIdx] = colIdx;
        });

        const rowToTime: { [key: number]: string } = {};
        for (let i = headerRowIdx + 1; i < data.length; i++) {
          const timeVal = data[i][0] || data[i][1]; 
          const normalized = normalizeTime(timeVal);
          if (normalized) rowToTime[i] = normalized;
        }

        const parsedSlots: ScheduleSlot[] = [];
        
        Object.entries(dayCols).forEach(([dayIdxStr, colIdx]) => {
          const dayIdx = parseInt(dayIdxStr);
          
          for (let i = headerRowIdx + 1; i < data.length; i++) {
            const cellContent = String(data[i][colIdx] || '').trim();
            
            if (cellContent.length > 3) {
              let startTime = rowToTime[i] || "08:00";
              
              let lastRowOfBlock = i;
              for (let j = i + 1; j < data.length; j++) {
                const nextContent = String(data[j][colIdx] || '').trim();
                if (nextContent.length > 3 && nextContent !== cellContent) break;
                lastRowOfBlock = j;
              }

              let endTime = rowToTime[lastRowOfBlock + 1] || "";
              
              const [hStart] = startTime.split(':').map(Number);
              if (!endTime) {
                if (hStart < 12) endTime = "12:00";
                else endTime = "18:30";
              }

              // Normalisation ESP
              if (hStart < 12 && endTime > "12:00") endTime = "12:00";
              if (hStart >= 14 && endTime > "18:30") endTime = "18:30";
              if (startTime > "12:00" && startTime < "14:30") startTime = "14:30";

              const lines = cellContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
              parsedSlots.push({
                id: `temp-${Date.now()}-${parsedSlots.length}`,
                day: dayIdx,
                startTime,
                endTime,
                subject: lines[0] || "Cours",
                teacher: lines.find(l => l.toLowerCase().includes('m.') || l.toLowerCase().includes('pr') || l.toLowerCase().includes('dr')) || "À définir",
                room: lines.find(l => l.toLowerCase().includes('salle') || l.match(/[A-Z0-9]+-[A-Z0-9]+/)) || "TBD",
                color: CATEGORY_COLORS[parsedSlots.length % CATEGORY_COLORS.length].color
              });

              i = lastRowOfBlock;
            }
          }
        });

        setSlots(parsedSlots);
        setHasUnsavedChanges(true);
        addNotification({ 
          title: 'Extraction Intégrale', 
          message: `${parsedSlots.length} créneaux capturés avec horaires.`, 
          type: 'success' 
        });
      } catch (err: any) {
        addNotification({ title: 'Erreur Fichier', message: err.message, type: 'alert' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleSaveGrid = async () => {
    setSaving(true);
    try {
      await API.schedules.saveSlots(currentClassName, slots);
      addNotification({ title: 'Planning Publié', message: 'Mise à jour effectuée avec succès.', type: 'success' });
      setHasUnsavedChanges(false);
      fetchAllData(true);
    } catch (e) {
      addNotification({ title: 'Contrainte ESP', message: 'Les horaires 12h-14h30 sont interdits.', type: 'alert' });
    } finally {
      setSaving(false);
    }
  };

  const handleSlotAction = (slot: Partial<ScheduleSlot>) => {
    if (!canEdit) return;
    setSelectedSlot(slot);
    setShowEditModal(true);
  };

  const removeSlot = (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id));
    setHasUnsavedChanges(true);
    setShowEditModal(false);
  };

  const updateSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    if (selectedSlot.startTime! > "12:00" && selectedSlot.startTime! < "14:30") {
      addNotification({ title: 'Horaire Non Autorisé', message: 'L\'ESP est en pause entre 12h et 14h30.', type: 'warning' });
      return;
    }

    const newS = { 
      ...selectedSlot, 
      id: selectedSlot.id && !selectedSlot.id.startsWith('temp-') ? selectedSlot.id : `new-${Date.now()}` 
    } as ScheduleSlot;

    setSlots(prev => {
      const exists = prev.find(s => s.id === newS.id);
      if (exists) return prev.map(s => s.id === newS.id ? newS : s);
      return [...prev, newS];
    });

    setHasUnsavedChanges(true);
    setShowEditModal(false);
  };

  const handleDeleteFile = async (id: string) => {
    if (!window.confirm("Supprimer définitivement ce document archivé ?")) return;
    try {
      await API.schedules.deleteFile(id);
      addNotification({ title: 'Archivé Retiré', message: 'Le document a été supprimé.', type: 'info' });
      fetchAllData(true);
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Impossible de supprimer.', type: 'alert' });
    }
  };

  const getDurationInUnits = (start: string, end: string) => {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const totalMin = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(1, totalMin / 30);
  };

  const renderCell = (dayIndex: number, timeStr: string) => {
    const slotAtTime = slots.find(s => s.day === dayIndex && s.startTime === timeStr);

    if (slotAtTime) {
      const units = getDurationInUnits(slotAtTime.startTime, slotAtTime.endTime);
      const style = CATEGORY_COLORS.find(c => c.color === slotAtTime.color) || CATEGORY_COLORS[0];
      
      return (
        <div 
          key={slotAtTime.id}
          onClick={() => handleSlotAction(slotAtTime)}
          className={`absolute inset-x-1 top-1 p-3 rounded-2xl border-l-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl z-20 animate-fade-in ${style.bg} ${style.border} ${style.text}`}
          style={{ height: `calc(${units} * 100% - 8px)` }}
        >
          <div className="flex justify-between items-start mb-1">
             <p className="text-[11px] font-black uppercase tracking-tighter line-clamp-2 leading-tight">{slotAtTime.subject}</p>
             <span className="text-[8px] font-black opacity-60 shrink-0 whitespace-nowrap">{slotAtTime.startTime} - {slotAtTime.endTime}</span>
          </div>
          <div className="flex flex-col gap-0.5 opacity-80 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <MapPin size={9} className="shrink-0" />
              <span className="text-[9px] font-bold truncate">{slotAtTime.room}</span>
            </div>
            {units > 3 && (
              <div className="flex items-center gap-1.5">
                <UserIcon size={9} className="shrink-0" />
                <span className="text-[9px] font-bold truncate">{slotAtTime.teacher}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    const isOccupied = slots.some(s => {
      if (s.day !== dayIndex) return false;
      const [hS, mS] = s.startTime.split(':').map(Number);
      const [hE, mE] = s.endTime.split(':').map(Number);
      const [hC, mC] = timeStr.split(':').map(Number);
      const startMin = hS * 60 + mS;
      const endMin = hE * 60 + mE;
      const currentMin = hC * 60 + mC;
      return currentMin > startMin && currentMin < endMin;
    });

    return !isOccupied && canEdit ? (
      <button 
        onClick={() => {
          const [h, m] = timeStr.split(':').map(Number);
          const nextTime = m === 0 ? `${h}:30` : `${h+1}:00`;
          handleSlotAction({ day: dayIndex, startTime: timeStr, endTime: nextTime, subject: '', color: CATEGORY_COLORS[0].color });
        }}
        className="w-full h-full opacity-0 hover:opacity-100 flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50/50 transition-all rounded-xl"
      >
        <Plus size={16} />
      </button>
    ) : null;
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center py-32 gap-6">
      <Loader2 className="animate-spin text-primary-500" size={48} />
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse italic">Capture intégrale du planning...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-32 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-primary-500 text-white rounded-[1.8rem] flex items-center justify-center shadow-lg transform -rotate-3"><CalendarIcon size={32} /></div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white italic uppercase tracking-tighter leading-none">Gestion du Planning</h2>
              <div className="flex items-center gap-2 mt-3">
                 <span className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">{currentClassName}</span>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">• Grille Éditable</span>
              </div>
           </div>
        </div>

        <div className="flex bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
           <button onClick={() => setViewMode('grid')} className={`px-6 py-3 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'grid' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>
              <Grid size={16} /> Grille
           </button>
           <button onClick={() => setViewMode('files')} className={`px-6 py-3 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'files' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>
              <List size={16} /> Documents
           </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="space-y-8">
           {hasUnsavedChanges && (
             <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 animate-bounce-subtle shadow-xl">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-amber-500 text-white rounded-2xl"><AlertCircle size={24}/></div>
                   <div>
                      <p className="text-sm font-black text-amber-900 italic uppercase leading-none">Changements en attente</p>
                      <p className="text-[10px] font-bold text-amber-700 mt-1">L'extraction Excel a réussi. N'oubliez pas de publier.</p>
                   </div>
                </div>
                <div className="flex gap-3">
                   <button onClick={() => fetchAllData()} className="px-6 py-3 bg-white text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-200">Annuler</button>
                   <button onClick={handleSaveGrid} disabled={saving} className="px-8 py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-600/20 flex items-center gap-2">
                     {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} Publier la Grille
                   </button>
                </div>
             </div>
           )}

           <div className="flex flex-wrap items-center justify-between gap-6 bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-6">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                   <Clock size={16} className="text-primary-500"/> Matin: 08:00-12:00 | Soir: 14:30-18:30
                 </p>
              </div>

              {canEdit && (
                <div className="flex flex-wrap items-center gap-3">
                   <button onClick={() => setShowImportGuide(true)} className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:text-primary-500 transition-all shadow-sm">
                      <HelpCircle size={20} />
                   </button>
                   <label className="flex items-center gap-3 bg-emerald-50 text-emerald-600 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-emerald-100 transition-all shadow-md active:scale-95">
                      <FileSpreadsheet size={18} /> Importer Excel (Données Totales)
                      <input type="file" hidden accept=".xlsx, .xls" onChange={handleExcelUpload} />
                   </label>
                </div>
              )}
           </div>

           <div className="bg-white dark:bg-gray-900 rounded-[3.5rem] shadow-premium border border-gray-50 dark:border-gray-800 overflow-hidden relative">
              <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[1100px]">
                  {/* Jours */}
                  <div className="grid grid-cols-[100px_repeat(6,1fr)] bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                    <div className="h-16 flex items-center justify-center border-r border-gray-100 dark:border-gray-700">
                      <Clock size={20} className="text-gray-400" />
                    </div>
                    {DAYS.map((day) => (
                      <div key={day} className="h-16 flex items-center justify-center font-black italic uppercase text-[11px] tracking-[0.2em] text-gray-900 dark:text-white border-r border-gray-100 dark:border-gray-700 last:border-0">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Heures */}
                  {TIME_SLOTS.map((timeStr) => {
                    const isLunch = timeStr >= "12:30" && timeStr < "14:30";
                    return (
                      <div key={timeStr} className={`grid grid-cols-[100px_repeat(6,1fr)] border-b border-gray-100 dark:border-gray-800 last:border-0 ${isLunch ? 'bg-gray-50/30' : ''}`}>
                        <div className="h-14 flex items-center justify-center bg-gray-50/20 dark:bg-gray-800/20 border-r border-gray-100 dark:border-gray-700">
                          <span className={`text-[11px] font-black italic ${timeStr.endsWith(':00') || timeStr === '14:30' ? 'text-gray-500' : 'text-gray-300'}`}>{timeStr}</span>
                        </div>
                        {DAYS.map((_, dayIdx) => (
                          <div key={dayIdx} className="h-14 relative border-r border-gray-100 dark:border-gray-700 last:border-0 hover:bg-primary-50/5 transition-colors">
                            {timeStr === "12:30" && dayIdx === 2 && (
                               <div className="absolute inset-0 z-10 flex items-center justify-center text-gray-300 pointer-events-none">
                                  <Coffee size={24} className="opacity-20" />
                               </div>
                            )}
                            {renderCell(dayIdx, timeStr)}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {schedules.map((sch) => {
              const isOwner = user?.id === sch.user_id;
              const isAdmin = user?.role === UserRole.ADMIN;
              const canDeleteFile = isAdmin || isOwner;

              return (
                <div key={sch.id} className="group bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-soft border-2 border-transparent hover:border-gray-100 transition-all hover:scale-[1.02] flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-start mb-8">
                        <div className="p-5 bg-emerald-50 text-emerald-600 rounded-3xl shadow-sm"><FileText size={28} /></div>
                        {canDeleteFile && (
                          <button 
                            onClick={() => handleDeleteFile(sch.id)}
                            className="p-3 bg-red-50 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                            title="Supprimer définitivement"
                          >
                             <Trash2 size={18}/>
                          </button>
                        )}
                    </div>
                    <h3 className="text-2xl font-black italic text-gray-900 dark:text-white mb-2 leading-none">{sch.version}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-10">{new Date(sch.uploadDate).toLocaleDateString()}</p>
                    <div className="mt-auto grid grid-cols-2 gap-3">
                      <a href={sch.url} target="_blank" rel="noreferrer" className="py-4 bg-gray-50 dark:bg-gray-800 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest text-center">Aperçu</a>
                      <a href={sch.url} download className="py-4 bg-primary-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest text-center shadow-lg">Télécharger</a>
                    </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Modal Edition */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier le Créneau">
         {selectedSlot && (
            <form onSubmit={updateSlot} className="space-y-6">
               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Module / Matière</label>
                  <input required value={selectedSlot.subject} onChange={e => setSelectedSlot({...selectedSlot, subject: e.target.value})} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold italic text-sm outline-none border-none focus:ring-4 focus:ring-primary-50 transition-all" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Heure Début</label>
                    <input type="time" required value={selectedSlot.startTime} onChange={e => setSelectedSlot({...selectedSlot, startTime: e.target.value})} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none border-none" />
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Heure Fin</label>
                    <input type="time" required value={selectedSlot.endTime} onChange={e => setSelectedSlot({...selectedSlot, endTime: e.target.value})} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none border-none" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Salle</label>
                    <input value={selectedSlot.room} onChange={e => setSelectedSlot({...selectedSlot, room: e.target.value})} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none border-none" />
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Professeur</label>
                    <input value={selectedSlot.teacher} onChange={e => setSelectedSlot({...selectedSlot, teacher: e.target.value})} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold text-sm outline-none border-none" />
                  </div>
               </div>
               <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 bg-gray-900 text-white py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95">
                    <CheckCircle2 size={20} /> Appliquer les changements
                  </button>
                  {selectedSlot.id && !selectedSlot.id.startsWith('temp-') && (
                    <button type="button" onClick={() => removeSlot(selectedSlot.id!)} className="p-5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
                       <Trash2 size={20}/>
                    </button>
                  )}
               </div>
            </form>
         )}
      </Modal>

      <Modal isOpen={showImportGuide} onClose={() => setShowImportGuide(false)} title="Intelligence du Calendrier">
         <div className="space-y-6 text-gray-600 dark:text-gray-300">
            <p className="text-sm italic leading-relaxed">UniConnect ESP capture automatiquement les horaires et les fusions de cellules :</p>
            <div className="p-6 bg-blue-50 text-blue-700 rounded-3xl text-[11px] font-bold flex flex-col gap-4">
               <div className="flex gap-4">
                  <CheckCircle2 size={24} className="shrink-0" />
                  <p><b>Fusion Détectée</b> : Les blocs de 2h ou 4h sont automatiquement reconstitués.</p>
               </div>
               <div className="flex gap-4">
                  <CheckCircle2 size={24} className="shrink-0" />
                  <p><b>Cycles ESP</b> : Les cours s'arrêtent à 12:00 et reprennent à 14:30.</p>
               </div>
               <div className="flex gap-4">
                  <CheckCircle2 size={24} className="shrink-0" />
                  <p><b>Édition Facile</b> : Cliquez sur n'importe quel cours pour ajuster son heure de début ou de fin.</p>
               </div>
            </div>
            <button onClick={() => setShowImportGuide(false)} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Compris</button>
         </div>
      </Modal>
    </div>
  );
}
