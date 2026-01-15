import React, { useState, useEffect, useCallback } from 'react';
import { ViewState, BusRoute, Bus, Driver, Student } from './types.ts';
import MapInterface from './components/MapInterface.tsx';
import AIChatbot from './components/AIChatbot.tsx';
import BottomNav from './components/BottomNav.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import DriverDashboard from './components/DriverDashboard.tsx';
import LoginPage from './components/LoginPage.tsx';
import { User, LogOut, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    stops: [
      { id: '1', name: 'Tiptur Railway Station', time: '07:30 AM', status: 'passed', lat: 13.2642, lng: 76.4764 },
      { id: '2', name: 'Main Road Circle', time: '07:45 AM', status: 'passed', lat: 13.2680, lng: 76.4820 },
      { id: '3', name: 'Science Block Gate', time: '07:55 AM', status: 'current', lat: 13.2720, lng: 76.4880 },
    ],
    path: [[76.4764, 13.2642], [76.4820, 13.2680], [76.4880, 13.2720]],
    liveLat: 13.2720,
    liveLng: 76.4880,
    actualLat: 13.2720,
    actualLng: 76.4880,
    heading: 0
  }
];

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<ViewState>('TRACKING');
  const [userRole, setUserRole] = useState<'student' | 'admin' | 'driver'>('student');
  
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
  
  const [activeRouteId, setActiveRouteId] = useState<string>(() => {
    const storedRoutes = loadStored('bus_routes', INITIAL_ROUTES);
    return storedRoutes.length > 0 ? storedRoutes[0].id : '';
  });
  
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [userHeading, setUserHeading] = useState<number>(0);
  const [gpsError, setGpsError] = useState<{ message: string; code: number; details?: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Persistence Saving
  useEffect(() => { localStorage.setItem('bus_routes', JSON.stringify(routes)); }, [routes]);
  useEffect(() => { localStorage.setItem('bus_fleet', JSON.stringify(buses)); }, [buses]);
  useEffect(() => { localStorage.setItem('bus_drivers', JSON.stringify(drivers)); }, [drivers]);
  useEffect(() => { localStorage.setItem('bus_students', JSON.stringify(students)); }, [students]);

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
        if (error.code === error.PERMISSION_DENIED) msg = "Location Access Denied";
        setGpsError({ message: msg, code: error.code });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const cleanup = startTracking();
    return cleanup;
  }, [startTracking, retryCount]);

  // Capture Device Orientation (Compass) for Heading
  useEffect(() => {
    if (isLoggedIn && userRole === 'driver') {
      const handleOrientation = (event: DeviceOrientationEvent) => {
        let heading: number | null = null;
        if ((event as any).webkitCompassHeading) {
          // iOS
          heading = (event as any).webkitCompassHeading;
        } else if (event.alpha !== null) {
          // Android / Standard (approximate)
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

  useEffect(() => {
    if (isLoggedIn && userRole === 'driver' && userLocation) {
      const [lat, lng] = userLocation;
      setRoutes(prev => prev.map(r => {
        if (r.id === activeRouteId) {
          return { 
            ...r, 
            actualLat: lat, 
            actualLng: lng,
            liveLat: r.isLive ? lat : (r.liveLat || lat), 
            liveLng: r.isLive ? lng : (r.liveLng || lng),
            heading: userHeading
          };
        }
        return r;
      }));
    }
  }, [isLoggedIn, userRole, userLocation, activeRouteId, userHeading]);

  const activeRoute = routes.find(r => r.id === activeRouteId) || routes[0];

  const handleToggleTracking = (status: boolean) => {
    setRoutes(prev => prev.map(r => r.id === activeRouteId ? { ...r, isLive: status } : r));
  };

  const handleLogin = (email: string, password?: string): boolean => {
    const normEmail = email.toLowerCase().trim();
    const normPass = password?.trim() || '';

    // 1. Admin Check (Allow 'admin' or '123123')
    if (normEmail === 'admin@gmail.com' && (normPass === 'admin' || normPass === '123123')) {
      setUserRole('admin');
      setCurrentView('ADMIN');
      setCurrentUser({ name: 'Admin', email: 'admin@gmail.com' });
      setIsLoggedIn(true);
      return true;
    }

    // 2. Driver Check
    // STRICT password check against current state
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

    // 3. Student Check
    // STRICT password check against current state
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
        />;
      case 'CHAT':
        return <AIChatbot />;
      case 'ADMIN':
        return <AdminDashboard 
          routes={routes} 
          buses={buses} 
          drivers={drivers}
          students={students}
          onUpdateRoutes={setRoutes} 
          onUpdateBuses={setBuses} 
          onUpdateDrivers={setDrivers}
          onUpdateStudents={setStudents}
          onLogout={handleLogout} 
          userLocation={userLocation} 
          onResetData={resetAllData}
        />;
      case 'DRIVER':
        return <DriverDashboard 
          driver={currentUser}
          bus={buses.find(b => b.driverId === currentUser?.id)}
          route={activeRoute} 
          onLogout={handleLogout} 
        />;
      case 'PROFILE':
        return (
          <div className="flex flex-col h-full bg-slate-50 items-center justify-center p-8">
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
        );
      default:
        return <MapInterface route={activeRoute} userLocation={userLocation} userRole={userRole} onToggleTracking={handleToggleTracking} onLogout={handleLogout} />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden font-inter">
      {!isLoggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <>
          <main className="flex-1 relative overflow-hidden">
            <AnimatePresence>
              {gpsError && (
                <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="absolute top-20 left-4 right-4 z-[3000]">
                  <div className="bg-white p-5 rounded-3xl shadow-2xl border border-red-50 flex items-center gap-4">
                    <RefreshCw className="w-5 h-5 text-red-500 cursor-pointer hover:rotate-180 transition-transform duration-500" onClick={handleReloadGps} />
                    <div className="flex-1 text-sm font-bold">{gpsError.message}</div>
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