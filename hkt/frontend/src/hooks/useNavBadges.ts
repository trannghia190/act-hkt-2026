import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_BADGES } from '../config/sidebar.config';

export function useNavBadges() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Record<string, number>>(DEFAULT_BADGES);

  useEffect(() => {
    let isMounted = true;

    async function fetchBadges() {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (user?.accessToken) {
        headers['Authorization'] = `Bearer ${user.accessToken}`;
      }

      // 1. Fetch Todo count from /api/v1/todos/my-inbox
      try {
        const res = await fetch('/api/v1/todos/my-inbox', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            // Count pending uncompleted items
            const uncompleted = json.data.filter((item: any) => !item.completed && !item.isCompleted);
            const todoCount = uncompleted.length > 0 ? uncompleted.length : json.data.length;
            if (isMounted) {
              setBadges((prev) => ({ ...prev, todo: todoCount }));
            }
          }
        }
      } catch (e) {
        // Fallback to default
      }

      // 2. Fetch Notification unread count from /api/v1/notifications
      try {
        const res = await fetch('/api/v1/notifications', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const unread = json.data.filter((n: any) => !n.read).length;
            if (isMounted) {
              setBadges((prev) => ({ ...prev, notif: unread }));
            }
          }
        }
      } catch (e) {
        // Fallback to default
      }
    }

    fetchBadges();

    // Listen to real-time custom events from /todo and notification actions
    const handleTodoUpdated = (e: any) => {
      if (e?.detail?.count !== undefined && isMounted) {
        setBadges((prev) => ({ ...prev, todo: Number(e.detail.count) }));
      }
    };

    window.addEventListener('act_todo_updated', handleTodoUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('act_todo_updated', handleTodoUpdated);
    };
  }, [user]);

  return badges;
}
