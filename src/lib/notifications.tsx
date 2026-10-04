import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { toast } from 'react-hot-toast';
import { supabase } from './supabase';

// Cool campus reminder messages
const CAMPUS_REMINDERS = [
  {
    title: '⚡ RoCAR Fleet Online',
    body: 'Need something fetched from the lab or library? Send a cart in 1 tap!',
  },
  {
    title: '🎒 Skip the campus walk!',
    body: 'RoCAR is parked and ready. Dispatch packages across campus in minutes.',
  },
  {
    title: '🤖 Zero-emission micro logistics',
    body: 'Quiet, electric, and autonomous. RoCAR makes campus deliveries effortless.',
  },
  {
    title: '📦 Got items to return?',
    body: 'Use Fetch Mode to have RoCAR collect borrowed chargers, books, or notes.',
  },
];

/**
 * Initialize all notification systems (Web + Native Capacitor)
 */
export async function setupNotifications() {
  try {
    // 1. Web Notification API (for Chrome / Android browser / Desktop)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Request on user interaction
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            sendLocalNotification('🔔 RoCAR Notifications Active', 'You will receive real-time updates when carts arrive!');
          }
        }).catch(() => {});
      }
    }

    // 2. Native Capacitor Push Notifications (when running as native APK)
    if (Capacitor.isNativePlatform()) {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
      }

      PushNotifications.addListener('registration', async (token) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase.from('users').update({ push_token: token.value }).eq('id', session.user.id);
        }
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        toast(notification.title || 'Delivery update', {
          icon: '🤖',
          duration: 5000,
        });
      });
    }

    // 3. Start smart periodic campus reminders (every 4 hours, or simulated demo)
    startPeriodicReminders();
  } catch (err) {
    console.warn('Notifications setup notice:', err);
  }
}

/**
 * Send an immediate notification (Web + Native + In-App Toast)
 */
export function sendLocalNotification(title: string, body: string, icon = '🤖') {
  // Always show in-app toast
  toast(
    () => (
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="font-bold text-sm text-white">{title}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{body}</p>
        </div>
      </div>
    ),
    {
      duration: 5000,
      style: {
        background: '#18181b',
        border: '1px solid #27272a',
        padding: '12px 16px',
        borderRadius: '16px',
      },
    }
  );

  // System Notification if permitted
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
      });
    } catch {
      // Fallback in environments that restrict direct Notification constructor
    }
  }
}

/**
 * Start periodic friendly reminders so the app stays top of mind
 */
let reminderInterval: any = null;

function startPeriodicReminders() {
  if (reminderInterval) return;

  // Check last reminder timestamp in localStorage
  const lastReminder = localStorage.getItem('rocar_last_reminder');
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // If user hasn't seen a reminder in 12 hours, trigger one after 15 seconds of app usage
  if (!lastReminder || now - Number(lastReminder) > ONE_DAY_MS / 2) {
    setTimeout(() => {
      const randomMsg = CAMPUS_REMINDERS[Math.floor(Math.random() * CAMPUS_REMINDERS.length)];
      sendLocalNotification(randomMsg.title, randomMsg.body, '⚡');
      localStorage.setItem('rocar_last_reminder', String(Date.now()));
    }, 15000);
  }

  // Periodic interval (every 6 hours if app stays open or on recurring visit)
  reminderInterval = setInterval(() => {
    const randomMsg = CAMPUS_REMINDERS[Math.floor(Math.random() * CAMPUS_REMINDERS.length)];
    sendLocalNotification(randomMsg.title, randomMsg.body, '🚀');
    localStorage.setItem('rocar_last_reminder', String(Date.now()));
  }, 6 * 60 * 60 * 1000);
}
