
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppNotification } from '../types';
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

  const triggerBrowserNotification = useCallback((title: string, message: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico' // Optionnel: ajouter un logo ESP si disponible
      });
    }
  }, []);

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
      return;
    }

    fetchNotifications();

    // Souscription temps réel
    const subscription = API.notifications.subscribe(user.id, (payload) => {
      const newNotif = payload.new;
      
      // Vérifier si la notification concerne l'utilisateur
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
    };
  }, [user, fetchNotifications, triggerBrowserNotification]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
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
