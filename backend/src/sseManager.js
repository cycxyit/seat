/**
 * SSE (Server-Sent Events) Manager
 * Maintains a registry of active SSE client connections per theater.
 * When a seat is booked, broadcast the update to all clients watching that theater.
 */

// Map<theaterId, Set<res>>
const clients = new Map();

export function addClient(theaterId, res) {
  if (!clients.has(theaterId)) {
    clients.set(theaterId, new Set());
  }
  clients.get(theaterId).add(res);
}

export function removeClient(theaterId, res) {
  const set = clients.get(theaterId);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(theaterId);
  }
}

export function broadcastToTheater(theaterId, eventData) {
  const set = clients.get(theaterId);
  if (!set || set.size === 0) return;

  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  const dead = [];

  for (const res of set) {
    try {
      res.write(payload);
    } catch (e) {
      dead.push(res);
    }
  }

  // Clean up dead connections
  for (const res of dead) {
    set.delete(res);
  }
}

export function getClientCount(theaterId) {
  return clients.get(theaterId)?.size || 0;
}
