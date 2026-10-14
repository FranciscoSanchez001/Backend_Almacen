# Evidencias — Docker Compose y CI/CD

[← Volver al README](../../README.md)

Ejecución real de la pila orquestada con [`docker-compose.yml`](../../docker-compose.yml) sobre Docker Desktop 29.8 (Windows 11), el 14/10/2026.

## 1. Levantar la pila

```bash
docker compose up -d --build
```

Orden de arranque que imponen los `depends_on`:

```
db (healthy: pg_isready) → migraciones (exited 0) → api (healthy: GET /health) → spa
```

## 2. Estado de salud (`docker ps`)

```
NAMES           IMAGE                 STATUS                        PORTS
almacen_api     backend_almacen-api   Up About a minute (healthy)   0.0.0.0:5000->5000/tcp, [::]:5000->5000/tcp
almacen_spa     backend_almacen-spa   Up 8 minutes (healthy)        0.0.0.0:8080->80/tcp, [::]:8080->80/tcp
postgres_db     postgres:15           Up 46 minutes (healthy)       0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
```

`docker compose ps -a` muestra además el servicio de migraciones, que aplica el esquema y termina:

```
SERVICE       STATE     STATUS
api           running   Up About a minute (healthy)
migraciones   exited    Exited (0) About a minute ago
spa           running   Up 8 minutes (healthy)
db            running   Up 46 minutes (healthy)
```

| Servicio | Healthcheck | Puerto |
| :--- | :--- | :--- |
| `db` | `pg_isready -U miusuario -d midatabase` | 5432 |
| `api` | `wget http://127.0.0.1:5000/health` → `Healthy` solo si hay conexión con PostgreSQL | 5000 |
| `spa` | `wget http://127.0.0.1/` sobre Nginx | 8080 |

```
$ curl http://localhost:5000/health
Healthy (HTTP 200)
```

## 3. Redes y volúmenes

```
$ docker network ls
backend_almacen_backend     # db, migraciones, api, postgrest
backend_almacen_frontend    # api, spa

$ docker volume ls
backend_almacen_postgres15_data   # datos de PostgreSQL 15
backend_almacen_capturas_pago     # capturas de pago subidas por los clientes
```

Verificaciones realizadas:

| Prueba | Resultado |
| :--- | :--- |
| Desde `almacen_spa`, conectar a `db:5432` | `nc: bad address 'db'`: la SPA no ve la base de datos |
| Desde `almacen_spa`, `GET http://api:5000/health` | `Healthy`: la SPA sí ve la API |
| Crear una categoría, `docker compose down`, `docker compose up -d` y consultarla | La categoría sigue en la base: el volumen persiste |
| `SELECT version()` | `PostgreSQL 15.19` |

## 4. Imágenes multietapa

| Imagen | Compilación | Final | Tamaño real | Comprimida |
| :--- | :--- | :--- | ---: | ---: |
| `backend_almacen-api` | `dotnet/sdk:10.0` | `dotnet/aspnet:10.0-alpine` | 155 MB | ~70 MB |
| `backend_almacen-spa` | `node:20-alpine` | `nginx:alpine` | 65 MB | ~25 MB |

`docker images` muestra 245 MB y 95 MB porque el almacén de containerd de Docker Desktop suma las capas comprimidas y descomprimidas. La justificación del tamaño de la API está en la sección 8 del [README](../../README.md#8-puesta-en-marcha-con-docker).

## 5. Pipeline CI/CD (GitHub Actions)

Workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), disparado con cada `push` y `pull_request` a `master`.

| Job | Pasos |
| :--- | :--- |
| `backend-ci` | `dotnet restore` → `dotnet build -c Release` → pruebas unitarias (xUnit + Moq), de arquitectura y de integración (Testcontainers + PostgreSQL 15) → reportes `.trx` como artefacto |
| `frontend-ci` | `npm ci` → `npm test` (Vitest) → `npm run build` |
| `publicar` | Solo si los dos anteriores pasan (`needs`): `dotnet publish` de la API y build de la SPA, subidos como artefactos `api-publicada` y `spa-dist` |

> **Pendiente:** captura de la ejecución en verde en la pestaña *Actions* del repositorio, tras el primer push del workflow.
