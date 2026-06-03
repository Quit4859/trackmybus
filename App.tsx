import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ViewState, BusRoute, Bus, Driver, Student, EmergencyAlert } from './types.ts';
import MapInterface from './components/MapInterface.tsx';
import AIChatbot from './components/AIChatbot.tsx';
import BottomNav from './components/BottomNav.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import DriverDashboard from './components/DriverDashboard.tsx';
import LoginPage from './components/LoginPage.tsx';
import { User, LogOut, RefreshCw, CloudLightning, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { connectToRealtime, publishBusUpdate, publishGlobalConfig, publishEmergency, BusUpdatePayload, GlobalConfigPayload } from './services/realtimeService.ts';

const INITIAL_DRIVERS: Driver[] = [
  { id: 'D-1', name: 'Rajesh Kumar', phone: '+91 98765 43210', email: 'driver@gmail.com', password: '123123' }
];

const INITIAL_STUDENTS: Student[] = [
  { 
    id: 'S-1', 
    name: 'Student One', 
    email: 'student@gmail.com', 
    password: '123123', 
    assignedRouteId: 'R-101',
    branch: 'Computer Science and Engineering',
    mobileNumber: '9988776655',
    registerNumber: '485CSE21001'
  }
];

const INITIAL_BUSES: Bus[] = [
  { id: 'B-1', numberPlate: 'KA-01-CB-1234', driverId: 'D-1' }
];

const INITIAL_ROUTES: BusRoute[] = [
  {
    id: 'R-101',
    name: 'Tiptur Campus Express',
    driver: 'Rajesh Kumar',
    driverPhone: '+91 98765 43210',
    numberPlate: 'KA-01-CB-1234',
    busId: 'B-1',
    eta: '12 mins',
    isLive: false,
    direction: 'morning',
    eveningTimes: {
      '1': '05:00 PM',
      '2': '04:55 PM',
      '3': '04:50 PM',
      '4': '04:45 PM',
      '5': '04:40 PM',
      '6': '04:35 PM',
      '7': '04:30 PM'
    },
    stops: [
      { id: '1', name: 'Tiptur Railway Station', time: '07:30 AM', status: 'passed', lat: 13.2642, lng: 76.4764 },
      { id: '2', name: 'KSRTC Bus Stand', time: '07:35 AM', status: 'passed', lat: 13.2655, lng: 76.4785 },
      { id: '3', name: 'Koppa Circle', time: '07:40 AM', status: 'passed', lat: 13.2668, lng: 76.4802 },
      { id: '4', name: 'Post Office Junction', time: '07:45 AM', status: 'passed', lat: 13.2682, lng: 76.4827 },
      { id: '5', name: 'Gandhi Nagar Main', time: '07:50 AM', status: 'current', lat: 13.2698, lng: 76.4849 },
      { id: '6', name: 'Science Block Gate', time: '07:55 AM', status: 'upcoming', lat: 13.2720, lng: 76.4880 },
      { id: '7', name: 'Main Campus Terminal', time: '08:00 AM', status: 'upcoming', lat: 13.2735, lng: 76.4905 },
    ],
    path: [
      [76.4764, 13.2642],
      [76.4785, 13.2655],
      [76.4802, 13.2668],
      [76.4827, 13.2682],
      [76.4849, 13.2698],
      [76.4880, 13.2720],
      [76.4905, 13.2735]
    ],
    liveLat: 13.2698,
    liveLng: 76.4849,
    actualLat: 13.2698,
    actualLng: 76.4849,
    heading: 0
  }
];

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<ViewState>('TRACKING');
  const [userRole, setUserRole] = useState<'student' | 'admin' | 'driver'>('student');
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'>('DISCONNECTED');
  const [showConnectionToast, setShowConnectionToast] = useState(true);

  // Auto-dismiss Connection Status Toast after 5 seconds to prevent persistent offline warning
  useEffect(() => {
    if (connectionStatus !== 'CONNECTED') {
      setShowConnectionToast(true);
      const timer = setTimeout(() => {
        setShowConnectionToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowConnectionToast(false);
    }
  }, [connectionStatus]);
  
  // Persistence Loading
  const loadStored = <T,>(key: string, fallback: T): T => {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    try {
      return JSON.parse(stored);
    } catch {
      return fallback;
    }
  };

  const [routes, setRoutes] = useState<BusRoute[]>(() => loadStored('bus_routes', INITIAL_ROUTES));
  const [buses, setBuses] = useState<Bus[]>(() => loadStored('bus_fleet', INITIAL_BUSES));
  const [drivers, setDrivers] = useState<Driver[]>(() => loadStored('bus_drivers', INITIAL_DRIVERS));
  const [students, setStudents] = useState<Student[]>(() => loadStored('bus_students', INITIAL_STUDENTS));
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlert[]>(() => loadStored('emergency_alerts', []));
  
  // Ref to access routes inside effects without dependency cycles
  const routesRef = useRef(routes);
  useEffect(() => { routesRef.current = routes; }, [routes]);

  const lastAutoDirRef = useRef<'morning' | 'evening' | null>(null);

  const [activeRouteId, setActiveRouteId] = useState<string>(() => {
    const storedRoutes = loadStored('bus_routes', INITIAL_ROUTES);
    return storedRoutes.length > 0 ? storedRoutes[0].id : '';
  });
  
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [userHeading, setUserHeading] = useState<number>(0);
  const [gpsError, setGpsError] = useState<{ message: string; code: number; details?: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showEmergencyConfirmation, setShowEmergencyConfirmation] = useState(false);

  // Persistence Saving - Local
  useEffect(() => { localStorage.setItem('bus_routes', JSON.stringify(routes)); }, [routes]);
  useEffect(() => { localStorage.setItem('bus_fleet', JSON.stringify(buses)); }, [buses]);
  useEffect(() => { localStorage.setItem('bus_drivers', JSON.stringify(drivers)); }, [drivers]);
  useEffect(() => { localStorage.setItem('bus_students', JSON.stringify(students)); }, [students]);
  useEffect(() => { localStorage.setItem('emergency_alerts', JSON.stringify(emergencyAlerts)); }, [emergencyAlerts]);

  // --- Auto Upgrade/Sync Migration ---
  useEffect(() => {
    const r101 = routes.find(r => r.id === 'R-101');
    if (r101 && (r101.stops.length === 3 || !r101.eveningTimes)) {
      console.log("Upgraded stale R-101 in local storage to 7-stops route with evening times!");
      setRoutes(INITIAL_ROUTES);
    }
  }, []);

  // --- Automation: Auto transition shift/direction based on morning/evening time ---
  useEffect(() => {
    const applyAutoShiftTransition = () => {
      const now = new Date();
      const hours = now.getHours();
      // After 11:59 AM (>= 12:00 PM) we change to evening.
      // After 11:59 PM (>= 12:00 AM) we change to morning.
      const expectedDir: 'morning' | 'evening' = hours >= 12 ? 'evening' : 'morning';

      // We only execute state updates when boundary changes to prevent overriding manual overrides
      if (lastAutoDirRef.current === expectedDir) return;

      lastAutoDirRef.current = expectedDir;

      setRoutes(prev => {
        let hasChanges = false;
        const updated = prev.map(r => {
          if (r.direction !== expectedDir) {
            hasChanges = true;
            const startStop = expectedDir === 'evening'
              ? r.stops[r.stops.length - 1]
              : r.stops[0];
            return {
              ...r,
              direction: expectedDir,
              liveLat: r.isLive ? r.liveLat : startStop.lat,
              liveLng: r.isLive ? r.liveLng : startStop.lng,
              actualLat: r.isLive ? r.actualLat : startStop.lat,
              actualLng: r.isLive ? r.actualLng : startStop.lng
            };
          }
          return r;
        });

        if (hasChanges) {
          console.log(`⏰ [Auto Shift Automation] Shift changed to ${expectedDir}. Transitioning all routes.`);
          publishGlobalConfig({
            routes: updated,
            buses: buses,
            drivers: drivers,
            students: students
          });
          return updated;
        }
        return prev;
      });
    };

    applyAutoShiftTransition();
    const interval = setInterval(applyAutoShiftTransition, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, [buses, drivers, students]);

  // --- Automatic Route Assignment Logic ---
  useEffect(() => {
    if (isLoggedIn && userRole === 'driver' && currentUser) {
      const bus = buses.find(b => b.driverId === currentUser.id);
      const route = routes.find(r => r.busId === bus?.id);
      if (route && route.id !== activeRouteId) {
        console.log(`🔄 Auto-assigning Driver to Route: ${route.name}`);
        setActiveRouteId(route.id);
      }
    }
  }, [routes, buses, isLoggedIn, userRole, currentUser]);

  // --- Real-time Logic ---

  // 1. Define handlers
  const handleBusUpdate = useCallback((data: BusUpdatePayload) => {
    // Prevent Echo: If I am the driver for Route X, ignore updates about Route X coming from the server
    if (userRole === 'driver' && activeRouteId === data.routeId) return;

    setRoutes(prev => prev.map(r => {
      if (r.id === data.routeId) {
        return {
          ...r,
          liveLat: data.lat,
          liveLng: data.lng,
          actualLat: data.lat, 
          actualLng: data.lng,
          heading: data.heading,
          isLive: data.isLive,
          direction: data.direction || r.direction
        };
      }
      return r;
    }));
  }, [userRole, activeRouteId]);

  const handleConfigUpdate = useCallback((data: GlobalConfigPayload) => {
    if (userRole === 'admin') return; 

    console.log("☁️ Applying Global Cloud Config...");
    setIsCloudSyncing(true);
    
    if (data.routes) setRoutes(data.routes);
    if (data.buses) setBuses(data.buses);
    if (data.drivers) setDrivers(data.drivers);
    if (data.students) setStudents(data.students);
    
    setTimeout(() => setIsCloudSyncing(false), 2000);
  }, [userRole]);

  const handleEmergencyUpdate = useCallback((data: EmergencyAlert) => {
    setEmergencyAlerts(prev => {
      if (prev.some(a => a.id === data.id)) return prev;
      return [data, ...prev];
    });
    
    // If admin, maybe show a notification
    if (userRole === 'admin') {
      console.log("🚨 ADMIN NOTIFIED OF EMERGENCY");
    }
  }, [userRole]);

  // 2. Create Refs for handlers
  const handleBusUpdateRef = useRef(handleBusUpdate);
  const handleConfigUpdateRef = useRef(handleConfigUpdate);
  const handleEmergencyUpdateRef = useRef(handleEmergencyUpdate);

  useEffect(() => {
    handleBusUpdateRef.current = handleBusUpdate;
  }, [handleBusUpdate]);

  useEffect(() => {
    handleConfigUpdateRef.current = handleConfigUpdate;
  }, [handleConfigUpdate]);

  useEffect(() => {
    handleEmergencyUpdateRef.current = handleEmergencyUpdate;
  }, [handleEmergencyUpdate]);

  // 3. Connect to Network
  useEffect(() => {
    const disconnect = connectToRealtime(
      (data) => handleBusUpdateRef.current(data), 
      (data) => handleConfigUpdateRef.current(data),
      (data) => handleEmergencyUpdateRef.current(data),
      (status) => setConnectionStatus(status)
    );
    return () => disconnect();
  }, []);

  const triggerEmergency = () => {
    if (!currentUser) return;
    
    const now = new Date();
    const newAlert: EmergencyAlert = {
      id: `EMG-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: userRole as 'student' | 'driver',
      timestamp: now.getTime(),
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      location: userLocation ? { lat: userLocation[0], lng: userLocation[1] } : undefined
    };
    
    setEmergencyAlerts(prev => [newAlert, ...prev]);
    publishEmergency(newAlert);
    setShowEmergencyConfirmation(true);
    // Auto-hide after 8 seconds to give user time to read
    setTimeout(() => setShowEmergencyConfirmation(false), 8000);
  };

  // 4. Admin Broadcasting (Sending ALL Data)
  const handleAdminUpdate = (
    type: 'routes' | 'buses' | 'drivers' | 'students',
    newData: any[]
  ) => {
    if (type === 'routes') setRoutes(newData as BusRoute[]);
    if (type === 'buses') setBuses(newData as Bus[]);
    if (type === 'drivers') setDrivers(newData as Driver[]);
    if (type === 'students') setStudents(newData as Student[]);

    publishGlobalConfig({
      routes: type === 'routes' ? newData as BusRoute[] : routes,
      buses: type === 'buses' ? newData as Bus[] : buses,
      drivers: type === 'drivers' ? newData as Driver[] : drivers,
      students: type === 'students' ? newData as Student[] : students,
    });
  };

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError({ message: "Geolocation not supported", code: 0 });
      return () => {};
    }
    setGpsError(null);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
          setUserLocation([latitude, longitude]);
          if (heading && !isNaN(heading)) {
            setUserHeading(heading);
          }
          setGpsError(null);
        }
      },
      (error) => {
        let msg = "GPS Signal Weak";
        if (error.code === error.PERMISSION_DENIED) {
            msg = "Location Access Denied";
        }
        setGpsError({ message: msg, code: error.code });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const cleanup = startTracking();
    return cleanup;
  }, [startTracking, retryCount]);

  useEffect(() => {
    if (isLoggedIn && userRole === 'driver') {
      const handleOrientation = (event: DeviceOrientationEvent) => {
        let heading: number | null = null;
        if ((event as any).webkitCompassHeading) {
          heading = (event as any).webkitCompassHeading;
        } else if (event.alpha !== null) {
          heading = 360 - event.alpha;
        }
        if (heading !== null) {
          setUserHeading(heading);
        }
      };
      window.addEventListener('deviceorientation', handleOrientation);
      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
  }, [isLoggedIn, userRole]);

  // --- DRIVER LOCATION LOGIC (Unified) ---
  const lastBroadcastTime = useRef(0);

  useEffect(() => {
    if (isLoggedIn && userRole === 'driver' && userLocation) {
      const [lat, lng] = userLocation;
      
      // 1. Update LOCAL state immediately so driver sees movement
      setRoutes(prev => prev.map(r => {
        if (r.id === activeRouteId) {
          return { 
            ...r, 
            actualLat: lat, 
            actualLng: lng,
            liveLat: r.isLive ? lat : r.liveLat, 
            liveLng: r.isLive ? lng : r.liveLng,
            heading: userHeading
          };
        }
        return r;
      }));

      // 2. Broadcast to Network (Throttled, accessing latest state via REF)
      // Accessing routesRef ensures we see the latest 'isLive' status without adding 'routes' to dependency
      const currentRoutes = routesRef.current;
      const currentRoute = currentRoutes.find(r => r.id === activeRouteId);

      if (currentRoute && currentRoute.isLive) {
         const now = Date.now();
         // Throttle broadcasts to max 1 per second to prevent flooding, but ensure at least 1 update.
         if (now - lastBroadcastTime.current > 800) {
            publishBusUpdate({
              routeId: currentRoute.id,
              lat: lat,
              lng: lng,
              heading: userHeading,
              isLive: true,
              direction: currentRoute.direction
            });
            lastBroadcastTime.current = now;
         }
      }
    }
  }, [isLoggedIn, userRole, userLocation, activeRouteId, userHeading]); // Removed 'routes' from dependency

  const activeRoute = routes.find(r => r.id === activeRouteId) || routes[0];

  const handleToggleTracking = (status: boolean) => {
    // 1. Update Local State
    const updatedRoutes = routes.map(r => r.id === activeRouteId ? { ...r, isLive: status } : r);
    setRoutes(updatedRoutes);

    // 2. Broadcast Status Change immediately
    // If we have GPS, send it. If not, use the last known route location.
    const currentRoute = routes.find(r => r.id === activeRouteId);
    const lat = userLocation ? userLocation[0] : (currentRoute?.liveLat || currentRoute?.stops[0].lat || 0);
    const lng = userLocation ? userLocation[1] : (currentRoute?.liveLng || currentRoute?.stops[0].lng || 0);

    console.log(`📡 Toggle Tracking: ${status}`);
    publishBusUpdate({
        routeId: activeRouteId,
        lat: lat,
        lng: lng,
        heading: userHeading,
        isLive: status,
        direction: currentRoute?.direction
    });

    // Also sync globally so other clients see tracking status immediately
    publishGlobalConfig({
      routes: updatedRoutes,
      buses,
      drivers,
      students
    });
  };

  const handleToggleDirection = (dir: 'morning' | 'evening') => {
    if (!activeRoute) return;
    
    // When switching direction, shift the default location to the start of the new route direction 
    const startStop = dir === 'evening' 
      ? activeRoute.stops[activeRoute.stops.length - 1] 
      : activeRoute.stops[0];
    const lat = userLocation ? userLocation[0] : startStop.lat;
    const lng = userLocation ? userLocation[1] : startStop.lng;

    const updatedRoutes = routes.map(r => {
      if (r.id === activeRoute.id) {
        return {
          ...r,
          direction: dir,
          liveLat: lat,
          liveLng: lng,
          actualLat: lat,
          actualLng: lng
        };
      }
      return r;
    });

    setRoutes(updatedRoutes);
    
    console.log(`📡 Toggle Direction: ${dir}`);
    publishBusUpdate({
      routeId: activeRoute.id,
      lat: lat,
      lng: lng,
      heading: userHeading,
      isLive: activeRoute.isLive || false,
      direction: dir
    });

    // Also sync globally so all listening students instantly transition to the new direction
    publishGlobalConfig({
      routes: updatedRoutes,
      buses,
      drivers,
      students
    });
  };

  const handleRouteSwitch = (direction: 'next' | 'prev') => {
    const currentIndex = routes.findIndex(r => r.id === activeRouteId);
    let nextIndex = 0;
    if (direction === 'next') {
        nextIndex = (currentIndex + 1) % routes.length;
    } else {
        nextIndex = (currentIndex - 1 + routes.length) % routes.length;
    }
    setActiveRouteId(routes[nextIndex].id);
  };

  const handleLogin = (email: string, password?: string): boolean => {
    const normEmail = email.toLowerCase().trim();
    const normPass = password?.trim() || '';

    if (normEmail === 'admin@gmail.com' && (normPass === 'admin' || normPass === '123123')) {
      setUserRole('admin');
      setCurrentView('ADMIN');
      setCurrentUser({ name: 'Admin', email: 'admin@gmail.com' });
      setIsLoggedIn(true);
      return true;
    }

    const foundDriver = drivers.find(d => 
      d.email.toLowerCase().trim() === normEmail && 
      (d.password || '') === normPass
    );
    
    if (foundDriver) {
      setCurrentUser(foundDriver);
      setUserRole('driver');
      setCurrentView('TRACKING'); 
      const bus = buses.find(b => b.driverId === foundDriver.id);
      const route = routes.find(r => r.busId === bus?.id);
      if (route) setActiveRouteId(route.id);
      setIsLoggedIn(true);
      return true;
    }

    const foundStudent = students.find(s => 
      s.email.toLowerCase().trim() === normEmail && 
      (s.password || '') === normPass
    );

    if (foundStudent) {
      setCurrentUser(foundStudent);
      setUserRole('student');
      setCurrentView('TRACKING');
      if (foundStudent.assignedRouteId) {
        setActiveRouteId(foundStudent.assignedRouteId);
      }
      setIsLoggedIn(true);
      return true;
    }

    return false;
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentView('TRACKING');
    setUserRole('student');
  };

  const handleReloadGps = () => {
    setUserLocation(null);
    setRetryCount(prev => prev + 1);
  };

  const resetAllData = () => {
    if (window.confirm("This will delete all custom routes and data. Continue?")) {
      setRoutes(INITIAL_ROUTES);
      setBuses(INITIAL_BUSES);
      setDrivers(INITIAL_DRIVERS);
      setStudents(INITIAL_STUDENTS);
      localStorage.clear();
      window.location.reload();
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'TRACKING':
        return <MapInterface 
          route={activeRoute} 
          userLocation={userLocation} 
          userRole={userRole}
          onToggleTracking={handleToggleTracking}
          onLogout={handleLogout}
          onSwitchRoute={handleRouteSwitch}
          onToggleDirection={handleToggleDirection}
        />;
      case 'CHAT':
        return <AIChatbot 
          onEmergency={triggerEmergency} 
          routes={routes}
          drivers={drivers}
          buses={buses}
          emergencyAlerts={emergencyAlerts}
        />;
      case 'ADMIN':
        return <AdminDashboard 
          routes={routes} 
          buses={buses} 
          drivers={drivers}
          students={students}
          emergencyAlerts={emergencyAlerts}
          onUpdateRoutes={(d) => handleAdminUpdate('routes', d)} 
          onUpdateBuses={(d) => handleAdminUpdate('buses', d)} 
          onUpdateDrivers={(d) => handleAdminUpdate('drivers', d)}
          onUpdateStudents={(d) => handleAdminUpdate('students', d)}
          onUpdateEmergencyAlerts={setEmergencyAlerts}
          onLogout={handleLogout} 
          userLocation={userLocation} 
          onResetData={resetAllData}
        />;
      case 'DRIVER':
        return <DriverDashboard 
          driver={currentUser}
          bus={buses.find(b => b.driverId === currentUser?.id)}
          route={activeRoute} 
          onEmergency={triggerEmergency}
          onLogout={handleLogout} 
          onToggleDirection={handleToggleDirection}
        />;
      case 'PROFILE':
        return (
          <div className="absolute inset-0 bg-slate-50 overflow-y-auto p-8">
            <div className="min-h-full w-full flex flex-col items-center justify-center py-6">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col items-center w-full max-w-sm">
                <div className="w-24 h-24 bg-yellow-400 rounded-3xl flex items-center justify-center mb-6 shadow-lg"><User className="w-12 h-12 text-slate-900" /></div>
                <h2 className="text-2xl font-black text-slate-900 mb-1 capitalize">{currentUser?.name || userRole}</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">{currentUser?.email || 'Logged In'}</p>
                <button 
                  onClick={handleLogout} 
                  className="w-full bg-red-50 text-red-600 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-3 active:scale-95 transition-transform"
                >
                  <LogOut className="w-4 h-4" /> Log Out
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return <MapInterface 
          route={activeRoute} 
          userLocation={userLocation} 
          userRole={userRole} 
          onToggleTracking={handleToggleTracking} 
          onLogout={handleLogout}
          onToggleDirection={handleToggleDirection}
        />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden font-inter">
      {/* Network Status Indicator */}
      <div className={`absolute top-0 left-0 right-0 h-1 z-[5000] ${connectionStatus === 'CONNECTED' ? 'bg-green-500' : connectionStatus === 'RECONNECTING' ? 'bg-yellow-500' : 'bg-red-500'}`} />
      
      {!isLoggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <>
          <main className="flex-1 relative overflow-hidden flex flex-col">
             {/* Connection Status Toast */}
             <AnimatePresence>
              {connectionStatus !== 'CONNECTED' && showConnectionToast && (
                 <motion.div initial={{ y: -50 }} animate={{ y: 0 }} exit={{ y: -50 }} className="absolute top-4 left-0 right-0 flex justify-center z-[4000]">
                    <div className="bg-slate-900/90 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg">
                       {connectionStatus === 'DISCONNECTED' ? <WifiOff className="w-3 h-3 text-red-400" /> : <Wifi className="w-3 h-3 text-yellow-400 animate-pulse" />}
                       {connectionStatus === 'DISCONNECTED' ? 'Offline - Trying to connect...' : 'Connecting to Server...'}
                    </div>
                 </motion.div>
              )}
             </AnimatePresence>

            <AnimatePresence>
              {gpsError && (
                <motion.div 
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (Math.abs(info.offset.x) > 100) {
                      setGpsError(null);
                    }
                  }}
                  initial={{ y: -50, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  exit={{ y: -50, opacity: 0 }} 
                  className="absolute top-20 left-4 right-4 z-[3000] cursor-grab active:cursor-grabbing"
                >
                  <div className="bg-white p-5 rounded-3xl shadow-2xl border border-red-50 flex items-center gap-4 select-none">
                    <RefreshCw className="w-5 h-5 text-red-500 cursor-pointer hover:rotate-180 transition-transform duration-500" onClick={handleReloadGps} />
                    <div className="flex-1 text-sm font-bold text-slate-900">{gpsError.message}</div>
                    <div className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Swipe to clear</div>
                  </div>
                </motion.div>
              )}
               {isCloudSyncing && (
                <motion.div 
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (Math.abs(info.offset.x) > 100) {
                      setIsCloudSyncing(false);
                    }
                  }}
                  initial={{ y: -50, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  exit={{ y: -50, opacity: 0 }} 
                  className="absolute top-20 left-4 right-4 z-[3000] cursor-grab active:cursor-grabbing"
                >
                  <div className="bg-blue-500 p-5 rounded-3xl shadow-2xl border border-blue-400 flex items-center gap-4 select-none">
                    <CloudLightning className="w-5 h-5 text-white animate-pulse" />
                    <div className="flex-1 text-sm font-bold text-white">Updating App Data...</div>
                    <div className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Swipe to clear</div>
                  </div>
                </motion.div>
              )}
              {showEmergencyConfirmation && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0, y: 20 }} 
                  animate={{ scale: 1, opacity: 1, y: 0 }} 
                  exit={{ scale: 0.8, opacity: 0, y: 20 }} 
                  className="absolute inset-0 z-[5000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
                >
                  <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-red-100 flex flex-col items-center text-center max-w-xs">
                    <div className="w-20 h-20 bg-red-500 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-red-200 animate-pulse">
                      <AlertTriangle className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Help is on the way!</h2>
                    <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">
                      Your emergency alert has been <span className="text-red-600">sent to the Administrator</span>. 
                      Please stay calm and wait for assistance.
                    </p>
                    <button 
                      onClick={() => setShowEmergencyConfirmation(false)}
                      className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform"
                    >
                      I Understand
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {renderView()}
          </main>
          <BottomNav currentView={currentView} setView={setCurrentView} userRole={userRole} />
        </>
      )}
    </div>
  );
};

export default App;