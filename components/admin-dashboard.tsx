"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CityManager } from "@/components/city-manager"
import { CampaignManager } from "@/components/campaign-manager"
import { Building2, LogOut, Megaphone, Shield } from "lucide-react"
import { logoutTeamAccess } from "@/app/actions/team"

interface AdminDashboardProps {
  userId: string
  teamAccess?: {
    id: string
    username: string
    campaign_id: string
    permissions: {
      can_view_participants: boolean
      can_view_stats: boolean
      can_view_gifts: boolean
      can_edit_gifts: boolean
    }
    campaign_slug: string
    campaign_name: string
  }
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
          <Button onClick={handleSignOut} className="bg-slate-900 text-white hover:bg-slate-800">
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <Tabs defaultValue="campaigns" className="w-full">
          <div className="flex items-center justify-between gap-4 mb-6">
            <TabsList className="inline-flex h-12 items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
              <TabsTrigger
                value="campaigns"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
              >
                {teamAccess ? <Shield className="mr-2 h-4 w-4" /> : <Megaphone className="mr-2 h-4 w-4" />}
                {teamAccess ? teamAccess.campaign_name : "Campagnes"}
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
            <CampaignManager teamAccess={teamAccess} />
          </TabsContent>

          <TabsContent value="cities" className="mt-0">
            <CityManager />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
