import { useCallback, useEffect, useState } from 'react'
import {
  borrarProducto,
  crearCategoria,
  listarCategorias,
  listarProductos,
  renombrarCategoria,
} from '../../api/productos'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import { Aviso, EncabezadoPagina, EstadoCarga, Paginacion } from '../../components/ui'
import { claseBoton, claseInput } from '../../utils/panel'
import { formatoUsd } from '../../utils/formato'
import FormularioProducto from './FormularioProducto'
import Icono from '../../components/Icono'

// Gestión del catálogo: ventas crea y edita productos; solo el gerente (superadmin)
// puede borrarlos (borrado lógico) y crear o renombrar categorías. Para ventas esas
// acciones ni siquiera se muestran (RBAC en el cliente; la API también las bloquea).
const TAMANO = 25

function Categorias({ categorias, puedeEditar, alCambiar }) {
  const [nueva, setNueva] = useState('')
  const [editando, setEditando] = useState(null) // { id, nombre }
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(accion) {
    setGuardando(true)
    setError('')
    try {
      await accion()
      setNueva('')
      setEditando(null)
      alCambiar()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {categorias.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            {editando?.id === c.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  guardar(() => renombrarCategoria(c.id, editando.nombre.trim()))
                }}
              >
                <input
                  aria-label="Nuevo nombre"
                  autoFocus
                  value={editando.nombre}
                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  className={claseInput()}
                />
                <button type="submit" disabled={guardando || !editando.nombre.trim()} className={claseBoton.pequeno}>
                  Guardar
                </button>
                <button type="button" onClick={() => setEditando(null)} className={claseBoton.pequeno}>
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-slate-800">{c.nombre}</span>
                {puedeEditar && (
                  <button type="button" onClick={() => setEditando({ id: c.id, nombre: c.nombre })} className={claseBoton.pequeno}>
                    Renombrar
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {puedeEditar ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            guardar(() => crearCategoria(nueva.trim()))
          }}
        >
          <input aria-label="Nombre de la nueva categoría" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva categoría" className={claseInput()} />
          <button type="submit" disabled={guardando || !nueva.trim()} className={`${claseBoton.primario} shrink-0`}>
            Agregar
          </button>
        </form>
      ) : (
        <p className="text-xs text-slate-500">Solo el gerente puede crear o renombrar categorías.</p>
      )}
    </div>
  )
}

