import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';

export const registerPushNotifications = async () => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Push notifications are not supported on the web.');
    return;
  }

  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.log('User denied push notification permissions.');
    return;
  }

  await PushNotifications.register();
};

export const initPushNotificationListeners = () => {
  if (Capacitor.getPlatform() === 'web') return;

  PushNotifications.addListener('registration', async (token) => {
    console.log('Push registration success, token: ' + token.value);
    
    // Save token to Supabase for the current user
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('users').update({ push_token: token.value }).eq('id', session.user.id);
    }
  });

  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('Error on push registration: ' + JSON.stringify(error));
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received: ' + JSON.stringify(notification));
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push action performed: ' + JSON.stringify(notification));
  });
};
