
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Megaphone, Calendar, GraduationCap, Video, 
  BarChart2, Search, LogOut, Menu, X, Moon, Sun, 
  ShieldCheck, UserCircle, Bell, Check, Trash2, Info, AlertTriangle, Settings, Loader2, ArrowRight, Filter, CalendarDays, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { AnnouncementPriority } from '../types';

interface SearchResult {
  id: string;
  type: 'Annonce' | 'Examen' | 'Visio' | 'Sondage' | 'Fichier';
  title: string;
  subtitle?: string;
  link: string;
  date?: string;
  priority?: AnnouncementPriority;
}

export default function Layout() {
  const { user, logout, toggleTheme, isDarkMode } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotification();
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Search Filters
  const [searchPriority, setSearchPriority] = useState<string>('all');
  const [searchStartDate, setSearchStartDate] = useState<string>('');
  const [searchEndDate, setSearchEndDate] = useState<string>('');

  const [fullData, setFullData] = useState<{
    anns: any[],
    exams: any[],
    meets: any[],
    polls: any[]
  } | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isSearchOpen && !fullData) {
      const loadSearchData = async () => {
        try {
          const [anns, exams, meets, polls] = await Promise.all([
            API.announcements.list(0, 100),
            API.exams.list(),
            API.meet.list(),
            API.polls.list()
          ]);
          setFullData({ anns, exams, meets, polls });
        } catch (e) {
          console.error("Search data load error", e);
        }
      };
      loadSearchData();
    }
  }, [isSearchOpen, fullData]);

  const searchResults = useMemo(() => {
    if ((!searchQuery.trim() && searchPriority === 'all' && !searchStartDate && !searchEndDate) || !fullData) return [];
    
    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    const isWithinDateRange = (dateStr?: string) => {
      if (!dateStr) return true;
      const date = new Date(dateStr);
      if (searchStartDate) {
        const start = new Date(searchStartDate);
        start.setHours(0,0,0,0);
        if (date < start) return false;
      }
      if (searchEndDate) {
        const end = new Date(searchEndDate);
        end.setHours(23,59,59,999);
        if (date > end) return false;
      }
      return true;
    };

    fullData.anns.forEach(a => {
      const matchesText = !query || a.title.toLowerCase().includes(query) || a.content.toLowerCase().includes(query);
      const matchesPriority = searchPriority === 'all' || a.priority === searchPriority;
      const matchesDate = isWithinDateRange(a.date);

      if (matchesText && matchesPriority && matchesDate) {
        results.push({ 
          id: a.id, 
          type: 'Annonce', 
          title: a.title, 
          subtitle: a.author, 
          link: '/announcements', 
          date: a.date,
          priority: a.priority
        });
      }
    });

    // Only text and date search for other categories (priority is announcement specific)
    if (searchPriority === 'all') {
      fullData.exams.forEach(e => {
        const matchesText = !query || e.subject.toLowerCase().includes(query) || e.room.toLowerCase().includes(query);
        const matchesDate = isWithinDateRange(e.date);
        if (matchesText && matchesDate) {
          results.push({ id: e.id, type: 'Examen', title: e.subject, subtitle: `Salle ${e.room}`, link: '/exams', date: e.date });
        }
      });

      fullData.meets.forEach(m => {
        const matchesText = !query || m.title.toLowerCase().includes(query);
        // Meets have weekly times like "Lundi 10h", harder to filter by absolute date range unless we parse it
        if (matchesText) {
          results.push({ id: m.id, type: 'Visio', title: m.title, subtitle: m.platform, link: '/meet' });
        }
      });

      fullData.polls.forEach(p => {
        if (!query || p.question.toLowerCase().includes(query)) {
            results.push({ id: p.id, type: 'Sondage', title: p.question, link: '/polls' });
        }
      });
    }

    return results.sort((a, b) => {
      if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
      return 0;
    }).slice(0, 15);
  }, [searchQuery, fullData, searchPriority, searchStartDate, searchEndDate]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const navItems = useMemo(() => {
    const items = [
      { to: '/', icon: LayoutDashboard, label: 'Tableau de Bord', end: true },
      { to: '/announcements', icon: Megaphone, label: 'Annonces' },
      { to: '/schedule', icon: Calendar, label: 'Emploi du Temps' },
      { to: '/exams', icon: GraduationCap, label: 'Examens' },
      { to: '/meet', icon: Video, label: 'Visioconférence' },
      { to: '/polls', icon: BarChart2, label: 'Consultations' },
      { to: '/profile', icon: UserCircle, label: 'Mon Profil' },
    ];
    if (user?.role === 'ADMIN') items.push({ to: '/admin', icon: ShieldCheck, label: 'Administration' } as any);
    return items;
  }, [user?.role]);

  const handleLogout = async () => {
    if (window.confirm("Se déconnecter de la plateforme ?")) {
      await logout();
      navigate('/login');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors font-sans overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/60 md:hidden backdrop-blur-sm transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl md:shadow-none flex flex-col`}>
        <div className="flex items-center justify-between p-6 h-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center text-primary-500 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
               < GraduationCap size={24} />
            </div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic">UniConnect</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar">
          <NavLink 
            to="/profile" 
            className={({ isActive }) => `flex items-center gap-4 mb-10 p-4 rounded-2xl transition-all group border ${isActive ? 'bg-primary-50/80 border-primary-100 dark:bg-primary-900/20 dark:border-primary-800/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'}`}
          >
             <div className="relative flex-shrink-0">
                <img 
                  src={user?.avatar} 
                  alt="Profile" 
                  className="w-16 h-16 rounded-full object-cover border-[6px] border-primary-500 dark:border-primary-400 shadow-2xl shadow-primary-500/30 ring-4 ring-white dark:ring-gray-900 transition-all group-hover:scale-110 group-hover:rotate-3" 
                />
                <div className="absolute bottom-1 right-0 w-4 h-4 bg-green-500 border-[3px] border-white dark:border-gray-900 rounded-full shadow-md"></div>
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-black truncate text-gray-900 dark:text-white leading-tight">{user?.name.split(' ')[0]}</p>
               <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-black uppercase tracking-widest mt-0.5">{user?.role === 'ADMIN' ? 'Admin' : user?.className}</p>
             </div>
          </NavLink>

          <nav className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-black tracking-[0.2em] ml-2 mb-2 block">Menu Principal</label>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-3.5 text-sm font-bold rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400'
                  }`}
              >
                <item.icon size={20} className="transition-transform group-hover:scale-110" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 m-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-xl transition-all">
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-6 z-20 sticky top-0 transition-all">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <Menu size={24} />
          </button>

          <div className="hidden md:flex flex-1 max-w-md">
             <div onClick={() => setSearchOpen(true)} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 transition-all cursor-text group">
               <Search size={18} className="group-hover:text-primary-500 transition-colors" />
               <span className="font-medium">Rechercher... <kbd className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-black border border-gray-200 dark:border-gray-600 rounded">CTRL K</kbd></span>
             </div>
          </div>

          <div className="flex items-center gap-4 relative" ref={notifRef}>
             <button onClick={() => setNotifOpen(!isNotifOpen)} className={`p-2.5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl relative transition-all active:scale-95 ${isNotifOpen ? 'bg-gray-100 dark:bg-gray-800' : ''}`}>
               <Bell size={22} />
               {unreadCount > 0 && <span className="absolute top-2 right-2.5 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse"></span>}
             </button>

             {/* NOTIFICATION DROPDOWN */}
             {isNotifOpen && (
               <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-100 dark:border-gray-800 rounded-[2rem] shadow-2xl z-[100] animate-in slide-in-from-top-2 fade-in overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                     <h3 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white">Dernières Notifications</h3>
                     <button onClick={() => markAllAsRead()} className="text-[10px] font-black text-primary-500 uppercase tracking-widest hover:underline">Tout marquer lu</button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.length > 0 ? (
                      <div className="divide-y divide-gray-50 dark:divide-gray-800">
                        {notifications.map(notif => (
                          <div key={notif.id} className={`p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group relative ${!notif.isRead ? 'bg-primary-50/20 dark:bg-primary-900/10' : ''}`}>
                             <div className="flex items-start gap-4">
                                <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                                  notif.type === 'success' ? 'bg-green-50 text-green-500' :
                                  notif.type === 'alert' ? 'bg-red-50 text-red-500' :
                                  notif.type === 'warning' ? 'bg-orange-50 text-orange-500' : 'bg-primary-50 text-primary-500'
                                }`}>
                                   {notif.type === 'alert' ? <AlertTriangle size={18} /> : 
                                    notif.type === 'warning' ? <Info size={18} /> : <Megaphone size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-xs font-black text-gray-900 dark:text-white leading-tight">{notif.title}</p>
                                   <p className="text-[11px] text-gray-500 mt-1 leading-relaxed italic">{notif.message}</p>
                                   <p className="text-[9px] text-gray-400 mt-2 font-bold uppercase">{new Date(notif.timestamp).toLocaleTimeString()}</p>
                                </div>
                                {!notif.isRead && (
                                   <button onClick={() => markAsRead(notif.id)} className="p-1.5 text-primary-400 hover:text-primary-600 transition-colors">
                                      <Check size={16} />
                                   </button>
                                )}
                             </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-gray-400 italic">
                         <Bell size={32} className="mx-auto mb-3 opacity-10" />
                         <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Aucune notification</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                    <button onClick={() => clearNotifications()} className="w-full py-2.5 text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                       <Trash2 size={14} /> Effacer l'historique
                    </button>
                  </div>
               </div>
             )}

             <button onClick={toggleTheme} className="p-2.5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">
               {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 bg-gray-50/50 dark:bg-gray-950 custom-scrollbar animate-fade-in">
          <Outlet />
        </main>

        <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200 dark:border-gray-800 flex justify-around py-3.5 z-40 rounded-[2rem] shadow-2xl">
          <NavLink to="/" end className={({ isActive }) => `p-3 rounded-2xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/40' : 'text-gray-400'}`}><LayoutDashboard size={24} /></NavLink>
          <NavLink to="/announcements" className={({ isActive }) => `p-3 rounded-2xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/40' : 'text-gray-400'}`}><Megaphone size={24} /></NavLink>
          <NavLink to="/exams" className={({ isActive }) => `p-3 rounded-2xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/40' : 'text-gray-400'}`}><GraduationCap size={24} /></NavLink>
          <NavLink to="/profile" className={({ isActive }) => `p-3 rounded-2xl ${isActive ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/40' : 'text-gray-400'}`}><UserCircle size={24} /></NavLink>
        </nav>
      </div>

      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-8 sm:pt-16 px-4 bg-gray-950/70 backdrop-blur-md overflow-hidden" onClick={() => setSearchOpen(false)}>
           <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
             
             {/* Search Input Area */}
             <div className="relative border-b border-gray-50 dark:border-gray-800">
                <Search className="absolute left-6 top-6 text-gray-400" size={24} />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Rechercher par mot-clé..."
                  className="w-full py-7 pl-16 pr-6 bg-transparent text-xl font-bold text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button onClick={() => setSearchOpen(false)} className="absolute right-6 top-6 p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"><X size={24} /></button>
             </div>

             {/* Advanced Filters */}
             <div className="p-6 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                   <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                      <Filter size={14} className="text-primary-500" /> Filtres :
                   </div>
                   
                   <div className="flex-1 min-w-[150px]">
                      <select 
                        value={searchPriority} 
                        onChange={(e) => setSearchPriority(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-black text-gray-600 dark:text-gray-300 outline-none uppercase tracking-widest cursor-pointer hover:border-primary-400"
                      >
                         <option value="all">Priorité (Toutes)</option>
                         <option value="normal">Normal</option>
                         <option value="important">Important</option>
                         <option value="urgent">Urgent</option>
                      </select>
                   </div>

                   <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                      <div className="relative flex-1">
                        <CalendarDays size={12} className="absolute left-3 top-2.5 text-gray-400" />
                        <input 
                          type="date" 
                          value={searchStartDate} 
                          onChange={(e) => setSearchStartDate(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold outline-none text-gray-700 dark:text-gray-300"
                        />
                      </div>
                      <span className="text-gray-300">→</span>
                      <div className="relative flex-1">
                        <CalendarDays size={12} className="absolute left-3 top-2.5 text-gray-400" />
                        <input 
                          type="date" 
                          value={searchEndDate} 
                          onChange={(e) => setSearchEndDate(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold outline-none text-gray-700 dark:text-gray-300"
                        />
                      </div>
                   </div>

                   {(searchPriority !== 'all' || searchStartDate || searchEndDate || searchQuery) && (
                      <button 
                        onClick={() => { setSearchPriority('all'); setSearchStartDate(''); setSearchEndDate(''); setSearchQuery(''); }}
                        className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline px-2"
                      >
                        Reset
                      </button>
                   )}
                </div>
             </div>
             
             {/* Results Area */}
             <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 custom-scrollbar">
               {searchResults.length > 0 ? (
                  <div className="space-y-3">
                     {searchResults.map((result) => (
                        <button 
                          key={`${result.type}-${result.id}`} 
                          onClick={() => { setSearchOpen(false); navigate(result.link); }} 
                          className="w-full flex items-center gap-5 p-4 rounded-[2rem] bg-gray-50/50 dark:bg-gray-800/40 hover:bg-white dark:hover:bg-gray-800 transition-all group text-left shadow-sm hover:shadow-xl border border-transparent hover:border-primary-100 dark:hover:border-primary-900/50"
                        >
                           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110
                              ${result.type === 'Annonce' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' : 
                                result.type === 'Examen' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500' : 
                                result.type === 'Visio' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' :
                                'bg-primary-50 dark:bg-primary-900/20 text-primary-500'}
                           `}>
                              {result.type === 'Annonce' ? <Megaphone size={22} /> : 
                               result.type === 'Examen' ? <GraduationCap size={22} /> : 
                               result.type === 'Visio' ? <Video size={22} /> :
                               <Search size={22} />}
                           </div>

                           <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-black text-gray-900 dark:text-white truncate group-hover:text-primary-600 transition-colors tracking-tight text-lg">{result.title}</h4>
                                {result.priority && (
                                  <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border shrink-0 ${
                                    result.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-100' :
                                    result.priority === 'important' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                    'bg-primary-50 text-primary-600 border-primary-100'
                                  }`}>
                                    {result.priority}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest italic">
                                 <span className="text-primary-500 flex items-center gap-1.5 font-black"><Info size={12}/> {result.type}</span>
                                 {result.subtitle && <span className="truncate opacity-70">• {result.subtitle}</span>}
                                 {result.date && (
                                   <span className="flex items-center gap-1.5 opacity-70">
                                     <Clock size={12} /> {new Date(result.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                   </span>
                                 )}
                              </div>
                           </div>
                           <ArrowRight size={22} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                        </button>
                     ))}
                  </div>
               ) : (
                  <div className="py-24 text-center text-gray-400">
                     <Search size={64} className="mx-auto mb-6 opacity-5" />
                     <p className="text-sm font-black uppercase tracking-widest italic opacity-50">
                        {(!searchQuery && searchPriority === 'all' && !searchStartDate && !searchEndDate) 
                          ? "Entrez un mot-clé ou utilisez les filtres pour commencer..." 
                          : `Aucun résultat pour ces critères.`
                        }
                     </p>
                  </div>
               )}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
