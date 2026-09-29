# Arquitectura del Sistema

[← Volver al README](../README.md)

## 1. Onion Architecture

La solución se organiza en cuatro proyectos concéntricos. Cada capa solo conoce a las capas más internas, de modo que las reglas del negocio no dependen de la base de datos, del framework web ni de servicios externos.

```
        ┌──────────────────────────────────────────────┐
        │              Presentation.API                │
        │   ┌──────────────────────────────────────┐   │
        │   │            Infrastructure            │   │
        │   │   ┌──────────────────────────────┐   │   │
        │   │   │       Core.Application       │   │   │
        │   │   │   ┌──────────────────────┐   │   │   │
        │   │   │   │     Core.Domain      │   │   │   │
        │   │   │   └──────────────────────┘   │   │   │
        │   │   └──────────────────────────────┘   │   │
        │   └──────────────────────────────────────┘   │
        └──────────────────────────────────────────────┘
```

| Proyecto | Responsabilidad | Referencia a |
| :--- | :--- | :--- |
| `Core.Domain` | Entidades, enumeraciones y reglas de negocio puras | Ninguna |
| `Core.Application` | Casos de uso y contratos (interfaces) | Core.Domain |
| `Infrastructure` | Persistencia, archivos, mensajería y tareas en segundo plano | Core.Application |
| `Presentation.API` | Controladores HTTP, DTOs, autenticación, manejo global de errores y composición de la aplicación | Core.Application, Infrastructure |

### Regla de dependencia

- **Core.Domain no tiene ninguna dependencia**: ni a otros proyectos ni a paquetes NuGet. Su `.csproj` no contiene referencias.
- **Core.Application** solo depende de Core.Domain (y de `Microsoft.Extensions.Logging.Abstractions` para registrar eventos). Declara las interfaces que necesita (`IPedidoRepository`, `IUnitOfWork`, `IAlmacenamientoArchivos`…) sin saber cómo se implementan.
- **Infrastructure** implementa esas interfaces con EF Core, Npgsql, Cloudinary y BCrypt. Es la única capa que conoce la base de datos.
- **Presentation.API** es la raíz de composición: registra todas las dependencias y expone los endpoints.

Esto aplica el **Principio de Inversión de Dependencias (DIP)**: los casos de uso dependen de abstracciones, y la infraestructura se "enchufa" desde afuera.

---

## 2. Contenido de cada capa

### Core.Domain
- `Comun/BaseEntity.cs`: clase base abstracta de todas las entidades, con `Id` (`Guid`) y `CreatedAt` (`DateTime` en UTC). En la base de datos `CreatedAt` se guarda en la columna `creado_en` con valor por defecto `now()`; el mapeo se hace una sola vez para todas las entidades en `ApplicationDbContext`.
- `Entidades/`: 13 entidades del negocio, todas heredan de `BaseEntity` (ver [MODELO_DATOS.md](MODELO_DATOS.md)).
- `Enums/`: roles, estados del pedido, métodos de pago, tipos de movimiento de inventario, etc.
- `Reglas/TransicionesPedido.cs`: qué cambios de estado de un pedido son legales y qué estados cuentan como venta.
- `Reglas/Telefonos.cs`: validación y normalización de teléfonos venezolanos (`+58 4XX XXX XXXX`).

La entidad `Pedido` encapsula su propia regla: todo cambio de estado pasa por `Pedido.CambiarEstado(...)`, que valida la transición y registra la línea en el historial.

### Core.Application
- `Abstracciones/`: interfaces de repositorios, `IUnitOfWork` y servicios externos.
- `Dtos/`: DTOs de entrada (creación, edición y login): `LoginDto`, `AuthResponseDto`, `CrearProductoRequest`, `CategoriaRequest`, `CrearUsuarioRequest`, `DatosPedido`, etc.
- `Validadores/`: un validador **FluentValidation** por cada DTO de entrada (ver sección 6).
- `Excepciones/ConflictoException.cs`: error de negocio que el middleware traduce a `409`.
- `Servicios/`:
  - `IProductoService` / `ProductoService`: crear, editar y borrar (lógico) productos, con auditoría y movimiento de inventario.
  - `PedidosService`: crear, aprobar, rechazar, marcar en camino, entregar y expirar pedidos.
  - `InventarioService`: reservar, confirmar y liberar stock, y reponer productos.
  - `ReportesService`: calcula los KPIs y los datos del informe en Excel.
  - `AuditoriaService`: registrar quién cambió qué.
  - `TasaService`: tasa de cambio Bs/USD vigente.
  - `ColaWhatsapp`: cola en memoria de los mensajes pendientes por enviar.

