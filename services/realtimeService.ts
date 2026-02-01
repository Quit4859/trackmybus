import mqtt from 'mqtt';

// Public HiveMQ Broker (WebSockets)
const BROKER_URL = 'wss://broker.hivemq.com:8000/mqtt';
const TOPIC = 'college-bus-tracker/v1/updates';

let client: mqtt.MqttClient | null = null;

export interface BusUpdatePayload {
  routeId: string;
  lat: number;
  lng: number;
  heading: number;
  isLive: boolean;
  timestamp: number;
}

export const connectToRealtime = (onMessage: (data: BusUpdatePayload) => void) => {
  if (client) return () => {};

  const clientId = `cbt-${Math.random().toString(16).slice(2, 10)}`;
  
  console.log('Connecting to Realtime Bus Network...', clientId);
  
  client = mqtt.connect(BROKER_URL, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
  });

  client.on('connect', () => {
    console.log('✅ Connected to HiveMQ Broker');
    client?.subscribe(TOPIC, (err) => {
      if (err) console.error('Subscription error:', err);
      else console.log('📡 Subscribed to bus updates');
    });
  });

  client.on('message', (topic, message) => {
    if (topic === TOPIC) {
      try {
        const data = JSON.parse(message.toString()) as BusUpdatePayload;
        onMessage(data);
      } catch (e) {
        console.warn('Failed to parse realtime message', e);
      }
    }
  });
  
  client.on('error', (err) => {
    console.warn('Realtime connection warning:', err);
  });

  return () => {
    if (client) {
      client.end();
      client = null;
    }
  };
};

export const publishBusUpdate = (data: Omit<BusUpdatePayload, 'timestamp'>) => {
  if (client && client.connected) {
    const payload: BusUpdatePayload = {
      ...data,
      timestamp: Date.now()
    };
    client.publish(TOPIC, JSON.stringify(payload));
  }
};