import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, X, Map as MapIcon, LogOut, Bus as BusIcon, User as UserIcon, Save, MapPin, Type, Truck, ChevronRight, Check, Navigation, GraduationCap, MapPinPlus, Waypoints, Search, Phone, Hash, RefreshCcw } from 'lucide-react';
import { BusRoute, BusStop, Bus, Driver, Student } from '../types.ts';
import { motion, AnimatePresence } from 'framer-motion';
import * as maplibregl from 'maplibre-gl';

interface AdminDashboardProps {
  routes: BusRoute[];
  buses: Bus[];
  drivers: Driver[];
  students: Student[];
  onUpdateRoutes: (routes: BusRoute[]) => void;
  onUpdateBuses: (buses: Bus[]) => void;
  onUpdateDrivers: (drivers: Driver[]) => void;
  onUpdateStudents: (students: Student[]) => void;
  onLogout?: () => void;
  onResetData?: () => void;
  userLocation: [number, number] | null;
}

const TIPTUR_LNG_LAT: [number, number] = [76.4764, 13.2642];
const BRANCHES = [
  'Civil Engineering',
  'Mechanical Engineering',
  'Electrical and Electronics Engineering',
  'Electronics and Communication Engineering',
  'Computer Science and Engineering',
  'Apparel Design and Fashion Technology'
];

type AdminTab = 'overview' | 'route' | 'bus' | 'driver' | 'student';
type EditorTab = 'NAME' | 'OSRM' | 'STOPS' | 'BUS';

