import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listarZonasEntrega, obtenerDatosPago } from '../../api/catalogo'
import { cotizarPedido, crearPedido } from '../../api/pedidos'
import { useAuth } from '../../context/AuthContext'
import { useCarrito } from '../../context/CarritoContext'
import BotonGoogle from '../../components/BotonGoogle'
import { Campo } from '../../components/ui'
import Icono from '../../components/Icono'
import { formatoBs, formatoUsd } from '../../utils/formato'
import { enviarEventos, registrarEvento } from '../../utils/analitica'

// Checkout de la tienda (POST /pedidos). Pide sesión de cliente (Google).
// Los montos salen siempre de la API (POST /pedidos/cotizar): precios vigentes, ofertas y cupón.
// El carrito del navegador solo dice qué productos y cuántos.
const METODOS = [
  { valor: 'pago_movil', nombre: 'Pago móvil', datos: 'datosPagoMovil' },
  { valor: 'transferencia', nombre: 'Transferencia', datos: 'datosTransferencia' },
  { valor: 'binance', nombre: 'Binance (USDT)', datos: 'walletBinance' },
]
const TAMANO_MAXIMO_CAPTURA = 5 * 1024 * 1024
const TIPOS_CAPTURA = ['image/jpeg', 'image/png', 'image/webp']

const claseInput = (error) =>
  `w-full rounded-lg border bg-superficie px-3 py-2 text-sm outline-none focus:ring-2 ${
    error
      ? 'border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-700 dark:focus:ring-red-900'
      : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-100 dark:focus:ring-emerald-900'
  }`

