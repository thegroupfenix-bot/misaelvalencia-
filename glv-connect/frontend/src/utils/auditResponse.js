// Normaliza la respuesta de GET /audit.
// Contrato actual: { rows, total, limit, offset }. Se acepta también una lista simple (legado).
// Lanza Error si la forma no es válida, para que la vista muestre error + reintento.
export const AUDIT_INVALID_MESSAGE = "Respuesta de auditoría no válida";

export function normalizeAuditResponse(response) {
  const rows = Array.isArray(response) ? response : response?.rows;
  if (!Array.isArray(rows)) throw new Error(AUDIT_INVALID_MESSAGE);
  const total = Number.isFinite(response?.total) ? response.total : rows.length;
  return { rows, total };
}

// Carga la auditoría y devuelve un estado de vista; nunca lanza.
export async function loadAuditState(fetchAudit) {
  try {
    const { rows, total } = normalizeAuditResponse(await fetchAudit());
    return { logs: rows, total, error: "" };
  } catch (e) {
    return {
      logs: [],
      total: 0,
      error: "No fue posible cargar el registro de auditoría. Verifica la conexión e inténtalo de nuevo.",
      cause: e,
    };
  }
}
