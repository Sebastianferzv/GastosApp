import sql from './db';

// Cuando uno o más cargos quedan pagados (por cualquier vía: toggle directo,
// aceptar una solicitud puntual, o aceptar una liquidación de Resumen), cualquier
// otra notificación pendiente que dependiera de esos cargos deja de tener sentido.
export async function resolveStaleNotifications(chargeIds) {
  const ids = (chargeIds || []).filter(Boolean);
  if (ids.length === 0) return;

  await sql`
    UPDATE notifications SET read = TRUE
    WHERE type = 'charge_paid' AND read = FALSE AND reference_id = ANY(${ids})
  `;

  await sql`
    UPDATE notifications n SET read = TRUE
    WHERE n.type = 'settle_request' AND n.read = FALSE
      AND n.charge_ids && ${ids}
      AND NOT EXISTS (
        SELECT 1 FROM charges c WHERE c.id = ANY(n.charge_ids) AND c.paid = FALSE
      )
  `;
}
