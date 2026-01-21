// Li Astrology - LiqPay Callback Edge Function
// Receives payment confirmations from LiqPay and stores them

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { decode as base64Decode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LIQPAY_PRIVATE_KEY = Deno.env.get('LIQPAY_PRIVATE_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  try {
    // LiqPay sends data as form-urlencoded
    const formData = await req.formData()
    const data = formData.get('data') as string
    const signature = formData.get('signature') as string

    if (!data || !signature) {
      console.error('Missing data or signature')
      return new Response('Missing data or signature', { status: 400 })
    }

    // Verify signature
    const expectedSignString = LIQPAY_PRIVATE_KEY + data + LIQPAY_PRIVATE_KEY
    const signBytes = new TextEncoder().encode(expectedSignString)
    const hashBuffer = await crypto.subtle.digest('SHA-1', signBytes)
    const expectedSignature = base64Encode(new Uint8Array(hashBuffer))

    if (signature !== expectedSignature) {
      console.error('Invalid signature')
      return new Response('Invalid signature', { status: 403 })
    }

    // Decode payment data
    const decodedBytes = base64Decode(data)
    const paymentData = JSON.parse(new TextDecoder().decode(decodedBytes))

    console.log('Payment callback received:', {
      order_id: paymentData.order_id,
      status: paymentData.status,
      amount: paymentData.amount
    })

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Extract product_id from order_id (format: product_id_timestamp_random)
    const orderParts = paymentData.order_id.split('_')
    const productId = orderParts.slice(0, -2).join('_') // Handle product IDs with underscores

    // Upsert purchase record
    const { error } = await supabase
      .from('purchases')
      .upsert({
        order_id: paymentData.order_id,
        liqpay_order_id: paymentData.liqpay_order_id,
        payment_id: paymentData.payment_id?.toString(),
        status: paymentData.status,
        product_id: productId,
        product_name: paymentData.description,
        amount: paymentData.amount,
        currency: paymentData.currency,
        customer_phone: paymentData.sender_phone,
        customer_email: paymentData.sender_email,
        customer_name: paymentData.sender_first_name
          ? `${paymentData.sender_first_name} ${paymentData.sender_last_name || ''}`.trim()
          : null,
        liqpay_data: paymentData
      }, {
        onConflict: 'order_id'
      })

    if (error) {
      console.error('Database error:', error)
      return new Response('Database error', { status: 500 })
    }

    console.log('Purchase saved successfully:', paymentData.order_id)

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Callback error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})
