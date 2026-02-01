import mqtt from 'mqtt';
import { BusRoute, Bus, Driver, Student } from '../types';

// Public EMQX Broker (More stable on mobile networks/4G than HiveMQ)
// Port 8084 is WSS (Secure WebSocket)
const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

// Topic Architecture v4 - Updated to sync ALL data
const TOPIC_BASE = 'college-bus-tracker/v4';
const TOPIC_CONFIG = `${TOPIC_BASE}/config`; // Global app config (Routes + Users)
const TOPIC_UPDATES_WILDCARD = `${TOPIC_BASE}/updates/+`; // Listen to ALL live positions

let client: mqtt.MqttClient | null = null;

export interface BusUpdatePayload {
  routeId: string;
  lat: number;
  lng: number;
  heading: number;
  isLive: boolean;
  timestamp: number;
}

// Global Config now includes EVERYTHING needed to run the app on another device
export interface GlobalConfigPayload {
  routes: BusRoute[];
  buses: Bus[];
  drivers: Driver[];
  students: Student[];
  timestamp: number;
}

export const connectToRealtime = (
  onBusUpdate: (data: BusUpdatePayload) => void,
  onConfigUpdate: (data: GlobalConfigPayload) => void,
  onStatusChange?: (status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING') => void
) => {
  // If already connected, do not create a new client
  if (client) {
    if (client.connected && onStatusChange) onStatusChange('CONNECTED');
    return () => {};
  }

  // Random ID to prevent session collisions
  const clientId = `cbt-user-${Math.random().toString(16).slice(2, 8)}`;
  
  console.log(`🔌 Connecting to EMQX Cloud Broker as ${clientId}...`);
  if (onStatusChange) onStatusChange('RECONNECTING');

  client = mqtt.connect(BROKER_URL, {
    clientId,
    clean: true,
    connectTimeout: 10000, // Increased to 10s for mobile networks
    reconnectPeriod: 3000, // Retry every 3s
    keepalive: 60,
  });

  client.on('connect', () => {
    console.log('✅ Connected to EMQX Cloud Broker');
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
    // Only report disconnected if we didn't manually end it
    if (client) {
        if (onStatusChange) onStatusChange('DISCONNECTED');
    }
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
        const data = JSON.parse(msgString) as GlobalConfigPayload;
        console.log("🔄 Received Global Data Sync");
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
 */
export const publishBusUpdate = (data: Omit<BusUpdatePayload, 'timestamp'>) => {
  if (client && client.connected) {
    const payload: BusUpdatePayload = {
      ...data,
      timestamp: Date.now()
    };
    // Publish to specific route topic
    const topic = `${TOPIC_BASE}/updates/${data.routeId}`;
    // QoS 1 ensures delivery at least once (better for moving vehicles in spotty network)
    client.publish(topic, JSON.stringify(payload), { qos: 1, retain: true });
  }
};

/**
 * Broadcasts FULL App Configuration (Routes, Buses, Drivers, Students).
 */
export const publishGlobalConfig = (data: Omit<GlobalConfigPayload, 'timestamp'>) => {
  if (client && client.connected) {
    const payload: GlobalConfigPayload = {
      ...data,
      timestamp: Date.now()
    };
    console.log("☁️ Syncing Global Data to Cloud...");
    client.publish(TOPIC_CONFIG, JSON.stringify(payload), { qos: 1, retain: true });
  }
};