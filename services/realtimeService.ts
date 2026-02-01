import mqtt from 'mqtt';
import { BusRoute } from '../types';

// Public HiveMQ Broker (WebSockets)
const BROKER_URL = 'wss://broker.hivemq.com:8000/mqtt';

// Topic Architecture
// 1. Updates: High frequency, contains lat/lng/status
const TOPIC_UPDATES = 'college-bus-tracker/v2/updates';
// 2. Config: Low frequency, contains the full JSON of all routes (Admin sync)
const TOPIC_CONFIG = 'college-bus-tracker/v2/config';

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
  onConfigUpdate: (data: ConfigUpdatePayload) => void
) => {
  if (client) return () => {};

  // Random ID to prevent session collisions
  const clientId = `cbt-user-${Math.random().toString(16).slice(2, 8)}`;
  
  console.log(`🔌 Connecting to Global Sync Network as ${clientId}...`);
  
  client = mqtt.connect(BROKER_URL, {
    clientId,
    clean: true, // Clean session ensures we get fresh retained messages on connect
    connectTimeout: 4000,
    reconnectPeriod: 2000,
  });

  client.on('connect', () => {
    console.log('✅ Connected to Cloud Broker');
    
    // Subscribe to both Location Updates and Route Config
    client?.subscribe([TOPIC_UPDATES, TOPIC_CONFIG], { qos: 1 }, (err) => {
      if (err) console.error('Subscription error:', err);
      else console.log('📡 Listening for global updates...');
    });
  });

  client.on('message', (topic, message) => {
    try {
      const msgString = message.toString();
      
      if (topic === TOPIC_UPDATES) {
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
 * RETAIN: TRUE -> New users joining will immediately see this status.
 */
export const publishBusUpdate = (data: Omit<BusUpdatePayload, 'timestamp'>) => {
  if (client && client.connected) {
    const payload: BusUpdatePayload = {
      ...data,
      timestamp: Date.now()
    };
    client.publish(TOPIC_UPDATES, JSON.stringify(payload), { qos: 0, retain: true });
  }
};

/**
 * Broadcasts Admin Route Configuration.
 * RETAIN: TRUE -> This acts as a "Cloud Database". 
 * Any device connecting will download this JSON immediately.
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