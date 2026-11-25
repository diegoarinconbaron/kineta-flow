import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import clsx from 'clsx'
import { UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle2, Download, X, Loader2, Lock, Search } from 'lucide-react'
import { useSesion } from '../context/Sesion'
import { supabase } from '../lib/supabase'
import { fechaLarga, normalizar, pesos } from '../lib/formato'
import type { Catalogo as TCatalogo, Servicio } from '../lib/tipos'

interface FilaPrevia {
  nombre: string; categoria: string | null; nivel: string | null; unidad: string; tarifa: number | null
  estado: 'listo' | 'sin_tarifa' | 'revisar'; observacion: string | null; tarifa_texto?: string
}

const COLUMNAS: Record<string, string[]> = {
  nombre: ['servicio', 'nombre', 'producto', 'descripcion', 'materia'],
  categoria: ['categoria', 'area', 'tipo', 'linea'],
  nivel: ['nivel', 'segmento', 'grado'],
  unidad: ['unidad', 'unidad de cobro', 'cobro'],
  tarifa: ['tarifa', 'precio', 'valor', 'valor unitario', 'tarifa por hora', 'precio cop'],
}

function leerTarifa(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const limpio = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(limpio)
  return Number.isFinite(n) && limpio !== '' ? n : NaN
}

/** Lee el Excel y valida cada fila antes de publicarla (prevención de errores) */
function analizar(libro: XLSX.WorkBook): FilaPrevia[] {
  const hoja = libro.Sheets[libro.SheetNames[0]]
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' })
  if (!filas.length) return []
  const encabezados = Object.keys(filas[0])
  const mapa: Record<string, string | undefined> = {}
  for (const [campo, alias] of Object.entries(COLUMNAS)) mapa[campo] = encabezados.find((h) => alias.includes(normalizar(h)))
  if (!mapa.nombre) mapa.nombre = encabezados[0]
  const vistos = new Set<string>()
  const salida: FilaPrevia[] = []
  for (const f of filas) {
    const nombre = String(f[mapa.nombre!] ?? '').trim()
    if (!nombre) continue
    const nivel = mapa.nivel ? String(f[mapa.nivel] ?? '').trim() || null : null
    const tarifa = mapa.tarifa ? leerTarifa(f[mapa.tarifa]) : null
    const clave = normalizar(nombre + '|' + (nivel ?? ''))
    let estado: FilaPrevia['estado'] = 'listo'
    let observacion: string | null = null
    if (tarifa == null) { estado = 'sin_tarifa'; observacion = 'Falta la tarifa: no se cotizará y se pasará a un asesor' }
    else if (Number.isNaN(tarifa) || tarifa <= 0) { estado = 'revisar'; observacion = 'La tarifa no es un valor válido' }
    else if (vistos.has(clave)) { estado = 'revisar'; observacion = 'Servicio repetido en el archivo' }
    vistos.add(clave)
    salida.push({
      nombre, nivel, estado, observacion,
      categoria: mapa.categoria ? String(f[mapa.categoria] ?? '').trim() || null : null,
      unidad: mapa.unidad ? String(f[mapa.unidad] ?? '').trim().toLowerCase() || 'hora' : 'hora',
      tarifa: tarifa == null || Number.isNaN(tarifa) ? null : tarifa,
      tarifa_texto: tarifa != null && (Number.isNaN(tarifa) || tarifa <= 0) ? String(f[mapa.tarifa!] ?? '').trim() : undefined,
    })
  }
  return salida
}

const ESTADO_FILA = {
  listo: { t: 'Listo', c: 'bg-green-50 text-green-700 ring-green-200', I: CheckCircle2 },
  sin_tarifa: { t: 'Sin tarifa', c: 'bg-amber-50 text-amber-800 ring-amber-200', I: AlertTriangle },
  revisar: { t: 'Revisar', c: 'bg-red-50 text-red-700 ring-red-200', I: AlertTriangle },
}

function Chip({ estado }: { estado: FilaPrevia['estado'] }) {
  const e = ESTADO_FILA[estado]
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', e.c)}><e.I className="h-3 w-3" aria-hidden="true" />{e.t}</span>
}

