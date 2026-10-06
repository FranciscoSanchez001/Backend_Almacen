using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Core.Application.Dtos;
using Core.Application.Servicios;
using Core.Domain.Enums;
using IntegrationTests.Infraestructura;
using Microsoft.EntityFrameworkCore;
using Presentation.API.Dtos;

namespace IntegrationTests
{
    // Ciclo de vida de un producto por HTTP, comprobando también lo que queda en PostgreSQL:
    // movimientos de inventario, auditoría y borrado lógico.
    public class ProductosTests(ApiFactory api) : ApiTestBase(api)
    {
        [Fact]
        public async Task Crear_Devuelve201ConLocationYGuardaMovimientoYAuditoria()
        {
            var admin = await ComoAdminAsync();
            var categoriaId = await CrearCategoriaAsync(admin);
            var sku = $"pru-{Unico()}";

            var respuesta = await admin.PostAsJsonAsync("/productos", NuevoProducto(categoriaId, sku, stockInicial: 20));

            await EsperarAsync(respuesta, HttpStatusCode.Created);
            var producto = await LeerAsync<ProductoResponse>(respuesta);
            Assert.Equal(sku.ToUpperInvariant(), producto.CodigoSku);
            Assert.Equal(20, producto.StockDisponible);
            Assert.EndsWith($"/productos/{producto.Id}", respuesta.Headers.Location?.ToString(), StringComparison.OrdinalIgnoreCase);

            var movimiento = await Api.ConsultarAsync(db =>
                db.MovimientosInventario.SingleAsync(m => m.ProductoId == producto.Id));
            Assert.Equal(TipoMovimientoInventario.Reposicion, movimiento.Tipo);
            Assert.Equal(0, movimiento.DisponibleAntes);
            Assert.Equal(20, movimiento.DisponibleDespues);

            var auditoria = await Api.ConsultarAsync(db =>
                db.Auditoria.SingleAsync(a => a.EntidadId == producto.Id));
            Assert.Equal(Entidades.Producto, auditoria.Entidad);
            Assert.Equal(AccionAuditoria.Crear, auditoria.Accion);
        }

        [Fact]
        public async Task Crear_SkuRepetido_Devuelve409()
        {
            var admin = await ComoAdminAsync();
            var categoriaId = await CrearCategoriaAsync(admin);
            var sku = $"PRU-{Unico()}";
            await EsperarAsync(await admin.PostAsJsonAsync("/productos", NuevoProducto(categoriaId, sku)),
                HttpStatusCode.Created);

            var respuesta = await admin.PostAsJsonAsync("/productos", NuevoProducto(categoriaId, sku.ToLowerInvariant()));

            Assert.Equal(HttpStatusCode.Conflict, respuesta.StatusCode);
            Assert.Equal("application/problem+json", respuesta.Content.Headers.ContentType?.MediaType);
        }

        [Fact]
        public async Task Crear_PrecioNegativo_Devuelve400ConElErrorDelCampo()
        {
            var admin = await ComoAdminAsync();
            var categoriaId = await CrearCategoriaAsync(admin);

            var respuesta = await admin.PostAsJsonAsync("/productos", NuevoProducto(categoriaId, precio: -5m));

            Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
            var problema = await LeerAsync<JsonElement>(respuesta);
            var errores = problema.GetProperty("errors").GetProperty("precioUsd");
            Assert.Equal("El precio debe ser mayor que 0.", errores[0].GetString());
        }

        [Fact]
        public async Task Crear_CategoriaInexistente_Devuelve400()
        {
            var admin = await ComoAdminAsync();

            var respuesta = await admin.PostAsJsonAsync("/productos", NuevoProducto(Guid.NewGuid()));

            Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        }

        [Fact]
        public async Task Actualizar_ConOtroStock_RegistraUnAjusteEnElInventario()
        {
            var admin = await ComoAdminAsync();
            var categoriaId = await CrearCategoriaAsync(admin);
            var creado = await LeerAsync<ProductoResponse>(
                await admin.PostAsJsonAsync("/productos", NuevoProducto(categoriaId, stockInicial: 20)));
            var cambios = new ActualizarProductoRequest(creado.CodigoSku, "Harina de maíz blanca", creado.Descripcion,
                3m, 1.75m, null, categoriaId, StockDisponible: 12, 5, 100, "P1-E1", "paquete");

            var respuesta = await admin.PutAsJsonAsync($"/productos/{creado.Id}", cambios);

            await EsperarAsync(respuesta, HttpStatusCode.OK);
            var actualizado = await LeerAsync<ProductoResponse>(respuesta);
            Assert.Equal("Harina de maíz blanca", actualizado.Nombre);
            Assert.Equal(3m, actualizado.PrecioUsd);
            Assert.Equal(12, actualizado.StockDisponible);

            var ajuste = await Api.ConsultarAsync(db => db.MovimientosInventario
                .SingleAsync(m => m.ProductoId == creado.Id && m.Tipo == TipoMovimientoInventario.Ajuste));
            Assert.Equal(-8, ajuste.Cantidad);
            Assert.Equal(20, ajuste.DisponibleAntes);
            Assert.Equal(12, ajuste.DisponibleDespues);
        }

        [Fact]
        public async Task Actualizar_ProductoInexistente_Devuelve404()
        {
            var admin = await ComoAdminAsync();
            var categoriaId = await CrearCategoriaAsync(admin);
            var cambios = new ActualizarProductoRequest($"PRU-{Unico()}", "No existe", null, 1m, 1m, null,
                categoriaId, null);

            var respuesta = await admin.PutAsJsonAsync($"/productos/{Guid.NewGuid()}", cambios);

            Assert.Equal(HttpStatusCode.NotFound, respuesta.StatusCode);
        }

        [Fact]
        public async Task Borrar_ComoAdmin_EsUnBorradoLogicoQueLoSacaDeLaTienda()
        {
            var admin = await ComoAdminAsync();
            var categoriaId = await CrearCategoriaAsync(admin);
            var creado = await LeerAsync<ProductoResponse>(
                await admin.PostAsJsonAsync("/productos", NuevoProducto(categoriaId)));
            await EsperarAsync(await Anonimo().GetAsync($"/catalogo/{creado.Id}"), HttpStatusCode.OK);

            var respuesta = await admin.DeleteAsync($"/productos/{creado.Id}");

            Assert.Equal(HttpStatusCode.NoContent, respuesta.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await Anonimo().GetAsync($"/catalogo/{creado.Id}")).StatusCode);

            // La fila sigue en la base, inactiva: pedidos, movimientos y auditoría la referencian.
            var producto = await Api.ConsultarAsync(db => db.Productos.SingleAsync(p => p.Id == creado.Id));
            Assert.False(producto.Activo);
            var borrado = await Api.ConsultarAsync(db =>
                db.Auditoria.SingleAsync(a => a.EntidadId == creado.Id && a.Accion == AccionAuditoria.Borrar));
            Assert.Equal(Entidades.Producto, borrado.Entidad);
        }

        [Fact]
        public async Task Catalogo_SinStock_NoMuestraElProducto()
        {
            var admin = await ComoAdminAsync();
            var categoriaId = await CrearCategoriaAsync(admin);
            var creado = await LeerAsync<ProductoResponse>(
                await admin.PostAsJsonAsync("/productos", NuevoProducto(categoriaId, stockInicial: 0)));

            var respuesta = await Anonimo().GetAsync($"/catalogo/{creado.Id}");

            Assert.Equal(HttpStatusCode.NotFound, respuesta.StatusCode);
        }
    }
}
