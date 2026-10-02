import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge function to send push notifications when delivery status changes
// Called via Supabase Database Webhooks

const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  try {
    const payload = await req.json();
    const { type, record, old_record } = payload;
    
    // Only trigger on UPDATE
    if (type !== 'UPDATE') {
      return new Response("Not an update", { status: 200 });
    }

    const newStatus = record.status;
    const oldStatus = old_record.status;
    
    // Check if the status actually changed to something we care about
    if (newStatus === oldStatus) {
      return new Response("Status didn't change", { status: 200 });
    }

    let notificationTitle = '';
    let notificationBody = '';

    if (newStatus === 'DELIVERING') {
      notificationTitle = 'Package on the way! 🚚';
      notificationBody = 'RoCAR has collected your item and is heading your way. Tap to track.';
    } else if (newStatus === 'AWAITING_RETRIEVAL') {
      notificationTitle = 'RoCAR is here! 📍';
      notificationBody = 'Your cart has arrived. Step outside and scan the QR code to unlock your package.';
    } else {
      // Don't send notifications for other phases
      return new Response("Ignored phase", { status: 200 });
    }

    // Get the receiver's push token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', record.receiver_id)
      .single();

    if (error || !userData?.push_token) {
      console.log('No push token found for user', record.receiver_id);
      return new Response("No push token", { status: 200 });
    }

    // Send FCM notification
    if (!FCM_SERVER_KEY) {
      console.log('Missing FCM_SERVER_KEY, skipping actual push');
      return new Response("No FCM Key", { status: 200 });
    }

    const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${FCM_SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: userData.push_token,
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          deliveryId: record.id,
        },
      }),
    });

    return new Response(JSON.stringify(await fcmRes.json()), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})
