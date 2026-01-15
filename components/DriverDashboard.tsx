import React from 'react';
import { Driver, Bus, BusRoute } from '../types.ts';
import { LogOut, User, Phone, Bus as BusIcon, Route, ShieldCheck, BadgeCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface DriverDashboardProps {
  driver: Driver;
  bus?: Bus;
  route?: BusRoute;
  onLogout: () => void;
}

const DriverDashboard: React.FC<DriverDashboardProps> = ({ driver, bus, route, onLogout }) => {
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto no-scrollbar pb-24">
      {/* Profile Header */}
      <div className="p-8 pt-12 bg-white border-b border-slate-100 flex flex-col items-center shrink-0 shadow-sm">
        <div className="relative mb-6">
          <div className="w-28 h-28 bg-yellow-400 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-yellow-100 rotate-3">
             <User className="w-14 h-14 text-slate-900 -rotate-3" />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-2 rounded-2xl shadow-lg border-4 border-white">
            <BadgeCheck className="w-5 h-5" />
          </div>
        </div>
        
        <h1 className="text-2xl font-black text-slate-900 mb-1">{driver.name}</h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Official Driver • ID {driver.id}</p>
        
        <button 
          onClick={onLogout}
          className="mt-6 flex items-center gap-2 px-6 py-2.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Contact & Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Mobile</p>
            <p className="text-sm font-bold text-slate-900">{driver.phone}</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Status</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-sm font-bold text-slate-900">Active</p>
            </div>
          </div>
        </div>

        {/* Assignment Section */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Current Assignment</h3>
          
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-blue-50 rounded-2xl">
                <BusIcon className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Assigned Vehicle</p>
                <p className="text-lg font-black text-slate-900">{bus?.numberPlate || 'Unassigned'}</p>
              </div>
            </div>

            <div className="h-px bg-slate-50 w-full" />

            <div className="flex items-center gap-5">
              <div className="p-4 bg-purple-50 rounded-2xl">
                <Route className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Route Information</p>
                <p className="text-lg font-black text-slate-900">{route?.name || 'No Active Route'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Safety Badge */}
        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-3xl" />
           <div className="flex items-center gap-4 mb-4">
              <ShieldCheck className="w-8 h-8 text-yellow-400" />
              <h4 className="text-white font-black text-lg">Safety Verified</h4>
           </div>
           <p className="text-slate-400 text-xs leading-relaxed font-medium">
             Your profile is verified. Remember to check your vehicle's safety parameters before every shift.
           </p>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;