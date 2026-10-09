import { useCallback, useEffect, useMemo, useState } from 'react'
import { listarPersonal, cambiarActivo } from '../../api/usuarios'
import Modal from '../../components/Modal'
import FormularioUsuario from './FormularioUsuario'

// Gestión del personal: el gerente crea, edita, activa y desactiva cuentas de
// vendedores y repartidores. El backend no borra usuarios: los desactiva, y un
// usuario desactivado pierde el acceso de inmediato (su historial se conserva).
const ROLES = {
  ventas: { nombre: 'Ventas', clase: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300' },
  repartidor: { nombre: 'Repartidor', clase: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300' },
}

const FILTROS_ROL = [
  ['todos', 'Todos'],
  ['ventas', 'Ventas'],
  ['repartidor', 'Repartidores'],
]

const FILTROS_ESTADO = [
  ['todos', 'Todos'],
  ['activos', 'Activos'],
  ['inactivos', 'Inactivos'],
]

function EtiquetaRol({ rol }) {
  const r = ROLES[rol] ?? { nombre: rol, clase: 'bg-slate-100 text-slate-700' }
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${r.clase}`}>{r.nombre}</span>
}

function EtiquetaEstado({ activo }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${activo ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'}`}>
      <span className={`h-2 w-2 rounded-full ${activo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

function Acciones({ usuario, alEditar, alCambiarActivo }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => alEditar(usuario)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Editar
      </button>
      <button
        type="button"
        onClick={() => alCambiarActivo(usuario)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
          usuario.activo
            ? 'border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40'
            : 'border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
        }`}
      >
        {usuario.activo ? 'Desactivar' : 'Activar'}
      </button>
    </div>
  )
}

