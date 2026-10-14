// Enlace para abrir la entrega en Google Maps: con coordenadas, al punto exacto; si no, se
// busca la dirección escrita con su zona.
export function enlaceMapa(pedido) {
  const hayCoordenadas = pedido.latitud != null && pedido.longitud != null
  const direccion = [pedido.direccionTexto, pedido.zona?.nombre, 'Venezuela'].filter(Boolean).join(', ')
  const consulta = hayCoordenadas ? `${pedido.latitud},${pedido.longitud}` : direccion
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`
}
