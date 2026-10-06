# IronPulse · Sistema de gestión para gimnasios

Sistema web para administrar un gimnasio en Venezuela. Los precios se manejan en dólares y la **conversión a bolívares es automática con la tasa oficial del BCV**, consultada desde una API pública y gratuita.

## Módulos

| Módulo | Qué hace |
| --- | --- |
| **Panel** | Miembros activos, asistencias e ingresos del día y del mes, gráfico de 30 días, vencimientos próximos con recordatorio por WhatsApp, stock bajo y cumpleaños. |
| **Asistencias** | Check-in por cédula (compatible con lector de código de barras) o por nombre. Valida la membresía y los días de gracia, evita entradas duplicadas y registra la salida. |
| **Clientes** | Ficha completa, búsqueda instantánea, filtros por estado de la membresía, historial de membresías, pagos y asistencias, y exportación a CSV. |
| **Inscripciones** | Alta del cliente y primer plan en un solo flujo. Cobra la cuota de inscripción (configurable y exonerable) y permite descuentos. |
| **Renovaciones** | Lista de clientes por vencer y vencidos para recuperar. La renovación continúa desde el día siguiente al vencimiento, así el cliente **no pierde días**. |
| **Planes** | Precio en $ con su equivalente en Bs, duración, beneficios, color y cantidad de miembros activos. |
| **Pagos** | **Pagos mixtos** (por ejemplo $20 en efectivo más el resto por pago móvil), cálculo de vuelto, referencias, otros ingresos, anulaciones y exportación a CSV. Cada pago guarda la tasa del día en que se hizo. |
| **Tienda** | Punto de venta con carrito, inventario con alertas de stock mínimo, margen y valor del inventario, e historial de ventas (anular una venta devuelve el stock). |
| **Reportes** | Ingresos con comparación contra el período anterior, desglose por método de pago y por concepto, planes vendidos, horas pico, días más concurridos, top de productos y clientes, y evolución de la tasa BCV. |
| **Usuarios** | Roles de administrador, recepción y entrenador, con permisos aplicados en la API y en la interfaz. |
| **Configuración** | Datos del gimnasio para los recibos, cuota de inscripción, días de gracia, alertas y modo de tasa (automática o manual). |

Otros detalles: recibos imprimibles en formato de 80 mm, tema claro y oscuro, buscador global (`Ctrl + K`), diseño adaptable a móvil y conversor rápido $ ⇄ Bs en la barra superior.

## Tasa BCV

- Fuente principal: [DolarApi](https://ve.dolarapi.com/v1/dolares/oficial). Respaldo: [PyDolarVe](https://pydolarve.org).
- La tasa se guarda en caché en la base de datos y se actualiza cada 60 minutos por defecto (configurable). También se puede forzar la actualización desde la interfaz.
- Si ninguna API responde, se usa la última tasa guardada y, si no existe, la tasa manual de respaldo.
- El **modo manual** fija una tasa para todas las operaciones.
- Cada pago guarda la tasa con la que se cobró, así los reportes históricos no cambian cuando la tasa se actualiza.

## Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query, React Router y Recharts. Cada página se carga por separado (code splitting).
- **Backend:** Node.js, Express 5, TypeScript, SQLite (better-sqlite3 con WAL), Zod, JWT y bcrypt.
- Todo está en un monorepo con npm workspaces (`server/` y `web/`). En producción, un solo proceso sirve la API y la app.

SQLite no requiere instalar ni configurar un servidor de base de datos, y alcanza de sobra para el volumen de un gimnasio (miles de clientes y cientos de miles de asistencias).

## Uso

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run seed          # opcional: carga datos de demostración (use `-- --reset` para reiniciar la base)
npm run dev           # API en :4000 y web en http://localhost:5173
```

Producción:

```bash
npm run build
JWT_SECRET="un-secreto-largo" npm start   # http://localhost:4000
```

Usuarios iniciales:

| Usuario | Contraseña | Rol |
| --- | --- | --- |
| `admin` | `admin123` | Administrador (se crea siempre) |
| `recepcion` | `demo1234` | Recepción (solo con `npm run seed`) |
| `entrenador` | `demo1234` | Entrenador (solo con `npm run seed`) |

Cambie la contraseña del administrador desde **Usuarios → Mi contraseña**.

### Variables de entorno

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `4000` | Puerto de la API |
| `JWT_SECRET` | (valor de desarrollo) | Secreto para firmar las sesiones. **Obligatorio en producción.** |
| `DB_PATH` | `server/data/gym.db` | Ruta del archivo SQLite |
| `TZ` | `America/Caracas` | Zona horaria usada para fechas, cierres del día y reportes |

### Pruebas

```bash
npm test         # pruebas de integración de la API (base de datos en memoria)
npm run typecheck
```

## Estructura

```
server/src
├── app.ts              # Express: middlewares, rutas y archivos estáticos
├── db.ts               # Esquema SQLite y datos iniciales
├── auth.ts             # JWT y control de roles
├── lib/                # bcv (tasa), payments (pagos mixtos), memberships (fechas y estados), settings
└── routes/             # auth, users, clients, plans, memberships, payments, store, attendance, settings, reports
web/src
├── components/         # UI base, cobro mixto, selector de cliente, recibo, gráficos y layout
├── lib/                # cliente API, sesión, hooks, formatos y tipos
└── pages/              # una página por módulo
```
