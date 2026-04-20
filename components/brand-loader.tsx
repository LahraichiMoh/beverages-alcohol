"use client"

import { cn } from "@/lib/utils"

export function BrandLoader({
  logoUrl = "/orange.jpg",
  title = "Chargement...",
  className
}: {
  logoUrl?: string
  title?: string
  className?: string
}) {
  return (
    <div className={cn("flex min-h-[360px] w-full items-center justify-center p-6", className)}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur">
        <div className="flex flex-col items-center text-center">
          <div className="relative h-20 w-20">
            <div className="absolute inset-0 rounded-full bg-orange-500/15 blur-xl" />
            <div className="absolute inset-0 rounded-full border-2 border-orange-500/30 animate-pulse" />
            <div className="absolute inset-0 rounded-full border-2 border-slate-900/10" />
            <img
              src={logoUrl}
              alt="Logo"
              className="relative z-10 h-20 w-20 rounded-full bg-white object-contain p-2 shadow-sm ring-1 ring-slate-200"
            />
          </div>

          <div className="mt-6 text-xl font-semibold text-slate-900">{title}</div>
          <div className="mt-2 flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-500 [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-500 [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-500" />
          </div>
        </div>
      </div>
    </div>
  )
}

