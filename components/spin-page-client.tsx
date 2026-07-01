"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SpinnerWheel } from "@/components/spinner-wheel"
import { Button } from "@/components/ui/button"
import { finalizeSpin, getSpinData, markSpinAsLostNoStock } from "@/app/actions/finalize-spin"
import { submitParticipation } from "@/app/actions/submit-participation"
import { getAvailablePrizes, getActiveCampaign } from "@/app/actions/campaigns"
import { Loader2 } from "lucide-react"
import type { Campaign } from "@/app/actions/campaigns"

const CAMPAIGN_CACHE_KEY = "spin_campaign_cache_v1"
const PARTICIPANT_DRAFT_PREFIX = "spin_participant_draft_v1:"

interface Participant {
  id: string
  name: string
  code: string
  city: string
  city_id?: string | null
  venue_id?: string | null
  venue_type?: string | null
  won: boolean
  prize_id: string | null
  campaign_id?: string
  created_at?: string
  agreed_to_terms?: boolean
}

interface Prize {
  id: string
  name: string
  image_url?: string
  max_winners: number
  current_winners: number
  color?: string
  campaign_id?: string
  available?: boolean
  is_prize: boolean
}

export default function SpinPageClient({
  participantId,
  initialParticipant,
  initialCampaign,
  initialPrizes,
  initialCityId,
  draft,
}: {
  participantId: string
  initialParticipant: Participant
  initialCampaign: Campaign | null
  initialPrizes: Prize[]
  initialCityId?: string
  draft?: boolean
}) {
  const router = useRouter()
  const [participant, setParticipant] = useState<Participant>(initialParticipant)
  const [campaign, setCampaign] = useState<Campaign | null>(initialCampaign)
  const [prizes, setPrizes] = useState<Prize[]>(initialPrizes)
  const [loading, setLoading] = useState(false)
  const [hasSpun, setHasSpun] = useState(!!initialParticipant.won || !!initialParticipant.prize_id)
  const [isAdmin, setIsAdmin] = useState(false)
  const [resultPrize, setResultPrize] = useState<{ id: string; name: string; imageUrl?: string; color?: string; is_prize?: boolean } | null>(null)
  const [spinError, setSpinError] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | undefined>(initialCityId)
  const [creatingReplay, setCreatingReplay] = useState(false)
  const [isPersisted, setIsPersisted] = useState(!draft)

  const cacheCampaign = (c: Campaign | null) => {
    try {
      if (!c) return
      window.sessionStorage.setItem(CAMPAIGN_CACHE_KEY, JSON.stringify(c))
    } catch {}
  }

  const effectiveCampaignId = participant.campaign_id || campaign?.id || null

  useEffect(() => {
    if (!draft) return
    try {
      const raw = window.sessionStorage.getItem(`${PARTICIPANT_DRAFT_PREFIX}${participantId}`)
      if (!raw) return
      const parsed = JSON.parse(raw) as any

      const draftCampaignId = (parsed?.campaignId as string | undefined) || null
      const draftName = String(parsed?.name || "")
      const draftCode = String(parsed?.code || "")
      const draftCity = String(parsed?.city || "")
      const draftCityId = (parsed?.city_id as string | undefined) || undefined
      const draftVenueId = (parsed?.venue_id as string | undefined) || undefined
      const draftVenueType = (parsed?.venue_type as string | undefined) || undefined

      if (draftCityId) setCityId(draftCityId)
      setParticipant((p) => ({
        ...p,
        id: participantId,
        name: draftName || p.name,
        code: draftCode || p.code,
        city: draftCity || p.city,
        city_id: draftCityId ?? p.city_id,
        venue_id: draftVenueId ?? p.venue_id,
        venue_type: draftVenueType ?? p.venue_type,
        campaign_id: draftCampaignId ?? p.campaign_id,
        won: false,
        prize_id: null,
      }))

      const cached = window.sessionStorage.getItem(CAMPAIGN_CACHE_KEY)
      if (cached) {
        try {
          const cc = JSON.parse(cached) as Campaign
          if (!draftCampaignId || cc?.id === draftCampaignId) setCampaign(cc)
        } catch {}
      }

      ;(async () => {
        let resolvedCampaignId = draftCampaignId
        if (!resolvedCampaignId) {
          const active = await getActiveCampaign()
          if (active.success && active.data?.id) resolvedCampaignId = active.data.id
        }
        if (!resolvedCampaignId) return
        const giftsRes = await getAvailablePrizes(resolvedCampaignId, draftCityId, draftCity, draftVenueId)
        if (giftsRes.success && giftsRes.data) setPrizes(giftsRes.data as any)
      })()
    } catch {}
  }, [draft, participantId])

  useEffect(() => {
    const supabase = createClient()
    const loadAdmin = async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth.user) {
        setIsAdmin(false)
        return
      }
      const { data: adminRow } = await supabase.from("admins").select("id").eq("id", auth.user.id).maybeSingle()
      setIsAdmin(!!adminRow)
    }
    loadAdmin()
  }, [])

  useEffect(() => {
    const maybeRedirectToFreshSpin = async () => {
      const supabase = createClient()

      if (participant.won) {
        setLoading(true)
        try {
          const baseCode = String(participant.code ?? "").trim()
          const insertBase: any = {
            name: participant.name,
            code: baseCode,
            city: participant.city,
            city_id: participant.city_id ?? null,
            venue_id: participant.venue_id ?? null,
            venue_type: participant.venue_type ?? null,
            agreed_to_terms: participant.agreed_to_terms ?? true,
            won: false,
            prize_id: null,
            campaign_id: participant.campaign_id ?? campaign?.id ?? null,
          }

          const firstId = crypto.randomUUID()
          const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
          if (!first.error) {
            cacheCampaign(campaign)
            router.replace(`/spin/${firstId}`)
            return
          }

          const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
          if (!isDup) throw first.error

          const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
          const secondId = crypto.randomUUID()
          const second = await supabase.from("participants").insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
          if (second.error) throw second.error

          cacheCampaign(campaign)
          router.replace(`/spin/${secondId}`)
          return
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erreur lors de la création d'un nouveau participant"
          setSpinError(msg)
        } finally {
          setLoading(false)
        }
      }

      const replayStartedAt = campaign?.theme?.replayStartedAt as string | undefined
      const participantCreatedAt = participant.created_at as string | undefined
      if (replayStartedAt && participantCreatedAt) {
        const participantTs = new Date(participantCreatedAt).getTime()
        const replayTs = new Date(replayStartedAt).getTime()
        if (Number.isFinite(participantTs) && Number.isFinite(replayTs) && participantTs < replayTs) {
          setLoading(true)
          try {
            const baseCode = String(participant.code ?? "").trim()
            const insertBase: any = {
              name: participant.name,
              code: baseCode,
              city: participant.city,
              city_id: participant.city_id ?? null,
              venue_id: participant.venue_id ?? null,
              venue_type: participant.venue_type ?? null,
              agreed_to_terms: participant.agreed_to_terms ?? true,
              won: false,
              prize_id: null,
              campaign_id: participant.campaign_id ?? campaign?.id ?? null,
            }

            const firstId = crypto.randomUUID()
            const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
            if (!first.error) {
              cacheCampaign(campaign)
              router.replace(`/spin/${firstId}`)
              return
            }

            const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
            if (!isDup) throw first.error

            const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
            const secondId = crypto.randomUUID()
            const second = await supabase.from("participants").insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
            if (second.error) throw second.error

            cacheCampaign(campaign)
            router.replace(`/spin/${secondId}`)
            return
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Erreur lors de la création d'un nouveau participant"
            setSpinError(msg)
          } finally {
            setLoading(false)
          }
        }
      }
    }

    maybeRedirectToFreshSpin()
  }, [campaign?.id, campaign?.theme?.replayStartedAt, participant, router])

  useEffect(() => {
    if (!isPersisted) return
    const sync = async () => {
      const spinData = await getSpinData(participantId)
      if (!spinData.success || !spinData.data) return
      setParticipant(spinData.data.participant as any)
      setCampaign(spinData.data.campaign as any)
      setPrizes((spinData.data.prizes as any) || [])
      setCityId(spinData.data.cityId)
      setHasSpun(!!(spinData.data.participant as any)?.won || !!(spinData.data.participant as any)?.prize_id)
    }
    sync()
  }, [isPersisted, participantId])

  useEffect(() => {
    if (!isPersisted) return
    const supabase = createClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let refreshInFlight = false

    const refreshPrizesFromServer = async () => {
      if (refreshInFlight) return
      refreshInFlight = true
      try {
        const spinData = await getSpinData(participantId)
        if (spinData.success && spinData.data) {
          setPrizes((spinData.data.prizes as any) || [])
          setCampaign(spinData.data.campaign as any)
          setCityId(spinData.data.cityId)
        }
      } finally {
        refreshInFlight = false
      }
    }

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshPrizesFromServer()
      }, 250)
    }

    const channel = supabase
      .channel("gifts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gifts" }, (payload) => {
        const newGift = payload.new as unknown as Prize
        if (effectiveCampaignId && newGift.campaign_id !== effectiveCampaignId) return
        if (!effectiveCampaignId && newGift.campaign_id) return

        setPrizes((prev) => {
          if (prev.find((p) => p.id === newGift.id)) return prev
          return [...prev, newGift]
        })
        scheduleRefresh()
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "gifts" }, (payload) => {
        const updated = payload.new as unknown as Prize
        setPrizes((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
        scheduleRefresh()
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "gifts" }, (payload) => {
        const oldId = (payload.old as { id: string }).id
        setPrizes((prev) => prev.filter((p) => p.id !== oldId))
        scheduleRefresh()
      })
      .subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [effectiveCampaignId, isPersisted, participantId])

  const wheelPrizes = useMemo(
    () =>
      prizes.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.image_url,
        color: p.color,
        available: p.available !== undefined ? p.available : p.current_winners < p.max_winners,
        is_prize: p.is_prize,
      })),
    [prizes],
  )

  const ensureParticipantExists = async () => {
    if (isPersisted) return { success: true as const }
    const name = String(participant.name || "").trim()
    const code = String(participant.code || "").trim()
    const city = String(participant.city || "").trim()
    const campaignId = participant.campaign_id || campaign?.id
    const meta = {
      city_id: participant.city_id ?? cityId ?? undefined,
      venue_id: participant.venue_id ?? undefined,
      venue_type: participant.venue_type ?? undefined,
    }
    const res = await submitParticipation(name, code, city, campaignId, meta as any, participantId)
    if (!res.success) return { success: false as const, error: res.error || "Erreur lors de l'enregistrement" }
    setIsPersisted(true)
    setParticipant((p) => ({ ...p, campaign_id: campaignId || p.campaign_id }))
    try {
      window.sessionStorage.removeItem(`${PARTICIPANT_DRAFT_PREFIX}${participantId}`)
    } catch {}
    return { success: true as const }
  }

  const handleSpinComplete = async (selectedPrizeId: string) => {
    try {
      setSpinError(null)
      const created = await ensureParticipantExists()
      if (!created.success) {
        setSpinError((created as any).error || "Erreur lors de l'enregistrement")
        return
      }
      const selectedPrize = prizes.find((p) => p.id === selectedPrizeId)

      const result = await finalizeSpin(participantId, selectedPrizeId, cityId, isAdmin)
      if (!result.success) {
        if (
          result.error &&
          (result.error.includes("limit reached") ||
            result.error.includes("Stock épuisé") ||
            result.error.includes("La période de participation") ||
            result.error.includes("The guidance period"))
        ) {
          if (result.error === "La période de participation est terminée pour aujourd'hui.") {
            setSpinError("La période de participation est terminée pour aujourd'hui.")
          } else {
            setSpinError("Dommage ! Ce cadeau est épuisé pour votre ville. Veuillez réessayer.")
          }
          return
        }
        throw new Error(result.error || "Failed to finalize spin")
      }

      if (selectedPrize) {
        setPrizes((prev) =>
          prev.map((p) =>
            p.id === selectedPrizeId ? { ...p, current_winners: Math.min(p.current_winners + 1, p.max_winners) } : p,
          ),
        )
      }

      const mapped = selectedPrize
        ? {
            id: selectedPrize.id,
            name: selectedPrize.name,
            imageUrl: selectedPrize.image_url,
            color: selectedPrize.color,
            is_prize: selectedPrize.is_prize,
          }
        : null
      setResultPrize(mapped)
      setHasSpun(true)
    } catch (error) {
      setSpinError("Une erreur est survenue. Veuillez réessayer.")
    }
  }

  const handleNoStock = async () => {
    try {
      const created = await ensureParticipantExists()
      if (!created.success) {
        setSpinError((created as any).error || "Erreur lors de l'enregistrement")
        return
      }
      const lockPrizeId = prizes.find((p) => p.is_prize === false)?.id || prizes[0]?.id || null
      const r = await markSpinAsLostNoStock(participantId, lockPrizeId)
      if (!r.success) {
        setSpinError(r.error || "Erreur lors de l'enregistrement")
        return
      }
      setParticipant((p) => ({ ...p, won: false, prize_id: lockPrizeId }))
      setSpinError("Stock épuisé.")
      setResultPrize(null)
      setHasSpun(true)
    } catch {
      setSpinError("Erreur lors de l'enregistrement")
    }
  }

  const handleReplay = async () => {
    if (creatingReplay) return
    setSpinError(null)
    setCreatingReplay(true)
    try {
      cacheCampaign(campaign)
      const supabase = createClient()
      const baseCode = String(participant.code ?? "").trim()
      const insertBase: any = {
        name: participant.name,
        code: baseCode,
        city: participant.city,
        city_id: participant.city_id ?? null,
        venue_id: participant.venue_id ?? null,
        venue_type: participant.venue_type ?? null,
        agreed_to_terms: true,
        won: false,
        prize_id: null,
        campaign_id: participant.campaign_id ?? campaign?.id ?? null,
      }

      const firstId = crypto.randomUUID()
      const first = await supabase.from("participants").insert({ ...insertBase, id: firstId })
      if (!first.error) {
        setCreatingReplay(false)
        setHasSpun(false)
        setResultPrize(null)
        cacheCampaign(campaign)
        router.replace(`/spin/${firstId}`)
        return
      }

      const isDup = first.error.code === "23505" || first.error.message?.toLowerCase().includes("duplicate")
      if (!isDup) throw first.error

      const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
      const secondId = crypto.randomUUID()
      const second = await supabase.from("participants").insert({ ...insertBase, id: secondId, code: `${baseCode}-${suffix}` })
      if (second.error) throw second.error

      setCreatingReplay(false)
      setHasSpun(false)
      setResultPrize(null)
      cacheCampaign(campaign)
      router.replace(`/spin/${secondId}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la création d'un nouveau participant"
      setSpinError(msg)
      setCreatingReplay(false)
    }
  }

  if (loading) {
    const bgUrl = campaign?.theme?.backgroundUrl || "/flag-back.jpg"
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
                {campaign?.theme?.logoUrl ? (
                  <img src={campaign.theme.logoUrl} alt="Logo" className="w-full h-full object-contain p-2 relative z-10" />
                ) : (
                  <img src="/orange.jpg" alt="Logo" className="w-full h-full object-contain p-2 relative z-10" />
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine pointer-events-none" />
              </div>
            </div>
            <div className="absolute inset-[-15px] border border-orange-500/30 rounded-full animate-[spin_15s_linear_infinite]" />
            <div className="absolute inset-[-25px] border border-white/10 rounded-full animate-[spin_20s_linear_infinite_reverse]" />
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <p className="text-white font-black tracking-[0.4em] uppercase text-xs opacity-50">Préparez-vous</p>
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-orange-500 animate-spin" />
                <p className="text-white font-black tracking-[0.2em] uppercase text-lg">Chargement</p>
              </div>
            </div>
            <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
              <div className="h-full bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600 w-full animate-[loading_2s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      </main>
    )
  }

  const bgUrl = campaign?.theme?.backgroundUrl || "/flag-back.jpg"

  return (
    <main className="min-h-screen relative overflow-hidden bg-black">
      {bgUrl ? (
        <img
          src={bgUrl}
          alt=""
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: "fill", filter: "blur(3px)", transform: "scale(1.0)" }}
        />
      ) : null}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      <div className="relative z-10 min-h-screen flex flex-col justify-center">
        <section className="w-full flex flex-col items-center justify-center px-6 md:px-12">
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-500">
            <SpinnerWheel
              participantName={participant.name}
              prizes={wheelPrizes}
              onSpinComplete={handleSpinComplete}
              onNoStock={handleNoStock}
              hasSpun={hasSpun}
              resultPrize={resultPrize}
              spinError={spinError}
              pointerSide="top"
              spinLabel="Tournez pour la Gloire!"
              theme="default"
              customColors={{
                primary: campaign?.theme?.primaryColor,
                secondary: campaign?.theme?.secondaryColor,
              }}
              campaignTheme={{
                backgroundUrl: campaign?.theme?.backgroundUrl,
              }}
            />

            {hasSpun && (
              <Button
                className="mt-8 w-auto min-w-44 rounded-2xl px-8 py-3 text-base font-semibold shadow-2xl transition-transform hover:scale-[1.02] active:scale-[0.99] ring-1 ring-white/15 backdrop-blur"
                style={
                  campaign?.theme?.primaryColor
                    ? { backgroundColor: campaign.theme.primaryColor, color: "white" }
                    : { background: "linear-gradient(135deg, #0f172a, #111827)", color: "white" }
                }
                onClick={handleReplay}
                disabled={creatingReplay}
              >
                {creatingReplay ? <Loader2 className="h-5 w-5 animate-spin" /> : "Nouveau tour"}
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
