# Arquitectura del Sistema

[← Volver al README](../README.md)

## 1. Onion Architecture

La solución se organiza en cuatro proyectos concéntricos. Cada capa solo conoce a las capas más internas, de modo que las reglas del negocio no dependen de la base de datos, del framework web ni de servicios externos.

```
        ┌──────────────────────────────────────────────┐
        │                   WebAPI                     │
        │   ┌──────────────────────────────────────┐   │
        │   │            Infrastructure            │   │
        │   │   ┌──────────────────────────────┐   │   │
        │   │   │         Application          │   │   │
        │   │   │   ┌──────────────────────┐   │   │   │
        │   │   │   │        Domain        │   │   │   │
        │   │   │   └──────────────────────┘   │   │   │
        │   │   └──────────────────────────────┘   │   │
        │   └──────────────────────────────────────┘   │
        └──────────────────────────────────────────────┘
```

| Proyecto | Responsabilidad | Referencia a |
| :--- | :--- | :--- |
| `Backend_Almacen.Domain` | Entidades, enumeraciones y reglas de negocio puras | Ninguna |
| `Backend_Almacen.Application` | Casos de uso y contratos (interfaces) | Domain |
| `Backend_Almacen.Infrastructure` | Persistencia, archivos, mensajería y tareas en segundo plano | Application |
| `Backend_Almacen.WebAPI` | Controladores HTTP, DTOs, autenticación y composición de la aplicación | Application, Infrastructure |

### Regla de dependencia

- **Domain no tiene ninguna dependencia**: ni a otros proyectos ni a paquetes NuGet. Su `.csproj` no contiene referencias.
- **Application** solo depende de Domain (y de `Microsoft.Extensions.Logging.Abstractions` para registrar eventos). Declara las interfaces que necesita (`IPedidoRepository`, `IUnitOfWork`, `IAlmacenamientoArchivos`…) sin saber cómo se implementan.
- **Infrastructure** implementa esas interfaces con EF Core, Npgsql, Cloudinary y BCrypt. Es la única capa que conoce la base de datos.
- **WebAPI** es la raíz de composición: registra todas las dependencias y expone los endpoints.

Esto aplica el **Principio de Inversión de Dependencias (DIP)**: los casos de uso dependen de abstracciones, y la infraestructura se "enchufa" desde afuera.

---

## 2. Contenido de cada capa

### Domain
- `Entidades/`: 13 entidades del negocio (ver [MODELO_DATOS.md](MODELO_DATOS.md)).
- `Enums/`: roles, estados del pedido, métodos de pago, tipos de movimiento de inventario, etc.
- `Reglas/TransicionesPedido.cs`: qué cambios de estado de un pedido son legales y qué estados cuentan como venta.
- `Reglas/Telefonos.cs`: validación y normalización de teléfonos venezolanos (`+58 4XX XXX XXXX`).

La entidad `Pedido` encapsula su propia regla: todo cambio de estado pasa por `Pedido.CambiarEstado(...)`, que valida la transición y registra la línea en el historial.

### Application
- `Abstracciones/`: interfaces de repositorios, `IUnitOfWork` y servicios externos.
- `Servicios/`:
  - `PedidosService`: crear, aprobar, rechazar, marcar en camino, entregar y expirar pedidos.
  - `InventarioService`: reservar, confirmar y liberar stock, y reponer productos.
  - `ReportesService`: calcula los KPIs y los datos del informe en Excel.
  - `AuditoriaService`: registrar quién cambió qué.
  - `TasaService`: tasa de cambio Bs/USD vigente.
  - `ColaWhatsapp`: cola en memoria de los mensajes pendientes por enviar.

### Infrastructure
- `Persistencia/ApplicationDbContext.cs`: contexto de EF Core con enums nativos de PostgreSQL y nombres en `snake_case`.
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

### WebAPI
- `Controllers/`: un controlador por recurso (ver [API.md](API.md)).
- `Dtos/`: objetos de entrada y salida de la API; las entidades nunca se exponen directamente.
- `Auth/`: emisión de tokens JWT, constantes de roles y extensiones para leer el usuario autenticado.
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
| `PedidosService`, `InventarioService`, `ReportesService`, `AuditoriaService`, `TasaService` | **Scoped** | Dependen de repositorios Scoped. |
| `IGeneradorExcel` (ClosedXML) | **Singleton** | No guarda estado; cada llamada arma un libro nuevo. |
| `TokenService` | **Scoped** | Se usa solo durante el inicio de sesión. |
| `IHasherContrasenas` (BCrypt) | **Singleton** | No guarda estado; una sola instancia sirve para toda la aplicación. |
| `IAlmacenamientoArchivos` y cliente de Cloudinary | **Singleton** | Cliente sin estado por petición; crearlo una vez evita costo repetido. |
| `ColaWhatsapp` | **Singleton** | La cola debe ser la misma para quien encola (servicios) y quien consume (worker). |
| Opciones (`WhatsappOptions`, `ExpiracionOptions`, `ReportesOptions`) | **Singleton** | Configuración de solo lectura. |
| `EnvioWhatsappWorker`, `ExpiracionPedidosJob` | **Hosted Service** | Corren en segundo plano durante toda la vida de la aplicación; crean su propio *scope* para usar servicios Scoped. |
| Cliente HTTP del worker de WhatsApp | `IHttpClientFactory` | Reutiliza conexiones y evita el agotamiento de sockets. |

---

## 4. Pipeline HTTP

Orden de los *middlewares* en `Program.cs`:

1. `MapOpenApi()` (solo en desarrollo): publica el documento OpenAPI en `/openapi/v1.json`.
2. `UseHttpsRedirection()`.
3. `UseStaticFiles(...)` para `/capturas`, solo cuando los comprobantes se guardan en disco local.
4. `UseAuthentication()`: valida el JWT. Además rechaza el token si el usuario fue desactivado, aunque el token no haya vencido.
5. `UseAuthorization()`: aplica los roles de cada endpoint.
6. `MapControllers()`.

Antes de atender peticiones, la aplicación ejecuta `InicializarBaseDatosAsync`, que crea la fila de configuración y el superadmin inicial si no existen. En desarrollo, y solo si se pide con `--SiembraDemo:Habilitada=true`, también genera los datos de demostración.

---

## 5. Autenticación y Autorización

- **Personal** (superadmin, ventas, repartidor): `POST /auth/login` con correo y contraseña; la contraseña se verifica contra el hash BCrypt.
- **Clientes**: `POST /auth/google` con el *ID token* de Google, que el backend valida con `Google.Apis.Auth`. Si el cliente no existe, se crea.
- En ambos casos se devuelve un **JWT firmado con HMAC-SHA256** que incluye el rol del usuario.
- Los endpoints se protegen con `[Authorize(Roles = ...)]`. El rol compuesto `Personal` agrupa a ventas y superadmin.

---

## 6. Pendientes técnicos de la Fase 1

| Pendiente | Descripción |
| :--- | :--- |
| Middleware global de excepciones | Capturar `KeyNotFoundException` (404), `InvalidOperationException` (400) y `Exception` (500) en un `ExceptionMiddleware`, responder con `application/problem+json` (RFC 7807) y ocultar las trazas en los errores 500. |
| Entidad base | Clase abstracta `BaseEntity` con `Id: Guid` y `CreatedAt: DateTime` (UTC) de la que hereden todas las entidades. |
| Nombres de proyectos | Alinear con la nomenclatura de la asignatura: `Core.Domain`, `Core.Application`, `Infrastructure`, `Presentation.API`. |
| Pruebas unitarias | Proyecto de pruebas con xUnit y Moq para la capa Application. |
