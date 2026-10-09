# Sistema E-commerce para Supermercado · Frontend

### **Asignatura: Desarrollo de Aplicaciones Web (Código: 0423807T)**

**Facilitador:** M.Sc. Ing. Gabriel Alexis Ramírez Sánchez  
**Email:** gramirezs@unet.edu.ve  
**Período Académico:** Septiembre, 2026  
**San Cristóbal, Estado Táchira, Venezuela**

**Integrantes del equipo:**

| Integrante | Rol en el proyecto |
| :--- | :--- |
| María Fernanda Cachopo Rojas | Desarrollo frontend |
| Gregorio Briceño | Desarrollo backend |
| Francisco Sánchez | Desarrollo backend |

---

## 📌 Descripción General

Esta carpeta (`src/frontend/`) contiene la **aplicación web (frontend)** de la plataforma de comercio electrónico del supermercado. Es una aplicación de página única (**SPA**) construida con **React 19**, **Vite** y **Tailwind CSS** que consume la API REST del backend ([`src/backend/`](../backend/README.md)) mediante HTTP/JSON, sin recargar la página.

La visión general del proyecto y la puesta en marcha con Docker están en el [README principal](../../README.md).

La aplicación reúne en un solo proyecto las áreas de los cuatro tipos de usuario:

| Área | Ruta | Usuario | Qué puede hacer | Estado |
| :--- | :--- | :--- | :--- | :---: |
| **Tienda** | `/` | Cliente | Ver el catálogo con precios en USD y Bs y armar el carrito. | Catálogo listo · login con Google en construcción |
| **Panel de ventas** | `/panel` | Ventas y gerente | Revisar la bandeja de pedidos, aprobarlos asignando repartidor o rechazarlos, gestionar productos, categorías e inventario, y ver notificaciones. | ✅ |
| **Administración** | `/admin` | Gerente | Dashboard de KPIs, informe en Excel, gestión del personal, auditoría y configuración (tasa del día, zonas). | ✅ |
| **Entregas** | `/repartidor` | Repartidor | Ver sus pedidos asignados y marcarlos "en camino" y "entregado". | En construcción |

---

## 🏛️ Arquitectura

```
┌────────────────────────────────────────────────────────┐
│                  Frontend (src/frontend)               │
│         React + Vite + Tailwind CSS + React Router     │
│   Tienda · Panel de ventas · Administración · Entregas │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON  (token JWT)
┌──────────────────────────▼─────────────────────────────┐
│                 API REST (src/backend)                 │
│        .NET 10 · Onion Architecture · PostgreSQL       │
└────────────────────────────────────────────────────────┘
```

### Componentes Clave:
1. **Cliente HTTP centralizado** (`src/api/cliente.js`): único punto que habla con la API. Agrega el token JWT a cada petición, interpreta los errores *Problem Details* (RFC 7807) y avisa a la sesión cuando la API responde `401`.
2. **Estado global con Context API** (`src/context/`):
   - `AuthContext.jsx`: sesión del personal. Decodifica el JWT (claims `sub`, `name`, `email`, `role`, `exp`), lo persiste en el navegador y cierra la sesión sola cuando el token vence.
   - `ThemeContext.jsx`: tema institucional claro (**Azul UNET `#003366`**) u **oscuro**, persistido en `localStorage`.
   - `CarritoContext.jsx`: carrito de compras de la tienda.
3. **Rutas protegidas por rol** (`src/routes/RutaProtegida.jsx`): cada usuario solo entra a su área; la API vuelve a validar el rol en cada endpoint.
4. **Páginas por área** (`src/pages/`), **layouts** (`src/layouts/`) y **componentes reutilizables** (`src/components/`). Las pantallas del personal se cargan bajo demanda (`React.lazy`).

---

## 🎨 Tema institucional y Modo Oscuro

- La paleta `marca` se define en `src/index.css` con el Azul UNET `#003366` como color principal (`marca-700`).
- El modo oscuro funciona por clase: `ThemeContext` pone `dark` en `<html>` y los componentes usan las variantes `dark:` de Tailwind.
- La elección se guarda en `localStorage` (`almacen.tema`). `index.html` la aplica antes de pintar la página, así no parpadea en claro al recargar.
- El botón de tema (`components/BotonTema.jsx`) está en la barra superior de todas las áreas.

---

## 📊 Dashboard de KPIs (`pages/admin/PowerBIDashboard.jsx`)

Exclusivo del gerente (superadmin). Consume `/kpis`, `/productos`, `/inventario`, `/pedidos` y `/notificaciones`:

