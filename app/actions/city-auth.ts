"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

const COOKIE_NAME = "spin_city_auth"

export async function loginCity(username: string, password: string) {
  const supabase = await createClient()

  try {
    const { data: city, error } = await supabase
      .from("cities")
      .select("*")
      .eq("username", username)
      .eq("password", password) // In production, use hashing. Here we use direct comparison as requested/implied for simple access keys.
      .single()

    if (error || !city) {
      return { success: false, error: "Identifiants incorrects" }
    }

    // Set cookie
    (await cookies()).set(COOKIE_NAME, JSON.stringify({ id: city.id, name: city.name }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    })

    return { success: true, city }
  } catch (err) {
    return { success: false, error: "Erreur de connexion" }
  }
}

export async function getCurrentCity() {
  const cookieStore = await cookies()
  const cityCookie = cookieStore.get(COOKIE_NAME)

  if (!cityCookie) return null

  try {
    return JSON.parse(cityCookie.value) as { id: string; name: string }
  } catch {
    return null
  }
}

export async function logoutCity() {
  (await cookies()).delete(COOKIE_NAME)
  return { success: true }
}
