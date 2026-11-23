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
            // Badge "Check-in" = còn việc chấm công hôm nay chưa làm (S22 / B1)
            const checkinPending = uncompleted.some(
              (item: any) => String(item.kind || '').includes('CHECKIN') || item.module === 'timesheet'
            );
            if (isMounted) {
              setBadges((prev) => ({ ...prev, todo: todoCount, checkin: checkinPending ? 1 : 0 }));
            }
          }
        }
      } catch (e) {
        // Fallback to default
      }

      // 2. Chỉ lấy số chưa đọc — không tải cả hộp thư chỉ để đếm badge.
      try {
        const res = await fetch('/api/v1/notifications/unread-count', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && typeof json.data?.count === 'number') {
            const unread = json.data.count;
            if (isMounted) {
              setBadges((prev) => ({ ...prev, notif: unread }));
            }
          }
        }
      } catch (e) {
        // Fallback to default
      }

      // 3. Fetch Approvals count from /api/v1/todos/approvals
      try {
        const res = await fetch('/api/v1/todos/approvals', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            if (isMounted) {
              setBadges((prev) => ({ ...prev, approve: json.data.length }));
            }
          }
        }
      } catch (e) {}

      // 4. Fetch Requests count from /api/v1/requests/my-requests
      try {
        const res = await fetch('/api/v1/requests/my-requests', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const pendingReqs = json.data.filter((r: any) => r.status === 'PENDING_APPROVAL' || r.status === 'SUBMITTED').length;
            if (isMounted) {
              setBadges((prev) => ({ ...prev, reqs: pendingReqs }));
            }
          }
        }
      } catch (e) {}

      // 5. Fetch Disputes count from /api/v1/disputes
      try {
        const res = await fetch('/api/v1/disputes', { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const pendingDisputes = json.data.filter((d: any) => d.status === 'PENDING').length;
            if (isMounted) {
              setBadges((prev) => ({ ...prev, dispute: pendingDisputes }));
            }
          }
        }
      } catch (e) {}
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
