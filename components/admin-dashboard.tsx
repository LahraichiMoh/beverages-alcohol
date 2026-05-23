"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CityManager } from "@/components/city-manager"
import { CampaignManager } from "@/components/campaign-manager"
import { Building2, LogOut, Megaphone, Shield } from "lucide-react"
import { logoutTeamAccess, refreshTeamAccess } from "@/app/actions/team"

type TeamPermissions = {
  can_view_participants: boolean
  can_view_stats: boolean
  can_view_gifts: boolean
  can_edit_gifts: boolean
}

type TeamAccessSingle = {
  id: string
  username: string
  campaign_id: string
  permissions: TeamPermissions
  campaign_slug: string
  campaign_name: string
}

type TeamAccessMulti = {
  username: string
  memberships: Array<{
    id: string
    campaign_id: string
    campaign_slug?: string
    campaign_name?: string
    permissions: TeamPermissions
  }>
}

interface AdminDashboardProps {
  userId: string
  teamAccess?: TeamAccessSingle | TeamAccessMulti
}

export function AdminDashboard({ userId, teamAccess }: AdminDashboardProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    if (teamAccess) {
      await logoutTeamAccess()
      router.push("/admin/team-login")
    } else {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/admin/login")
    }
  }

  const isMultiTeamAccess = !!teamAccess && "memberships" in teamAccess
  const initialMemberships = useMemo(() => (isMultiTeamAccess ? teamAccess.memberships : []), [isMultiTeamAccess, teamAccess])
  const [memberships, setMemberships] = useState(initialMemberships)
  const [activeCampaignId, setActiveCampaignId] = useState<string>(initialMemberships[0]?.campaign_id || "campaign")

  useEffect(() => {
    if (!isMultiTeamAccess) return
    setMemberships(initialMemberships)
    setActiveCampaignId(initialMemberships[0]?.campaign_id || "campaign")
  }, [isMultiTeamAccess, initialMemberships])

  useEffect(() => {
    if (!isMultiTeamAccess) return
    const interval = setInterval(async () => {
      const res = await refreshTeamAccess()
      if (!res.success) return
      if ("revokedAll" in res && res.revokedAll) {
        router.push("/admin/team-login")
        return
      }
      const next = "data" in res ? res.data.memberships : []
      setMemberships((prev) => {
        const prevKey = prev.map((m) => `${m.id}:${m.campaign_id}`).join("|")
        const nextKey = next.map((m) => `${m.id}:${m.campaign_id}`).join("|")
        return prevKey === nextKey ? prev : next
      })
      setActiveCampaignId((current) => {
        if (next.some((m) => m.campaign_id === current)) return current
        return next[0]?.campaign_id || "campaign"
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [isMultiTeamAccess, router])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/orange.jpg" alt="Logo" className="h-10 w-10 rounded-lg ring-1 ring-slate-200 bg-white object-contain" />
            <div className="min-w-0">
              <div className="text-xl font-extrabold text-slate-900 truncate">Tableau de bord</div>
              <div className="text-sm text-slate-600 truncate">Administration des campagnes</div>
            </div>
          </div>
          <Button onClick={handleSignOut} variant="admin" size="lg">
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {isMultiTeamAccess ? (
          <Tabs value={activeCampaignId} onValueChange={setActiveCampaignId} className="w-full">
            <div className="flex items-center justify-between gap-4 mb-6">
              <TabsList className="inline-flex h-12 w-full overflow-x-auto items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 justify-start">
                {memberships.map((m) => (
                  <TabsTrigger
                    key={m.campaign_id}
                    value={m.campaign_id}
                    className="flex-none rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    {m.campaign_name || m.campaign_slug || "Campagne"}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {memberships.map((m) => (
              <TabsContent key={m.campaign_id} value={m.campaign_id} className="mt-0">
                <CampaignManager
                  teamAccess={{
                    id: m.id,
                    username: (teamAccess as TeamAccessMulti).username,
                    campaign_id: m.campaign_id,
                    permissions: m.permissions,
                    campaign_slug: m.campaign_slug || "",
                    campaign_name: m.campaign_name || m.campaign_slug || "Campagne",
                  }}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Tabs defaultValue="campaigns" className="w-full">
            <div className="flex items-center justify-between gap-4 mb-6">
              <TabsList className="inline-flex h-12 items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
                <TabsTrigger
                  value="campaigns"
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
                >
                  {teamAccess ? <Shield className="mr-2 h-4 w-4" /> : <Megaphone className="mr-2 h-4 w-4" />}
                  {teamAccess && "campaign_name" in teamAccess ? teamAccess.campaign_name : "Campagnes"}
                </TabsTrigger>
                {!teamAccess && (
                  <TabsTrigger
                    value="cities"
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    Villes
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="campaigns" className="mt-0">
              <CampaignManager teamAccess={teamAccess as any} />
            </TabsContent>

            <TabsContent value="cities" className="mt-0">
              <CityManager />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  )
}
