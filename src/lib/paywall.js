// src/lib/paywall.js
// ─────────────────────────────────────────────────────────────
// Logique de protection Premium.
// Deux mécaniques :
//   1. Filigrane (watermark) sur les images exportées
//   2. Limite à 3 carrousels sauvegardés pour les users gratuits
// ─────────────────────────────────────────────────────────────

export const FREE_CAROUSEL_LIMIT = 3

// ─── 1. WATERMARK sur le Canvas avant export ─────────────────
// À appeler dans la fonction drawSlide() ou juste après,
// uniquement si !isPremium.
//
// Usage dans ton export :
//   if (!isPremium) applyWatermark(canvas)
//   canvas.toBlob(...)

export function applyWatermark(canvas) {
  const ctx = canvas.getContext('2d')
  const W   = canvas.width
  const H   = canvas.height

  ctx.save()

  // Filigrane diagonal répété
  ctx.globalAlpha  = 0.12
  ctx.fillStyle    = '#ffffff'
  ctx.font         = `bold ${Math.round(W * 0.045)}px 'Syne', sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'

  // Rotation 45°, répété en grille
  const text   = 'CarrouselPro Free'
  const step   = W * 0.35
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 4)

  for (let x = -W; x < W * 1.5; x += step) {
    for (let y = -H; y < H * 1.5; y += step) {
      ctx.fillText(text, x, y)
    }
  }

  ctx.restore()

  // Bandeau en bas
  ctx.save()
  ctx.globalAlpha = 0.55
  ctx.fillStyle   = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, H - H * 0.08, W, H * 0.08)
  ctx.globalAlpha = 1
  ctx.fillStyle   = 'rgba(255,255,255,0.4)'
  ctx.font        = `600 ${Math.round(H * 0.022)}px 'Syne', sans-serif`
  ctx.textAlign   = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Créé avec CarrouselPro Free — carrouselpro.com', W / 2, H - H * 0.04)
  ctx.restore()
}


// ─── 2. Hook usePaywall ───────────────────────────────────────
// Encapsule toute la logique de gate dans un seul hook.
//
// Usage dans App.jsx :
//   const { canExport, canSave, isPremium, gateExport, gateSave } = usePaywall(profile, saveCount)

import { useState } from 'react'
import { handleCheckout } from './checkout'

export function usePaywall(profile, saveCount = 0) {
  const [showPaywall, setShowPaywall] = useState(false)
  const isPremium = profile?.is_premium ?? false

  // Peut exporter sans watermark ?
  const canExportClean = isPremium

  // Peut encore sauvegarder ?
  const canSave = isPremium || saveCount < FREE_CAROUSEL_LIMIT

  // Wrapper pour l'export : applique watermark si nécessaire
  const gateExport = (canvas) => {
    if (!isPremium) applyWatermark(canvas)
    // Renvoie le canvas (modifié ou non)
    return canvas
  }

  // Wrapper pour la sauvegarde : bloque si limite atteinte
  const gateSave = (onSave, user) => {
    if (!canSave) {
      setShowPaywall(true)
      return false
    }
    onSave()
    return true
  }

  const openPaywall  = () => setShowPaywall(true)
  const closePaywall = () => setShowPaywall(false)

  return {
    isPremium,
    canExportClean,
    canSave,
    gateExport,
    gateSave,
    showPaywall,
    openPaywall,
    closePaywall,
  }
}


// ─── 3. Composant PaywallModal ────────────────────────────────
// Modale affichée quand un utilisateur gratuit atteint une limite.
//
// Usage :
//   {showPaywall && <PaywallModal user={user} onClose={closePaywall}/>}

export function PaywallModal({ user, onClose }) {
  const features = [
    'Export sans filigrane',
    'Carrousels illimités sauvegardés',
    'Toutes les plateformes (TikTok, LinkedIn)',
    'Templates exclusifs Pro',
    'Accès prioritaire aux nouvelles features',
  ]

  const css = `
    .pw-overlay { position:fixed; inset:0; z-index:600; background:rgba(0,0,0,.75);
      backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center;
      padding:16px; }
    .pw-modal { background:#111; border:1px solid #262626; border-radius:22px; padding:32px;
      width:100%; max-width:400px; text-align:center; }
    .pw-icon { font-size:42px; margin-bottom:12px; }
    .pw-title { font-family:'Bebas Neue',sans-serif; font-size:32px; letter-spacing:4px;
      color:#f0f0f0; margin-bottom:6px; }
    .pw-sub { font-size:13px; color:#555; font-weight:500; margin-bottom:22px;
      line-height:1.6; }
    .pw-feats { text-align:left; margin-bottom:24px; display:flex; flex-direction:column; gap:8px; }
    .pw-feat { display:flex; align-items:center; gap:10px; font-size:13px; font-weight:600; color:#888; }
    .pw-feat::before { content:'✓'; color:#3ddc84; font-weight:900; font-size:14px; }
    .pw-cta { width:100%; padding:16px; border-radius:12px;
      background:linear-gradient(135deg,#f59e0b,#ef4444);
      color:#000; font-family:'Syne',sans-serif; font-size:15px; font-weight:800;
      border:none; cursor:pointer; margin-bottom:10px; transition:opacity .15s; }
    .pw-cta:hover { opacity:.88; }
    .pw-skip { font-size:11px; color:#444; font-weight:600; cursor:pointer; }
    .pw-skip:hover { color:#888; }
  `

  return (
    <>
      <style>{css}</style>
      <div className="pw-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="pw-modal">
          <div className="pw-icon">⚡</div>
          <div className="pw-title">PASSE EN PRO</div>
          <div className="pw-sub">
            Tu as atteint la limite du plan gratuit.<br/>
            Débloque tout pour créer sans restriction.
          </div>
          <div className="pw-feats">
            {features.map(f => <div key={f} className="pw-feat">{f}</div>)}
          </div>
          <button className="pw-cta" onClick={() => { handleCheckout(user); onClose(); }}>
            Passer en Pro — 9€/mois
          </button>
          <div className="pw-skip" onClick={onClose}>
            Continuer avec la version gratuite
          </div>
        </div>
      </div>
    </>
  )
}
