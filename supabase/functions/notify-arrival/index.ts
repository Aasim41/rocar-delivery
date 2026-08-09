import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { initializeApp, cert } from "npm:firebase-admin/app"
import { getMessaging } from "npm:firebase-admin/messaging"

const serviceAccountKeyStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
if (!serviceAccountKeyStr) {
  console.warn("FIREBASE_SERVICE_ACCOUNT secret is missing");
}

let firebaseApp: any;
if (serviceAccountKeyStr) {
  try {
    const serviceAccount = JSON.parse(serviceAccountKeyStr);
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
}

serve(async (req) => {
  try {
    const payload = await req.json();

    // Check if this is an UPDATE trigger from Supabase Webhooks
    if (payload.type !== 'UPDATE' || payload.table !== 'orders') {
      return new Response(JSON.stringify({ error: 'Invalid trigger type' }), { status: 400 });
    }

    const { record, old_record } = payload;

    // Only notify if status CHANGED to 'arrived'
    if (record.status !== 'arrived' || old_record.status === 'arrived') {
      return new Response(JSON.stringify({ message: 'No notification needed' }), { status: 200 });
    }

    if (!firebaseApp) {
      return new Response(JSON.stringify({ error: 'Firebase not configured' }), { status: 500 });
    }

    // Connect to Supabase to fetch user's push token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', record.user_id)
      .single();

    if (userError || !user?.push_token) {
      return new Response(JSON.stringify({ error: 'User push token not found' }), { status: 404 });
    }

    // Send Push Notification
    const message = {
      notification: {
        title: 'Robot Arrived! 🤖',
        body: 'Your delivery robot is at the destination. Check the app for the unlock PIN!',
      },
      token: user.push_token,
    };

    const response = await getMessaging().send(message);
    
    return new Response(JSON.stringify({ success: true, messageId: response }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})
