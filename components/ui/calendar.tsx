"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  isWithinInterval,
  isAfter,
  isBefore
} from "date-fns"
import { fr } from "date-fns/locale"

export interface CalendarProps {
  selected?: { from: Date | undefined; to: Date | undefined }
  onSelect?: (range: { from: Date | undefined; to: Date | undefined }) => void
  className?: string
}

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const onDateClick = (day: Date) => {
    if (!onSelect) return

    if (!selected?.from || (selected.from && selected.to)) {
      // Start new selection
      onSelect({ from: day, to: undefined })
    } else {
      // Complete selection
      if (isBefore(day, selected.from)) {
        onSelect({ from: day, to: selected.from })
      } else {
        onSelect({ from: selected.from, to: day })
      }
    }
  }

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between px-2 py-2 border-b border-slate-100 mb-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-bold text-slate-900 capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: fr })}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const renderDays = () => {
    const days = ["lu", "ma", "me", "je", "ve", "sa", "di"]
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day) => (
          <div key={day} className="text-[10px] font-bold text-slate-400 uppercase text-center h-8 flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>
    )
  }

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const rows = []
    let days = []
    let day = startDate
    let formattedDate = ""

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, "d")
        const cloneDay = day
        
        const isSelected = selected?.from && isSameDay(day, selected.from) || (selected?.to && isSameDay(day, selected.to))
        const isRange = selected?.from && selected?.to && isWithinInterval(day, { start: selected.from, end: selected.to })
        const isStart = selected?.from && isSameDay(day, selected.from)
        const isEnd = selected?.to && isSameDay(day, selected.to)
        const isCurrentMonth = isSameMonth(day, monthStart)

        days.push(
          <div
            key={day.toString()}
            className={cn(
              "relative h-9 w-9 flex items-center justify-center text-sm cursor-pointer transition-all",
              !isCurrentMonth && "text-slate-300 pointer-events-none",
              isRange && "bg-orange-50",
              isStart && "rounded-l-md",
              isEnd && "rounded-r-md",
              !isRange && !isSelected && isCurrentMonth && "hover:bg-slate-100 rounded-md"
            )}
            onClick={() => onDateClick(cloneDay)}
          >
            <div className={cn(
              "z-10 w-8 h-8 flex items-center justify-center rounded-md transition-all",
              isSelected && "bg-orange-500 text-white font-bold shadow-sm",
              isRange && !isSelected && "text-orange-700 font-medium"
            )}>
              {formattedDate}
            </div>
          </div>
        )
        day = addDays(day, 1)
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      )
      days = []
    }
    return <div className="body">{rows}</div>
  }

  return (
    <div className={cn("w-[280px] bg-white rounded-xl shadow-xl border border-slate-200 p-2", className)}>
      {renderHeader()}
      <div className="px-1">
        {renderDays()}
        {renderCells()}
      </div>
    </div>
  )
}
