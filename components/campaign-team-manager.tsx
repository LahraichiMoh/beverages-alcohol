"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Shield, Loader2, Save, UserPlus, Key } from "lucide-react"
import { toast } from "sonner"
import { getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember, type TeamMember } from "@/app/actions/team"

interface CampaignTeamManagerProps {
  campaignId: string
  campaignName: string
}

export function CampaignTeamManager({ campaignId, campaignName }: CampaignTeamManagerProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  
  // New member form
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [permissions, setPermissions] = useState({
    can_view_participants: true,
    can_view_stats: true,
    can_view_gifts: true,
    can_edit_gifts: false
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadMembers()
  }, [campaignId])

  const loadMembers = async () => {
    setLoading(true)
    const res = await getTeamMembers(campaignId)
    if (res.success && res.data) {
      setMembers(res.data)
    }
    setLoading(false)
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    
    setSaving(true)
    const res = await createTeamMember({
      campaign_id: campaignId,
      username,
      password,
      permissions
    })

    if (res.success && res.data) {
      setMembers([res.data, ...members])
      setShowAddForm(false)
      setUsername("")
      setPassword("")
      toast.success("Membre d'équipe ajouté")
    } else {
      toast.error("Erreur: " + res.error)
    }
    setSaving(false)
  }

  const handleDeleteMember = async (id: string) => {
    const res = await deleteTeamMember(id)
    if (res.success) {
      setMembers(members.filter(m => m.id !== id))
      toast.success("Membre supprimé")
    } else {
      toast.error("Erreur: " + res.error)
    }
  }

  const togglePermission = async (member: TeamMember, key: keyof TeamMember['permissions']) => {
    const newPermissions = { ...member.permissions, [key]: !member.permissions[key] }
    const res = await updateTeamMember(member.id, { permissions: newPermissions })
    if (res.success) {
      setMembers(members.map(m => m.id === member.id ? { ...m, permissions: newPermissions } : m))
      toast.success("Permissions mises à jour")
    } else {
      toast.error("Erreur lors de la mise à jour")
    }
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Gestion de l'équipe
          </h3>
          <p className="text-sm text-slate-500">Gérez les accès pour {campaignName}</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Annuler" : <><UserPlus className="mr-2 h-4 w-4" /> Ajouter un accès</>}
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-orange-100 bg-orange-50/30">
          <CardHeader>
            <CardTitle className="text-base">Nouvel accès équipe</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tm-username">Identifiant</Label>
                  <Input 
                    id="tm-username" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    placeholder="ex: jean.dupont" 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tm-password">Mot de passe</Label>
                  <div className="relative">
                    <Input 
                      id="tm-password" 
                      type="password" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      placeholder="••••••••" 
                      required
                    />
                    <Key className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Permissions</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-200">
                    <Checkbox 
                      id="p-participants" 
                      checked={permissions.can_view_participants} 
                      onCheckedChange={checked => setPermissions({...permissions, can_view_participants: !!checked})} 
                    />
                    <Label htmlFor="p-participants" className="text-sm font-medium leading-none cursor-pointer">Voir les participants</Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-200">
                    <Checkbox 
                      id="p-stats" 
                      checked={permissions.can_view_stats} 
                      onCheckedChange={checked => setPermissions({...permissions, can_view_stats: !!checked})} 
                    />
                    <Label htmlFor="p-stats" className="text-sm font-medium leading-none cursor-pointer">Voir les statistiques</Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-200">
                    <Checkbox 
                      id="p-gifts" 
                      checked={permissions.can_view_gifts} 
                      onCheckedChange={checked => setPermissions({...permissions, can_view_gifts: !!checked})} 
                    />
                    <Label htmlFor="p-gifts" className="text-sm font-medium leading-none cursor-pointer">Voir les cadeaux</Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-slate-200">
                    <Checkbox 
                      id="p-edit-gifts" 
                      checked={permissions.can_edit_gifts} 
                      onCheckedChange={checked => setPermissions({...permissions, can_edit_gifts: !!checked})} 
                    />
                    <Label htmlFor="p-edit-gifts" className="text-sm font-medium leading-none cursor-pointer text-orange-600 font-bold">Modifier les cadeaux</Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white font-bold">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Créer l'accès
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {members.map(member => (
          <Card key={member.id} className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                  {member.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{member.username}</div>
                  <div className="text-xs text-slate-500">Ajouté le {new Date(member.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <BadgePermission 
                  label="Participants" 
                  active={member.permissions.can_view_participants} 
                  onClick={() => togglePermission(member, 'can_view_participants')}
                />
                <BadgePermission 
                  label="Stats" 
                  active={member.permissions.can_view_stats} 
                  onClick={() => togglePermission(member, 'can_view_stats')}
                />
                <BadgePermission 
                  label="Cadeaux" 
                  active={member.permissions.can_view_gifts} 
                  onClick={() => togglePermission(member, 'can_view_gifts')}
                />
                <BadgePermission 
                  label="Edit" 
                  active={member.permissions.can_edit_gifts} 
                  onClick={() => togglePermission(member, 'can_edit_gifts')}
                  isCritical
                />
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDeleteMember(member.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}

        {members.length === 0 && !showAddForm && (
          <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <Shield className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Aucun membre d'équipe configuré</p>
            <Button variant="link" onClick={() => setShowAddForm(true)} className="text-orange-600">Ajouter le premier accès</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function BadgePermission({ label, active, onClick, isCritical }: { label: string, active: boolean, onClick: () => void, isCritical?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all border",
        active 
          ? (isCritical ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-emerald-100 text-emerald-700 border-emerald-200")
          : "bg-slate-50 text-slate-400 border-slate-200 grayscale opacity-60"
      )}
    >
      {label}
    </button>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ")
}
