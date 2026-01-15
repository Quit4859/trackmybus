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
    id: '', name: '', email: '', password: '', assignedRouteId: '', branch: '', mobileNumber: '', registerNumber: ''
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
    
    if (osrmControllerRef.current) {
      osrmControllerRef.current.abort("New OSRM request started");
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
      if (e.name !== 'AbortError') {
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
  }, [routes, isOverviewMapLoaded]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isEditorMapLoaded) return;

    const source = map.getSource('route-line') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: tempPath.length > 1 ? tempPath : (tempStops.length > 0 ? [[tempStops[0].lng, tempStops[0].lat]] : [TIPTUR_LNG_LAT]) } } as any);
    }

    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = tempStops.map((stop, idx) => {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 bg-slate-900 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white text-[10px] font-black';
      el.innerText = (idx + 1).toString();
      return new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(map);
    });

    osrmMarkersRef.current.forEach(m => m.remove());
    osrmMarkersRef.current = tempOSRMPoints.map((pt) => {
      const el = document.createElement('div');
      el.className = 'w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md';
      return new maplibregl.Marker({ element: el }).setLngLat(pt).addTo(map);
    });
  }, [tempPath, tempStops, tempOSRMPoints, isEditorMapLoaded, currentEditTab]);

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
    setStudentForm(student || { id: '', name: '', email: '', password: '', assignedRouteId: '', branch: '', mobileNumber: '', registerNumber: '' });
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

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
    s.mobileNumber?.includes(studentSearch) || 
    s.registerNumber?.includes(studentSearch)
  );

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
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search students..." 
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
              <button onClick={() => openStudentModal()} className="bg-slate-900 text-white p-4 rounded-2xl"><Plus className="w-5 h-5" /></button>
            </div>
            {filteredStudents.map(s => (
              <div key={s.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-50 p-3 rounded-xl"><GraduationCap className="w-5 h-5 text-indigo-500" /></div>
                  <div>
                    <span className="font-bold text-slate-900 block">{s.name}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase">{s.registerNumber} • {s.branch}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openStudentModal(s)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => onUpdateStudents(students.filter(std => std.id !== s.id))} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isEditing && (
        <div className="absolute inset-0 z-[2000] bg-white flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <button onClick={() => setIsEditing(false)} className="p-2 bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Route Editor</h3>
            <button onClick={handleSaveAll} className="p-2 bg-blue-600 text-white rounded-xl"><Check className="w-5 h-5" /></button>
          </div>
          
          <div className="flex p-4 gap-2 overflow-x-auto no-scrollbar">
            {['NAME', 'OSRM', 'STOPS', 'BUS'].map((tab) => (
              <button key={tab} onClick={() => setCurrentEditTab(tab as EditorTab)} className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl whitespace-nowrap ${currentEditTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {currentEditTab === 'NAME' && (
              <div className="p-8 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Route Name</label>
                    <div className="relative">
                      <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" value={tempRouteName} onChange={e => setTempRouteName(e.target.value)} placeholder="e.g. Campus Express" className="w-full bg-slate-50 rounded-2xl p-4 pl-12 text-sm font-bold border-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                 </div>
              </div>
            )}

            {(currentEditTab === 'OSRM' || currentEditTab === 'STOPS') && (
              <div className="flex-1 flex flex-col relative">
                <div ref={mapContainerRef} className="flex-1" />
                <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-white/50">
                  <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    {currentEditTab === 'OSRM' ? <Waypoints className="w-3 h-3 text-blue-500" /> : <MapPinPlus className="w-3 h-3 text-slate-900" />}
                    {currentEditTab === 'OSRM' ? 'Tap road waypoints for path' : 'Tap to place bus stops'}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => currentEditTab === 'OSRM' ? setTempOSRMPoints([]) : setTempStops([])} className="px-4 py-2 bg-slate-100 rounded-xl text-[9px] font-black uppercase text-slate-500">Reset</button>
                  </div>
                </div>
              </div>
            )}

            {currentEditTab === 'BUS' && (
              <div className="p-8 space-y-6">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Assign Bus</label>
                   <select 
                    value={tempBusData.busId} 
                    onChange={e => setTempBusData({ ...tempBusData, busId: e.target.value })}
                    className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none focus:ring-2 focus:ring-blue-100 appearance-none"
                   >
                     <option value="">Select a Bus</option>
                     {buses.map(b => <option key={b.id} value={b.id}>{b.numberPlate}</option>)}
                   </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {isBusModalOpen && (
          <div className="fixed inset-0 z-[3000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-lg font-black text-slate-900 mb-6">{editingBusId ? 'Edit Bus' : 'Add Bus'}</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Number Plate (e.g. KA-01-CB-1234)" value={busForm.numberPlate} onChange={e => setBusForm({...busForm, numberPlate: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none" />
                <select value={busForm.driverId} onChange={e => setBusForm({...busForm, driverId: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none">
                  <option value="">Assign Driver</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setIsBusModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl text-[10px] font-black uppercase">Cancel</button>
                  <button onClick={handleSaveBus} className="flex-1 py-4 bg-yellow-400 text-slate-900 rounded-2xl text-[10px] font-black uppercase">Save</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isDriverModalOpen && (
          <div className="fixed inset-0 z-[3000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[80vh] no-scrollbar">
              <h3 className="text-lg font-black text-slate-900 mb-6">{editingDriverId ? 'Edit Driver' : 'Add Driver'}</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name" value={driverForm.name} onChange={e => setDriverForm({...driverForm, name: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none" />
                <input type="text" placeholder="Phone Number" value={driverForm.phone} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none" />
                <input type="email" placeholder="Email" value={driverForm.email} onChange={e => setDriverForm({...driverForm, email: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none" />
                <input type="password" placeholder="Password" value={driverForm.password} onChange={e => setDriverForm({...driverForm, password: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none" />
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setIsDriverModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl text-[10px] font-black uppercase">Cancel</button>
                  <button onClick={handleSaveDriver} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase">Save</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isStudentModalOpen && (
          <div className="fixed inset-0 z-[3000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
              <h3 className="text-lg font-black text-slate-900 mb-6">{editingStudentId ? 'Edit Student' : 'Add Student'}</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none" />
                <input type="text" placeholder="Register Number" value={studentForm.registerNumber} onChange={e => setStudentForm({...studentForm, registerNumber: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none" />
                <select value={studentForm.branch} onChange={e => setStudentForm({...studentForm, branch: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none">
                  <option value="">Select Branch</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <input type="text" placeholder="Mobile Number" value={studentForm.mobileNumber} onChange={e => setStudentForm({...studentForm, mobileNumber: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none" />
                <input type="email" placeholder="Email" value={studentForm.email} onChange={e => setStudentForm({...studentForm, email: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none" />
                <input type="password" placeholder="Password" value={studentForm.password} onChange={e => setStudentForm({...studentForm, password: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none" />
                <select value={studentForm.assignedRouteId} onChange={e => setStudentForm({...studentForm, assignedRouteId: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border-none">
                  <option value="">Assign Route</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setIsStudentModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl text-[10px] font-black uppercase">Cancel</button>
                  <button onClick={handleSaveStudent} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase">Save</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}