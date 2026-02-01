import React, { useState, useEffect, useRef } from 'react';
import { BusRoute } from '../types.ts';
import { Phone, ShieldAlert, Clock, Bus, UserCircle, Crosshair, MapPin, Power, Navigation, SignalHigh, Eye, EyeOff, LogOut, Navigation2, Compass, ChevronLeft, ChevronRight, Lock, LockOpen } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import { motion, useAnimation, PanInfo, AnimatePresence } from 'framer-motion';

interface MapInterfaceProps {
  route: BusRoute;
  userLocation: [number, number] | null;
  userRole?: string;
  onToggleTracking?: (status: boolean) => void;
  onLogout?: () => void;
  onSwitchRoute?: (direction: 'next' | 'prev') => void;
}

const MapInterface: React.FC<MapInterfaceProps> = ({ route, userLocation, userRole, onToggleTracking, onLogout, onSwitchRoute }) => {
  const [isLoading, setIsLoading] = useState(true);
  // centerTarget: 'bus' = locked on bus, 'user' = locked on user, null = free roaming
  const [centerTarget, setCenterTarget] = useState<'bus' | 'user' | null>('bus');
  const [bearing, setBearing] = useState(0);
  const [isHeadingUp, setIsHeadingUp] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const busMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const prevCoordsRef = useRef<[number, number] | null>(null);
  
  const controls = useAnimation();

  // Animation Refs
  const currentBusPos = useRef<[number, number] | null>(null);
  const targetBusPos = useRef<[number, number] | null>(null);
  const animationFrameRef = useRef<number>(0);

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

  // Dynamic Snap Points based on Screen Height
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  
  const EXPANDED_Y = 0; // Snap to very top
  // Collapsed: Roughly in the middle-bottom
  const COLLAPSED_Y = userRole === 'driver' ? screenHeight - 200 : screenHeight - 380;
  // Minimized: Just a small handle visible above the 80px BottomNav
  const MINIMIZED_Y = screenHeight - 110; 
  // Hidden: Completely off-screen
  const HIDDEN_Y = screenHeight;

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

  // Linear Interpolation Helper
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
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

    // NOTE: Removed previous dragstart listener that unlocked the map to allow for strict locking

    mapRef.current = map;
    return () => { 
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (mapRef.current) mapRef.current.remove(); 
    };
  }, []); 

  // Handle Strict Lock / Unlock Logic
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (centerTarget === 'bus') {
        // Strict Lock: User cannot move, zoom, or rotate the map
        map.dragPan.disable();
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.dragRotate.disable();
        map.keyboard.disable();
        map.touchZoomRotate.disable();
        map.doubleClickZoom.disable();
    } else {
        // Unlocked: User can interact freely
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.boxZoom.enable();
        map.dragRotate.enable();
        map.keyboard.enable();
        map.touchZoomRotate.enable();
        map.doubleClickZoom.enable();
    }
  }, [centerTarget]);

  // Update Route Path when route changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getStyle() || !route.path) return;

    const source = map.getSource('bus-path') as maplibregl.GeoJSONSource;
    if (source) {
        source.setData({ 
            type: 'Feature', 
            properties: {}, 
            geometry: { type: 'LineString', coordinates: route.path } 
        });
    }
    updateStopMarkers(map);
  }, [route.id, route.path]); 

  const updateStopMarkers = (mapInstance: maplibregl.Map) => {
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = route.stops.map((stop, idx) => {
      const el = document.createElement('div');
      el.className = `w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[9px] font-black text-white ${stop.status === 'passed' ? 'bg-slate-400' : stop.status === 'current' ? 'bg-yellow-500 ring-4 ring-yellow-500/20' : 'bg-blue-500'}`;
      el.innerText = (idx + 1).toString();
      return new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(mapInstance);
    });
  };

  // 1. Handle Map Mode Transitions (Toggle)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getStyle()) return;

    if (isHeadingUp) {
      map.flyTo({ bearing: bearing, center: currentBusPos.current || busLngLat, pitch: 60, zoom: 19, duration: 1500 });
    } else {
      map.flyTo({ bearing: 0, pitch: 0, zoom: 17.5, duration: 1500 });
    }
  }, [isHeadingUp]);


  const toggleHeadingMode = () => {
    setIsHeadingUp(prev => !prev);
    // If enabling Heading Up, force lock onto bus
    if (!isHeadingUp) setCenterTarget('bus');
  };

  // --- SMOOTH INTERPOLATION LOOP ---
  // Instead of jumping the marker, we smoothly animate it to the new target
  useEffect(() => {
     // Set new target whenever props change
     targetBusPos.current = busLngLat;
     if (!currentBusPos.current) {
        currentBusPos.current = busLngLat;
     }
  }, [busLngLat]);

  useEffect(() => {
     const animate = () => {
        if (currentBusPos.current && targetBusPos.current && busMarkerRef.current && mapRef.current) {
            const [curLng, curLat] = currentBusPos.current;
            const [targetLng, targetLat] = targetBusPos.current;

            // Simple LERP: Move 10% of the way to target per frame
            const factor = 0.08; 
            const newLng = lerp(curLng, targetLng, factor);
            const newLat = lerp(curLat, targetLat, factor);

            // Update internal current position
            currentBusPos.current = [newLng, newLat];
            
            // Check if we are close enough to stop unnecessary calc (optimization)
            if (Math.abs(newLng - targetLng) > 0.000001 || Math.abs(newLat - targetLat) > 0.000001) {
                // Update Marker Visuals
                busMarkerRef.current.setLngLat([newLng, newLat]);

                // CRITICAL: If locked on bus, update camera frame-by-frame
                if (centerTarget === 'bus') {
                     mapRef.current.easeTo({
                         center: [newLng, newLat],
                         bearing: isHeadingUp ? bearing : mapRef.current.getBearing(), // Keep current bearing unless in Driver Mode
                         duration: 0, // Instant update for camera frame
                         easing: t => t
                     });
                }
            }
        }
        animationFrameRef.current = requestAnimationFrame(animate);
     };
     
     animationFrameRef.current = requestAnimationFrame(animate);

     return () => {
         if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
     };
  }, [isHeadingUp, centerTarget, bearing]);


  // Update Bus Marker Creation & Bearing Calculation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isLoading) return;

    if (isValidCoord(busLngLat[1], busLngLat[0])) {
      
      let currentBearing = bearing;

      if (typeof route.heading === 'number') {
        currentBearing = route.heading;
        if (Math.abs(currentBearing - bearing) > 1) {
          setBearing(currentBearing);
        }
      } else if (prevCoordsRef.current) {
        const newBearing = calculateBearing(prevCoordsRef.current, busLngLat);
        // Only update bearing if moving significantly to avoid jitter
        if (Math.abs(newBearing - bearing) > 10) {
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
                     <div class="absolute bottom-0 left-2 w-3 h-0.5 bg-slate-600 origin-left -rotate-12"></div>
                     <div class="absolute bottom-0 right-2 w-3 h-0.5 bg-slate-600 origin-right rotate-12"></div>
                  </div>
                  <div class="mx-auto w-6 h-8 border border-yellow-600/10 bg-yellow-400/30 rounded mt-3"></div>
                  <div class="mx-auto w-5 h-5 border border-yellow-600/10 bg-yellow-400/30 rounded-full mt-4"></div>
                  <div class="absolute bottom-1 w-full h-2 bg-slate-800/90"></div>
                  <div class="absolute bottom-0.5 left-1 w-2 h-1 bg-red-500 rounded-sm"></div>
                  <div class="absolute bottom-0.5 right-1 w-2 h-1 bg-red-500 rounded-sm"></div>
               </div>
               <div class="absolute top-6 -left-1.5 w-1.5 h-3 bg-slate-800 rounded-l-md border-r border-slate-600"></div>
               <div class="absolute top-6 -right-1.5 w-1.5 h-3 bg-slate-800 rounded-r-md border-l border-slate-600"></div>
               ${isLive ? '<div class="live-indicator absolute -top-1 -right-1 z-20 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse shadow-md"></div>' : ''}
            </div>
      `;

      if (!busMarkerRef.current) {
        const busEl = document.createElement('div');
        busEl.className = 'bus-marker';
        busEl.innerHTML = `<div style="transition: transform 0.3s ease-out; transform: rotate(${currentBearing}deg);">${getRealisticBusContent(route.isLive)}</div>`;

        // Initialize marker at current pos
        busMarkerRef.current = new maplibregl.Marker({ 
          element: busEl,
          anchor: 'center',
          rotationAlignment: 'map',
          pitchAlignment: 'map'
        }).setLngLat(currentBusPos.current || busLngLat).addTo(map);
      } else {
        // We only update inner HTML here (rotation/status). Position is handled by animation loop.
        const wrapper = busMarkerRef.current.getElement().firstElementChild as HTMLElement;
        if (wrapper) {
            wrapper.style.transform = `rotate(${currentBearing}deg)`;
            wrapper.innerHTML = getRealisticBusContent(route.isLive);
        }
      }
    }
  }, [route.heading, route.isLive, isLoading]); 

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

  const handleToggleLock = () => {
      if (centerTarget === 'bus') {
          setCenterTarget(null); // Unlock (User can pan/zoom)
      } else {
          setCenterTarget('bus'); // Hard Lock (User cannot pan/zoom)
          // Immediate jump to bus
          if (mapRef.current && currentBusPos.current) {
              mapRef.current.flyTo({ center: currentBusPos.current, zoom: 18 });
          }
      }
  };

  const handleRecenterUser = () => {
    if (!mapRef.current) return;
    
    // Toggle Logic: If locked on User -> Switch to Bus. Otherwise -> Switch to User.
    if (centerTarget === 'user') {
        setCenterTarget('bus');
        if (currentBusPos.current) {
            mapRef.current.flyTo({ center: currentBusPos.current, zoom: 17.5, pitch: 0 });
        }
    } else {
        if (userLocation) {
            setCenterTarget('user');
            mapRef.current.flyTo({ center: [userLocation[1], userLocation[0]], zoom: 17.5, pitch: 0 });
        } else {
            // Fallback if no user location: Go to bus if not already there
            setCenterTarget('bus');
            if (currentBusPos.current) {
                mapRef.current.flyTo({ center: currentBusPos.current, zoom: 17.5, pitch: 0 });
            }
        }
    }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    const { offset, velocity } = info;
    const currentY = snapPoint + offset.y;
    let nearest = snapPoint;
    const SNAP_THRESHOLD = 120;

    if (Math.abs(velocity.y) > 400) {
      if (velocity.y > 0) {
        if (snapPoint === EXPANDED_Y) nearest = COLLAPSED_Y;
        else if (snapPoint === COLLAPSED_Y) nearest = MINIMIZED_Y;
        else nearest = HIDDEN_Y;
      } else {
        if (snapPoint === HIDDEN_Y) nearest = MINIMIZED_Y;
        else if (snapPoint === MINIMIZED_Y) nearest = COLLAPSED_Y;
        else nearest = EXPANDED_Y;
      }
    } else {
      if (snapPoint === EXPANDED_Y) {
         if (offset.y > SNAP_THRESHOLD) nearest = COLLAPSED_Y;
         else nearest = EXPANDED_Y;
      } else if (snapPoint === COLLAPSED_Y) {
         if (offset.y < -SNAP_THRESHOLD) nearest = EXPANDED_Y;
         else if (offset.y > SNAP_THRESHOLD) nearest = MINIMIZED_Y;
         else nearest = COLLAPSED_Y;
      } else if (snapPoint === MINIMIZED_Y) {
         if (offset.y > 80) nearest = HIDDEN_Y;
         else if (offset.y < -SNAP_THRESHOLD) nearest = COLLAPSED_Y;
         else nearest = MINIMIZED_Y;
      }
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
             {userRole !== 'driver' && onSwitchRoute && (
                <button onClick={() => onSwitchRoute('prev')} className="p-1 rounded-full hover:bg-slate-100 active:scale-90"><ChevronLeft className="w-4 h-4 text-slate-400" /></button>
             )}
            <div className={`p-2 rounded-xl transition-colors ${route.isLive ? 'bg-green-100' : 'bg-slate-100'}`}>
               <div className={`w-3 h-3 rounded-full ${route.isLive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{route.isLive ? 'Live' : 'Stationary'}</p>
                <p className="font-extrabold text-slate-900 text-sm leading-none truncate max-w-[150px]">{route.name}</p>
            </div>
            {userRole !== 'driver' && onSwitchRoute && (
                <button onClick={() => onSwitchRoute('next')} className="p-1 rounded-full hover:bg-slate-100 active:scale-90"><ChevronRight className="w-4 h-4 text-slate-400" /></button>
            )}
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
          <div className="absolute bottom-[340px] right-6 z-[20] flex flex-col gap-3">
            {/* Lock on Bus Toggle */}
            <button 
                onClick={handleToggleLock}
                className={`p-4 rounded-2xl shadow-2xl border transition-all active:scale-90 ${centerTarget === 'bus' ? 'bg-green-500 border-green-400 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                title={centerTarget === 'bus' ? "Locked on Bus" : "Lock Camera to Bus"}
            >
                {centerTarget === 'bus' ? <Lock className="w-6 h-6" /> : <LockOpen className="w-6 h-6" />}
            </button>

            {userRole === 'driver' && (
              <button 
                onClick={toggleHeadingMode} 
                className={`p-4 rounded-2xl shadow-2xl border transition-all active:scale-90 ${isHeadingUp ? 'bg-yellow-400 border-yellow-500 text-slate-900' : 'bg-white border-slate-100 text-slate-900'}`}
              >
                  <Compass className={`w-6 h-6 ${isHeadingUp ? 'animate-pulse' : ''}`} />
              </button>
            )}

            {/* Recenter on User/Bus Toggle */}
            <button 
              onClick={handleRecenterUser} 
              className={`p-4 rounded-2xl shadow-2xl border transition-all active:scale-90 ${centerTarget === 'user' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
              title={centerTarget === 'user' ? "Go to Bus" : "Locate Me"}
            >
                {centerTarget === 'user' ? <Bus className="w-6 h-6" /> : <Crosshair className="w-6 h-6" />}
            </button>
          </div>
        )}
      </div>

      {userRole === 'driver' && !isLoading && (
        <div className="absolute bottom-24 left-0 right-0 z-[40] px-4">
           <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-2xl border border-white/10 flex flex-col gap-5">
              <div className="flex items-center gap-4 px-1">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${route.isLive ? 'bg-green-500/20' : 'bg-white/5'}`}>
                   {route.isLive ? <Eye className="w-6 h-6 text-green-400" /> : <EyeOff className="w-6 h-6 text-slate-500" />}
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-black text-[11px] uppercase tracking-[0.15em] mb-0.5">Live Tracking</h4>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-tight">Broadcasting on: <span className="text-white">{route.name}</span></p>
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
        <>
            <motion.div 
            drag="y" 
            dragConstraints={{ top: 0, bottom: screenHeight }} 
            dragElastic={0.2} 
            dragMomentum={false}
            animate={controls} 
            initial={{ y: COLLAPSED_Y }} 
            onDragEnd={handleDragEnd} 
            className="fixed inset-x-0 bottom-0 z-[1200] bg-white rounded-t-[40px] shadow-[0_-15px_40px_rgba(0,0,0,0.1)] flex flex-col h-screen overflow-hidden"
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

            <AnimatePresence>
                {snapPoint === HIDDEN_Y && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={() => {
                            setSnapPoint(COLLAPSED_Y);
                            controls.start({ y: COLLAPSED_Y });
                        }}
                        className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[50] bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 active:scale-95 transition-transform"
                    >
                        <Bus className="w-4 h-4" /> View Route
                    </motion.button>
                )}
            </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default MapInterface;