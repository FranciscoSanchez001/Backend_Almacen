import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerDatosPago, listarZonasEntrega, obtenerProductoCatalogo } from '../../api/catalogo'
import { crearPedido } from '../../api/pedidos'
import { useAuth } from '../../context/AuthContext'
import { useCarrito } from '../../context/CarritoContext'
import AccesoCliente from '../../components/AccesoCliente'
import Icono from '../../components/Icono'
import { formatoBs, formatoUsd } from '../../utils/formato'
import { METODOS_PAGO, normalizarTelefono, validarCaptura } from '../../utils/checkout'

const claseCampo = 'mt-1 block w-full rounded-lg border border-slate-300 bg-superficie px-3 py-2 text-sm outline-none focus:border-emerald-500'
const clasePanel = 'rounded-2xl border border-slate-200 bg-superficie p-5'

export default function Checkout() {
  const { usuario } = useAuth()
  const { lineas, retirarComprados } = useCarrito()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)
  const [metodoPago, setMetodoPago] = useState('')
  const [formulario, setFormulario] = useState({ zonaId: '', direccionTexto: '', telefono: '', referenciaPago: '' })
  const [captura, setCaptura] = useState(null)
  const [error, setError] = useState('')
  const [incierto, setIncierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [pedido, setPedido] = useState(null)
  const bloqueado = useRef(false)
  const cambiarCampo = e => setFormulario(actual => ({ ...actual, [e.target.name]: e.target.value }))

  useEffect(() => {
    if (usuario?.rol !== 'cliente' || lineas.length === 0) return
    let activo = true
    setCargando(true)
    setDatos(null)
    setErrorCarga('')
    Promise.all([
      obtenerDatosPago(), listarZonasEntrega(),
      Promise.all(lineas.map(async ({ producto, cantidad }) => {
        let actualizado
        try { actualizado = await obtenerProductoCatalogo(producto.id) }
        catch (err) { if (err.estado === 404) throw new Error(`${producto.nombre} ya no está disponible. Ajusta tu carrito.`); throw err }
        if (cantidad > actualizado.stockDisponible) throw new Error(`Solo quedan ${actualizado.stockDisponible} unidades de ${actualizado.nombre}. Ajusta tu carrito.`)
        return { producto: actualizado, cantidad }
      })),
    ]).then(([pago, zonas, productos]) => {
      if (!activo) return
      if (!(pago.tasaBsUsd > 0)) throw new Error('La tienda aún no tiene una tasa de cambio disponible. Inténtalo más tarde.')
      if (zonas.length === 0) throw new Error('No hay zonas de entrega disponibles en este momento.')
      if (productos.length > 50 || productos.some(l => !Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > 1000)) throw new Error('El pedido admite hasta 50 productos y hasta 1000 unidades por producto. Ajusta tu carrito.')
      setDatos({ pago, zonas, productos })
    }).catch(err => { if (activo) setErrorCarga(err.message) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [usuario?.id, usuario?.rol, lineas, intento])

  const metodos = datos ? METODOS_PAGO.filter(m => datos.pago[m.campo]?.trim()) : []
  const metodo = metodos.find(m => m.valor === metodoPago)
  const totalUsd = datos?.productos.reduce((suma, l) => suma + Math.round(l.producto.precioUsd * 100) * l.cantidad, 0) / 100 || 0
  const totalBs = datos?.productos.reduce((suma, l) => {
    const precio = l.producto.precioUsd * datos.pago.tasaBsUsd
    return suma + Math.round((precio + Number.EPSILON * precio) * 100) * l.cantidad
  }, 0) / 100 || 0

  async function confirmar(evento) {
    evento.preventDefault()
    if (bloqueado.current || !datos || !metodo) return
    setError('')
    const form = new FormData(evento.currentTarget)
    const telefono = normalizarTelefono(form.get('telefono'))
    const direccionTexto = form.get('direccionTexto').trim()
    const referenciaPago = form.get('referenciaPago').trim()
    const errorCaptura = validarCaptura(captura)
    if (!telefono) return setError('Ingresa un celular venezolano válido, por ejemplo 0412 123 4567.')
    if (direccionTexto.length < 5 || direccionTexto.length > 500) return setError('La dirección debe tener entre 5 y 500 caracteres.')
    if (!referenciaPago) return setError('La referencia del pago es obligatoria.')
    if (!datos.zonas.some(z => z.id === form.get('zonaId'))) return setError('Selecciona una zona de entrega disponible.')
    if (errorCaptura) return setError(errorCaptura)
    bloqueado.current = true
    setEnviando(true)
    try {
      const creado = await crearPedido({ lineas: datos.productos, metodoPago, referenciaPago,
        zonaId: form.get('zonaId'), direccionTexto, telefono, captura })
      setPedido(creado)
      retirarComprados(datos.productos)
    } catch (err) {
      setError(err.message)
      setIncierto(err.estado === 0)
    } finally {
      bloqueado.current = false
      setEnviando(false)
    }
  }

  if (pedido) return (
    <section className={`${clasePanel} mx-auto max-w-xl text-center`}>
      <Icono nombre="correcto" className="h-12 w-12 text-emerald-600" />
      <h1 className="mt-3 text-2xl font-bold">Pedido #{pedido.numero} recibido</h1>
      <p className="mt-3 text-slate-600">Tu pedido está pendiente de revisión del pago. Te avisaremos cuando sea aprobado.</p>
      <p className="mt-4 font-semibold">{formatoUsd(pedido.totalUsd)} · {formatoBs(pedido.totalBs)}</p>
      <Link to="/mis-pedidos" className="mt-5 inline-block rounded-full bg-emerald-600 px-6 py-2.5 font-semibold text-white">Ver mis pedidos</Link>
    </section>
  )

  return <AccesoCliente>
    {lineas.length === 0 ? <section className={`${clasePanel} text-center`}>
      <h1 className="text-2xl font-bold">Tu carrito está vacío</h1><Link to="/" className="mt-4 inline-block text-emerald-700 dark:text-emerald-300">Ir al catálogo</Link>
    </section> : <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Finalizar compra</h1><p className="mt-1 text-sm text-slate-500">Completa la entrega, realiza el pago y adjunta el comprobante.</p></div>
      {cargando && <p role="status">Consultando precios, stock y datos de pago…</p>}
      {errorCarga && <div role="alert" className={`${clasePanel} space-y-3`}><p>{errorCarga}</p><button type="button" onClick={() => setIntento(i => i + 1)} className="text-emerald-700 dark:text-emerald-300">Reintentar</button><p>Abre el carrito para ajustar tus productos.</p></div>}
      {datos && !cargando && <form onSubmit={confirmar} className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <fieldset disabled={enviando} className="min-w-0 space-y-5">
          <fieldset className={clasePanel}>
            <legend className="px-1 font-bold">1. Datos de entrega</legend>
            <label className="block text-sm font-medium">Zona de entrega<select name="zonaId" required className={claseCampo} value={formulario.zonaId} onChange={cambiarCampo}><option value="" disabled>Selecciona tu zona</option>{datos.zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></label>
            <label className="mt-4 block text-sm font-medium">Dirección y referencia<textarea name="direccionTexto" required minLength={5} maxLength={500} rows={3} className={claseCampo} placeholder="Calle, edificio o casa y referencia para encontrarte" value={formulario.direccionTexto} onChange={cambiarCampo} /></label>
            <label className="mt-4 block text-sm font-medium">Teléfono de contacto<input name="telefono" type="tel" autoComplete="tel" required className={claseCampo} placeholder="0412 123 4567" value={formulario.telefono} onChange={cambiarCampo} /></label>
          </fieldset>
          <fieldset className={clasePanel}>
            <legend className="px-1 font-bold">2. Pago</legend>
            <label className="block text-sm font-medium">Método de pago<select required value={metodoPago} onChange={e => setMetodoPago(e.target.value)} className={claseCampo}><option value="">Selecciona cómo pagar</option>{metodos.map(m => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}</select></label>
            {metodos.length === 0 && <p role="alert" className="mt-3 text-sm">No hay métodos de pago disponibles. Inténtalo más tarde.</p>}
            {metodo && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold">Datos para {metodo.nombre}</p><p className="mt-2 whitespace-pre-wrap break-words">{datos.pago[metodo.campo]}</p>
              <p className="mt-4 font-bold" aria-live="polite">Monto a pagar: {metodoPago === 'binance' ? `${totalUsd.toFixed(2)} USDT` : formatoBs(totalBs)}</p>
              <p className="mt-1 text-xs text-slate-500">Tasa: {formatoBs(datos.pago.tasaBsUsd)} por USD</p>
            </div>}
            <label className="mt-4 block text-sm font-medium">Referencia del pago<input name="referenciaPago" required maxLength={100} className={claseCampo} placeholder="Número de operación o referencia" value={formulario.referenciaPago} onChange={cambiarCampo} /></label>
            <label className="mt-4 block text-sm font-medium">Comprobante de pago<input name="captura" type="file" required={!captura} accept="image/jpeg,image/png,image/webp" className={claseCampo}
              onChange={e => { const archivo = e.target.files[0]; setCaptura(archivo ?? null); setError(archivo ? validarCaptura(archivo) : '') }} /></label>
            <p className="mt-1 text-xs text-slate-500">Imagen JPG, PNG o WEBP de hasta 5 MB.</p>
            {captura && <p className="mt-2 break-words text-xs text-slate-500">Comprobante seleccionado: {captura.name}</p>}
          </fieldset>
        </fieldset>
        <aside className={`${clasePanel} h-fit space-y-4`}>
          <h2 className="text-lg font-bold">3. Revisa tu pedido</h2>
          <ul className="divide-y divide-slate-200">{datos.productos.map(({ producto, cantidad }) => <li key={producto.id} className="flex justify-between gap-3 py-3 text-sm"><span>{cantidad} × {producto.nombre}</span><span className="shrink-0 font-semibold">{formatoUsd(producto.precioUsd * cantidad)}</span></li>)}</ul>
          <p className="font-bold">Total: {formatoUsd(totalUsd)}</p><p className="text-sm text-slate-500">{formatoBs(totalBs)}</p>
          <p className="text-xs text-slate-500">Los precios y el stock se verifican al registrar tu pedido. El pago será revisado por el personal.</p>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          {incierto && <p className="text-sm">No pudimos comprobar si se registró el pedido. <Link to="/mis-pedidos" className="underline">Revisa tus pedidos antes de volver a confirmar.</Link></p>}
          <button type="submit" disabled={enviando || !metodo || incierto} className="w-full rounded-full bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{enviando ? 'Registrando pedido…' : 'Confirmar pedido'}</button>
          <Link to="/" className="block text-center text-sm text-emerald-700 dark:text-emerald-300">Volver a la tienda</Link>
        </aside>
      </form>}
    </div>}
  </AccesoCliente>
}
