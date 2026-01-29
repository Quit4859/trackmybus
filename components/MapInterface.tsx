import React, { useState, useEffect, useRef } from 'react';
import { BusRoute } from '../types.ts';
import { Phone, ShieldAlert, Clock, Bus, UserCircle, Crosshair, MapPin, Power, Navigation, SignalHigh, Eye, EyeOff, LogOut, Navigation2, Compass } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import { motion, useAnimation, PanInfo, AnimatePresence } from 'framer-motion';

interface MapInterfaceProps {
  route: BusRoute;
  userLocation: [number, number] | null;
  userRole?: string;
  onToggleTracking?: (status: boolean) => void;
  onLogout?: () => void;
}

const MapInterface: React.FC<MapInterfaceProps> = ({ route, userLocation, userRole, onToggleTracking, onLogout }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [centerTarget, setCenterTarget] = useState<'bus' | 'user'>('bus');
  const [bearing, setBearing] = useState(0);
  const [isHeadingUp, setIsHeadingUp] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const busMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const prevCoordsRef = useRef<[number, number] | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const controls = useAnimation();

  const currentStopIndex = route.stops.findIndex(s => s.status === 'current');
  const activeIndex = currentStopIndex !== -1 ? currentStopIndex : 0;
  
  const DEFAULT_LNG_LAT: [number, number] = [76.4764, 13.2642];

  const isValidCoord = (lat: any, lng: any) => 
    typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);

  // Admin and Driver see the ACTUAL location (raw GPS).
  // Students/Parents see the LIVE location (which freezes when tracking is off).
  const busLngLat: [number, number] = 
    (userRole === 'driver' || userRole === 'admin')
      ? (isValidCoord(route.actualLat, route.actualLng) ? [route.actualLng!, route.actualLat!] : DEFAULT_LNG_LAT)
      : (isValidCoord(route.liveLat, route.liveLng) ? [route.liveLng!, route.liveLat!] : DEFAULT_LNG_LAT);

  const EXPANDED_Y = 20;
  const COLLAPSED_Y = userRole === 'driver' ? 620 : 420;
  const MINIMIZED_Y = 740;

  // Track the current snap position to correctly calculate drag offsets
  const [snapPoint, setSnapPoint] = useState(COLLAPSED_Y);

  const calculateBearing = (start: [number, number], end: [number, number]) => {
    const startLat = (start[1] * Math.PI) / 180;
    const startLng = (start[0] * Math.PI) / 180;
    const endLat = (end[1] * Math.PI) / 180;
    const endLng = (end[0] * Math.PI) / 180;

    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
              Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    const b = (Math.atan2(y, x) * 180) / Math.PI;
    return (b + 360) % 360;
  };

  useEffect(() => {
    if (!containerRef.current) return;
    
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: busLngLat,
      zoom: 17.5,
      pitch: 0, 
      bearing: 0,
      antialias: true,
      attributionControl: false,
      fadeDuration: 0,
    });

    map.once('styledata', () => setIsLoading(false));

    map.on('load', () => {
      map.addLayer({
        'id': '3d-buildings',
        'source': 'openmaptiles',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#f1f5f9',
          'fill-extrusion-height': ['get', 'render_height'],
          'fill-extrusion-base': ['get', 'render_min_height'],
          'fill-extrusion-opacity': 0.6
        }
      });

      if (route.path && route.path.length > 0) {
        map.addSource('bus-path', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.path } }
        });
        map.addLayer({
          id: 'bus-path-glow',
          type: 'line',
          source: 'bus-path',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#fbbf24', 'line-width': 12, 'line-opacity': 0.1, 'line-blur': 4 }
        });
        map.addLayer({
          id: 'bus-path-layer',
          type: 'line',
          source: 'bus-path',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#fbbf24', 'line-width': 4, 'line-opacity': 0.6 }
        });
      }

      updateStopMarkers(map);
    });

    const updateStopMarkers = (mapInstance: maplibregl.Map) => {
      stopMarkersRef.current.forEach(m => m.remove());
      stopMarkersRef.current = route.stops.map((stop, idx) => {
        const el = document.createElement('div');
        el.className = `w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[9px] font-black text-white ${stop.status === 'passed' ? 'bg-slate-400' : stop.status === 'current' ? 'bg-yellow-500 ring-4 ring-yellow-500/20' : 'bg-blue-500'}`;
        el.innerText = (idx + 1).toString();
        return new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(mapInstance);
      });
    };

    mapRef.current = map;
    return () => { if (mapRef.current) mapRef.current.remove(); };
  }, []);

  // 1. Handle Map Mode Transitions (Toggle)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getStyle()) return;

    if (isHeadingUp) {
      // Smooth Transition into Driver Mode
      map.flyTo({
        bearing: bearing,
        center: busLngLat,
        pitch: 60,
        zoom: 19,
        duration: 1500,
        essential: true
      });
    } else {
      // Smooth Transition back to Overview
      map.flyTo({
        bearing: 0,
        pitch: 0,
        zoom: 17.5,
        duration: 1500,
        essential: true
      });
    }
  }, [isHeadingUp]); // Only run when mode changes

  // 2. Handle Continuous Updates (Tracking)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getStyle() || !isHeadingUp) return;

    // Throttle updates to prevent lag from high-frequency sensor data (e.g., compass)
    const now = Date.now();
    if (now - lastUpdateRef.current < 50) return; // Cap at ~20fps
    lastUpdateRef.current = now;

    // Use easeTo for smooth continuous updates
    map.easeTo({
      bearing: bearing,
      center: busLngLat,
      pitch: 60,
      zoom: 19,
      duration: 300, // Short duration for responsive feel
      easing: (t) => t // Linear easing prevents "wobble"
    });
  }, [bearing, busLngLat, isHeadingUp]);

  const toggleHeadingMode = () => {
    setIsHeadingUp(prev => !prev);
  };

  // Update Bus Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isLoading) return;

    if (isValidCoord(busLngLat[1], busLngLat[0])) {
      
      let currentBearing = bearing;

      // Use explicit heading from driver device if available
      if (typeof route.heading === 'number') {
        currentBearing = route.heading;
        if (Math.abs(currentBearing - bearing) > 1) {
          setBearing(currentBearing);
        }
      } else if (prevCoordsRef.current) {
        // Fallback to calculation from coordinates
        const newBearing = calculateBearing(prevCoordsRef.current, busLngLat);
        if (Math.abs(newBearing - bearing) > 1) {
          currentBearing = newBearing;
          setBearing(newBearing);
        }
      }
      
      prevCoordsRef.current = busLngLat;

      const getRealisticBusContent = (isLive: boolean | undefined) => `
            <div class="relative filter drop-shadow-xl">
               <div class="w-10 h-24 bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-500 rounded-xl border border-yellow-600/30 relative z-10 overflow-hidden shadow-[inset_0_2px_10px_rgba(255,255,255,0.3)]">
                  <!-- Windshield -->
                  <div class="w-full h-6 bg-slate-800 mt-2 relative border-b border-slate-700">
                     <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent"></div>
                     <!-- Wipers -->
                     <div class="absolute bottom-0 left-2 w-3 h-0.5 bg-slate-600 origin-left -rotate-12"></div>
                     <div class="absolute bottom-0 right-2 w-3 h-0.5 bg-slate-600 origin-right rotate-12"></div>
                  </div>
                  
                  <!-- Roof Vents -->
                  <div class="mx-auto w-6 h-8 border border-yellow-600/10 bg-yellow-400/30 rounded mt-3"></div>
                  <div class="mx-auto w-5 h-5 border border-yellow-600/10 bg-yellow-400/30 rounded-full mt-4"></div>

                  <!-- Rear Window -->
                  <div class="absolute bottom-1 w-full h-2 bg-slate-800/90"></div>
                  
                  <!-- Brake Lights -->
                  <div class="absolute bottom-0.5 left-1 w-2 h-1 bg-red-500 rounded-sm"></div>
                  <div class="absolute bottom-0.5 right-1 w-2 h-1 bg-red-500 rounded-sm"></div>
               </div>
               
               <!-- Mirrors -->
               <div class="absolute top-6 -left-1.5 w-1.5 h-3 bg-slate-800 rounded-l-md border-r border-slate-600"></div>
               <div class="absolute top-6 -right-1.5 w-1.5 h-3 bg-slate-800 rounded-r-md border-l border-slate-600"></div>

               ${isLive ? '<div class="live-indicator absolute -top-1 -right-1 z-20 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse shadow-md"></div>' : ''}
            </div>
      `;

      if (!busMarkerRef.current) {
        const busEl = document.createElement('div');
        busEl.className = 'bus-marker';
        busEl.innerHTML = `
          <div style="transition: transform 0.3s ease-out; transform: rotate(${currentBearing}deg);">
             ${getRealisticBusContent(route.isLive)}
          </div>
        `;

        busMarkerRef.current = new maplibregl.Marker({ 
          element: busEl,
          anchor: 'center',
          rotationAlignment: 'map',
          pitchAlignment: 'map'
        })
          .setLngLat(busLngLat)
          .addTo(map);
      } else {
        busMarkerRef.current.setLngLat(busLngLat);
        const wrapper = busMarkerRef.current.getElement().firstElementChild as HTMLElement;
        if (wrapper) {
            wrapper.style.transform = `rotate(${currentBearing}deg)`;
            const hasLiveIndicator = wrapper.querySelector('.live-indicator');
            if (!!hasLiveIndicator !== !!route.isLive) {
                 wrapper.innerHTML = getRealisticBusContent(route.isLive);
            }
        }
      }
    }
  }, [busLngLat, bearing, isLoading, route.isLive, route.heading]);

  // Update User Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isLoading || !userLocation) return;
    const userLngLat: [number, number] = [userLocation[1], userLocation[0]];
    if (isValidCoord(userLngLat[1], userLngLat[0])) {
      if (!userMarkerRef.current) {
        const userEl = document.createElement('div');
        userEl.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-blue-500 opacity-20 rounded-full animate-ping"></div>
            <div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg"></div>
          </div>
        `;
        userMarkerRef.current = new maplibregl.Marker({ element: userEl }).setLngLat(userLngLat).addTo(map);
      } else {
        userMarkerRef.current.setLngLat(userLngLat);
      }
    }
  }, [userLocation, isLoading]);

  const handleRecenter = () => {
    if (!mapRef.current) return;
    const target = centerTarget === 'bus' && userLocation ? [userLocation[1], userLocation[0]] : busLngLat;
    mapRef.current.flyTo({ center: target as [number, number], zoom: 18, pitch: 0, speed: 1.2 });
    setCenterTarget(centerTarget === 'bus' ? 'user' : 'bus');
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    const { offset, velocity } = info;
    const currentY = snapPoint + offset.y;
    let nearest = snapPoint;

    // 1. High Velocity Swipes (Flicks)
    if (velocity.y > 500) {
      // Swiping Down
      if (snapPoint === EXPANDED_Y) nearest = COLLAPSED_Y;
      else nearest = MINIMIZED_Y;
    } else if (velocity.y < -500) {
      // Swiping Up
      if (snapPoint === MINIMIZED_Y) nearest = COLLAPSED_Y;
      else nearest = EXPANDED_Y;
    } else {
      // 2. Positional Snap (Slow Drag)
      const points = [EXPANDED_Y, COLLAPSED_Y, MINIMIZED_Y];
      nearest = points.reduce((prev, curr) => 
        Math.abs(currentY - curr) < Math.abs(currentY - prev) ? curr : prev
      );
    }
    
    setSnapPoint(nearest);
    controls.start({ y: nearest });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      <AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[2000] bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
            <Bus className="w-16 h-16 text-yellow-500 animate-bounce mb-6" />
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Locating Bus...</h3>
            <p className="text-slate-400 text-xs font-bold mt-2 uppercase tracking-widest">Connecting to GPS Network</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 pt-6 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between border border-white/50 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl transition-colors ${route.isLive ? 'bg-green-100' : 'bg-slate-100'}`}>
               <div className={`w-3 h-3 rounded-full ${route.isLive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{route.isLive ? 'Live' : 'Stationary'}</p>
                <p className="font-extrabold text-slate-900 text-sm leading-none">{route.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userRole === 'driver' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-xl">
                <SignalHigh className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black text-blue-600 uppercase">Signal</span>
              </div>
            )}
            {userRole !== 'driver' && <ShieldAlert className="w-5 h-5 text-red-500" />}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative z-0">
        <div ref={containerRef} className="absolute inset-0" />
        {!isLoading && (
          <div className="absolute bottom-[340px] right-6 z-[900] flex flex-col gap-3">
            {userRole === 'driver' && (
              <button 
                onClick={toggleHeadingMode} 
                className={`p-4 rounded-2xl shadow-2xl border transition-all active:scale-90 ${isHeadingUp ? 'bg-yellow-400 border-yellow-500 text-slate-900' : 'bg-white border-slate-100 text-slate-900'}`}
              >
                  <Compass className={`w-6 h-6 ${isHeadingUp ? 'animate-pulse' : ''}`} />
              </button>
            )}
            <button 
              onClick={handleRecenter} 
              className={`p-4 rounded-2xl shadow-2xl border transition-all active:scale-90 ${centerTarget === 'user' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
            >
                {centerTarget === 'user' ? <Navigation2 className="w-6 h-6" /> : <Crosshair className="w-6 h-6" />}
            </button>
          </div>
        )}
      </div>

      {userRole === 'driver' && !isLoading && (
        <div className="absolute bottom-24 left-0 right-0 z-[1002] px-4">
           <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-2xl border border-white/10 flex flex-col gap-5">
              <div className="flex items-center gap-4 px-1">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${route.isLive ? 'bg-green-500/20' : 'bg-white/5'}`}>
                   {route.isLive ? <Eye className="w-6 h-6 text-green-400" /> : <EyeOff className="w-6 h-6 text-slate-500" />}
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-black text-[11px] uppercase tracking-[0.15em] mb-0.5">Live Tracking</h4>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-tight">Your location is being broadcasted</p>
                </div>
              </div>
              <button 
                onClick={() => onToggleTracking?.(!route.isLive)} 
                className={`w-full py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-95 ${route.isLive ? 'bg-red-500 text-white' : 'bg-yellow-400 text-slate-900'}`}
              >
                {route.isLive ? <Power className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
                {route.isLive ? 'Stop Tracking' : 'Go Live Now'}
              </button>
           </motion.div>
        </div>
      )}

      {userRole !== 'driver' && (
        <motion.div 
          drag="y" 
          dragConstraints={{ top: EXPANDED_Y, bottom: MINIMIZED_Y }} 
          dragElastic={0.1} 
          animate={controls} 
          initial={{ y: COLLAPSED_Y }} 
          onDragEnd={handleDragEnd} 
          className="fixed inset-x-0 bottom-0 z-[1001] bg-white rounded-t-[40px] shadow-[0_-15px_40px_rgba(0,0,0,0.1)] flex flex-col h-screen overflow-hidden"
        >
          <div className="w-full pt-4 pb-8 cursor-grab active:cursor-grabbing">
            <div className="w-16 h-1.5 bg-slate-200 rounded-full mx-auto"></div>
          </div>
          <div className="px-8 pb-32 flex-1 overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-end mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Arrival</span>
                </div>
                <h1 className="text-4xl font-black text-slate-900">{route.isLive ? route.eta : 'Offline'}</h1>
              </div>
            </div>
            <div className="flex items-center justify-between bg-slate-50 p-5 rounded-3xl border border-slate-100 mb-8">
              <div className="flex items-center gap-4">
                 <UserCircle className="w-12 h-12 text-slate-400" />
                 <div>
                   <p className="font-extrabold text-slate-900 text-base">{route.driver}</p>
                   <span className="text-xs font-bold text-slate-400">{route.numberPlate}</span>
                 </div>
              </div>
              <a href={`tel:${route.driverPhone}`} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 shadow-sm active:bg-slate-50">
                <Phone className="w-5 h-5" />
              </a>
            </div>
            <div className="space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Route Schedule</h3>
                <div className="relative pl-6 space-y-8">
                    <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100"></div>
                    {route.stops.slice(activeIndex, activeIndex + 3).map((stop) => (
                        <div key={stop.id} className="relative flex items-center justify-between">
                            <div className={`absolute -left-[23px] w-4 h-4 rounded-full border-4 border-white shadow-sm ${stop.status === 'current' ? 'bg-yellow-400 ring-8 ring-yellow-400/10' : 'bg-slate-200'}`} />
                            <span className={`text-sm font-bold ${stop.status === 'current' ? 'text-slate-900' : 'text-slate-400'}`}>{stop.name}</span>
                            <span className="text-xs font-black text-slate-300 font-mono">{stop.time}</span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default MapInterface;