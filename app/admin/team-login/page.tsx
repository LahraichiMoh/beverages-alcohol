"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loginTeamAccess } from "@/app/actions/team"
import { Eye, EyeOff, Loader2, Shield } from "lucide-react"
import { toast } from "sonner"

export default function TeamLoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await loginTeamAccess(username, password)

      if (result.success) {
        toast.success("Connexion réussie")
        router.push("/admin/dashboard")
        router.refresh()
      } else {
        toast.error(result.error || "Échec de la connexion")
      }
    } catch (err) {
      toast.error("Une erreur s'est produite")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-none bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-orange-100 p-3 rounded-2xl shadow-inner">
              <Shield className="h-10 w-10 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Accès Équipe
          </CardTitle>
          <CardDescription>
            Connectez-vous pour consulter les données de la campagne
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Identifiant</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="votre email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="*******"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full font-bold text-lg h-12 bg-orange-600 hover:bg-orange-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
            
            <div className="pt-4 text-center">
              <Button variant="link" onClick={() => router.push("/admin/login")} className="text-slate-500 text-xs">
                Accès Super Admin
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
