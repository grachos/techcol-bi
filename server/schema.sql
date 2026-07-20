-- BI-TechCol: esquema de base de datos
-- Ejecutar en MySQL/MariaDB (local XAMPP o Hostinger)

CREATE DATABASE IF NOT EXISTS bi_techcol
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bi_techcol;

-- Usuarios de la plataforma (base minima; ampliar con auth real)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  password_hash VARCHAR(255) NULL, -- NULL = sin contraseña asignada (primer ingreso pendiente)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migracion idempotente para bases ya creadas antes de agregar auth real
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL AFTER name;

-- Conectores configurados por cada usuario
CREATE TABLE IF NOT EXISTS connectors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('rest_api', 'google_sheets', 'mysql', 'postgresql') NOT NULL,
  config JSON NOT NULL, -- credenciales cifradas (AES-256): { iv, data, tag }
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_connectors_user (user_id)
);

-- Cache de datos obtenidos por conector (TTL de 60s aplicado en la app), para
-- no golpear la fuente en cada refresh de cada widget que la use.
-- La llave incluye params_hash porque los conectores parametrizados (filtros
-- que viajan al origen como query params) devuelven datos distintos por cada
-- combinacion de filtros: cachear solo por connector_id serviria el rango de
-- fechas equivocado. '' = consulta sin parametros.
CREATE TABLE IF NOT EXISTS connector_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  connector_id INT NOT NULL,
  params_hash VARCHAR(64) NOT NULL DEFAULT '',
  data JSON,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE,
  UNIQUE INDEX uq_connector_data_connector (connector_id, params_hash)
);

-- Migracion idempotente: bases creadas antes de que connector_data se usara
-- como cache pueden tener duplicados por connector_id; quedarse con el mas
-- reciente antes de aplicar el UNIQUE INDEX.
ALTER TABLE connector_data
  ADD COLUMN IF NOT EXISTS params_hash VARCHAR(64) NOT NULL DEFAULT '' AFTER connector_id;
DELETE cd1 FROM connector_data cd1
INNER JOIN connector_data cd2
  ON cd1.connector_id = cd2.connector_id
  AND cd1.params_hash = cd2.params_hash
  AND cd1.id < cd2.id;
ALTER TABLE connector_data
  DROP INDEX IF EXISTS uq_connector_data_connector;
ALTER TABLE connector_data
  ADD UNIQUE INDEX IF NOT EXISTS uq_connector_data_connector (connector_id, params_hash);

-- Dashboards personalizables por usuario
CREATE TABLE IF NOT EXISTS dashboards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  tags VARCHAR(255) NULL, -- lista simple separada por comas, ej. "ventas,mensual"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_dashboards_user (user_id)
);

-- Migracion idempotente para bases ya creadas antes de agregar favoritos/tags
ALTER TABLE dashboards
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE AFTER name;
ALTER TABLE dashboards
  ADD COLUMN IF NOT EXISTS tags VARCHAR(255) NULL AFTER is_favorite;

-- Cubre el filtro Favoritos/Explorar (WHERE user_id = ? [AND is_favorite = ?])
ALTER TABLE dashboards
  ADD INDEX IF NOT EXISTS idx_dashboards_user_fav (user_id, is_favorite);

-- Ultima consulta (filtros) aplicada en el dashboard: persiste en servidor para
-- que cualquier punto de entrada (link compartido, /dashboard, /bi) muestre lo
-- mismo, sin depender del localStorage de un navegador en particular.
ALTER TABLE dashboards
  ADD COLUMN IF NOT EXISTS last_filters JSON NULL AFTER tags;
ALTER TABLE dashboards
  ADD COLUMN IF NOT EXISTS last_queried_at TIMESTAMP NULL AFTER last_filters;

