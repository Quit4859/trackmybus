import mqtt from 'mqtt';
import { BusRoute } from '../types';

// Public HiveMQ Broker (WebSockets)
const BROKER_URL = 'wss://broker.hivemq.com:8000/mqtt';

// Topic Architecture v3 (Granular Topics to prevent collisions)
const TOPIC_BASE = 'college-bus-tracker/v3';
const TOPIC_CONFIG = `${TOPIC_BASE}/config`; // Global route config
const TOPIC_UPDATES_WILDCARD = `${TOPIC_BASE}/updates/+`; // Listen to ALL routes

let client: mqtt.MqttClient | null = null;

export interface BusUpdatePayload {
  routeId: string;
  lat: number;
  lng: number;
  heading: number;
  isLive: boolean;
  timestamp: number;
}

export interface ConfigUpdatePayload {
  routes: BusRoute[];
  timestamp: number;
}

export const connectToRealtime = (
  onBusUpdate: (data: BusUpdatePayload) => void,
  onConfigUpdate: (data: ConfigUpdatePayload) => void,
  onStatusChange?: (status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING') => void
) => {
  if (client) return () => {};

  // Random ID to prevent session collisions
  const clientId = `cbt-user-${Math.random().toString(16).slice(2, 8)}`;
  
  console.log(`🔌 Connecting to Global Sync Network as ${clientId}...`);
  if (onStatusChange) onStatusChange('RECONNECTING');

  client = mqtt.connect(BROKER_URL, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 2000,
  });

  client.on('connect', () => {
    console.log('✅ Connected to Cloud Broker');
    if (onStatusChange) onStatusChange('CONNECTED');
    
    // Subscribe to Wildcard Updates and Config
    client?.subscribe([TOPIC_UPDATES_WILDCARD, TOPIC_CONFIG], { qos: 1 }, (err) => {
      if (err) console.error('Subscription error:', err);
      else console.log('📡 Listening for global updates...');
    });
  });

  client.on('reconnect', () => {
    console.log('Using fallback connection...');
    if (onStatusChange) onStatusChange('RECONNECTING');
  });

  client.on('close', () => {
    if (onStatusChange) onStatusChange('DISCONNECTED');
  });

  client.on('message', (topic, message) => {
    try {
      const msgString = message.toString();
      
      // Check if it's an update topic (contains /updates/)
      if (topic.includes('/updates/')) {
        const data = JSON.parse(msgString) as BusUpdatePayload;
        onBusUpdate(data);
      } 
      else if (topic === TOPIC_CONFIG) {
        const data = JSON.parse(msgString) as ConfigUpdatePayload;
        console.log("🔄 Received Global Route Sync");
        onConfigUpdate(data);
      }
    } catch (e) {
      console.warn('Failed to parse incoming message', e);
    }
  });
  
  client.on('error', (err) => {
    console.warn('Network warning:', err);
    if (onStatusChange) onStatusChange('DISCONNECTED');
  });

  return () => {
    if (client) {
      client.end();
      client = null;
    }
  };
};

/**
 * Broadcasts Driver Location.
 * Uses specific topic: .../updates/{routeId}
 * This ensures Driver A doesn't overwrite Driver B's retained message.
 */
export const publishBusUpdate = (data: Omit<BusUpdatePayload, 'timestamp'>) => {
  if (client && client.connected) {
    const payload: BusUpdatePayload = {
      ...data,
      timestamp: Date.now()
    };
    // Publish to specific route topic
    const topic = `${TOPIC_BASE}/updates/${data.routeId}`;
    client.publish(topic, JSON.stringify(payload), { qos: 0, retain: true });
  }
};

/**
 * Broadcasts Admin Route Configuration.
 */
export const publishRouteConfig = (routes: BusRoute[]) => {
  if (client && client.connected) {
    const payload: ConfigUpdatePayload = {
      routes,
      timestamp: Date.now()
    };
    console.log("☁️ Syncing Routes to Cloud...");
    client.publish(TOPIC_CONFIG, JSON.stringify(payload), { qos: 1, retain: true });
  }
};