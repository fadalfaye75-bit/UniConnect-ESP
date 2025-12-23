
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole, Poll, MeetLink } from '../types';
import { Clock, FileText, GraduationCap, Loader2, ChevronRight, BarChart2, Calendar, Video, Settings, ArrowRight, User as UserIcon, Sparkles, Megaphone, Radio, Zap, TrendingUp, CheckCircle2, MapPin, BellRing, ShieldCheck, BellOff, Maximize2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

export default function Dashboard() {
  const { user, adminViewClass } = useAuth();
  const { permission, requestPermission } = useNotification();
  const navigate = useNavigate();
  const isAdmin = user?.role === UserRole.ADMIN;
  const themeColor = user?.themeColor || '#0ea5e9';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [meets, setMeets] = useState<MeetLink[]>([]);
  const [totals, setTotals] = useState({ anns: 0, exams: 0, polls: 0, meets: 0 });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [allAnns, allExams, allPolls, allMeets] = await Promise.all([
          API.announcements.list(0, 10),
          API.exams.list(),
          API.polls.list(),
          API.meet.list()
      ]);

      const filterByClass = (itemClass: string) => {
        const target = itemClass || 'Général';
        if (isAdmin && !adminViewClass) return true; 
        if (adminViewClass) return target === adminViewClass || target === 'Général';
        return target === user?.className || target === 'Général';
      };

      const visibleAnns = allAnns.filter(a => filterByClass(a.className));
      const visibleExams = allExams.filter(e => filterByClass(e.className));
      const visiblePolls = allPolls.filter(p => filterByClass(p.className) && p.isActive);
      const visibleMeets = allMeets.filter(m => filterByClass(m.className));

      setTotals({ anns: visibleAnns.length, exams: visibleExams.length, polls: visiblePolls.length, meets: visibleMeets.length });
      setExams(visibleExams.filter(e => new Date(e.date) >= new Date()).slice(0, 3));
      setAnnouncements(visibleAnns.slice(0, 4));
      setPolls(visiblePolls.slice(0, 2));
      setMeets(visibleMeets.slice(0, 2));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.className, adminViewClass, isAdmin]);

  useEffect(() => {
    if (user) {
      fetchDashboardData(true);
      const subAnn = API.announcements.subscribe(() => fetchDashboardData(false));
      return () => {
        subAnn.unsubscribe();
      };
    }
  }, [user, fetchDashboardData]);

  const metrics = useMemo(() => [
    { to: '/announcements', label: 'Actualités', count: totals.anns, icon: Megaphone, color: themeColor },
    { to: '/exams', label: 'Épreuves', count: totals.exams, icon: GraduationCap, color: '#f59e0b' },
    { to: '/polls', label: 'Sondages', count: totals.polls, icon: BarChart2, color: '#8b5cf6' },
    { to: '/meet', label: 'Live Sessions', count: totals.meets, icon: Radio, color: '#10b981' }
  ], [totals, themeColor]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-6">
        <Loader2 className="animate-spin text-primary-500" size={50} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic animate-pulse">Initialisation UniConnect...</p>
    </div>
  );

  return (
    <div className="space-y-12 max-w-7xl mx-auto animate-fade-in pb-20">
      {/* Branding Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
        <div className="space-y-6">
           <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <Sparkles size={16} className="animate-pulse" style={{ color: themeColor }} />
              <span className="text-[10px] font-black uppercase tracking-widest">{user?.schoolName || 'ESP DAKAR'} • PORTAIL ACADÉMIQUE</span>
           </div>
           <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-[0.85]">
             Salut, <span style={{ color: themeColor }}>{user?.name.split(' ')[0]}</span>
           </h1>
           <p className="text-gray-500 dark:text-gray-400 text-base font-medium italic max-w-xl leading-relaxed">
             Heureux de te revoir en <span className="text-gray-900 dark:text-white font-black">{user?.className}</span>. Voici un aperçu rapide de ce qui se passe sur ton campus aujourd'hui.
           </p>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6 bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 group hover:border-gray-300 transition-all cursor-default">
             <Calendar size={32} style={{ color: themeColor }} className="group-hover:rotate-12 transition-transform" />
             <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Aujourd'hui</p>
                <span className="text-lg font-black text-gray-900 dark:text-white italic capitalize">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
             </div>
          </div>
          
          {permission !== 'granted' && (
            <button 
              onClick={requestPermission}
              className="flex items-center gap-6 bg-gray-900 text-white p-8 rounded-[3rem] shadow-2xl hover:scale-105 active:scale-95 transition-all group"
            >
              <BellRing size={32} className="animate-bounce" />
              <div className="text-left">
                 <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Alerte Push</p>
                 <span className="text-lg font-black italic">Activer les notifications</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
            <Link 
              key={m.to} 
              to={m.to} 
              className="group relative p-10 rounded-[3.5rem] bg-white dark:bg-gray-900 shadow-soft border border-gray-100 dark:border-gray-800 hover:scale-[1.03] active:scale-95 transition-all overflow-hidden"
              style={{ borderBottomWidth: '8px', borderBottomColor: m.color }}
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 dark:bg-gray-800 -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-30"></div>
                <div className="flex items-center justify-between mb-10">
                    <div className="p-4 rounded-2xl text-white shadow-lg group-hover:rotate-6 transition-transform" style={{ backgroundColor: m.color }}>
                        <m.icon size={28} />
                    </div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{m.label}</span>
                </div>
                <div className="text-7xl font-black text-gray-900 dark:text-white tracking-tighter italic mb-2">{m.count}</div>
                <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Explorer <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
            </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-12">
        {/* News Wall */}
        <div className="lg:col-span-3 space-y-8">
          <div className="flex items-center justify-between px-6">
             <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] flex items-center gap-3 italic">
                <Megaphone size={18} style={{ color: themeColor }} /> Dernières Publications
             </h3>
             <Link to="/announcements" className="text-[10px] font-black uppercase text-primary-500 tracking-widest hover:translate-x-1 transition-transform flex items-center gap-2">Tout voir <ChevronRight size={14}/></Link>
          </div>
          
          <div className="grid gap-6">
              {announcements.map((ann) => (
                  <div key={ann.id} onClick={() => navigate('/announcements')} className="group relative bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 transition-all hover:shadow-2xl hover:-translate-y-1 cursor-pointer flex gap-8">
                    <div 
                      className="w-1.5 h-full absolute top-0 left-0 rounded-l-[3rem]"
                      style={{ backgroundColor: ann.priority === 'urgent' ? '#f43f5e' : ann.priority === 'important' ? '#f59e0b' : themeColor }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-md tracking-tighter shadow-sm ${
                           ann.priority === 'urgent' ? 'bg-rose-500 text-white' : ann.priority === 'important' ? 'bg-amber-500 text-white' : 'bg-gray-500 text-white'
                        }`}>{ann.priority}</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">{new Date(ann.date).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-2xl font-black text-gray-900 dark:text-white italic tracking-tighter group-hover:text-primary-500 transition-colors leading-tight">
                        {ann.title}
                      </h4>
                      <p className="text-sm text-gray-500 mt-3 line-clamp-2 italic leading-relaxed">{ann.content}</p>
                    </div>
                    <div className="flex items-center justify-center p-5 bg-gray-50 dark:bg-gray-800 rounded-[2rem] group-hover:bg-primary-500 group-hover:text-white transition-all">
                        <Maximize2 size={24} className="opacity-30 group-hover:opacity-100" />
                    </div>
                  </div>
              ))}
          </div>
        </div>

        {/* Sidebar Components */}
        <div className="lg:col-span-2 space-y-12">
          <section className="space-y-6">
             <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] px-6 flex items-center gap-3 italic">
                <Clock size={18} style={{ color: '#f59e0b' }} /> Événements à venir
             </h3>
             <div className="bg-white dark:bg-gray-900 p-10 rounded-[3.5rem] shadow-soft border border-gray-100 dark:border-gray-800 space-y-8">
                {exams.length > 0 ? exams.map(exam => (
                   <div key={exam.id} onClick={() => navigate('/exams')} className="flex items-center gap-6 group cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 pb-6 last:pb-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-rose-600 text-white rounded-[1.5rem] flex flex-col items-center justify-center shadow-lg group-hover:rotate-6 transition-transform shrink-0">
                          <span className="text-[8px] font-black uppercase">{new Date(exam.date).toLocaleDateString('fr-FR', {weekday: 'short'})}</span>
                          <span className="text-2xl font-black">{new Date(exam.date).getDate()}</span>
                      </div>
                      <div className="min-w-0">
                         <h4 className="font-black text-lg text-gray-900 dark:text-white tracking-tighter italic leading-tight truncate group-hover:text-orange-500 transition-colors">{exam.subject}</h4>
                         <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Salle {exam.room} • {new Date(exam.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                      </div>
                   </div>
                )) : (
                   <div className="text-center py-10 opacity-20 italic font-black text-[10px] uppercase tracking-widest">Calendrier libre</div>
                )}
             </div>
          </section>

          <section className="space-y-6">
             <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] px-6 flex items-center gap-3 italic">
                <Radio size={18} style={{ color: themeColor }} /> Salons de Cours
             </h3>
             <div className="p-10 rounded-[3.5rem] text-white shadow-premium relative overflow-hidden group" style={{ background: `linear-gradient(145deg, ${themeColor}, #000)` }}>
                <Video className="absolute -bottom-10 -right-10 w-48 h-48 opacity-10 group-hover:rotate-12 transition-transform duration-1000" />
                <div className="relative z-10 space-y-8">
                   {meets.length > 0 ? meets.map(meet => (
                      <div key={meet.id} className="space-y-4">
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 opacity-80">
                               <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span> Live • {meet.time}
                            </p>
                            <h4 className="text-2xl font-black italic tracking-tighter leading-tight mt-1">{meet.title}</h4>
                         </div>
                         <a href={meet.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl">
                            Rejoindre la classe
                         </a>
                      </div>
                   )) : (
                      <div className="text-center py-10 opacity-40">
                         <p className="text-[10px] font-black uppercase tracking-widest">Aucune session en direct</p>
                      </div>
                   )}
                </div>
             </div>
          </section>
        </div>
      </div>
    </div>
  );
}
