"use client"

import { useEffect, useState, useMemo } from "react"
import { getCampaignGiftWins, getCampaignStatsRows } from "@/app/actions/admin-campaign"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Users, MapPin, CalendarDays, Gift as GiftIcon, UserCheck, X, Calendar as CalendarIcon } from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import { fr } from "date-fns/locale"
import {
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from "recharts"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { BrandLoader } from "@/components/brand-loader"

interface CampaignStatsProps {
  campaignId: string
  logoUrl?: string
}

export function CampaignStats({ campaignId, logoUrl }: CampaignStatsProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])
  const [giftWins, setGiftWins] = useState<any[]>([])
  
  // Date filter state
  const [range, setRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })

  useEffect(() => {
    // Wait until both dates are selected if a selection has started
    if (range.from && !range.to) return

    const fetchData = async () => {
      setLoading(true)
      
      const rangePayload: { from?: string; to?: string } = {}
      if (range.from) rangePayload.from = range.from.toISOString()
      if (range.to) {
        const toDate = new Date(range.to)
        toDate.setHours(23, 59, 59, 999)
        rangePayload.to = toDate.toISOString()
      }

      const [statsRes, giftRes] = await Promise.all([
        getCampaignStatsRows({ campaignId, range: rangePayload }),
        getCampaignGiftWins({ campaignId, range: rangePayload }),
      ])

      if (statsRes.success) setData(statsRes.data.rows || [])
      else console.error("Error fetching stats:", statsRes.error)

      if (giftRes.success) setGiftWins(giftRes.data.rows || [])
      else console.error("Error fetching gift wins:", giftRes.error)
      setLoading(false)
    }

    fetchData()
  }, [campaignId, range])

  // Process data for charts
  const stats = useMemo(() => {
    const dailyMap: Record<string, { dateObj: Date; count: number }> = {}
    const cityCountMap: Record<string, number> = {}
    const animatorCountMap: Record<string, number> = {}

    data.forEach((p) => {
      // Daily stats
      // Use YYYY-MM-DD as key for proper uniqueness and sorting
      const dateObj = new Date(p.created_at)
      const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
      
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { dateObj, count: 0 }
      }
      dailyMap[dateKey].count++

      const city = p.city || "Inconnu"
      cityCountMap[city] = (cityCountMap[city] || 0) + 1

      const animator = p.name || "Inconnu"
      animatorCountMap[animator] = (animatorCountMap[animator] || 0) + 1
    })

    const sortedDailyData = Object.entries(dailyMap)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_, { dateObj, count }]) => ({
        name: dateObj.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        total: count
      }))
    
    const cityData = Object.entries(cityCountMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

    const animatorData = Object.entries(animatorCountMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, 10)

    const giftWinsData = (giftWins || [])
      .filter((g) => (g?.is_prize ?? true) !== false)
      .map((g) => ({
        id: g.id,
        name: g.name,
        wins: Number(g.wins || 0),
        color: g.color || "#0ea5e9",
      }))
      .sort((a, b) => b.wins - a.wins || String(a.name).localeCompare(String(b.name)))

    const totalWinners = giftWinsData.reduce((acc, r) => acc + r.wins, 0)

    return { dailyData: sortedDailyData, cityData, animatorData, giftWinsData, totalWinners }
  }, [data, giftWins])

  const clearFilters = () => {
    setRange({ from: undefined, to: undefined })
  }

  return (
    <div className="space-y-6">
      {/* Unified Filter Section */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-slate-500 min-w-max">
          <CalendarDays className="h-5 w-5 text-orange-500" />
          <span className="text-sm font-semibold uppercase tracking-wider">Période</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="admin-outline"
                className={cn(
                  "w-[260px] justify-start text-left font-normal bg-slate-50/50 border-slate-200 hover:bg-slate-100",
                  !range.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                {range.from ? (
                  range.to ? (
                    <>
                      {format(range.from, "dd MMM", { locale: fr })} -{" "}
                      {format(range.to, "dd MMM", { locale: fr })}
                    </>
                  ) : (
                    format(range.from, "dd MMM yyyy", { locale: fr })
                  )
                ) : (
                  <span>Choisir une période</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                selected={range}
                onSelect={(newRange: any) => {
                  setRange({
                    from: newRange?.from,
                    to: newRange?.to
                  })
                }}
              />
            </PopoverContent>
          </Popover>

          {(range.from || range.to) && (
            <Button variant="admin-ghost" size="icon-sm" onClick={clearFilters} className="h-9 w-9 text-slate-500 hover:text-rose-700">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="ml-auto hidden md:block">
          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest text-right">
            {range.from && range.to ? (
              range.from.getTime() === range.to.getTime() 
                ? `Journée du ${format(range.from, "dd MMMM yyyy", { locale: fr })}` 
                : `Du ${format(range.from, "dd MMM", { locale: fr })} au ${format(range.to, "dd MMM", { locale: fr })}`
            ) : "Affichage de toutes les données"}
          </div>
        </div>
      </div>

      {loading && data.length === 0 ? (
        <BrandLoader logoUrl={logoUrl} title="Chargement des statistiques..." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-orange-50 border-orange-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-orange-600 font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Total Participants
                </CardDescription>
                <CardTitle className="text-3xl font-black text-orange-700">{data.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-slate-50 border-slate-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-600 font-semibold flex items-center gap-2">
                  <GiftIcon className="h-4 w-4" /> Total Gagnants
                </CardDescription>
                <CardTitle className="text-3xl font-black text-slate-800">{stats.totalWinners}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-slate-50 border-slate-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-600 font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Villes Actives
                </CardDescription>
                <CardTitle className="text-3xl font-black text-slate-700">{stats.cityData.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Participation par jour */}
            <Card className="lg:col-span-2 shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-orange-500" />
                  Participations par jour
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                {stats.dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="total" fill="#ff7900" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">Aucune donnée pour cette période</div>
                )}
              </CardContent>
            </Card>

            {/* Gagnants par cadeau */}
            <Card className="lg:col-span-2 shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GiftIcon className="h-5 w-5 text-orange-500" />
                  Gagnants par cadeau
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: Math.max(260, stats.giftWinsData.length * 44) }}>
                {stats.giftWinsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.giftWinsData} layout="vertical" margin={{ left: 40, right: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} width={140} />
                      <Tooltip
                        cursor={{ fill: "#f1f5f9" }}
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      />
                      <Bar dataKey="wins" radius={[6, 6, 6, 6]} barSize={18}>
                        {stats.giftWinsData.map((entry: any, index: number) => (
                          <Cell key={`gift-${entry.id || index}`} fill={entry.color || "#0ea5e9"} />
                        ))}
                        <LabelList dataKey="wins" position="right" fontSize={12} fill="#64748b" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">Aucune donnée de gains</div>
                )}
              </CardContent>
            </Card>

            {/* Participations par animateur */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-orange-500" />
                  Top animateurs (participations)
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: Math.max(260, stats.animatorData.length * 44) }}>
                {stats.animatorData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.animatorData} layout="vertical" margin={{ left: 40, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} width={140} />
                      <Tooltip
                        cursor={{ fill: "#f1f5f9" }}
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      />
                      <Bar dataKey="total" fill="#0ea5e9" radius={[6, 6, 6, 6]} barSize={18}>
                        <LabelList dataKey="total" position="right" fontSize={12} fill="#64748b" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">Aucune donnée animateur</div>
                )}
              </CardContent>
            </Card>

            {/* Top Villes */}
            <Card className="lg:col-span-2 shadow-sm border-slate-200">
              <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-500" />
              Participations par Ville
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: Math.max(320, stats.cityData.length * 40) }}>
                {stats.cityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.cityData} layout="vertical" margin={{ left: 40, right: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} width={140} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="total" fill="#ff7900" radius={[6, 6, 6, 6]} barSize={18}>
                        <LabelList dataKey="total" position="right" fontSize={12} fill="#64748b" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">Aucune donnée par ville</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
