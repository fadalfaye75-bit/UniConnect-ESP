
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles, Filter, FilterX, Shield, Award, Calendar, RefreshCcw, ChevronDown, ChevronUp, Trophy, Radio, Power, Share2, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll, ClassGroup } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';

export default function Polls() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const themeColor = user?.themeColor || '#0ea5e9';
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedPollId, setExpandedPollId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

  const [newPoll, setNewPoll] = useState({
    question: '',
    className: '',
    options: ['', ''],
    startTime: '',
    endTime: ''
  });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;
  const isAdmin = user?.role === UserRole.ADMIN;

  const fetchPolls = useCallback(async (showLoader = false) => {
    try {
      if(showLoader) setLoading(true); 
      const data = await API.polls.list();
      setPolls(data);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Chargement échoué.', type: 'alert' });
    } finally {
      if(showLoader) setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchPolls(true);
    API.classes.list().then(setClasses);
    const subscription = API.polls.subscribe(() => fetchPolls(false));
    return () => { subscription.unsubscribe(); };
  }, [fetchPolls]);

  useEffect(() => {
    if (isModalOpen) {
      setNewPoll(prev => ({ ...prev, className: isAdmin ? '' : (user?.className || '') }));
    }
  }, [isModalOpen, isAdmin, user?.className]);

  const handleVote = useCallback(async (poll: Poll, optionId: string) => {
    if (!user || poll.userVoteOptionId === optionId) return;
    try {
      await API.polls.vote(poll.id, optionId);
      fetchPolls(false);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Vote impossible.', type: 'alert' });
    }
  }, [user, addNotification, fetchPolls]);

  const handleTogglePollStatus = useCallback(async (poll: Poll) => {
    const canModify = isAdmin || poll.user_id === user?.id;
    if (!canModify) return;
    try {
      await API.polls.update(poll.id, { isActive: !poll.isActive });
      fetchPolls(false);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action échouée.', type: 'alert' });
    }
  }, [isAdmin, user?.id, addNotification, fetchPolls]);

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const targetClass = isAdmin ? newPoll.className : (user?.className || 'Général');
      await API.polls.create({
        question: newPoll.question,
        className: targetClass,
        options: newPoll.options.filter(o => o.trim() !== '').map(label => ({ label }))
      });
      setIsModalOpen(false);
      fetchPolls(false);
      addNotification({ title: 'Succès', message: 'Sondage lancé.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Échec de création.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const displayedPolls = useMemo(() => {
    return polls.filter(poll => {
      const target = poll.className || 'Général';
      if (!isAdmin && target !== 'Général' && target !== user?.className) return false;
      
      const matchesSearch = poll.question.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = poll.isActive;
      else if (statusFilter === 'closed') matchesStatus = !poll.isActive;

      return matchesSearch && matchesStatus;
    });
  }, [user, polls, searchTerm, statusFilter, isAdmin]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 shadow-premium rounded-2xl border border-gray-100 dark:border-gray-700">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">{payload[0].payload.name}</p>
          <p className="text-lg font-black italic" style={{ color: themeColor }}>
            {payload[0].value} voix ({payload[0].payload.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 text-white rounded-[2rem] flex items-center justify-center shadow-2xl" style={{ backgroundColor: themeColor }}><BarChart2 size={32} /></div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-3">{user?.className || 'ESP'}</p>
           </div>
        </div>
        <div className="flex flex-col lg:flex-row flex-1 items-center gap-3 max-w-3xl">
           <div className="relative flex-1 w-full">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
             <input type="text" placeholder="Rechercher une question..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-16 pr-6 py-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2rem] text-sm outline-none font-bold" />
           </div>
           {canManage && (
             <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase italic shadow-xl shrink-0" style={{ backgroundColor: themeColor }}>
               <Plus size={20} className="inline mr-2" /> Nouveau
             </button>
           )}
        </div>
      </div>

      <div className="grid gap-6">
        {displayedPolls.map(poll => {
            const isExpanded = expandedPollId === poll.id;
            const canModify = isAdmin || poll.user_id === user?.id;
            
            // Préparation des données pour le graphique
            const chartData = poll.options.map(option => ({
              name: option.label,
              value: option.votes,
              percentage: poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0
            }));

            return (
              <div key={poll.id} className={`bg-white dark:bg-gray-900 rounded-[3.5rem] p-8 md:p-12 shadow-soft border-2 transition-all duration-300 ${isExpanded ? 'border-primary-500' : 'border-transparent hover:border-gray-100'}`}>
                <div className="flex justify-between items-start mb-10 gap-6">
                   <div className="flex flex-wrap gap-3">
                      <span className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest ${poll.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                        {poll.isActive ? 'Ouvert' : 'Fermé'}
                      </span>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-5 py-2.5 rounded-full">{poll.className || 'ESP'}</span>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-5 py-2.5 rounded-full flex items-center gap-2">
                        <Users size={12} /> {poll.totalVotes} votes
                      </span>
                   </div>
                   <div className="flex items-center gap-2">
                     {canModify && (
                        <button onClick={(e) => { e.stopPropagation(); handleTogglePollStatus(poll); }} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase text-white transition-transform active:scale-95 ${poll.isActive ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                           {poll.isActive ? 'Clôturer' : 'Ouvrir'}
                        </button>
                     )}
                     <button onClick={() => setExpandedPollId(isExpanded ? null : poll.id)} className={`p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-400 transition-all ${isExpanded ? 'rotate-180 bg-primary-50 text-primary-500' : ''}`}>
                       <ChevronDown size={24} />
                     </button>
                   </div>
                </div>

                <h3 className="text-3xl font-black italic tracking-tighter mb-10 leading-tight">{poll.question}</h3>
                
                <div className="grid lg:grid-cols-2 gap-12 items-start">
                  <div className="space-y-4">
                    {poll.options.map(option => {
                      const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                      const isSelected = poll.userVoteOptionId === option.id;
                      return (
                        <button 
                          key={option.id} 
                          disabled={!poll.isActive}
                          onClick={() => handleVote(poll, option.id)} 
                          className={`relative w-full h-20 rounded-[2rem] overflow-hidden px-10 border-2 transition-all ${
                            isSelected 
                              ? 'shadow-lg ring-4 ring-primary-50 dark:ring-primary-900/10' 
                              : 'bg-white dark:bg-gray-900 border-gray-50 dark:border-gray-800 hover:border-gray-200'
                          } ${!poll.isActive ? 'cursor-default opacity-90' : 'active:scale-95'}`} 
                          style={isSelected ? { borderColor: themeColor } : {}}
                        >
                            <div className="absolute left-0 top-0 bottom-0 opacity-20 transition-all duration-700 ease-out" style={{ width: `${percentage}%`, backgroundColor: themeColor }} />
                            <div className="flex justify-between items-center z-10 relative">
                               <div className="flex items-center gap-4">
                                  {isSelected && <Check size={20} className="text-primary-500" />}
                                  <p className="font-black italic text-left leading-tight text-gray-800 dark:text-gray-100">{option.label}</p>
                               </div>
                               <div className="text-right shrink-0">
                                 <span className="text-2xl font-black italic">{percentage}%</span>
                                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{option.votes} voix</p>
                               </div>
                            </div>
                        </button>
                      );
                    })}
                  </div>

                  {isExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-8 rounded-[3rem] h-[340px] animate-in fade-in zoom-in-95 duration-500">
                      <div className="flex items-center justify-between mb-6">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Visualisation des résultats</p>
                        <BarChart2 size={18} className="text-primary-500" />
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            hide 
                          />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                          <Bar dataKey="value" radius={[0, 15, 15, 0]} barSize={32}>
                            {chartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={index % 2 === 0 ? themeColor : `${themeColor}99`} 
                                className="transition-all duration-300 hover:opacity-80"
                              />
                            ))}
                            <LabelList 
                              dataKey="percentage" 
                              position="right" 
                              formatter={(val: number) => `${val}%`}
                              style={{ fontSize: '12px', fontWeight: '900', fill: '#94a3b8', fontStyle: 'italic' }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            );
        })}

        {displayedPolls.length === 0 && (
           <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <BarChart2 size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucune consultation trouvée</p>
           </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer une consultation">
        <form onSubmit={handleCreatePoll} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Question du sondage</label>
            <textarea required value={newPoll.question} onChange={e => setNewPoll({...newPoll, question: e.target.value})} className="w-full p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold italic outline-none border-none focus:ring-4 focus:ring-primary-50 transition-all" rows={3} placeholder="Quelle est votre opinion sur..." />
          </div>
          
          <div className="space-y-4">
             <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Options de réponse</label>
             {newPoll.options.map((opt, i) => (
               <div key={i} className="flex gap-2">
                 <input 
                  type="text" required value={opt} 
                  onChange={e => {
                    const next = [...newPoll.options];
                    next[i] = e.target.value;
                    setNewPoll({...newPoll, options: next});
                  }} 
                  className="flex-1 px-5 py-4 rounded-xl bg-gray-50 dark:bg-gray-800 font-bold italic outline-none border-none" placeholder={`Option ${i+1}`} 
                 />
                 {newPoll.options.length > 2 && (
                   <button 
                    type="button" 
                    onClick={() => {
                      const next = newPoll.options.filter((_, idx) => idx !== i);
                      setNewPoll({...newPoll, options: next});
                    }}
                    className="p-4 text-gray-400 hover:text-red-500 transition-colors"
                   >
                     <X size={18} />
                   </button>
                 )}
               </div>
             ))}
             <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="flex items-center gap-2 text-[10px] font-black text-primary-500 uppercase tracking-widest px-4 py-2 hover:bg-primary-50 rounded-xl transition-all">
               <Plus size={14} /> Ajouter un choix
             </button>
          </div>
          
          <div>
             <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Public cible</label>
             <select disabled={!isAdmin} value={newPoll.className} onChange={e => setNewPoll({...newPoll, className: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-xl font-black text-[10px] uppercase outline-none border-none">
                <option value="">Public (Général)</option>
                {isAdmin ? classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option value={user?.className}>{user?.className}</option>}
             </select>
          </div>
          
          <button type="submit" disabled={submitting} className="w-full bg-primary-500 text-white font-black py-5 rounded-[2.5rem] uppercase italic shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
             {submitting ? <Loader2 className="animate-spin mx-auto" /> : "Lancer la consultation"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