### Infrastructure
- `Persistencia/ApplicationDbContext.cs`: contexto de EF Core con enums nativos de PostgreSQL y nombres en `snake_case`. Configura las columnas comunes de `BaseEntity` para todas las entidades y siembra los datos maestros con `ModelBuilder.HasData()` (`SembrarDatosMaestros`).
- `Persistencia/Configuraciones/`: una clase `IEntityTypeConfiguration<T>` por entidad (Fluent API).
- `Persistencia/Migraciones/`: migraciones Code-First.
- `Persistencia/Repositorios/`: implementaciones de los repositorios; las lecturas usan `.AsNoTracking()`.
- `Persistencia/UnitOfWork.cs`: agrupa los cambios de una petición en una sola transacción.
- `Persistencia/Semillas/`: datos iniciales (categorías, productos, zonas, configuración y superadmin) y el sembrador de datos de demostración (`SembradorDemo`, con Bogus).
- `Archivos/`: subida de comprobantes de pago a Cloudinary, o a disco local si Cloudinary no está configurado.
- `Reportes/GeneradorExcel.cs`: arma el informe `.xlsx` con ClosedXML.
- `Mensajeria/EnvioWhatsappWorker.cs`: servicio en segundo plano que consume la cola y llama al microservicio de Baileys.
- `Jobs/ExpiracionPedidosJob.cs`: servicio en segundo plano que expira los pedidos pendientes vencidos.
- `Seguridad/HasherBcrypt.cs`: hash de contraseñas.

### Presentation.API
- `Controllers/`: un controlador por recurso (ver [API.md](API.md)). `PruebasErroresController` provoca errores a propósito para probar el middleware.
- `Middleware/ExceptionMiddleware.cs`: manejo global de excepciones con Problem Details (RFC 7807). Ver la sección 5.
- `Filtros/ValidacionFilter.cs`: filtro global que ejecuta FluentValidation antes de cada acción y responde `400`.
- `Validadores/CrearPedidoFormValidator.cs`: único validador de la API; reutiliza `DatosPedidoValidator` y solo agrega la validación del archivo (`IFormFile`), que es un concepto HTTP.
- `Dtos/`: objetos de salida de la API; las entidades nunca se exponen directamente.
- `Auth/`: emisión de tokens JWT, constantes de roles (`Admin`, `Employee`) y extensiones para leer el usuario autenticado.
- `Program.cs`: composición de servicios y pipeline HTTP.

---

## 3. Inyección de Dependencias y Ciclos de Vida

La inyección de dependencias es la nativa de ASP.NET Core. Cada capa expone un método de extensión que registra sus servicios, y `Program.cs` los invoca:

```csharp
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
```

| Servicio | Ciclo de vida | Justificación |
| :--- | :--- | :--- |
| `ApplicationDbContext` | **Scoped** | Un contexto por petición HTTP; no es seguro compartirlo entre hilos. |
| `IUnitOfWork` y todos los repositorios | **Scoped** | Comparten el mismo `DbContext` durante la petición, para que los cambios se guarden juntos. |
| `IProductoService`, `PedidosService`, `InventarioService`, `ReportesService`, `AuditoriaService`, `TasaService` | **Scoped** | Servicios de negocio que dependen de repositorios Scoped. |
| Validadores FluentValidation (`IValidator<T>`) | **Transient** | Objetos livianos y sin estado; se registran con `AddValidatorsFromAssembly(..., ServiceLifetime.Transient)`. |
| `IGeneradorExcel` (ClosedXML) | **Singleton** | No guarda estado; cada llamada arma un libro nuevo. |
| `TokenService` | **Singleton** | Solo lee opciones inmutables (`JwtOptions`) y firma tokens; no guarda estado por petición. |
| `ExceptionMiddleware` | **Transient** | Implementa `IMiddleware`, así que el contenedor lo crea en cada petición. No guarda estado entre peticiones, por lo que no hace falta compartir una instancia. |
| `IHasherContrasenas` (BCrypt) | **Singleton** | No guarda estado; una sola instancia sirve para toda la aplicación. |
| `IAlmacenamientoArchivos` y cliente de Cloudinary | **Singleton** | Cliente sin estado por petición; crearlo una vez evita costo repetido. |
| `ColaWhatsapp` | **Singleton** | La cola debe ser la misma para quien encola (servicios) y quien consume (worker). |
| Opciones (`WhatsappOptions`, `ExpiracionOptions`, `ReportesOptions`) | **Singleton** | Configuración de solo lectura. |
| `EnvioWhatsappWorker`, `ExpiracionPedidosJob` | **Hosted Service** | Corren en segundo plano durante toda la vida de la aplicación; crean su propio *scope* para usar servicios Scoped. |
| Cliente HTTP del worker de WhatsApp | `IHttpClientFactory` | Reutiliza conexiones y evita el agotamiento de sockets. |

