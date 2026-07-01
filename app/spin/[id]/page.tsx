import { notFound } from "next/navigation"
import SpinPageClient from "@/components/spin-page-client"
import { getSpinData } from "@/app/actions/finalize-spin"

export const dynamic = "force-dynamic"

export default async function SpinPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: Promise<{ draft?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const isDraft = resolvedSearchParams?.draft === "1"
  const res = await getSpinData(id)
  if (!res.success || !res.data) {
    if (!isDraft) notFound()
    return (
      <SpinPageClient
        participantId={id}
        initialParticipant={{ id, name: "", code: "", city: "", won: false, prize_id: null } as any}
        initialCampaign={null}
        initialPrizes={[]}
        initialCityId={undefined}
        draft={true}
      />
    )
  }

  return (
    <SpinPageClient
      participantId={id}
      initialParticipant={res.data.participant as any}
      initialCampaign={res.data.campaign as any}
      initialPrizes={(res.data.prizes as any) || []}
      initialCityId={res.data.cityId}
    />
  )
}
