
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { AppNotification, Exam } from '../types';
import { useAuth } from './AuthContext';
import { API } from '../services/api';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const notifiedExamsRef = useRef<Set<string>>(new Set());

  const triggerBrowserNotification = useCallback((title: string, message: string, options?: NotificationOptions) => {
    if (Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body: message,
          icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', // Icône générique éducation
          badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
          ...options
        });
        
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch (e) {
        console.warn("Failed to trigger native notification", e);
      }
    }
  }, []);

  const checkImminentExams = useCallback(async () => {
    if (!user) return;
    try {
      const exams = await API.exams.list();
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const imminentExams = exams.filter(exam => {
        const examDate = new Date(exam.date);
        const targetClass = exam.className || 'Général';
        const isForUser = targetClass === 'Général' || targetClass === user.className;
        
        return isForUser && examDate > now && examDate <= tomorrow && !notifiedExamsRef.current.has(exam.id);
      });

      imminentExams.forEach(exam => {
        const timeStr = new Date(exam.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        triggerBrowserNotification(
          "📚 Examen Imminent !",
          `Rappel : Ton épreuve de ${exam.subject} commence demain à ${timeStr} en salle ${exam.room}.`,
          { tag: `exam-${exam.id}` }
        );
        notifiedExamsRef.current.add(exam.id);
      });
    } catch (e) {
      console.warn("Failed to check imminent exams");
    }
  }, [user, triggerBrowserNotification]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const allNotifs = await API.notifications.list();
      setNotifications(allNotifs);
    } catch (e) {
      console.warn("Notification fetch failed");
    }
  }, [user]);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      notifiedExamsRef.current = new Set();
      return;
    }

    fetchNotifications();
    checkImminentExams();

    // Vérification périodique des examens imminents (toutes les heures)
    const examCheckInterval = setInterval(checkImminentExams, 3600000);

    // Souscription temps réel pour les nouvelles annonces/votes/etc
    const subscription = API.notifications.subscribe(user.id, (payload: any) => {
      const newNotif = payload.new;
      
      const isTargeted = 
        !newNotif.target_user_id || newNotif.target_user_id === user.id ||
        newNotif.target_role === user.role ||
        newNotif.target_class === user.className ||
        newNotif.target_class === 'Général';

      if (isTargeted) {
        fetchNotifications();
        triggerBrowserNotification(newNotif.title, newNotif.message);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(examCheckInterval);
    };
  }, [user, fetchNotifications, triggerBrowserNotification, checkImminentExams]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      triggerBrowserNotification("UniConnect ESP", "Les notifications push sont maintenant activées !");
    }
  };

  const addNotification = async (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => {
    await API.notifications.add(notif);
  };

  const markAsRead = async (id: string) => {
    await API.notifications.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = async () => {
    await API.notifications.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearNotifications = async () => {
    await API.notifications.clear();
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      permission,
      requestPermission,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};
