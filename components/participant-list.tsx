"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowUpDown, CalendarDays, Download, Loader2, Trophy, Users, Filter, X, Calendar as CalendarIcon, MapPin, UserCheck } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { countCampaignParticipantsForExport, getCampaignParticipantFilterOptions, getCampaignParticipantsExportChunk, getCampaignParticipantsPage } from "@/app/actions/admin-campaign"
import { BrandLoader } from "@/components/brand-loader"

interface Gift {
  id: string
  name: string
  image_url?: string
}

interface Participant {
  id: string
  name: string
  code: string
  city?: string
  won: boolean
  prize_id: string | null
  created_at: string
  campaign_id?: string
  participant_details?: {
    full_name: string
    phone: string
    gender: string
    age_range: string
    address: string
    usual_product: string
  }[]
}

interface ParticipantListProps {
  campaignId?: string
  onlyWinners?: boolean
  isTeamAccess?: boolean
  logoUrl?: string
}

export function ParticipantList({ campaignId, onlyWinners, isTeamAccess, logoUrl }: ParticipantListProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [prizeMap, setPrizeMap] = useState<{ [key: string]: Gift }>({})
  const [loading, setLoading] = useState(true)
  const [participantQuery, setParticipantQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [sortDesc, setSortDesc] = useState(true)
  const [winnersOnly, setWinnersOnly] = useState(!!onlyWinners)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [totalWinners, setTotalWinners] = useState(0)
  const [matchingTotal, setMatchingTotal] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [exportingAll, setExportingAll] = useState(false)
  const [exportingWinners, setExportingWinners] = useState(false)
  
  // New Filters
  const [selectedCity, setSelectedCity] = useState<string>("")
  const [selectedAnimator, setSelectedAnimator] = useState<string>("")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [availableAnimators, setAvailableAnimators] = useState<string[]>([])

  useEffect(() => {
    setWinnersOnly(!!onlyWinners)
  }, [onlyWinners])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(participantQuery.trim()), 250)
    return () => clearTimeout(t)
  }, [participantQuery])

  useEffect(() => {
    setPageIndex(0)
  }, [debouncedQuery, winnersOnly, campaignId])

  useEffect(() => {
    const loadGiftsAndFilters = async () => {
      try {
        if (!campaignId) return
        const res = await getCampaignParticipantFilterOptions(campaignId)
        if (!res.success) throw new Error((res as any).error || "Failed to load filters")

        const prizeMapTemp: { [key: string]: Gift } = {}
        res.data.gifts.forEach((gift) => {
          prizeMapTemp[gift.id] = gift
        })
        setPrizeMap(prizeMapTemp)
        setAvailableCities(res.data.cities)
        setAvailableAnimators(res.data.animators)
      } catch (error) {
        console.error("Error loading filters:", error)
      }
    }

    loadGiftsAndFilters()
  }, [campaignId])

  useEffect(() => {
    if (isTeamAccess) return
    const supabase = createClient()
    const channel = supabase
      .channel("participants-realtime-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants" },
        (payload) => {
          const row = payload.new as unknown as Participant
          // If filtering by campaign, ignore updates from other campaigns
          if (campaignId && row.campaign_id !== campaignId) return
          
          setReloadKey((v) => v + 1)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "participants" },
        (payload) => {
          const row = payload.new as unknown as Participant
           // If filtering by campaign, ignore updates from other campaigns
           if (campaignId && row.campaign_id !== campaignId) return

          setReloadKey((v) => v + 1)
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "participants" },
        (payload) => {
          const oldId = (payload.old as { id: string }).id
          if (campaignId) {
            setReloadKey((v) => v + 1)
          } else if (oldId) {
            setReloadKey((v) => v + 1)
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId])

  const pageCount = Math.max(1, Math.ceil(matchingTotal / pageSize))
  const fromIndex = pageIndex * pageSize
  const toIndex = Math.min(fromIndex + participants.length, matchingTotal)

  const resultsLabel = useMemo(() => {
    if (matchingTotal === 0) return "0 résultat"
    if (matchingTotal === 1) return "1 résultat"
    return `${matchingTotal} résultats`
  }, [matchingTotal])

  const exportCsv = async (options: { winnersOnly: boolean }) => {
    const setExporting = options.winnersOnly ? setExportingWinners : setExportingAll
    setExporting(true)
    try {
      if (!campaignId) return
      const rangePayload: { from?: string; to?: string } = {}
      if (dateRange.from) rangePayload.from = dateRange.from.toISOString()
      if (dateRange.to) {
        const toDate = new Date(dateRange.to)
        toDate.setHours(23, 59, 59, 999)
        rangePayload.to = toDate.toISOString()
      }

      const countRes = await countCampaignParticipantsForExport({
        campaignId,
        winnersOnly: options.winnersOnly,
        city: selectedCity || undefined,
        animator: selectedAnimator || undefined,
        q: debouncedQuery || undefined,
        range: rangePayload,
      })
      if (!countRes.success) throw new Error(countRes.error || "Count failed")
      const total = countRes.data.total

      const chunkSize = 1000
      const allRows: any[] = []
      for (let offset = 0; offset < total; offset += chunkSize) {
        const rowsRes = await getCampaignParticipantsExportChunk({
          campaignId,
          winnersOnly: options.winnersOnly,
          offset,
          limit: chunkSize,
          city: selectedCity || undefined,
          animator: selectedAnimator || undefined,
          q: debouncedQuery || undefined,
          range: rangePayload,
        })
        if (!rowsRes.success) throw new Error(rowsRes.error || "Export fetch failed")
        const rows = rowsRes.data.rows || []
        allRows.push(...rows)
        if (rows.length < chunkSize) break
      }

      const columns = [
        "name",
        "code",
        "city",
        "full_name",
        "phone",
        "gender",
        "age_range",
        "address",
        "usual_product",
        "prize_name",
        "created_at",
      ]

      const escapeCsv = (value: unknown) => {
        if (value === null || value === undefined) return ""
        const s = String(value)
        const needsQuotes = /[",\n\r]/.test(s)
        const escaped = s.replaceAll('"', '""')
        return needsQuotes ? `"${escaped}"` : escaped
      }

      const lines: string[] = []
      lines.push(columns.join(","))
      for (const r of allRows) {
        const prizeId = (r as any).prize_id as string | null | undefined
        const prizeName = prizeId && prizeMap[prizeId] ? prizeMap[prizeId].name : ""
        const details = (r as any).participant_details?.[0] || {}
        const rowObj = { 
          ...(r as any), 
          prize_name: prizeName,
          full_name: details.full_name || "",
          phone: details.phone || "",
          gender: details.gender || "",
          age_range: details.age_range || "",
          address: details.address || "",
          usual_product: details.usual_product || "",
        }
        lines.push(columns.map((c) => escapeCsv((rowObj as any)[c])).join(","))
      }

      const csv = lines.join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      const scope = campaignId ? `campaign-${campaignId}` : "all-campaigns"
      const subset = options.winnersOnly ? "winners" : "participants"
      a.download = `${scope}-${subset}-${date}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("Export CSV failed:", e)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    // Wait until both dates are selected if a selection has started
    if (dateRange.from && !dateRange.to) return

    const loadCountsAndPage = async () => {
      setLoading(true)
      try {
        if (!campaignId) return
        const rangePayload: { from?: string; to?: string } = {}
        if (dateRange.from) rangePayload.from = dateRange.from.toISOString()
        if (dateRange.to) {
          const toDate = new Date(dateRange.to)
          toDate.setHours(23, 59, 59, 999)
          rangePayload.to = toDate.toISOString()
        }

        const res = await getCampaignParticipantsPage({
          campaignId,
          winnersOnly,
          sortDesc,
          pageIndex,
          pageSize,
          city: selectedCity || undefined,
          animator: selectedAnimator || undefined,
          q: debouncedQuery || undefined,
          range: rangePayload,
        })
        if (!res.success) throw new Error(res.error || "Failed to load participants")

        setParticipants(res.data.participants as Participant[])
        setMatchingTotal(res.data.matchingTotal)
        setTotalParticipants(res.data.totalParticipants)
        setTotalWinners(res.data.totalWinners)
      } catch (error) {
        console.error("Error loading data:", error)
        setParticipants([])
        setMatchingTotal(0)
      } finally {
        setLoading(false)
      }
    }

    loadCountsAndPage()
  }, [campaignId, debouncedQuery, pageIndex, pageSize, reloadKey, sortDesc, winnersOnly, selectedCity, selectedAnimator, dateRange])

  const displayedParticipants = participants

  if (loading) {
    return <BrandLoader logoUrl={logoUrl} title="Chargement des participants..." />
  }
  
  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Participants</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-orange-100 text-orange-700 p-2">
                            <Users className="size-5" />
                        </div>
                        <p className="text-3xl font-bold text-orange-600">{totalParticipants}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full"
                      disabled={exportingAll || totalParticipants === 0}
                      onClick={() => exportCsv({ winnersOnly: false })}
                    >
                      {exportingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      Télécharger CSV (tout)
                    </Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">Gagnants</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-green-100 text-green-700 p-2">
                            <Trophy className="size-5" />
                        </div>
                        <p className="text-3xl font-bold text-green-600">{totalWinners}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full"
                      disabled={exportingWinners || totalWinners === 0}
                      onClick={() => exportCsv({ winnersOnly: true })}
                    >
                      {exportingWinners ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      Télécharger CSV (gagnants)
                    </Button>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
            <CardTitle>Liste des participants</CardTitle>
            <CardDescription>{totalParticipants} entrées au total</CardDescription>
            </CardHeader>
            <CardContent>
            {/* Filters Section */}
            <div className="flex flex-wrap gap-3 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Recherche</Label>
                <div className="relative">
                  <Input
                    placeholder="Nom, code, ville..."
                    value={participantQuery}
                    onChange={(e) => setParticipantQuery(e.target.value)}
                    className="pl-9 bg-white border-slate-200 focus:ring-orange-500"
                  />
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[160px] flex-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Ville</Label>
                <div className="relative">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 appearance-none"
                  >
                    <option value="">Toutes les villes</option>
                    {availableCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[160px] flex-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Animateur</Label>
                <div className="relative">
                  <select
                    value={selectedAnimator}
                    onChange={(e) => setSelectedAnimator(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 appearance-none"
                  >
                    <option value="">Tous les animateurs</option>
                    {availableAnimators.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Période</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-white border-slate-200 h-10",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "dd MMM", { locale: fr })} - {format(dateRange.to, "dd MMM", { locale: fr })}</>
                        ) : (
                          format(dateRange.from, "dd MMM yyyy", { locale: fr })
                        )
                      ) : (
                        <span>Toutes les dates</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      selected={dateRange}
                      onSelect={(newRange: any) => setDateRange({ from: newRange?.from, to: newRange?.to })}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-end gap-2 pt-5">
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-10 w-10 border-slate-200"
                  onClick={() => {
                    setSelectedCity("")
                    setSelectedAnimator("")
                    setDateRange({ from: undefined, to: undefined })
                    setParticipantQuery("")
                  }}
                  title="Réinitialiser les filtres"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setSortDesc((v) => !v)}>
                  <ArrowUpDown className="h-4 w-4" />
                  Date {sortDesc ? "desc" : "asc"}
                </Button>
                {!onlyWinners && (
                  <Button
                    type="button"
                    variant={winnersOnly ? "default" : "outline"}
                    className="w-full sm:w-auto"
                    onClick={() => setWinnersOnly((v) => !v)}
                  >
                    <Trophy className="h-4 w-4" />
                    Uniquement les gagnants
                  </Button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{resultsLabel}</div>
            </div>
            
            {/* Mobile View */}
            <div className="sm:hidden space-y-3">
                {displayedParticipants.map((p) => {
                const details = p.participant_details?.[0]
                return (
                <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold">{details?.full_name || p.name}</span>
                      {details && (
                        <div className="flex flex-col">
                          <span className="text-xs font-mono text-slate-700">{details.phone}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                            {details.gender} • {details.age_range}
                          </span>
                        </div>
                      )}
                    </div>
                    {p.won ? (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        <Trophy className="size-3.5" /> Gagné
                        </span>
                    ) : (
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-semibold">
                        En attente
                        </span>
                    )}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs">{p.code}</span>
                        {p.city && (
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase">{p.city}</span>
                        )}
                    </div>
                    {details && (
                      <div className="mb-2 p-2 bg-slate-50 rounded border border-slate-100">
                        <div className="text-[11px] font-medium text-slate-700 truncate">{details.usual_product}</div>
                        <div className="text-[10px] text-slate-400 truncate italic">{details.address}</div>
                      </div>
                    )}
                    {p.won && p.prize_id && prizeMap[p.prize_id] && (
                        <div className="mt-2 flex items-center gap-2 text-amber-700 font-medium">
                            {(prizeMap[p.prize_id].image_url?.startsWith("/") || prizeMap[p.prize_id].image_url?.startsWith("http")) && (
                                <img src={prizeMap[p.prize_id].image_url || ""} alt={prizeMap[p.prize_id].name} className="w-5 h-5 object-contain rounded" />
                            )}
                            <span>{prizeMap[p.prize_id].name}</span>
                        </div>
                    )}
                     <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {new Date(p.created_at).toLocaleString("fr-FR")}
                    </div>
                    </div>
                </div>
                )})}
            </div>

            {/* Desktop View */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="max-h-[65vh] overflow-auto">
                <table className="min-w-[1020px] w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur border-b border-gray-200">
                    <tr className="text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3 text-left">Nom (Animateur)</th>
                      <th className="px-4 py-3 text-left">Participant</th>
                      <th className="px-4 py-3 text-left">Poste</th>
                      <th className="px-4 py-3 text-left">Ville</th>
                      <th className="px-4 py-3 text-left">Détails</th>
                      <th className="px-4 py-3 text-left">Résultat</th>
                      <th className="px-4 py-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                          Aucun participant trouvé
                        </td>
                      </tr>
                    ) : (
                      displayedParticipants.map((row) => {
                        const prize = row.prize_id ? prizeMap[row.prize_id] : null
                        const details = row.participant_details?.[0]
                        return (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{row.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {details ? (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-900">{details.full_name}</span>
                                  <span className="text-xs text-slate-600 font-mono">{details.phone}</span>
                                  <span className="text-[10px] text-slate-500">{details.gender}, {details.age_range}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">Pas de détails</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{row.code}</td>
                            <td className="px-4 py-3">
                              {row.city ? (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                  {row.city}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {details ? (
                                <div className="flex flex-col max-w-[200px]">
                                  <span className="text-xs font-medium truncate" title={details.usual_product}>{details.usual_product}</span>
                                  <span className="text-[10px] text-slate-400 truncate" title={details.address}>{details.address}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.won && prize ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                                  <Trophy className="h-3.5 w-3.5" />
                                  {prize.name}
                                </span>
                              ) : row.won ? (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                                  Gagné (Inconnu)
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                  Perdu
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-slate-500 whitespace-nowrap">
                              {new Date(row.created_at).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {matchingTotal === 0 ? (
                  "Affichage 0 sur 0"
                ) : (
                  <>Affichage {fromIndex + 1}–{toIndex} sur {matchingTotal}</>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm w-full sm:w-auto"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPageIndex(0)
                  }}
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={200}>200 / page</option>
                </select>
                <div className="text-sm text-slate-600 text-center sm:text-left">
                  Page {Math.min(pageCount, pageIndex + 1)} / {pageCount}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={pageIndex <= 0}
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={pageIndex >= pageCount - 1}
                    onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </div>
            </CardContent>
        </Card>
    </div>
  )
}
