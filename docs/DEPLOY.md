# Despliegue en la nube

[← Volver al README](../README.md)

La aplicación se despliega en tres servicios con plan gratuito o de prueba:

| Pieza | Servicio | Qué se despliega |
| :--- | :--- | :--- |
| Base de datos | [Neon](https://neon.com) | PostgreSQL 15 serverless |
| API REST | [Railway](https://railway.com) | La imagen Docker de [`Presentation.APIfeat(deploy): despliegue en Railway (API), Vercel (SPA) y Neon (PostgreSQL)

- La API aplica las migraciones pendientes al arrancar con
  BaseDatos:AplicarMigraciones=true (en la nube no existe el contenedor de
  migraciones de docker-compose). Si una migración falla, la API no arranca
  y el healthcheck impide publicar la versión rota.
- La API escucha en el puerto de la variable PORT cuando existe (Railway,
  Render); si no, sigue usando ASPNETCORE_HTTP_PORTS (5000).
- src/backend/railway.json: build con Presentation.API/Dockerfile,
  healthcheck en /health y reinicio ante fal
- src/frontend/vercel.json: build de Vite y rewrite a index.html para las
  rutas de React Router.
- package.json: engines node 24.x, la misma versión del pipeline de CI.
- docs/DEPLOY.md: guía paso a paso (Neon, Ra
  entorno, siembra de demostración, CORS, Google OAuth, entrega continua y
  problemas frecuentes. Enlazada desde el RE

Verificado en local simulando producción: Po
Production con las variables de Railway (migraciones, superadmin, /health,
login y CORS) y las 100 pruebas del backend/Dockerfile`](../src/backend/Presentation.API/Dockerfile) |
| SPA | [Vercel](https://vercel.com) | El `dist/` de Vite, servido desde su CDN |

```
Navegador ──HTTPS──► Vercel (SPA React)
    │
    └──────HTTPS──► Railway (API .NET 10, GET /health) ──SSL──► Neon (PostgreSQL 15)
```

Los tres se conectan al repositorio de GitHub y despliegan solos con cada push a `master`. Railway puede esperar a que el pipeline de GitHub Actions termine en verde (paso 3.5).

> **Orden:** Neon → Railway → Vercel → volver a Railway para CORS. Cada paso necesita una URL del anterior.

Archivos de configuración incluidos en el repositorio:

| Archivo | Para qué |
| :--- | :--- |
| [`src/backend/railway.json`](../src/backend/railway.json) | Construir con el Dockerfile, healthcheck en `/health` y reinicio ante fallos |
| [`src/frontend/vercel.json`](../src/frontend/vercel.json) | Build de Vite y redirección de todas las rutas a `index.html` (rutas de React Router) |

---

## 1. Base de datos en Neon

1. Crear una cuenta en <https://console.neon.tech> e ir a **New project**.
2. **Postgres version: 15**. Para la región, elegir la misma zona que Railway (por ejemplo, *AWS US East* si Railway queda en *US East*), para que la latencia entre la API y la base sea mínima.
3. En **Connect**, desactivar **Connection pooling**: hace falta la conexión directa, porque las migraciones de EF Core no funcionan bien a través de PgBouncer. Copiar los datos de conexión.
4. Neon da una URI `postgresql://usuario:clave@host/neondb?sslmode=require`. **Npgsql no acepta ese formato**: hay que convertirla así:

```
Host=ep-xxxx-xxxx.us-east-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=CLAVE;SSL Mode=Require
```

No hace falta crear las tablas a mano: la API aplica las migraciones al arrancar (paso 3).

### 1.1 Datos de demostración (opcional)

La siembra de demostración (90 días de pedidos, clientes y personal) solo se ejecuta en modo `Development`, para que nunca se active por error en producción. Para cargarla en Neon se arranca la API **una vez desde tu PC** apuntando a Neon. Desde la raíz del repositorio, en PowerShell:

```powershell
$env:ConnectionStrings__Almacen = "Host=ep-xxxx.us-east-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=CLAVE;SSL Mode=Require"
$env:BaseDatos__AplicarMigraciones = "true"
$env:SiembraDemo__Habilitada = "true"
# La misma contraseña que pondrás en Railway: el superadmin se crea solo la primera vez.
$env:SuperadminInicial__Password = "UNA-CONTRASEÑA-SEGURA"
dotnet run --project src/backend/Presentation.API --launch-profile http
```

Cuando el log diga `Siembra de demostración completada`, detener con `Ctrl+C` y cerrar esa terminal (las variables solo existen en ella). La siembra no se repite: si la base ya tiene pedidos, no hace nada.

---

## 2. Generar la clave JWT

La API firma los tokens con `Jwt:Key`, que debe tener al menos 32 caracteres y **no** puede ser la de desarrollo:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Guardarla solo en las variables de Railway; nunca en el repositorio.

---

## 3. API en Railway

1. En <https://railway.com>: **New Project → Deploy from GitHub repo** y elegir `Backend_Almacen`.
2. En el servicio creado, **Settings → Source → Root Directory: `src/backend`**. Railway lee entonces [`railway.json`](../src/backend/railway.json): construye con `Presentation.API/Dockerfile` y usa `/health` como healthcheck.
3. En **Variables**, agregar:

| Variable | Valor | Para qué |
| :--- | :--- | :--- |
| `ConnectionStrings__Almacen` | La cadena de Neon del paso 1 | Conexión a PostgreSQL |
| `Jwt__Key` | La clave del paso 2 | Firma de los tokens |
| `BaseDatos__AplicarMigraciones` | `true` | Aplica las migraciones pendientes al arrancar |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | `true` | Railway pone un proxy delante: así la API ve la IP real del cliente (límite de peticiones de analítica) y sabe que la conexión es HTTPS |
| `SuperadminInicial__Nombre` | `Gerente` | Primer superadmin (solo se crea si no existe ninguno) |
| `SuperadminInicial__Email` | Tu correo de administrador | |
| `SuperadminInicial__Password` | Una contraseña segura | |
| `Cors__OrigenesPermitidos__0` | Se completa en el paso 5 | Dominio de Vercel |

   No hace falta definir `PORT` ni `ASPNETCORE_ENVIRONMENT`: Railway asigna `PORT` y la API escucha en él, y sin variable el entorno es `Production`.

4. **Settings → Networking → Generate Domain**. Railway da una URL como `https://backend-almacen-production.up.railway.app`. Comprobar que <https://…up.railway.app/health> responde `Healthy`.
5. **Settings → Deploy → Wait for CI** (activar): Railway solo despliega un commit de `master` cuando el pipeline de GitHub Actions termina en verde.

**Opcional, capturas de pago:** el disco de Railway se borra en cada despliegue, así que los comprobantes que suben los clientes se perderían. Con una cuenta gratuita de [Cloudinary](https://cloudinary.com) se guardan allí; basta agregar `Cloudinary__CloudName`, `Cloudinary__ApiKey` y `Cloudinary__ApiSecret`.

---

## 4. SPA en Vercel

1. En <https://vercel.com>: **Add New → Project** e importar `Backend_Almacen`.
2. **Root Directory: `src/frontend`**. Vercel detecta Vite y lee [`vercel.json`](../src/frontend/vercel.json). La versión de Node (24) sale de `engines` en `package.json`.
3. En **Environment Variables**:

| Variable | Valor |
| :--- | :--- |
| `VITE_API_URL` | La URL de Railway, **sin** barra final: `https://backend-almacen-production.up.railway.app` |
| `VITE_GOOGLE_CLIENT_ID` | El mismo valor de `Google:ClientId` en [`appsettings.json`](../src/backend/Presentation.API/appsettings.json) |

   Vite incrusta estas variables al compilar: si cambian, hay que volver a desplegar (**Deployments → Redeploy**).

4. **Deploy**. Vercel da una URL como `https://backend-almacen.vercel.app`.

---

## 5. Cerrar el circuito

1. **CORS:** en Railway, poner en `Cors__OrigenesPermitidos__0` la URL de Vercel, **sin** barra final. Railway redespliega solo.
2. **Login con Google:** en [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → el ID de cliente OAuth → **Orígenes autorizados de JavaScript**, agregar la URL de Vercel.

---

## 6. Verificación

| Prueba | Resultado esperado |
| :--- | :--- |
| `https://<api>.up.railway.app/health` | `Healthy` |
| `https://<spa>.vercel.app` | Catálogo de la tienda con productos e imágenes |
| `https://<spa>.vercel.app/internal-login` con el superadmin | Entra al dashboard KPI con datos (si se hizo el paso 1.1) |
| Recargar la página estando en `/admin` | Sigue en `/admin` (no da 404: lo resuelve el `rewrite` de `vercel.json`) |
| Railway → **Deploy Logs** | `Now listening on: http://[::]:<PORT>` y, en el primer despliegue, `Aplicando 6 migraciones` |

> En el primer arranque contra la base vacía, EF Core registra un `fail` al leer `__EFMigrationsHistory` antes de crearla. Es esperado: la tabla todavía no existe y EF la crea a continuación.

---

## 7. Flujo de entrega continua

```
git push a master
   ├─► GitHub Actions (ci.yml): pruebas backend + frontend → publicar artefactos
   │        └─ en verde ─► Railway reconstruye la imagen, aplica migraciones y cambia de versión
   │                       solo cuando /health responde (si falla, sigue la versión anterior)
   └─► Vercel compila la SPA y la publica
```

Los pull requests también generan una *preview* en Vercel con otra URL. Esa URL no está en CORS, así que la preview carga, pero no puede hablar con la API de producción.

---

## 8. Problemas frecuentes

| Síntoma | Causa y solución |
| :--- | :--- |
| El navegador muestra `CORS error` | `Cors__OrigenesPermitidos__0` no coincide exactamente con la URL de Vercel (revisar `https://` y que no tenga `/` final). |
| La SPA llama a `localhost:5000` | Falta `VITE_API_URL` en Vercel o se agregó después del build: hacer **Redeploy**. |
| Railway: `Healthcheck failed` | Ver **Deploy Logs**. Lo más común: cadena de conexión con formato URI en vez de `Host=…;`, o `Jwt__Key` con menos de 32 caracteres. |
| Railway: `Dockerfile not found` | Root Directory distinto de `src/backend`. Alternativa: variable `RAILWAY_DOCKERFILE_PATH=Presentation.API/Dockerfile`. |
| Login con Google: `origin_mismatch` | Falta la URL de Vercel en los orígenes autorizados (paso 5.2). |
| La primera petición tarda unos segundos | Neon suspende la base tras 5 minutos sin uso y la reactiva en la primera consulta. |
| Desaparecen los comprobantes de pago | Falta configurar Cloudinary (paso 3, opcional). |
