<div align="center">

# Sistema E-commerce para Supermercado

### Pruebas automatizadas

Pruebas unitarias, de arquitectura y de integración de la API REST del backend,
desarrolladas con xUnit sobre .NET 10.

<br>

![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![xUnit](https://img.shields.io/badge/xUnit-2.9.3-5E2B97?style=for-the-badge)
![Moq](https://img.shields.io/badge/Moq-4.20.72-2E7D32?style=for-the-badge)
![NetArchTest](https://img.shields.io/badge/NetArchTest.Rules-1.3.2-00599C?style=for-the-badge)
![Testcontainers](https://img.shields.io/badge/Testcontainers-4.15.0-291A3F?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

![Pruebas](https://img.shields.io/badge/Pruebas-50_Passed-success?style=flat-square)
![Unitarias](https://img.shields.io/badge/Unitarias-17-informational?style=flat-square)
![Arquitectura](https://img.shields.io/badge/Arquitectura-13-informational?style=flat-square)
![Integración](https://img.shields.io/badge/Integración-20-informational?style=flat-square)

</div>

---

## Tabla de contenidos

1. [Descripción general](#1-descripción-general)
2. [Stack de pruebas](#2-stack-de-pruebas)
3. [Estrategia de pruebas](#3-estrategia-de-pruebas)
4. [Pruebas unitarias](#4-pruebas-unitarias)
5. [Pruebas de arquitectura](#5-pruebas-de-arquitectura)
6. [Pruebas de integración](#6-pruebas-de-integración)
7. [Requisitos previos](#7-requisitos-previos)
8. [Ejecución](#8-ejecución)
9. [Resultados y evidencias](#9-resultados-y-evidencias)
10. [Convenciones](#10-convenciones)
11. [Estructura de la carpeta](#11-estructura-de-la-carpeta)
12. [Pruebas del frontend](#12-pruebas-del-frontend)
13. [Documentación relacionada](#13-documentación-relacionada)

---

## 1. Descripción general

Esta carpeta (`tests/`) contiene los tres proyectos de prueba de la API REST ubicada en [`src/backend/`](../src/backend/README.md). Los tres forman parte de la solución `src/backend/Backend_Almacen.slnx`, de modo que se compilan y ejecutan junto con el backend.

Las pruebas del frontend no están en esta carpeta: se ubican junto al código de la SPA, en `src/frontend/src/`, y se ejecutan con Vitest. Ver la [sección 12](#12-pruebas-del-frontend).

| Proyecto | Tipo | Qué verifica | Pruebas | Requiere Docker |
| :--- | :--- | :--- | :---: | :---: |
| [`UnitTests`](UnitTests) | Unitarias | Lógica de los casos de uso de `ProductoService`, aislada de la base de datos | 17 | No |
| [`ArchitectureTests`](ArchitectureTests) | Arquitectura | Regla de dependencia entre capas y convenciones de nombres | 13 | No |
| [`IntegrationTests`](IntegrationTests) | Integración | API completa por HTTP contra PostgreSQL real: autenticación, productos y seguridad | 20 | Sí |
| **Total** | | | **50** | |

---

## 2. Stack de pruebas

| Herramienta | Versión | Uso |
| :--- | :---: | :--- |
| xUnit | 2.9.3 | Framework de pruebas en los tres proyectos |
| xunit.runner.visualstudio | 3.1.4 | Adaptador para ejecutar las pruebas con `dotnet test` y el Explorador de pruebas de Visual Studio |
| Microsoft.NET.Test.Sdk | 17.14.1 | Plataforma de ejecución VSTest |
| Moq | 4.20.72 | Objetos simulados de repositorios y unidad de trabajo en las pruebas unitarias |
| NetArchTest.Rules | 1.3.2 | Reglas sobre los ensamblados compilados en las pruebas de arquitectura |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.12 | `WebApplicationFactory`: la API completa servida en memoria |
| Testcontainers.PostgreSql | 4.15.0 | Contenedor de PostgreSQL 16 efímero para las pruebas de integración |
| coverlet.collector | 6.0.4 | Recolección de cobertura de código |

---

## 3. Estrategia de pruebas

Cada tipo de prueba cubre un nivel distinto del sistema y protege contra una clase diferente de errores:

```
                 ┌──────────────────────────┐
                 │   Pruebas de integración │  HTTP → API completa → PostgreSQL real
                 │   (IntegrationTests)     │  Contratos HTTP, seguridad y persistencia
                 ├──────────────────────────┤
                 │   Pruebas unitarias      │  Casos de uso con dependencias simuladas
                 │   (UnitTests)            │  Reglas de negocio y efectos secundarios
                 ├──────────────────────────┤
                 │   Pruebas de arquitectura│  Ensamblados compilados
                 │   (ArchitectureTests)    │  Estructura y dependencias entre capas
                 └──────────────────────────┘
```

| Nivel | Detecta | Velocidad |
| :--- | :--- | :--- |
| Arquitectura | Una capa que referencia a otra indebida, tipos fuera de su espacio de nombres o con nombres incorrectos | Segundos; no ejecuta código de la aplicación |
| Unitarias | Errores en la lógica de negocio: validaciones, normalización de datos, transacciones, inventario y auditoría | Segundos; sin base de datos |
| Integración | Errores en la configuración real: rutas, serialización JSON, autenticación JWT, autorización por rol, middleware de errores, mapeo de EF Core y restricciones de PostgreSQL | Minutos; levanta un contenedor de PostgreSQL |

---

## 4. Pruebas unitarias

**Proyecto:** `UnitTests` · **Archivo:** [`Servicios/ProductoServiceTests.cs`](UnitTests/Servicios/ProductoServiceTests.cs) · **Referencias:** `Core.Application`, `Core.Domain`

### 4.1 Enfoque

Verifican los casos de uso de `ProductoService` (capa `Core.Application`) sin base de datos:

- Los repositorios (`IProductoRepository`, `ICategoriaRepository`, `IInventarioRepository`, `INotificacionRepository`, `IAuditoriaRepository`), la unidad de trabajo (`IUnitOfWork`) y la transacción (`ITransaccion`) se simulan con **Moq**.
- `InventarioService` y `AuditoriaService` son las **implementaciones reales**, construidas sobre repositorios simulados. Así se comprueba el efecto completo de cada caso de uso: el movimiento de inventario, la notificación y el registro de auditoría que genera.
- Los movimientos, auditorías y notificaciones que se agregan se capturan en listas mediante `Callback`, para inspeccionarlos con aserciones.
- El constructor configura un escenario favorable por defecto (SKU libre, categoría existente); cada prueba modifica solo lo que necesita.
- `VerificarQueNoSeGuardo()` comprueba que, ante un error, no se llamó a `GuardarCambiosAsync` ni se confirmó la transacción.

### 4.2 Casos cubiertos

**`CrearAsync`** (6 pruebas)

| Prueba | Verifica |
| :--- | :--- |
| `CrearAsync_DatosValidos_GuardaElProductoNormalizadoDentroDeUnaTransaccion` | SKU en mayúsculas y sin espacios, nombre recortado, precio y costo redondeados a 2 decimales, ubicación vacía como `null`, unidad en minúsculas; guardado y confirmación de la transacción |
| `CrearAsync_ConStockInicial_RegistraUnaReposicionDesdeCero` | Movimiento de tipo `Reposicion` de 0 al stock inicial, asociado al usuario |
| `CrearAsync_SinStockInicial_NoRegistraMovimientos` | Sin stock inicial no se registra movimiento de inventario |
| `CrearAsync_RegistraAuditoriaDeCreacionSinDatosAnteriores` | Auditoría de tipo `Crear`, sin datos anteriores y con el producto serializado como datos posteriores |
| `CrearAsync_SkuEnUso_LanzaConflictoSinGuardarNada` | `ConflictoException` y ninguna escritura |
| `CrearAsync_CategoriaInexistente_LanzaInvalidOperationSinGuardarNada` | `InvalidOperationException` y ninguna escritura |

**`ActualizarAsync`** (9 pruebas)

| Prueba | Verifica |
| :--- | :--- |
| `ActualizarAsync_ProductoInexistente_LanzaKeyNotFound` | `KeyNotFoundException` y ninguna escritura |
| `ActualizarAsync_SkuDeOtroProducto_LanzaConflictoExcluyendoAlPropioProducto` | El SKU repetido se busca excluyendo al propio producto; el producto no se modifica |
| `ActualizarAsync_ConCambios_ActualizaGuardaYAuditaElAntesYDespues` | Cambios aplicados, fecha de actualización y auditoría de tipo `Editar` con el estado anterior y el posterior |
| `ActualizarAsync_SinCambios_NoGuardaNiAudita` | Si no hay cambios no se escribe ni se audita |
| `ActualizarAsync_StockIgualAlActual_NoAjustaElInventario` | Sin diferencia de stock no hay ajuste de inventario |
| `ActualizarAsync_StockDistinto_AjustaElInventarioYRegistraElMovimiento` | Movimiento de tipo `Ajuste` con la diferencia, el stock anterior y el posterior |
| `ActualizarAsync_StockACero_AvisaQueElProductoSeAgoto` | Notificación `StockAgotado` cuando el stock llega a cero |
| `ActualizarAsync_StockReponeUnProductoAgotado_ResuelveElAviso` | Al reponer un producto agotado se marca su aviso como resuelto |
| `ActualizarAsync_StockCambioMientrasSeEditaba_LanzaConflictoSinGuardar` | Control de concurrencia: si el stock cambió durante la edición se lanza `ConflictoException` y no se guarda nada |

**`BorrarAsync`** (2 pruebas)

| Prueba | Verifica |
| :--- | :--- |
| `BorrarAsync_ProductoExistente_LoDesactivaYAuditaElBorrado` | Borrado lógico (`Activo = false`) y auditoría de tipo `Borrar` |
| `BorrarAsync_ProductoInexistente_LanzaKeyNotFound` | `KeyNotFoundException`, sin auditoría ni escritura |

---

## 5. Pruebas de arquitectura

**Proyecto:** `ArchitectureTests` · **Referencias:** las cuatro capas del backend

### 5.1 Enfoque

Con **NetArchTest.Rules** se inspeccionan los ensamblados compilados y se verifica que la estructura de la Onion Architecture se mantenga a medida que el código evoluciona. La clase [`Capas.cs`](ArchitectureTests/Capas.cs) centraliza los ensamblados y espacios de nombres de cada capa, y su método `Cumple` informa en el mensaje de error la lista de tipos que incumplen la regla.

La regla de dependencia verificada es:

```
Presentation.API ──► Infrastructure ──► Core.Application ──► Core.Domain
```

### 5.2 Regla de dependencia entre capas

Archivo [`DependenciasEntreCapasTests.cs`](ArchitectureTests/DependenciasEntreCapasTests.cs) (6 pruebas):

| Prueba | Regla |
| :--- | :--- |
| `Dominio_NoDependeDeNingunaOtraCapa` | `Core.Domain` no referencia Application, Infrastructure ni Presentation |
| `Dominio_NoDependeDeFrameworksExternos` | `Core.Domain` no referencia EF Core, Npgsql, ASP.NET Core ni FluentValidation |
| `Aplicacion_NoDependeDeInfraestructuraNiDePresentacion` | `Core.Application` no referencia Infrastructure ni Presentation |
| `Aplicacion_NoDependeDeEfCoreNiDeAspNetCore` | `Core.Application` no referencia EF Core, Npgsql ni ASP.NET Core |
| `Infraestructura_NoDependeDePresentacion` | `Infrastructure` no referencia Presentation |
| `Controladores_NoDependenDeInfraestructuraNiDeEfCore` | Los controladores trabajan con los contratos de Application; solo `Program.cs` conoce Infrastructure para registrar las implementaciones |

### 5.3 Convenciones de nombres y ubicación

Archivo [`ConvencionesTests.cs`](ArchitectureTests/ConvencionesTests.cs) (7 pruebas):

| Prueba | Regla |
| :--- | :--- |
| `Entidades_HeredanDeBaseEntity` | Toda clase no estática de `Core.Domain.Entidades` hereda de `BaseEntity` |
| `ContratosDeRepositorio_SonInterfacesDeAplicacion` | Los tipos `*Repository` de Application son interfaces en `Core.Application.Abstracciones` |
| `InterfacesDeAplicacion_EmpiezanConI` | Las interfaces de Application empiezan con `I` |
| `Repositorios_EstanEnPersistenciaYSonClasesConcretas` | Los `*Repository` de Infrastructure son clases concretas en `Infrastructure.Persistencia.Repositorios` |
| `Validadores_TerminanEnValidator` | Las clases de los espacios `Validadores` terminan en `Validator` |
| `Controladores_TerminanEnControllerYHeredanDeControllerBase` | Las clases de `Presentation.API.Controllers` terminan en `Controller` y heredan de `ControllerBase` |
| `Controladores_SoloEstanEnSuEspacioDeNombres` | Ningún controlador se ubica fuera de `Presentation.API.Controllers` |

---

## 6. Pruebas de integración

**Proyecto:** `IntegrationTests` · **Referencias:** `Presentation.API`

### 6.1 Infraestructura de pruebas

Las pruebas ejercitan la API de punta a punta: `Program.cs`, middleware, autenticación JWT, autorización por rol, validación, EF Core y PostgreSQL.

**[`ApiFactory`](IntegrationTests/Infraestructura/ApiFactory.cs)** (`WebApplicationFactory<Program>` + `IAsyncLifetime`)

1. Inicia un contenedor **PostgreSQL 16** con Testcontainers, el mismo motor que usa `docker-compose.yml`. Se necesita un PostgreSQL real porque el esquema usa enums nativos y el inventario utiliza `UPDATE` condicionales y `SELECT ... FOR UPDATE`, que una base en memoria no reproduce.
2. Aplica las migraciones de EF Core antes de arrancar la API, ya que al iniciar `Program.cs` crea la fila de configuración y el superadmin inicial.
3. Arranca la API en el entorno `Testing` con su propia cadena de conexión, clave JWT y superadmin (`admin@pruebas.local`).
4. Elimina los servicios en segundo plano (`IHostedService`): el job de expiración de pedidos y el worker de WhatsApp, para que no modifiquen la base durante las pruebas.
5. Expone `ConsultarAsync`, que permite verificar directamente en la base lo que dejó una petición (movimientos, auditoría, borrado lógico).

**Colección compartida.** Todas las clases pertenecen a la colección `Api` (`ICollectionFixture<ApiFactory>`), por lo que comparten **un único contenedor** y se ejecutan de forma secuencial. Cada prueba genera sus propios datos (SKU, correos y categorías únicos con `Unico()`), de modo que no se requiere limpiar la base entre pruebas.

**[`ApiTestBase`](IntegrationTests/Infraestructura/ApiTestBase.cs)** proporciona las utilidades comunes:

| Utilidad | Función |
| :--- | :--- |
| `Anonimo()` | Cliente HTTP sin autenticación |
| `ComoAdminAsync()` | Cliente autenticado como superadmin |
| `ComoVentasAsync()` | Crea un usuario de ventas con el admin y devuelve su id y un cliente autenticado |
| `LoginAsync(email, password)` | Inicia sesión y devuelve el `AuthResponseDto` |
| `CrearCategoriaAsync(admin)` | Crea una categoría con nombre único |
| `NuevoProducto(...)` | Construye una solicitud de creación de producto válida |
| `EsperarAsync(respuesta, código)` | Comprueba el código de estado e incluye el cuerpo (Problem Details) en el mensaje si falla |
| `LeerAsync<T>(respuesta)` | Deserializa con la misma configuración JSON que la API (camelCase y enums en snake_case) |

### 6.2 Autenticación

Archivo [`AutenticacionTests.cs`](IntegrationTests/AutenticacionTests.cs) (4 pruebas):

| Prueba | Verifica |
| :--- | :--- |
| `Login_SuperadminInicial_DevuelveJwtYRefreshToken` | El login devuelve JWT, refresh token, rol, correo y una expiración futura |
| `Login_ContrasenaIncorrecta_Devuelve401ConProblemDetails` | Credenciales inválidas: `401` con `application/problem+json` |
| `Yo_ConToken_DevuelveElUsuarioDeLaSesion` | `GET /auth/yo` devuelve el usuario del token |
| `Refresh_RotaElTokenYRechazaReutilizarElAnterior` | La renovación emite un refresh token nuevo; reutilizar el anterior devuelve `401` y revoca todas las sesiones del usuario, incluida la recién rotada |

### 6.3 Productos

Archivo [`ProductosTests.cs`](IntegrationTests/ProductosTests.cs) (8 pruebas):

| Prueba | Verifica |
| :--- | :--- |
| `Crear_Devuelve201ConLocationYGuardaMovimientoYAuditoria` | `201 Created` con encabezado `Location`, SKU normalizado, movimiento de reposición y registro de auditoría en la base |
| `Crear_SkuRepetido_Devuelve409` | SKU repetido sin distinguir mayúsculas: `409` con Problem Details |
| `Crear_PrecioNegativo_Devuelve400ConElErrorDelCampo` | Validación: `400` con el mensaje de error en `errors.precioUsd` |
| `Crear_CategoriaInexistente_Devuelve400` | Categoría inexistente: `400` |
| `Actualizar_ConOtroStock_RegistraUnAjusteEnElInventario` | La edición aplica los cambios y registra un ajuste de inventario con la diferencia |
| `Actualizar_ProductoInexistente_Devuelve404` | Producto inexistente: `404` |
| `Borrar_ComoAdmin_EsUnBorradoLogicoQueLoSacaDeLaTienda` | `204`; el producto desaparece del catálogo público pero permanece inactivo en la base, con auditoría de borrado |
| `Catalogo_SinStock_NoMuestraElProducto` | El catálogo público no muestra productos sin stock |

### 6.4 Seguridad y control de acceso

Archivo [`SeguridadTests.cs`](IntegrationTests/SeguridadTests.cs) (8 pruebas). En la rúbrica del curso, **Admin** corresponde a `superadmin` y **Employee** a `ventas`.

| Prueba | Verifica |
| :--- | :--- |
| `Productos_SinToken_Devuelve401ConEncabezadoBearer` | Sin token: `401`, encabezado `WWW-Authenticate: Bearer` y Problem Details |
| `Productos_TokenInvalido_Devuelve401` | Token malformado: `401` |
| `Categorias_ListadoPublico_NoExigeToken` | El listado de categorías es público |
| `Ventas_PuedeConsultarProductos` | El rol `ventas` accede al listado de productos |
| `Ventas_NoPuedeBorrarProductos_Devuelve403YElProductoSigueActivo` | `ventas` no puede borrar productos: `403` y el producto sigue activo |
| `Ventas_NoPuedeCrearCategorias_Devuelve403` | `ventas` no puede crear categorías: `403` |
| `Ventas_NoPuedeGestionarUsuarios_Devuelve403` | `ventas` no puede gestionar usuarios: `403` |
| `UsuarioDesactivado_PierdeElAccesoConSuTokenVigente` | Al desactivar un usuario pierde el acceso de inmediato, aunque su JWT no haya vencido, porque la API valida el usuario en cada petición |

---

## 7. Requisitos previos

| Herramienta | Versión | Necesaria para |
| :--- | :---: | :--- |
| [SDK de .NET](https://dotnet.microsoft.com/download) | 10 | Todas las pruebas |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | — | Solo las pruebas de integración; debe estar en ejecución |

La primera ejecución de las pruebas de integración descarga la imagen `postgres:16` si no está disponible localmente.

---

## 8. Ejecución

Todos los comandos se ejecutan desde la raíz del repositorio.

### 8.1 Por proyecto o completas

```bash
dotnet test tests/UnitTests                       # Unitarias
dotnet test tests/ArchitectureTests               # Arquitectura
dotnet test tests/IntegrationTests                # Integración (requiere Docker)
dotnet test src/backend/Backend_Almacen.slnx      # Las 50 pruebas
```

### 8.2 Filtrar pruebas

```bash
# Una clase de pruebas
dotnet test tests/IntegrationTests --filter "FullyQualifiedName~SeguridadTests"

# Una prueba concreta
dotnet test tests/UnitTests --filter "FullyQualifiedName~CrearAsync_SkuEnUso_LanzaConflictoSinGuardarNada"

# Todo excepto las de integración (no requiere Docker)
dotnet test src/backend/Backend_Almacen.slnx --filter "FullyQualifiedName!~IntegrationTests"
```

### 8.3 Reporte detallado y cobertura

```bash
# Salida detallada en consola y archivos TRX
dotnet test src/backend/Backend_Almacen.slnx --logger "console;verbosity=detailed" --logger "trx;LogFilePrefix=resultados" --results-directory docs/evidencias/pruebas

# Cobertura de código con coverlet (formato Cobertura en TestResults/)
dotnet test src/backend/Backend_Almacen.slnx --collect:"XPlat Code Coverage"
```

### 8.4 Desde Visual Studio

Abrir `src/backend/Backend_Almacen.slnx`; los tres proyectos aparecen en la carpeta de solución `tests` y se ejecutan desde el **Explorador de pruebas** (*Prueba > Explorador de pruebas*).

---

## 9. Resultados y evidencias

Última ejecución registrada: **2026-10-07**, .NET 10.0.12.

| Proyecto | Total | Correctas | Fallidas | Duración |
| :--- | :---: | :---: | :---: | :---: |
| `UnitTests` | 17 | 17 | 0 | 23.4 s |
| `ArchitectureTests` | 13 | 13 | 0 | 17.8 s |
| `IntegrationTests` | 20 | 20 | 0 | 194.1 s |
| **Total** | **50** | **50** | **0** | |

| Evidencia | Contenido |
| :--- | :--- |
| [`docs/evidencias/pruebas-xunit.md`](../docs/evidencias/pruebas-xunit.md) | Reporte del Test Runner de xUnit con el detalle de cada prueba |
| [`docs/evidencias/pruebas/ejecucion-xunit.txt`](../docs/evidencias/pruebas/ejecucion-xunit.txt) | Salida de consola de la ejecución |
| [`docs/evidencias/pruebas/*.trx`](../docs/evidencias/pruebas) | Resultados en formato TRX, uno por proyecto, para abrir en Visual Studio |

---

## 10. Convenciones

- **Nombres de prueba:** `Metodo_Escenario_ResultadoEsperado`, por ejemplo `CrearAsync_SkuEnUso_LanzaConflictoSinGuardarNada`.
- **Estructura:** patrón *Arrange - Act - Assert*, con los bloques separados por una línea en blanco.
- **Independencia:** ninguna prueba depende del orden de ejecución ni de datos creados por otra. En integración, cada prueba crea sus propios datos con identificadores únicos.
- **Mensajes de error útiles:** las aserciones auxiliares (`Cumple`, `EsperarAsync`) incluyen en el mensaje los tipos infractores o el cuerpo de la respuesta, para facilitar el diagnóstico.
- **Nuevas pruebas:** las de un servicio de Application van en `UnitTests/Servicios/<Servicio>Tests.cs`; las de un recurso de la API, en `IntegrationTests/<Recurso>Tests.cs` heredando de `ApiTestBase`.

---

## 11. Estructura de la carpeta

```
tests/
├── UnitTests/
│   ├── Servicios/
│   │   └── ProductoServiceTests.cs        17 pruebas de ProductoService
│   └── UnitTests.csproj                   xUnit + Moq
├── ArchitectureTests/
│   ├── Capas.cs                           Ensamblados de cada capa y aserción Cumple
│   ├── DependenciasEntreCapasTests.cs     6 pruebas de la regla de dependencia
│   ├── ConvencionesTests.cs               7 pruebas de convenciones
│   └── ArchitectureTests.csproj           xUnit + NetArchTest.Rules
├── IntegrationTests/
│   ├── Infraestructura/
│   │   ├── ApiFactory.cs                  API en memoria + PostgreSQL 16 (Testcontainers)
│   │   └── ApiTestBase.cs                 Clientes por rol y utilidades comunes
│   ├── AutenticacionTests.cs              4 pruebas de login, sesión y refresh tokens
│   ├── ProductosTests.cs                  8 pruebas del ciclo de vida del producto
│   ├── SeguridadTests.cs                  8 pruebas de JWT y control de acceso por rol
│   └── IntegrationTests.csproj            xUnit + WebApplicationFactory + Testcontainers
└── README.md                              Este documento
```

---

## 12. Pruebas del frontend

La SPA tiene su propio conjunto de pruebas con **Vitest** y **React Testing Library** (jsdom), ubicadas junto al código que prueban (`*.test.js` y `*.test.jsx`). No requieren la API ni Docker: los servicios de `api/` se prueban reemplazando `fetch`, y las pantallas, simulando esos servicios.

| Área | Pruebas |
| :--- | :---: |
| Utilidades | 23 |
| Cliente HTTP y servicios de la API | 77 |
| Contextos (sesión, carrito y tema) | 22 |
| Enrutado y control de acceso | 31 |
| Componentes | 80 |
| Layouts | 26 |
| Tienda, acceso y entregas | 29 |
| Panel de ventas | 91 |
| Administración | 76 |
| **Total** | **455** |

Dos de ellas están marcadas con `it.fails` porque documentan un error conocido del frontend (el estado `aprobado` no tiene nombre visible).

```bash
cd src/frontend
npm test
```

El detalle de cada archivo, la configuración y los pasos pendientes están en la sección [Pruebas](../src/frontend/README.md#13-pruebas) del README del frontend.

---

## 13. Documentación relacionada

| Documento | Contenido |
| :--- | :--- |
| [README principal](../README.md) | Visión general del proyecto y de todo el repositorio |
| [`src/backend/README.md`](../src/backend/README.md) | API REST bajo prueba: arquitectura, seguridad, instalación y configuración |
| [`src/frontend/README.md`](../src/frontend/README.md#13-pruebas) | Pruebas del frontend con Vitest y React Testing Library |
| [`docs/ARQUITECTURA.md`](../docs/ARQUITECTURA.md) | Capas y regla de dependencia que verifican las pruebas de arquitectura |
| [`docs/API.md`](../docs/API.md) | Endpoints y roles que ejercitan las pruebas de integración |
| [`docs/evidencias/escenarios-seguridad.md`](../docs/evidencias/escenarios-seguridad.md) | Escenarios de seguridad complementarios ejecutados con Postman |

---

<div align="center">

Universidad Nacional Experimental del Táchira · Desarrollo de Aplicaciones Web · 2026

</div>
