
import { supabase } from './supabaseClient';
import { User, Announcement, Exam, MeetLink, Poll, ClassGroup, ActivityLog, AppNotification, UserRole, ScheduleFile } from '../types';

const handleAPIError = (error: any, fallback: string) => {
  if (!error) return;
  if (error.code === 'PGRST116') return; 
  
  console.error(`[UniConnect API Error] ${fallback}:`, error);
  
  let message = fallback;
  if (error && typeof error === 'object') {
    const errorMsg = error.message || '';
    if (error.code === '23505') message = "Cette donnée existe déjà (doublon détecté).";
    else if (error.code === '42501') message = "Action non autorisée (Sécurité RLS).";
    else if (errorMsg.includes("User already registered")) message = "Cet email est déjà associé à un compte.";
    else message = error.message || fallback;
  }
  throw new Error(message);
};

const mapProfile = (dbProfile: any): User => ({
  id: dbProfile.id,
  name: dbProfile.name,
  email: dbProfile.email,
  role: dbProfile.role as UserRole,
  className: dbProfile.classname || 'Général',
  avatar: dbProfile.avatar,
  schoolName: dbProfile.school_name,
  isActive: dbProfile.is_active,
  themeColor: dbProfile.theme_color
});

export const API = {
  auth: {
    getSession: async (): Promise<User | null> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        return profile ? mapProfile(profile) : null;
      } catch (e) { return null; }
    },

    // Fonctions d'aide à la synchronisation UI/RLS
    canEdit: (user: User | null, item: { user_id?: string, className?: string }): boolean => {
      if (!user) return false;
      if (user.role === UserRole.ADMIN) return true;
      if (user.role === UserRole.DELEGATE) {
        // Un délégué peut modifier son propre contenu
        return item.user_id === user.id;
      }
      return false;
    },

    canDelete: (user: User | null): boolean => {
      if (!user) return false;
      // Strictement réservé aux admins selon RLS
      return user.role === UserRole.ADMIN;
    },

    canPost: (user: User | null): boolean => {
      if (!user) return false;
      return user.role === UserRole.ADMIN || user.role === UserRole.DELEGATE;
    },

    login: async (email: string, pass: string): Promise<User> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) handleAPIError(error, "Identifiants invalides");
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user?.id).single();
      return mapProfile(profile);
    },

    getUsers: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('name');
      if (error) handleAPIError(error, "Chargement des comptes échoué");
      return (data || []).map(mapProfile);
    },

    createUser: async (userData: any) => {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email, 
        password: 'passer25',
        options: { data: { name: userData.name, role: userData.role, className: userData.className || 'Général', school_name: userData.schoolName } }
      });
      if (error) handleAPIError(error, "Inscription impossible");
      return data.user;
    },

    updateProfile: async (id: string, updates: any) => {
      const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().maybeSingle();
      if (error) handleAPIError(error, "Mise à jour échouée");
      return data ? mapProfile(data) : null;
    },

    updatePassword: async (userId: string, newPass: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) handleAPIError(error, "Mise à jour du mot de passe échouée");
    },

    toggleUserStatus: async (userId: string) => {
      const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', userId).maybeSingle();
      const { error } = await supabase.from('profiles').update({ is_active: !profile?.is_active }).eq('id', userId);
      if (error) handleAPIError(error, "Action bloquée");
    },

    deleteUser: async (userId: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) handleAPIError(error, "Suppression impossible");
    }
  },

  announcements: {
    list: async (page: number, size: number): Promise<Announcement[]> => {
      const { data, error } = await supabase.from('announcements').select('*').order('date', { ascending: false }).range(page * size, (page + 1) * size - 1);
      if (error) handleAPIError(error, "Annonces indisponibles");
      return (data || []).map(a => ({ ...a, className: a.classname }));
    },
    create: async (ann: any) => {
      const profile = await API.auth.getSession();
      // On utilise la couleur du thème de l'auteur par défaut pour l'annonce
      const { error, data } = await supabase.from('announcements').insert({ 
        user_id: profile?.id, title: ann.title, content: ann.content, priority: ann.priority, 
        classname: ann.className || 'Général', author: profile?.name, links: ann.links || [], 
        attachments: ann.attachments || [], date: new Date().toISOString(),
        color: profile?.themeColor || '#0ea5e9'
      }).select().single();
      if (error) handleAPIError(error, "Publication échouée");
      return data;
    },
    update: async (id: string, ann: any) => {
      const { error } = await supabase.from('announcements').update({ 
        title: ann.title, content: ann.content, priority: ann.priority, 
        classname: ann.className, links: ann.links || [], attachments: ann.attachments || [] 
      }).eq('id', id);
      if (error) handleAPIError(error, "Mise à jour échouée");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression échouée");
    },
    subscribe: (callback: () => void) => supabase.channel('ann_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, callback).subscribe()
  },

  exams: {
    list: async (): Promise<Exam[]> => {
      const { data, error } = await supabase.from('exams').select('*').order('date', { ascending: true });
      if (error) handleAPIError(error, "Calendrier bloqué");
      return (data || []).map(e => ({ ...e, className: e.classname }));
    },
    create: async (exam: any) => {
      const profile = await API.auth.getSession();
      const { error } = await supabase.from('exams').insert({ 
        user_id: profile?.id, subject: exam.subject, date: exam.date, duration: exam.duration, 
        room: exam.room, notes: exam.notes, classname: exam.className 
      });
      if (error) handleAPIError(error, "Planification échouée");
    },
    update: async (id: string, exam: any) => {
      const { error } = await supabase.from('exams').update({ 
        subject: exam.subject, date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes, 
        classname: exam.className 
      }).eq('id', id);
      if (error) handleAPIError(error, "Modification échouée");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression échouée");
    }
  },

  polls: {
    list: async (): Promise<Poll[]> => {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      const { data: polls, error } = await supabase.from('polls').select('*, poll_options (*), poll_votes (id, option_id, user_id)').order('created_at', { ascending: false });
      if (error) return [];
      return (polls || []).map((p: any) => {
        const userVote = userId ? (p.poll_votes || []).find((v: any) => v.user_id === userId) : null;
        return { 
          id: p.id, user_id: p.user_id, question: p.question, className: p.classname, isActive: p.is_active, createdAt: p.created_at, 
          totalVotes: (p.poll_options || []).reduce((acc: number, opt: any) => acc + (opt.votes || 0), 0), 
          hasVoted: !!userVote, userVoteOptionId: userVote?.option_id, 
          options: (p.poll_options || []).map((o: any) => ({ id: o.id, label: o.label, votes: o.votes || 0 })) 
        };
      });
    },
    create: async (poll: any) => {
      const profile = await API.auth.getSession();
      const { data: newPoll, error: pError } = await supabase.from('polls').insert({ 
        question: poll.question, classname: poll.className || 'Général', user_id: profile?.id 
      }).select().single();
      if (pError) handleAPIError(pError, "Sondage non créé");
      const opts = poll.options.map((opt: any) => ({ poll_id: newPoll.id, label: opt.label, votes: 0 }));
      await supabase.from('poll_options').insert(opts);
    },
    vote: async (pollId: string, optionId: string) => {
      const { error } = await supabase.rpc('cast_poll_vote', { p_poll_id: pollId, p_option_id: optionId });
      if (error) handleAPIError(error, "Vote non enregistré");
    },
    update: async (id: string, updates: any) => {
      const { error } = await supabase.from('polls').update({ is_active: updates.isActive }).eq('id', id);
      if (error) handleAPIError(error, "Statut non mis à jour");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) handleAPIError(error, "Action impossible");
    },
    subscribe: (callback: () => void) => supabase.channel('polls_db').on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, callback).subscribe()
  },

  classes: {
    list: async (): Promise<ClassGroup[]> => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) return [];
      return data.map(c => ({ id: c.id, name: c.name, email: c.email, studentCount: c.student_count, color: c.color }));
    },
    create: async (name: string, email: string, color: string = '#0ea5e9') => { 
      await supabase.from('classes').insert({ name, email, color }); 
    },
    update: async (id: string, updates: any) => { 
      await supabase.from('classes').update(updates).eq('id', id); 
    },
    delete: async (id: string) => { 
      await supabase.from('classes').delete().eq('id', id); 
    }
  },

  notifications: {
    list: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase.from('notifications').select('*').order('timestamp', { ascending: false });
      if (error) return [];
      return (data || []).map(n => ({ id: n.id, title: n.title, message: n.message, type: n.type, timestamp: n.timestamp, isRead: n.is_read, link: n.link }));
    },
    add: async (notif: any) => { await supabase.from('notifications').insert({ title: notif.title, message: notif.message, type: notif.type, target_user_id: notif.targetUserId }); },
    markRead: async (id: string) => { await supabase.from('notifications').update({ is_read: true }).eq('id', id); },
    markAllRead: async () => {
      const session = await supabase.auth.getSession();
      if (session.data.session?.user.id) await supabase.from('notifications').update({ is_read: true }).eq('target_user_id', session.data.session.user.id);
    },
    clear: async () => {
      const session = await supabase.auth.getSession();
      if (session.data.session?.user.id) await supabase.from('notifications').delete().eq('target_user_id', session.data.session.user.id);
    },
    subscribe: (userId: string, callback: (payload: any) => void) => supabase.channel(`notif-${userId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, callback).subscribe()
  },

  schedules: {
    list: async (): Promise<ScheduleFile[]> => {
      const { data, error } = await supabase.from('schedules').select('*').order('upload_date', { ascending: false });
      if (error) return [];
      return (data || []).map(s => ({ id: s.id, user_id: s.user_id, version: s.version, uploadDate: s.upload_date, url: s.url, className: s.classname, category: s.category }));
    },
    create: async (sch: any) => {
      const profile = await API.auth.getSession();
      const { error } = await supabase.from('schedules').insert({ version: sch.version, url: sch.url, classname: sch.className, category: sch.category, user_id: profile?.id });
      if (error) handleAPIError(error, "Fichier non enregistré");
    },
    delete: async (id: string) => { await supabase.from('schedules').delete().eq('id', id); }
  },

  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('*').order('time', { ascending: true });
      if (error) return [];
      return data.map(m => ({ id: m.id, user_id: m.user_id, title: m.title, platform: m.platform, url: m.url, time: m.time, className: m.classname }));
    },
    create: async (meet: any) => {
      const profile = await API.auth.getSession();
      await supabase.from('meet_links').insert({ title: meet.title, platform: meet.platform, url: meet.url, time: meet.time, classname: meet.className, user_id: profile?.id });
    },
    update: async (id: string, meet: any) => { await supabase.from('meet_links').update({ title: meet.title, platform: meet.platform, url: meet.url, time: meet.time, classname: meet.className }).eq('id', id); },
    delete: async (id: string) => { await supabase.from('meet_links').delete().eq('id', id); }
  },

  favorites: {
    toggle: async (contentId: string, contentType: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;
      const { data: existing } = await supabase.from('favorites').select('id').eq('user_id', session.user.id).eq('content_id', contentId).eq('content_type', contentType).maybeSingle();
      if (existing) {
        await supabase.from('favorites').delete().eq('id', existing.id);
        return false;
      } else {
        await supabase.from('favorites').insert({ user_id: session.user.id, content_id: contentId, content_type: contentType });
        return true;
      }
    },
    list: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];
      const { data } = await supabase.from('favorites').select('*').eq('user_id', session.user.id);
      return data || [];
    }
  },

  interactions: {
    incrementShare: async (table: string, id: string) => {
      try { await supabase.rpc('increment_share_count', { target_table: table, target_id: id }); } catch (e) {}
    }
  },

  logs: {
    list: async (): Promise<ActivityLog[]> => {
      const { data } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(50);
      return data || [];
    }
  },

  settings: {
    getAI: async () => {
      try {
        const { data } = await supabase.from('ai_settings').select('*').maybeSingle();
        return {
          isActive: data?.is_active ?? true,
          verbosity: data?.verbosity ?? 'medium',
          tone: data?.tone ?? 'balanced',
          customInstructions: data?.custom_instructions ?? "Tu es l'assistant IA officiel d'UniConnect."
        };
      } catch (e) {
        return { isActive: true, verbosity: 'medium', tone: 'balanced', customInstructions: "Assistant UniConnect." };
      }
    }
  }
};
