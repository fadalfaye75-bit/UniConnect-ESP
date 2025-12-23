
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Megaphone, Calendar, GraduationCap, Video, 
  BarChart2, Search, LogOut, Menu, X, Moon, Sun, 
  ShieldCheck, UserCircle, Bell, Check, Trash2, Info, AlertTriangle, Settings, Loader2, ArrowRight, Filter, CalendarDays, Clock, CheckCircle2, MessageSquare, School, FileText, ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';

export const UserAvatar = React.memo(({ name, color, className = "w-10 h-10", textClassName = "text-xs" }: { name: string, color?: string, className?: string, textClassName?: string }) => {
  const initials = useMemo(() => {
    if (!name) return "?";
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  const bgColor = color || '#0ea5e9';

  return (
    <div 
      className={`${className} rounded-2xl flex items-center justify-center text-white font-black shadow-lg border-2 border-white dark:border-gray-800 shrink-0 transform hover:rotate-3 transition-transform`}
      style={{ backgroundColor: bgColor }}
    >
      <span className={textClassName}>{initials}</span>
    </div>
  );
});

export default function Layout() {
  const { user, logout, toggleTheme, isDarkMode } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotification();
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cache for search data to make it instant
  const [allData, setAllData] = useState<{anns: any[], exams: any[], schs: any[]}>({anns: [], exams: [], schs: []});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const themeColor = user?.themeColor || '#0ea5e9';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setIsSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
    setIsSearchOpen(false);
  }, [location]);

  // Prefetch search data once when search is focused
  const prefetchSearchData = useCallback(async () => {
    if (isDataLoaded) return;
    try {
      const [anns, exams, schs] = await Promise.all([
        API.announcements.list(0, 100),
        API.exams.list(),
        API.schedules.list()
      ]);
      setAllData({ anns, exams, schs });
      setIsDataLoaded(true);
    } catch (e) {
      console.error("Failed to prefetch search data", e);
    }
  }, [isDataLoaded]);

  // Instant local filtering
  const searchResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (query.length < 2) return { announcements: [], exams: [], schedules: [] };

    return {
      announcements: allData.anns.filter(a => a.title.toLowerCase().includes(query) || a.content.toLowerCase().includes(query)).slice(0, 4),
      exams: allData.exams.filter(e => e.subject.toLowerCase().includes(query) || e.room.toLowerCase().includes(query)).slice(0, 4),
      schedules: allData.schs.filter(s => s.category.toLowerCase().includes(query) || s.version.toLowerCase().includes(query)).slice(0, 4)
    };
  }, [searchQuery, allData]);

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

  const handleLogout = useCallback(async () => {
    if (window.confirm("Se déconnecter de la plateforme ?")) {
      await logout();
      navigate('/login');
    }
  }, [logout, navigate]);

  const hasAnyResult = searchResults.announcements.length > 0 || searchResults.exams.length > 0 || searchResults.schedules.length > 0;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200 font-sans overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/60 md:hidden backdrop-blur-sm transition-opacity duration-200" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-200 ease-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <div className="p-8 h-24 flex-shrink-0 flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-white rounded-2xl shadow-lg transition-transform hover:scale-110" style={{ backgroundColor: themeColor }}>
             <School size={28} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tighter uppercase italic leading-none">UniConnect</h1>
            <p className="text-[9px] font-black uppercase tracking-widest mt-1 truncate opacity-70" style={{ color: themeColor }}>{user?.schoolName || 'ESP DAKAR'}</p>
          </div>
        </div>

        <div className="px-6 py-2 flex-1 overflow-y-auto custom-scrollbar">
          <NavLink to="/profile" className={({ isActive }) => `flex items-center gap-4 mb-10 p-5 rounded-[2rem] transition-all duration-200 group border-2 ${isActive ? 'bg-gray-50/50 border-gray-200 dark:bg-gray-800/10 dark:border-gray-800/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent shadow-sm bg-white dark:bg-gray-800/20'}`}>
             <UserAvatar name={user?.name || "U"} color={themeColor} className="w-12 h-12" textClassName="text-xl" />
             <div className="flex-1 min-w-0">
               <p className="text-sm font-black truncate text-gray-900 dark:text-white leading-tight">{user?.name.split(' ')[0]}</p>
               <div className="mt-1 inline-flex px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md">
                 <p className="text-[8px] text-gray-500 dark:text-gray-300 truncate font-black uppercase tracking-widest">{user?.className || 'Visiteur'}</p>
               </div>
             </div>
          </NavLink>

          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `flex items-center gap-4 px-5 py-4 text-sm font-bold rounded-2xl transition-all duration-200 group
                  ${isActive ? 'text-white shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/20'}`}
                style={({ isActive }) => isActive ? { backgroundColor: themeColor } : {}}
              >
                <item.icon size={20} className="transition-transform group-hover:scale-110" />
                <span className="tracking-tight">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-6">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-5 py-4 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all duration-200 italic active:scale-95">
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-72 flex flex-col h-screen overflow-hidden">
        <header className="h-24 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-8 z-20 sticky top-0">
          <div className="flex items-center gap-6 flex-1 max-w-2xl">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-3 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">
              <Menu size={24} />
            </button>
            
            <div className="relative flex-1 group hidden sm:block" ref={searchRef}>
              <div className="relative">
                <Search className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${isSearchOpen ? 'text-primary-500' : 'text-gray-400'}`} size={20} />
                <input 
                  type="text" 
                  placeholder="Recherche instantanée..." 
                  value={searchQuery}
                  onFocus={() => { setIsSearchOpen(true); prefetchSearchData(); }}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-12 py-3.5 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl text-sm font-bold italic outline-none focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 transition-all duration-200"
                />
              </div>

              {isSearchOpen && (searchQuery.length >= 2) && (
                <div className="absolute top-full left-0 right-0 mt-4 bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-premium border border-gray-100 dark:border-gray-800 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-4 space-y-6">
                    {!hasAnyResult ? (
                      <div className="py-12 text-center opacity-30">
                        <Search size={32} className="mx-auto mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Aucun résultat</p>
                      </div>
                    ) : (
                      <>
                        {searchResults.announcements.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="px-4 text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">Annonces</h4>
                            {searchResults.announcements.map(ann => (
                              <button key={ann.id} onClick={() => { setIsSearchOpen(false); navigate('/announcements'); }} className="w-full text-left p-3.5 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group active:scale-[0.98]">
                                <p className="text-sm font-black text-gray-900 dark:text-white line-clamp-1 italic group-hover:text-primary-500">{ann.title}</p>
                                <p className="text-[10px] text-gray-500 line-clamp-1 mt-1 opacity-70">{ann.content}</p>
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults.exams.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="px-4 text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">Examens</h4>
                            {searchResults.exams.map(exam => (
                              <button key={exam.id} onClick={() => { setIsSearchOpen(false); navigate('/exams'); }} className="w-full text-left p-3.5 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group active:scale-[0.98]">
                                <p className="text-sm font-black text-gray-900 dark:text-white line-clamp-1 italic group-hover:text-primary-500">{exam.subject}</p>
                                <p className="text-[9px] text-gray-400 mt-1">Salle {exam.room} • {new Date(exam.date).toLocaleDateString()}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
             <button onClick={() => setNotifOpen(!isNotifOpen)} className={`p-3 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl relative transition-all active:scale-90 ${isNotifOpen ? 'bg-gray-50 dark:bg-gray-800' : ''}`} ref={notifRef}>
               <Bell size={24} style={isNotifOpen ? { color: themeColor } : {}} />
               {unreadCount > 0 && (
                 <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full ring-4 ring-white dark:ring-gray-900 animate-pulse"></span>
               )}
             </button>

             <button onClick={toggleTheme} className="p-3 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all active:scale-90">
               {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 sm:p-10 pb-32 bg-gray-50/30 dark:bg-gray-950 custom-scrollbar animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
