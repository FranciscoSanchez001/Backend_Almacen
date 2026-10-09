<div align="center">

# Sistema E-commerce para Supermercado

### Desarrollo de Aplicaciones Web · UNET

Plataforma de comercio electrónico para un supermercado: catálogo con precios en USD y bolívares,
pedidos con pagos locales, inventario con reserva de stock, logística de entrega, notificaciones por WhatsApp,
auditoría e indicadores de negocio.

<br>

<img src="https://skillicons.dev/icons?i=dotnet,cs,postgres,react,vite,tailwind,docker,postman,git&perline=9" alt="Stack tecnológico" />

<br><br>

![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

![Arquitectura](https://img.shields.io/badge/Arquitectura-Onion-informational?style=flat-square)
![Autenticación](https://img.shields.io/badge/Autenticación-JWT-informational?style=flat-square)
![Errores](https://img.shields.io/badge/Errores-RFC_7807-informational?style=flat-square)
![Pruebas](https://img.shields.io/badge/Pruebas-50_Passed-success?style=flat-square)
![Metodología](https://img.shields.io/badge/Metodología-Scrum-informational?style=flat-square)

</div>

---

## Tabla de contenidos

1. [Información académica](#1-información-académica)
2. [Descripción general](#2-descripción-general)
3. [Componentes del repositorio](#3-componentes-del-repositorio)
4. [Arquitectura del sistema](#4-arquitectura-del-sistema)
5. [Stack tecnológico](#5-stack-tecnológico)
6. [Requisitos previos](#6-requisitos-previos)
7. [Puesta en marcha con Docker](#7-puesta-en-marcha-con-docker)
8. [Ejecución sin Docker](#8-ejecución-sin-docker)
9. [Credenciales de prueba](#9-credenciales-de-prueba)
10. [Pruebas automatizadas](#10-pruebas-automatizadas)
11. [Base de datos](#11-base-de-datos)
12. [Estructura del repositorio](#12-estructura-del-repositorio)
13. [Documentación](#13-documentación)

---

## 1. Información académica

| | |
| :--- | :--- |
| **Asignatura** | Desarrollo de Aplicaciones Web (Código 0423807T) |
| **Facilitador** | M.Sc. Ing. Gabriel Alexis Ramírez Sánchez · <gramirezs@unet.edu.ve> |
| **Institución** | Universidad Nacional Experimental del Táchira (UNET) |
| **Período académico** | Septiembre - Octubre 2026 |
| **Ubicación** | San Cristóbal, Estado Táchira, Venezuela |

**Equipo de desarrollo**

| Integrante | Rol |
| :--- | :--- |
| Gregorio Briceño | Desarrollo backend |
| Francisco Sánchez | Desarrollo backend |
| María Fernanda Cachopo Rojas | Desarrollo frontend, gestión del proyecto (Scrum) y documentación |

---

## 2. Descripción general

El sistema permite a los clientes de un supermercado comprar en línea y al personal gestionar los pedidos desde su recepción hasta la entrega. Está compuesto por una **API REST** en .NET 10 con **Onion Architecture** sobre **PostgreSQL** y una **aplicación de página única (SPA)** en React, ambos contenidos en este repositorio.

**Capacidades principales**

- Catálogo público con precios en USD y en bolívares según la tasa del día.
- Pedidos con pago por transferencia, pago móvil o Binance y comprobante adjunto.
- Inventario con reserva de stock al crear el pedido y liberación automática si se rechaza o expira.
- Aprobación de pedidos por el área de ventas con asignación de repartidor.
- Seguimiento de la entrega y notificaciones al cliente por WhatsApp en cada cambio de estado.
- Auditoría de cambios, dashboard de indicadores (KPIs) e informe descargable en Excel.

**Perfiles de usuario**

| Rol | Descripción | Autenticación | Área en el frontend |
| :--- | :--- | :--- | :--- |
| `superadmin` | Gerente del supermercado; acceso total | Correo y contraseña | `/admin` y `/panel` |
| `ventas` | Revisa, aprueba o rechaza los pedidos; gestiona productos e inventario | Correo y contraseña | `/panel` |
| `repartidor` | Entrega los pedidos asignados | Correo y contraseña | `/repartidor` |
| `cliente` | Compra en la tienda | Cuenta de Google | `/` |

**Ciclo de vida del pedido**

```
Pendiente ──► Aprobado ──► Asignado ──► En camino ──► Entregado
    │
    ├──► Rechazado   (libera el stock reservado)
    └──► Expirado    (sin revisión en el plazo configurado; libera el stock)
```

El detalle de las reglas de negocio está en [`docs/REGLAS_NEGOCIO.md`](docs/REGLAS_NEGOCIO.md).

---

## 3. Componentes del repositorio

Cada componente tiene su propia documentación detallada:

| Componente | Carpeta | Descripción | Documentación |
| :--- | :--- | :--- | :--- |
| **Backend** | [`src/backend/`](src/backend) | API REST en ASP.NET Core 10 con Onion Architecture, EF Core y PostgreSQL | [README del backend](src/backend/README.md) |
| **Frontend** | [`src/frontend/`](src/frontend) | SPA en React 19, Vite y Tailwind CSS: tienda, panel de ventas, administración y entregas | [README del frontend](src/frontend/README.md) |
| **Pruebas** | [`tests/`](tests) | Pruebas unitarias, de arquitectura y de integración con xUnit | [README de las pruebas](tests/README.md) |
| **Base de datos** | [`database/`](database) | Script SQL del esquema, volcado con datos sembrados y consultas de verificación | [Evidencias de base de datos](docs/evidencias/base-datos.md) |
| **Documentación** | [`docs/`](docs) | Arquitectura, modelo de datos, API, reglas de negocio, gestión del proyecto y evidencias | [Sección 13](#13-documentación) |
| **Orquestación** | [`docker-compose.yml`](docker-compose.yml) | Despliegue local de la aplicación completa | [Sección 7](#7-puesta-en-marcha-con-docker) |

---

## 4. Arquitectura del sistema

```
┌────────────────────────────────────────────────────────┐
│                 Frontend (src/frontend)                │
│     React 19 + Vite + Tailwind CSS + React Router      │
│   Tienda · Panel de ventas · Administración · Entregas │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON (Bearer JWT)
┌──────────────────────────▼─────────────────────────────┐
│                 Backend (src/backend)                  │
├────────────────────────────────────────────────────────┤
│  Presentation.API   Controladores REST, JWT + RBAC,    │
│                     CORS, Problem Details (RFC 7807)   │
├────────────────────────────────────────────────────────┤
│  Infrastructure     EF Core 10 + Npgsql, repositorios, │
│                     Unit of Work, Excel, WhatsApp,     │
│                     job de expiración de pedidos       │
├────────────────────────────────────────────────────────┤
│  Core.Application   Casos de uso, contratos,           │
│                     FluentValidation                   │
├────────────────────────────────────────────────────────┤
│  Core.Domain        Entidades, enumeraciones y reglas  │
│                     de negocio                         │
└──────────────────────────┬─────────────────────────────┘
                           │
                  ┌────────▼────────┐
                  │  PostgreSQL 16  │
                  └─────────────────┘
```

- **Backend.** Las dependencias apuntan siempre hacia el dominio: `Core.Domain` no depende de ninguna otra capa ni de paquetes externos, y las reglas de dependencia se verifican con pruebas de arquitectura. Ver [Arquitectura](src/backend/README.md#4-arquitectura) en el README del backend y [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
- **Frontend.** Un cliente HTTP centralizado gestiona el token JWT y los errores RFC 7807; el estado global se maneja con Context API y cada área está protegida por rol. Ver [Arquitectura](src/frontend/README.md#4-arquitectura) en el README del frontend.
- **Seguridad.** La API emite tokens JWT firmados con HMAC-SHA256 y *refresh tokens* con rotación; las contraseñas del personal se almacenan con BCrypt y los clientes se autentican con Google. El frontend organiza la interfaz por rol, pero la autorización definitiva la aplica la API en cada endpoint.

---

## 5. Stack tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| Backend | .NET 10 (C# 14), ASP.NET Core Web API, FluentValidation |
| Persistencia | Entity Framework Core 10, Npgsql, PostgreSQL 16 |
| Seguridad | JWT Bearer (HMAC-SHA256), refresh tokens, BCrypt, Google Sign-In |
| Frontend | React 19, Vite 6, Tailwind CSS 4, React Router 6, Recharts |
| Pruebas | xUnit, Moq, NetArchTest.Rules, Testcontainers, Postman |
| Contenedores | Docker, Docker Compose, Nginx Alpine |

Las versiones exactas de cada paquete están en el [stack del backend](src/backend/README.md#3-stack-tecnológico) y en el [stack del frontend](src/frontend/README.md#3-stack-tecnológico).

---

## 6. Requisitos previos

| Herramienta | Versión | Necesaria para |
| :--- | :---: | :--- |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | — | Levantar la aplicación completa (recomendado) y ejecutar las pruebas de integración |
| [Git](https://git-scm.com/) | — | Clonar el repositorio |
| [SDK de .NET](https://dotnet.microsoft.com/download) | 10 | Ejecutar el backend y las pruebas sin Docker |
| [Node.js](https://nodejs.org/) | 20 LTS o superior | Ejecutar el frontend sin Docker |
| [PostgreSQL](https://www.postgresql.org/download/) | 16 | Solo si la base de datos no se ejecuta en Docker |

---

## 7. Puesta en marcha con Docker

```bash
git clone https://github.com/FranciscoSanchez001/Backend_Almacen.git
cd Backend_Almacen
docker compose up -d --build
docker compose ps -a
```

El [`docker-compose.yml`](docker-compose.yml) define los siguientes servicios, que arrancan en este orden:

| Servicio | Contenedor | Descripción | Dirección |
| :--- | :--- | :--- | :--- |
| `db` | `postgres_db` | PostgreSQL 16 con verificación de estado | `localhost:5432` |
| `migraciones` | `almacen_migraciones` | Aplica las migraciones de EF Core y finaliza | — |
| `api` | `almacen_api` | API REST | <http://localhost:5085> |
| `spa` | `almacen_spa` | Frontend servido por Nginx | <http://localhost:8080> |
| `postgrest` | `postgrest_api` | API REST generada automáticamente sobre la base de datos | <http://localhost:3000> |

`api` y `postgrest` esperan a que `migraciones` finalice correctamente, y `migraciones` espera a que `db` esté disponible. Es normal que `almacen_migraciones` aparezca con estado `Exited (0)`.

El personal accede por <http://localhost:8080/internal-login>.

**Comandos útiles**

| Comando | Descripción |
| :--- | :--- |
| `docker compose logs -f api` | Ver los registros de la API |
| `docker compose down` | Detener y eliminar los contenedores (conserva los datos) |
| `docker compose down -v` | Detener y eliminar también el volumen de la base de datos |

---

## 8. Ejecución sin Docker

Para desarrollar sobre cada componente de forma independiente:

| Componente | Instrucciones |
| :--- | :--- |
| Backend | [Instalación y ejecución](src/backend/README.md#9-instalación-y-ejecución): base de datos, migraciones, ejecución de la API y comandos de referencia |
| Frontend | [Instalación y ejecución](src/frontend/README.md#10-instalación-y-ejecución): variables de entorno, servidor de desarrollo de Vite y compilación |

Resumen de los comandos, desde la raíz del repositorio:

```bash
# Base de datos (solo PostgreSQL en Docker)
docker compose up -d db

# Backend: migraciones y API en http://localhost:5085
dotnet ef database update --project src/backend/Infrastructure --startup-project src/backend/Presentation.API
dotnet run --project src/backend/Presentation.API

# Frontend: servidor de desarrollo en http://localhost:5173
cd src/frontend
npm install
cp .env.example .env
npm run dev
```

---

## 9. Credenciales de prueba

| Rol | Correo | Contraseña | Disponible |
| :--- | :--- | :--- | :--- |
| **Superadmin** (Admin) | `gerente@almacen.local` | `Cambiar123!` | Siempre; la API lo crea al arrancar |
| **Ventas** (Employee) | `ventas1@almacen.local`, `ventas2@almacen.local` | `Demo1234!` | Con los datos de demostración |
| **Repartidor** | `repartidor1@almacen.local` a `repartidor3@almacen.local` | `Demo1234!` | Con los datos de demostración |

Los datos de demostración (personal, 60 clientes, productos adicionales y alrededor de 600 pedidos de los últimos 90 días) se generan ejecutando la API una vez con la opción `SiembraDemo:Habilitada=true`:

```bash
dotnet run --project src/backend/Presentation.API -- --SiembraDemo:Habilitada=true
```

Los clientes se autentican con su cuenta de Google. Ver [Datos semilla y credenciales](src/backend/README.md#10-datos-semilla-y-credenciales) en el README del backend.

> Estas credenciales son exclusivas del entorno de desarrollo.

---

## 10. Pruebas automatizadas

| Proyecto | Tipo | Herramientas | Pruebas |
| :--- | :--- | :--- | :---: |
| [`tests/UnitTests`](tests/UnitTests) | Unitarias de `ProductoService` con repositorios y unidad de trabajo simulados; no requieren base de datos | xUnit + Moq | 17 |
| [`tests/ArchitectureTests`](tests/ArchitectureTests) | Regla de dependencia entre capas y convenciones de nombres | xUnit + NetArchTest.Rules | 13 |
| [`tests/IntegrationTests`](tests/IntegrationTests) | API completa contra PostgreSQL real en Docker | xUnit + WebApplicationFactory + Testcontainers | 20 |

**Total: 50 pruebas en estado *Passed*.** El detalle de cada prueba, la infraestructura de integración y las opciones de ejecución están en el [README de las pruebas](tests/README.md); el reporte de ejecución, en [`docs/evidencias/pruebas-xunit.md`](docs/evidencias/pruebas-xunit.md).

```bash
dotnet test tests/UnitTests                       # Unitarias
dotnet test tests/ArchitectureTests               # Arquitectura
dotnet test src/backend/Backend_Almacen.slnx      # Todas (las de integración requieren Docker)
```

Además, las colecciones de [Postman](docs/postman) cubren los endpoints de la API y los escenarios de seguridad (200, 401, 403 y 400). Ver [Pruebas de la API](src/backend/README.md#11-pruebas-de-la-api) en el README del backend.

---

## 11. Base de datos

El esquema se define con EF Core Code-First (Fluent API) y se crea mediante migraciones. La carpeta [`database/`](database) contiene artefactos generados a partir de ellas:

| Archivo | Contenido |
| :--- | :--- |
| [`InitialCreate.sql`](database/InitialCreate.sql) | Script SQL del esquema generado desde las migraciones |
| [`midatabase_dump.sql`](database/midatabase_dump.sql) | Volcado `pg_dump` con tablas, restricciones y datos sembrados |
| [`consultas_verificacion.sql`](database/consultas_verificacion.sql) | Consultas que evidencian el esquema y la siembra |

El modelo entidad-relación completo está en [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md).

---

## 12. Estructura del repositorio

```
Backend_Almacen/
├── src/
│   ├── backend/                    API REST (.NET 10)                      -> README propio
│   │   ├── Core.Domain/            Entidades, enumeraciones y reglas de negocio
│   │   ├── Core.Application/       Casos de uso, contratos y validadores
│   │   ├── Infrastructure/         Persistencia, migraciones, repositorios y servicios externos
│   │   ├── Presentation.API/       Controladores, autenticación, middleware y Dockerfile
│   │   └── Backend_Almacen.slnx    Solución de .NET (incluye los proyectos de tests/)
│   └── frontend/                   SPA en React                            -> README propio
│       ├── src/                    Páginas, layouts, componentes, contextos y cliente HTTP
│       ├── Dockerfile              Imagen multietapa (Node.js 20 + Nginx)
│       └── nginx.conf              Servidor web con fallback de rutas
├── tests/                          Pruebas automatizadas                   -> README propio
│   ├── UnitTests/                  xUnit + Moq
│   ├── ArchitectureTests/          xUnit + NetArchTest.Rules
│   └── IntegrationTests/           xUnit + WebApplicationFactory + Testcontainers
├── database/                       Script SQL, volcado y consultas de verificación
├── docs/
│   ├── postman/                    Colecciones de Postman
│   └── evidencias/                 Evidencias de errores, seguridad, pruebas y base de datos
├── docker-compose.yml              Aplicación completa: PostgreSQL, migraciones, API, frontend y PostgREST
├── dotnet-tools.json               Herramienta dotnet-ef
└── README.md                       Este documento
```

---

## 13. Documentación

**Documentación por componente**

| Documento | Contenido |
| :--- | :--- |
| [`src/backend/README.md`](src/backend/README.md) | Stack, arquitectura, ciclo del pedido, modelo de datos, seguridad, instalación, datos semilla, pruebas y configuración de la API |
| [`src/frontend/README.md`](src/frontend/README.md) | Stack, arquitectura, mapa de vistas, autenticación y control de acceso, dashboard, instalación y configuración de la SPA |
| [`tests/README.md`](tests/README.md) | Estrategia de pruebas, detalle de las 50 pruebas, infraestructura de integración y comandos de ejecución |

**Documentación técnica**

| Documento | Contenido |
| :--- | :--- |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Capas, regla de dependencia, inyección de dependencias, pipeline HTTP y manejo de errores |
| [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) | Diagrama entidad-relación, tablas, restricciones y enumeraciones |
| [`docs/API.md`](docs/API.md) | Endpoints, roles requeridos, códigos de respuesta y ejemplos |
| [`docs/REGLAS_NEGOCIO.md`](docs/REGLAS_NEGOCIO.md) | Flujo del pedido, stock, expiración, tasa de cambio y WhatsApp |
| [`docs/GESTION_PROYECTO.md`](docs/GESTION_PROYECTO.md) | Metodología Scrum, épicas, carriles de trabajo y convención de commits |

**Pruebas y evidencias**

| Documento | Contenido |
| :--- | :--- |
| [`docs/postman/Backend_Almacen.postman_collection.json`](docs/postman/Backend_Almacen.postman_collection.json) | Colección general de la API con pruebas automáticas |
| [`docs/postman/Seguridad_Escenarios.postman_collection.json`](docs/postman/Seguridad_Escenarios.postman_collection.json) | Escenarios de seguridad: inicio de sesión, 401, 403 y 400 por validación |
| [`docs/evidencias/pruebas-xunit.md`](docs/evidencias/pruebas-xunit.md) | Reporte del Test Runner de xUnit (50 pruebas) |
| [`docs/evidencias/escenarios-seguridad.md`](docs/evidencias/escenarios-seguridad.md) | Petición, respuesta y aserciones de los escenarios de seguridad |
| [`docs/evidencias/seguridad-fase3.md`](docs/evidencias/seguridad-fase3.md) | JWT, RBAC y FluentValidation |
| [`docs/evidencias/errores-rfc7807.md`](docs/evidencias/errores-rfc7807.md) | Respuestas de error en formato Problem Details |
| [`docs/evidencias/base-datos.md`](docs/evidencias/base-datos.md) | Tablas, restricciones y datos sembrados en PostgreSQL |

---

<div align="center">

Universidad Nacional Experimental del Táchira · Desarrollo de Aplicaciones Web · 2026

</div>
