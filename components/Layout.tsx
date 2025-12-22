
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Megaphone, Calendar, GraduationCap, Video, 
  BarChart2, Search, LogOut, Menu, X, Moon, Sun, 
  ShieldCheck, UserCircle, Bell, Check, Trash2, Info, AlertTriangle, Settings, Loader2, ArrowRight, Filter, CalendarDays, Clock, CheckCircle2, MessageSquare, School
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';

export const UserAvatar = ({ name, color, className = "w-10 h-10", textClassName = "text-xs" }: { name: string, color?: string, className?: string, textClassName?: string }) => {
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
};

export default function Layout() {
  const { user, logout, toggleTheme, isDarkMode } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotification();
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isNotifOpen, setNotifOpen] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);

  const themeColor = user?.themeColor || '#0ea5e9';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
  }, [location]);

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

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle size={16} className="text-red-500" />;
      case 'success': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'warning': return <AlertTriangle size={16} className="text-orange-500" />;
      default: return <Info size={16} style={{ color: themeColor }} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors font-sans overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/60 md:hidden backdrop-blur-sm transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl md:shadow-none flex flex-col`}>
        <div className="p-8 h-24 flex-shrink-0 flex items-center gap-4">
          {/* Fix: removed invalid 'shadowColor' property and replaced with 'boxShadow' */}
          <div 
            className="w-12 h-12 flex items-center justify-center text-white rounded-2xl shadow-lg"
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}33` }}
          >
             <School size={28} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tighter uppercase italic leading-none">UniConnect</h1>
            <p className="text-[9px] font-black uppercase tracking-widest mt-1 truncate" style={{ color: themeColor }}>{user?.schoolName || 'ESP DAKAR'}</p>
          </div>
        </div>

        <div className="px-6 py-2 flex-1 overflow-y-auto custom-scrollbar">
          <NavLink 
            to="/profile" 
            className={({ isActive }) => `flex items-center gap-4 mb-10 p-5 rounded-[2rem] transition-all group border-2 ${isActive ? 'bg-gray-50/50 border-gray-200 dark:bg-gray-800/10 dark:border-gray-800/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent shadow-sm bg-white dark:bg-gray-800/20'}`}
          >
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
                className={({ isActive }) => `flex items-center gap-4 px-5 py-4 text-sm font-bold rounded-2xl transition-all duration-300 group
                  ${isActive 
                    ? 'text-white shadow-xl -translate-x-1' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/20'
                  }`}
                style={({ isActive }) => isActive ? { backgroundColor: themeColor, boxShadow: `0 10px 25px -5px ${themeColor}66` } : {}}
              >
                {({ isActive }) => (
                  <>
                    <item.icon 
                      size={20} 
                      className={`transition-transform duration-500 ${isActive ? 'scale-110 rotate-3' : 'group-hover:scale-110 group-hover:-rotate-3'}`} 
                      style={!isActive ? { color: 'inherit' } : {}}
                    />
                    <span className="tracking-tight" style={!isActive ? { color: 'inherit' } : {}}>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-6">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-5 py-4 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all italic">
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-72 flex flex-col h-screen overflow-hidden">
        <header className="h-24 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-8 z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-3 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">
              <Menu size={24} />
            </button>
            <div className="hidden lg:flex flex-col">
               <h2 className="text-xl font-black text-gray-900 dark:text-white italic tracking-tighter leading-none">{user?.schoolName || 'ESP DAKAR'}</h2>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-1" style={{ color: themeColor }}>{user?.className || 'PORTAIL CENTRALISÉ'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 relative" ref={notifRef}>
             <button 
                onClick={() => setNotifOpen(!isNotifOpen)} 
                className={`p-3 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl relative transition-all active:scale-95 ${isNotifOpen ? 'bg-gray-50 dark:bg-gray-800 text-gray-900' : ''}`}
              >
               <Bell size={24} style={isNotifOpen ? { color: themeColor } : {}} />
               {unreadCount > 0 && (
                 <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full ring-4 ring-white dark:ring-gray-900 animate-pulse"></span>
               )}
             </button>

             {isNotifOpen && (
               <div className="absolute top-full right-0 mt-4 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-premium border border-gray-100 dark:border-gray-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                 <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
                    <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] italic">Notifications</h3>
                    <div className="flex gap-2">
                      <button onClick={markAllAsRead} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><Check size={18} /></button>
                      <button onClick={clearNotifications} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                    </div>
                 </div>
                 <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-gray-50 dark:divide-gray-800">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          onClick={() => { markAsRead(notif.id); if (notif.link) navigate(notif.link); }}
                          className={`p-5 flex gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer relative ${!notif.isRead ? 'bg-gray-50/50' : ''}`}
                        >
                          <div className="p-3 rounded-2xl shrink-0 h-fit bg-gray-100 dark:bg-gray-800">
                            {getNotifIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start">
                                <h4 className={`text-xs font-black italic tracking-tight leading-tight ${!notif.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{notif.title}</h4>
                                <span className="text-[8px] font-bold text-gray-300 uppercase ml-2">{new Date(notif.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                             </div>
                             <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 italic">{notif.message}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center opacity-30">
                        <MessageSquare size={32} className="mx-auto mb-3" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Aucune notification</p>
                      </div>
                    )}
                 </div>
               </div>
             )}

             <button onClick={toggleTheme} className="p-3 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">
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
