// Carga única de Google Identity Services; el token se valida siempre en la API.
let carga
let clienteInicializado
let recibirCredencial

export function cargarGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (carga) return carga

  carga = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client?hl=es'
    script.async = true
    const fallar = () => {
      clearTimeout(timeout)
      script.remove()
      reject(new Error('No se pudo cargar Google. Revisa tu conexión e inténtalo de nuevo.'))
    }
    const timeout = setTimeout(fallar, 15000)
    script.onerror = fallar
    script.onload = () => {
      if (!window.google?.accounts?.id) return fallar()
      clearTimeout(timeout)
      resolve(window.google.accounts.id)
    }
    document.head.append(script)
  }).catch((error) => {
    carga = undefined
    throw error
  })
  return carga
}

export function mostrarBotonGoogle(google, elemento, clientId, callback) {
  recibirCredencial = callback
  if (clienteInicializado !== clientId) {
    google.initialize({
      client_id: clientId,
      callback: (respuesta) => recibirCredencial?.(respuesta),
      auto_select: false,
      ux_mode: 'popup',
    })
    clienteInicializado = clientId
  }
  elemento.replaceChildren()
  google.renderButton(elemento, {
    type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
    shape: 'pill', locale: 'es', width: 280,
  })
  return () => {
    if (recibirCredencial === callback) recibirCredencial = undefined
    elemento.replaceChildren()
  }
}
