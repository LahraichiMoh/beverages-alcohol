import { getCampaigns } from "@/app/actions/campaigns"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const { data: campaigns } = await getCampaigns()
  
  // Find Orange Money campaign to make it the active one
  const orangeMoney = campaigns?.find(c => c.name.toLowerCase().includes("orange money"))
  
  if (orangeMoney) {
    redirect(`/c/${orangeMoney.slug}`)
  }

  // Fallback if not found or if there are other campaigns
  const activeCampaigns = campaigns?.filter(c => c.is_active !== false) || []
  const headingPrimary = activeCampaigns?.[0]?.theme?.primaryColor || "#ff7900"
  const headingSecondary = activeCampaigns?.[0]?.theme?.secondaryColor || "#C5A572"

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
       {/* Header Section */}
       <div className="mb-12 text-center max-w-4xl mx-auto">
          {/* <div className="flex justify-center mb-6">
            <Image 
              src="/orange.jpg" 
              alt="Logo" 
              width={120} 
              height={120} 
              className="object-contain"
            />
          </div> */}
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl md:text-6xl mb-4">
            <span className="block" style={{ color: headingPrimary }}>Nos Campagnes</span>
            <span className="block" style={{ color: headingSecondary }}>En Cours</span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600">
            Choisissez une campagne ci-dessous pour participer et tenter de gagner des cadeaux exceptionnels !
          </p>
       </div>

       {/* Campaigns Grid */}
       <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:gap-10 w-full max-w-7xl px-2">
          {activeCampaigns.length > 0 ? (
            activeCampaigns.map(campaign => (
               <Card key={campaign.id} className="flex flex-col overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border-0 ring-1 ring-gray-200 bg-white h-full">
                  {/* Campaign Visual */}
                  <div className="relative">
                    <div className="relative h-56 w-full bg-gray-100 group overflow-hidden">
                      {campaign.theme?.backgroundUrl ? (
                        <Image
                          src={campaign.theme.backgroundUrl}
                          alt={campaign.name}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center h-full w-full text-white font-bold text-4xl"
                          style={{ backgroundColor: campaign.theme?.primaryColor || "#ff7900" }}
                        >
                          {campaign.name.charAt(0)}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                    </div>

                    {campaign.theme?.logoUrl && (
                      <div className="absolute left-6 bottom-0 translate-y-1/2 z-10">
                        <div
                          className="relative h-20 w-20 rounded-full bg-white shadow-lg p-1 ring-4 ring-white"
                          style={{
                            boxShadow: "0 14px 40px rgba(0,0,0,0.20)",
                          }}
                        >
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{
                              boxShadow: campaign.theme?.secondaryColor
                                ? `0 0 0 2px ${campaign.theme.secondaryColor}`
                                : undefined,
                            }}
                          />
                          <div className="relative h-full w-full rounded-full overflow-hidden bg-white">
                            <Image src={campaign.theme.logoUrl} alt="Campaign Logo" fill className="object-contain" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <CardHeader className="pt-12 pb-2 px-6">
                     <CardTitle
                       className="text-2xl font-bold line-clamp-1"
                       style={{ color: campaign.theme?.primaryColor || "#111827" }}
                     >
                       {campaign.name}
                     </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="flex-1 px-6 py-2">
                     <p className="text-gray-600 line-clamp-3 text-sm leading-relaxed">
                       {campaign.description || "Rejoignez-nous pour cette campagne exclusive et tentez votre chance !"}
                     </p>
                  </CardContent>
                  
                  <CardFooter className="bg-gray-50 px-6 py-6 border-t border-gray-100">
                     <Link href={`/c/${campaign.slug}`} className="w-full">
                        <Button 
                          className="w-full text-lg font-bold py-6 shadow-md hover:shadow-lg transition-all" 
                          style={{ 
                            backgroundColor: campaign.theme?.primaryColor || '#ff7900', 
                            color: 'white' 
                          }}
                        >
                           Participer
                        </Button>
                     </Link>
                  </CardFooter>
               </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
               <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-6">
                  <span className="text-2xl">🎁</span>
               </div>
               <h3 className="text-2xl font-bold text-gray-900 mb-2">Aucune campagne active</h3>
               <p className="text-gray-500 max-w-md mx-auto">
                 Revenez plus tard pour découvrir nos nouveaux jeux concours et événements.
               </p>
            </div>
          )}
       </div>
    </main>
  )
}