| Indicador | Detalle |
| :--- | :--- |
| Valorización del almacén | Valor del stock a **costo** vs. a **precio de venta** y margen potencial, total y por categoría |
| Rotación de stock | Global y por producto (unidades vendidas ÷ stock promedio) |
| Alertas de stock crítico | Productos agotados o por debajo del **stock mínimo**, y por encima del **stock máximo** |
| Ventas y pedidos | Ventas por período, por método de pago y por zona; tiempos de aprobación y entrega |

Los gráficos (Recharts) y las tablas van dentro de contenedores con `overflow-x-auto`, así no se desbordan en pantallas pequeñas.

---

## 🔐 Control de acceso por rol (RBAC en el cliente)

El rol sale del token JWT. En la rúbrica del curso, **Admin** corresponde a `superadmin` y **Employee** a `ventas`.

| Acción | `superadmin` (Admin) | `ventas` (Employee) |
| :--- | :---: | :---: |
| Ver y gestionar pedidos | ✅ | ✅ |
| Crear y editar productos | ✅ | ✅ |
| Eliminar productos | ✅ | Oculto |
| Crear y renombrar categorías | ✅ | Oculto |
| Dashboard de KPIs y administración (`/admin`) | ✅ | Oculto (ruta protegida) |

---

## 🚀 Tecnologías Empleadas

- **Framework:** React 19, Vite 6.
- **Estilos:** Tailwind CSS 4 (plugin `@tailwindcss/vite`).
- **Navegación:** React Router 6.
- **Gráficos:** Recharts.
- **Autenticación:** JWT emitido por la API.
- **Producción:** imagen Docker multi-etapa (Node 20 → Nginx Alpine) con *fallback* de rutas para la SPA.

---

## 🛠️ Requisitos Previos

- [Node.js 20 LTS o superior](https://nodejs.org/)
- La API del backend corriendo (por defecto en `http://localhost:5085`). Ver [`src/backend/README.md`](../backend/README.md).

---

## 📦 Puesta en Marcha

### Con Docker (toda la aplicación)

Desde la raíz del repositorio:

```bash
docker compose up -d --build
```

El frontend queda en [http://localhost:8080](http://localhost:8080).

### En modo desarrollo

```bash
cd src/frontend
npm install
cp .env.example .env    # y completar los valores
npm run dev
```

La aplicación queda en [http://localhost:5173](http://localhost:5173).

| Variable | Para qué sirve | Ejemplo |
| :--- | :--- | :--- |
| `VITE_API_URL` | Dirección de la API del backend | `http://localhost:5085` |
| `VITE_GOOGLE_CLIENT_ID` | Client ID de Google para el futuro inicio de sesión de clientes (el mismo del backend) | `xxxx.apps.googleusercontent.com` |

### Otros comandos

```bash
npm run build     # Compilar para producción (carpeta dist/)
npm run preview   # Probar la versión compilada
npm run lint      # Revisar el código con ESLint
```

---

## 👤 Credenciales de Prueba

El personal entra por [`/internal-login`](http://localhost:8080/internal-login). Las cuentas las crea el backend:

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| **Gerente (superadmin / Admin)** | `gerente@almacen.local` | `Cambiar123!` |
| **Ventas (Employee)** \* | `ventas1@almacen.local` | `Demo1234!` |
| **Repartidor** \* | `repartidor1@almacen.local` | `Demo1234!` |

\* Solo existen si el backend se ejecutó con los datos de demostración (`--SiembraDemo:Habilitada=true`); también las puede crear el gerente desde **Administración → Personal**.

---

## 📂 Estructura de la carpeta

```
src/frontend/
├── src/
│   ├── api/                # Cliente HTTP (cliente.js) y servicios por recurso
│   ├── components/         # Componentes reutilizables (ui, modal, tema, gráficos del dashboard)
│   ├── context/            # AuthContext, ThemeContext y CarritoContext (Context API)
│   ├── layouts/            # Estructura de cada área (tienda, panel, repartidor)
│   ├── pages/              # Páginas: tienda, panel, admin, repartidor y login
│   ├── routes/             # Protección de rutas por rol
│   ├── utils/              # Formato de montos y fechas, reglas de stock
│   ├── App.jsx             # Definición de rutas
│   ├── main.jsx            # Punto de entrada (proveedores de contexto)
│   └── index.css           # Tailwind CSS, paleta Azul UNET y modo oscuro
├── .env.example            # Variables de entorno de ejemplo
├── Dockerfile              # Construcción multi-etapa con Nginx
├── nginx.conf              # Servidor web con fallback de rutas para la SPA
├── index.html
├── vite.config.js
└── package.json
```
