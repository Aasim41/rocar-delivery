/**
 * Backend API client for communicating with the cart's FastAPI server.
 * 
 * The backend runs on the same network (laptop/server) and exposes:
 * - REST endpoints for delivery management
 * - WebSocket endpoint for live cart tracking
 */

const PRODUCTION_BACKEND = 'https://rocar-object-detection-production.up.railway.app';
const BACKEND_KEY = 'rocar_backend_url';

export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(BACKEND_KEY);
    if (
      saved &&
      !saved.includes('192.168.1.100') &&
      !saved.includes('10.110.87.59') &&
      !saved.includes('192.168.20.20') &&
      !saved.includes('10.45.207.59')
    ) {
      return saved;
    }

    return PRODUCTION_BACKEND;
  }
  return PRODUCTION_BACKEND;
}

export function setBackendUrl(url: string): void {
  const clean = url.replace(/\/+$/, '');
  localStorage.setItem(BACKEND_KEY, clean);
}

// ─── REST API ───────────────────────────────────────────────

async function post(endpoint: string, body: Record<string, any>) {
  const url = `${getBackendUrl()}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend ${endpoint} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function get(endpoint: string) {
  const url = `${getBackendUrl()}${endpoint}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Backend ${endpoint} failed: ${res.status}`);
  return res.json();
}

/** Get current cart status (phase, location, speed, etc.) */
export async function getCartStatus() {
  return get('/status');
}

/** Start a new delivery — cart will begin driving to pickup */
export async function startDelivery(params: {
  deliveryId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
}) {
  return post('/backend/new_delivery', {
    delivery_id: params.deliveryId,
    pickup: params.pickup,
    dropoff: params.dropoff,
  });
}

/** QR scan — unlock cart for loading or retrieval */
export async function verifyQR(params: {
  cartId: string;
  action: 'load' | 'retrieve';
}) {
  return post('/backend/verify_qr', {
    cart_id: params.cartId,
    action: params.action,
  });
}

/** Sender dispatches cart after loading */
export async function dispatchCart() {
  return post('/backend/dispatch', {});
}

/** Receiver confirms retrieval — starts 3min standby timer */
export async function completeRetrieval() {
  return post('/backend/complete_retrieval', {});
}

/** Set charging station coordinates */
export async function setChargingStation(lat: number, lng: number) {
  return post('/backend/set_charging_station', { lat, lng });
}

// ─── WEBSOCKET (Live Tracking) ──────────────────────────────

export interface CartUpdate {
  type: string;
  cart: { lat: number; lng: number };
  source?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  phase: string;
  cargo_state: string;
  speed: number;
  eta_seconds: number;
  delivery_id?: string;
  route_points?: { lat: number; lng: number }[];
}

type UpdateCallback = (data: CartUpdate) => void;
type StatusCallback = (connected: boolean) => void;

/**
 * Connect to the cart's live tracking WebSocket.
 * Auto-reconnects with exponential backoff.
 * Returns a cleanup function.
 */
export function connectToCartWS(
  onUpdate: UpdateCallback,
  onStatusChange?: StatusCallback,
): () => void {
  let ws: WebSocket | null = null;
  let retryDelay = 500;
  let maxDelay = 8000;
  let alive = true;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (!alive) return;

    const wsUrl = getBackendUrl().replace(/^http/, 'ws') + '/ws/track';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      retryDelay = 500; // Reset on successful connect
      onStatusChange?.(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'location_update' || data.cart) {
          onUpdate(data as CartUpdate);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      // Will trigger onclose
    };

    ws.onclose = () => {
      onStatusChange?.(false);
      if (alive) {
        retryTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, maxDelay);
          connect();
        }, retryDelay);
      }
    };
  }

  connect();

  // Return cleanup function
  return () => {
    alive = false;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (ws) {
      ws.onclose = null; // Prevent reconnect
      ws.close();
    }
  };
}
