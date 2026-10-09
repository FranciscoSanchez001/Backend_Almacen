<div align="center">

# Sistema E-commerce para Supermercado

### Asignatura: Desarrollo de Aplicaciones Web (Código: 0423807T)

<img src="https://skillicons.dev/icons?i=dotnet,cs,postgres,react,vite,tailwind,docker,postman,git&perline=9" alt="Stack tecnológico" />

<br><br>

![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

</div>

**Facilitador:** M.Sc. Ing. Gabriel Alexis Ramírez Sánchez  
**Email:** [gramirezs@unet.edu.ve](mailto:gramirezs@unet.edu.ve)  
**Período Académico:** Septiembre / Octubre, 2026  
**San Cristóbal, Estado Táchira, Venezuela**

**Equipo de desarrollo**

| Integrante | Rol |
| :--- | :--- |
| Gregorio Briceño | Desarrollo backend |
| Francisco Sánchez | Desarrollo backend |
| María Fernanda Cachopo Rojas | Desarrollo frontend, gestión del proyecto (Scrum) y documentación |

---

## 📌 Descripción General

Plataforma de comercio electrónico para un supermercado: catálogo con precios en USD y bolívares, pedidos con pagos locales (transferencia, pago móvil o Binance), inventario con reserva de stock, logística de entrega, notificaciones por WhatsApp, auditoría e indicadores de negocio (KPIs).

El sistema aplica **Onion Architecture** en el backend (**.NET 10 + PostgreSQL**) para desacoplar el dominio del negocio de la infraestructura, y una aplicación de página única (**SPA**) reactiva construida con **React**, **Vite** y **Tailwind CSS**.

| Parte | Carpeta | Documentación |
| :--- | :--- | :--- |
| **Backend** (API REST) | [`src/backend/`](src/backend) | [README del backend](src/backend/README.md) |
| **Frontend** (SPA) | [`src/frontend/`](src/frontend) | [README del frontend](src/frontend/README.md) |
| **Pruebas** (xUnit + Moq) | [`tests/`](tests) | [Reporte del Test Runner](docs/evidencias/pruebas-xunit.md) |

---

## 🏛️ Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────┐
│                   Frontend (SPA)                       │
│     React 19 + Vite + Tailwind CSS + React Router      │
│  AuthContext (JWT) · ThemeContext · Dashboard de KPIs  │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON (REST API + JWT)
┌──────────────────────────▼─────────────────────────────┐
│                 Presentation.API                       │
│  Controladores REST, JWT + RBAC, CORS, RFC 7807        │
├────────────────────────────────────────────────────────┤
│                 Infrastructure                         │
│  EF Core 10 + Npgsql, Repositorios, Unit of Work,      │
│  Excel, WhatsApp, job de expiración de pedidos         │
├────────────────────────────────────────────────────────┤
│                 Core.Application                       │
│  Casos de uso (servicios), contratos, FluentValidation │
├────────────────────────────────────────────────────────┤
│                   Core.Domain                          │
│  BaseEntity, entidades, enums y reglas de negocio      │
└────────────────────────────────────────────────────────┘
                           │
                  PostgreSQL 16 (Docker)
```

### Componentes Clave:
1. **Core.Domain:** entidades del negocio (`Producto`, `Categoria`, `Pedido`, `Usuario`, ...) que heredan de `BaseEntity`, enumeraciones y reglas puras (transiciones de estado del pedido, validación de teléfonos). No depende de ningún framework.
2. **Core.Application:** casos de uso (`ProductoService`, `PedidosService`, `InventarioService`, `ReportesService`, ...), contratos de repositorios y validaciones con **FluentValidation**.
3. **Infrastructure:** persistencia con **Entity Framework Core 10** (Fluent API, migraciones y siembra de datos), patrón **Repository** y **Unit of Work**, informe en Excel y mensajería por WhatsApp.
4. **Presentation.API:** endpoints REST protegidos con **JWT Bearer**, autorización por roles (**RBAC**), **CORS** y manejo global de errores con **Problem Details (RFC 7807)**.
5. **Frontend (SPA):** cliente HTTP centralizado, estado global con **Context API** (sesión JWT, tema y carrito), tema institucional **Azul UNET `#003366`** con **Modo Oscuro** persistente y **Dashboard de KPIs** con analítica en tiempo real.

---

## 🎨 Identidad Visual UNET y Modo Oscuro

- Paleta institucional basada en el **Azul UNET (`#003366`)**, definida en [`src/frontend/src/index.css`](src/frontend/src/index.css).
- **Modo Oscuro** administrado por [`ThemeContext.jsx`](src/frontend/src/context/ThemeContext.jsx) y persistido en `localStorage`; se aplica antes de pintar la página para evitar parpadeos.
- La sesión la administra [`AuthContext.jsx`](src/frontend/src/context/AuthContext.jsx), que decodifica el token JWT y cierra la sesión cuando vence.

---

## 📊 Dashboard de Indicadores KPI

[`PowerBIDashboard.jsx`](src/frontend/src/pages/admin/PowerBIDashboard.jsx), exclusivo del gerente, consume la API y muestra:

- **Valorización del almacén:** valor del stock a costo vs. a precio de venta y margen potencial, total y por categoría.
- **Rotación de stock:** global y por producto.
- **Alertas de stock crítico:** productos agotados, bajo el **stock mínimo** o sobre el **stock máximo**.
- Ventas por día, categoría, método de pago y zona; productos más y menos vendidos; tiempos de aprobación y entrega.

Gráficos y tablas van en contenedores responsivos (`overflow-x-auto`) para que no se desborden.

---

## 🚀 Tecnologías Empleadas

- **Backend:** .NET 10 (C# 14), ASP.NET Core Web API.
- **ORM & Base de Datos:** Entity Framework Core 10, Npgsql, PostgreSQL 16.
- **Seguridad:** JWT (HMAC-SHA256) con *refresh tokens*, contraseñas con BCrypt, Google Sign-In para clientes.
- **Frontend:** React 19, Vite 6, Tailwind CSS 4, React Router 6, Recharts.
- **Pruebas:** xUnit, Moq, NetArchTest.Rules, Testcontainers.
- **Contenerización:** Docker, Docker Compose (*multi-stage builds*), Nginx Alpine.

---

## 🛠️ Requisitos Previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recomendado: levanta todo con un comando)
- [SDK de .NET 10](https://dotnet.microsoft.com/download) (para ejecutar el backend y las pruebas en local)
- [Node.js 20 LTS](https://nodejs.org/) (para ejecutar el frontend en local)
- [PostgreSQL 16](https://www.postgresql.org/) (solo si no se usa Docker)

---

## 📦 Puesta en Marcha con Docker Compose

```bash
# 1. Clonar el repositorio
git clone https://github.com/FranciscoSanchez001/Backend_Almacen.git
cd Backend_Almacen

# 2. Compilar e iniciar todos los contenedores en segundo plano
docker compose up -d --build

# 3. Verificar el estado de los contenedores
docker compose ps
```

El [`docker-compose.yml`](docker-compose.yml) levanta, en orden: **PostgreSQL** → **migraciones de EF Core** (se aplican solas y el contenedor termina) → **API** → **frontend**, además de **PostgREST**.

### Puntos de Acceso del Sistema:

| Servicio | Dirección |
| :--- | :--- |
| Frontend SPA (Nginx) | [http://localhost:8080](http://localhost:8080) |
| Acceso del personal | [http://localhost:8080/internal-login](http://localhost:8080/internal-login) |
| Backend API REST | [http://localhost:5085](http://localhost:5085) |
| PostgREST | [http://localhost:3000](http://localhost:3000) |
| Base de datos PostgreSQL | `localhost:5432` (`midatabase`) |

Para ejecutar el backend o el frontend sin Docker, ver el [README del backend](src/backend/README.md#9-instalación-y-ejecución) y el [README del frontend](src/frontend/README.md#-puesta-en-marcha).

---

## 👤 Credenciales Preconfiguradas

| Rol | Correo | Contraseña | Permisos |
| :--- | :--- | :--- | :--- |
| **Gerente** (`superadmin` = Admin) | `gerente@almacen.local` | `Cambiar123!` | Acceso total: productos, categorías, borrado, Dashboard KPI, personal, auditoría y configuración. |
| **Ventas** (`ventas` = Employee) \* | `ventas1@almacen.local` | `Demo1234!` | Pedidos, productos e inventario; sin borrado de productos, gestión de categorías ni Dashboard KPI. |
| **Repartidor** \* | `repartidor1@almacen.local` | `Demo1234!` | Entregas asignadas. |

\* Se crean con los datos de demostración (`dotnet run --project src/backend/Presentation.API -- --SiembraDemo:Habilitada=true`) o desde **Administración → Personal**. Los clientes entran con su cuenta de Google.

---

## 🧪 Pruebas Automatizadas

| Proyecto | Tipo | Herramientas | Pruebas |
| :--- | :--- | :--- | :---: |
| [`tests/UnitTests`](tests/UnitTests) | Unitarias de `ProductoService` (`Core.Application`), con los repositorios (`IProductoRepository`, ...) y la unidad de trabajo simulados; sin base de datos | xUnit + Moq | 17 ✅ |
| [`tests/ArchitectureTests`](tests/ArchitectureTests) | Regla de dependencia entre capas y convenciones de nombres | xUnit + NetArchTest.Rules | 13 ✅ |
| [`tests/IntegrationTests`](tests/IntegrationTests) | API completa contra PostgreSQL real en Docker | xUnit + Testcontainers | 20 ✅ |

**Total: 50 pruebas en estado *Passed*.** Reporte del Test Runner de xUnit en [`docs/evidencias/pruebas-xunit.md`](docs/evidencias/pruebas-xunit.md).

```bash
# Desde la raíz del repositorio
dotnet test tests/UnitTests                       # unitarias (no requieren base de datos)
dotnet test tests/ArchitectureTests               # arquitectura
dotnet test src/backend/Backend_Almacen.slnx      # todas (las de integración requieren Docker)
```

---

## 📂 Estructura del Repositorio

```
Backend_Almacen/
├── src/
│   ├── backend/
│   │   ├── Backend_Almacen.slnx  # Solución de .NET (incluye los proyectos de tests/)
│   │   ├── Core.Domain/          # Entidades, enums y reglas de negocio
│   │   ├── Core.Application/     # Casos de uso, contratos y validadores
│   │   ├── Infrastructure/       # DbContext, Fluent API, migraciones y repositorios
│   │   ├── Presentation.API/     # Controladores REST, middleware, auth y Dockerfile
│   │   └── README.md             # Documentación del backend
│   └── frontend/
│       ├── src/                  # Componentes, contextos, páginas y cliente HTTP
│       ├── Dockerfile            # Construcción multi-stage con Nginx
│       ├── nginx.conf            # Servidor web de producción (fallback de la SPA)
│       └── README.md             # Documentación del frontend
├── tests/
│   ├── UnitTests/                # xUnit + Moq
│   ├── ArchitectureTests/        # NetArchTest.Rules
│   └── IntegrationTests/         # WebApplicationFactory + Testcontainers
├── database/                     # Script SQL de migraciones y volcado de la base
├── docs/                         # Documentación técnica, colecciones de Postman y evidencias
├── docker-compose.yml            # Orquestación multicontenedor local
├── dotnet-tools.json             # Herramienta dotnet-ef
└── README.md                     # Este documento
```

---

## 📚 Documentación Técnica

| Documento | Contenido |
| :--- | :--- |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Capas, regla de dependencia, inyección de dependencias, pipeline HTTP y manejo de errores |
| [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) | Diagrama entidad-relación, tablas, restricciones y enumeraciones |
| [`docs/API.md`](docs/API.md) | Endpoints, roles requeridos, códigos de respuesta y ejemplos |
| [`docs/REGLAS_NEGOCIO.md`](docs/REGLAS_NEGOCIO.md) | Flujo del pedido, stock, expiración, tasa de cambio y WhatsApp |
| [`docs/GESTION_PROYECTO.md`](docs/GESTION_PROYECTO.md) | Metodología Scrum, épicas y convención de commits |
| [`docs/postman/`](docs/postman) | Colecciones de Postman (general y escenarios de seguridad) |
| [`docs/evidencias/`](docs/evidencias) | Evidencias: errores RFC 7807, escenarios de seguridad, pruebas xUnit y base de datos |
