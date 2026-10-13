import { useCallback, useEffect, useState } from 'react'
import { actualizarCupon, crearCupon, listarCupones } from '../../api/cupones'
import Modal from '../../components/Modal'
import { Aviso, Campo, EncabezadoPagina, EstadoCarga, Paginacion, Selector } from '../../components/ui'
import { claseBoton, claseInput, erroresPorCampo } from '../../utils/panel'
import { diaAIso, formatoFechaHora, formatoNumero, formatoUsd, isoADia } from '../../utils/formato'

// Cupones de descuento (solo el gerente). Se aplican al subtotal del pedido, ya con las ofertas
// de producto; cada cliente puede usar un cupón una sola vez. No se borran: se desactivan.
const TAMANO = 50
const FILTROS = [
  ['todos', 'Todos'],
  ['activos', 'Activos'],
  ['inactivos', 'Inactivos'],
]

function textoValor(c) {
  return c.tipo === 'porcentaje' ? `${formatoNumero(c.valor)} %` : formatoUsd(c.valor)
}

function textoVigencia(c) {
  if (!c.validoDesde && !c.validoHasta) return 'Sin fecha límite'
  const desde = c.validoDesde ? isoADia(c.validoDesde) : null
  const hasta = c.validoHasta ? isoADia(c.validoHasta, { fin: true }) : null
  if (desde && hasta) return `Del ${desde} al ${hasta}`
  return desde ? `Desde el ${desde}` : `Hasta el ${hasta}`
}