---

## 4. Pipeline HTTP

Orden de los *middlewares* en `Program.cs`:

1. `UseCors("Frontend")`: autoriza al frontend (otro origen) a llamar a la API desde el navegador. Va primero para responder el *preflight* (`OPTIONS`) y para que también las respuestas de error lleven los encabezados CORS. Los orígenes se leen de `Cors:OrigenesPermitidos`; se permite cualquier encabezado y método, y se expone `Content-Disposition` para la descarga del Excel. No usa credenciales/cookies porque el JWT viaja en el encabezado `Authorization`.
2. `UseMiddleware<ExceptionMiddleware>()`: captura las excepciones de todo lo que viene después.
3. `MapOpenApi()` (solo en desarrollo): publica el documento OpenAPI en `/openapi/v1.json`.
4. `UseHttpsRedirection()`.
5. `UseStaticFiles(...)` para `/capturas`, solo cuando los comprobantes se guardan en disco local.
6. `UseAuthentication()`: valida el JWT. Además rechaza el token si el usuario fue desactivado, aunque el token no haya vencido.
7. `UseAuthorization()`: aplica los roles de cada endpoint.
8. `MapControllers()`.

Antes de atender peticiones, la aplicación ejecuta `InicializarBaseDatosAsync`, que crea la fila de configuración y el superadmin inicial si no existen. En desarrollo, y solo si se pide con `--SiembraDemo:Habilitada=true`, también genera los datos de demostración.

---

## 5. Manejo global de errores (RFC 7807)

`Presentation.API/Middleware/ExceptionMiddleware.cs` captura cualquier excepción no controlada y responde con un objeto **Problem Details** (RFC 7807, actualizado por RFC 9457) y el tipo de contenido `application/problem+json`:

| Excepción | Código | `title` |
| :--- | :---: | :--- |
| `ValidationException` (FluentValidation) | `400` | Uno o más datos no son válidos (con `errors` por campo) |
| `InvalidOperationException` | `400` | Solicitud inválida |
| `KeyNotFoundException` | `404` | Recurso no encontrado |
| `ConflictoException` | `409` | Conflicto con el estado actual |
| Cualquier otra | `500` | Error interno del servidor |

Los `401` (sin token o token inválido) y `403` (rol sin permiso) también salen como Problem Details: los escriben los eventos `OnChallenge` y `OnForbidden` de `JwtBearer` con el mismo helper del middleware.

- En los errores `404` y `400`, `detail` lleva el mensaje de la excepción, que es un mensaje de negocio pensado para el usuario.
- En los errores `500`, `detail` es siempre un texto genérico. El mensaje original y el *stack trace* **nunca** llegan al cliente: se escriben en el log del servidor junto con el `traceId`, que también va en la respuesta para poder cruzarlos.
- Si el cliente cierra la conexión (`OperationCanceledException`), no se responde nada.
- El middleware se registra como **Transient** (`AddTransient<ExceptionMiddleware>()`) y se agrega de primero en el pipeline.

