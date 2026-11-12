import { jsPDF } from 'jspdf'
import { supabase } from './supabase'
import { fechaLarga, pesos } from './formato'

/** Genera el PDF de una cotización a partir de los datos guardados y lo abre en una pestaña nueva */
export async function abrirCotizacionPdf(cotizacionId: string) {
  // la pestaña se abre en el mismo clic (antes de consultar los datos) para que el navegador no la bloquee
  const ventana = window.open('', '_blank')
  ventana?.document.write('<p style="font-family:sans-serif;padding:24px">Generando cotización…</p>')
  const { data: c } = await supabase
    .from('cotizaciones')
    .select('*, items_cotizacion(*), conversaciones(clientes(nombre, telefono)), catalogos(version, archivo_origen), negocios(nombre, ciudad, telefono_whatsapp)')
    .eq('id', cotizacionId).single()
  if (!c) { ventana?.close(); return }
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const noche: [number, number, number] = [14, 19, 48]
  const indigo: [number, number, number] = [79, 70, 229]

  doc.setFillColor(...noche); doc.rect(0, 0, W, 110, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(c.negocios.nombre, 48, 52)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text(`${c.negocios.ciudad} · WhatsApp ${c.negocios.telefono_whatsapp ?? ''}`, 48, 72)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('COTIZACIÓN', W - 48, 52, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(c.numero, W - 48, 72, { align: 'right' })

  doc.setTextColor(...noche)
  const fila = (y: number, etiqueta: string, valor: string, x = 48) => {
    doc.setFontSize(8); doc.setTextColor(110, 116, 140); doc.text(etiqueta.toUpperCase(), x, y)
    doc.setFontSize(11); doc.setTextColor(...noche); doc.text(valor, x, y + 15)
  }
  fila(145, 'Cliente', c.conversaciones.clientes.nombre)
  fila(145, 'Fecha', fechaLarga(c.creada_en), 250)
  fila(145, 'Válida hasta', fechaLarga(c.valida_hasta + 'T12:00:00'), 420)

  let y = 205
  doc.setFillColor(238, 240, 254); doc.rect(48, y - 14, W - 96, 24, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...indigo)
  doc.text('DESCRIPCIÓN', 56, y + 2); doc.text('CANT.', 360, y + 2, { align: 'right' })
  doc.text('VALOR UNIT.', 455, y + 2, { align: 'right' }); doc.text('TOTAL', W - 56, y + 2, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...noche); doc.setFontSize(10)
  y += 32
  for (const it of c.items_cotizacion) {
    doc.text(doc.splitTextToSize(it.descripcion, 280), 56, y)
    doc.text(String(Number(it.cantidad)), 360, y, { align: 'right' })
    doc.text(pesos(it.valor_unitario), 455, y, { align: 'right' })
    doc.text(pesos(it.valor_total), W - 56, y, { align: 'right' })
    y += 26
  }
  doc.setDrawColor(220, 223, 232); doc.line(48, y - 8, W - 48, y - 8)
  y += 12
  const totalFila = (etiqueta: string, valor: string, negrita = false) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal'); doc.setFontSize(negrita ? 13 : 10)
    doc.text(etiqueta, 400, y, { align: 'right' }); doc.text(valor, W - 56, y, { align: 'right' }); y += negrita ? 26 : 18
  }
  totalFila('Subtotal', pesos(c.subtotal))
  if (Number(c.descuento) > 0) totalFila('Descuento por paquete', '-' + pesos(c.descuento))
  doc.setFillColor(...noche); doc.roundedRect(270, y - 6, W - 318, 34, 6, 6, 'F')
  doc.setTextColor(255, 255, 255); y += 16; totalFila('Total a pagar', pesos(c.total), true)

  doc.setTextColor(110, 116, 140); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const nota = `Precios tomados del catálogo activo (versión ${c.catalogos.version}, ${c.catalogos.archivo_origen}) validado por ${c.negocios.nombre}. ` +
    'Para becas, descuentos especiales o formas de pago, un asesor confirma las condiciones.'
  doc.text(doc.splitTextToSize(nota, W - 96), 48, y + 30)
  doc.setTextColor(...indigo); doc.text('Atendido por Kineta Flow · kineta-flow.vercel.app', 48, 740)

  const url = String(doc.output('bloburl'))
  if (ventana) ventana.location.href = url
  else window.location.href = url
}
