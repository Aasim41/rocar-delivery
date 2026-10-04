import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { toast } from 'react-hot-toast';
import { supabase } from './supabase';

// Cool campus reminder messages
const CAMPUS_REMINDERS = [
  {
    title: '⚡ AutoDrop Fleet Online',
    body: 'Need something fetched from the lab or library? Send a cart in 1 tap!',
  },
  {
    title: '🎒 Skip the campus walk!',
    body: 'AutoDrop is parked and ready. Dispatch packages across campus in minutes.',
  },
  {
    title: '🤖 Zero-emission micro logistics',
    body: 'Quiet, electric, and autonomous. AutoDrop makes campus deliveries effortless.',
  },
  {
    title: '📦 Got items to return?',
    body: 'Use Fetch Mode to have AutoDrop collect borrowed chargers, books, or notes.',
  },
];

/**
 * Initialize all notification systems (Local Native + Push + Web)
 */
export async function setupNotifications() {
  try {
    // 1. Native Local Notifications (for Android status bar / lockscreen notifications)
    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }

        // Create high-importance Android Notification Channel
        await LocalNotifications.createChannel({
          id: 'autodrop_channel',
          name: 'AutoDrop Deliveries',
          description: 'Real-time alerts for delivery arrivals and updates',
          importance: 5, // High priority / heads-up notification
          visibility: 1, // Visible on lockscreen
          vibration: true,
          lights: true,
          lightColor: '#ef4444',
        });
      } catch (err) {
        console.warn('Local notifications channel init:', err);
      }
    }

    // 2. Web Notification API (for Desktop / Browser fallback)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            sendLocalNotification('🔔 AutoDrop Notifications Active', 'You will receive real-time updates when carts arrive!');
          }
        }).catch(() => {});
      }
    }

    // 3. Native Capacitor Push Notifications (when FCM is configured)
    if (Capacitor.isNativePlatform()) {
      try {
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
          sendLocalNotification(notification.title || 'AutoDrop Update', notification.body || 'New delivery status update');
        });
      } catch (err) {
        console.warn('Push registration notice:', err);
      }
    }

    // 4. Start smart periodic campus reminders
    startPeriodicReminders();
  } catch (err) {
    console.warn('Notifications setup notice:', err);
  }
}

/**
 * Send an immediate notification (Native System Status Bar + In-App Toast + Web)
 */
export function sendLocalNotification(title: string, body: string, icon = '🤖') {
  // 1. In-app toast (when app is active/in foreground)
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

  // 2. Native Android system notification (posts to system status bar & notification shade)
  if (Capacitor.isNativePlatform()) {
    try {
      LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 2000000000),
            title,
            body,
            channelId: 'autodrop_channel',
            schedule: { at: new Date(Date.now() + 100) },
          },
        ],
      }).catch((err) => {
        console.warn('Local notification schedule err:', err);
      });
    } catch (err) {
      console.warn('Local notification trigger err:', err);
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    // 3. Web Notification fallback
    try {
      new Notification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
      });
    } catch {
      // restricted environment
    }
  }
}

/**
 * Start periodic friendly reminders so the app stays top of mind
 */
let reminderInterval: any = null;

function startPeriodicReminders() {
  if (reminderInterval) return;

  const lastReminder = localStorage.getItem('autodrop_last_reminder');
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (!lastReminder || now - Number(lastReminder) > ONE_DAY_MS / 2) {
    setTimeout(() => {
      const randomMsg = CAMPUS_REMINDERS[Math.floor(Math.random() * CAMPUS_REMINDERS.length)];
      sendLocalNotification(randomMsg.title, randomMsg.body, '⚡');
      localStorage.setItem('autodrop_last_reminder', String(Date.now()));
    }, 15000);
  }

  reminderInterval = setInterval(() => {
    const randomMsg = CAMPUS_REMINDERS[Math.floor(Math.random() * CAMPUS_REMINDERS.length)];
    sendLocalNotification(randomMsg.title, randomMsg.body, '🚀');
    localStorage.setItem('autodrop_last_reminder', String(Date.now()));
  }, 6 * 60 * 60 * 1000);
}
