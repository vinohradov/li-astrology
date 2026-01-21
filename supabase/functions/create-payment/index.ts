// Li Astrology - Create Payment Edge Function
// Generates signed LiqPay payment data

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const LIQPAY_PUBLIC_KEY = Deno.env.get('LIQPAY_PUBLIC_KEY') || ''
const LIQPAY_PRIVATE_KEY = Deno.env.get('LIQPAY_PRIVATE_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { order_id, product_id, amount, currency, description, result_url, server_url } = await req.json()

    // Validate required fields
    if (!order_id || !amount || !description) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create LiqPay payment data
    const paymentData = {
      public_key: LIQPAY_PUBLIC_KEY,
      version: '3',
      action: 'pay',
      amount: amount,
      currency: currency || 'UAH',
      description: description,
      order_id: order_id,
      result_url: result_url,
      server_url: server_url,
      language: 'uk'
    }

    // Encode data to base64
    const jsonString = JSON.stringify(paymentData)
    const data = base64Encode(new TextEncoder().encode(jsonString))

    // Create signature: base64(sha1(private_key + data + private_key))
    const signString = LIQPAY_PRIVATE_KEY + data + LIQPAY_PRIVATE_KEY
    const signBytes = new TextEncoder().encode(signString)
    const hashBuffer = await crypto.subtle.digest('SHA-1', signBytes)
    const signature = base64Encode(new Uint8Array(hashBuffer))

    return new Response(
      JSON.stringify({ data, signature }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating payment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
