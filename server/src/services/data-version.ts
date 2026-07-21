/**
 * Version de los datos sincronizados por conector, en memoria del proceso.
 * sync-service la incrementa al terminar un sync exitoso; el cache de
 * agregacion la usa como parte de la clave -- asi la invalidacion es
 * automatica (una version nueva = una clave nueva, la vieja simplemente deja
 * de pedirse y se expulsa del cache por tamaño) sin necesidad de TTL ni de
 * borrar nada a mano.
 */
const versions = new Map<number, number>();

export function getDataVersion(connectorId: number): number {
  return versions.get(connectorId) ?? 0;
}

export function bumpDataVersion(connectorId: number): void {
  versions.set(connectorId, getDataVersion(connectorId) + 1);
}
