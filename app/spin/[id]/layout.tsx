import type { ReactNode } from "react"
import { Suspense } from "react"
import { createServiceClient } from "@/lib/supabase/service"

type CampaignTheme = {
  logoUrl?: string
  backgroundUrl?: string
}

async function getSpinTheme(participantId: string): Promise<CampaignTheme | null> {
  const supabase = createServiceClient()

  const { data: participant } = await supabase
    .from("participants")
    .select("campaign_id")
    .eq("id", participantId)
    .maybeSingle()

  const campaignId = (participant as any)?.campaign_id as string | null | undefined
  if (!campaignId) return null

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("theme")
    .eq("id", campaignId)
    .maybeSingle()

  const theme = (campaign as any)?.theme as CampaignTheme | undefined
  if (!theme || typeof theme !== "object") return null
  return theme
}

function SpinLoader({ theme }: { theme: CampaignTheme | null }) {
  const bgUrl = theme?.backgroundUrl || "/flag-back.jpg"
  const logoUrl = theme?.logoUrl || "/orange.jpg"

  return (
    <main
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black"
      style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 flex flex-col items-center gap-10">
        <div className="relative">
          <div className="w-36 h-36 bg-white/10 rounded-[2.5rem] flex items-center justify-center backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center shadow-xl relative overflow-hidden group">
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2 relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine pointer-events-none" />
            </div>
          </div>
          <div className="absolute inset-[-15px] border border-orange-500/30 rounded-full animate-[spin_15s_linear_infinite]" />
          <div className="absolute inset-[-25px] border border-white/10 rounded-full animate-[spin_20s_linear_infinite_reverse]" />
        </div>
      </div>
    </main>
  )
}

export default async function SpinLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const theme = await getSpinTheme(id)

  return <Suspense fallback={<SpinLoader theme={theme} />}>{children}</Suspense>
}

