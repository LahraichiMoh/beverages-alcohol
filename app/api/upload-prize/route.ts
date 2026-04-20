import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const bucket = (formData.get("bucket") as string) || process.env.NEXT_PUBLIC_SUPABASE_PRIZE_BUCKET || "prizes"
    const filename = (formData.get("filename") as string) || (file ? `${Date.now()}-${file.name.replace(/\s+/g, "-")}` : "")
    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
    }
    const supabase = createServiceClient()
    // Ensure bucket exists and is public
    const buckets = await supabase.storage.listBuckets()
    if (!buckets.error) {
      const current = (buckets.data || []).find((b) => b.name === bucket)
      if (!current) {
        const created = await supabase.storage.createBucket(bucket, { public: true })
        if (created.error) {
          return NextResponse.json({ success: false, error: created.error.message }, { status: 500 })
        }
      } else if (!current.public) {
        const updated = await supabase.storage.updateBucket(bucket, { public: true })
        if (updated.error) {
          return NextResponse.json({ success: false, error: updated.error.message }, { status: 500 })
        }
      }
    }
    const { error } = await supabase.storage.from(bucket).upload(filename, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "image/*",
    })
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(filename)
    return NextResponse.json({ success: true, url: data.publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