Ejemplo de respuesta:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
  "title": "Error interno del servidor",
  "status": 500,
  "detail": "Ocurrió un error inesperado. Intenta de nuevo más tarde.",
  "instance": "/pruebas/errores/interno",
  "traceId": "00-9ec4162eb81c08e9f77dcd719eb97315-cc7a21935643c750-00"
}
```

Para probarlo están los endpoints `GET /pruebas/errores/no-encontrado`, `/operacion-invalida` e `/interno` (ver [API.md](API.md)), la carpeta **Errores RFC 7807** de la [colección de Postman](postman/Backend_Almacen.postman_collection.json) y las respuestas reales capturadas en [evidencias/errores-rfc7807.md](evidencias/errores-rfc7807.md).

> Los controladores siguen devolviendo sus propios códigos para los casos de negocio que ya validan (por ejemplo, `409` al aprobar un pedido que no está pendiente). El middleware es la red de seguridad para todo lo que no se controla ahí.

---

## 6. Seguridad stateless (JWT), RBAC y validación defensiva (Fase 3)

### Autenticación JWT

- **Personal** (superadmin, ventas, repartidor): `POST /api/auth/login` (también `/auth/login`) recibe un `LoginDto` (`email`, `password`). La contraseña se compara contra el hash guardado y la respuesta es un `AuthResponseDto` con `token`, `expiraEn`, `username`, `email` y `rol`.
- **Clientes**: `POST /api/auth/google` con el *ID token* de Google, que el backend valida con `Google.Apis.Auth` contra el Client ID configurado en `Google:ClientId`. Si el cliente no existe, se crea.
- El token es un **JWT firmado con HMAC-SHA256** (`HS256`) con los claims `sub` (id), `name`, `email`, `role`, `jti`, `iat`, `nbf` y `exp`. Vence a las `Jwt:HorasValidez` horas (8 por defecto). Se validan emisor, audiencia, firma y vencimiento, y además se rechaza el token si el usuario fue desactivado.
- **Clave secreta**: nunca está en el código. En desarrollo va en `appsettings.Development.json`; en producción `appsettings.json` la deja vacía y se define con la variable de entorno `Jwt__Key` (o *user secrets*). La API no arranca si la clave tiene menos de 32 caracteres (256 bits).

### Resguardo de contraseñas

Las contraseñas se guardan con **bcrypt** (`HasherBcrypt`, factor de costo por defecto), que la consigna admite como "SHA-256 o superior": a diferencia de un SHA-256 simple, bcrypt agrega una **sal aleatoria por usuario** (dos contraseñas iguales producen hashes distintos, lo que anula las *rainbow tables*) y es **deliberadamente lento y configurable**, lo que encarece los ataques de fuerza bruta. SHA-256 está diseñado para ser rápido, que es justo lo que no se quiere al guardar contraseñas.

### Matriz RBAC

La consigna habla de los roles `Admin` y `Employee`; en el negocio corresponden a `superadmin` y `ventas` (constantes `Roles.Admin` y `Roles.Employee` en `Auth/Roles.cs`).

| Operación | Admin (`superadmin`) | Employee (`ventas`) | Sin token |
| :--- | :---: | :---: | :---: |
| Consultar productos, inventario y pedidos | ✅ | ✅ | `401` |
| Registrar y editar productos | ✅ | ✅ | `401` |
| **Borrar productos** (`DELETE /productos/{id}`) | ✅ | `403` | `401` |
| **Crear y editar categorías** | ✅ | `403` | `401` |
| Usuarios, zonas, configuración, reportes, auditoría | ✅ | `403` | `401` |

Todo se declara con `[Authorize(Roles = ...)]` en controladores y acciones.

### Validación defensiva con FluentValidation

- Cada DTO de creación y edición tiene su validador en `Core.Application/Validadores/` (desacoplado de la API y de los controladores).
- Reglas principales: precio y costo `> 0`; stocks `>= 0`; `stockMaximo > stockMinimo`; textos obligatorios y con longitud máxima igual a la de la columna; SKU alfanumérico; correo con formato válido; contraseña de 8 a 72 caracteres; teléfono venezolano; rol de personal permitido; método de pago válido.
- `Presentation.API/Filtros/ValidacionFilter.cs` es un filtro global: busca el `IValidator<T>` de cada argumento de la acción, lo ejecuta y, si hay errores, responde **`400 Bad Request`** con `application/problem+json` y el detalle por campo, sin llegar a ejecutar el controlador:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Uno o más datos no son válidos.",
  "status": 400,
  "detail": "Revisa los campos indicados en errors.",
  "instance": "/productos",
  "errors": {
    "precioUsd": ["El precio debe ser mayor que 0."],
    "stockMaximo": ["El stock máximo debe ser mayor que el stock mínimo."]
  }
}
```

Las respuestas reales de los cuatro escenarios de la Fase 3 están en [evidencias/seguridad-fase3.md](evidencias/seguridad-fase3.md).

---

## 7. Pendientes técnicos

| Pendiente | Descripción |
| :--- | :--- |
| Pruebas unitarias | Proyecto de pruebas con xUnit y Moq para la capa Application. |
