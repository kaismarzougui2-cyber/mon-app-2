// api/stripe-webhook.js
// ─────────────────────────────────────────────────────────────
// Vercel Edge Function — reçoit les événements Stripe
// et met à jour Supabase en conséquence.
// ─────────────────────────────────────────────────────────────
//
// Setup :
//  1. Stripe Dashboard > Developers > Webhooks > Add endpoint
//     URL : https://ton-app.vercel.app/api/stripe-webhook
//     Événements : checkout.session.completed
//                  customer.subscription.deleted
//                  invoice.payment_failed
//
//  2. Variables Vercel (Settings > Environment Variables) :
//     STRIPE_SECRET_KEY         → Stripe > Developers > API keys > Secret key
//     STRIPE_WEBHOOK_SECRET     → Stripe > Developers > Webhooks > Signing secret
//     SUPABASE_SERVICE_ROLE_KEY → Supabase > Settings > API > service_role (⚠ secret !)
//     VITE_SUPABASE_URL         → déjà configuré
// ─────────────────────────────────────────────────────────────

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// ⚠ service_role bypasse le Row Level Security — côté serveur UNIQUEMENT
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  // Vérifie la signature Stripe (sécurité obligatoire)
  let event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, signature, process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('[Webhook] Signature invalide:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // ── Paiement réussi → activer Premium ──────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId  = session.metadata?.supabase_user_id

    if (!userId) {
      console.error('[Webhook] supabase_user_id manquant dans metadata')
      return new Response('Missing user id', { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        is_premium:             true,
        stripe_customer_id:     session.customer,
        stripe_subscription_id: session.subscription,
        premium_until:          null,
      })
      .eq('id', userId)

    if (error) {
      console.error('[Webhook] Erreur activation Premium:', error)
      return new Response('DB Error', { status: 500 })
    }
    console.log(`[Webhook] ✓ User ${userId} → Premium activé`)
  }

  // ── Abonnement annulé → désactiver Premium ─────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub        = event.data.object
    const customerId = sub.customer

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        is_premium:    false,
        premium_until: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId)

    if (error) console.error('[Webhook] Erreur désactivation:', error)
    else console.log(`[Webhook] ✓ Customer ${customerId} → Plan gratuit`)
  }

  // ── Paiement échoué → désactiver Premium ───────────────────
  if (event.type === 'invoice.payment_failed') {
    const invoice    = event.data.object
    const customerId = invoice.customer

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_premium: false })
      .eq('stripe_customer_id', customerId)

    if (error) console.error('[Webhook] Erreur paiement échoué:', error)
    else console.log(`[Webhook] ✓ Customer ${customerId} → Paiement échoué, downgrade`)
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
