// Li Astrology - Telegram Bot Edge Function
// Handles /start command and sends private channel invites

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// Channel IDs for each product (set these after creating channels)
// To get channel ID: forward a message from channel to @userinfobot
const CHANNELS: Record<string, string> = {
  'intensiv': Deno.env.get('CHANNEL_INTENSIV') || '',
  'kurs-aspekty-1': Deno.env.get('CHANNEL_KURS_T1') || '',
  'kurs-aspekty-2': Deno.env.get('CHANNEL_KURS_T2') || '',
  'kurs-aspekty-3': Deno.env.get('CHANNEL_KURS_T3') || '',
}

// Messages in Ukrainian
const MESSAGES = {
  welcome: `✨ Вітаємо в Li Astrology Bot!

Щоб отримати доступ до матеріалів курсу, спочатку придбайте курс на нашому сайті:
https://li-astrology.com.ua

Після оплати ви отримаєте посилання, яке автоматично надасть вам доступ до матеріалів.`,

  purchaseFound: `🎉 Вітаємо з покупкою!

Ваше посилання на курс (дійсне 24 години):`,

  purchaseNotFound: `❌ На жаль, покупку не знайдено.

Можливі причини:
• Оплата ще обробляється (зачекайте кілька хвилин)
• Посилання вже було використано

Якщо ви впевнені, що оплатили, зв'яжіться з підтримкою.`,

  alreadySent: `ℹ️ Посилання на курс вже було надіслано раніше.

Якщо у вас виникли проблеми з доступом, зв'яжіться з підтримкою.`,

  error: `⚠️ Виникла помилка. Спробуйте пізніше або зв'яжіться з підтримкою.`,

  channelNotConfigured: `⚠️ Канал для цього курсу ще не налаштовано. Зв'яжіться з підтримкою.`
}

serve(async (req) => {
  try {
    const update = await req.json()

    // Handle /start command
    if (update.message?.text?.startsWith('/start')) {
      const chatId = update.message.chat.id
      const text = update.message.text
      const params = text.split(' ')[1] // Get parameter after /start

      if (params) {
        // User came with order_id parameter
        await handlePurchaseVerification(chatId, params)
      } else {
        // Just /start without parameters
        await sendMessage(chatId, MESSAGES.welcome)
      }
    }

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Bot error:', error)
    return new Response('OK', { status: 200 }) // Always return 200 to Telegram
  }
})

async function handlePurchaseVerification(chatId: number, orderId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Find purchase
  const { data: purchase, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('order_id', orderId)
    .single()

  if (error || !purchase) {
    console.log('Purchase not found:', orderId)
    await sendMessage(chatId, MESSAGES.purchaseNotFound)
    return
  }

  // Check if payment was successful
  if (purchase.status !== 'success' && purchase.status !== 'sandbox') {
    console.log('Purchase not successful:', purchase.status)
    await sendMessage(chatId, MESSAGES.purchaseNotFound)
    return
  }

  // Check if already sent
  if (purchase.telegram_sent) {
    console.log('Already sent to:', orderId)
    await sendMessage(chatId, MESSAGES.alreadySent)
    return
  }

  // Get channel ID for product
  const channelId = CHANNELS[purchase.product_id]
  if (!channelId) {
    console.error('Channel not configured for product:', purchase.product_id)
    await sendMessage(chatId, MESSAGES.channelNotConfigured)
    return
  }

  // Generate invite link
  const inviteLink = await createInviteLink(channelId)
  if (!inviteLink) {
    await sendMessage(chatId, MESSAGES.error)
    return
  }

  // Send invite link
  await sendMessage(chatId, `${MESSAGES.purchaseFound}\n\n${inviteLink}`)

  // Mark as sent
  await supabase
    .from('purchases')
    .update({
      telegram_sent: true,
      telegram_chat_id: chatId.toString(),
      telegram_sent_at: new Date().toISOString()
    })
    .eq('id', purchase.id)

  console.log('Invite sent successfully for order:', orderId)
}

async function createInviteLink(channelId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createChatInviteLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          member_limit: 1, // Single use
          expire_date: Math.floor(Date.now() / 1000) + 86400 // 24 hours
        })
      }
    )

    const data = await response.json()

    if (data.ok) {
      return data.result.invite_link
    } else {
      console.error('Failed to create invite link:', data)
      return null
    }
  } catch (error) {
    console.error('Error creating invite link:', error)
    return null
  }
}

async function sendMessage(chatId: number, text: string) {
  try {
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      }
    )
  } catch (error) {
    console.error('Error sending message:', error)
  }
}
