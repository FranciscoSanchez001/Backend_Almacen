import { useState } from 'react'
import { actualizarProducto, crearProducto } from '../../api/productos'
import { Campo } from '../../components/ui'
import { claseBoton, claseInput, erroresPorCampo } from '../../utils/panel'
import { formatoPct } from '../../utils/formato'

// Crear o editar un producto. Las reglas son las mismas que valida la API;
// si la API rechaza algo, su mensaje aparece debajo del campo.
// Al editar, cambiar el stock disponible queda registrado como ajuste de inventario.
const UNIDADES = ['unidad', 'kg', 'g', 'litro', 'botella', 'paquete', 'caja', 'bolsa', 'lata', 'docena']

function validar(d, esNuevo) {
  const e = {}
  if (!d.codigoSku.trim()) e.codigoSku = 'El código SKU es obligatorio.'
  else if (!/^[A-Za-z0-9-]+$/.test(d.codigoSku.trim())) e.codigoSku = 'Solo letras, números y guiones.'
  if (!d.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
  if (!(Number(d.precioUsd) > 0)) e.precioUsd = 'El precio debe ser mayor que 0.'
  if (!(Number(d.costoUsd) > 0)) e.costoUsd = 'El costo debe ser mayor que 0.'
  if (!d.categoriaId) e.categoriaId = 'Elige una categoría.'
  if (d.imagenUrl && !/^https?:\/\//.test(d.imagenUrl.trim())) e.imagenUrl = 'Debe empezar por http:// o https://'
  const stock = esNuevo ? 'stockInicial' : 'stockDisponible'
  if (d[stock] === '' || Number(d[stock]) < 0) e[stock] = 'El stock no puede estar vacío ni ser negativo.'
  if (Number(d.stockMinimo) < 0) e.stockMinimo = 'No puede ser negativo.'
  if (!(Number(d.stockMaximo) > Number(d.stockMinimo))) e.stockMaximo = 'Debe ser mayor que el stock mínimo.'
  return e
}

export default function FormularioProducto({ producto, categorias, alGuardar, alCancelar }) {
  const esNuevo = !producto
  const [d, setD] = useState({
    codigoSku: producto?.codigoSku ?? '',
    nombre: producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    precioUsd: producto?.precioUsd ?? '',
    costoUsd: producto?.costoUsd ?? '',
    imagenUrl: producto?.imagenUrl ?? '',
    categoriaId: producto?.categoriaId ?? '',
    stockInicial: '',
    stockDisponible: producto?.stockDisponible ?? '',
    stockMinimo: producto?.stockMinimo ?? 5,
    stockMaximo: producto?.stockMaximo ?? 100,
    ubicacion: producto?.ubicacion ?? '',
    unidadMedida: producto?.unidadMedida ?? 'unidad',
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
      codigoSku: d.codigoSku.trim(),
      nombre: d.nombre.trim(),
      descripcion: d.descripcion.trim() || null,
      precioUsd: Number(d.precioUsd),
      costoUsd: Number(d.costoUsd),
      imagenUrl: d.imagenUrl.trim() || null,
      categoriaId: d.categoriaId,
      stockMinimo: Number(d.stockMinimo),
      stockMaximo: Number(d.stockMaximo),
      ubicacion: d.ubicacion.trim() || null,
      unidadMedida: d.unidadMedida,
      ...(esNuevo ? { stockInicial: Number(d.stockInicial) } : { stockDisponible: Number(d.stockDisponible) }),
    }
    setGuardando(true)
    try {
      const guardado = esNuevo ? await crearProducto(cuerpo) : await actualizarProducto(producto.id, cuerpo)
      alGuardar(guardado, esNuevo)
    } catch (err) {
      setErrores(err.estado === 409 ? { codigoSku: err.message } : erroresPorCampo(err))
      setGuardando(false)
    }
  }

  const margen = Number(d.precioUsd) > 0 && Number(d.costoUsd) > 0 ? ((d.precioUsd - d.costoUsd) / d.precioUsd) * 100 : null
  const campoStock = esNuevo ? 'stockInicial' : 'stockDisponible'

  return (
    <form onSubmit={alEnviar} noValidate className="space-y-4">
      {errores.general && (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {errores.general}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="sku" etiqueta="Código SKU" error={errores.codigoSku}>
          <input id="sku" value={d.codigoSku} onChange={(e) => cambiar('codigoSku', e.target.value)} placeholder="VIV-0010" className={claseInput(errores.codigoSku)} />
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="nombre" etiqueta="Nombre" error={errores.nombre}>
            <input id="nombre" value={d.nombre} onChange={(e) => cambiar('nombre', e.target.value)} placeholder="Harina de maíz 1 kg" className={claseInput(errores.nombre)} />
          </Campo>
        </div>
      </div>

      <Campo id="descripcion" etiqueta="Descripción (opcional)" error={errores.descripcion}>
        <textarea id="descripcion" rows={2} value={d.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} className={claseInput(errores.descripcion)} />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="precio" etiqueta="Precio de venta (USD)" error={errores.precioUsd}>
          <input id="precio" type="number" min="0" step="0.01" value={d.precioUsd} onChange={(e) => cambiar('precioUsd', e.target.value)} className={claseInput(errores.precioUsd)} />
        </Campo>
        <Campo id="costo" etiqueta="Costo (USD)" error={errores.costoUsd} ayuda={margen != null ? `Margen: ${formatoPct(margen)}` : undefined}>
          <input id="costo" type="number" min="0" step="0.01" value={d.costoUsd} onChange={(e) => cambiar('costoUsd', e.target.value)} className={claseInput(errores.costoUsd)} />
        </Campo>
        <Campo id="categoria" etiqueta="Categoría" error={errores.categoriaId}>
          <select id="categoria" value={d.categoriaId} onChange={(e) => cambiar('categoriaId', e.target.value)} className={claseInput(errores.categoriaId)}>
            <option value="">Elige una</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Campo
          id="stock"
          etiqueta={esNuevo ? 'Stock inicial' : 'Stock disponible'}
          error={errores[campoStock]}
          ayuda={esNuevo ? undefined : 'Si lo cambias, queda como ajuste.'}
        >
          <input id="stock" type="number" min="0" step="1" value={d[campoStock]} onChange={(e) => cambiar(campoStock, e.target.value)} className={claseInput(errores[campoStock])} />
        </Campo>
        <Campo id="minimo" etiqueta="Stock mínimo" error={errores.stockMinimo}>
          <input id="minimo" type="number" min="0" step="1" value={d.stockMinimo} onChange={(e) => cambiar('stockMinimo', e.target.value)} className={claseInput(errores.stockMinimo)} />
        </Campo>
        <Campo id="maximo" etiqueta="Stock máximo" error={errores.stockMaximo}>
          <input id="maximo" type="number" min="1" step="1" value={d.stockMaximo} onChange={(e) => cambiar('stockMaximo', e.target.value)} className={claseInput(errores.stockMaximo)} />
        </Campo>
        <Campo id="unidad" etiqueta="Unidad" error={errores.unidadMedida}>
          <select id="unidad" value={d.unidadMedida} onChange={(e) => cambiar('unidadMedida', e.target.value)} className={claseInput(errores.unidadMedida)}>
            {[...new Set([d.unidadMedida, ...UNIDADES])].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Campo id="imagen" etiqueta="URL de la imagen (opcional)" error={errores.imagenUrl}>
            <input id="imagen" type="url" value={d.imagenUrl} onChange={(e) => cambiar('imagenUrl', e.target.value)} placeholder="https://…" className={claseInput(errores.imagenUrl)} />
          </Campo>
        </div>
        <Campo id="ubicacion" etiqueta="Ubicación (opcional)" error={errores.ubicacion} ayuda="Pasillo y estante, p. ej. P1-E4">
          <input id="ubicacion" value={d.ubicacion} onChange={(e) => cambiar('ubicacion', e.target.value)} className={claseInput(errores.ubicacion)} />
        </Campo>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={alCancelar} className={claseBoton.secundario}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className={claseBoton.primario}>
          {guardando ? 'Guardando…' : esNuevo ? 'Crear producto' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
