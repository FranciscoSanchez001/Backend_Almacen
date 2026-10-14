export const METODOS_PAGO = [
  { valor: 'transferencia', nombre: 'Transferencia', campo: 'datosTransferencia' },
  { valor: 'pago_movil', nombre: 'Pago móvil', campo: 'datosPagoMovil' },
  { valor: 'binance', nombre: 'Binance', campo: 'walletBinance' },
]

export function normalizarTelefono(telefono) {
  let digitos = telefono.replace(/\D/g, '')
  if (digitos.startsWith('58')) digitos = digitos.slice(2)
  if (digitos.startsWith('0')) digitos = digitos.slice(1)
  return /^4\d{9}$/.test(digitos) ? `+58${digitos}` : null
}

export function validarCaptura(archivo) {
  if (!archivo) return 'Adjunta el comprobante de pago.'
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) return 'El comprobante debe ser JPG, PNG o WEBP.'
  if (archivo.size === 0 || archivo.size > 5 * 1024 * 1024) return 'El comprobante debe pesar entre 1 byte y 5 MB.'
  return ''
}