function Selector({ etiqueta, opciones, valor, alCambiar }) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex rounded-lg border border-slate-300 bg-superficie p-0.5">
      {opciones.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          onClick={() => alCambiar(v)}
          aria-pressed={valor === v}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
            valor === v ? 'bg-marca-700 dark:bg-marca-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}

export default function Personal() {
  const [usuarios, setUsuarios] = useState([])
  const [incompleto, setIncompleto] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [buscar, setBuscar] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  // Modal de crear/editar: null = cerrado, 'nuevo' = crear, objeto = editar ese usuario.
  const [editando, setEditando] = useState(null)
  // Usuario pendiente de confirmar para desactivar.
  const [porDesactivar, setPorDesactivar] = useState(null)
  const [cambiandoId, setCambiandoId] = useState(null)
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'error', texto }

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga('')
    try {
      const r = await listarPersonal()
      setUsuarios(r.usuarios)
      setIncompleto(r.incompleto)
    } catch (err) {
      setErrorCarga(err.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // El aviso de éxito o error desaparece solo.
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return usuarios.filter(
      (u) =>
        (filtroRol === 'todos' || u.rol === filtroRol) &&
        (filtroEstado === 'todos' || u.activo === (filtroEstado === 'activos')) &&
        (!q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    )
  }, [usuarios, buscar, filtroRol, filtroEstado])

  const cerrarFormulario = useCallback(() => setEditando(null), [])
  const cerrarConfirmacion = useCallback(() => setPorDesactivar(null), [])

  function alGuardar(guardado, esNuevo) {
    setUsuarios((lista) =>
      (esNuevo ? [...lista, guardado] : lista.map((u) => (u.id === guardado.id ? guardado : u))).sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es'),
      ),
    )
    setEditando(null)
    setAviso({ tipo: 'ok', texto: esNuevo ? `Se creó la cuenta de ${guardado.nombre}.` : `Se guardaron los cambios de ${guardado.nombre}.` })
  }

  async function aplicarCambioActivo(usuario, activo) {
    setCambiandoId(usuario.id)
    try {
      const actualizado = await cambiarActivo(usuario.id, activo)
      setUsuarios((lista) => lista.map((u) => (u.id === actualizado.id ? actualizado : u)))
      setAviso({ tipo: 'ok', texto: `${actualizado.nombre} quedó ${activo ? 'activo' : 'inactivo'}.` })
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message })
    } finally {
      setCambiandoId(null)
      setPorDesactivar(null)
    }
  }

  // Desactivar pide confirmación; activar se hace directo.
  function alCambiarActivo(usuario) {
    if (cambiandoId) return
    if (usuario.activo) setPorDesactivar(usuario)
    else aplicarCambioActivo(usuario, true)
  }

  const totalActivos = usuarios.filter((u) => u.activo).length

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Personal</h2>
          <p className="mt-1 text-slate-600">Crea y administra las cuentas de vendedores y repartidores.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditando('nuevo')}
          className="rounded-lg bg-marca-700 dark:bg-marca-600 px-4 py-2 text-sm font-semibold text-white hover:bg-marca-800 dark:hover:bg-marca-500"
        >
          + Nuevo usuario
        </button>
      </section>

      {aviso && (
        <p
          role="status"
          className={`rounded-lg px-4 py-2 text-sm ${
            aviso.tipo === 'ok' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="search"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar por nombre o correo"
          className="w-full rounded-lg border border-slate-300 bg-superficie px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100 dark:focus:ring-marca-700 lg:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Selector etiqueta="Filtrar por rol" opciones={FILTROS_ROL} valor={filtroRol} alCambiar={setFiltroRol} />
          <Selector etiqueta="Filtrar por estado" opciones={FILTROS_ESTADO} valor={filtroEstado} alCambiar={setFiltroEstado} />
        </div>
        {!cargando && !errorCarga && (
          <p className="text-xs text-slate-500 lg:ml-auto">
            {usuarios.length} en total · {totalActivos} activos
          </p>
        )}
      </div>

      {incompleto && (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
          Hay más de 100 cuentas de un mismo rol; solo se muestran las primeras 100.
        </p>
      )}

      {/* Contenido */}
      {cargando ? (
        <div className="rounded-2xl border border-slate-200 bg-superficie p-10 text-center text-sm text-slate-500">
          Cargando personal…
        </div>
      ) : errorCarga ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-superficie p-10 text-center">
          <p className="text-sm text-red-700 dark:text-red-300">{errorCarga}</p>
          <button
            type="button"
            onClick={cargar}
            className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reintentar
          </button>
        </div>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-superficie p-10 text-center">
          <p className="font-medium text-slate-700">
            {usuarios.length === 0 ? 'Todavía no hay vendedores ni repartidores.' : 'Nadie coincide con la búsqueda.'}
          </p>
          {usuarios.length === 0 && (
            <p className="mt-1 text-sm text-slate-500">Crea la primera cuenta con “Nuevo usuario”.</p>
          )}
        </div>
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <ul className="space-y-3 md:hidden">
            {visibles.map((u) => (
              <li key={u.id} className={`rounded-xl border border-slate-200 bg-superficie p-4 ${u.activo ? '' : 'opacity-70'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{u.nombre}</p>
                    <p className="truncate text-sm text-slate-500">{u.email}</p>
                  </div>
                  <EtiquetaRol rol={u.rol} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <EtiquetaEstado activo={u.activo} />
                  <Acciones usuario={u} alEditar={setEditando} alCambiarActivo={alCambiarActivo} />
                </div>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-superficie md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Correo</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map((u) => (
                  <tr key={u.id} className={u.activo ? '' : 'bg-slate-50/60 text-slate-500'}>
                    <td className="px-4 py-3 font-medium text-slate-900">{u.nombre}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3"><EtiquetaRol rol={u.rol} /></td>
                    <td className="px-4 py-3"><EtiquetaEstado activo={u.activo} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Acciones usuario={u} alEditar={setEditando} alCambiarActivo={alCambiarActivo} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Crear / editar */}
      <Modal
        abierto={editando !== null}
        titulo={editando === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'}
        alCerrar={cerrarFormulario}
      >
        {editando !== null && (
          <FormularioUsuario
            key={editando === 'nuevo' ? 'nuevo' : editando.id}
            usuario={editando === 'nuevo' ? null : editando}
            alGuardar={alGuardar}
            alCancelar={cerrarFormulario}
          />
        )}
      </Modal>

      {/* Confirmar desactivación */}
      <Modal abierto={porDesactivar !== null} titulo="Desactivar cuenta" alCerrar={cerrarConfirmacion} ancho="sm:max-w-md">
        {porDesactivar && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              <strong>{porDesactivar.nombre}</strong> no podrá iniciar sesión y, si tiene una sesión abierta, perderá el
              acceso de inmediato. Su historial se conserva y puedes volver a activarla cuando quieras.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cerrarConfirmacion}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => aplicarCambioActivo(porDesactivar, false)}
                disabled={cambiandoId !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {cambiandoId ? 'Desactivando…' : 'Desactivar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