// Misma regla que Core.Domain/Reglas/Telefonos.cs: celular venezolano 4XX XXX XXXX.
function telefonoValido(texto) {
  let d = texto.replace(/\D/g, '')
  if (d.startsWith('58')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  return d.length === 10 && d[0] === '4'
}

export default function Checkout() {
  const { usuario } = useAuth()
  const { lineas } = useCarrito()

  if (lineas.length === 0) {
    return (
      <Tarjeta>
        <Icono nombre="canasta" className="mx-auto block h-12 w-12 text-slate-300" grosor={1.4} />
        <h1 className="mt-3 text-xl font-bold text-slate-900">Tu carrito está vacío</h1>
        <p className="mt-1 text-sm text-slate-500">Agrega productos para hacer tu pedido.</p>
        <Link to="/" className="mt-4 inline-block rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Ver el catálogo
        </Link>
      </Tarjeta>
    )
  }

  if (!usuario) {
    return (
      <Tarjeta>
        <h1 className="text-xl font-bold text-slate-900">Ingresa para terminar tu compra</h1>
        <p className="mb-5 mt-1 text-sm text-slate-500">
          Usamos tu cuenta de Google para identificarte y avisarte del estado de tu pedido. Tu carrito se mantiene.
        </p>
        <BotonGoogle />
      </Tarjeta>
    )
  }

  if (usuario.rol !== 'cliente') {
    return (
      <Tarjeta>
        <h1 className="text-xl font-bold text-slate-900">Las compras son para clientes</h1>
        <p className="mt-1 text-sm text-slate-500">Entraste con una cuenta del personal. Cierra sesión y entra con Google para comprar.</p>
      </Tarjeta>
    )
  }

  return <FormularioCheckout />
}

function Tarjeta({ children }) {
  return <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-superficie p-8 text-center">{children}</div>
}

function FormularioCheckout() {
  const navegar = useNavigate()
  const { lineas, items, cambiarCantidad, quitar, retirarComprados } = useCarrito()

  const [zonas, setZonas] = useState([])
  const [datosPago, setDatosPago] = useState(null)
  const [errorCarga, setErrorCarga] = useState(null)

  const [cotizacion, setCotizacion] = useState(null)
  const [cotizando, setCotizando] = useState(true)
  const [errorCotizacion, setErrorCotizacion] = useState(null)
  const [intento, setIntento] = useState(0)

  const [textoCupon, setTextoCupon] = useState('')
  const [cupon, setCupon] = useState(null) // Código aplicado.
  const [errorCupon, setErrorCupon] = useState(null)
  const [aplicandoCupon, setAplicandoCupon] = useState(false)

  const [d, setD] = useState({ zonaId: '', direccionTexto: '', telefono: '', metodoPago: 'pago_movil', referenciaPago: '' })
  const [captura, setCaptura] = useState(null)
  const [ubicacion, setUbicacion] = useState(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [errores, setErrores] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [incierto, setIncierto] = useState(false)
  const bloqueado = useRef(false)

  useEffect(() => {
    registrarEvento('inicio_checkout')
    Promise.all([listarZonasEntrega(), obtenerDatosPago()])
      .then(([z, p]) => {
        setZonas(z)
        setDatosPago(p)
      })
      .catch((e) => setErrorCarga(e.message))
  }, [])

  // Clave estable del carrito: se vuelve a cotizar solo si cambian productos o cantidades.
  const claveItems = useMemo(() => JSON.stringify(items), [items])

  useEffect(() => {
    let vigente = true
    setCotizando(true)
    cotizarPedido({ items: JSON.parse(claveItems), codigoCupon: cupon })
      .then((c) => {
        if (!vigente) return
        setCotizacion(c)
        setErrorCotizacion(null)
      })
      .catch((e) => {
        if (!vigente) return
        if (cupon && e.estado === 400) {
          // El cupón dejó de aplicar (p. ej. el subtotal bajó del mínimo): se quita y se recotiza.
          setErrorCupon(e.message)
          setCupon(null)
        } else {
          setErrorCotizacion(e.message)
        }
      })
      .finally(() => vigente && setCotizando(false))
    return () => {
      vigente = false
    }
  }, [claveItems, cupon, intento])

  async function aplicarCupon() {
    const codigo = textoCupon.trim()
    if (!codigo) return
    setAplicandoCupon(true)
    setErrorCupon(null)
    try {
      setCotizacion(await cotizarPedido({ items, codigoCupon: codigo }))
      setCupon(codigo.toUpperCase())
      registrarEvento('cupon_aplicado', { texto: codigo })
    } catch (e) {
      setErrorCupon(e.message)
      if (e.estado === 400) registrarEvento('cupon_rechazado', { texto: codigo })
    } finally {
      setAplicandoCupon(false)
    }
  }

  function quitarCupon() {
    setCupon(null)
    setTextoCupon('')
    setErrorCupon(null)
  }

  function cambiar(campo, valor) {
    setD((x) => ({ ...x, [campo]: valor }))
    if (errores[campo] || errores.general) setErrores((x) => ({ ...x, [campo]: undefined, general: undefined }))
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setErrores((x) => ({ ...x, ubicacion: 'Tu navegador no permite compartir la ubicación.' }))
      return
    }
    setBuscandoUbicacion(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUbicacion({ latitud: coords.latitude, longitud: coords.longitude })
        setErrores((x) => ({ ...x, ubicacion: undefined }))
        setBuscandoUbicacion(false)
      },
      () => {
        setErrores((x) => ({ ...x, ubicacion: 'No pudimos obtener tu ubicación. Puedes seguir sin ella.' }))
        setBuscandoUbicacion(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  // Líneas que piden más de lo que queda (otro cliente compró mientras tanto).
  const sinStock = cotizacion?.lineas.filter((l) => l.cantidad > l.stockDisponible) ?? []

  function ajustarAlStock() {
    for (const l of sinStock) {
      const linea = lineas.find((x) => x.producto.id === l.productoId)
      if (!linea) continue
      if (l.stockDisponible === 0) quitar(l.productoId)
      else cambiarCantidad({ ...linea.producto, stockDisponible: l.stockDisponible }, l.stockDisponible)
    }
  }

  function validar() {
    const e = {}
    if (!d.zonaId) e.zonaId = 'Elige tu zona.'
    if (d.direccionTexto.trim().length < 5) e.direccionTexto = 'Escribe la dirección con un punto de referencia.'
    if (!telefonoValido(d.telefono)) e.telefono = 'Debe ser un celular venezolano: 04XX XXX XXXX.'
    if (!d.referenciaPago.trim()) e.referenciaPago = 'Escribe la referencia del pago.'
    if (!captura) e.captura = 'Adjunta la captura del pago.'
    else if (!TIPOS_CAPTURA.includes(captura.type)) e.captura = 'La captura debe ser una imagen JPG, PNG o WEBP.'
    else if (captura.size === 0 || captura.size > TAMANO_MAXIMO_CAPTURA) e.captura = 'La captura debe pesar entre 1 byte y 5 MB.'
    return e
  }

  async function alEnviar(e) {
    e.preventDefault()
    if (bloqueado.current || !puedeConfirmar) return
    const encontrados = validar()
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return

    bloqueado.current = true
    setEnviando(true)
    const itemsEnviados = items.map(item => ({ ...item }))
    try {
      const pedido = await crearPedido({ ...d, items: itemsEnviados, codigoCupon: cupon, captura, ...ubicacion })
      retirarComprados(itemsEnviados)
      registrarEvento('pedido_confirmado', { valor: pedido.totalUsd })
      enviarEventos()
      navegar('/mis-pedidos', { replace: true, state: { nuevo: pedido.numero } })
    } catch (err) {
      const porCampo = {}
      for (const [campo, mensajes] of Object.entries(err.datos?.errors ?? {})) {
        porCampo[campo.charAt(0).toLowerCase() + campo.slice(1)] = mensajes[0]
      }
      setErrores(Object.keys(porCampo).length ? porCampo : { general: err.message })
      if (err.estado === 0) setIncierto(true)
      // Stock o cupón cambiaron: se vuelve a cotizar para mostrar la situación real.
      if (err.estado === 409) setIntento((n) => n + 1)
      setEnviando(false)
    } finally {
      bloqueado.current = false
    }
  }

  if (errorCarga) {
    return (
      <Tarjeta>
        <p className="font-semibold text-red-800 dark:text-red-300">No pudimos preparar el pago</p>
        <p className="mt-1 text-sm text-red-700 dark:text-red-300">{errorCarga}</p>
      </Tarjeta>
    )
  }

  const metodo = METODOS.find((m) => m.valor === d.metodoPago)
  const datosMetodo = datosPago?.[metodo.datos]
  const sinTasa = cotizacion && cotizacion.tasaBsUsd == null
  const puedeConfirmar = cotizacion && !cotizando && !sinTasa && sinStock.length === 0 && !enviando && !incierto && !!datosMetodo?.trim()

  return (
    <form onSubmit={alEnviar} noValidate className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300">
            ← Seguir comprando
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Finalizar compra</h1>

        {errores.general && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {errores.general}
          </p>
        )}
        {incierto && <p className="rounded-lg border border-amber-200 p-4 text-sm">No pudimos comprobar si el pedido se registró. <Link to="/mis-pedidos" className="font-semibold underline">Revisa tus pedidos antes de volver a confirmar.</Link></p>}

        {/* 1. Entrega */}
        <Seccion numero="1" titulo="¿Dónde te lo llevamos?">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="zona" etiqueta="Zona" error={errores.zonaId}>
              <select id="zona" value={d.zonaId} onChange={(e) => cambiar('zonaId', e.target.value)} className={claseInput(errores.zonaId)}>
                <option value="">Elige tu zona</option>
                {zonas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="telefono" etiqueta="Teléfono de contacto" error={errores.telefono} ayuda="Te escribiremos por WhatsApp.">
              <input
                id="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={d.telefono}
                onChange={(e) => cambiar('telefono', e.target.value)}
                placeholder="0414 123 4567"
                className={claseInput(errores.telefono)}
              />
            </Campo>
          </div>
          <Campo id="direccion" etiqueta="Dirección y punto de referencia" error={errores.direccionTexto}>
            <textarea
              id="direccion"
              rows={2}
              value={d.direccionTexto}
              onChange={(e) => cambiar('direccionTexto', e.target.value)}
              placeholder="Calle 10, casa 5-23, portón azul frente a la panadería"
              className={claseInput(errores.direccionTexto)}
            />
          </Campo>
          <div className="text-sm">
            {ubicacion ? (
              <p className="flex flex-wrap items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Icono nombre="check" className="h-4 w-4" /> Ubicación agregada
                <button type="button" onClick={() => setUbicacion(null)} className="text-xs text-slate-500 underline">
                  Quitar
                </button>
              </p>
            ) : (
              <button
                type="button"
                onClick={usarMiUbicacion}
                disabled={buscandoUbicacion}
                className="font-medium text-emerald-700 hover:underline disabled:opacity-60 dark:text-emerald-300"
              >
                {buscandoUbicacion ? 'Buscando tu ubicación…' : 'Compartir mi ubicación (opcional)'}
              </button>
            )}
            {errores.ubicacion && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{errores.ubicacion}</p>}
          </div>
        </Seccion>

        {/* 2. Pago */}
        <Seccion numero="2" titulo="Paga y adjunta el comprobante">
          <div role="radiogroup" aria-label="Método de pago" className="grid gap-2 sm:grid-cols-3">
            {METODOS.map((m) => (
              <label
                key={m.valor}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${
                  d.metodoPago === m.valor
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="metodoPago"
                  value={m.valor}
                  disabled={!datosPago?.[m.datos]?.trim()}
                  checked={d.metodoPago === m.valor}
                  onChange={() => cambiar('metodoPago', m.valor)}
                  className="accent-emerald-600"
                />
                {m.nombre}
              </label>
            ))}
          </div>

          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            {cotizacion && (
              <p className="mb-2">
                Monto a pagar:{' '}
                <strong className="text-lg text-slate-900">
                  {d.metodoPago === 'binance'
                    ? `${cotizacion.totalUsd.toFixed(2)} USDT`
                    : cotizacion.totalBs != null
                      ? formatoBs(cotizacion.totalBs)
                      : '—'}
                </strong>
              </p>
            )}
            {datosMetodo ? (
              <p className="whitespace-pre-line font-mono text-slate-700">{datosMetodo}</p>
            ) : (
              <p className="text-slate-500">
                La tienda todavía no cargó los datos para este método.
                {datosPago?.numeroSoporte && ` Escríbenos al ${datosPago.numeroSoporte}.`}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="referencia" etiqueta="Referencia del pago" error={errores.referenciaPago}>
              <input
                id="referencia"
                value={d.referenciaPago}
                onChange={(e) => cambiar('referenciaPago', e.target.value)}
                placeholder="Últimos dígitos o ID de la operación"
                className={claseInput(errores.referenciaPago)}
              />
            </Campo>
            <Campo id="captura" etiqueta="Captura del comprobante" error={errores.captura} ayuda="JPG, PNG o WEBP, máximo 5 MB.">
              <input
                id="captura"
                type="file"
                accept={TIPOS_CAPTURA.join(',')}
                onChange={(e) => {
                  setCaptura(e.target.files?.[0] ?? null)
                  if (errores.captura) setErrores((x) => ({ ...x, captura: undefined }))
                }}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950/40 dark:file:text-emerald-300"
              />
            </Campo>
          </div>
        </Seccion>
      </div>

      {/* Resumen */}
      <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-superficie p-5 lg:sticky lg:top-36">
        <h2 className="text-lg font-semibold text-slate-900">Tu pedido</h2>

        {errorCotizacion ? (
          <div className="text-sm text-red-700 dark:text-red-300">
            <p>{errorCotizacion}</p>
            <button type="button" onClick={() => setIntento((n) => n + 1)} className="mt-2 font-semibold underline">
              Reintentar
            </button>
          </div>
        ) : !cotizacion ? (
          <p className="text-sm text-slate-500">Calculando…</p>
        ) : (
          <div className={cotizando ? 'opacity-60' : ''}>
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {cotizacion.lineas.map((l) => (
                <li key={l.productoId} className="flex justify-between gap-3">
                  <span className="text-slate-700">
                    {l.cantidad} × {l.nombre}
                    {l.precioUsd < l.precioListaUsd && <span className="ml-1 text-xs font-semibold text-red-600 dark:text-red-400">oferta</span>}
                  </span>
                  <span className="whitespace-nowrap font-medium text-slate-900">{formatoUsd(l.subtotalUsd)}</span>
                </li>
              ))}
            </ul>

            {sinStock.length > 0 && (
              <div role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <p>Algunos productos ya no tienen suficiente stock:</p>
                <ul className="mt-1 list-disc pl-5">
                  {sinStock.map((l) => (
                    <li key={l.productoId}>
                      {l.nombre}: quedan {l.stockDisponible}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={ajustarAlStock} className="mt-2 font-semibold underline">
                  Ajustar mi carrito
                </button>
              </div>
            )}

            {/* Cupón */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              {cupon ? (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/40">
                  <span className="text-emerald-800 dark:text-emerald-200">
                    Cupón <strong>{cotizacion.cupon?.codigo ?? cupon}</strong> aplicado
                  </span>
                  <button type="button" onClick={quitarCupon} className="text-xs font-semibold text-slate-600 underline">
                    Quitar
                  </button>
                </div>
              ) : (
                <div>
                  <label htmlFor="cupon" className="mb-1 block text-sm font-medium text-slate-700">
                    ¿Tienes un cupón?
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="cupon"
                      value={textoCupon}
                      onChange={(e) => {
                        setTextoCupon(e.target.value)
                        setErrorCupon(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          aplicarCupon()
                        }
                      }}
                      placeholder="CODIGO"
                      className={`${claseInput(errorCupon)} uppercase`}
                    />
                    <button
                      type="button"
                      onClick={aplicarCupon}
                      disabled={!textoCupon.trim() || aplicandoCupon}
                      className="rounded-lg border border-emerald-600 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                    >
                      {aplicandoCupon ? '…' : 'Aplicar'}
                    </button>
                  </div>
                  {errorCupon && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{errorCupon}</p>}
                </div>
              )}
            </div>

            {/* Totales */}
            <dl className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="text-slate-900">{formatoUsd(cotizacion.subtotalUsd)}</dd>
              </div>
              {cotizacion.descuentoUsd > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                  <dt>Descuento</dt>
                  <dd>−{formatoUsd(cotizacion.descuentoUsd)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-bold">
                <dt className="text-slate-900">Total</dt>
                <dd className="text-slate-900">{formatoUsd(cotizacion.totalUsd)}</dd>
              </div>
              {cotizacion.totalBs != null && (
                <div className="flex justify-between text-xs text-slate-500">
                  <dt>En bolívares (tasa {cotizacion.tasaBsUsd})</dt>
                  <dd>{formatoBs(cotizacion.totalBs)}</dd>
                </div>
              )}
            </dl>

            {sinTasa && (
              <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                La tienda todavía no cargó la tasa del día, así que por ahora no puede recibir pedidos. Intenta más tarde.
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!puedeConfirmar}
          className="w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? 'Enviando tu pedido…' : 'Confirmar pedido'}
        </button>
        <p className="text-center text-xs text-slate-500">
          Revisaremos tu pago y te avisaremos por WhatsApp. Si no se revisa a tiempo, el pedido se cancela solo y el stock vuelve a la tienda.
        </p>
      </aside>
    </form>
  )
}

function Seccion({ numero, titulo, children }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-superficie p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-sm text-white">{numero}</span>
        {titulo}
      </h2>
      {children}
    </section>
  )
}
