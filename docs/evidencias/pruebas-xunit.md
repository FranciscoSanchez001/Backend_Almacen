# Evidencias — Reporte de ejecución del Test Runner de xUnit

[← Volver al README](../../src/backend/README.md#11-pruebas-de-la-api)

Resultado real de ejecutar todas las pruebas de la solución con el Test Runner de xUnit (`xunit.runner.visualstudio` sobre VSTest) desde la línea de comandos. Comando:

```bash
dotnet test src/backend/Backend_Almacen.slnx --logger "console;verbosity=detailed" --logger "trx;LogFilePrefix=resultados" --results-directory docs/evidencias/pruebas
```

Fecha de ejecución: **2026-10-07 00:03 UTC**. Entorno: .NET 10.0.12, xUnit 2.9.3, xUnit.net VSTest Adapter 3.1.4, Moq 4.20.72, NetArchTest.Rules 1.3.2, Testcontainers 4.15.0 (PostgreSQL 16 en Docker).

## Resumen

| Proyecto | Tipo | Total | Passed | Failed | Duración |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `UnitTests` | Pruebas unitarias | 17 | 17 ✅ | 0 | 23.4 s |
| `ArchitectureTests` | Pruebas de arquitectura | 13 | 13 ✅ | 0 | 17.8 s |
| `IntegrationTests` | Pruebas de integración | 20 | 20 ✅ | 0 | 194.1 s |
| **Total** | | **50** | **50 ✅** | **0** | |

**Resultado: 50 de 50 pruebas en estado Passed, 0 fallos.**

Archivos de la ejecución:

- [`ejecucion-xunit.txt`](pruebas/ejecucion-xunit.txt): salida de consola del Test Runner, con una línea `Passed` por prueba y el resumen `Test Run Successful` de cada proyecto. Se quitaron los logs que imprime la API durante las pruebas de integración (consultas de EF Core) y las rutas locales.
- [`UnitTests.trx`](pruebas/UnitTests.trx), [`ArchitectureTests.trx`](pruebas/ArchitectureTests.trx) y [`IntegrationTests.trx`](pruebas/IntegrationTests.trx): resultados en formato TRX (Visual Studio Test Results); se abren en Visual Studio o en el Explorador de pruebas.

## Pruebas unitarias (xUnit + Moq)

`tests/UnitTests`: ProductoService con sus repositorios simulados con Moq. **17/17 Passed.**

| # | Clase | Prueba | Resultado | Duración |
| :---: | :--- | :--- | :---: | ---: |
| 1 | `ProductoServiceTests` | `ActualizarAsync_ConCambios_ActualizaGuardaYAuditaElAntesYDespues` | ✅ Passed | 160 ms |
| 2 | `ProductoServiceTests` | `ActualizarAsync_ProductoInexistente_LanzaKeyNotFound` | ✅ Passed | 29 ms |
| 3 | `ProductoServiceTests` | `ActualizarAsync_SinCambios_NoGuardaNiAudita` | ✅ Passed | 21 ms |
| 4 | `ProductoServiceTests` | `ActualizarAsync_SkuDeOtroProducto_LanzaConflictoExcluyendoAlPropioProducto` | ✅ Passed | 37 ms |
| 5 | `ProductoServiceTests` | `ActualizarAsync_StockACero_AvisaQueElProductoSeAgoto` | ✅ Passed | 68 ms |
| 6 | `ProductoServiceTests` | `ActualizarAsync_StockCambioMientrasSeEditaba_LanzaConflictoSinGuardar` | ✅ Passed | 59 ms |
| 7 | `ProductoServiceTests` | `ActualizarAsync_StockDistinto_AjustaElInventarioYRegistraElMovimiento` | ✅ Passed | 34 ms |
| 8 | `ProductoServiceTests` | `ActualizarAsync_StockIgualAlActual_NoAjustaElInventario` | ✅ Passed | 53 ms |
| 9 | `ProductoServiceTests` | `ActualizarAsync_StockReponeUnProductoAgotado_ResuelveElAviso` | ✅ Passed | 41 ms |
| 10 | `ProductoServiceTests` | `BorrarAsync_ProductoExistente_LoDesactivaYAuditaElBorrado` | ✅ Passed | 548 ms |
| 11 | `ProductoServiceTests` | `BorrarAsync_ProductoInexistente_LanzaKeyNotFound` | ✅ Passed | 26 ms |
| 12 | `ProductoServiceTests` | `CrearAsync_CategoriaInexistente_LanzaInvalidOperationSinGuardarNada` | ✅ Passed | 5.47 s |
| 13 | `ProductoServiceTests` | `CrearAsync_ConStockInicial_RegistraUnaReposicionDesdeCero` | ✅ Passed | 50 ms |
| 14 | `ProductoServiceTests` | `CrearAsync_DatosValidos_GuardaElProductoNormalizadoDentroDeUnaTransaccion` | ✅ Passed | 76 ms |
| 15 | `ProductoServiceTests` | `CrearAsync_RegistraAuditoriaDeCreacionSinDatosAnteriores` | ✅ Passed | 25 ms |
| 16 | `ProductoServiceTests` | `CrearAsync_SinStockInicial_NoRegistraMovimientos` | ✅ Passed | 16 ms |
| 17 | `ProductoServiceTests` | `CrearAsync_SkuEnUso_LanzaConflictoSinGuardarNada` | ✅ Passed | 68 ms |

## Pruebas de arquitectura (NetArchTest.Rules)

`tests/ArchitectureTests`: Regla de dependencia entre capas y convenciones. **13/13 Passed.**

| # | Clase | Prueba | Resultado | Duración |
| :---: | :--- | :--- | :---: | ---: |
| 1 | `ConvencionesTests` | `ContratosDeRepositorio_SonInterfacesDeAplicacion` | ✅ Passed | 7 ms |
| 2 | `ConvencionesTests` | `Controladores_SoloEstanEnSuEspacioDeNombres` | ✅ Passed | 603 ms |
| 3 | `ConvencionesTests` | `Controladores_TerminanEnControllerYHeredanDeControllerBase` | ✅ Passed | 3.89 s |
| 4 | `ConvencionesTests` | `Entidades_HeredanDeBaseEntity` | ✅ Passed | 7 ms |
| 5 | `ConvencionesTests` | `InterfacesDeAplicacion_EmpiezanConI` | ✅ Passed | 9 ms |
| 6 | `ConvencionesTests` | `Repositorios_EstanEnPersistenciaYSonClasesConcretas` | ✅ Passed | 8 ms |
| 7 | `ConvencionesTests` | `Validadores_TerminanEnValidator` | ✅ Passed | 643 ms |
| 8 | `DependenciasEntreCapasTests` | `Aplicacion_NoDependeDeEfCoreNiDeAspNetCore` | ✅ Passed | 3.97 s |
| 9 | `DependenciasEntreCapasTests` | `Aplicacion_NoDependeDeInfraestructuraNiDePresentacion` | ✅ Passed | 402 ms |
| 10 | `DependenciasEntreCapasTests` | `Controladores_NoDependenDeInfraestructuraNiDeEfCore` | ✅ Passed | 153 ms |
| 11 | `DependenciasEntreCapasTests` | `Dominio_NoDependeDeFrameworksExternos` | ✅ Passed | 73 ms |
| 12 | `DependenciasEntreCapasTests` | `Dominio_NoDependeDeNingunaOtraCapa` | ✅ Passed | 33 ms |
| 13 | `DependenciasEntreCapasTests` | `Infraestructura_NoDependeDePresentacion` | ✅ Passed | 703 ms |

## Pruebas de integración (WebApplicationFactory + Testcontainers)

`tests/IntegrationTests`: API completa contra PostgreSQL 16 en Docker. **20/20 Passed.**

| # | Clase | Prueba | Resultado | Duración |
| :---: | :--- | :--- | :---: | ---: |
| 1 | `AutenticacionTests` | `Login_ContrasenaIncorrecta_Devuelve401ConProblemDetails` | ✅ Passed | 1.44 s |
| 2 | `AutenticacionTests` | `Login_SuperadminInicial_DevuelveJwtYRefreshToken` | ✅ Passed | 1.04 s |
| 3 | `AutenticacionTests` | `Refresh_RotaElTokenYRechazaReutilizarElAnterior` | ✅ Passed | 1.59 s |
| 4 | `AutenticacionTests` | `Yo_ConToken_DevuelveElUsuarioDeLaSesion` | ✅ Passed | 1.46 s |
| 5 | `ProductosTests` | `Actualizar_ConOtroStock_RegistraUnAjusteEnElInventario` | ✅ Passed | 2.93 s |
| 6 | `ProductosTests` | `Actualizar_ProductoInexistente_Devuelve404` | ✅ Passed | 4.69 s |
| 7 | `ProductosTests` | `Borrar_ComoAdmin_EsUnBorradoLogicoQueLoSacaDeLaTienda` | ✅ Passed | 3.75 s |
| 8 | `ProductosTests` | `Catalogo_SinStock_NoMuestraElProducto` | ✅ Passed | 2.24 s |
| 9 | `ProductosTests` | `Crear_CategoriaInexistente_Devuelve400` | ✅ Passed | 1.21 s |
| 10 | `ProductosTests` | `Crear_Devuelve201ConLocationYGuardaMovimientoYAuditoria` | ✅ Passed | 1.85 s |
| 11 | `ProductosTests` | `Crear_PrecioNegativo_Devuelve400ConElErrorDelCampo` | ✅ Passed | 2.06 s |
| 12 | `ProductosTests` | `Crear_SkuRepetido_Devuelve409` | ✅ Passed | 1.17 s |
| 13 | `SeguridadTests` | `Categorias_ListadoPublico_NoExigeToken` | ✅ Passed | 339 ms |
| 14 | `SeguridadTests` | `Productos_SinToken_Devuelve401ConEncabezadoBearer` | ✅ Passed | 78 ms |
| 15 | `SeguridadTests` | `Productos_TokenInvalido_Devuelve401` | ✅ Passed | 57 ms |
| 16 | `SeguridadTests` | `UsuarioDesactivado_PierdeElAccesoConSuTokenVigente` | ✅ Passed | 52.42 s |
| 17 | `SeguridadTests` | `Ventas_NoPuedeBorrarProductos_Devuelve403YElProductoSigueActivo` | ✅ Passed | 15.94 s |
| 18 | `SeguridadTests` | `Ventas_NoPuedeCrearCategorias_Devuelve403` | ✅ Passed | 3.91 s |
| 19 | `SeguridadTests` | `Ventas_NoPuedeGestionarUsuarios_Devuelve403` | ✅ Passed | 4.76 s |
| 20 | `SeguridadTests` | `Ventas_PuedeConsultarProductos` | ✅ Passed | 11.20 s |

## Salida de consola (extracto)

Resumen que imprime el Test Runner al terminar cada proyecto:

```text
Test run for tests\UnitTests\bin\Debug\net10.0\UnitTests.dll (.NETCoreApp,Version=v10.0)
Test Run Successful.
Total tests: 17
     Passed: 17
 Total time: 23.3135 Seconds
Test run for tests\ArchitectureTests\bin\Debug\net10.0\ArchitectureTests.dll (.NETCoreApp,Version=v10.0)
Test run for tests\IntegrationTests\bin\Debug\net10.0\IntegrationTests.dll (.NETCoreApp,Version=v10.0)
Test Run Successful.
Total tests: 13
     Passed: 13
 Total time: 17.7330 Seconds
Test Run Successful.
Total tests: 20
     Passed: 20
 Total time: 3.2327 Minutes
```
