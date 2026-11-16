import clsx from 'clsx'
import { FileText, Bot, UserRound, Download } from 'lucide-react'
import { hora } from '../lib/formato'
import { abrirCotizacionPdf } from '../lib/pdf'
import type { Mensaje } from '../lib/tipos'

/** Burbuja de mensaje. modo "panel" = vista del negocio; modo "whatsapp" = vista del cliente final */
export function Burbuja({ m, modo, numeroCot, onBoton }: {
  m: Mensaje; modo: 'panel' | 'whatsapp'; numeroCot?: string; onBoton?: (t: string) => void
}) {
  if (m.emisor === 'sistema') {
    if (modo === 'whatsapp') return null
    return <div className="my-2 text-center"><span className="rounded-full bg-slate-200/80 px-3 py-1 text-[11px] text-slate-600">{m.contenido}</span></div>
  }
  const deCliente = m.emisor === 'cliente'
  // En el panel, el cliente va a la izquierda; en WhatsApp (vista del cliente), sus mensajes van a la derecha
  const derecha = modo === 'whatsapp' ? deCliente : !deCliente
  const adj = m.adjunto

  return (
    <div className={clsx('my-1 flex', derecha ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[82%] rounded-xl px-3 py-2 text-sm shadow-sm',
        modo === 'whatsapp'
          ? (derecha ? 'bg-[#D9FDD3] rounded-tr-sm' : 'bg-white rounded-tl-sm')
          : deCliente ? 'bg-white border border-slate-200 rounded-tl-sm' : m.emisor === 'ia' ? 'bg-indigo-50 border border-indigo-100 rounded-tr-sm' : 'bg-noche text-white rounded-tr-sm')}>
        {modo === 'panel' && !deCliente && (
          <div className={clsx('mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide', m.emisor === 'ia' ? 'text-indigo-600' : 'text-indigo-200')}>
            {m.emisor === 'ia'
              ? <><Bot className="h-3 w-3" />Asistente IA{m.motor && <span className="font-normal normal-case tracking-normal text-indigo-400">· {m.motor === 'claude' ? 'interpretado por Claude' : 'motor de reglas'}</span>}</>
              : <><UserRound className="h-3 w-3" />Asesor</>}
          </div>
        )}
        {adj?.tipo === 'cotizacion' && (
          <button onClick={() => abrirCotizacionPdf(adj.cotizacion_id)}
            className={clsx('mb-2 flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition',
              modo === 'whatsapp' ? 'bg-slate-100 hover:bg-slate-200' : 'bg-white border border-indigo-100 hover:bg-indigo-50')}>
            <span className="rounded-md bg-urgente p-2 text-white"><FileText className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-noche">{numeroCot ?? 'Cotización'}.pdf</span>
              <span className="text-[11px] text-slate-500">Toca para abrir el PDF</span>
            </span>
            <Download className="h-4 w-4 text-slate-400" />
          </button>
        )}
        <p className="whitespace-pre-wrap leading-snug">{m.contenido}</p>
        <div className={clsx('mt-0.5 text-right text-[10px]', modo === 'panel' && m.emisor === 'asesor' ? 'text-slate-300' : 'text-slate-400')}>{hora(m.creado_en)}</div>
        {adj?.tipo === 'botones' && (
          <div className="-mx-3 -mb-2 mt-2 border-t border-slate-200/70">
            {adj.opciones.map((o) => (
              <button key={o} disabled={!onBoton} onClick={() => onBoton?.(o)}
                className="block w-full border-b border-slate-200/70 py-2 text-center text-sm font-medium text-sky-600 last:border-0 enabled:hover:bg-slate-50 disabled:cursor-default">
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
