# Inventario de emojis sustituidos por SVG

Revisión del repositorio: 202 apariciones en 18 archivos. Frontend: 29; pruebas: 7; documentación: 166.

Se incluyen también los símbolos de enlace externo, descarga y confirmación usados como iconos. Las ubicaciones corresponden al código anterior a la sustitución. Los símbolos legales de copyright, marca registrada y marca comercial permanecen como texto.

Los componentes usan `Icono.jsx`, con trazos propios y un catálogo complementario en `src/frontend/src/assets/iconos.json`, color heredado y SVG ocultos a lectores de pantalla cuando acompañan texto. La documentación usa los SVG de `src/frontend/public/iconos/` con texto alternativo. Las pruebas buscan los nombres de las acciones sin depender del dibujo. Este inventario conserva las ubicaciones de la sustitución original; el PR también conserva las funciones incorporadas después en `master`.

| Código Unicode original | SVG | Apariciones |
| :--- | :--- | ---: |
| U+1F310 | ![mundo](../src/frontend/public/iconos/mundo.svg) `mundo` | 8 |
| U+1F511 | ![llave](../src/frontend/public/iconos/llave.svg) `llave` | 4 |
| U+1F6D2 | ![carrito](../src/frontend/public/iconos/carrito.svg) `carrito` | 5 |
| U+1F9FE | ![recibo](../src/frontend/public/iconos/recibo.svg) `recibo` | 18 |
| U+1F69A | ![camion](../src/frontend/public/iconos/camion.svg) `camion` | 5 |
| U+1F454 | ![personal](../src/frontend/public/iconos/personal.svg) `personal` | 27 |
| U+2705 | ![correcto](../src/frontend/public/iconos/correcto.svg) `correcto` | 102 |
| U+274C | ![cerrar](../src/frontend/public/iconos/cerrar.svg) `cerrar` | 1 |
| U+23F1 | ![temporizador](../src/frontend/public/iconos/temporizador.svg) `temporizador` | 2 |
| U+2197 | ![enlace-externo](../src/frontend/public/iconos/enlace-externo.svg) `enlace-externo` | 1 |
| U+1F6CD U+FE0F | ![bolsa](../src/frontend/public/iconos/bolsa.svg) `bolsa` | 2 |
| U+1F9FA | ![cesta](../src/frontend/public/iconos/cesta.svg) `cesta` | 1 |
| U+26D4 | ![agotado](../src/frontend/public/iconos/agotado.svg) `agotado` | 6 |
| U+26A0 U+FE0F | ![advertencia](../src/frontend/public/iconos/advertencia.svg) `advertencia` | 4 |
| U+1F514 | ![campana](../src/frontend/public/iconos/campana.svg) `campana` | 2 |
| U+2B07 | ![descargar](../src/frontend/public/iconos/descargar.svg) `descargar` | 5 |
| U+1F4E6 | ![paquete](../src/frontend/public/iconos/paquete.svg) `paquete` | 3 |
| U+1F44B | ![saludo](../src/frontend/public/iconos/saludo.svg) `saludo` | 1 |
| U+1F6F5 | ![moto](../src/frontend/public/iconos/moto.svg) `moto` | 1 |
| U+1F50E | ![buscar](../src/frontend/public/iconos/buscar.svg) `buscar` | 1 |
| U+1F951 | ![aguacate](../src/frontend/public/iconos/aguacate.svg) `aguacate` | 1 |
| U+1F35E | ![pan](../src/frontend/public/iconos/pan.svg) `pan` | 1 |
| U+2713 | ![correcto](../src/frontend/public/iconos/correcto.svg) `correcto` | 1 |

| Archivo original | Líneas originales | Sustituciones |
| :--- | :--- | ---: |
| [docs/API.md](../docs/API.md) | 15, 16, 17, 18, 19, 20, 28, 29, 30, 36, 37, 38, 39, 40, 46, 47, 48, 54, 55, 56, 57, 58, 64, 65, 66, 72, 73, 74, 80, 81, 82, 83, 84, 85, 86, 87, 88, 107, 108, 114, 120, 121, 122, 123, 124, 125, 131, 132, 133, 134, 140, 141, 142, 148, 149, 155, 156, 174, 182, 183, 184 | 63 |
| [docs/ARQUITECTURA.md](../docs/ARQUITECTURA.md) | 192, 193, 194, 195, 196 | 7 |
| [docs/REGLAS_NEGOCIO.md](../docs/REGLAS_NEGOCIO.md) | 13, 14, 15, 16, 17, 18, 19, 20 | 14 |
| [docs/evidencias/escenarios-seguridad.md](../docs/evidencias/escenarios-seguridad.md) | 17, 18, 19, 20, 21, 22, 23, 92, 93, 94, 136, 197, 198, 199, 234, 235, 236, 237, 272, 273, 274, 319, 320, 374, 375, 376, 377, 378 | 28 |
| [docs/evidencias/pruebas-xunit.md](../docs/evidencias/pruebas-xunit.md) | 17, 18, 19, 20, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98 | 54 |
| [src/frontend/src/components/ContadorExpiracion.jsx](../src/frontend/src/components/ContadorExpiracion.jsx) | 24 | 1 |
| [src/frontend/src/components/DetallePedido.jsx](../src/frontend/src/components/DetallePedido.jsx) | 104 | 1 |
| [src/frontend/src/components/TarjetaProducto.jsx](../src/frontend/src/components/TarjetaProducto.jsx) | 18 | 1 |
| [src/frontend/src/layouts/TiendaLayout.jsx](../src/frontend/src/layouts/TiendaLayout.jsx) | 42, 50, 98 | 3 |
| [src/frontend/src/pages/admin/PowerBIDashboard.jsx](../src/frontend/src/pages/admin/PowerBIDashboard.jsx) | 85, 90, 94, 98, 221, 446 | 6 |
| [src/frontend/src/pages/admin/PowerBIDashboard.test.jsx](../src/frontend/src/pages/admin/PowerBIDashboard.test.jsx) | 154, 293, 298, 306 | 4 |
| [src/frontend/src/pages/panel/Inventario.jsx](../src/frontend/src/pages/panel/Inventario.jsx) | 191, 195, 199 | 3 |
| [src/frontend/src/pages/panel/Inventario.test.jsx](../src/frontend/src/pages/panel/Inventario.test.jsx) | 61, 62, 63 | 3 |
| [src/frontend/src/pages/panel/Productos.jsx](../src/frontend/src/pages/panel/Productos.jsx) | 257 | 1 |
| [src/frontend/src/pages/panel/Resumen.jsx](../src/frontend/src/pages/panel/Resumen.jsx) | 16, 17, 18, 70, 127 | 5 |
| [src/frontend/src/pages/repartidor/Inicio.jsx](../src/frontend/src/pages/repartidor/Inicio.jsx) | 14 | 1 |
| [src/frontend/src/pages/tienda/Catalogo.jsx](../src/frontend/src/pages/tienda/Catalogo.jsx) | 89, 152 | 3 |
| [src/frontend/src/utils/stock.js](../src/frontend/src/utils/stock.js) | 4, 5, 6, 7 | 4 |
