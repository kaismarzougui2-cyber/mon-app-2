// ─────────────────────────────────────────────────────────────
// FICHIER 1 : src/lib/checkout.js
// Fonction appelée depuis le bouton "Passer en Premium"
// ─────────────────────────────────────────────────────────────
//
// Variables Vercel à configurer :
//   VITE_STRIPE_PRICE_ID  → Stripe Dashboard > Produits > ton prix récurrent
//
// ─────────────────────────────────────────────────────────────

export async function handleCheckout(user) {
  if (!user) {
    // Redirige vers login si pas connecté
    window.location.href = '/login'
    return
  }

  try {
    // Appelle notre Edge Function (fichier 2 ci-dessous)
    const res = await fetch('/api/create-checkout-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId:   user.id,
        email:    user.email,
        priceId:  import.meta.env.VITE_STRIPE_PRICE_ID,
      }),
    })

    if (!res.ok) throw new Error('Erreur création session Stripe')

    const { url } = await res.json()
    // Redirige vers la page de paiement Stripe hébergée
    window.location.href = url
  } catch (err) {
    console.error('[handleCheckout]', err)
    alert('Erreur lors de la redirection vers le paiement.')
  }
}
