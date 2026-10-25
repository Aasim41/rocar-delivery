import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { toast } from 'react-hot-toast';
import { supabase } from './supabase';

// Engaging campus and autonomous fleet alerts
export const CAMPUS_REMINDERS = [
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
  {
    title: '☕ Study Break Logistics',
    body: 'Need study materials or snacks dropped off at the hostel? AutoDrop is standing by.',
  },
  {
    title: '🔒 Secure Compartment',
    body: 'Dual PIN and QR code security keeps your cargo safe until the recipient unlocks.',
  },
  {
    title: '🔋 100% Solar-Charged Fleet',
    body: 'Cart 01 is fully charged at the docking bay and ready for rapid autonomous dispatch.',
  },
  {
    title: '📍 Campus Precision Navigation',
    body: 'AutoDrop paths are calibrated to within centimeters along campus walkways.',
  },
];

/**
 * Initialize all notification systems (Native AlarmManager + Web Push + Service Worker)
 */
export async function setupNotifications() {
  try {
    // 1. Android Native Notification Channel (Heads-up notification with high importance)
    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }

        await LocalNotifications.createChannel({
          id: 'autodrop_channel',
          name: 'AutoDrop Deliveries & Fleet',
          description: 'Real-time delivery arrivals, security alerts, and fleet status',
          importance: 5, // High priority heads-up
          visibility: 1, // Visible on lockscreen
          vibration: true,
          lights: true,
          lightColor: '#3b82f6',
        });
      } catch (err) {
        console.warn('Local notifications channel init:', err);
      }
    }

    // 2. Register Service Worker for Web / PWA background notifications
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('AutoDrop Service Worker registered with scope:', registration.scope);
      }).catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
    }

    // 3. Web Notification Permission Request
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            sendLocalNotification('🔔 AutoDrop Notifications Active', 'You will receive real-time updates when carts arrive and throughout the day!');
          }
        }).catch(() => {});
      }
    }

    // 4. Native Capacitor Push Notifications (FCM / APNS)
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

    // 5. Schedule random notifications across the day even when app is closed!
    await scheduleBackgroundNotifications();
  } catch (err) {
    console.warn('Notifications setup notice:', err);
  }
}

/**
 * Schedule future notifications into Android AlarmManager / Service Worker
 * These fire at random times during the day EVEN WHEN THE APP IS COMPLETELY CLOSED!
 */
export async function scheduleBackgroundNotifications() {
  try {
    // A. Native Android AlarmManager (fires with app closed/killed/phone sleeping)
    if (Capacitor.isNativePlatform()) {
      const pending = await LocalNotifications.getPending();
      
      // If we already have 6+ pending notifications queued, we're in great shape
      if (pending && pending.notifications && pending.notifications.length >= 6) {
        console.log(`Already have ${pending.notifications.length} background notifications scheduled.`);
        return;
      }

      const notificationsToSchedule: any[] = [];
      const now = Date.now();

      // Schedule random alerts over the next 5 days (2 per day at random business hours)
      for (let day = 0; day < 5; day++) {
        // Random morning/afternoon slot: between 10:00 AM and 2:30 PM
        const morningHour = 10 + Math.floor(Math.random() * 4);
        const morningMin = Math.floor(Math.random() * 59);

        // Random evening slot: between 5:00 PM and 9:30 PM
        const eveningHour = 17 + Math.floor(Math.random() * 4);
        const eveningMin = Math.floor(Math.random() * 59);

        const target1 = new Date();
        target1.setDate(target1.getDate() + day);
        target1.setHours(morningHour, morningMin, 0, 0);

        const target2 = new Date();
        target2.setDate(target2.getDate() + day);
        target2.setHours(eveningHour, eveningMin, 0, 0);

        // Only schedule if in the future
        if (target1.getTime() > now + 60000) {
          const item1 = CAMPUS_REMINDERS[Math.floor(Math.random() * CAMPUS_REMINDERS.length)];
          notificationsToSchedule.push({
            id: Math.floor(100000 + Math.random() * 900000),
            title: item1.title,
            body: item1.body,
            schedule: { at: target1, allowWhileIdle: true },
            channelId: 'autodrop_channel',
          });
        }

        if (target2.getTime() > now + 60000) {
          const item2 = CAMPUS_REMINDERS[Math.floor(Math.random() * CAMPUS_REMINDERS.length)];
          notificationsToSchedule.push({
            id: Math.floor(100000 + Math.random() * 900000),
            title: item2.title,
            body: item2.body,
            schedule: { at: target2, allowWhileIdle: true },
            channelId: 'autodrop_channel',
          });
        }
      }

      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
        console.log(`Successfully scheduled ${notificationsToSchedule.length} background notifications into Android AlarmManager!`);
      }
    } else {
      // B. Web Browser Fallback: Schedule via Service Worker message
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // Schedule random alerts for 2 hours, 6 hours, and 18 hours from now
        const intervals = [2 * 60 * 60 * 1000, 6 * 60 * 60 * 1000, 18 * 60 * 60 * 1000];
        intervals.forEach((delay) => {
          const item = CAMPUS_REMINDERS[Math.floor(Math.random() * CAMPUS_REMINDERS.length)];
          navigator.serviceWorker.controller?.postMessage({
            type: 'SCHEDULE_NOTIFICATION',
            delayMs: delay,
            title: item.title,
            body: item.body,
          });
        });
      }
    }
  } catch (err) {
    console.warn('Error scheduling background notifications:', err);
  }
}

/**
 * Send an immediate notification (Native System Status Bar + In-App Toast + Web)
 */
export function sendLocalNotification(title: string, body: string, icon = '🤖') {
  // 1. In-app toast (when app is currently open in foreground)
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
          },
        ],
      }).catch((err) => {
        console.warn('Local notification schedule err:', err);
      });
    } catch (err) {
      console.warn('Local notification trigger err:', err);
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    // 3. Web Notification fallback (Desktop/Browser)
    try {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
      });
    } catch {
      // restricted environment
    }
  }
}
