
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole, Poll, MeetLink } from '../types';
import { 
  Clock, GraduationCap, Loader2, ChevronRight, BarChart2, 
  Calendar, Video, Megaphone, Radio, Sparkles, Zap, ArrowRight, 
  Maximize2, BellRing, Inbox, TrendingUp, MapPin 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const SkeletonCard = () => (
  <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 space-y-4">
    <div className="w-12 h-12 rounded-2xl skeleton" />
    <div className="h-8 w-3/4 skeleton rounded-lg" />
    <div className="h-4 w-1/2 skeleton rounded-lg opacity-50" />
  </div>
);

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
      console.error("Dashboard sync error", error);
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
    { to: '/polls', label: 'Consultations', count: data.polls.length, icon: BarChart2, color: '#8b5cf6' },
    { to: '/meet', label: 'Salons Live', count: data.meets.length, icon: Radio, color: '#10b981' }
  ], [data, themeColor]);

  if (loading) return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      <div className="h-56 w-full skeleton rounded-[4rem]" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    </div>
  );

  return (
    <div className="space-y-12 max-w-7xl mx-auto animate-fade-in pb-32">
      {/* Hero Welcome Optimized */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-transparent rounded-[4rem] -m-4 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 relative">
          <div className="space-y-6">
             <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full border border-gray-100 dark:border-gray-700 shadow-soft">
                <Zap size={14} className="text-amber-500 fill-amber-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">{user?.schoolName || 'ESP DAKAR'}</span>
             </div>
             <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-[0.85] py-2">
               Bienvenue, <br /><span style={{ color: themeColor }}>{user?.name.split(' ')[0]}</span>
             </h1>
             <p className="text-gray-500 dark:text-gray-400 text-lg font-medium italic max-w-2xl leading-relaxed flex items-center gap-3">
               Portail officiel de gestion <ArrowRight size={18} className="text-gray-300" /> <span className="font-black text-gray-900 dark:text-white underline decoration-4 underline-offset-8 transition-all hover:decoration-primary-500" style={{ textDecorationColor: themeColor }}>{user?.className}</span>
             </p>
          </div>
          
          <div className="hidden lg:flex items-center gap-8 bg-white dark:bg-gray-900 p-10 rounded-[3.5rem] shadow-premium border border-gray-50 dark:border-gray-800 transform hover:-rotate-1 transition-transform cursor-default">
             <div className="w-16 h-16 rounded-[1.8rem] flex items-center justify-center bg-gray-50 dark:bg-gray-800 shadow-inner">
                <Calendar size={32} style={{ color: themeColor }} />
             </div>
             <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Aujourd'hui</p>
                <span className="text-3xl font-black text-gray-900 dark:text-white italic leading-none">
                  {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </span>
             </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid Enhanced */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {metrics.map((m, i) => (
            <Link 
              key={m.to} 
              to={m.to} 
              className={`stagger-item stagger-${i+1} group p-10 rounded-[3.5rem] bg-white dark:bg-gray-900 shadow-soft border border-gray-100 dark:border-gray-800 hover:scale-[1.03] hover:-translate-y-1 active:scale-95 transition-all duration-500`}
              style={{ borderBottom: `8px solid ${m.color}` }}
            >
                <div className="flex items-center justify-between mb-10">
                    <div className="p-5 rounded-[2rem] text-white shadow-xl transform group-hover:rotate-12 transition-all" style={{ backgroundColor: m.color, boxShadow: `0 10px 20px -5px ${m.color}66` }}>
                        <m.icon size={28} />
                    </div>
                    <div className="w-10 h-10 rounded-full border border-gray-100 dark:border-gray-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <ArrowRight size={20} className="text-gray-400" />
                    </div>
                </div>
                <div className="text-7xl font-black text-gray-900 dark:text-white tracking-tighter italic mb-2 leading-none flex items-baseline gap-2">
                  {m.count}
                  {m.count > 0 && <span className="text-[10px] text-emerald-500 not-italic font-bold animate-bounce">+1</span>}
                </div>
                <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">{m.label}</div>
            </Link>
        ))}
      </div>

      {/* Main Content Layout Optimized */}
      <div className="grid lg:grid-cols-5 gap-16">
        <div className="lg:col-span-3 space-y-10">
          <div className="flex items-center justify-between px-6">
             <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] flex items-center gap-4 italic">
                <Megaphone size={22} style={{ color: themeColor }} /> Flux d'actualité
             </h3>
             <Link to="/announcements" className="text-[10px] font-black uppercase text-primary-500 tracking-widest hover:underline underline-offset-4 transition-all">Archives complètes</Link>
          </div>
          
          <div className="space-y-8">
              {data.anns.length > 0 ? data.anns.map((ann, i) => (
                    <div key={ann.id} className={`stagger-item stagger-${(i%4)+1} group bg-white dark:bg-gray-900 p-10 rounded-[3.5rem] shadow-soft border-2 border-transparent hover:border-gray-100 dark:hover:border-gray-800 hover:scale-[1.015] hover:-translate-y-1 hover:shadow-premium transition-all duration-300 cursor-pointer relative overflow-hidden`} onClick={() => navigate('/announcements')}>
                      <div className="w-2 h-full absolute left-0 top-0 transition-all group-hover:w-3" style={{ backgroundColor: ann.priority === 'urgent' ? '#f43f5e' : (ann.priority === 'important' ? '#f59e0b' : themeColor) }} />
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-6">
                          <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg ${ann.priority === 'urgent' ? 'bg-rose-500 text-white' : (ann.priority === 'important' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500')}`}>{ann.priority}</span>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">{new Date(ann.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })} • {ann.author}</span>
                        </div>
                        <h4 className="text-3xl font-black text-gray-900 dark:text-white italic tracking-tighter leading-tight group-hover:text-primary-500 transition-colors">
                          {ann.title}
                        </h4>
                        <p className="text-base text-gray-500 dark:text-gray-400 mt-4 line-clamp-2 italic leading-relaxed">{ann.content}</p>
                        <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                          Lire la suite <Maximize2 size={12} />
                        </div>
                      </div>
                    </div>
              )) : (
                <div className="py-24 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                  <Inbox className="mx-auto text-gray-200 mb-6" size={48} />
                  <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic opacity-50">Aucune annonce pour la classe {user?.className}</p>
                </div>
              )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-12">
          <section className="space-y-8">
             <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] px-6 italic flex items-center gap-4">
                <GraduationCap size={22} className="text-amber-500" /> Agenda Examens
             </h3>
             <div className="bg-white dark:bg-gray-900 p-10 rounded-[3.5rem] shadow-soft border border-gray-50 dark:border-gray-800 space-y-8">
                {data.exams.length > 0 ? data.exams.map(exam => (
                   <div key={exam.id} onClick={() => navigate('/exams')} className="flex items-center gap-8 group cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 pb-8 last:pb-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-rose-600 text-white rounded-[1.8rem] flex flex-col items-center justify-center shadow-lg group-hover:-rotate-6 transition-transform shrink-0">
                          <span className="text-[8px] font-black uppercase">{new Date(exam.date).toLocaleDateString('fr-FR', {weekday: 'short'})}</span>
                          <span className="text-2xl font-black italic leading-none my-1">{new Date(exam.date).getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                         <h4 className="font-black text-xl text-gray-900 dark:text-white tracking-tighter italic leading-tight truncate group-hover:text-orange-500 transition-colors">{exam.subject}</h4>
                         <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-widest flex items-center gap-2">
                           <MapPin size={10} className="text-orange-300" /> Salle {exam.room} • {new Date(exam.date).getHours()}h
                         </p>
                      </div>
                   </div>
                )) : (
                   <p className="text-center py-10 text-[10px] font-black text-gray-300 uppercase italic tracking-widest">Aucun examen programmé</p>
                )}
             </div>
          </section>

          <section className="space-y-8">
             <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.4em] px-6 italic flex items-center gap-4">
                <Radio size={22} className="text-emerald-500 animate-pulse" /> Live Now
             </h3>
             <div className="bg-gradient-to-br from-emerald-600 to-teal-800 p-10 rounded-[3.5rem] text-white shadow-premium relative overflow-hidden group">
                <Video className="absolute -bottom-10 -right-10 w-48 h-48 opacity-10 group-hover:scale-125 transition-transform duration-1000" />
                <div className="relative z-10 space-y-10">
                   {data.meets.length > 0 ? data.meets.map(meet => (
                      <div key={meet.id} className="space-y-4">
                         <div className="flex items-center gap-3">
                            <span className="w-3 h-3 bg-white rounded-full animate-ping"></span>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{meet.time}</span>
                         </div>
                         <h4 className="text-2xl font-black italic tracking-tighter leading-tight">{meet.title}</h4>
                         <a href={meet.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 px-8 py-4 bg-white text-emerald-700 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-emerald-50">Accéder au cours <ArrowRight size={16}/></a>
                      </div>
                   )) : (
                      <div className="text-center py-6 italic opacity-80">
                         <p className="text-[10px] font-black uppercase tracking-widest">Aucune session live active</p>
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