export default function Cupones() {
  const [filtro, setFiltro] = useState('todos')
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)
  const [editando, setEditando] = useState(null) // null | 'nuevo' | cupón
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    let vigente = true
    setError(null)
    const activo = filtro === 'todos' ? undefined : filtro === 'activos'
    listarCupones({ q: buscar.trim(), activo, pagina, tamano: TAMANO })
      .then((r) => vigente && setResultado(r))
      .catch((e) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [filtro, buscar, pagina, intento])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  const cerrar = useCallback(() => setEditando(null), [])

  function alGuardar(guardado, esNuevo) {
    setEditando(null)
    setIntento((n) => n + 1)
    setAviso({ tipo: 'ok', texto: esNuevo ? `Se creó el cupón ${guardado.codigo}.` : `Se guardó el cupón ${guardado.codigo}.` })
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Cupones" detalle="Códigos de descuento que los clientes escriben al pagar.">
        <button type="button" onClick={() => setEditando('nuevo')} className={claseBoton.primario}>
          + Nuevo cupón
        </button>
      </EncabezadoPagina>

      <Aviso aviso={aviso} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={buscar}
          onChange={(e) => {
            setBuscar(e.target.value)
            setPagina(1)
          }}
          placeholder="Buscar por código o descripción"
          aria-label="Buscar cupones"
          className={`${claseInput()} max-w-xs`}
        />
        <Selector
          etiqueta="Estado"
          opciones={FILTROS}
          valor={filtro}
          alCambiar={(v) => {
            setFiltro(v)
            setPagina(1)
          }}
        />
      </div>

      <EstadoCarga
        cargando={!resultado && !error}
        error={error}
        alReintentar={() => setIntento((n) => n + 1)}
        vacio={resultado?.items.length === 0}
        textoVacio="No hay cupones con esos filtros."
      >
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-superficie">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Descuento</th>
                <th className="px-4 py-3 font-semibold">Compra mínima</th>
                <th className="px-4 py-3 font-semibold">Vigencia</th>
                <th className="px-4 py-3 font-semibold">Usos</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resultado?.items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-slate-900">{c.codigo}</span>
                    {c.descripcion && <span className="block text-xs text-slate-500">{c.descripcion}</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold">{textoValor(c)}</td>
                  <td className="px-4 py-3">{c.compraMinimaUsd ? formatoUsd(c.compraMinimaUsd) : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{textoVigencia(c)}</td>
                  <td className="px-4 py-3">
                    {c.usosActuales}
                    {c.usosMaximos ? ` / ${c.usosMaximos}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        c.vigente
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.vigente ? 'Vigente' : c.activo ? 'No vigente' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setEditando(c)} className={claseBoton.pequeno}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {resultado && <Paginacion pagina={pagina} total={resultado.total} tamano={TAMANO} alCambiar={setPagina} />}
      </EstadoCarga>

      <Modal
        abierto={!!editando}
        titulo={editando === 'nuevo' ? 'Nuevo cupón' : `Editar cupón ${editando?.codigo ?? ''}`}
        alCerrar={cerrar}
      >
        {editando && <FormularioCupon cupon={editando === 'nuevo' ? null : editando} alGuardar={alGuardar} alCancelar={cerrar} />}
      </Modal>
    </div>
  )
}

function validar(d, esNuevo) {
  const e = {}
  if (esNuevo) {
    if (d.codigo.trim().length < 3) e.codigo = 'El código debe tener al menos 3 caracteres.'
    else if (!/^[A-Za-z0-9_-]+$/.test(d.codigo.trim())) e.codigo = 'Solo letras, números, guiones y guiones bajos.'
  }
  const valor = Number(d.valor)
  if (!(valor > 0)) e.valor = 'Debe ser mayor que 0.'
  else if (d.tipo === 'porcentaje' && valor > 100) e.valor = 'No puede pasar del 100 %.'
  if (d.compraMinimaUsd !== '' && Number(d.compraMinimaUsd) < 0) e.compraMinimaUsd = 'No puede ser negativa.'
  if (d.usosMaximos !== '' && !(Number(d.usosMaximos) >= 1)) e.usosMaximos = 'Debe ser al menos 1.'
  if (d.validoDesde && d.validoHasta && d.validoHasta < d.validoDesde) e.validoHasta = 'Debe ser igual o posterior al inicio.'
  return e
}

function FormularioCupon({ cupon, alGuardar, alCancelar }) {
  const esNuevo = !cupon
  const [d, setD] = useState({
    codigo: cupon?.codigo ?? '',
    descripcion: cupon?.descripcion ?? '',
    tipo: cupon?.tipo ?? 'porcentaje',
    valor: cupon?.valor ?? '',
    compraMinimaUsd: cupon?.compraMinimaUsd ?? '',
    validoDesde: isoADia(cupon?.validoDesde),
    validoHasta: isoADia(cupon?.validoHasta, { fin: true }),
    usosMaximos: cupon?.usosMaximos ?? '',
    activo: cupon?.activo ?? true,
  })
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  function cambiar(campo, valor) {
    setD((x) => ({ ...x, [campo]: valor }))
    if (errores[campo] || errores.general) setErrores((x) => ({ ...x, [campo]: undefined, general: undefined }))
  }

  async function alEnviar(e) {
    e.preventDefault()
    const encontrados = validar(d, esNuevo)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return

    const cuerpo = {
      descripcion: d.descripcion.trim() || null,
      tipo: d.tipo,
      valor: Number(d.valor),
      compraMinimaUsd: d.compraMinimaUsd === '' ? null : Number(d.compraMinimaUsd),
      validoDesde: diaAIso(d.validoDesde),
      validoHasta: diaAIso(d.validoHasta, { fin: true }),
      usosMaximos: d.usosMaximos === '' ? null : Number(d.usosMaximos),
      activo: d.activo,
    }
    setGuardando(true)
    try {
      const guardado = esNuevo ? await crearCupon({ codigo: d.codigo.trim(), ...cuerpo }) : await actualizarCupon(cupon.id, cuerpo)
      alGuardar(guardado, esNuevo)
    } catch (err) {
      setErrores(err.estado === 409 ? { [esNuevo ? 'codigo' : 'general']: err.message } : erroresPorCampo(err))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={alEnviar} noValidate className="space-y-4">
      {errores.general && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {errores.general}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="codigo" etiqueta="Código" error={errores.codigo} ayuda={esNuevo ? 'Lo que escribe el cliente. No se puede cambiar después.' : undefined}>
          <input
            id="codigo"
            value={d.codigo}
            disabled={!esNuevo}
            onChange={(e) => cambiar('codigo', e.target.value.toUpperCase())}
            placeholder="VERANO10"
            className={`${claseInput(errores.codigo)} font-mono uppercase disabled:opacity-60`}
          />
        </Campo>
        <Campo id="descripcion" etiqueta="Descripción (opcional)" error={errores.descripcion}>
          <input id="descripcion" value={d.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} className={claseInput(errores.descripcion)} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="tipo" etiqueta="Tipo" error={errores.tipo}>
          <select id="tipo" value={d.tipo} onChange={(e) => cambiar('tipo', e.target.value)} className={claseInput(errores.tipo)}>
            <option value="porcentaje">Porcentaje (%)</option>
            <option value="monto_fijo">Monto fijo (USD)</option>
          </select>
        </Campo>
        <Campo id="valor" etiqueta={d.tipo === 'porcentaje' ? 'Descuento (%)' : 'Descuento (USD)'} error={errores.valor}>
          <input id="valor" type="number" min="0" step="0.01" value={d.valor} onChange={(e) => cambiar('valor', e.target.value)} className={claseInput(errores.valor)} />
        </Campo>
        <Campo id="minimo" etiqueta="Compra mínima (USD)" error={errores.compraMinimaUsd} ayuda="Vacío = sin mínimo.">
          <input id="minimo" type="number" min="0" step="0.01" value={d.compraMinimaUsd} onChange={(e) => cambiar('compraMinimaUsd', e.target.value)} className={claseInput(errores.compraMinimaUsd)} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="desde" etiqueta="Válido desde" error={errores.validoDesde} ayuda="Vacío = desde ya.">
          <input id="desde" type="date" value={d.validoDesde} onChange={(e) => cambiar('validoDesde', e.target.value)} className={claseInput(errores.validoDesde)} />
        </Campo>
        <Campo id="hasta" etiqueta="Válido hasta (inclusive)" error={errores.validoHasta} ayuda="Vacío = sin vencimiento.">
          <input id="hasta" type="date" value={d.validoHasta} onChange={(e) => cambiar('validoHasta', e.target.value)} className={claseInput(errores.validoHasta)} />
        </Campo>
        <Campo
          id="usos"
          etiqueta="Límite de usos"
          error={errores.usosMaximos}
          ayuda={cupon ? `Usado ${cupon.usosActuales} veces. Vacío = ilimitado.` : 'Entre todos los clientes. Vacío = ilimitado.'}
        >
          <input id="usos" type="number" min="1" step="1" value={d.usosMaximos} onChange={(e) => cambiar('usosMaximos', e.target.value)} className={claseInput(errores.usosMaximos)} />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" checked={d.activo} onChange={(e) => cambiar('activo', e.target.checked)} className="h-4 w-4 accent-marca-700" />
        Activo (los clientes pueden usarlo)
      </label>

      {cupon && <p className="text-xs text-slate-500">Creado el {formatoFechaHora(cupon.creadoEn)}. Cada cliente puede usarlo una sola vez.</p>}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={alCancelar} className={claseBoton.secundario}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className={claseBoton.primario}>
          {guardando ? 'Guardando…' : esNuevo ? 'Crear cupón' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
