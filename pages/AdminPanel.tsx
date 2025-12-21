
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { 
  Users, BookOpen, UserPlus, Search, Loader2, School, 
  Plus, Trash2, LayoutDashboard, Shield, 
  Ban, CheckCircle, PenSquare, Activity, Copy, Save, AlertCircle, Info, Filter, Bot, Sparkles, MessageSquare, Zap, GraduationCap
} from 'lucide-react';
import { UserRole, ClassGroup, ActivityLog, User, AISettings } from '../types';
import Modal from '../components/Modal';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

type TabType = 'dashboard' | 'users' | 'classes' | 'logs' | 'ai_config';

export default function AdminPanel() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const [users, setUsers] = useState<User[]>([]);
  const [classesList, setClassesList] = useState<ClassGroup[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  
  // AI Settings
  const [aiSettings, setAiSettings] = useState<AISettings>({
    tone: 'friendly',
    verbosity: 'medium',
    customInstructions: '',
    isActive: true
  });
  
  // Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [newUser, setNewUser] = useState({ fullName: '', email: '', role: UserRole.STUDENT, className: '', schoolName: 'ESP Dakar' });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classFormData, setClassFormData] = useState({ id: '', name: '', email: '' });
  const [isEditClassMode, setIsEditClassMode] = useState(false);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      fetchGlobalData();
      fetchAISettings();
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
        addNotification({ 
          title: 'Erreur', 
          message: e?.message || "Chargement échoué", 
          type: 'alert' 
        });
    } finally {
        setLoading(false);
    }
  };

  const fetchAISettings = async () => {
    try {
      const settings = await API.settings.getAI();
      setAiSettings(settings);
    } catch (e) {
      console.error("Failed to fetch AI settings");
    }
  };

  const handleSaveAISettings = async () => {
    setSubmitting(true);
    try {
      await API.settings.updateAI(aiSettings);
      addNotification({ title: 'Config IA enregistrée', message: 'Le bot utilisera désormais ces nouveaux paramètres.', type: 'success' });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Échec de la sauvegarde IA.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const dashboardStats = useMemo(() => {
    const rolesCount = { [UserRole.ADMIN]: 0, [UserRole.DELEGATE]: 0, [UserRole.STUDENT]: 0 };
    users.forEach(u => { 
        if (rolesCount[u.role] !== undefined) rolesCount[u.role]++; 
    });
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

  // ACTIONS UTILISATEURS
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUser.fullName || !newUser.email) {
      addNotification({ title: 'Données manquantes', message: 'Veuillez remplir tous les champs.', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await API.auth.createUser({
        name: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        className: newUser.className,
        schoolName: newUser.schoolName
      });
      
      await fetchGlobalData();
      
      setIsUserModalOpen(false);
      setNewUser({ fullName: '', email: '', role: UserRole.STUDENT, className: '', schoolName: 'ESP Dakar' });
      addNotification({ title: 'Compte créé avec succès', message: 'L\'utilisateur peut maintenant se connecter avec le MDP : passer25', type: 'success' });
    } catch (error: any) {
      addNotification({ title: 'Erreur de création', message: error?.message || "Impossible de créer le compte.", type: 'alert' });
    } finally { 
      setSubmitting(false); 
    }
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
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error?.message || 'Échec de mise à jour.', type: 'alert' });
    } finally { setSubmitting(false); }
  };

  const handleCopyUserDetails = (u: User) => {
    const text = `UniConnect ESP Dakar\n-----------------\nNom: ${u.name}\nEmail: ${u.email}\nMot de passe par défaut: passer25\nRôle: ${u.role}\nClasse: ${u.className || 'N/A'}\nEtablissement: ${u.schoolName || 'ESP Dakar'}`;
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Copié', message: 'Coordonnées (avec MDP) copiées.', type: 'success' });
    });
  };

  const handleToggleStatus = async (userId: string) => {
      if(!window.confirm("Changer le statut d'accès de cet utilisateur ? S'il est désactivé, il ne pourra plus se connecter à la plateforme.")) return;
      
      try {
          await API.auth.toggleUserStatus(userId);
          fetchGlobalData();
          addNotification({ title: 'Statut mis à jour', message: 'L\'accès a été modifié avec succès.', type: 'info' });
      } catch(e: any) { 
        addNotification({ title: 'Erreur', message: e?.message || "Échec de l'opération.", type: 'alert' }); 
      }
  };

  const handleDeleteUser = async (userId: string) => {
      if(!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? Cette action supprimera également son profil et ses données associées.")) return;
      try {
          await API.auth.deleteUser(userId);
          fetchGlobalData();
          addNotification({ title: 'Utilisateur supprimé', message: 'Le compte a été retiré de la base.', type: 'info' });
      } catch(e: any) { 
        addNotification({ title: 'Erreur', message: e?.message || "Échec de la suppression.", type: 'alert' }); 
      }
  };

  // ACTIONS CLASSES
  const openClassModal = (cls?: ClassGroup) => {
      if(cls) {
          setClassFormData({ id: cls.id, name: cls.name, email: cls.email });
          setIsEditClassMode(true);
      } else {
          setClassFormData({ id: '', name: '', email: '' });
          setIsEditClassMode(false);
      }
      setIsClassModalOpen(true);
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
          if(isEditClassMode) {
              await API.classes.update(classFormData.id, { name: classFormData.name, email: classFormData.email });
          } else {
              await API.classes.create(classFormData.name, classFormData.email);
          }
          await fetchGlobalData();
          setIsClassModalOpen(false);
          addNotification({ title: 'Succès', message: 'La classe a été enregistrée.', type: 'success' });
      } catch (error: any) {
          addNotification({ title: 'Erreur', message: error?.message || 'Opération échouée.', type: 'alert' });
      } finally { setSubmitting(false); }
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer définitivement la classe "${name}" ? Cette action est irréversible et peut impacter l'accès des étudiants associés.`)) return;
    try {
        await API.classes.delete(id);
        await fetchGlobalData();
        addNotification({ title: 'Classe supprimée', message: 'La classe a été retirée avec succès.', type: 'info' });
    } catch (error: any) {
        addNotification({ title: 'Erreur', message: error?.message || "Impossible de supprimer la classe.", type: 'alert' });
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.className?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in">
      
      {/* SIDEBAR NAVIGATION */}
      <div className="w-full md:w-64 flex-shrink-0 space-y-2">
         <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-soft border border-gray-100 dark:border-gray-700">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Administration</h3>
             <nav className="space-y-1">
                 {[
                   { id: 'dashboard', icon: LayoutDashboard, label: 'Vue Globale' },
                   { id: 'classes', icon: BookOpen, label: 'Gestion Classes' },
                   { id: 'users', icon: Users, label: 'Utilisateurs' },
                   { id: 'ai_config', icon: Bot, label: 'Configuration IA' },
                   { id: 'logs', icon: Activity, label: 'Journal d\'audit' }
                 ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as TabType); setSearchTerm(''); setRoleFilter('ALL'); }} 
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === tab.id ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        <tab.icon size={18} /> {tab.label}
                    </button>
                 ))}
             </nav>
         </div>
         <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-5 text-white shadow-lg">
             <div className="flex items-center gap-2 mb-2">
                 <Shield size={18} className="text-primary-200" />
                 <span className="font-bold text-xs uppercase">Sécurité Active</span>
             </div>
             <p className="text-[10px] opacity-80 leading-relaxed">MDP par défaut : <strong>passer25</strong>.<br/>Note : Pensez à désactiver 'Confirm Email' dans Supabase Auth.</p>
         </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-20">
         
         {loading && !users.length ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-primary-500" size={40} />
            </div>
         ) : (
            <>
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-bold text-gray-400 uppercase">Utilisateurs</p>
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">{dashboardStats.usersCount}</h3>
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-green-500 font-bold uppercase"><CheckCircle size={10} /> Base synchronisée</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-bold text-gray-400 uppercase">Classes</p>
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">{dashboardStats.classesCount}</h3>
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-500 font-bold uppercase"><School size={10} /> ESP Dakar</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-bold text-gray-400 uppercase">Serveur</p>
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Opérationnel</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid lg:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                                <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Users size={18} /> Rôles</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={dashboardStats.rolesData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" animationDuration={1000}>
                                                {dashboardStats.rolesData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '12px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                                <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Activity size={18} /> Logs récents</h3>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto">
                                    {dashboardStats.recentLogs.map(log => (
                                        <div key={log.id} className="text-xs p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600">
                                            <div className="font-bold">{log.action}</div>
                                            <div className="text-gray-400 mt-1">{new Date(log.timestamp).toLocaleString()} • Par {log.actor}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'users' && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-gray-800">
                            <div className="flex flex-col sm:flex-row gap-3 w-full lg:flex-1">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                    <input type="text" placeholder="Recherche nom, mail..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-primary-100" />
                                </div>
                                <div className="relative">
                                    <Filter className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
                                    <select 
                                        value={roleFilter} 
                                        onChange={e => setRoleFilter(e.target.value)}
                                        className="pl-10 pr-8 py-2 bg-white dark:bg-gray-700 border border-gray-200 rounded-lg text-sm outline-none font-bold text-gray-600 dark:text-gray-300 appearance-none transition-all focus:ring-2 focus:ring-primary-100 cursor-pointer"
                                    >
                                        <option value="ALL">Tous les rôles</option>
                                        <option value={UserRole.STUDENT}>Étudiants</option>
                                        <option value={UserRole.DELEGATE}>Délégués</option>
                                        <option value={UserRole.ADMIN}>Administrateurs</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={() => setIsUserModalOpen(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 transition-all hover:-translate-y-0.5 whitespace-nowrap">
                                <UserPlus size={18} /> Créer un compte
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Utilisateur ({filteredUsers.length})</th>
                                        <th className="px-6 py-4">Rôle</th>
                                        <th className="px-6 py-4">Classe</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={u.avatar} className={`w-9 h-9 rounded-full bg-gray-100 ${!u.isActive ? 'grayscale opacity-50' : ''}`} alt="" />
                                                    <div className="min-w-0">
                                                        <p className={`font-bold truncate ${!u.isActive ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>{u.name}</p>
                                                        <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                                    u.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30' : 
                                                    u.role === UserRole.DELEGATE ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/30' : 
                                                    'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30'
                                                }`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">{u.className || '-'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => handleCopyUserDetails(u)} className="p-2 text-gray-400 hover:text-primary-500 transition-colors" title="Copier coordonnées">
                                                        <Copy size={16} />
                                                    </button>
                                                    <button onClick={() => handleOpenEditUser(u)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors" title="Modifier">
                                                        <PenSquare size={16} />
                                                    </button>
                                                    <button onClick={() => handleToggleStatus(u.id)} className={`p-2 rounded-lg transition-colors ${!u.isActive ? 'text-green-500' : 'text-orange-400'}`} title={u.isActive ? 'Désactiver' : 'Réactiver'}>
                                                        {u.isActive ? <Ban size={16} /> : <CheckCircle size={16} />}
                                                    </button>
                                                    <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Supprimer">
                                                        <Trash2 size={16} />
                                                    </button>
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
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800">
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><School size={20} className="text-primary-500" /> Gestion des Classes</h3>
                            <button onClick={() => openClassModal()} className="bg-primary-500 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md">Ajouter une classe</button>
                        </div>
                        <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {classesList.map(cls => (
                                <div key={cls.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600 group relative">
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openClassModal(cls)} className="p-1.5 text-gray-400 hover:text-blue-500"><PenSquare size={14} /></button>
                                        <button onClick={() => handleDeleteClass(cls.id, cls.name)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                    <h4 className="font-bold text-gray-900 dark:text-white">{cls.name}</h4>
                                    <p className="text-xs text-gray-400 mt-1">{cls.email || 'Pas d\'email collectif'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'ai_config' && (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-10 pb-6 border-b border-gray-50 dark:border-gray-700">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-primary-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                            <Bot size={32} />
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight italic">Personnalité de l'Assistant IA</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Configurez le comportement de Gemini pour l'ESP</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activer l'IA</span>
                           <button 
                             onClick={() => setAiSettings({...aiSettings, isActive: !aiSettings.isActive})}
                             className={`w-14 h-7 rounded-full transition-all relative ${aiSettings.isActive ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                           >
                              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${aiSettings.isActive ? 'right-1' : 'left-1'}`}></div>
                           </button>
                        </div>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-8">
                        {/* Tone & Verbosity */}
                        <div className="space-y-8">
                           <div>
                              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Sparkles size={14} className="text-primary-500" /> Ton de la conversation
                              </label>
                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { id: 'friendly', label: 'Amical', icon: MessageSquare },
                                  { id: 'academic', label: 'Académique', icon: GraduationCap },
                                  { id: 'concise', label: 'Concise', icon: Zap },
                                  { id: 'detailed', label: 'Détaillé', icon: Filter }
                                ].map(t => (
                                  <button 
                                    key={t.id}
                                    onClick={() => setAiSettings({...aiSettings, tone: t.id as any})}
                                    className={`flex items-center gap-3 px-5 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                                      aiSettings.tone === t.id 
                                      ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/20' 
                                      : 'border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-gray-500'
                                    }`}
                                  >
                                    <t.icon size={18} /> {t.label}
                                  </button>
                                ))}
                              </div>
                           </div>

                           <div>
                              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Activity size={14} className="text-primary-500" /> Niveau de verbosité
                              </label>
                              <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl">
                                {['low', 'medium', 'high'].map(v => (
                                  <button
                                    key={v}
                                    onClick={() => setAiSettings({...aiSettings, verbosity: v as any})}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                                      aiSettings.verbosity === v 
                                      ? 'bg-white dark:bg-gray-800 text-primary-600 shadow-sm' 
                                      : 'text-gray-400 hover:text-gray-600'
                                    }`}
                                  >
                                    {v === 'low' ? 'Court' : v === 'high' ? 'Long' : 'Moyen'}
                                  </button>
                                ))}
                              </div>
                           </div>
                        </div>

                        {/* Custom Instructions */}
                        <div className="flex flex-col h-full">
                           <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                             <PenSquare size={14} className="text-primary-500" /> Instructions système personnalisées
                           </label>
                           <textarea 
                             rows={8}
                             value={aiSettings.customInstructions}
                             onChange={e => setAiSettings({...aiSettings, customInstructions: e.target.value})}
                             placeholder="Ex: Tu es un assistant spécialisé en scolarité pour le département Informatique..."
                             className="flex-1 w-full px-6 py-5 rounded-[2rem] bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 text-sm font-medium italic outline-none focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 focus:border-primary-500 transition-all resize-none"
                           />
                           <p className="mt-3 text-[9px] text-gray-400 font-bold italic">Ces instructions définissent le rôle de base et les connaissances spécifiques du bot.</p>
                        </div>
                      </div>

                      <div className="mt-12 flex justify-end">
                        <button 
                          onClick={handleSaveAISettings}
                          disabled={submitting}
                          className="flex items-center gap-3 bg-primary-500 hover:bg-primary-600 text-white px-10 py-5 rounded-[2rem] font-black shadow-2xl shadow-primary-500/30 transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-[0.2em] text-xs"
                        >
                          {submitting ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                          Mettre à jour l'Assistant
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'logs' && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-700 font-bold uppercase text-gray-400">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Acteur</th>
                                    <th className="px-6 py-3">Action</th>
                                    <th className="px-6 py-3">Cible</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                        <td className="px-6 py-3 text-gray-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="px-6 py-3 font-bold text-gray-700 dark:text-gray-200">{log.actor}</td>
                                        <td className="px-6 py-3"><span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded uppercase font-bold text-[9px] border border-gray-200 dark:border-gray-600">{log.action}</span></td>
                                        <td className="px-6 py-3 italic text-gray-500 dark:text-gray-400">{log.target}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </>
         )}
      </div>

      {/* CREATE USER MODAL */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Nouveau compte">
         <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-xs uppercase">
                    <Shield size={16} /> Rappels importants
                </div>
                <ul className="text-[10px] text-blue-600 dark:text-blue-400 space-y-1 list-disc pl-4 font-medium">
                    <li>Mot de passe par défaut : <strong>passer25</strong></li>
                    <li>Vérifiez que <strong>'Confirm Email'</strong> est désactivé dans Supabase Auth</li>
                    <li>Vérifiez les politiques <strong>RLS</strong> de la table 'profiles'</li>
                </ul>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nom Complet</label>
                <input required className="w-full p-2.5 rounded-lg border border-gray-300 dark:bg-gray-700 text-sm outline-none dark:text-white" placeholder="Jean Dupont" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email @esp.sn</label>
                <input required type="email" className="w-full p-2.5 rounded-lg border border-gray-300 dark:bg-gray-700 text-sm outline-none dark:text-white" placeholder="jean.dupont@esp.sn" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rôle</label>
                   <select className="w-full p-2.5 rounded-lg border border-gray-300 dark:bg-gray-700 text-sm outline-none dark:text-white" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                       <option value={UserRole.STUDENT}>Étudiant</option>
                       <option value={UserRole.DELEGATE}>Délégué</option>
                       <option value={UserRole.ADMIN}>Administrateur</option>
                   </select>
               </div>
               <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Classe</label>
                   <select className="w-full p-2.5 rounded-lg border border-gray-300 dark:bg-gray-700 text-sm outline-none dark:text-white" value={newUser.className} onChange={e => setNewUser({...newUser, className: e.target.value})}>
                        <option value="">Aucune</option>
                        {classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                   </select>
               </div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-600 flex gap-2">
                <Info size={16} className="text-gray-400 shrink-0" />
                <p className="text-[10px] text-gray-500 leading-tight">Cette action créera un compte Auth et une entrée dans la table Profiles. Aucun mail ne sera envoyé si 'Confirm Email' est OFF.</p>
            </div>

            <button disabled={submitting} type="submit" className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl shadow-lg mt-2 disabled:opacity-50 transition-all hover:bg-primary-600 flex justify-center items-center gap-2">
                {submitting ? <Loader2 className="animate-spin" /> : 'Créer l\'utilisateur'}
            </button>
         </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Modifier le profil">
         {editingUser && (
             <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nom Complet</label>
                    <input required className="w-full p-2.5 rounded-lg border border-gray-300 dark:bg-gray-700 text-sm outline-none dark:text-white" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Etablissement</label>
                    <input className="w-full p-2.5 rounded-lg border border-gray-300 dark:bg-gray-700 text-sm outline-none dark:text-white" value={editingUser.schoolName || 'ESP Dakar'} onChange={e => setEditingUser({...editingUser, schoolName: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rôle</label>
                       <select className="w-full p-2.5 rounded-lg border border-gray-300 dark:bg-gray-700 text-sm outline-none dark:text-white" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}>
                           <option value={UserRole.STUDENT}>Étudiant</option>
                           <option value={UserRole.DELEGATE}>Délégué</option>
                           <option value={UserRole.ADMIN}>Administrateur</option>
                       </select>
                   </div>
                   <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Classe</label>
                       <select className="w-full p-2.5 rounded-lg border border-gray-300 dark:bg-gray-700 text-sm outline-none dark:text-white" value={editingUser.className || ''} onChange={e => setEditingUser({...editingUser, className: e.target.value})}>
                            <option value="">Aucune</option>
                            {classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                       </select>
                   </div>
                </div>
                <button disabled={submitting} type="submit" className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl shadow-lg mt-4 flex items-center justify-center gap-2 hover:bg-primary-600 transition-all">
                    {submitting ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                    Enregistrer les modifications
                </button>
             </form>
         )}
      </Modal>

      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title={isEditClassMode ? "Editer Classe" : "Nouvelle Classe"}>
          <form onSubmit={handleClassSubmit} className="space-y-4">
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nom de la classe</label>
                  <input required className="w-full p-2.5 rounded-lg border border-gray-300 dark:bg-gray-700 text-sm outline-none dark:text-white" value={classFormData.name} onChange={e => setClassFormData({...classFormData, name: e.target.value})} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email groupe</label>
                  <input type="email" className="w-full p-2.5 rounded-lg border border-gray-300 dark:bg-gray-700 text-sm outline-none dark:text-white" value={classFormData.email} onChange={e => setClassFormData({...classFormData, email: e.target.value})} />
              </div>
              <button disabled={submitting} type="submit" className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl mt-2 hover:bg-primary-600 transition-all shadow-md flex justify-center items-center">
                  {submitting ? <Loader2 className="animate-spin" /> : 'Enregistrer'}
              </button>
          </form>
      </Modal>
    </div>
  );
}
