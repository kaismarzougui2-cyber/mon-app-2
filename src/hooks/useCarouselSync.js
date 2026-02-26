// src/hooks/useCarouselSync.js
// ─────────────────────────────────────────────────────────────
// Sauvegarde automatique dans Supabase avec debounce 2 secondes.
// Utilisation :
//   const { saveStatus, carouselId } = useCarouselSync(advState, user, isPremium)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { saveCarousel, countUserCarousels } from '../lib/supabaseClient'

const DEBOUNCE_MS    = 2000   // délai avant sauvegarde
const FREE_MAX_SAVES = 3      // limite gratuit

export function useCarouselSync(advState, user, isPremium) {
  const [saveStatus, setSaveStatus]   = useState('idle')  // idle | saving | saved | error | limit
  const [carouselId, setCarouselId]   = useState(null)
  const [saveCount,  setSaveCount]    = useState(0)
  const timerRef   = useRef(null)
  const latestState = useRef(advState)

  // Garde une référence fraîche de l'état sans re-déclencher l'effet
  useEffect(() => { latestState.current = advState }, [advState])

  const doSave = useCallback(async () => {
    if (!user) return

    // Vérification limite gratuite
    if (!isPremium) {
      const count = await countUserCarousels(user.id)
      if (count >= FREE_MAX_SAVES && !carouselId) {
        setSaveStatus('limit')
        return
      }
    }

    setSaveStatus('saving')
    try {
      const state  = latestState.current
      const slides = state.slides ?? []

      const payload = {
        id:          carouselId,
        title:       slides[0]?.text?.substring(0, 40) || 'Sans titre',
        data:        state,
        platform:    state.platform ?? 'instagram',
        slide_count: slides.length,
        thumbnail:   null,  // optionnel : base64 de la 1ère slide
      }

      const saved = await saveCarousel(user.id, payload)
      if (!carouselId) setCarouselId(saved.id)
      setSaveCount(c => c + 1)
      setSaveStatus('saved')
      // Repasse à idle après 2 s
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('[useCarouselSync]', err)
      setSaveStatus('error')
    }
  }, [user, isPremium, carouselId])

  // Déclenche le debounce à chaque changement d'état
  useEffect(() => {
    if (!user) return                    // pas connecté → pas de sync
    if (saveStatus === 'limit') return   // limite atteinte → ne pas réessayer

    clearTimeout(timerRef.current)
    setSaveStatus('idle')
    timerRef.current = setTimeout(doSave, DEBOUNCE_MS)

    return () => clearTimeout(timerRef.current)
  // On ne veut pas doSave dans les deps pour éviter les boucles
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advState, user])

  // Sauvegarde manuelle immédiate
  const saveNow = useCallback(() => {
    clearTimeout(timerRef.current)
    doSave()
  }, [doSave])

  return { saveStatus, carouselId, setCarouselId, saveCount, saveNow }
}

// ─── Indicateur visuel à brancher dans la Navbar ─────────────
// saveStatus values :
//   'idle'    → rien à afficher (ou petite icône cloud grise)
//   'saving'  → "Sauvegarde…" avec spinner
//   'saved'   → "Sauvegardé ✓" en vert (2 s puis repasse idle)
//   'error'   → "Erreur ✕" en rouge
//   'limit'   → "Limite atteinte — Passe en Premium"
