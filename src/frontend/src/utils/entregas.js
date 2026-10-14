export function enlacesMapa(pedido) {
  const hayCoordenadas = pedido.latitud != null && pedido.longitud != null
  const direccion = [pedido.direccionTexto, pedido.zona?.nombre, 'Venezuela'].filter(Boolean).join(', ')
  const consulta = hayCoordenadas ? `${pedido.latitud},${pedido.longitud}` : direccion
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`,
    waze: hayCoordenadas
      ? `https://www.waze.com/ul?ll=${encodeURIComponent(consulta)}&navigate=yes`
      : `https://www.waze.com/ul?q=${encodeURIComponent(direccion)}&navigate=yes`,
  }
}
