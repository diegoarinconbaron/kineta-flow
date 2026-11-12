export type EstadoLead = 'nuevo' | 'cotizado' | 'listo_para_comprar' | 'sin_respuesta' | 'cerrado'
export type Emisor = 'cliente' | 'ia' | 'asesor' | 'sistema'

export interface Negocio {
  id: string
  nombre: string
  sector: string
  ciudad: string
  plan: string
  telefono_whatsapp: string | null
}

export interface Miembro {
  id: string
  negocio_id: string
  usuario_id: string
  nombre: string
  rol: 'dueno' | 'asesor'
}

export interface Configuracion {
  negocio_id: string
  activo: boolean
  nombre_asistente: string
  tono: string
  horario_laboral: Record<string, [string, string]>
  reglas_traspaso: string[]
  descuento_paquete: { minimo: number; porcentaje: number }
  vigencia_cotizacion_dias: number
}

export interface Servicio {
  id: string
  catalogo_id: string
  negocio_id: string
  nombre: string
  categoria: string | null
  nivel: string | null
  unidad: string
  tarifa: number | null
  estado: 'listo' | 'sin_tarifa' | 'revisar'
  observacion: string | null
  palabras_clave: string | null
}

export interface Catalogo {
  id: string
  negocio_id: string
  archivo_origen: string
  version: number
  estado: 'borrador' | 'activo' | 'archivado'
  creado_en: string
  activado_en: string | null
}

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  municipio: string | null
  datos_contexto: Record<string, unknown>
}

export interface Conversacion {
  id: string
  negocio_id: string
  cliente_id: string
  estado_lead: EstadoLead
  atendida_por: 'ia' | 'asesor'
  asesor_id: string | null
  requiere_asesor: boolean
  fuera_de_horario: boolean
  necesidad: string | null
  valor_potencial: number | null
  iniciada_en: string
  ultimo_mensaje_en: string
  clientes?: Cliente
}

export interface Mensaje {
  id: string
  conversacion_id: string
  negocio_id: string
  emisor: Emisor
  contenido: string
  adjunto: null | { tipo: 'cotizacion'; cotizacion_id: string } | { tipo: 'botones'; opciones: string[] } | { tipo: 'precio'; servicio_id: string }
  creado_en: string
}

export interface Traspaso {
  id: string
  conversacion_id: string
  motivo: string
  resumen_ia: { necesidad?: string; cotizacion?: string; datos?: string; siguiente_paso?: string }
  tomado_por: string | null
  solicitado_en: string
  tomado_en: string | null
  devuelto_en: string | null
}

export interface Cotizacion {
  id: string
  numero: string
  conversacion_id: string
  catalogo_id: string
  subtotal: number
  descuento: number
  total: number
  valida_hasta: string
  creada_en: string
}
