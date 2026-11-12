import type { Configuracion, EstadoLead } from './tipos'

export const pesos = (v: number | null | undefined) =>
  v == null ? '—' : '$' + Math.round(Number(v)).toLocaleString('es-CO')

export const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim()

const zona = 'America/Bogota'

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: zona })

export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: zona })

export const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: zona })

export function haceCuanto(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

/** ¿El momento dado está fuera del horario laboral configurado? (hora de Bogotá) */
export function fueraDeHorario(config: Configuracion | null, fecha = new Date()) {
  if (!config) return false
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(fecha)
  const dias: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  const dia = dias[partes.find((p) => p.type === 'weekday')!.value]
  const hh = partes.find((p) => p.type === 'hour')!.value.replace('24', '00')
  const mm = partes.find((p) => p.type === 'minute')!.value
  const actual = `${hh}:${mm}`
  const franja = config.horario_laboral[String(dia)]
  if (!franja) return true
  return !(actual >= franja[0] && actual < franja[1])
}

export const ESTADOS: Record<EstadoLead, { etiqueta: string; plural: string; clase: string; punto: string }> = {
  nuevo: { etiqueta: 'Nuevo', plural: 'Nuevos', clase: 'bg-sky-50 text-sky-700 ring-sky-200', punto: 'bg-sky-500' },
  cotizado: { etiqueta: 'Cotizado', plural: 'Cotizados', clase: 'bg-indigo-50 text-indigo-700 ring-indigo-200', punto: 'bg-indigo-600' },
  listo_para_comprar: { etiqueta: 'Listo para comprar', plural: 'Listos para comprar', clase: 'bg-red-50 text-red-700 ring-red-200', punto: 'bg-urgente' },
  sin_respuesta: { etiqueta: 'Sin respuesta', plural: 'Sin respuesta', clase: 'bg-amber-50 text-amber-800 ring-amber-200', punto: 'bg-alerta' },
  cerrado: { etiqueta: 'Cerrado', plural: 'Cerrados', clase: 'bg-green-50 text-green-700 ring-green-200', punto: 'bg-exito' },
}
