import React from 'react';
import { Map, MessageSquare, User, LayoutDashboard, Navigation } from 'lucide-react';
import { ViewState } from '../types';

interface BottomNavProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  userRole: 'student' | 'admin' | 'driver';
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, setView, userRole }) => {
  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => (
    <button
      onClick={() => setView(view)}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
        currentView === view ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <div className={`p-1.5 rounded-xl transition-all ${currentView === view ? 'bg-yellow-400 shadow-md transform -translate-y-2 lg:-translate-y-1.5' : ''}`}>
        <Icon className={`w-6 h-6 lg:w-5 lg:h-5 ${currentView === view ? 'text-black' : 'currentColor'}`} strokeWidth={currentView === view ? 2.5 : 2} />
      </div>
      <span className={`text-[10px] lg:text-[9px] font-medium transition-opacity ${currentView === view ? 'opacity-100 font-bold' : 'opacity-70'}`}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-200 flex justify-around items-center px-2 pb-2 z-50 rounded-t-3xl shadow-[0_-5px_15px_rgba(0,0,0,0.05)] lg:bottom-6 lg:left-1/2 lg:-translate-x-1/2 lg:right-auto lg:w-[325px] lg:h-15 lg:rounded-full lg:border lg:border-slate-100 lg:shadow-xl lg:px-4 lg:pb-0">
      <NavItem view="TRACKING" icon={Map} label="Track" />
      <NavItem view="CHAT" icon={MessageSquare} label="Help" />
      {userRole === 'admin' ? (
        <NavItem view="ADMIN" icon={LayoutDashboard} label="Admin" />
      ) : userRole === 'driver' ? (
        <NavItem view="DRIVER" icon={Navigation} label="Drive" />
      ) : (
        <NavItem view="PROFILE" icon={User} label="Profile" />
      )}
    </div>
  );
};

export default BottomNav;