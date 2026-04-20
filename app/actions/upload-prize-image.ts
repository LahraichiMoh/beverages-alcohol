"use server"

import { createServiceClient } from "@/lib/supabase/service"

export async function uploadPrizeImage(file: File, opts?: { bucket?: string; filename?: string }) {
  const bucket = opts?.bucket || process.env.NEXT_PUBLIC_SUPABASE_PRIZE_BUCKET || "prizes"
  const name = opts?.filename || `${Date.now()}-${file.name.replace(/\s+/g, "-")}`
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.storage.from(bucket).upload(name, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "image/*",
    })
    if (error) {
      return { success: false, error: error.message }
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(name)
    return { success: true, url: data.publicUrl }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: msg }
  }
}

