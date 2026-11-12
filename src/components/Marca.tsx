import clsx from 'clsx'
import type { EstadoLead } from '../lib/tipos'
import { ESTADOS } from '../lib/formato'
import { Flame, Clock, FileText, Sparkles, CheckCircle2 } from 'lucide-react'

export function Simbolo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#4F46E5" />
      <path d="M20 14v36M20 34l18-20M27 28l13 22" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="48" cy="16" r="6" fill="#16A34A" stroke="#fff" strokeWidth="2.5" />
    </svg>
  )
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Simbolo />
      <div className="leading-tight">
        <div className={clsx('text-lg font-semibold tracking-tight', claro ? 'text-white' : 'text-noche')}>kineta flow</div>
        <div className={clsx('text-[10px] uppercase tracking-[0.14em]', claro ? 'text-indigo-200' : 'text-slate-500')}>by Kineta Lab</div>
      </div>
    </div>
  )
}

const ICONOS: Record<EstadoLead, typeof Flame> = {
  nuevo: Sparkles, cotizado: FileText, listo_para_comprar: Flame, sin_respuesta: Clock, cerrado: CheckCircle2,
}

/** Etiqueta de estado: color + ícono + texto (el color nunca es el único portador de significado) */
export function EtiquetaEstado({ estado, className }: { estado: EstadoLead; className?: string }) {
  const e = ESTADOS[estado]
  const Icono = ICONOS[estado]
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', e.clase, className)}>
      <Icono className="h-3 w-3" aria-hidden="true" />
      {e.etiqueta}
    </span>
  )
}

export function Avatar({ nombre, className }: { nombre: string; className?: string }) {
  const iniciales = nombre.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  const colores = ['bg-indigo-100 text-indigo-700', 'bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-800', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700']
  const i = [...nombre].reduce((a, c) => a + c.charCodeAt(0), 0) % colores.length
  return (
    <span className={clsx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', colores[i], className ?? 'h-9 w-9 text-xs')}>
      {iniciales}
    </span>
  )
}

export function BannerDemo() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-1.5 text-center">
      Prototipo con <strong>datos de demostración</strong> (negocios y clientes ficticios). El canal de WhatsApp se representa con el simulador.
    </div>
  )
}
