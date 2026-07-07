'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { SlidePanel } from '@/components/ui/SlidePanel'

interface Task {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
}

interface Props {
  task: Task
  onClose: () => void
}

export function ReplanifierModal({ task, onClose }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(task.start_date ?? '')
  const [endDate, setEndDate] = useState(task.end_date ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate) { setError('La date de début est obligatoire'); return }
    if (!endDate) { setError('La date de fin est obligatoire'); return }
    if (endDate < startDate) { setError('La date de fin ne peut pas être antérieure à la date de début'); return }
    setLoading(true)
    setError(null)

    const { error: err } = await mutationClient()
      .from('tasks')
      .update({ start_date: startDate, end_date: endDate })
      .eq('id', task.id)

    if (err) { setError(err.message); setLoading(false); return }
    toast('Tâche replanifiée')
    router.refresh()
    onClose()
  }

  return (
    <SlidePanel onClose={onClose} title="Replanifier" backdropZ="z-[9001]" panelZ="z-[9002]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <p className="text-sm text-muted-foreground line-clamp-2 font-500">{task.title}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-600 text-foreground">
              Début <span className="text-destructive">*</span>
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-10"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-600 text-foreground">
              Fin <span className="text-destructive">*</span>
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-10"
              required
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Enregistrement…' : 'Replanifier'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        </div>
      </form>
    </SlidePanel>
  )
}
