
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { 
  Users, BookOpen, UserPlus, Search, Loader2, School, 
  Plus, Trash2, LayoutDashboard, Shield, 
  Ban, CheckCircle, PenSquare, Activity, Copy, Save, AlertCircle, Info, Filter, GraduationCap, Sparkles, Wand2, FileUp, CheckCircle2, AlertTriangle, Zap, Palette,
  Check, Eye, EyeOff, ClipboardCheck, FileDown, Download, Mail
} from 'lucide-react';
import { UserRole, ClassGroup, ActivityLog, User } from '../types';
import Modal from '../components/Modal';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

type TabType = 'dashboard' | 'users' | 'classes' | 'logs';

const THEME_COLORS = [
  { name: 'Bleu ESP', color: '#0ea5e9' },
  { name: 'Émeraude', color: '#10b981' },
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Rose', color: '#f43f5e' },
  { name: 'Ambre', color: '#f59e0b' },
  { name: 'Violet', color: '#8b5cf6' },
  { name: 'Graphite', color: '#475569' },
  { name: 'Cerise', color: '#e11d48' },
];

export default function AdminPanel() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const [users, setUsers] = useState<User[]>([]);
  const [classesList, setClassesList] = useState<ClassGroup[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCreatedInfo, setShowCreatedInfo] = useState(false);
  
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: 'passer25', role: UserRole.STUDENT, className: '', schoolName: 'ESP Dakar' });
  const [showPass, setShowPass] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classFormData, setClassFormData] = useState({ id: '', name: '', email: '', color: '#0ea5e9' });
  const [isEditClassMode, setIsEditClassMode] = useState(false);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      fetchGlobalData();
    }
  }, [user]);

  const fetchGlobalData = async () => {
    setLoading(true);
    try {
        const [usersData, classesData, logsData] = await Promise.all([
            API.auth.getUsers(),
            API.classes.list(),
            API.logs.list()
        ]);
        setUsers(usersData);
        setClassesList(classesData);
        setLogs(logsData);
    } catch(e: any) {
        addNotification({ title: 'Erreur', message: e?.message || "Chargement échoué", type: 'alert' });
    } finally {
        setLoading(false);
    }
  };

  const downloadCSV = useCallback((data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, []);

  const handleExportData = async (type: 'users' | 'classes' | 'logs') => {
    setExporting(type);
    try {
      let dataToExport: any[] = [];
      let filename = "";
      if (type === 'users') {
        dataToExport = users.map(u => ({ Nom: u.name, Email: u.email, Role: u.role, Filière: u.className }));
        filename = "utilisateurs_complets";
      } else if (type === 'classes') {
        dataToExport = classesList.map(c => ({ Nom: c.name, Email: c.email, Effectif: c.studentCount }));
        filename = "liste_filieres";
      } else {
        dataToExport = logs.map(l => ({ Date: l.timestamp, Acteur: l.actor, Action: l.action }));
        filename = "audit_securite";
      }
      downloadCSV(dataToExport, filename);
      addNotification({ title: 'Export réussi', message: 'Fichier généré.', type: 'success' });
    } catch (e) { addNotification({ title: 'Erreur Export', message: 'Échec génération.', type: 'alert' }); } finally { setExporting(null); }
  };

  const handleExportClassUsers = (className: string) => {
    const classUsers = users.filter(u => u.className === className);
    if (classUsers.length === 0) {
      addNotification({ title: 'Export impossible', message: 'Aucun inscrit dans cette filière.', type: 'warning' });
      return;
    }
    const dataToExport = classUsers.map(u => ({ 
      Nom: u.name, 
      Email: u.email, 
      Role: u.role, 
      Filière: u.className 
    }));
    const sanitizedName = className.toLowerCase().replace(/\s+/g, '_');
    downloadCSV(dataToExport, `liste_etudiants_${sanitizedName}`);
    addNotification({ title: 'Export réussi', message: `Liste ${className} générée.`, type: 'success' });
  };

  const dashboardStats = useMemo(() => {
    const rolesCount = { [UserRole.ADMIN]: 0, [UserRole.DELEGATE]: 0, [UserRole.STUDENT]: 0 };
    users.forEach(u => { if (rolesCount[u.role] !== undefined) rolesCount[u.role]++; });
    return {
        usersCount: users.length,
        classesCount: classesList.length,
        rolesData: [
            { name: 'Étudiants', value: rolesCount[UserRole.STUDENT], color: '#3B82F6' },
            { name: 'Délégués', value: rolesCount[UserRole.DELEGATE], color: '#10B981' },
            { name: 'Admins', value: rolesCount[UserRole.ADMIN], color: '#8B5CF6' },
        ],
        recentLogs: logs.slice(0, 10)
    };
  }, [users, classesList, logs]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.auth.createUser({
        name: newUser.fullName, email: newUser.email.trim().toLowerCase(), role: newUser.role,
        password: newUser.password, className: newUser.className, schoolName: newUser.schoolName
      });
      await fetchGlobalData();
      setShowCreatedInfo(true);
      addNotification({ title: 'Compte créé', message: 'Profil activé.', type: 'success' });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error?.message, type: 'alert' });
    } finally { setSubmitting(false); }
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    try {
      await API.auth.updateProfile(editingUser.id, editingUser);
      await fetchGlobalData();
      setIsEditModalOpen(false);
      addNotification({ title: 'Succès', message: 'Profil mis à jour.', type: 'success' });
    } catch (error: any) { addNotification({ title: 'Erreur', message: error?.message, type: 'alert' }); } finally { setSubmitting(false); }
  };

  const handleDeleteUser = async (userId: string) => {
      if(!window.confirm("Supprimer ce compte ?")) return;
      try {
          await API.auth.deleteUser(userId);
          fetchGlobalData();
          addNotification({ title: 'Supprimé', message: 'Accès révoqué.', type: 'info' });
      } catch(e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  const openClassModal = (cls?: ClassGroup) => {
    if (cls) {
      setClassFormData({ id: cls.id, name: cls.name, email: cls.email || '', color: cls.color || '#0ea5e9' });
      setIsEditClassMode(true);
    } else {
      setClassFormData({ id: '', name: '', email: '', color: '#0ea5e9' });
      setIsEditClassMode(false);
    }
    setIsClassModalOpen(true);
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
          if(isEditClassMode) await API.classes.update(classFormData.id, { name: classFormData.name, email: classFormData.email, color: classFormData.color });
          else await API.classes.create(classFormData.name, classFormData.email, classFormData.color);
          await fetchGlobalData();
          setIsClassModalOpen(false);
          addNotification({ title: 'Succès', message: 'Filière enregistrée.', type: 'success' });
      } catch (error: any) { addNotification({ title: 'Erreur', message: error?.message, type: 'alert' }); }
      finally { setSubmitting(false); }
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if(!window.confirm(`Supprimer "${name}" ?`)) return;
    try {
        await API.classes.delete(id);
        await fetchGlobalData();
        addNotification({ title: 'Supprimé', message: 'Filière retirée.', type: 'info' });
    } catch (e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  return (
    <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-140px)] animate-fade-in">
      <div className="w-full md:w-72 flex-shrink-0 space-y-4">
         <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 shadow-soft border border-gray-100 dark:border-gray-800">
             <div className="flex items-center gap-3 mb-8 px-2">
                <div className="p-3 bg-primary-500 text-white rounded-2xl shadow-lg">
                    <Shield size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider italic">Administration</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Contrôle JangHup</p>
                </div>
             </div>
             <nav className="space-y-1">
                 {[
                   { id: 'dashboard', icon: LayoutDashboard, label: 'Tableau de Bord' },
                   { id: 'classes', icon: BookOpen, label: 'Classes & Filières' },
                   { id: 'users', icon: Users, label: 'Utilisateurs' },
                   { id: 'logs', icon: Activity, label: 'Audit Sécurité' }
                 ].map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`w-full flex items-center gap-4 px-5 py-4 text-xs font-black rounded-2xl transition-all uppercase tracking-widest italic ${activeTab === tab.id ? 'bg-primary-500 text-white shadow-xl' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                        <tab.icon size={18} /> {tab.label}
                    </button>
                 ))}
             </nav>
         </div>
         <div className="bg-gradient-to-br from-gray-900 to-primary-900 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">Extraction Globale</p>
            <button onClick={() => handleExportData('users')} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 mb-2">
                <FileDown size={14} /> CSV Utilisateurs
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-24">
         {activeTab === 'dashboard' && (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Inscrits</p>
                        <h3 className="text-5xl font-black text-gray-900 dark:text-white mt-4 italic tracking-tighter">{dashboardStats.usersCount}</h3>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filières Actives</p>
                        <h3 className="text-5xl font-black text-gray-900 dark:text-white mt-4 italic tracking-tighter">{dashboardStats.classesCount}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-10 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800">
                    <h3 className="text-sm font-black text-gray-800 dark:text-white mb-8 uppercase tracking-widest italic">Répartition des comptes</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart><Pie data={dashboardStats.rolesData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"><Cell fill="#3B82F6" /><Cell fill="#10B981" /><Cell fill="#8B5CF6" /></Pie><RechartsTooltip /><Legend /></PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
         )}
         
         {activeTab === 'users' && (
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex flex-col lg:flex-row justify-between gap-4">
                    <div className="flex-1 max-w-md relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="Rechercher un utilisateur..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3 bg-gray-50 dark:bg-gray-800 rounded-2xl text-sm font-bold outline-none" />
                    </div>
                    <button onClick={() => setIsUserModalOpen(true)} className="bg-primary-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-primary-500/20 active:scale-95 transition-all">Créer un profil</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800/50 text-[10px] uppercase tracking-widest text-gray-400 font-black">
                            <tr><th className="px-8 py-6">Utilisateur</th><th className="px-8 py-6">Email / Contact</th><th className="px-8 py-6">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50/20 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-black italic text-gray-900 dark:text-white">{u.name}</span>
                                            <span className="text-[8px] uppercase font-bold text-primary-500">{u.role} • {u.className}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-xs text-gray-400 font-medium">{u.email}</td>
                                    <td className="px-8 py-5">
                                        <div className="flex gap-2">
                                            <button onClick={() => handleOpenEditUser(u)} className="p-2.5 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-primary-500 rounded-xl transition-all"><PenSquare size={16}/></button>
                                            <button onClick={() => handleDeleteUser(u.id)} className="p-2.5 bg-red-50 dark:bg-red-900/10 text-red-400 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
         )}

         {activeTab === 'classes' && (
            <div className="space-y-10">
                <div className="flex justify-between items-center px-4">
                    <div>
                        <h3 className="text-2xl font-black italic text-gray-900 dark:text-white uppercase tracking-tighter">Classes & Filières</h3>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Exportation des listes d'inscrits par section</p>
                    </div>
                    <button onClick={() => openClassModal()} className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                        <Plus size={18} className="inline mr-2"/> Ajouter
                    </button>
                </div>
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {classesList.map(cls => (
                        <div key={cls.id} className="bg-white dark:bg-gray-900 p-10 rounded-[3.5rem] border-2 shadow-soft flex flex-col group relative overflow-hidden transition-all hover:-translate-y-1" style={{ borderColor: cls.color }}>
                            <div className="absolute top-0 right-0 w-32 h-32 opacity-5 -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-700" style={{ backgroundColor: cls.color }} />
                            
                            <h4 className="text-2xl font-black italic mb-2 text-gray-900 dark:text-white">{cls.name}</h4>
                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 mb-10 uppercase tracking-widest">
                                <Users size={12} className="text-primary-500"/> {cls.studentCount || 0} Inscrits
                            </div>
                            
                            <div className="mt-auto flex flex-wrap gap-2">
                                <button onClick={() => handleExportClassUsers(cls.name)} className="flex-1 p-4 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all shadow-sm group/btn" title="Exporter la liste des inscrits (CSV)">
                                    <Download size={18} className="group-hover/btn:translate-y-0.5 transition-transform" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">CSV</span>
                                </button>
                                <button onClick={() => openClassModal(cls)} className="p-4 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-2xl transition-all shadow-sm"><PenSquare size={18}/></button>
                                <button onClick={() => handleDeleteClass(cls.id, cls.name)} className="p-4 bg-red-50 dark:bg-red-900/10 text-red-400 hover:text-red-500 rounded-2xl transition-all shadow-sm"><Trash2 size={18}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
         )}

         {activeTab === 'logs' && (
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 italic">Journal des activités</h4>
                    <button onClick={() => handleExportData('logs')} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                        <FileDown size={14}/> Audit complet
                    </button>
                </div>
                <div className="p-6 space-y-2">
                    {logs.map(log => (
                        <div key={log.id} className="flex items-center gap-6 p-5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 rounded-[1.8rem] transition-all border-b border-gray-50 dark:border-gray-800 last:border-0">
                            <div className="p-3 bg-gray-100 dark:bg-gray-800 text-primary-500 rounded-xl shadow-inner shrink-0">
                                <Shield size={16}/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white italic">
                                    {log.actor} <span className="text-gray-400 font-medium lowercase italic mx-1">{log.action}</span> {log.target}
                                </p>
                                <p className="text-[9px] text-gray-400 font-black uppercase mt-1 tracking-widest">{new Date(log.timestamp).toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
         )}
      </div>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Nouveau compte JangHup">
          <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Identité Complète</label>
                  <input required className="w-full p-5 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-sm outline-none focus:ring-4 focus:ring-primary-50" placeholder="Prénom et Nom" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
              </div>
              <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Académique</label>
                  <input required type="email" className="w-full p-5 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-sm outline-none focus:ring-4 focus:ring-primary-50" placeholder="etudiant@esp.sn" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Niveau d'accès</label>
                    <select className="w-full p-5 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-black text-[10px] uppercase outline-none cursor-pointer" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                        <option value={UserRole.STUDENT}>Étudiant</option>
                        <option value={UserRole.DELEGATE}>Délégué</option>
                        <option value={UserRole.ADMIN}>Admin</option>
                    </select>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Filière</label>
                    <select className="w-full p-5 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-black text-[10px] uppercase outline-none cursor-pointer" value={newUser.className} onChange={e => setNewUser({...newUser, className: e.target.value})}>
                        <option value="">Sélectionner...</option>
                        {classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
              </div>
              <button disabled={submitting} type="submit" className="w-full bg-primary-500 text-white font-black py-5 rounded-[2rem] uppercase tracking-[0.2em] italic text-xs shadow-xl active:scale-95 transition-all">
                {submitting ? <Loader2 className="animate-spin mx-auto" size={20}/> : "Valider l'inscription"}
              </button>
          </form>
      </Modal>

      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title="Gestion de la Filière">
         <form onSubmit={handleClassSubmit} className="space-y-6">
            <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom du département / Classe</label>
                <input required className="w-full p-5 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-sm outline-none" placeholder="ex: L2 Informatique" value={classFormData.name} onChange={e => setClassFormData({...classFormData, name: e.target.value})} />
            </div>
            <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email de diffusion (Optionnel)</label>
                <input type="email" className="w-full p-5 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-sm outline-none" placeholder="liste.classe@esp.sn" value={classFormData.email} onChange={e => setClassFormData({...classFormData, email: e.target.value})} />
            </div>
            <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Identité chromatique</label>
                <div className="grid grid-cols-4 gap-3">
                    {THEME_COLORS.map(c => (
                        <button key={c.color} type="button" onClick={() => setClassFormData({...classFormData, color: c.color})} className={`h-12 rounded-xl transition-all ${classFormData.color === c.color ? 'ring-4 ring-offset-2 ring-gray-200 dark:ring-gray-700 scale-110 shadow-lg' : 'hover:scale-105'}`} style={{ backgroundColor: c.color }} />
                    ))}
                </div>
            </div>
            <button disabled={submitting} type="submit" className="w-full bg-gray-900 text-white font-black py-5 rounded-[2rem] uppercase tracking-widest text-[10px] italic shadow-2xl active:scale-95 transition-all">
                {submitting ? <Loader2 className="animate-spin mx-auto" size={20}/> : "Enregistrer les modifications"}
            </button>
         </form>
      </Modal>
    </div>
  );
}
