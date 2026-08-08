import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone } = await req.json()
    
    if (!phone) {
      throw new Error("Phone number is required")
    }

    // 1. Generate a 4 digit PIN
    const otp = Math.floor(1000 + Math.random() * 9000).toString()

    // 2. Fetch Twilio secrets from Supabase environment variables
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Missing Twilio credentials in Edge Function environment")
    }

    // 3. Send SMS using Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
    
    const formData = new URLSearchParams()
    formData.append('To', phone)
    formData.append('From', TWILIO_PHONE_NUMBER)
    formData.append('Body', `Your Delivery Robot has arrived! Use PIN: ${otp} to unlock your compartment.`)

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`
      },
      body: formData.toString()
    })

    const twilioData = await twilioResponse.json()
    
    if (!twilioResponse.ok) {
       console.error("Twilio Error:", twilioData)
       throw new Error(twilioData.message || "Failed to send SMS via Twilio")
    }

    // Return the generated OTP to the frontend so the frontend knows what to compare it to
    // In a full production app, you'd save this to the DB and not return it, but this is perfect for the hackathon
    return new Response(
      JSON.stringify({ success: true, otp, messageId: twilioData.sid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
