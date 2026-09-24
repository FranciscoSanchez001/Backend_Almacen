# Gestión del Proyecto

[← Volver al README](../README.md)

## 1. Metodología

El proyecto se desarrolla con **Scrum**. El trabajo se organiza en **Jira** (proyecto `SCRUM`) con la jerarquía:

**Épica → Historia de usuario / Tarea técnica → Subtarea**

- Las **historias de usuario** siguen el formato *"Como [rol], quiero [acción] para [beneficio]"* e incluyen criterios de aceptación.
- Las **subtareas** se dividen por capa de la arquitectura (Dominio, Aplicación, Infraestructura, API y Pruebas).
- La estimación se hace en **puntos de historia** (escala de Fibonacci).

---

## 2. Épicas

| Épica | Alcance |
| :--- | :--- |
| E1 · Arquitectura base | Solución Onion, EF Core con PostgreSQL, infraestructura transversal de la API y Docker |
| E2 · Autenticación y usuarios | Inicio de sesión con Google y con contraseña, roles y gestión del personal |
| E3 · Catálogo y productos | Categorías, productos, borrado lógico, catálogo público e inicio personalizado |
| E4 · Inventario | Reserva, confirmación y liberación de stock, reposición y notificaciones |
| E5 · Pedidos y checkout | Creación, máquina de estados, bandeja, aprobación y rechazo |
| E6 · Entrega | Pedidos del repartidor, "en camino" y "entregado" |
| E7 · Expiración automática | Liberación del stock de pedidos no revisados en 5 horas |
| E8 · WhatsApp | Microservicio con Baileys y envío de mensajes por plantilla |
| E9 · Auditoría | Registro y consulta de cambios |
| E10 · Configuración | Tasa del día, zonas, datos de pago y parámetros |
| E11 · KPIs | Indicadores de ventas, productos, pagos, horas pico, zonas, inventario y operación |
| E12 · Informe en Excel | Descarga del informe diario, semanal, mensual o personalizado |

---

## 3. Trabajo en Paralelo por Carriles

Para que el equipo avance en paralelo sin bloquearse, el trabajo se divide en tres carriles independientes, identificados con etiquetas en Jira. Antes de arrancar, la tarea **T0 · Definir contratos compartidos** fija las entidades, interfaces, DTOs y el esquema de la base de datos, de modo que cada carril programa contra esas interfaces.

| Carril | Etiqueta | Contenido |
| :--- | :--- | :--- |
| A · Plataforma y seguridad | `carril-a` | Solución Onion, Docker, autenticación, roles, usuarios, auditoría, configuración y WhatsApp |
| B · Catálogo, inventario y pedidos | `carril-b` | Base de datos, categorías, productos, catálogo, reserva de stock, creación de pedidos, máquina de estados y aprobación |
| C · Operación y analítica | `carril-c` | Bandeja, rechazo, historial, repartidor, expiración, inicio personalizado, KPIs e informe en Excel |

---

## 4. Flujo de Trabajo con Git

- La rama principal es `master`.
- Antes de empezar a trabajar: `git pull` para traer los cambios del equipo.
- Si los cambios traen una migración nueva, actualizar la base de datos local:

```bash
dotnet ef database update --project Infrastructure --startup-project WebAPI
```

### Convención de commits (recomendada)

Mensajes en español, con un prefijo que indique el tipo de cambio:

| Prefijo | Uso | Ejemplo |
| :--- | :--- | :--- |
| `feat:` | Nueva funcionalidad | `feat: agregar endpoint de reposición de stock` |
| `fix:` | Corrección de un error | `fix: liberar stock al expirar pedidos` |
| `docs:` | Documentación | `docs: documentar endpoints de pedidos` |
| `refactor:` | Cambio de código sin alterar el comportamiento | `refactor: extraer BaseEntity en el dominio` |
| `test:` | Pruebas | `test: pruebas de transiciones de pedido` |
| `chore:` | Configuración, dependencias, herramientas | `chore: actualizar paquetes de EF Core` |

Cada commit debe describir **qué** cambió; se evitan mensajes genéricos como "cambios" o "yaml".