export default function AdminDashboard({ 
  routes, buses, drivers, students, 
  onUpdateRoutes, onUpdateBuses, onUpdateDrivers, onUpdateStudents, 
  onLogout, onResetData,
  userLocation
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [currentEditTab, setCurrentEditTab] = useState<EditorTab>('NAME');
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  
  const [tempRouteName, setTempRouteName] = useState("");
  const [tempStops, setTempStops] = useState<BusStop[]>([]);
  const [tempPath, setTempPath] = useState<[number, number][]>([]);
  const [tempOSRMPoints, setTempOSRMPoints] = useState<[number, number][]>([]);
  const [tempBusData, setTempBusData] = useState({
    busId: '', numberPlate: '', driver: '', driverPhone: ''
  });

  const [isBusModalOpen, setIsBusModalOpen] = useState(false);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  const [busForm, setBusForm] = useState<Bus>({ id: '', numberPlate: '', driverId: '' });
  const [driverForm, setDriverForm] = useState<Driver>({ id: '', name: '', phone: '', email: '', password: '' });
  const [studentForm, setStudentForm] = useState<Student>({ 
    id: '', name: '', email: '', password: '', assignedRouteId: '', branch: '', mobileNumber: '', registerNumber: '485'
  });

  const [studentSearch, setStudentSearch] = useState('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const overviewMapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overviewMapRef = useRef<maplibregl.Map | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const osrmMarkersRef = useRef<maplibregl.Marker[]>([]);
  const overviewMarkersRef = useRef<maplibregl.Marker[]>([]);
  const osrmControllerRef = useRef<AbortController | null>(null);
  const [isOverviewMapLoaded, setIsOverviewMapLoaded] = useState(false);
  const [isEditorMapLoaded, setIsEditorMapLoaded] = useState(false);

  const fetchOSRMRouteFromCoords = useCallback(async (coordsList: [number, number][]): Promise<[number, number][]> => {
    if (coordsList.length < 2) return coordsList;
    
    // Abort previous request
    if (osrmControllerRef.current) {
      osrmControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    osrmControllerRef.current = controller;
    
    const coords = coordsList.map(c => `${c[0]},${c[1]}`).join(';');
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, {
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`OSRM HTTP Error: ${response.status}`);
      const data = await response.json();
      if (data.code === 'Ok' && data.routes?.length > 0) return data.routes[0].geometry.coordinates;
    } catch (e: any) { 
      const msg = e.message?.toLowerCase() || '';
      if (e.name !== 'AbortError' && !msg.includes('aborted') && !msg.includes('signal is aborted')) {
        console.warn("OSRM fetch failed:", e.message);
      }
    } finally {
      if (osrmControllerRef.current === controller) osrmControllerRef.current = null;
    }
    return coordsList;
  }, []);

  // --- Overview Map Logic ---
  useEffect(() => {
    if (activeTab !== 'overview' || isEditing || !overviewMapContainerRef.current) {
      if (overviewMapRef.current) {
        overviewMapRef.current.remove();
        overviewMapRef.current = null;
        setIsOverviewMapLoaded(false);
      }
      return;
    }
    
    const map = new maplibregl.Map({
      container: overviewMapContainerRef.current!,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: TIPTUR_LNG_LAT,
      zoom: 13,
      pitch: 45,
      antialias: false,
      attributionControl: false,
      fadeDuration: 0
    });

    map.on('load', () => setIsOverviewMapLoaded(true));
    overviewMapRef.current = map;
    return () => { if (overviewMapRef.current) overviewMapRef.current.remove(); overviewMapRef.current = null; };
  }, [activeTab, isEditing]);

  useEffect(() => {
    const map = overviewMapRef.current;
    if (!map || !isOverviewMapLoaded) return;

    overviewMarkersRef.current.forEach(m => m.remove());
    overviewMarkersRef.current = [];

    routes.forEach((route, routeIdx) => {
      const routeColor = routeIdx % 2 === 0 ? '#fbbf24' : '#3b82f6';
      const sourceId = `route-source-${route.id}`;
      const geojson = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.path || [] } };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson as any);
      } else {
        map.addSource(sourceId, { type: 'geojson', data: geojson as any });
        map.addLayer({ id: `route-layer-casing-${route.id}`, type: 'line', source: sourceId, paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.8 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
        map.addLayer({ id: `route-layer-${route.id}`, type: 'line', source: sourceId, paint: { 'line-color': routeColor, 'line-width': 4, 'line-opacity': 0.9 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
      }

      route.stops.forEach((stop, stopIdx) => {
        const el = document.createElement('div');
        el.className = `w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[8px] font-black text-white ${routeIdx % 2 === 0 ? 'bg-yellow-500' : 'bg-blue-500'}`;
        el.innerText = (stopIdx + 1).toString();
        overviewMarkersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(map));
      });

      const busLat = route.actualLat || route.liveLat || (route.stops[0]?.lat);
      const busLng = route.actualLng || route.liveLng || (route.stops[0]?.lng);
      if (busLat && busLng) {
        const el = document.createElement('div');
        el.className = `w-7 h-7 rounded-full border-2 border-white shadow-xl ring-2 flex items-center justify-center ${route.isLive ? 'bg-green-400 ring-green-200' : 'bg-red-400 ring-red-100'}`;
        el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h10"/><circle cx="7" cy="17" r="2"/><circle cx="15" cy="17" r="2"/></svg>`;
        overviewMarkersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([busLng, busLat]).addTo(map));
      }
    });

    if (userLocation) {
      const el = document.createElement('div');
      el.className = 'w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-xl ring-2 ring-blue-100';
      overviewMarkersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([userLocation[1], userLocation[0]]).addTo(map));
    }
  }, [routes, userLocation, isOverviewMapLoaded]);

  // --- Editor Map Logic ---
  useEffect(() => {
    if (!isEditing || !mapContainerRef.current || (currentEditTab !== 'OSRM' && currentEditTab !== 'STOPS')) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setIsEditorMapLoaded(false);
      }
      return;
    }
    
    const center = tempStops.length > 0 ? [tempStops[0].lng, tempStops[0].lat] : TIPTUR_LNG_LAT;
    const map = new maplibregl.Map({
      container: mapContainerRef.current!,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: center as [number, number],
      zoom: 15,
      antialias: false,
      attributionControl: false,
      fadeDuration: 0,
    });

    map.on('load', () => {
      map.addSource('route-line', { 
        type: 'geojson', 
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: tempPath.length > 1 ? tempPath : [center] } } 
      });
      map.addLayer({ id: 'route-line-casing', type: 'line', source: 'route-line', paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.8 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
      map.addLayer({ id: 'route-line-layer', type: 'line', source: 'route-line', paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 1 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
      setIsEditorMapLoaded(true);
    });

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      if (currentEditTab === 'OSRM') {
        setTempOSRMPoints(prev => [...prev, [lng, lat] as [number, number]]);
      } else if (currentEditTab === 'STOPS') {
        setTempStops(prev => [...prev, { id: `stop-${Date.now()}`, name: `Stop ${prev.length + 1}`, time: '08:00 AM', status: 'upcoming', lat, lng }]);
      }
    });

    mapRef.current = map;
    return () => { if (mapRef.current) mapRef.current.remove(); mapRef.current = null; };
  }, [isEditing, currentEditTab]);

  // Sync Editor Map Visuals (Prevents Reset on re-renders)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isEditorMapLoaded) return;

    // Update Path
    const source = map.getSource('route-line') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: tempPath.length > 1 ? tempPath : (tempStops.length > 0 ? [[tempStops[0].lng, tempStops[0].lat]] : [TIPTUR_LNG_LAT]) } } as any);
    }

    // Update Stop Markers
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = tempStops.map((stop, idx) => {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 bg-slate-900 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white text-[10px] font-black';
      el.innerText = (idx + 1).toString();
      return new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(map);
    });

    // Update OSRM Waypoint Markers
    osrmMarkersRef.current.forEach(m => m.remove());
    osrmMarkersRef.current = tempOSRMPoints.map((pt) => {
      const el = document.createElement('div');
      el.className = 'w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md';
      return new maplibregl.Marker({ element: el }).setLngLat(pt).addTo(map);
    });

  }, [tempPath, tempStops, tempOSRMPoints, isEditorMapLoaded, currentEditTab]);

  // Auto-fetch OSRM path when waypoints change
  useEffect(() => {
    if (tempOSRMPoints.length < 2) return;
    const updatePath = async () => {
      const roadPath = await fetchOSRMRouteFromCoords(tempOSRMPoints);
      setTempPath(roadPath);
    };
    updatePath();
  }, [tempOSRMPoints, fetchOSRMRouteFromCoords]);

  const startEditingRoute = (route?: BusRoute) => {
    if (route) {
      setEditingRouteId(route.id);
      setTempRouteName(route.name);
      setTempStops([...(route.stops || [])]);
      setTempPath([...(route.path || [])]);
      setTempOSRMPoints([]); 
      setTempBusData({ busId: route.busId || '', numberPlate: route.numberPlate, driver: route.driver, driverPhone: route.driverPhone });
    } else {
      setEditingRouteId(null);
      setTempRouteName("");
      setTempStops([]);
      setTempPath([]);
      setTempOSRMPoints([]);
      setTempBusData({ busId: '', numberPlate: '', driver: '', driverPhone: '' });
    }
    setIsEditing(true);
    setCurrentEditTab('NAME');
  };

  const handleSaveAll = () => {
    const selectedBus = buses.find(b => b.id === tempBusData.busId);
    const selectedDriver = drivers.find(d => d.id === selectedBus?.driverId);
    const updatedData: Partial<BusRoute> = { 
      name: tempRouteName || "New Route", 
      stops: [...tempStops], 
      path: [...tempPath], 
      driver: selectedDriver?.name || "Unassigned", 
      driverPhone: selectedDriver?.phone || "N/A", 
      numberPlate: selectedBus?.numberPlate || "TBD", 
      busId: tempBusData.busId, 
      eta: '---' 
    };
    if (editingRouteId) {
      onUpdateRoutes(routes.map(r => r.id === editingRouteId ? { ...r, ...updatedData } : r));
    } else {
      onUpdateRoutes([...routes, { id: `R-${Date.now()}`, ...updatedData as BusRoute, isLive: false, liveLat: tempStops[0]?.lat || TIPTUR_LNG_LAT[1], liveLng: tempStops[0]?.lng || TIPTUR_LNG_LAT[0] }]);
    }
    setIsEditing(false);
  };

  const openDriverModal = (driver?: Driver) => {
    setDriverForm(driver || { id: '', name: '', phone: '', email: '', password: '' });
    setEditingDriverId(driver ? driver.id : null);
    setIsDriverModalOpen(true);
  };

  const handleSaveDriver = () => {
    if (editingDriverId) onUpdateDrivers(drivers.map(d => d.id === editingDriverId ? { ...driverForm } : d));
    else onUpdateDrivers([...drivers, { ...driverForm, id: `D-${Date.now()}` }]);
    setIsDriverModalOpen(false);
  };

  const openStudentModal = (student?: Student) => {
    setStudentForm(student || { id: '', name: '', email: '', password: '', assignedRouteId: '', branch: '', mobileNumber: '', registerNumber: '485' });
    setEditingStudentId(student ? student.id : null);
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = () => {
    if (editingStudentId) onUpdateStudents(students.map(s => s.id === editingStudentId ? { ...studentForm } : s));
    else onUpdateStudents([...students, { ...studentForm, id: `S-${Date.now()}` }]);
    setIsStudentModalOpen(false);
  };

  const openBusModal = (bus?: Bus) => {
    setBusForm(bus || { id: '', numberPlate: '', driverId: '' });
    setEditingBusId(bus ? bus.id : null);
    setIsBusModalOpen(true);
  };

  const handleSaveBus = () => {
    if (editingBusId) onUpdateBuses(buses.map(b => b.id === editingBusId ? { ...busForm } : b));
    else onUpdateBuses([...buses, { ...busForm, id: `B-${Date.now()}` }]);
    setIsBusModalOpen(false);
  };

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.mobileNumber?.includes(studentSearch) || s.registerNumber?.includes(studentSearch));

  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-hidden relative">
      {!isEditing && (
        <div className="p-6 bg-white border-b border-slate-100 shrink-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900">Fleet Admin</h2>
            <div className="flex gap-2">
              <button onClick={onResetData} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500" title="Reset All Data"><RefreshCcw className="w-5 h-5" /></button>
              <button onClick={onLogout} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:bg-slate-100"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex p-1 bg-slate-100 rounded-2xl items-center overflow-x-auto no-scrollbar gap-1">
            {['overview', 'route', 'bus', 'driver', 'student'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as AdminTab)} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {!isEditing && activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            <div ref={overviewMapContainerRef} className="w-full h-80 rounded-[2.5rem] bg-slate-900 border-4 border-white shadow-2xl overflow-hidden" />
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Drivers</p><p className="text-3xl font-black text-slate-900">{drivers.length}</p></div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Students</p><p className="text-3xl font-black text-blue-500">{students.length}</p></div>
            </div>
          </div>
        )}

        {!isEditing && activeTab === 'route' && (
          <div className="p-6 space-y-4">
            <button onClick={() => startEditingRoute()} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> New Route</button>
            {routes.map(r => (
              <div key={r.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4"><div className="bg-yellow-50 p-3 rounded-xl"><MapIcon className="w-5 h-5 text-yellow-600" /></div><div><span className="font-bold text-slate-900 block">{r.name}</span><span className="text-[9px] font-black text-slate-400 uppercase">{r.numberPlate || 'No Bus'}</span></div></div>
                <div className="flex gap-2"><button onClick={() => startEditingRoute(r)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500"><Edit3 className="w-4 h-4" /></button><button onClick={() => onUpdateRoutes(routes.filter(rt => rt.id !== r.id))} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>
              </div>
            ))}
          </div>
        )}

        {!isEditing && activeTab === 'bus' && (
          <div className="p-6 space-y-4">
            <button onClick={() => openBusModal()} className="w-full bg-yellow-400 text-slate-900 py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add Bus</button>
            {buses.map(b => (
              <div key={b.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4"><div className="bg-slate-50 p-3 rounded-xl"><BusIcon className="w-5 h-5 text-slate-400" /></div><div><span className="font-bold text-slate-900 block">{b.numberPlate}</span><span className="text-[9px] font-black text-slate-400 uppercase">Driver: {drivers.find(d => d.id === b.driverId)?.name || 'Unassigned'}</span></div></div>
                <div className="flex gap-2"><button onClick={() => openBusModal(b)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500"><Edit3 className="w-4 h-4" /></button><button onClick={() => onUpdateBuses(buses.filter(bus => bus.id !== b.id))} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>
              </div>
            ))}
          </div>
        )}

        {!isEditing && activeTab === 'driver' && (
          <div className="p-6 space-y-4">
            <button onClick={() => openDriverModal()} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> New Driver</button>
            {drivers.map(d => (
              <div key={d.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4"><div className="bg-blue-50 p-3 rounded-xl"><UserIcon className="w-5 h-5 text-blue-500" /></div><div><span className="font-bold text-slate-900 block">{d.name}</span><span className="text-[9px] font-black text-slate-400 uppercase">{d.email}</span></div></div>
                <div className="flex gap-2"><button onClick={() => openDriverModal(d)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500"><Edit3 className="w-4 h-4" /></button><button onClick={() => onUpdateDrivers(drivers.filter(drv => drv.id !== d.id))} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>
              </div>
            ))}
          </div>
        )}

        {!isEditing && activeTab === 'student' && (
          <div className="p-6 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Search Name..." className="w-full bg-white border border-slate-200 py-4 pl-12 pr-4 rounded-2xl text-xs font-bold text-slate-900 outline-none" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} /></div>
              <button onClick={() => openStudentModal()} className="bg-blue-500 text-white p-4 rounded-2xl transition-transform active:scale-95"><Plus className="w-5 h-5" /></button>
            </div>
            {filteredStudents.map(s => (
              <div key={s.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4"><div className="bg-purple-50 p-3 rounded-xl"><GraduationCap className="w-5 h-5 text-purple-500" /></div><div><span className="font-bold text-slate-900 block">{s.name}</span><span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{s.registerNumber}</span></div></div>
                <div className="flex gap-2"><button onClick={() => openStudentModal(s)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500"><Edit3 className="w-4 h-4" /></button><button onClick={() => onUpdateStudents(students.filter(std => std.id !== s.id))} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 z-[100] bg-white flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div><h3 className="text-xl font-black text-slate-900">{editingRouteId ? 'Edit Route' : 'New Route'}</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tempRouteName || 'Unnamed Draft'}</p></div>
              <div className="flex gap-2"><button onClick={handleSaveAll} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg">Save Changes</button><button onClick={() => setIsEditing(false)} className="p-3 bg-slate-100 rounded-2xl text-slate-500"><X className="w-5 h-5" /></button></div>
            </div>
            <div className="flex p-2 bg-slate-50 border-b border-slate-100 shrink-0">
               {[{ id: 'NAME', icon: Type, label: 'Name' }, { id: 'OSRM', icon: Waypoints, label: 'Path' }, { id: 'STOPS', icon: MapPinPlus, label: 'Stops' }, { id: 'BUS', icon: BusIcon, label: 'Bus' }].map(tab => (
                 <button key={tab.id} onClick={() => setCurrentEditTab(tab.id as EditorTab)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentEditTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}><tab.icon className="w-3.5 h-3.5" />{tab.label}</button>
               ))}
            </div>
            <div className="flex-1 relative overflow-hidden flex flex-col">
               {currentEditTab === 'NAME' && (
                 <div className="p-8 flex flex-col items-center justify-center h-full space-y-4"><Type className="w-12 h-12 text-slate-200 mb-4" /><div className="w-full max-w-sm space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Route Title</label><input className="w-full bg-slate-50 p-6 rounded-[2rem] text-xl font-black text-slate-900 outline-none text-center border-2 border-transparent focus:border-blue-100 transition-all" placeholder="e.g. Campus Express" value={tempRouteName} onChange={e => setTempRouteName(e.target.value)} /></div></div>
               )}
               {(currentEditTab === 'OSRM' || currentEditTab === 'STOPS') && (
                 <div className="relative flex-1 bg-slate-100"><div ref={mapContainerRef} className="absolute inset-0" /><div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-100 pointer-events-none"><p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{currentEditTab === 'OSRM' ? 'Click map to add waypoints' : 'Click map to place stops'}</p></div>
                   {(currentEditTab === 'OSRM' && tempOSRMPoints.length > 0) && (<button onClick={() => { setTempOSRMPoints([]); }} className="absolute bottom-6 right-6 z-10 bg-white text-red-500 font-black px-6 py-3 rounded-2xl shadow-xl border border-red-50 text-[10px] uppercase tracking-widest">Clear Markers</button>)}
                   {(currentEditTab === 'STOPS' && tempStops.length > 0) && (<button onClick={() => { setTempStops([]); }} className="absolute bottom-6 right-6 z-10 bg-white text-red-500 font-black px-6 py-3 rounded-2xl shadow-xl border border-red-50 text-[10px] uppercase tracking-widest">Clear Stops</button>)}
                 </div>
               )}
               {currentEditTab === 'BUS' && (
                 <div className="p-8 space-y-4 overflow-y-auto h-full no-scrollbar bg-slate-50"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Available Fleet</h4>{buses.map(b => (<button key={b.id} onClick={() => setTempBusData({...tempBusData, busId: b.id, numberPlate: b.numberPlate})} className={`w-full p-6 rounded-[2.5rem] border transition-all flex items-center justify-between group ${tempBusData.busId === b.id ? 'bg-yellow-400 border-yellow-300' : 'bg-white border-slate-100'}`}><div className="flex items-center gap-4"><div className="p-4 rounded-2xl bg-slate-50"><BusIcon className="w-6 h-6 text-slate-400" /></div><div className="text-left"><p className="font-black text-slate-900">{b.numberPlate}</p><p className="text-[10px] font-black uppercase tracking-widest">Driver: {drivers.find(d => d.id === b.driverId)?.name || 'Unassigned'}</p></div></div>{tempBusData.busId === b.id && (<div className="bg-slate-900 rounded-full p-1.5 shadow-lg"><Check className="w-4 h-4 text-yellow-400" /></div>)}</button>))}</div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDriverModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-4 border border-slate-100">
              <div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-900">{editingDriverId ? 'Edit Driver' : 'Add Driver'}</h3><button onClick={() => setIsDriverModalOpen(false)}><X className="text-slate-400"/></button></div>
              <div className="space-y-4">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Full Name</label><input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" placeholder="Name" value={driverForm.name} onChange={e => setDriverForm({...driverForm, name: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Email</label><input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" placeholder="Email" value={driverForm.email} onChange={e => setDriverForm({...driverForm, email: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Password</label><input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" placeholder="Password" type="password" value={driverForm.password || ''} onChange={e => setDriverForm({...driverForm, password: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Phone</label><input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" placeholder="Phone" value={driverForm.phone} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} /></div>
              </div>
              <button onClick={handleSaveDriver} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl">Save Driver</button>
            </div>
          </motion.div>
        )}
        {isStudentModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-4 border border-slate-100 my-auto">
              <div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-900">{editingStudentId ? 'Edit Student' : 'Add Student'}</h3><button onClick={() => setIsStudentModalOpen(false)}><X className="text-slate-400"/></button></div>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Full Name</label><input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" placeholder="Name" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Branch</label><select className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none appearance-none" value={studentForm.branch} onChange={e => setStudentForm({...studentForm, branch: e.target.value})}><option value="">Select Branch</option>{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Register Number</label><input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" placeholder="Reg No" value={studentForm.registerNumber} onChange={e => setStudentForm({...studentForm, registerNumber: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Email Address</label><input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" placeholder="Email" value={studentForm.email} onChange={e => setStudentForm({...studentForm, email: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Password</label><input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" placeholder="Password" type="password" value={studentForm.password || ''} onChange={e => setStudentForm({...studentForm, password: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Mobile Number</label><input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" placeholder="Mobile" value={studentForm.mobileNumber} onChange={e => setStudentForm({...studentForm, mobileNumber: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Assigned Route</label><select className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" value={studentForm.assignedRouteId} onChange={e => setStudentForm({...studentForm, assignedRouteId: e.target.value})}><option value="">Select Route</option>{routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              </div>
              <button onClick={handleSaveStudent} className="w-full bg-blue-500 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 mt-2">Save Student</button>
            </div>
          </motion.div>
        )}
        {isBusModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-4 border border-slate-100">
              <div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-900">{editingBusId ? 'Edit Bus' : 'Add Bus'}</h3><button onClick={() => setIsBusModalOpen(false)}><X className="text-slate-400"/></button></div>
              <div className="space-y-4">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Number Plate</label><input className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" placeholder="e.g. KA-01-CB-1234" value={busForm.numberPlate} onChange={e => setBusForm({...busForm, numberPlate: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Assign Driver</label><select className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-900 outline-none" value={busForm.driverId} onChange={e => setBusForm({...busForm, driverId: e.target.value})}><option value="">Select Driver</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              </div>
              <button onClick={handleSaveBus} className="w-full bg-yellow-400 text-slate-900 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl">Save Bus</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}