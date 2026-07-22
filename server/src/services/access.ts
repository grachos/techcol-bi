/**
 * Reglas de acceso a dashboards y conectores segun el rol.
 *
 * Modelo (pool compartido): los admin poseen y gestionan TODOS los dashboards
 * y conectores. Un usuario 'custom' es solo lectura y ve unicamente los
 * dashboards que un admin le asigno (tabla user_dashboard_access), mas los
 * conectores que alimentan los widgets de esos dashboards.
 */
import { pool } from "../db";

type Role = "admin" | "custom";

/** ¿El usuario puede LEER este dashboard? Admin: cualquiera. Custom: asignado. */
export async function canReadDashboard(
  dashboardId: string | number,
  userId: number,
  role: Role
): Promise<boolean> {
  if (role === "admin") {
    const [rows]: any = await pool.query(
      "SELECT 1 FROM dashboards WHERE id = ? LIMIT 1",
      [dashboardId]
    );
    return rows.length > 0;
  }
  const [rows]: any = await pool.query(
    "SELECT 1 FROM user_dashboard_access WHERE user_id = ? AND dashboard_id = ? LIMIT 1",
    [userId, dashboardId]
  );
  return rows.length > 0;
}

/**
 * ¿El usuario puede LEER los datos de este conector? Admin: cualquiera.
 * Custom: solo si el conector alimenta un widget de un dashboard que tiene
 * asignado (no puede pedir datos de conectores sueltos del admin).
 */
export async function canReadConnector(
  connectorId: string | number,
  userId: number,
  role: Role
): Promise<boolean> {
  if (role === "admin") {
    const [rows]: any = await pool.query(
      "SELECT 1 FROM connectors WHERE id = ? LIMIT 1",
      [connectorId]
    );
    return rows.length > 0;
  }
  const [rows]: any = await pool.query(
    `SELECT 1
       FROM dashboard_widgets w
       JOIN user_dashboard_access a
         ON a.dashboard_id = w.dashboard_id AND a.user_id = ?
      WHERE w.connector_id = ?
      LIMIT 1`,
    [userId, connectorId]
  );
  return rows.length > 0;
}
