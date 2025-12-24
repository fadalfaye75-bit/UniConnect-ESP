
import { supabase } from './supabaseClient';
import { User, Announcement, Exam, MeetLink, Poll, ClassGroup, ActivityLog, AppNotification, UserRole, ScheduleFile } from '../types';

const handleAPIError = (error: any, fallback: string) => {
  if (!error) return;
  if (error.code === 'PGRST116') return; 
  
  console.error(`[UniConnect API Error] ${fallback}:`, error);
  
  let message = fallback;
  if (error && typeof error === 'object') {
    if (error.code === '23505') message = "Cette action a déjà été effectuée.";
    else if (error.code === '42710' || error.code === '42P17') message = "Erreur de permission système (RLS).";
    else if (error.code === '23514') message = "Donnée invalide pour le journal système.";
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
  // Fix: Use schoolName (PascalCase/camelCase) to match the User interface in types.ts
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
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (error || !profile) return null;
        return mapProfile(profile);
      } catch { return null; }
    },
    login: async (email: string, pass: string): Promise<User> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) handleAPIError(error, "Identifiants invalides");
      const { data: profile, error: pError } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
      if (pError || !profile) throw new Error("Profil étudiant introuvable.");
      return mapProfile(profile);
    },
    updateProfile: async (id: string, updates: Partial<User>): Promise<User> => {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.className) dbUpdates.classname = updates.className;
      if (updates.schoolName) dbUpdates.school_name = updates.schoolName;
      if (updates.avatar) dbUpdates.avatar = updates.avatar;
      if (updates.themeColor) dbUpdates.theme_color = updates.themeColor;
      
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().maybeSingle();
      if (error || !data) handleAPIError(error, "Mise à jour échouée");
      return mapProfile(data);
    },
    updatePassword: async (userId: string, newPass: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) handleAPIError(error, "Mise à jour du mot de passe échouée");
    },
    getUsers: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('name');
      if (error) handleAPIError(error, "Chargement des comptes échoué");
      return (data || []).map(mapProfile);
    },
    createUser: async (userData: any) => {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email, password: 'passer25',
        options: { 
          data: { 
            name: userData.name, 
            role: userData.role, 
            className: userData.className || 'Général', 
            school_name: userData.schoolName 
          } 
        }
      });
      if (error) handleAPIError(error, "Inscription impossible");
      return data.user;
    },
    toggleUserStatus: async (userId: string) => {
      const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', userId).maybeSingle();
      const { error } = await supabase.from('profiles').update({ is_active: !profile?.is_active }).eq('id', userId);
      if (error) handleAPIError(error, "Action bloquée");
    },
    deleteUser: async (userId: string) => {
      const { error } = await supabase.auth.deleteUser(userId);
      if (error) handleAPIError(error, "Suppression impossible");
    }
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
      const { data, error } = await supabase.from('favorites').select('*').eq('user_id', session.user.id);
      if (error) return [];
      return data;
    }
  },
  interactions: {
    incrementShare: async (table: string, id: string) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        await supabase.rpc('increment_share_count', { target_table: table, target_id: id });
      } catch (e) { console.warn("Share increment skipped", e); }
    }
  },
  announcements: {
    list: async (page: number, size: number): Promise<Announcement[]> => {
      const { data, error } = await supabase.from('announcements').select('*').order('date', { ascending: false }).range(page * size, (page + 1) * size - 1);
      if (error) handleAPIError(error, "Flux d'annonces indisponible");
      return (data || []).map(a => ({ ...a, className: a.classname }));
    },
    create: async (ann: any) => {
      const profile = await API.auth.getSession();
      if (!profile) throw new Error("Non autorisé");
      const { error, data } = await supabase.from('announcements').insert({ 
        user_id: profile.id, title: ann.title, content: ann.content, priority: ann.priority, 
        classname: ann.className || 'Général', author: profile.name, links: ann.links || [], 
        attachments: ann.attachments || [], date: new Date().toISOString() 
      }).select().single();
      if (error) handleAPIError(error, "Publication échouée");
      return data;
    },
    update: async (id: string, ann: any) => {
      const { error } = await supabase.from('announcements').update({ title: ann.title, content: ann.content, priority: ann.priority, classname: ann.className, links: ann.links || [], attachments: ann.attachments || [] }).eq('id', id);
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
      if (error) handleAPIError(error, "Calendrier d'examens bloqué");
      return (data || []).map(e => ({ ...e, className: e.classname }));
    },
    create: async (exam: any) => {
      const { error } = await supabase.from('exams').insert({ user_id: (await supabase.auth.getSession()).data.session?.user.id, subject: exam.subject, date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes, classname: exam.className });
      if (error) handleAPIError(error, "Planification échouée");
    },
    update: async (id: string, exam: any) => {
      const { error } = await supabase.from('exams').update({ subject: exam.subject, date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes }).eq('id', id);
      if (error) handleAPIError(error, "Modification échouée");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression échouée");
    }
  },
  polls: {
    list: async (): Promise<Poll[]> => {
      const userId = (await supabase.auth.getSession()).data.session?.user.id;
      const { data: polls, error } = await supabase.from('polls').select('*, poll_options (*), poll_votes (id, option_id, user_id)').order('created_at', { ascending: false });
      if (error) return [];
      return polls.map((p: any) => {
        const userVote = userId ? p.poll_votes.find((v: any) => v.user_id === userId) : null;
        return { 
          id: p.id, user_id: p.user_id, question: p.question, className: p.classname, isActive: p.is_active, createdAt: p.created_at, 
          totalVotes: p.poll_options.reduce((acc: number, opt: any) => acc + (opt.votes || 0), 0), 
          hasVoted: !!userVote, userVoteOptionId: userVote?.option_id, 
          options: p.poll_options.map((o: any) => ({ id: o.id, label: o.label, votes: o.votes || 0 })) 
        };
      });
    },
    create: async (poll: any) => {
      const { data: newPoll, error: pError } = await supabase.from('polls').insert({ question: poll.question, classname: poll.className || 'Général', user_id: (await supabase.auth.getSession()).data.session?.user.id }).select().single();
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
      return data.map(c => ({ id: c.id, name: c.name, email: c.email, studentCount: c.student_count }));
    },
    create: async (name: string, email: string) => { await supabase.from('classes').insert({ name, email }); },
    update: async (id: string, updates: { name?: string, email?: string }) => {
      const { error } = await supabase.from('classes').update(updates).eq('id', id);
      if (error) handleAPIError(error, "Mise à jour de la classe échouée");
    },
    delete: async (id: string) => { await supabase.from('classes').delete().eq('id', id); }
  },
  notifications: {
    list: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase.from('notifications').select('*').order('timestamp', { ascending: false });
      if (error) return [];
      return (data || []).map(n => ({ id: n.id, title: n.title, message: n.message, type: n.type, timestamp: n.timestamp, isRead: n.is_read, link: n.link }));
    },
    add: async (notif: any) => {
      await supabase.from('notifications').insert({ title: notif.title, message: notif.message, type: notif.type, target_user_id: notif.targetUserId });
    },
    markRead: async (id: string) => { await supabase.from('notifications').update({ is_read: true }).eq('id', id); },
    markAllRead: async () => {
      const userId = (await supabase.auth.getSession()).data.session?.user.id;
      if (userId) await supabase.from('notifications').update({ is_read: true }).eq('target_user_id', userId);
    },
    clear: async () => {
      const userId = (await supabase.auth.getSession()).data.session?.user.id;
      if (userId) await supabase.from('notifications').delete().eq('target_user_id', userId);
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
      const { error } = await supabase.from('schedules').insert({ version: sch.version, url: sch.url, classname: sch.className, category: sch.category, user_id: (await supabase.auth.getSession()).data.session?.user.id });
      if (error) handleAPIError(error, "Fichier non enregistré");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) handleAPIError(error, "Action échouée");
    }
  },
  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('*').order('time', { ascending: true });
      if (error) return [];
      return data.map(m => ({ id: m.id, user_id: m.user_id, title: m.title, platform: m.platform, url: m.url, time: m.time, className: m.classname }));
    },
    create: async (meet: any) => { await supabase.from('meet_links').insert({ title: meet.title, platform: meet.platform, url: meet.url, time: meet.time, classname: meet.className, user_id: (await supabase.auth.getSession()).data.session?.user.id }); },
    update: async (id: string, meet: any) => { await supabase.from('meet_links').update({ title: meet.title, platform: meet.platform, url: meet.url, time: meet.time, classname: meet.className }).eq('id', id); },
    delete: async (id: string) => { await supabase.from('meet_links').delete().eq('id', id); }
  },
  storage: {
    upload: async (bucket: string, file: File): Promise<string> => {
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from(bucket).upload(fileName, file);
      if (error) handleAPIError(error, "Upload Storage échoué");
      return supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
    }
  },
  logs: {
    list: async (): Promise<ActivityLog[]> => {
      const { data } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(50);
      return data || [];
    }
  },
  // Fix: Added missing settings service to the API object to handle AI configuration
  settings: {
    getAI: async () => {
      // Mocking AI settings as no specific table was provided in the schema, ensuring feature stability with defaults
      return {
        isActive: true,
        verbosity: 'balanced',
        tone: 'friendly',
        customInstructions: "Tu es l'assistant UniConnect de l'ESP Dakar. Ton rôle est d'aider les étudiants avec leur planning, les cours et les examens."
      };
    }
  }
};