export default function Catalogo() {
  const { negocio, esDueno, sesion } = useSesion()
  const [activo, setActivo] = useState<TCatalogo | null>(null)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [archivo, setArchivo] = useState<File | null>(null)
  const [progreso, setProgreso] = useState(0)
  const [previa, setPrevia] = useState<FilaPrevia[] | null>(null)
  const [publicando, setPublicando] = useState(false)
  const [exito, setExito] = useState('')
  const [error, setError] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const cargar = async () => {
    if (!negocio) return
    const { data: c } = await supabase.from('catalogos').select('*').eq('negocio_id', negocio.id).eq('estado', 'activo').maybeSingle()
    setActivo(c as TCatalogo)
    if (c) {
      const { data } = await supabase.from('servicios').select('*').eq('catalogo_id', c.id).order('categoria').order('nombre')
      setServicios((data ?? []) as Servicio[])
    }
  }
  useEffect(() => { cargar() }, [negocio?.id])

  const procesar = async (f: File) => {
    setError(''); setExito(''); setPrevia(null); setArchivo(f); setProgreso(8)
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { setError('El archivo debe ser de Excel (.xlsx o .xls) o CSV.'); setArchivo(null); return }
    // los CSV se leen como texto UTF-8 para conservar tildes y eñes; los Excel, como archivo binario
    const esCsv = /\.csv$/i.test(f.name)
    const contenido = esCsv ? await f.text() : await f.arrayBuffer()
    for (const p of [30, 55, 80]) { await new Promise((r) => setTimeout(r, 180)); setProgreso(p) }
    try {
      const filas = analizar(esCsv ? XLSX.read(contenido as string, { type: 'string' }) : XLSX.read(contenido))
      setProgreso(100)
      if (!filas.length) { setError('No encontramos servicios en la primera hoja del archivo. Revisa que tenga una columna «Servicio» y otra «Tarifa».'); return }
      setPrevia(filas)
    } catch { setError('No pudimos leer el archivo. Verifica que no esté protegido con contraseña.') }
  }

  const descargarOriginal = async (ruta: string) => {
    const ventana = window.open('', '_blank')
    const { data } = await supabase.storage.from('archivos').createSignedUrl(ruta, 600, { download: true })
    if (data?.signedUrl && ventana) ventana.location.href = data.signedUrl
    else ventana?.close()
  }

  const cancelar = () => { setPrevia(null); setArchivo(null); setProgreso(0); if (input.current) input.current.value = '' }

  const confirmar = async () => {
    if (!negocio || !previa || !archivo) return
    setPublicando(true); setError('')
    const { data: cat, error: e1 } = await supabase.from('catalogos').insert({
      negocio_id: negocio.id, archivo_origen: archivo.name, version: (activo?.version ?? 0) + 1, estado: 'borrador', creado_por: sesion?.user.id,
    }).select().single()
    if (e1 || !cat) { setError('No se pudo guardar el catálogo.'); setPublicando(false); return }
    // el archivo original queda guardado en Supabase Storage como respaldo de las tarifas
    const ruta = `${negocio.id}/catalogos/${cat.id}/${archivo.name.normalize('NFD').replace(/[^\w.\-]+/g, '_')}`
    const { error: eArchivo } = await supabase.storage.from('archivos').upload(ruta, archivo, { contentType: archivo.type || 'application/octet-stream' })
    if (!eArchivo) await supabase.from('catalogos').update({ archivo_ruta: ruta }).eq('id', cat.id)
    const { error: e2 } = await supabase.from('servicios').insert(previa.map((f) => ({
      catalogo_id: cat.id, negocio_id: negocio.id, nombre: f.nombre, categoria: f.categoria, nivel: f.nivel, unidad: f.unidad,
      tarifa: f.estado === 'listo' ? f.tarifa : null, estado: f.estado, observacion: f.observacion,
      palabras_clave: normalizar(`${f.nombre} ${f.categoria ?? ''}`),
    })))
    const { error: e3 } = e2 ? { error: e2 } : await supabase.rpc('activar_catalogo', { p_catalogo: cat.id })
    setPublicando(false)
    if (e3) { setError('No se pudo activar el catálogo. Tu catálogo anterior sigue activo.'); return }
    const listos = previa.filter((f) => f.estado === 'listo').length
    setExito(`Catálogo activado: el asistente ya cotiza con ${listos} servicios. Los ${previa.length - listos} que requieren revisión se pasarán a un asesor.`)
    cancelar(); cargar()
  }

  const descargarPlantilla = () => {
    const datos = servicios.map((s) => ({ Servicio: s.nombre, Categoría: s.categoria, Nivel: s.nivel, Unidad: s.unidad, Tarifa: s.tarifa ?? '' }))
    const hoja = XLSX.utils.json_to_sheet(datos.length ? datos : [{ Servicio: '', Categoría: '', Nivel: '', Unidad: 'hora', Tarifa: '' }])
    hoja['!cols'] = [{ wch: 44 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 12 }]
    const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, hoja, 'Tarifas')
    XLSX.writeFile(libro, `plantilla_tarifas_${normalizar(negocio?.nombre ?? '').replace(/ /g, '_')}.xlsx`)
  }

  /** Archivo de prueba: las tarifas actuales con un ajuste del 5 % (los servicios sin tarifa quedan vacíos) */
  const descargarEjemplo = () => {
    const datos = servicios.map((s) => ({
      Servicio: s.nombre, Categoría: s.categoria, Nivel: s.nivel, Unidad: s.unidad,
      Tarifa: s.tarifa == null ? '' : Math.round((Number(s.tarifa) * 1.05) / 1000) * 1000,
    }))
    const hoja = XLSX.utils.json_to_sheet(datos)
    hoja['!cols'] = [{ wch: 44 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 12 }]
    const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, hoja, 'Tarifas nuevas')
    XLSX.writeFile(libro, `tarifas_${normalizar(negocio?.nombre ?? '').replace(/ /g, '_')}_2027.xlsx`)
  }

  const listos = previa?.filter((f) => f.estado === 'listo').length ?? 0
  const conAlerta = previa ? previa.length - listos : 0
  const filtrados = servicios.filter((s) => normalizar(`${s.nombre} ${s.categoria} ${s.nivel}`).includes(normalizar(busqueda)))

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Catálogo y precios</h1>
          <p className="text-sm text-slate-500">El asistente solo cotiza con el catálogo activo. Los servicios sin tarifa nunca se cotizan.</p>
        </div>
        <button className="btn-secundario" onClick={descargarPlantilla}><Download className="h-4 w-4" />Descargar mi lista en Excel</button>
      </div>

      {exito && <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{exito}</div>}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="tarjeta p-5 lg:col-span-2">
          <h2 className="font-semibold">Actualizar lista de tarifas</h2>
          {!esDueno ? (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600"><Lock className="h-4 w-4" />Solo el dueño del negocio puede cambiar el catálogo. Puedes consultarlo abajo.</p>
          ) : (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); const f = e.dataTransfer.files[0]; if (f) procesar(f) }}
                className={clsx('mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition',
                  arrastrando ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-slate-50/60')}>
                <UploadCloud className="h-8 w-8 text-indigo-600" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium">Arrastra tu archivo de tarifas aquí</p>
                <p className="text-xs text-slate-500">Excel (.xlsx, .xls) o CSV con columnas Servicio, Categoría, Nivel, Unidad y Tarifa</p>
                <button className="btn-primario mt-4" onClick={() => input.current?.click()}>Seleccionar archivo</button>
                <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) procesar(f) }} aria-label="Archivo de tarifas" />
                <button type="button" onClick={descargarEjemplo} className="mt-3 text-xs text-indigo-600 hover:underline">¿Sin archivo a la mano? Descarga un ejemplo con las tarifas del próximo periodo</button>
              </div>
              {archivo && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <FileSpreadsheet className="h-5 w-5 text-exito" aria-hidden="true" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm"><span className="font-medium">{archivo.name}</span><span className="text-slate-500">{progreso}%</span></div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100" role="progressbar" aria-valuenow={progreso} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-1.5 rounded-full bg-indigo-600 transition-all" style={{ width: `${progreso}%` }} />
                    </div>
                  </div>
                  <button onClick={cancelar} className="text-slate-400 hover:text-slate-600" aria-label="Cancelar carga"><X className="h-4 w-4" /></button>
                </div>
              )}
              {error && <p role="alert" className="mt-3 text-sm text-urgente">{error}</p>}
            </>
          )}
        </div>

        <div className="tarjeta p-5">
          <h2 className="font-semibold">Catálogo activo</h2>
          {activo ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Archivo</dt><dd className="text-right font-medium">{activo.archivo_origen}
                {activo.archivo_ruta && <button type="button" onClick={() => descargarOriginal(activo.archivo_ruta!)} className="block w-full text-right text-xs font-normal text-indigo-600 hover:underline">Descargar archivo original</button>}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Versión</dt><dd className="font-medium">v{activo.version}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Activado</dt><dd className="font-medium">{fechaLarga(activo.activado_en ?? activo.creado_en)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Servicios que se cotizan</dt><dd className="font-medium text-exito">{servicios.filter((s) => s.estado === 'listo').length}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Pasan a un asesor</dt><dd className="font-medium text-amber-700">{servicios.filter((s) => s.estado !== 'listo').length}</dd></div>
            </dl>
          ) : <p className="mt-4 text-sm text-slate-500">Aún no hay un catálogo activo. El asistente pasará todas las consultas de precios a tu equipo.</p>}
        </div>
      </div>

      {previa && (
        <div className="tarjeta mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Vista previa antes de activar</h2>
            <div className="flex gap-2 text-sm">
              <span className="rounded-lg bg-slate-100 px-3 py-1"><strong>{previa.length}</strong> detectados</span>
              <span className="rounded-lg bg-green-50 px-3 py-1 text-green-800"><strong>{listos}</strong> listos</span>
              <span className="rounded-lg bg-amber-50 px-3 py-1 text-amber-900"><strong>{conAlerta}</strong> requieren revisión</span>
            </div>
          </div>
          {conAlerta > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span><strong>{conAlerta} servicios</strong> no tienen una tarifa válida. Puedes activar igual: el asistente no los cotizará y pasará esas consultas a un asesor. O corrige el archivo y vuelve a cargarlo.</span>
            </div>
          )}
          <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2">Servicio</th><th className="px-3 py-2">Categoría</th><th className="px-3 py-2">Nivel</th><th className="px-3 py-2">Unidad</th><th className="px-3 py-2 text-right">Tarifa</th><th className="px-3 py-2">Estado</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...previa].sort((a, b) => (a.estado === 'listo' ? 1 : 0) - (b.estado === 'listo' ? 1 : 0)).map((f, i) => (
                  <tr key={i} className={clsx(f.estado !== 'listo' && 'bg-amber-50/40')}>
                    <td className="px-3 py-2 font-medium">{f.nombre}{f.observacion && <div className="text-xs font-normal text-amber-800">{f.observacion}</div>}</td>
                    <td className="px-3 py-2 text-slate-600">{f.categoria ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{f.nivel ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{f.unidad}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.tarifa_texto !== undefined ? <span className="text-red-700" title="Valor tal como viene en el archivo">«{f.tarifa_texto}»</span> : pesos(f.tarifa)}</td>
                    <td className="px-3 py-2"><Chip estado={f.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn-secundario" onClick={cancelar} disabled={publicando}>Cancelar y conservar el catálogo actual</button>
            <button className="btn-primario" onClick={confirmar} disabled={publicando}>
              {publicando && <Loader2 className="h-4 w-4 animate-spin" />}Confirmar y activar catálogo
            </button>
          </div>
        </div>
      )}

      <div className="tarjeta mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Servicios del catálogo activo</h2>
          <label className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input className="campo pl-9" placeholder="Buscar servicio" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar servicio" />
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200"><th className="px-3 py-2">Servicio</th><th className="px-3 py-2">Categoría</th><th className="px-3 py-2">Nivel</th><th className="px-3 py-2">Unidad</th><th className="px-3 py-2 text-right">Tarifa</th><th className="px-3 py-2">Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-medium">{s.nombre}</td>
                  <td className="px-3 py-2 text-slate-600">{s.categoria}</td>
                  <td className="px-3 py-2 text-slate-600">{s.nivel}</td>
                  <td className="px-3 py-2 text-slate-600">{s.unidad}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pesos(s.tarifa)}</td>
                  <td className="px-3 py-2"><Chip estado={s.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