-- Widgets dentro de un dashboard: graficas/tablas, informativos (KPI, calendario, reloj)
-- y filtros interactivos (fecha, seleccion) que afectan a otros widgets del mismo dashboard.
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dashboard_id INT NOT NULL,
  connector_id INT NULL, -- opcional: 'clock' y 'calendar' standalone no necesitan conector
  kind ENUM('chart', 'stat', 'calendar', 'clock', 'filter_date', 'filter_select', 'progress', 'map', 'combo', 'tree_grid')
    NOT NULL DEFAULT 'chart',
  title VARCHAR(255) NOT NULL,
  chart_type ENUM('bar', 'line', 'area', 'pie', 'table') NOT NULL DEFAULT 'bar', -- solo kind='chart'
  color ENUM('primary', 'pink', 'blue', 'green', 'orange', 'purple', 'teal') NOT NULL DEFAULT 'primary',
  x_key VARCHAR(255), -- chart/combo: eje X | calendar: columna de fecha | progress: etiqueta | map: region
  y_key VARCHAR(255), -- chart/combo: eje Y | stat: columna a agregar | progress: valor | map: valor
  aggregation ENUM('sum', 'avg', 'count', 'min', 'max') NULL, -- solo kind='stat'
  filter_column VARCHAR(255) NULL, -- solo kind='filter_date'/'filter_select': columna que se filtra en los demas widgets
  layout JSON NOT NULL, -- { x, y, w, h } posicion/tamano en la cuadricula
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
  FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE,
  INDEX idx_widgets_dashboard (dashboard_id)
);

-- Migracion idempotente para bases ya creadas antes de agregar kind/aggregation/filter_column
ALTER TABLE dashboard_widgets MODIFY COLUMN connector_id INT NULL;
ALTER TABLE dashboard_widgets
  ADD COLUMN IF NOT EXISTS kind ENUM('chart', 'stat', 'calendar', 'clock', 'filter_date', 'filter_select', 'progress', 'map', 'combo', 'tree_grid')
    NOT NULL DEFAULT 'chart' AFTER connector_id;
ALTER TABLE dashboard_widgets
  ADD COLUMN IF NOT EXISTS aggregation ENUM('sum', 'avg', 'count', 'min', 'max') NULL AFTER y_key;
ALTER TABLE dashboard_widgets
  ADD COLUMN IF NOT EXISTS filter_column VARCHAR(255) NULL AFTER aggregation;
-- Ampliar kind para bases que ya tenian la columna con menos valores
ALTER TABLE dashboard_widgets
  MODIFY COLUMN kind ENUM('chart', 'stat', 'calendar', 'clock', 'filter_date', 'filter_select', 'progress', 'map', 'combo', 'tree_grid')
    NOT NULL DEFAULT 'chart';
-- Color por widget (Fase 1: tarjetas y graficas coloreadas estilo dashboard admin)
ALTER TABLE dashboard_widgets
  ADD COLUMN IF NOT EXISTS color ENUM('primary', 'pink', 'blue', 'green', 'orange', 'purple', 'teal')
    NOT NULL DEFAULT 'primary' AFTER chart_type;

-- Meta/objetivo opcional para kind='stat': dibuja una linea de referencia
-- sobre el valor agregado (ej. "Meta Terceros" en 15% para un KPI de Rentabilidad).
ALTER TABLE dashboard_widgets
  ADD COLUMN IF NOT EXISTS target_value DECIMAL(20,6) NULL AFTER aggregation;
ALTER TABLE dashboard_widgets
  ADD COLUMN IF NOT EXISTS target_label VARCHAR(255) NULL AFTER target_value;

-- Links compartibles de dashboards (vista publica de solo lectura)
CREATE TABLE IF NOT EXISTS dashboard_shares (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dashboard_id INT NOT NULL,
  share_token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
  INDEX idx_shares_token (share_token),
  INDEX idx_shares_dashboard (dashboard_id)
);

-- Usuario semilla para desarrollo
INSERT INTO users (email, name)
SELECT 'demo@bi-techcol.local', 'Usuario Demo'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo@bi-techcol.local');

-- Dashboard semilla para desarrollo
INSERT INTO dashboards (user_id, name)
SELECT id, 'Mi Dashboard' FROM users
WHERE email = 'demo@bi-techcol.local'
  AND NOT EXISTS (SELECT 1 FROM dashboards WHERE name = 'Mi Dashboard');
