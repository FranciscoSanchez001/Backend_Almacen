// Entregas (repartidor). Pensado para el celular.
import Icono from '../../components/Icono'

const SECCIONES = [
  ['Mis entregas', 'Lista de los pedidos asignados a este repartidor.'],
  ['Detalle del pedido', 'Productos, zona, dirección y teléfono del cliente.'],
  ['Abrir en el mapa', 'Botón para abrir la dirección en Google Maps o Waze.'],
  ['Cambiar estado', 'Marcar el pedido "en camino" y "entregado".'],
  ['Historial', 'Sus propias entregas ya realizadas.'],
]

export default function Inicio() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          Entregas <Icono nombre="moto" className="h-9 w-9" grosor={1.6} tono />
        </h2>
        <p className="mt-1 text-slate-600">Área del repartidor, pensada para el celular.</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECCIONES.map(([titulo, detalle]) => (
          <article key={titulo} className="rounded-xl border border-slate-200 bg-superficie p-4">
            <h3 className="font-semibold text-slate-800">{titulo}</h3>
            <p className="mt-1 text-sm text-slate-500">{detalle}</p>
            <span className="mt-3 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              Por construir
            </span>
          </article>
        ))}
      </div>
    </div>
  )
}
