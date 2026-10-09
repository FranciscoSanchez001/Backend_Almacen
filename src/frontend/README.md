<div align="center">

# Sistema E-commerce para Supermercado

### Aplicación web · Frontend

Aplicación de página única (SPA) de la plataforma de comercio electrónico del supermercado:
tienda en línea, panel de ventas, administración con indicadores de negocio y área de entregas.

<br>

<img src="https://skillicons.dev/icons?i=react,vite,tailwind,js,nodejs,nginx,docker,git,github&perline=9" alt="Stack tecnológico" />

<br><br>

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-6-CA4245?style=for-the-badge&logo=reactrouter&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-3-22B5BF?style=for-the-badge)

![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-Alpine-009639?style=for-the-badge&logo=nginx&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

![Tipo](https://img.shields.io/badge/Tipo-SPA-informational?style=flat-square)
![Autenticación](https://img.shields.io/badge/Autenticación-JWT-informational?style=flat-square)
![Errores](https://img.shields.io/badge/Errores-RFC_7807-informational?style=flat-square)
![ESLint](https://img.shields.io/badge/ESLint-9-4B32C3?style=flat-square&logo=eslint&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-75_Passed-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![Metodología](https://img.shields.io/badge/Metodología-Scrum-informational?style=flat-square)

</div>

---

## Tabla de contenidos

1. [Información académica](#1-información-académica)
2. [Descripción general](#2-descripción-general)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Arquitectura](#4-arquitectura)
5. [Mapa de vistas](#5-mapa-de-vistas)
6. [Autenticación y control de acceso](#6-autenticación-y-control-de-acceso)
7. [Dashboard de indicadores](#7-dashboard-de-indicadores)
8. [Tema institucional y modo oscuro](#8-tema-institucional-y-modo-oscuro)
9. [Requisitos previos](#9-requisitos-previos)
10. [Instalación y ejecución](#10-instalación-y-ejecución)
11. [Credenciales de prueba](#11-credenciales-de-prueba)
12. [Configuración](#12-configuración)
13. [Pruebas](#13-pruebas)
14. [Estructura de la carpeta](#14-estructura-de-la-carpeta)
15. [Documentación relacionada](#15-documentación-relacionada)

---

## 1. Información académica

| | |
| :--- | :--- |
| **Asignatura** | Desarrollo de Aplicaciones Web (Código 0423807T) |
| **Facilitador** | M.Sc. Ing. Gabriel Alexis Ramírez Sánchez · <gramirezs@unet.edu.ve> |
| **Institución** | Universidad Nacional Experimental del Táchira (UNET) |
| **Período académico** | Septiembre 2026 |
| **Ubicación** | San Cristóbal, Estado Táchira, Venezuela |

**Equipo de desarrollo**

| Integrante | Rol |
| :--- | :--- |
| María Fernanda Cachopo Rojas | Desarrollo frontend, gestión del proyecto (Scrum) y documentación |
| Gregorio Briceño | Desarrollo backend |
| Francisco Sánchez | Desarrollo backend |

---

## 2. Descripción general

Esta carpeta (`src/frontend/`) contiene la **aplicación web** de la plataforma. Es una SPA construida con **React 19**, **Vite** y **Tailwind CSS** que consume la API REST del backend ([`src/backend/`](../backend/README.md)) mediante HTTP/JSON, sin recargar la página. La visión general del proyecto está en el [README principal](../../README.md).

**Capacidades principales**

- Catálogo público con búsqueda, filtro por categoría, precios en USD y en bolívares y carrito de compras.
- Bandeja de pedidos para el área de ventas: aprobación con asignación de repartidor, rechazo con motivo y contador de expiración.
- Gestión de productos, categorías e inventario, con alertas de stock agotado o por debajo del mínimo.
- Consulta de clientes y de su historial de pedidos.
- Dashboard de indicadores (KPIs) con gráficos y descarga del informe en Excel.
- Administración del personal, registro de auditoría y configuración del sistema (tasa del día, zonas de entrega, datos de pago y expiración).

**Áreas por perfil de usuario**

| Área | Ruta | Perfil | Estado |
| :--- | :--- | :--- | :--- |
| Tienda | `/` | Cliente (público) | Catálogo y carrito disponibles; inicio de sesión con Google y checkout en desarrollo |
| Panel de ventas | `/panel` | `ventas`, `superadmin` | Disponible |
| Administración | `/admin` | `superadmin` | Disponible |
| Entregas | `/repartidor` | `repartidor`, `superadmin` | En desarrollo (maqueta de las secciones previstas) |

---

## 3. Stack tecnológico

| Área | Tecnología | Versión | Uso en el proyecto |
| :--- | :--- | :---: | :--- |
| Biblioteca de UI | React | 19.3 | Componentes, hooks y Context API |
| Herramienta de construcción | Vite | 6.4 | Servidor de desarrollo con HMR y compilación de producción |
| Estilos | Tailwind CSS (`@tailwindcss/vite`) | 4.3 | Utilidades CSS, paleta institucional y modo oscuro por clase |
| Enrutamiento | React Router | 6.30 | Rutas anidadas, layouts por área y rutas protegidas por rol |
| Gráficos | Recharts | 3.10 | Visualizaciones del dashboard de indicadores |
| Calidad de código | ESLint (`react-hooks`, `react-refresh`) | 9 | Análisis estático |
| Pruebas | Vitest | 4.1 | Ejecución de las pruebas unitarias |
| Pruebas | React Testing Library / jsdom | 16.3 / 26.1 | Renderizado de componentes en un navegador simulado |
| Compilación en contenedor | Node.js | 20 LTS | Etapa de construcción de la imagen Docker |
| Servidor web | Nginx | Alpine | Publicación de los archivos estáticos con *fallback* de rutas |
| Contenedores | Docker / Docker Compose | — | Imagen multietapa del frontend |

---

## 4. Arquitectura

```
┌────────────────────────────────────────────────────────┐
│                 Frontend (src/frontend)                │
│                                                        │
│  pages/        Vistas por área (tienda, panel, admin,  │
│                repartidor, login)                      │
│  layouts/      Estructura común de cada área           │
│  components/   Componentes reutilizables               │
│  routes/       RutaProtegida (control de acceso)       │
│  context/      AuthContext · ThemeContext · Carrito    │
│  api/          cliente.js + servicios por recurso      │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON (Bearer JWT)
┌──────────────────────────▼─────────────────────────────┐
│                 API REST (src/backend)                 │
│        .NET 10 · Onion Architecture · PostgreSQL       │
└────────────────────────────────────────────────────────┘
```

### Componentes principales

1. **Cliente HTTP centralizado** (`src/api/cliente.js`). Es el único punto de comunicación con la API: añade el token JWT a cada petición, serializa el cuerpo como JSON o `FormData`, transforma las respuestas de error *Problem Details* (RFC 7807) en mensajes legibles y emite el evento `sesion-expirada` cuando la API responde `401`. Las respuestas que no son JSON (por ejemplo, el informe en Excel) se devuelven como archivo.
2. **Servicios por recurso** (`src/api/*.js`). Encapsulan los endpoints de cada recurso: autenticación, catálogo, pedidos, productos, inventario, clientes, usuarios, notificaciones, reportes, auditoría y configuración.
3. **Estado global con Context API** (`src/context/`):
   - `AuthContext`: sesión del personal. Decodifica el JWT (claims `sub`, `name`, `email`, `role`, `exp`), lo persiste en el navegador y cierra la sesión al vencer el token o al recibir un `401`.
   - `ThemeContext`: tema claro u oscuro, persistido en `localStorage`.
   - `CarritoContext`: carrito de compras de la tienda.
4. **Rutas protegidas** (`src/routes/RutaProtegida.jsx`). Restringen cada área a los roles autorizados.
5. **Carga diferida.** Las vistas del personal se cargan bajo demanda con `React.lazy`, de modo que la tienda no descarga el código del panel ni de los gráficos.

---

## 5. Mapa de vistas

Las rutas se definen en `src/App.jsx`.

```
/                          Tienda                       TiendaLayout · público
└── (inicio)               Catálogo: búsqueda, filtro por categoría (?categoria=id) y carrito

/internal-login            Inicio de sesión del personal (correo y contraseña)

/panel                     Panel de ventas              PanelLayout · ventas, superadmin
├── (inicio)               Resumen: pedidos por revisar, productos agotados, bajo el mínimo y avisos
├── /pedidos               Bandeja de pedidos: detalle, aprobación, rechazo y expiración
├── /productos             Productos y categorías (alta, edición y eliminación)
├── /inventario            Stock disponible y reservado; reposición
└── /clientes              Clientes y su historial de pedidos

/admin                     Administración               PanelLayout · superadmin
├── (inicio)               Dashboard de indicadores y descarga del informe en Excel
├── /personal              Alta, edición y desactivación de cuentas del personal
├── /auditoria             Registro de acciones
└── /configuracion         Tasa Bs/USD, zonas de entrega, datos de pago, soporte y expiración

/repartidor                Entregas                     Layout · repartidor, superadmin
└── (inicio)               En desarrollo

*                          Página no encontrada
```

Los formularios de producto (`FormularioProducto`) y de usuario (`FormularioUsuario`) no tienen ruta propia: se abren dentro de las vistas de Productos y Personal.

---

## 6. Autenticación y control de acceso

**Flujo de sesión del personal**

1. El usuario ingresa por `/internal-login` y el frontend llama a `POST /auth/login`.
2. La API devuelve el token de acceso (JWT) y un *refresh token*; ambos se guardan en `localStorage`.
3. El usuario es redirigido al inicio correspondiente a su rol: `superadmin` → `/admin`, `ventas` → `/panel`, `repartidor` → `/repartidor`. Si intentaba acceder a una ruta concreta de su área, se le devuelve a ella.
4. Al cerrar sesión se llama a `POST /auth/logout` para revocar el *refresh token* y se elimina la sesión del navegador.
5. Si el token vence o la API responde `401`, la sesión se cierra y el usuario debe autenticarse de nuevo. La renovación automática mediante `POST /auth/refresh` aún no está integrada en el frontend.

**Control de acceso por rol (RBAC en el cliente)**

`RutaProtegida` redirige al login a los usuarios sin sesión y al inicio de su propia área a los usuarios con un rol no autorizado. Dentro de cada vista, las acciones restringidas se ocultan según el rol. Este control solo organiza la interfaz: la API valida nuevamente el rol en cada endpoint.

En la rúbrica del curso, **Admin** corresponde a `superadmin` y **Employee** a `ventas`.

| Acción | `superadmin` (Admin) | `ventas` (Employee) |
| :--- | :---: | :---: |
| Consultar y gestionar pedidos | Sí | Sí |
| Crear y editar productos | Sí | Sí |
| Eliminar productos | Sí | No (acción oculta) |
| Crear y renombrar categorías | Sí | No (acción oculta) |
| Dashboard de indicadores y administración (`/admin`) | Sí | No (ruta protegida) |

---

## 7. Dashboard de indicadores

Vista exclusiva del gerente (`pages/admin/PowerBIDashboard.jsx`). Los indicadores provienen de `GET /kpis` filtrados por período (hoy, semana, mes o rango personalizado) y se complementan con `/productos`, `/inventario`, `/pedidos` y `/notificaciones`.

| Indicador | Detalle |
| :--- | :--- |
| Valorización del almacén | Valor del stock a costo y a precio de venta, y margen potencial, total y por categoría |
| Rotación de stock | Global y por producto (unidades vendidas / stock promedio) |
| Alertas de stock crítico | Productos agotados, por debajo del stock mínimo o por encima del stock máximo |
| Ventas y pedidos | Ventas por período, método de pago y zona; tiempos de aprobación y de entrega |

El botón **Descargar Excel** obtiene el informe del mismo período desde `GET /reportes/excel`, por lo que sus cifras coinciden con las de la pantalla. Los gráficos y tablas se ubican en contenedores con desplazamiento horizontal para mantener la legibilidad en pantallas pequeñas.

---

## 8. Tema institucional y modo oscuro

- La paleta `marca` se define en `src/index.css`, con el Azul UNET `#003366` como color principal (`marca-700`).
- El modo oscuro funciona por clase: `ThemeContext` añade `dark` al elemento `<html>` y los componentes utilizan las variantes `dark:` de Tailwind.
- La preferencia se guarda en `localStorage` (`almacen.tema`). `index.html` la aplica antes del primer pintado para evitar el parpadeo al recargar.
- El selector de tema (`components/BotonTema.jsx`) está disponible en la barra superior de todas las áreas.

---

## 9. Requisitos previos

| Herramienta | Versión | Obligatoria |
| :--- | :---: | :---: |
| [Node.js](https://nodejs.org/) (incluye npm) | 20 LTS o superior | Sí, salvo que se use Docker |
| API del backend en ejecución | — | Sí (ver [`src/backend/README.md`](../backend/README.md)) |
| [Git](https://git-scm.com/) | — | Sí |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | — | Opcional |

---

## 10. Instalación y ejecución

### 10.1 Levantar todo con Docker

El `docker-compose.yml` de la raíz construye y publica el frontend junto con el resto de la aplicación (PostgreSQL, migraciones, API y PostgREST). Desde la raíz del repositorio:

```bash
docker compose up -d --build
```

| Servicio | Dirección |
| :--- | :--- |
| Frontend (React + Nginx) | <http://localhost:8080> |
| API REST | <http://localhost:5085> |

La imagen se construye en dos etapas: Node.js 20 compila la aplicación y Nginx publica el contenido de `dist/`. Las variables `VITE_*` se incorporan al código durante la compilación, por lo que se definen como argumentos de construcción en el `docker-compose.yml`.

### 10.2 Ejecutar en modo desarrollo

```bash
cd src/frontend
npm install
cp .env.example .env
npm run dev
```

La aplicación queda disponible en <http://localhost:5173>, con recarga en caliente. El origen `http://localhost:5173` ya está autorizado en la configuración CORS de la API en desarrollo.

### 10.3 Comandos de referencia

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run preview` | Servidor local para revisar la compilación de producción |
| `npm run lint` | Análisis estático con ESLint |
| `npm test` | Pruebas unitarias con Vitest (ver [Pruebas](#13-pruebas)) |

---

## 11. Credenciales de prueba

El personal accede por [`/internal-login`](http://localhost:8080/internal-login). Las cuentas las crea el backend:

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| **Superadmin** (Admin) | `gerente@almacen.local` | `Cambiar123!` |
| **Ventas** (Employee) | `ventas1@almacen.local`, `ventas2@almacen.local` | `Demo1234!` |
| **Repartidor** | `repartidor1@almacen.local` a `repartidor3@almacen.local` | `Demo1234!` |

Las cuentas de ventas y repartidor solo existen si la base se cargó con los datos de demostración (ver [Datos semilla y credenciales](../backend/README.md#10-datos-semilla-y-credenciales) en el README del backend). También pueden crearse desde **Administración > Personal**.

> Estas credenciales son exclusivas del entorno de desarrollo.

---

## 12. Configuración

Variables de entorno (archivo `.env`, a partir de `.env.example`):

| Variable | Propósito | Valor por defecto |
| :--- | :--- | :--- |
| `VITE_API_URL` | Dirección de la API tal como la ve el navegador | `http://localhost:5085` |
| `VITE_GOOGLE_CLIENT_ID` | Client ID de Google para el inicio de sesión de clientes; debe coincidir con `Google:ClientId` del backend | Vacío |

**Consideraciones de despliegue**

- **Variables en tiempo de compilación.** Vite incorpora las variables `VITE_*` al JavaScript generado. Cualquier cambio requiere volver a compilar (`npm run build` o `docker compose up -d --build`).
- **CORS.** El origen desde el que se sirve el frontend debe figurar en `Cors:OrigenesPermitidos` de la API.
- **Rutas del cliente.** El servidor web debe redirigir las rutas desconocidas a `index.html`; `nginx.conf` lo resuelve con `try_files`.
- **Google.** En Google Cloud Console, la dirección del frontend debe registrarse en *Orígenes autorizados de JavaScript* del Client ID.

---

## 13. Pruebas

Las pruebas unitarias del frontend usan **Vitest** con **React Testing Library** sobre un navegador simulado (jsdom). No requieren la API ni Docker: las llamadas de red se simulan reemplazando `fetch`.

### 13.1 Configuración

- `vite.config.js` define el bloque `test`: entorno `jsdom`, archivo de preparación `src/test/setup.js` y una `VITE_API_URL` fija (`http://api.pruebas`), para que las pruebas no dependan del `.env` de cada equipo.
- `src/test/setup.js` registra los *matchers* de DOM (`toBeInTheDocument`, `toHaveTextContent`, ...) y, después de cada prueba, limpia el DOM, el `localStorage`, los *mocks* y los temporizadores simulados.
- `src/test/jwt.js` genera tokens JWT de prueba con el rol, el nombre y la vigencia que necesita cada caso.
- Cada archivo de pruebas (`*.test.js` o `*.test.jsx`) se ubica junto al código que prueba. Vite no los incluye en la compilación de producción.

### 13.2 Cobertura actual

| Archivo | Qué verifica | Pruebas |
| :--- | :--- | :---: |
| `utils/formato.test.js` | Formato de montos en USD y Bs, números, porcentajes, días, duraciones y fecha local | 12 |
| `utils/stock.test.js` | Alerta de stock (agotado, bajo mínimo, normal y sobre máximo), siempre acompañada de un ícono | 6 |
| `utils/panel.test.js` | Conversión de errores de validación por campo, estilo de los campos con error y estados del pedido | 5 |
| `api/cliente.test.js` | URL y filtros, token Bearer, cuerpo JSON y `FormData`, respuestas `204` y archivos, mensajes de error, error de red y sesión vencida (`401`) | 20 |
| `api/auth.test.js` | Inicio de sesión (correo normalizado, token y *refresh token*) y cierre de sesión con revocación, incluso si la API no responde | 5 |
| `context/AuthContext.test.jsx` | Lectura del JWT guardado, tokens vencidos o malformados, evento `sesion-expirada`, cierre al vencer el token, login y logout | 8 |
| `routes/RutaProtegida.test.jsx` | Redirección al login sin sesión y acceso o redirección según el rol en `/panel`, `/admin` y `/repartidor` | 11 |
| `context/CarritoContext.test.jsx` | Cantidades, tope por stock disponible, total en USD, eliminación de productos y persistencia en el navegador | 8 |
| **Total** | | **75** |

### 13.3 Ejecución

```bash
cd src/frontend
npm test                                      # Ejecuta todas las pruebas una vez
npm run test:watch                            # Modo observación: repite las pruebas al guardar
npx vitest run src/api/cliente.test.js        # Un archivo concreto
npx vitest run -t "sesión vencida"            # Pruebas cuyo nombre contiene un texto
```

### 13.4 Pendiente

Las vistas (`pages/`) y los componentes visuales todavía no tienen pruebas propias. Los siguientes pasos son las pruebas de componentes de las vistas principales (login interno, catálogo y bandeja de pedidos) con la capa `api/` simulada, y pruebas de extremo a extremo con Playwright sobre el entorno de Docker Compose.

---

## 14. Estructura de la carpeta

```
src/frontend/
├── src/
│   ├── api/                    Cliente HTTP (cliente.js) y servicios por recurso
│   ├── components/             Componentes reutilizables
│   │   ├── dashboard/          Gráficos del dashboard (Recharts)
│   │   ├── ui.jsx              Encabezados, campos, avisos, paginación y estados de carga
│   │   ├── Modal.jsx
│   │   ├── DetallePedido.jsx
│   │   ├── ContadorExpiracion.jsx
│   │   ├── TarjetaProducto.jsx
│   │   ├── MenuPerfil.jsx
│   │   └── BotonTema.jsx
│   ├── context/                AuthContext, ThemeContext y CarritoContext
│   ├── layouts/                Layout, TiendaLayout y PanelLayout
│   ├── pages/
│   │   ├── tienda/             Catálogo
│   │   ├── auth/               Login del personal
│   │   ├── panel/              Resumen, pedidos, productos, inventario y clientes
│   │   ├── admin/              Dashboard, personal, auditoría y configuración
│   │   ├── repartidor/         Área de entregas
│   │   └── NoEncontrada.jsx
│   ├── routes/                 RutaProtegida (control de acceso por rol)
│   ├── test/                   Preparación de las pruebas (setup.js) y generador de JWT de prueba
│   ├── utils/                  Formato de montos y fechas, constantes del panel y reglas de stock
│   ├── App.jsx                 Definición de rutas
│   ├── main.jsx                Punto de entrada y proveedores de contexto
│   ├── index.css               Tailwind CSS, paleta institucional y modo oscuro
│   └── **/*.test.{js,jsx}      Pruebas unitarias, junto al código que prueban
├── .env.example                Variables de entorno de ejemplo
├── Dockerfile                  Imagen multietapa (Node.js 20 + Nginx)
├── nginx.conf                  Servidor web con fallback de rutas para la SPA
├── eslint.config.js
├── vite.config.js              Configuración de Vite y de Vitest
├── index.html
└── package.json
```

---

## 15. Documentación relacionada

| Documento | Contenido |
| :--- | :--- |
| [README principal](../../README.md) | Visión general del proyecto, equipo y arquitectura del sistema |
| [`src/backend/README.md`](../backend/README.md) | API REST: arquitectura, modelo de datos, seguridad, instalación y pruebas |
| [`tests/README.md`](../../tests/README.md) | Pruebas automatizadas del backend y resumen de las del frontend |
| [`docs/API.md`](../../docs/API.md) | Endpoints, roles requeridos, códigos de respuesta y ejemplos |
| [`docs/REGLAS_NEGOCIO.md`](../../docs/REGLAS_NEGOCIO.md) | Flujo del pedido, stock, expiración, tasa de cambio y WhatsApp |
| [`docs/GESTION_PROYECTO.md`](../../docs/GESTION_PROYECTO.md) | Metodología Scrum, épicas, carriles de trabajo y convención de commits |

---

<div align="center">

Universidad Nacional Experimental del Táchira · Desarrollo de Aplicaciones Web · 2026

</div>
