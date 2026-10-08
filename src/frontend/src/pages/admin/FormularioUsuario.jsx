import { useState } from 'react'
import { crearUsuario, actualizarUsuario } from '../../api/usuarios'

// Formulario para crear o editar un vendedor o repartidor.
// - Crear: la contraseña es obligatoria.
// - Editar: la contraseña es opcional; si se deja vacía se conserva la actual.
// El correo es el usuario con el que la persona inicia sesión.
// Las reglas son las mismas que valida el backend; si el backend rechaza algo,
// su mensaje aparece debajo del campo correspondiente.
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

const OPCIONES_ROL = [
  { valor: 'ventas', nombre: 'Ventas', detalle: 'Pedidos, pagos, productos y stock.' },
  { valor: 'repartidor', nombre: 'Repartidor', detalle: 'Entrega los pedidos que tiene asignados.' },
]

function validar(datos, esNuevo) {
  const errores = {}
  if (!datos.nombre.trim()) errores.nombre = 'El nombre es obligatorio.'
  if (!datos.email.trim()) errores.email = 'El correo es obligatorio.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) errores.email = 'El correo no tiene un formato válido.'
  if (esNuevo && !datos.password) errores.password = 'La contraseña es obligatoria.'
  else if (datos.password && (datos.password.length < PASSWORD_MIN || datos.password.length > PASSWORD_MAX)) {
    errores.password = `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`
  }
  if (!datos.rol) errores.rol = 'Elige un rol.'
  return errores
}

// Convierte la respuesta de error del backend en errores por campo.
function erroresDelServidor(err) {
  const porCampo = {}
  for (const [campo, mensajes] of Object.entries(err.datos?.errors ?? {})) {
    porCampo[campo.charAt(0).toLowerCase() + campo.slice(1)] = mensajes[0]
  }
  if (Object.keys(porCampo).length) return porCampo
  // 409 por correo repetido: debajo del correo. Cualquier otro: arriba del formulario.
  if (err.estado === 409 && /correo/i.test(err.message)) return { email: err.message }
  return { general: err.message }
}

function Campo({ id, etiqueta, ayuda, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p>
      ) : (
        ayuda && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>
      )}
    </div>
  )
}

const claseInput = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
    error ? 'border-red-400 dark:border-red-700 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-900' : 'border-slate-300 focus:border-marca-500 focus:ring-marca-100 dark:focus:ring-marca-700'
  }`

export default function FormularioUsuario({ usuario, alGuardar, alCancelar }) {
  const esNuevo = !usuario
  const [datos, setDatos] = useState({
    nombre: usuario?.nombre ?? '',
    email: usuario?.email ?? '',
    password: '',
    rol: usuario?.rol ?? '',
  })
  const [errores, setErrores] = useState({})
  const [verClave, setVerClave] = useState(false)
  const [guardando, setGuardando] = useState(false)

  function cambiar(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }))
    if (errores[campo] || errores.general) setErrores((e) => ({ ...e, [campo]: undefined, general: undefined }))
  }

  async function alEnviar(e) {
    e.preventDefault()
    const encontrados = validar(datos, esNuevo)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return

    const cuerpo = {
      nombre: datos.nombre.trim(),
      email: datos.email.trim(),
      password: datos.password,
      rol: datos.rol,
      // El formulario no edita el teléfono: al editar se conserva el que ya tenía.
      telefono: usuario?.telefono ?? null,
    }

    setGuardando(true)
    try {
      const guardado = esNuevo ? await crearUsuario(cuerpo) : await actualizarUsuario(usuario.id, cuerpo)
      alGuardar(guardado, esNuevo)
    } catch (err) {
      setErrores(erroresDelServidor(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={alEnviar} noValidate className="space-y-4">
      {errores.general && (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{errores.general}</p>
      )}

      <Campo id="u-nombre" etiqueta="Nombre completo" error={errores.nombre}>
        <input
          id="u-nombre"
          value={datos.nombre}
          onChange={(e) => cambiar('nombre', e.target.value)}
          maxLength={150}
          autoComplete="off"
          placeholder="Ej.: María Pérez"
          className={claseInput(errores.nombre)}
        />
      </Campo>

      <Campo
        id="u-email"
        etiqueta="Correo (usuario para iniciar sesión)"
        ayuda="Con este correo y la contraseña entrará al sistema."
        error={errores.email}
      >
        <input
          id="u-email"
          type="email"
          value={datos.email}
          onChange={(e) => cambiar('email', e.target.value)}
          maxLength={254}
          autoComplete="off"
          placeholder="maria@almacen.local"
          className={claseInput(errores.email)}
        />
      </Campo>

      <Campo
        id="u-clave"
        etiqueta={esNuevo ? 'Contraseña' : 'Nueva contraseña'}
        ayuda={esNuevo ? `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.` : 'Déjala vacía para no cambiarla.'}
        error={errores.password}
      >
        <div className="relative">
          <input
            id="u-clave"
            type={verClave ? 'text' : 'password'}
            value={datos.password}
            onChange={(e) => cambiar('password', e.target.value)}
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
            className={`${claseInput(errores.password)} pr-20`}
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            {verClave ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </Campo>

      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-slate-700">Rol</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPCIONES_ROL.map((op) => (
            <label
              key={op.valor}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                datos.rol === op.valor ? 'border-marca-500 bg-marca-50 dark:bg-marca-700/40 ring-1 ring-marca-500' : 'border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="rol"
                value={op.valor}
                checked={datos.rol === op.valor}
                onChange={() => cambiar('rol', op.valor)}
                className="mt-0.5 accent-marca-600"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{op.nombre}</span>
                <span className="block text-xs text-slate-500">{op.detalle}</span>
              </span>
            </label>
          ))}
        </div>
        {errores.rol && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{errores.rol}</p>}
      </fieldset>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={alCancelar}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-marca-700 dark:bg-marca-600 px-4 py-2 text-sm font-semibold text-white hover:bg-marca-800 dark:hover:bg-marca-500 disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : esNuevo ? 'Crear usuario' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
