# BI-TechCol

Plataforma de **BI dinámico**: cada usuario configura sus propias fuentes de datos (APIs REST, Google Sheets, MySQL, PostgreSQL) desde la UI y las visualiza en dashboards en tiempo real. Basado en la guía "BI Dinámico en Hostinger (Shadcn Admin + Node.js + Conectores)".

## Arquitectura

```
Usuario (React/Shadcn Admin)
    ↓  configura conector
Backend Express (orquestador)
    ↓  cifra credenciales (AES-256-GCM) → MySQL
    ↓  consulta la fuente de datos
    ↓  devuelve datos procesados
React renderiza el dashboard (Recharts)
```

Las credenciales **nunca llegan al navegador**: se cifran en el servidor y solo el backend las usa.

## Estructura

```
BI-TechCol/
├── client/                     # Shadcn Admin (Vite + React + TS)
│   └── src/
│       ├── features/connectors/     # UI para configurar conectores
│       ├── features/bi-dashboard/   # Dashboard en tiempo real
│       ├── routes/_authenticated/   # rutas /connectors y /bi
│       └── lib/bi-api.ts            # cliente del backend
├── server/                     # Express + TS (orquestador)
│   ├── src/
│   │   ├── connectors/         # BaseConnector, RestAPI, GoogleSheets, MySQL, PostgreSQL + Factory
│   │   ├── routes/connectors.routes.ts   # CRUD + /test + /data
│   │   ├── utils/encryption.ts # AES-256-GCM
│   │   ├── db.ts               # pool MySQL (plataforma)
│   │   └── index.ts
│   ├── schema.sql              # users, connectors, connector_data
│   └── .env                    # PORT, DB_*, ENCRYPTION_KEY
└── README.md
```

## Puesta en marcha (desarrollo)

Requisitos: Node 18+, MariaDB/MySQL corriendo (XAMPP local, puerto 3307).

```bash
# 1. Base de datos
C:/xampp/mysql/bin/mysql.exe -P 3307 -u root < server/schema.sql

# 2. Backend (puerto 4000)
cd server
cp .env.example .env   # genera ENCRYPTION_KEY (ver comentario en el archivo)
npm install
npm run dev

# 3. Frontend (puerto 5173, proxy /api → 4000)
cd client
npm install
npm run dev
```

Abrir `http://localhost:5173` → menú **Business Intelligence** → *Conectores* / *BI Dashboard*.

## API

| Método | Ruta                        | Descripción                                |
|--------|-----------------------------|--------------------------------------------|
| GET    | `/api/health`               | Estado del servicio y la BD                |
| GET    | `/api/connectors`           | Lista conectores (sin credenciales)        |
| POST   | `/api/connectors`           | Crea conector (cifra config)               |
| POST   | `/api/connectors/:id/test`  | Prueba la conexión                         |
| GET    | `/api/connectors/:id/data`  | Datos en vivo de la fuente                 |
| DELETE | `/api/connectors/:id`       | Elimina el conector                        |

## Tipos de conector y su config

- **rest_api**: `{ url, method?, headers?, dataPath? }`
- **google_sheets**: `{ spreadsheetId, range?, serviceAccountKey }`
- **mysql / postgresql**: `{ host, port?, user, password, database, query }` (solo SELECT)

## Despliegue en Hostinger

1. Subir el repo a GitHub (sin `.env`).
2. hPanel → **Node.js Web App** → *Import Git Repository*.
3. Configurar variables de entorno (`DB_*`, `ENCRYPTION_KEY`, `CLIENT_ORIGIN`).
4. `npm run build` en client y server; servir `client/dist` como estáticos.

## Pendientes

- Autenticación real (el backend usa usuario demo id=1; Shadcn Admin trae Clerk opcional).
- Selector manual de ejes X/Y y más tipos de gráfica.
- Cache de datos en `connector_data` + refresco programado.
