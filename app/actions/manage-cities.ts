"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"

export interface City {
  id: string
  name: string
  username: string
  password?: string // Optional for display, required for update/create if changing
  created_at: string
}

export async function getCities() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .order("name")

  if (error) {
    console.error("Error fetching cities:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as City[] }
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { success: false as const, error: "Unauthorized" }

  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()

  if (adminError || !adminRow) return { success: false as const, error: "Unauthorized" }

  return { success: true as const }
}

export async function createCity(name: string, username: string, password: string) {
  const auth = await requireAdmin()
  if (!auth.success) return auth

  const supabase = createServiceClient()
  
  // Check if username exists
  const { data: existing, error: existingError } = await supabase
    .from("cities")
    .select("id")
    .eq("username", username)
    .maybeSingle()

  if (existingError) {
    return { success: false, error: existingError.message }
  }

  if (existing) {
    return { success: false, error: "Ce nom d'utilisateur existe déjà." }
  }

  const { data, error } = await supabase
    .from("cities")
    .insert([{ name, username, password }])
    .select()
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  if (!data) {
    return { success: false, error: "Aucune ville n'a été créée." }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data }
}

export async function updateCity(id: string, updates: { name?: string; username?: string; password?: string }) {
  const auth = await requireAdmin()
  if (!auth.success) return auth

  const supabase = createServiceClient()

  // If changing username, check uniqueness
  if (updates.username) {
    const { data: existing, error: existingError } = await supabase
      .from("cities")
      .select("id")
      .eq("username", updates.username)
      .neq("id", id) // Exclude self
      .maybeSingle()

    if (existingError) {
      return { success: false, error: existingError.message }
    }

    if (existing) {
      return { success: false, error: "Ce nom d'utilisateur est déjà pris." }
    }
  }

  const { data, error } = await supabase
    .from("cities")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  if (!data) {
    return { success: false, error: "Ville introuvable." }
  }

  revalidatePath("/admin/dashboard")
  return { success: true, data }
}

export async function deleteCity(id: string) {
  const auth = await requireAdmin()
  if (!auth.success) return auth

  const supabase = createServiceClient()

  const { error } = await supabase
    .from("cities")
    .delete()
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/admin/dashboard")
  return { success: true }
}
