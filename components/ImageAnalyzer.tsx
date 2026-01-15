import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Loader2, Sparkles, AlertCircle, Image as ImageIcon, ClipboardCheck, History, Info } from 'lucide-react';
import { analyzeImage } from '../services/geminiService.ts';

const ImageAnalyzer: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isMounted.current) {
          setImage(reader.result as string);
          setResult(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickAction = (actionPrompt: string) => {
    setPrompt(actionPrompt);
    // Auto-trigger analysis if image is already there
    if (image) {
       triggerAnalysis(actionPrompt);
    }
  };

  const triggerAnalysis = async (customPrompt?: string) => {
    if (!image) return;
    setLoading(true);
    setResult(null);

    try {
      const base64Data = image.split(',')[1];
      const analysis = await analyzeImage(base64Data, customPrompt || prompt);
      if (isMounted.current) {
        setResult(analysis);
      }
    } catch (error) {
      console.error(error);
      if (isMounted.current) {
        setResult("AI failed to process the request. Please check your connection.");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-24 overflow-y-auto no-scrollbar">
      {/* Header Section */}
      <div className="bg-white px-6 pt-12 pb-6 shadow-sm border-b border-slate-100">
        <div className="flex justify-between items-start mb-2">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Scan & Check</h2>
                <p className="text-slate-500 text-sm font-medium">Identify items, read schedules, or report issues.</p>
            </div>
            <div className="bg-blue-50 p-2 rounded-2xl">
                <Sparkles className="w-6 h-6 text-blue-500" />
            </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Upload/Preview Area */}
        <div className="relative group">
            {!image ? (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-square rounded-[2rem] border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-300 relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="bg-slate-100 p-6 rounded-3xl mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Camera className="w-10 h-10 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <span className="font-bold text-slate-800 text-lg">Upload or Capture</span>
                    <span className="text-xs font-black text-slate-400 mt-1 uppercase tracking-widest">Supports JPG, PNG</span>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
            ) : (
                <div className="w-full space-y-4 animate-in zoom-in-95 duration-300">
                    <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden shadow-2xl ring-4 ring-white">
                        <img src={image} alt="Preview" className="w-full h-full object-cover" />
                        
                        {/* Scanning Animation */}
                        {loading && (
                            <div className="absolute inset-0 flex flex-col justify-start pointer-events-none">
                                <div className="w-full h-1 bg-blue-500 shadow-[0_0_20px_#3b82f6] animate-scan-line relative z-10" />
                                <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[1px]" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
                                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                        <span className="font-bold text-slate-900 text-sm">Gemini AI Analyzing...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={() => { setImage(null); setResult(null); }}
                            className="absolute top-4 right-4 bg-slate-900/60 text-white p-2.5 rounded-2xl backdrop-blur-xl hover:bg-red-500 transition-all active:scale-90"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Quick Actions Bar */}
                    {!loading && !result && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                            {[
                                { label: 'Lost Item', icon: History, prompt: 'Describe this lost item for the college database.' },
                                { label: 'Bus Notice', icon: ClipboardCheck, prompt: 'Summarize key information from this notice.' },
                                { label: 'Maintenance', icon: AlertCircle, prompt: 'Identify the maintenance issue shown here.' }
                            ].map((btn) => (
                                <button
                                    key={btn.label}
                                    onClick={() => handleQuickAction(btn.prompt)}
                                    className="flex-shrink-0 bg-white border border-slate-100 px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm hover:shadow-md hover:border-blue-200 transition-all active:scale-95"
                                >
                                    <btn.icon className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs font-bold text-slate-800">{btn.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Input & Action */}
        {image && !loading && !result && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                        <Info className="w-4 h-4 text-blue-400" />
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Additional Context</label>
                    </div>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g. Is this my blue water bottle? or What is the bus 101 arrival time?"
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-blue-100 outline-none transition-all min-h-[100px] resize-none"
                    />
                </div>

                <button
                    onClick={() => triggerAnalysis()}
                    className="w-full bg-slate-900 text-white font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-[0.98] shadow-xl shadow-slate-200"
                >
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    Process with Gemini
                </button>
            </div>
        )}

        {/* AI Result Presentation */}
        {result && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="bg-white rounded-[2rem] shadow-xl border border-blue-50 overflow-hidden">
                    <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                            <Sparkles className="w-5 h-5" />
                            <span className="font-bold text-sm tracking-wide uppercase">AI Insights</span>
                        </div>
                        <span className="text-[10px] font-black text-blue-100 uppercase bg-blue-700 px-2 py-1 rounded-md">Verified Analysis</span>
                    </div>
                    <div className="p-8">
                        <p className="text-slate-800 text-base leading-relaxed whitespace-pre-wrap font-medium">
                            {result}
                        </p>
                        
                        <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex -space-x-2">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white">
                                    <Bot className="w-4 h-4 text-blue-500" />
                                </div>
                            </div>
                            <button 
                                onClick={() => { setResult(null); setPrompt(''); }}
                                className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:text-blue-700 transition-colors"
                            >
                                Clear Analysis
                            </button>
                        </div>
                    </div>
                </div>
                
                <p className="text-center text-[10px] font-bold text-slate-400 mt-6 uppercase tracking-[0.2em]">
                    AI responses can be inaccurate. Cross-verify with staff.
                </p>
            </div>
        )}
      </div>

      <style>{`
        @keyframes scan-line {
            0% { top: 0; }
            50% { top: 100%; }
            100% { top: 0; }
        }
        .animate-scan-line {
            animation: scan-line 3s ease-in-out infinite;
        }
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

const Bot = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

export default ImageAnalyzer;