export default function Productos() {
  const { tieneRol } = useAuth()
  const esGerente = tieneRol('superadmin')

  const [categorias, setCategorias] = useState([])
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [buscar, setBuscar] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [inactivos, setInactivos] = useState(false)
  const [pagina, setPagina] = useState(1)

  const [editando, setEditando] = useState(null) // null | 'nuevo' | producto
  const [porBorrar, setPorBorrar] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const [verCategorias, setVerCategorias] = useState(false)
  const [aviso, setAviso] = useState(null)

  const cargarCategorias = useCallback(() => {
    listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]))
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setResultado(await listarProductos({ q: buscar, categoriaId, incluirInactivos: inactivos || undefined, pagina, tamano: TAMANO }))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [buscar, categoriaId, inactivos, pagina])

  useEffect(cargarCategorias, [cargarCategorias])
  useEffect(() => {
    cargar()
  }, [cargar])

  // Busca medio segundo después de dejar de escribir.
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscar(q.trim())
      setPagina(1)
    }, 500)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  const cerrarFormulario = useCallback(() => setEditando(null), [])
  const cerrarBorrado = useCallback(() => setPorBorrar(null), [])
  const cerrarCategorias = useCallback(() => setVerCategorias(false), [])

  function alGuardar(guardado, esNuevo) {
    setEditando(null)
    setAviso({ tipo: 'ok', texto: esNuevo ? `Se creó ${guardado.nombre}.` : `Se guardaron los cambios de ${guardado.nombre}.` })
    cargar()
  }

  async function confirmarBorrado() {
    setBorrando(true)
    try {
      await borrarProducto(porBorrar.id)
      setAviso({ tipo: 'ok', texto: `${porBorrar.nombre} se quitó del catálogo.` })
      cargar()
    } catch (e) {
      setAviso({ tipo: 'error', texto: e.message })
    } finally {
      setBorrando(false)
      setPorBorrar(null)
    }
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Productos" detalle="Crea y edita los productos del catálogo.">
        <button type="button" onClick={() => setVerCategorias(true)} className={claseBoton.secundario}>
          Categorías
        </button>
        <button type="button" onClick={() => setEditando('nuevo')} className={claseBoton.primario}>
          + Nuevo producto
        </button>
      </EncabezadoPagina>

      <Aviso aviso={aviso} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o SKU"
          aria-label="Buscar productos"
          className={`${claseInput()} lg:max-w-xs`}
        />
        <select
          aria-label="Filtrar por categoría"
          value={categoriaId}
          onChange={(e) => {
            setCategoriaId(e.target.value)
            setPagina(1)
          }}
          className={`${claseInput()} lg:max-w-56`}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        {esGerente && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} className="h-4 w-4 accent-marca-700" />
            Mostrar borrados
          </label>
        )}
        {resultado && !cargando && <p className="text-xs text-slate-500 lg:ml-auto">{resultado.total} productos</p>}
      </div>

      <EstadoCarga cargando={cargando} error={error} alReintentar={cargar} vacio={resultado?.items.length === 0} textoVacio="No hay productos que coincidan.">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-superficie">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 text-right font-semibold">Precio</th>
                <th className="px-4 py-3 text-right font-semibold">Costo</th>
                <th className="px-4 py-3 text-right font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resultado?.items.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'bg-slate-50 text-slate-400'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 text-lg">
                        {p.imagenUrl ? <img src={p.imagenUrl} alt="" className="h-full w-full object-contain" /> : <Icono nombre="bolsa" className="h-5 w-5 text-slate-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {p.nombre} {!p.activo && <span className="text-xs font-normal">(borrado)</span>}
                        </p>
                        <p className="font-mono text-xs text-slate-500">{p.codigoSku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{p.categoria}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatoUsd(p.precioUsd)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatoUsd(p.costoUsd)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.stockDisponible === 0 ? 'font-semibold text-red-700 dark:text-red-300' : p.bajoStockMinimo ? 'font-semibold text-amber-700 dark:text-amber-300' : ''}>
                      {p.stockDisponible}
                    </span>
                    <span className="block text-xs text-slate-400">mín. {p.stockMinimo}</span>
                  </td>
                  <td className="px-4 py-3">
                    {p.activo && (
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditando(p)} className={claseBoton.pequeno}>
                          Editar
                        </button>
                        {esGerente && (
                          <button
                            type="button"
                            onClick={() => setPorBorrar(p)}
                            className="rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacion pagina={pagina} total={resultado?.total ?? 0} tamano={TAMANO} alCambiar={setPagina} />
      </EstadoCarga>

      <Modal abierto={editando !== null} titulo={editando === 'nuevo' ? 'Nuevo producto' : 'Editar producto'} alCerrar={cerrarFormulario} ancho="sm:max-w-2xl">
        {editando !== null && (
          <FormularioProducto
            key={editando === 'nuevo' ? 'nuevo' : editando.id}
            producto={editando === 'nuevo' ? null : editando}
            categorias={categorias}
            alGuardar={alGuardar}
            alCancelar={cerrarFormulario}
          />
        )}
      </Modal>

      <Modal abierto={porBorrar !== null} titulo="Eliminar producto" alCerrar={cerrarBorrado} ancho="sm:max-w-md">
        {porBorrar && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              <strong>{porBorrar.nombre}</strong> dejará de aparecer en la tienda. Es un borrado lógico: su historial de ventas y
              de inventario se conserva.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={cerrarBorrado} className={claseBoton.secundario}>
                Cancelar
              </button>
              <button type="button" onClick={confirmarBorrado} disabled={borrando} className={claseBoton.peligro}>
                {borrando ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal abierto={verCategorias} titulo="Categorías" alCerrar={cerrarCategorias} ancho="sm:max-w-md">
        <Categorias categorias={categorias} puedeEditar={esGerente} alCambiar={cargarCategorias} />
      </Modal>
    </div>
  )
}
