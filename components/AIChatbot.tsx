import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertTriangle } from 'lucide-react';
import { ChatMessage, BusRoute, Bus, Driver, EmergencyAlert } from '../types.ts';
import { sendChatMessage } from '../services/geminiService.ts';
import { BotIcon } from './BotIcon.tsx';

interface MarkdownTextProps {
  text: string;
  isUser?: boolean;
}

const renderInlineBold = (str: string, isUser: boolean) => {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className={`font-bold ${isUser ? 'text-white' : 'text-slate-900'}`}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

const MarkdownText: React.FC<MarkdownTextProps> = ({ text, isUser = false }) => {
  const lines = text.split('\n');

  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // 1. Headers: ## or ###
        if (trimmed.startsWith('###')) {
          const headerText = trimmed.replace(/^###\s*/, '');
          return (
            <h4 key={idx} className={`font-bold text-base mt-2 mb-1 ${isUser ? 'text-white' : 'text-slate-900'}`}>
              {renderInlineBold(headerText, isUser)}
            </h4>
          );
        }
        if (trimmed.startsWith('##')) {
          const headerText = trimmed.replace(/^##\s*/, '');
          return (
            <h3 key={idx} className={`font-bold text-lg mt-3 mb-1 ${isUser ? 'text-white' : 'text-slate-900'}`}>
              {renderInlineBold(headerText, isUser)}
            </h3>
          );
        }
        if (trimmed.startsWith('#')) {
          const headerText = trimmed.replace(/^#\s*/, '');
          return (
            <h2 key={idx} className={`font-black text-xl mt-4 mb-2 ${isUser ? 'text-white' : 'text-slate-900'}`}>
              {renderInlineBold(headerText, isUser)}
            </h2>
          );
        }

        // 2. Unordered lists: * or -
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          const listText = trimmed.slice(2);
          return (
            <div key={idx} className="flex items-start gap-1 px-1 my-0.5 ml-2">
              <span className={`font-bold mr-1 select-none ${isUser ? 'text-white' : 'text-yellow-500'}`}>•</span>
              <span className="flex-1">{renderInlineBold(listText, isUser)}</span>
            </div>
          );
        }

        // If line is empty, render small pacing
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Standard line
        return (
          <p key={idx} className="my-0.5">
            {renderInlineBold(line, isUser)}
          </p>
        );
      })}
    </div>
  );
};

interface AIChatbotProps {
  onEmergency?: () => void;
  routes?: BusRoute[];
  drivers?: Driver[];
  buses?: Bus[];
  emergencyAlerts?: EmergencyAlert[];
}

const AIChatbot: React.FC<AIChatbotProps> = ({ 
  onEmergency,
  routes = [],
  drivers = [],
  buses = [],
  emergencyAlerts = []
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hi! I am your College Bus Tracker Assistant. Ask me about schedules, routes, or lost items!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ sender: m.sender, text: m.text }));
      
      const systemContext = {
        routes: routes.map(r => ({
          id: r.id,
          name: r.name,
          driver: r.driver,
          driverPhone: r.driverPhone,
          numberPlate: r.numberPlate,
          eta: r.eta,
          isLive: r.isLive,
          direction: r.direction,
          stops: (r.stops || []).map(s => ({
            name: s.name,
            time: s.time,
            status: s.status,
            eveningTime: r.eveningTimes?.[s.id] || null
          }))
        })),
        drivers: drivers.map(d => ({ name: d.name, phone: d.phone, email: d.email })),
        buses: buses.map(b => ({ id: b.id, numberPlate: b.numberPlate })),
        activeEmergencyAlerts: emergencyAlerts.map(e => ({
          userName: e.userName,
          userRole: e.userRole,
          time: e.time,
          date: e.date
        }))
      };

      const responseText = await sendChatMessage(userMsg.text, history, systemContext);
      
      if (isMounted.current) {
        const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: responseText,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
      }
    } catch (error) {
       console.error("Chat interface error:", error);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-20 lg:pb-24 lg:pt-4">
      <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col bg-white lg:shadow-xl lg:rounded-3xl lg:border lg:border-slate-150 overflow-hidden relative">
        <div className="bg-white p-4 shadow-sm z-10 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BotIcon className="w-6 h-6 text-yellow-500" />
              Bus Assistant
            </h2>
          </div>
          {onEmergency && (
            <button 
              onClick={onEmergency}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" /> SOS
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-slate-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white rounded-br-none'
                    : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                }`}
              >
                <MarkdownText text={msg.text} isUser={msg.sender === 'user'} />
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-slate-100">
                <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 border border-slate-200">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about bus 101..."
              className="flex-1 bg-transparent outline-none text-slate-900 text-sm placeholder:text-slate-400 font-medium"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-yellow-400 p-2 rounded-full text-slate-900 hover:bg-yellow-500 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatbot;