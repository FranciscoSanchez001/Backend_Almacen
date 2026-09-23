# Backend_Almacen

Backend del e-commerce del supermercado: ASP.NET Core 10 + EF Core 10 (Code-First) sobre PostgreSQL.

## Estructura de la solución

| Proyecto | Contenido |
|---|---|
| `Domain` | Entidades (claves UUID), enums y reglas de negocio puras (transiciones de estado del pedido, teléfonos venezolanos). Sin dependencias externas. |
| `Application` | Casos de uso (`PedidosService`, `InventarioService`, …) y contratos: interfaces de repositorios, `IUnitOfWork`, almacenamiento de archivos. No conoce EF Core. |
| `Infrastructure` | Persistencia: `ApplicationDbContext`, una `IEntityTypeConfiguration<T>` por entidad (`Persistencia/Configuraciones`), migraciones, repositorios con `.AsNoTracking()` en las lecturas y datos semilla. También Cloudinary, el envío de WhatsApp y el job de expiración. |
| `WebAPI` | Controladores, DTOs, autenticación JWT / Google y `Program.cs`. |

Dependencias: `WebAPI → Application, Infrastructure`; `Infrastructure → Application → Domain`.

## Base de datos

```bash
docker compose up -d                       # PostgreSQL + PostgREST
dotnet tool restore
dotnet ef database update --project Infrastructure --startup-project WebAPI
```

- Nueva migración: `dotnet ef migrations add <Nombre> --project Infrastructure --startup-project WebAPI --output-dir Persistencia/Migraciones`
- Script SQL: `database/InitialCreate.sql` (se regenera con `dotnet ef migrations script --project Infrastructure --startup-project WebAPI --idempotent -o database/InitialCreate.sql`).

### Datos semilla

- En la migración (`HasData`, ver `Infrastructure/Persistencia/Semillas/DatosSemilla.cs`): 4 categorías, 11 productos con SKU, precio, costo y stock, y 5 zonas de entrega de San Cristóbal.
- Al arrancar la API (`InicializadorBaseDatos`): la fila de configuración y el superadmin inicial de la sección `SuperadminInicial` de la configuración (en desarrollo: `gerente@almacen.local` / `Cambiar123!`).

## Ejecutar la API

```bash
dotnet run --project WebAPI                # http://localhost:5085
docker build -f WebAPI/Dockerfile -t backend-almacen .
```

Ejemplos de llamadas en `WebAPI/Backend_Almacen.WebAPI.http`.
