
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseKey } from './supabaseClient';
import { User, UserRole, Announcement, Exam, ClassGroup, ActivityLog, AppNotification, Poll, MeetLink, ScheduleFile, AISettings } from '../types';

const getInitialsAvatar = (name: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'User')}&backgroundColor=0ea5e9,0284c7,0369a1,075985,38bdf8&chars=2`;

const mapProfileToUser = (p: any): User => ({
  id: p.id,
  name: p.full_name || 'Utilisateur',
  email: p.email || '',
  role: (p.role ? p.role.toUpperCase() : UserRole.STUDENT) as UserRole,
  className: p.classname || '', 
  schoolName: p.school_name || 'ESP Dakar',
  avatar: p.avatar_url || getInitialsAvatar(p.full_name || 'User'),
  isActive: p.is_active !== false
});

const mapAnnouncement = (a: any): Announcement => {
  const priority = a.priority || 'normal';
  return {
    id: a.id,
    title: a.title,
    content: a.content || '',
    author: a.author_name || 'Anonyme',
    date: a.created_at || new Date().toISOString(),
    className: a.classname || 'Général',
    priority: priority as any,
    isImportant: priority === 'important' || priority === 'urgent',
    attachments: a.attachments || [],
    links: [] 
  };
};

export const API = {
  auth: {
    login: async (email: string, password: string): Promise<User> => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email: email.trim().toLowerCase(), 
        password 
      });
      
      if (authError) throw new Error(authError.message || "Identifiants invalides.");
      if (!authData.user) throw new Error("Authentification réussie mais utilisateur non trouvé.");

      const { data: profile, error: fetchError } = await supabase.from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();
        
      if (fetchError) throw new Error(`Erreur lors de la récupération du profil: ${fetchError.message}`);
      if (!profile) throw new Error("Profil non trouvé. Veuillez contacter l'administrateur.");
      
      return mapProfileToUser(profile);
    },

    getSession: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      
      const { data: profile } = await supabase.from('profiles')
        .select('*')
        .eq('id', session.user.id).maybeSingle();
      
      return profile ? mapProfileToUser(profile) : null;
    },

    getUsers: async (page = 0, limit = 50): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles')
        .select('*')
        .order('full_name')
        .range(page * limit, (page + 1) * limit - 1);
      if (error) return [];
      return (data || []).map(mapProfileToUser);
    },

    updateProfile: async (id: string, updates: Partial<User>) => {
      const dbUpdates: any = {};
      if (updates.name) {
        dbUpdates.full_name = updates.name;
        if (!updates.avatar) dbUpdates.avatar_url = getInitialsAvatar(updates.name);
      }
      if (updates.role) dbUpdates.role = updates.role.toLowerCase();
      if (updates.className !== undefined) dbUpdates.classname = updates.className;
      if (updates.schoolName !== undefined) dbUpdates.school_name = updates.schoolName;
      if (updates.avatar) dbUpdates.avatar_url = updates.avatar;
      
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return data ? mapProfileToUser(data) : null;
    },

    createUser: async (user: any) => {
      const tempClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      const { data, error } = await tempClient.auth.signUp({ 
        email: user.email.trim().toLowerCase(), 
        password: 'passer25',
        options: { data: { full_name: user.name, role: user.role.toLowerCase() } }
      });
      if (error) throw error;
      if (data.user) {
          await supabase.from('profiles').upsert({
              id: data.user.id, full_name: user.name, email: user.email.trim().toLowerCase(),
              role: user.role.toLowerCase(), classname: user.className || '',
              is_active: true, avatar_url: getInitialsAvatar(user.name)
          });
      }
      return data;
    },

    logout: async () => { 
        await supabase.signOut(); 
    },
    
    toggleUserStatus: async (userId: string) => {
      const { data: p } = await supabase.from('profiles').select('is_active').eq('id', userId).single();
      await supabase.from('profiles').update({ is_active: !p?.is_active }).eq('id', userId);
    },

    deleteUser: async (userId: string) => {
      await supabase.from('profiles').delete().eq('id', userId);
    },

    updatePassword: async (id: string, pass: string) => {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
    }
  },

  settings: {
    getAI: async (): Promise<AISettings> => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'ai_config').maybeSingle();
      if (error || !data) {
        return {
          tone: 'friendly',
          verbosity: 'medium',
          customInstructions: "Tu es un assistant universitaire intelligent pour l'ESP de Dakar.",
          isActive: true
        };
      }
      return data.value;
    },
    updateAI: async (settings: AISettings) => {
      const { error } = await supabase.from('app_settings').upsert({ key: 'ai_config', value: settings });
      if (error) throw error;
    }
  },

  announcements: {
    list: async (page = 0, limit = 20): Promise<Announcement[]> => {
      const { data, error } = await supabase.from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);
      
      if (error) return [];
      return (data || []).map(mapAnnouncement);
    },
    subscribe: (callback: () => void) => {
      return supabase
        .channel('public:announcements')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, callback)
        .subscribe();
    },
    create: async (ann: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single();
      const { data, error } = await supabase.from('announcements').insert({
        title: ann.title, content: ann.content, priority: ann.priority,
        classname: ann.className || 'Général', author_id: user?.id, author_name: profile?.full_name || 'Admin'
      }).select().single();
      if (error) throw error;
      return mapAnnouncement(data);
    },
    delete: async (id: string) => { await supabase.from('announcements').delete().eq('id', id); }
  },

  polls: {
    list: async (): Promise<Poll[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // On récupère explicitement created_at pour le tri
      const { data: polls, error } = await supabase.from('polls')
        .select('*, poll_options(id, label, votes)')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Erreur API Polls:", error);
        return [];
      }
      
      if (!polls) return [];
      
      let userVotes: any[] = [];
      if (user) {
        const { data } = await supabase.from('poll_votes').select('poll_id, option_id').eq('user_id', user.id);
        userVotes = data || [];
      }

      return polls.map(p => {
        const options = (p.poll_options || []).map((o: any) => ({ id: o.id, label: o.label, votes: o.votes || 0 }));
        const userVote = userVotes.find(v => v.poll_id === p.id);
        return {
          id: p.id, 
          question: p.question, 
          className: p.classname || 'Général', 
          isActive: p.is_active,
          startTime: p.start_time, 
          endTime: p.end_time,
          createdAt: p.created_at, // Ajout de created_at
          options, 
          totalVotes: options.reduce((acc: number, o: any) => acc + o.votes, 0),
          hasVoted: !!userVote, 
          userVoteOptionId: userVote?.option_id
        };
      });
    },
    subscribe: (callback: () => void) => {
      return supabase
        .channel('public:polls_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, callback)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options' }, callback)
        .subscribe();
    },
    vote: async (pollId: string, optionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('poll_votes').upsert({ 
        poll_id: pollId, user_id: user.id, option_id: optionId 
      }, { onConflict: 'poll_id,user_id' });
      if (error) throw error;
    },
    create: async (p: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vous devez être connecté.");

      const { data: poll, error: pollErr } = await supabase.from('polls').insert({
          question: p.question, 
          classname: p.className || 'Général', 
          is_active: true, 
          start_time: p.startTime || null,
          end_time: p.endTime || null,
          creator_id: user.id
      }).select().single();
      
      if (pollErr) throw new Error(`Erreur création sondage: ${pollErr.message}`);
      if (!poll) throw new Error("Le sondage n'a pas pu être créé.");

      const options = p.options.map((o: any) => ({ 
        poll_id: poll.id, 
        label: o.label, 
        votes: 0 
      }));

      const { error: optionsErr } = await supabase.from('poll_options').insert(options);
      
      if (optionsErr) {
        await supabase.from('polls').delete().eq('id', poll.id);
        throw new Error(`Erreur création options: ${optionsErr.message}`);
      }

      return poll;
    },
    toggleStatus: async (id: string) => {
      const { data: p } = await supabase.from('polls').select('is_active').eq('id', id).single();
      await supabase.from('polls').update({ is_active: !p?.is_active }).eq('id', id);
    },
    delete: async (id: string) => { await supabase.from('polls').delete().eq('id', id); }
  },

  exams: {
    list: async (): Promise<Exam[]> => {
      const { data, error } = await supabase.from('exams').select('*').order('exam_date', { ascending: true });
      if (error) return [];
      return data.map(e => ({
        id: e.id, subject: e.subject, date: e.exam_date, duration: e.duration, room: e.room, notes: e.notes, className: e.classname || ''
      }));
    },
    create: async (exam: any) => {
      const { data, error } = await supabase.from('exams').insert({
        subject: exam.subject, exam_date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes, classname: exam.className
      }).select().single();
      if (error) throw error;
      return { ...exam, id: data.id };
    },
    update: async (id: string, exam: any) => {
      const { data, error } = await supabase.from('exams').update({
        subject: exam.subject, exam_date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes
      }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => { await supabase.from('exams').delete().eq('id', id); }
  },

  classes: {
    list: async (): Promise<ClassGroup[]> => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) return [];
      return data.map(c => ({ id: c.id, name: c.name, email: c.email || '', studentCount: 0 }));
    },
    create: async (name: string, email: string) => { await supabase.from('classes').insert({ name, email }); },
    update: async (id: string, updates: { name: string, email: string }) => {
      const { error } = await supabase.from('classes').update({ name: updates.name, email: updates.email }).eq('id', id);
      if (error) throw error;
    },
    delete: async (id: string) => { await supabase.from('classes').delete().eq('id', id); }
  },

  notifications: {
    list: async (limit = 50): Promise<AppNotification[]> => {
      const { data: { user } } = await supabase.auth.getSession();
      if (!user) return [];
      const { data } = await supabase.from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      return (data || []).map(n => ({ 
        id: n.id, title: n.title, message: n.message, type: n.type as any, timestamp: n.created_at, isRead: n.is_read 
      }));
    },
    subscribe: (userId: string, callback: () => void) => {
      return supabase
        .channel(`public:notifications:${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, callback)
        .subscribe();
    },
    add: async (notif: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('notifications').insert({
        title: notif.title,
        message: notif.message,
        type: notif.type,
        user_id: user.id,
        is_read: false
      });
      if (error) throw error;
    },
    markRead: async (id: string) => { await supabase.from('notifications').update({ is_read: true }).eq('id', id); },
    markAllRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id);
    },
    clear: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('notifications').delete().eq('user_id', user?.id);
    }
  },

  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('*');
      if (error) return [];
      return data.map(m => ({ id: m.id, title: m.title, platform: m.platform as any, url: m.url, time: m.time, className: m.classname }));
    },
    create: async (m: any) => {
      const { data, error } = await supabase.from('meet_links').insert({
        title: m.title, platform: m.platform, url: m.url, time: m.time, classname: m.className
      }).select().single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, m: any) => {
      const { data, error } = await supabase.from('meet_links').update({
        title: m.title, platform: m.platform, url: m.url, time: m.time
      }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => { await supabase.from('meet_links').delete().eq('id', id); }
  },

  schedules: {
    list: async (limit = 10): Promise<ScheduleFile[]> => {
      const { data, error } = await supabase.from('schedules').select('*').order('upload_date', { ascending: false }).limit(limit);
      if (error) return [];
      return data.map(s => ({ id: s.id, version: s.version, uploadDate: s.upload_date, url: s.url, className: s.classname }));
    },
    create: async (sch: any) => {
      const { data, error } = await supabase.from('schedules').insert({
        version: sch.version, url: sch.url, classname: sch.className
      }).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => { await supabase.from('schedules').delete().eq('id', id); }
  },

  logs: {
    list: async (page = 0, limit = 50): Promise<ActivityLog[]> => {
      const { data } = await supabase.from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);
      return (data || []).map(l => ({ id: l.id, actor: l.actor, action: l.action, target: l.target, type: l.type as any, timestamp: l.created_at }));
    }
  }
};
