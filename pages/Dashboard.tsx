
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole, Poll, MeetLink } from '../types';
import { Clock, GraduationCap, Loader2, ChevronRight, BarChart2, Calendar, Video, Megaphone, Radio, Sparkles, Zap, ArrowRight, Maximize2, BellRing, Inbox } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

export default function Dashboard() {
  const { user, adminViewClass } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === UserRole.ADMIN;
  const themeColor = user?.themeColor || '#0ea5e9';

  const [data, setData] = useState({
    anns: [] as Announcement[],
    exams: [] as Exam[],
    polls: [] as Poll[],
    meets: [] as MeetLink[]
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [allAnns, allExams, allPolls, allMeets] = await Promise.all([
          API.announcements.list(0, 10),
          API.exams.list(),
          API.polls.list(),
          API.meet.list()
      ]);

      const filterByAccess = (itemClass: string) => {
        const target = itemClass || 'Général';
        if (isAdmin && !adminViewClass) return true;
        if (adminViewClass) return target === adminViewClass || target === 'Général';
        return target === user?.className || target === 'Général';
      };

      setData({
        anns: allAnns.filter(a => filterByAccess(a.className)).slice(0, 4),
        exams: allExams.filter(e => filterByAccess(e.className) && new Date(e.date) >= new Date()).slice(0, 3),
        polls: allPolls.filter(p => filterByAccess(p.className) && p.isActive).slice(0, 2),
        meets: allMeets.filter(m => filterByAccess(m.className)).slice(0, 2)
      });
    } catch (error) {
      console.error("Dashboard fetch error", error);
    } finally {
      setLoading(false);
    }
  }, [user, adminViewClass, isAdmin]);

  useEffect(() => {
    fetchData();
    const sub = API.announcements.subscribe(() => fetchData(true));
    return () => { sub.unsubscribe(); };
  }, [fetchData]);

  const metrics = useMemo(() => [
    { to: '/announcements', label: 'Annonces', count: data.anns.length, icon: Megaphone, color: themeColor },
    { to: '/exams', label: 'Examens', count: data.exams.length, icon: GraduationCap, color: '#f59e0b' },
    { to: '/polls', label: 'Sondages', count: data.polls.length, icon: BarChart2, color: '#8b5cf6' },
    { to: '/meet', label: 'Directs', count: data.meets.length, icon: Radio, color: '#10b981' }
  ], [data, themeColor]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[60vh] gap-6 animate-pulse">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] italic">Chargement du portail...</p>
    </div>
  );

  return (
    <div className="space-y-12 max-w-7xl mx-auto animate-fade-in pb-20">
      {/* Header Bienvenue */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
        <div className="space-y-6">
           <div className="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <Zap size={14} className="text-amber-500 animate-bounce" />
              <span className="text-[9px] font-black uppercase tracking-widest">{user?.schoolName || 'ESP DAKAR'}</span>
           </div>
           <h1 className="text-5xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none">
             Salut, <span style={{ color: themeColor }}>{user?.name.split(' ')[0]}</span>
           </h1>
           <p className="text-gray-500 dark:text-gray-400 text-lg font-medium italic max-w-xl">
             Ton espace <span className="font-black text-gray-900 dark:text-white">{user?.className}</span> est synchronisé en temps réel.
           </p>
        </div>
        
        <div className="hidden lg:flex items-center gap-6 bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-soft border border-gray-50 dark:border-gray-800">
           <Calendar size={32} style={{ color: themeColor }} />
           <div className="text-right">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Date du jour</p>
              <span className="text-xl font-black text-gray-900 dark:text-white italic">
                {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </span>
           </div>
        </div>
      </div>

      {/* Métriques Actionnables */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
            <Link 
              key={m.to} 
              to={m.to} 
              className="group p-8 rounded-[3rem] bg-white dark:bg-gray-900 shadow-soft border border-gray-100 dark:border-gray-800 hover:scale-[1.02] active:scale-95 transition-all"
              style={{ borderBottom: `6px solid ${m.color}` }}
            >
                <div className="flex items-center justify-between mb-8">
                    <div className="p-4 rounded-2xl text-white shadow-lg" style={{ backgroundColor: m.color }}>
                        <m.icon size={24} />
                    </div>
                    <ArrowRight size={20} className="text-gray-200 group-hover:text-gray-400 group-hover:translate-x-1 transition-all" />
                </div>
                <div className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter italic mb-1">{m.count}</div>
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{m.label}</div>
            </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-12">
        {/* Flux Principal */}
        <div className="lg:col-span-3 space-y-8">
          <div className="flex items-center justify-between px-4">
             <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] flex items-center gap-3 italic">
                <Megaphone size={18} style={{ color: themeColor }} /> Derniers flux
             </h3>
             <Link to="/announcements" className="text-[10px] font-black uppercase text-primary-500 tracking-widest hover:underline">Voir tout</Link>
          </div>
          
          <div className="space-y-6">
              {data.anns.length > 0 ? data.anns.map((ann) => (
                  <div key={ann.id} onClick={() => navigate('/announcements')} className="group bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-soft border border-gray-50 dark:border-gray-800 transition-all hover:shadow-xl cursor-pointer flex gap-8 relative overflow-hidden">
                    <div className="w-1.5 h-full absolute left-0 top-0" style={{ backgroundColor: ann.priority === 'urgent' ? '#f43f5e' : themeColor }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${ann.priority === 'urgent' ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{ann.priority}</span>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest italic">{new Date(ann.date).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-xl font-black text-gray-900 dark:text-white italic tracking-tighter leading-tight group-hover:text-primary-500 transition-colors">
                        {ann.title}
                      </h4>
                      <p className="text-sm text-gray-500 mt-3 line-clamp-2 italic">{ann.content}</p>
                    </div>
                    <div className="hidden sm:flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                        <Maximize2 size={20} className="text-gray-300 group-hover:text-primary-500 transition-all" />
                    </div>
                  </div>
              )) : (
                <div className="py-20 text-center bg-white dark:bg-gray-900 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                  <Inbox className="mx-auto text-gray-200 mb-4" size={40} />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Aucune annonce récente</p>
                </div>
              )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-2 space-y-10">
          <section className="space-y-6">
             <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] px-4 italic flex items-center gap-3">
                <GraduationCap size={18} className="text-amber-500" /> Agenda Épreuves
             </h3>
             <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-soft border border-gray-50 dark:border-gray-800 space-y-6">
                {data.exams.length > 0 ? data.exams.map(exam => (
                   <div key={exam.id} onClick={() => navigate('/exams')} className="flex items-center gap-6 group cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 pb-6 last:pb-0">
                      <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-rose-600 text-white rounded-2xl flex flex-col items-center justify-center shadow-lg group-hover:rotate-6 transition-transform shrink-0">
                          <span className="text-[7px] font-black uppercase">{new Date(exam.date).toLocaleDateString('fr-FR', {weekday: 'short'})}</span>
                          <span className="text-xl font-black">{new Date(exam.date).getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                         <h4 className="font-black text-lg text-gray-900 dark:text-white tracking-tighter italic leading-tight truncate">{exam.subject}</h4>
                         <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Salle {exam.room} • {new Date(exam.date).getHours()}h</p>
                      </div>
                   </div>
                )) : (
                   <p className="text-center py-6 text-[10px] font-black text-gray-300 uppercase italic">Aucun examen proche</p>
                )}
             </div>
          </section>

          <section className="space-y-6">
             <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] px-4 italic flex items-center gap-3">
                <Radio size={18} className="text-emerald-500 animate-pulse" /> Live Sessions
             </h3>
             <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden group">
                <Video className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-1000" />
                <div className="relative z-10 space-y-6">
                   {data.meets.length > 0 ? data.meets.map(meet => (
                      <div key={meet.id} className="space-y-3">
                         <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                            <span className="text-[10px] font-black uppercase tracking-widest">{meet.time}</span>
                         </div>
                         <h4 className="text-xl font-black italic tracking-tighter leading-tight">{meet.title}</h4>
                         <a href={meet.url} target="_blank" rel="noreferrer" className="inline-block px-6 py-3 bg-white text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Rejoindre</a>
                      </div>
                   )) : (
                      <p className="text-center py-4 text-[9px] font-black uppercase opacity-60 italic">Aucun direct</p>
                   )}
                </div>
             </div>
          </section>
        </div>
      </div>
    </div>
  );
}
