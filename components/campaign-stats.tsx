"use client"

import { useEffect, useState, useMemo } from "react"
import { getCampaignStatsRows } from "@/app/actions/admin-campaign"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Users, MapPin, CalendarDays, PieChart as PieChartIcon, Filter, X, ArrowRight, Calendar as CalendarIcon } from "lucide-react"
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
  PieChart,
  Pie,
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

      const res = await getCampaignStatsRows({ campaignId, range: rangePayload })
      if (res.success) setData(res.data.rows || [])
      else console.error("Error fetching stats:", res.error)
      setLoading(false)
    }

    fetchData()
  }, [campaignId, range])

  // Process data for charts
  const stats = useMemo(() => {
    const dailyMap: Record<string, { dateObj: Date; count: number }> = {}
    const cityGenderMap: Record<string, { Masculin: number; Féminin: number }> = {}
    const genderMap: Record<string, number> = { "Masculin": 0, "Féminin": 0 }
    const ageGenderMap: Record<string, { Masculin: number; Féminin: number }> = {}

    data.forEach((p) => {
      // Daily stats
      // Use YYYY-MM-DD as key for proper uniqueness and sorting
      const dateObj = new Date(p.created_at)
      const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
      
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { dateObj, count: 0 }
      }
      dailyMap[dateKey].count++

      // Gender stats
      const gender = p.participant_details?.[0]?.gender as "Masculin" | "Féminin" | undefined
      if (gender === "Masculin" || gender === "Féminin") {
        genderMap[gender]++
      }

      // City stats (split by gender)
      const city = p.city || "Inconnu"
      if (!cityGenderMap[city]) cityGenderMap[city] = { Masculin: 0, Féminin: 0 }
      if (gender === "Masculin") cityGenderMap[city].Masculin++
      if (gender === "Féminin") cityGenderMap[city].Féminin++

      // Age stats (split by gender)
      const ageRange = p.participant_details?.[0]?.age_range
      if (ageRange && (gender === "Masculin" || gender === "Féminin")) {
        if (!ageGenderMap[ageRange]) ageGenderMap[ageRange] = { Masculin: 0, Féminin: 0 }
        if (gender === "Masculin") ageGenderMap[ageRange].Masculin++
        if (gender === "Féminin") ageGenderMap[ageRange].Féminin++
      }
    })

    const sortedDailyData = Object.entries(dailyMap)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_, { dateObj, count }]) => ({
        name: dateObj.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        total: count
      }))
    
    const cityData = Object.entries(cityGenderMap)
      .map(([name, v]) => ({ name, Masculin: v.Masculin, Féminin: v.Féminin, total: v.Masculin + v.Féminin }))
      .sort((a, b) => b.total - a.total)
    const genderData = Object.entries(genderMap).filter(([_, total]) => total > 0).map(([name, value]) => ({ name, value }))

    const ageOrder = ["18-25", "26-35", "36-45", "46-55", "55+"]
    const ageData = Object.entries(ageGenderMap)
      .sort(([a], [b]) => {
        const ia = ageOrder.indexOf(a)
        const ib = ageOrder.indexOf(b)
        if (ia === -1 && ib === -1) return a.localeCompare(b)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
      .map(([name, v]) => ({ name, Masculin: v.Masculin, Féminin: v.Féminin }))

    return { dailyData: sortedDailyData, cityData, genderData, ageData }
  }, [data])

  const GENDER_COLORS: Record<string, string> = {
    "Masculin": "#000000",
    "Féminin": "#ff7900"
  }

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
                variant="outline"
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
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-400 hover:text-red-600 h-9">
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
                  <MapPin className="h-4 w-4" /> Villes Actives
                </CardDescription>
                <CardTitle className="text-3xl font-black text-slate-700">{stats.cityData.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-slate-50 border-slate-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-600 font-semibold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> Jours avec Activité
                </CardDescription>
                <CardTitle className="text-3xl font-black text-slate-700">{stats.dailyData.length}</CardTitle>
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

            {/* Distribution par sexe */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-orange-500" />
                  Répartition par sexe
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {stats.genderData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.genderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={GENDER_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">Aucune donnée de sexe disponible</div>
                )}
              </CardContent>
            </Card>

            {/* Répartition par âge (H/F) */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-500" />
                  Répartition par âge (H/F)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {stats.ageData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.ageData} layout="vertical" margin={{ left: 30, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} width={70} />
                      <Tooltip
                        cursor={{ fill: "#f1f5f9" }}
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      />
                      <Legend verticalAlign="bottom" height={28} />
                      <Bar dataKey="Masculin" stackId="age" fill="#000000" barSize={18} />
                      <Bar dataKey="Féminin" stackId="age" fill="#ff7900" barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-sm">Aucune donnée d'âge disponible</div>
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
          <CardContent style={{ height: Math.max(350, stats.cityData.length * 40) }}>
                {stats.cityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.cityData} layout="vertical" margin={{ left: 40, right: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} width={100} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={28} />
                      <Bar dataKey="Masculin" stackId="city" fill="#000000" radius={[0, 0, 0, 0]} barSize={20} />
                      <Bar
                        dataKey="Féminin"
                        stackId="city"
                        fill="#ff7900"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                      >
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
