
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { 
  Users, BookOpen, UserPlus, Search, Loader2, School, 
  Plus, Trash2, LayoutDashboard, Shield, 
  Ban, CheckCircle, PenSquare, Activity, Copy, Save, AlertCircle, Info, Filter, GraduationCap
} from 'lucide-react';
import { UserRole, ClassGroup, ActivityLog, User } from '../types';
import Modal from '../components/Modal';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

type TabType = 'dashboard' | 'users' | 'classes' | 'logs';

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.fullName || !newUser.email) {
      addNotification({ title: 'Données manquantes', message: 'Remplissez tous les champs.', type: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      await API.auth.createUser({
        name: newUser.fullName, email: newUser.email, role: newUser.role,
        className: newUser.className, schoolName: newUser.schoolName
      });
      await fetchGlobalData();
      setIsUserModalOpen(false);
      setNewUser({ fullName: '', email: '', role: UserRole.STUDENT, className: '', schoolName: 'ESP Dakar' });
      addNotification({ title: 'Compte créé', message: 'Utilisable avec MDP : passer25', type: 'success' });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error?.message || "Impossible de créer.", type: 'alert' });
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
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error?.message || 'Échec.', type: 'alert' });
    } finally { setSubmitting(false); }
  };

  const handleCopyUserDetails = (u: User) => {
    const text = `UniConnect ESP Dakar\nNom: ${u.name}\nEmail: ${u.email}\nMot de passe: passer25\nRôle: ${u.role}\nClasse: ${u.className || 'N/A'}`;
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Copié', message: 'Coordonnées copiées.', type: 'success' });
    });
  };

  const handleToggleStatus = async (userId: string) => {
      if(!window.confirm("Changer le statut d'accès ?")) return;
      try {
          await API.auth.toggleUserStatus(userId);
          fetchGlobalData();
          addNotification({ title: 'Statut mis à jour', message: 'Succès.', type: 'info' });
      } catch(e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  const handleDeleteUser = async (userId: string) => {
      if(!window.confirm("Supprimer définitivement ?")) return;
      try {
          await API.auth.deleteUser(userId);
          fetchGlobalData();
          addNotification({ title: 'Supprimé', message: 'Compte retiré.', type: 'info' });
      } catch(e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  const handleDeleteClass = async (id: string, name: string) => {
      if(!window.confirm(`Supprimer la classe ${name} ?`)) return;
      try {
          await API.classes.delete(id);
          await fetchGlobalData();
          addNotification({ title: 'Supprimé', message: 'Classe retirée.', type: 'info' });
      } catch(e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

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
          if(isEditClassMode) await API.classes.update(classFormData.id, { name: classFormData.name, email: classFormData.email });
          else await API.classes.create(classFormData.name, classFormData.email);
          await fetchGlobalData();
          setIsClassModalOpen(false);
          addNotification({ title: 'Succès', message: 'Classe enregistrée.', type: 'success' });
      } catch (error: any) { addNotification({ title: 'Erreur', message: error?.message, type: 'alert' }); }
      finally { setSubmitting(false); }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in">
      <div className="w-full md:w-64 flex-shrink-0 space-y-2">
         <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-soft border border-gray-100 dark:border-gray-700">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Administration</h3>
             <nav className="space-y-1">
                 {[
                   { id: 'dashboard', icon: LayoutDashboard, label: 'Vue Globale' },
                   { id: 'classes', icon: BookOpen, label: 'Gestion Classes' },
                   { id: 'users', icon: Users, label: 'Utilisateurs' },
                   { id: 'logs', icon: Activity, label: 'Journal d\'audit' }
                 ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)} 
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === tab.id ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}
                    >
                        <tab.icon size={18} /> {tab.label}
                    </button>
                 ))}
             </nav>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-20">
         {loading && !users.length ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary-500" size={40} /></div>
         ) : (
            <>
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-bold text-gray-400 uppercase">Utilisateurs</p>
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">{dashboardStats.usersCount}</h3>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-bold text-gray-400 uppercase">Classes</p>
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white mt-1">{dashboardStats.classesCount}</h3>
                            </div>
                        </div>
                        <div className="grid lg:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700">
                                <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Users size={18} /> Rôles</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={dashboardStats.rolesData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {dashboardStats.rolesData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend verticalAlign="bottom" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'users' && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-center gap-4">
                            <div className="flex flex-col sm:flex-row gap-3 w-full lg:flex-1">
                                <input type="text" placeholder="Recherche..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg text-sm" />
                                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg text-sm">
                                    <option value="ALL">Tous</option>
                                    <option value={UserRole.STUDENT}>Étudiants</option>
                                    <option value={UserRole.DELEGATE}>Délégués</option>
                                    <option value={UserRole.ADMIN}>Admins</option>
                                </select>
                            </div>
                            <button onClick={() => setIsUserModalOpen(true)} className="bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm">Créer un compte</button>
                        </div>
                        <table className="w-full text-left text-sm">
                            <tbody className="divide-y divide-gray-100">
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-bold">{u.name}</td>
                                        <td className="px-6 py-4"><span className="text-[10px] font-bold uppercase">{u.role}</span></td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleOpenEditUser(u)} className="p-2 text-gray-400 hover:text-blue-500"><PenSquare size={16} /></button>
                                            <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'classes' && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700 p-6">
                        <div className="flex justify-between mb-6">
                            <h3 className="font-bold">Classes</h3>
                            <button onClick={() => openClassModal()} className="bg-primary-500 text-white px-4 py-2 rounded-lg text-xs font-bold">Ajouter</button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {classesList.map(cls => (
                                <div key={cls.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border flex justify-between items-center">
                                    <span className="font-bold">{cls.name}</span>
                                    <button onClick={() => handleDeleteClass(cls.id, cls.name)} className="text-red-500"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
         )}
      </div>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Nouveau compte">
         <form onSubmit={handleCreateUser} className="space-y-4">
            <input required className="w-full p-2.5 rounded-lg border dark:bg-gray-700" placeholder="Nom Complet" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
            <input required type="email" className="w-full p-2.5 rounded-lg border dark:bg-gray-700" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
            <select className="w-full p-2.5 rounded-lg border dark:bg-gray-700" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                <option value={UserRole.STUDENT}>Étudiant</option>
                <option value={UserRole.DELEGATE}>Délégué</option>
                <option value={UserRole.ADMIN}>Administrateur</option>
            </select>
            <select className="w-full p-2.5 rounded-lg border dark:bg-gray-700" value={newUser.className} onChange={e => setNewUser({...newUser, className: e.target.value})}>
                 <option value="">Classe...</option>
                 {classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <button disabled={submitting} type="submit" className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl">Créer</button>
         </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Modifier profil">
         {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4">
                <input required className="w-full p-2.5 rounded-lg border dark:bg-gray-700" placeholder="Nom Complet" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                <select className="w-full p-2.5 rounded-lg border dark:bg-gray-700" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}>
                    <option value={UserRole.STUDENT}>Étudiant</option>
                    <option value={UserRole.DELEGATE}>Délégué</option>
                    <option value={UserRole.ADMIN}>Administrateur</option>
                </select>
                <select className="w-full p-2.5 rounded-lg border dark:bg-gray-700" value={editingUser.className} onChange={e => setEditingUser({...editingUser, className: e.target.value})}>
                    <option value="">Classe...</option>
                    {classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <div className="flex gap-2">
                    <button type="button" onClick={() => handleCopyUserDetails(editingUser)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Copy size={16}/> Copier accès</button>
                    <button type="button" onClick={() => handleToggleStatus(editingUser.id)} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${editingUser.isActive ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {editingUser.isActive ? <Ban size={16}/> : <CheckCircle size={16}/>} {editingUser.isActive ? 'Bloquer' : 'Activer'}
                    </button>
                </div>
                <button disabled={submitting} type="submit" className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Enregistrer
                </button>
            </form>
         )}
      </Modal>

      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title={isEditClassMode ? "Modifier la classe" : "Ajouter une classe"}>
         <form onSubmit={handleClassSubmit} className="space-y-4">
            <input required className="w-full p-2.5 rounded-lg border dark:bg-gray-700" placeholder="Nom de la classe (ex: Licence 3 INFO)" value={classFormData.name} onChange={e => setClassFormData({...classFormData, name: e.target.value})} />
            <input type="email" className="w-full p-2.5 rounded-lg border dark:bg-gray-700" placeholder="Email de contact (optionnel)" value={classFormData.email} onChange={e => setClassFormData({...classFormData, email: e.target.value})} />
            <button disabled={submitting} type="submit" className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl">
                {submitting ? <Loader2 className="animate-spin" size={18}/> : (isEditClassMode ? "Modifier" : "Créer la classe")}
            </button>
         </form>
      </Modal>
    </div>
  );
}
