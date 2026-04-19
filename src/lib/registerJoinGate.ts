/**
 * Ref síncrono: enquanto true, não navegar para Main após cadastro + join por código,
 * pois setState pode atrasar e o Firebase Auth dispara antes do join no RTDB terminar.
 */
export const registerJoinGateRef = { current: false };
