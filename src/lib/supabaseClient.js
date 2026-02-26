// src/lib/supabaseClient.js
// ─────────────────────────────────────────────────────────────
// Variables à définir dans Vercel > Settings > Environment Variables
//   VITE_SUPABASE_URL      →  Supabase Dashboard > Settings > API > Project URL
//   VITE_SUPABASE_ANON_KEY →  Supabase Dashboard > Settings > API > anon public
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('[Supabase] Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquantes.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:      true,   // session dans localStorage
    autoRefreshToken:    true,   // refresh automatique du JWT
    detectSessionInUrl:  true,   // gère le callback OAuth Google
  },
})

// ─── AUTH ─────────────────────────────────────────────────────

export const signInWithEmail = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signUpWithEmail = (email, password) =>
  supabase.auth.signUp({ email, password })

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  })

export const signOut = () => supabase.auth.signOut()

// ─── PROFIL ───────────────────────────────────────────────────

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// ─── CAROUSELS ────────────────────────────────────────────────

/** Upsert : crée si pas d'id, met à jour sinon */
export const saveCarousel = async (userId, carousel) => {
  const { id, title, data, platform, slide_count, thumbnail } = carousel
  if (id) {
    const { data: row, error } = await supabase
      .from('carousels')
      .update({ title, data, platform, slide_count, thumbnail })
      .eq('id', id).eq('user_id', userId)
      .select().single()
    if (error) throw error
    return row
  } else {
    const { data: row, error } = await supabase
      .from('carousels')
      .insert({ user_id: userId, title, data, platform, slide_count, thumbnail })
      .select().single()
    if (error) throw error
    return row
  }
}

export const getUserCarousels = async (userId) => {
  const { data, error } = await supabase
    .from('carousels')
    .select('id, title, platform, slide_count, thumbnail, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data
}

export const deleteCarousel = async (userId, carouselId) => {
  const { error } = await supabase
    .from('carousels')
    .delete()
    .eq('id', carouselId).eq('user_id', userId)
  if (error) throw error
}

export const countUserCarousels = async (userId) => {
  const { count, error } = await supabase
    .from('carousels')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return count ?? 0
}
