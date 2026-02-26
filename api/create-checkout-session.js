// api/create-checkout-session.js
// ─────────────────────────────────────────────────────────────
// Vercel Edge Function — crée une session Stripe Checkout
// Appelée depuis handleCheckout() côté client
// ─────────────────────────────────────────────────────────────
//
// Variables Vercel (Settings > Environment Variables) :
//   STRIPE_SECRET_KEY     → Stripe Dashboard > Developers > API keys > Secret
//   NEXT_PUBLIC_APP_URL   → https://ton-app.vercel.app
// ─────────────────────────────────────────────────────────────

import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response('Corps JSON invalide', { status: 400 })
  }

  const { userId, email, priceId } = body

  if (!userId || !email || !priceId) {
    return new Response('Paramètres manquants : userId, email, priceId', { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      payment_method_types: ['card'],
      customer_email:       email,
      line_items:           [{ price: priceId, quantity: 1 }],
      metadata:             { supabase_user_id: userId },
      success_url:          `${appUrl}/?checkout=success`,
      cancel_url:           `${appUrl}/?checkout=cancel`,
      allow_promotion_codes: true,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[create-checkout-session]', err)
    return new Response(`Stripe Error: ${err.message}`, { status: 500 })
  }
}
