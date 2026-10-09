// Gestión del personal (solo superadmin) contra /usuarios de Backend_Almacen.
// El backend no borra usuarios: se desactivan, y un usuario desactivado pierde el acceso al instante.
import { pedir } from './cliente';

// Roles que el gerente puede crear y editar.
export const ROLES_PERSONAL = ['ventas', 'repartidor'];

// El endpoint lista a todos los usuarios (también clientes y al gerente), así que se pide
// cada rol del personal por separado y se unen. 100 es el tamaño máximo de página de la API.
export async function listarPersonal() {
  const paginas = await Promise.all(
    ROLES_PERSONAL.map((rol) => pedir('/usuarios', { consulta: { rol, tamano: 100 } })),
  );
  const usuarios = paginas.flatMap((p) => p.items);
  const incompleto = paginas.some((p) => p.total > p.items.length);
  usuarios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { usuarios, incompleto };
}

export function crearUsuario({ nombre, email, telefono, rol, password }) {
  return pedir('/usuarios', {
    metodo: 'POST',
    cuerpo: { nombre, email, telefono: telefono || null, rol, password },
  });
}

// password vacío = se conserva la contraseña actual.
export function actualizarUsuario(id, { nombre, email, telefono, rol, password }) {
  return pedir(`/usuarios/${id}`, {
    metodo: 'PUT',
    cuerpo: { nombre, email, telefono: telefono || null, rol, password: password || null },
  });
}

export function cambiarActivo(id, activo) {
  return pedir(`/usuarios/${id}/${activo ? 'activar' : 'desactivar'}`, { metodo: 'POST' });
}
