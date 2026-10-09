import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorApi, guardarToken, obtenerToken, pedir, urlArchivo } from './cliente'

// Respuesta simulada de fetch.
function respuesta(estado, cuerpo, tipo = 'application/json') {
  const texto = cuerpo === undefined ? null : tipo.includes('json') ? JSON.stringify(cuerpo) : cuerpo
  return new Response(texto, { status: estado, headers: texto ? { 'Content-Type': tipo } : {} })
}

let fetchSimulado

beforeEach(() => {
  fetchSimulado = vi.fn()
  vi.stubGlobal('fetch', fetchSimulado)
})

function ultimaLlamada() {
  const [url, opciones] = fetchSimulado.mock.calls.at(-1)
  return { url: url.toString(), ...opciones }
}

describe('pedir: armado de la petición', () => {
  it('usa la URL de la API y agrega los filtros omitiendo los vacíos', async () => {
    fetchSimulado.mockResolvedValue(respuesta(200, []))

    await pedir('/productos', { consulta: { q: 'harina', pagina: 2, categoriaId: '', vacio: null, nada: undefined } })

    expect(ultimaLlamada().url).toBe('http://api.pruebas/productos?q=harina&pagina=2')
    expect(ultimaLlamada().method).toBe('GET')
  })

  it('sin sesión no envía el encabezado Authorization', async () => {
    fetchSimulado.mockResolvedValue(respuesta(200, {}))

    await pedir('/catalogo')

    expect(ultimaLlamada().headers.Authorization).toBeUndefined()
  })

  it('con sesión envía el token como Bearer', async () => {
    guardarToken('token-de-prueba')
    fetchSimulado.mockResolvedValue(respuesta(200, {}))

    await pedir('/productos')

    expect(ultimaLlamada().headers.Authorization).toBe('Bearer token-de-prueba')
  })

  it('serializa el cuerpo como JSON', async () => {
    fetchSimulado.mockResolvedValue(respuesta(201, { id: 1 }))

    await pedir('/categorias', { metodo: 'POST', cuerpo: { nombre: 'Bebidas' } })

    const llamada = ultimaLlamada()
    expect(llamada.method).toBe('POST')
    expect(llamada.body).toBe('{"nombre":"Bebidas"}')
    expect(llamada.headers['Content-Type']).toBe('application/json')
  })

  it('envía FormData tal cual, sin forzar el Content-Type', async () => {
    fetchSimulado.mockResolvedValue(respuesta(200, {}))
    const datos = new FormData()
    datos.append('captura', 'archivo')

    await pedir('/pedidos', { metodo: 'POST', cuerpo: datos })

    expect(ultimaLlamada().body).toBe(datos)
    expect(ultimaLlamada().headers['Content-Type']).toBeUndefined()
  })
})

describe('pedir: respuestas correctas', () => {
  it('devuelve el JSON de la respuesta', async () => {
    fetchSimulado.mockResolvedValue(respuesta(200, { nombre: 'Arroz' }))

    await expect(pedir('/productos/1')).resolves.toEqual({ nombre: 'Arroz' })
  })

  it('devuelve null con 204 No Content', async () => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(pedir('/productos/1', { metodo: 'DELETE' })).resolves.toBeNull()
  })

  it('devuelve un Blob cuando la respuesta es un archivo (informe en Excel)', async () => {
    const tipoExcel = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    fetchSimulado.mockResolvedValue(respuesta(200, 'contenido', tipoExcel))

    const archivo = await pedir('/reportes/excel')

    expect(archivo).toBeInstanceOf(Blob)
    expect(archivo.type).toBe(tipoExcel)
  })
})

describe('pedir: errores', () => {
  it('usa el campo "mensaje" de la API como mensaje del error', async () => {
    fetchSimulado.mockResolvedValue(respuesta(409, { mensaje: 'El SKU ya existe.' }))

    const error = await pedir('/productos', { metodo: 'POST', cuerpo: {} }).catch((e) => e)

    expect(error).toBeInstanceOf(ErrorApi)
    expect(error.message).toBe('El SKU ya existe.')
    expect(error.estado).toBe(409)
  })

  it('con errores de validación (Problem Details) usa el primer mensaje y conserva los datos', async () => {
    const problema = {
      title: 'One or more validation errors occurred.',
      errors: { PrecioUsd: ['El precio debe ser mayor que 0.'] },
    }
    fetchSimulado.mockResolvedValue(respuesta(400, problema, 'application/problem+json'))

    const error = await pedir('/productos', { metodo: 'POST', cuerpo: {} }).catch((e) => e)

    expect(error.message).toBe('El precio debe ser mayor que 0.')
    expect(error.datos).toEqual(problema)
  })

  it.each([
    [403, 'No tienes permiso para hacer esto.'],
    [404, 'No se encontró lo que buscas.'],
    [503, 'El servicio no está disponible en este momento.'],
  ])('sin explicación de la API, el %i usa un mensaje por defecto', async (estado, mensaje) => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: estado }))

    await expect(pedir('/productos')).rejects.toThrow(mensaje)
  })

  it('usa el título del Problem Details si no hay otro mensaje', async () => {
    fetchSimulado.mockResolvedValue(respuesta(500, { title: 'Error interno' }, 'application/problem+json'))

    await expect(pedir('/productos')).rejects.toThrow('Error interno')
  })

  it('si no puede conectar, lanza un error de red con estado 0', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await pedir('/productos').catch((e) => e)

    expect(error).toBeInstanceOf(ErrorApi)
    expect(error.estado).toBe(0)
    expect(error.message).toMatch(/No se pudo conectar/)
  })
})

describe('pedir: sesión vencida', () => {
  it('con un 401 y sesión activa borra el token y emite "sesion-expirada"', async () => {
    guardarToken('token-vencido')
    const alExpirar = vi.fn()
    window.addEventListener('sesion-expirada', alExpirar)
    fetchSimulado.mockResolvedValue(new Response(null, { status: 401 }))

    await expect(pedir('/productos')).rejects.toThrow(/sesión venció/)

    expect(obtenerToken()).toBeNull()
    expect(alExpirar).toHaveBeenCalledOnce()
    window.removeEventListener('sesion-expirada', alExpirar)
  })

  it('un 401 sin sesión (credenciales incorrectas) no emite el evento', async () => {
    const alExpirar = vi.fn()
    window.addEventListener('sesion-expirada', alExpirar)
    fetchSimulado.mockResolvedValue(respuesta(401, { mensaje: 'Correo o contraseña incorrectos.' }))

    await expect(pedir('/auth/login', { metodo: 'POST', cuerpo: {} })).rejects.toThrow('Correo o contraseña incorrectos.')

    expect(alExpirar).not.toHaveBeenCalled()
    window.removeEventListener('sesion-expirada', alExpirar)
  })
})

describe('token y archivos', () => {
  it('guardarToken guarda y borra el token del navegador', () => {
    guardarToken('abc')
    expect(obtenerToken()).toBe('abc')

    guardarToken(null)
    expect(obtenerToken()).toBeNull()
  })

  it('urlArchivo completa las rutas relativas con la URL de la API', () => {
    expect(urlArchivo('/uploads/captura.png')).toBe('http://api.pruebas/uploads/captura.png')
  })

  it('urlArchivo deja intactas las URL completas (Cloudinary) y devuelve null sin ruta', () => {
    expect(urlArchivo('https://res.cloudinary.com/x/captura.png')).toBe('https://res.cloudinary.com/x/captura.png')
    expect(urlArchivo(null)).toBeNull()
  })
})
