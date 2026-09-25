import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Volume1,
  Plus,
  Minus,
  ArrowLeftRight,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Heart,
  Sliders,
  X
} from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useHost } from '../context/HostContext';
import { useActiveSession } from '../services/userAuthSync';
import { formatHostId, formatUserId } from '../utils/idFormatter';

export const FloatingVideoCallSideDock: React.FC = () => {
  const session = useActiveSession();
  const { isHostLoggedIn, userRole } = useHost();
  const isHost = session.role === 'host' || userRole === 'host' || isHostLoggedIn;
  const {
    activeSakhi,
    isSpeakerOn,
    toggleSpeaker,
    callVolume,
    setCallVolume,
    volumeUp,
    volumeDown
  } = useCall();

  // Floating dock position: 'right' (default) or 'left'
  const [dockSide, setDockSide] = useState<'right' | 'left'>(() => {
    try {
      const saved = localStorage.getItem('sunosakhi_video_dock_side');
      return saved === 'left' ? 'left' : 'right';
    } catch {
      return 'right';
    }
  });

  const [isMinimized, setIsMinimized] = useState(false);
  const [showSliderPopover, setShowSliderPopover] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss feedback toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 1800);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const toggleDockSide = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSide = dockSide === 'right' ? 'left' : 'right';
    setDockSide(nextSide);
    try {
      localStorage.setItem('sunosakhi_video_dock_side', nextSide);
    } catch {}
    setToastMessage(nextSide === 'right' ? '👉 Controls Right Side shift ho gaye' : '👈 Controls Left Side shift ho gaye');
  };

  const handleSpeakerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSpeaker();
    setToastMessage(!isSpeakerOn ? '🔊 Speaker ON (Loud)' : '🔈 Earpiece / Soft Mode');
  };

  const handleVolUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    volumeUp();
    const newVol = Math.min(150, Math.round((callVolume + 0.15) * 100));
    setToastMessage(`🔊 Volume: ${newVol}%`);
  };

  const handleVolDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    volumeDown();
    const newVol = Math.max(10, Math.round((callVolume - 0.15) * 100));
    setToastMessage(`🔉 Volume: ${newVol}%`);
  };

  if (!activeSakhi) return null;

  const percent = Math.round(callVolume * 100);
  const isBoost = percent > 100;
  const isRight = dockSide === 'right';

  return (
    <>
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in duration-200">
          <div className="px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-xl border border-pink-500/40 text-white text-xs font-bold shadow-2xl flex items-center gap-2">
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Floating Side Dock Container */}
      <div
        className={`fixed z-40 flex flex-col gap-2.5 transition-all duration-300 ${
          isRight
            ? 'right-2.5 sm:right-4 top-40 sm:top-44 items-end'
            : 'left-2.5 sm:left-4 top-28 sm:top-32 items-start'
        }`}
      >
        {/* Dock Mini Action Bar (Flip Side & Collapse) */}
        <div className={`flex items-center gap-1.5 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
          <button
            onClick={toggleDockSide}
            className="p-1 sm:p-1.5 rounded-full bg-black/70 hover:bg-black/90 text-gray-300 hover:text-white border border-white/20 backdrop-blur-md shadow-lg transition-transform active:scale-95"
            title={isRight ? 'Left Side shift karein' : 'Right Side shift karein'}
          >
            <ArrowLeftRight className="w-3 h-3 text-pink-400" />
          </button>

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 sm:p-1.5 rounded-full bg-black/70 hover:bg-black/90 text-gray-300 hover:text-white border border-white/20 backdrop-blur-md shadow-lg transition-transform active:scale-95"
            title={isMinimized ? 'Controls expand karein' : 'Controls hide karein'}
          >
            {isMinimized ? (
              isRight ? <ChevronLeft className="w-3 h-3 text-emerald-400" /> : <ChevronRight className="w-3 h-3 text-emerald-400" />
            ) : (
              isRight ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronLeft className="w-3 h-3 text-gray-400" />
            )}
          </button>
        </div>

        {/* If minimized: show compact floating pill badge */}
        {isMinimized ? (
          <button
            onClick={() => setIsMinimized(false)}
            className="px-2.5 py-1.5 rounded-full bg-black/80 backdrop-blur-xl border border-pink-500/50 text-white text-[11px] font-bold shadow-2xl flex items-center gap-1.5 animate-pulse"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{isHost ? `User ID: ${formatUserId(activeSakhi.id, activeSakhi.phone)}` : activeSakhi.name}</span>
            <span className="text-pink-400">({percent}%)</span>
          </button>
        ) : (
          <div className={`flex flex-col gap-2.5 ${isRight ? 'items-end' : 'items-start'}`}>
            {/* 1. SAKHI / HOST ID FLOATING CARD */}
            <div
              className={`p-2 sm:p-2.5 rounded-2xl bg-black/75 backdrop-blur-xl border border-pink-500/40 shadow-2xl shadow-pink-950/60 max-w-[190px] flex items-center gap-2 transition-all hover:border-pink-400 ${
                isRight ? 'flex-row' : 'flex-row'
              }`}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={activeSakhi.avatar}
                  alt={activeSakhi.name}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-pink-400/60"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-black rounded-full animate-pulse"></span>
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white truncate">
                    {isHost ? `User ID: ${formatUserId(activeSakhi.id, activeSakhi.phone)}` : activeSakhi.name}
                  </span>
                  <Heart className="w-2.5 h-2.5 text-pink-400 fill-pink-400 shrink-0" />
                </div>
                <span className="text-[10px] font-mono text-pink-300">
                  {isHost
                    ? `User ID: ${formatUserId(activeSakhi.id, activeSakhi.phone)}`
                    : `Host ID: ${formatHostId(activeSakhi.id, activeSakhi.phone)}`}
                </span>
              </div>
            </div>

            {/* 2. SPEAKER ON / OFF FLOATING TOGGLE */}
            <button
              onClick={handleSpeakerToggle}
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl backdrop-blur-xl font-bold text-xs shadow-2xl transition-all active:scale-95 border ${
                isSpeakerOn
                  ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-600/40 ring-2 ring-emerald-500/30'
                  : 'bg-black/75 hover:bg-black/90 text-amber-300 border-amber-500/50 shadow-amber-950/40'
              }`}
              title={isSpeakerOn ? 'Switch to Earpiece / Soft Mode' : 'Switch to Loud Speaker Mode'}
            >
              <div className={`p-1.5 rounded-full ${isSpeakerOn ? 'bg-white/20' : 'bg-amber-500/20'}`}>
                {isSpeakerOn ? (
                  <Volume2 className="w-4 h-4 text-white animate-pulse" />
                ) : (
                  <Volume1 className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-[11px] font-black tracking-wide">
                  {isSpeakerOn ? 'SPEAKER ON' : 'SPEAKER OFF'}
                </span>
                <span className="text-[9px] opacity-80 font-normal">
                  {isSpeakerOn ? 'Loud Audio' : 'Soft Earpiece'}
                </span>
              </div>
            </button>

            {/* 3. FLOATING VOLUME CONTROL WIDGET */}
            <div className="relative">
              <div
                className={`p-1.5 rounded-2xl bg-black/75 backdrop-blur-xl border border-white/20 shadow-2xl flex ${
                  isRight ? 'flex-col items-center' : 'flex-col items-center'
                } gap-1.5 w-14`}
              >
                {/* Volume Up (+) */}
                <button
                  onClick={handleVolUp}
                  className="w-10 h-8 rounded-xl bg-white/10 hover:bg-white/25 active:scale-90 text-white flex items-center justify-center transition-all"
                  title="Volume Badhayein (+15%)"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Volume Level Badge & Slider Trigger */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSliderPopover(!showSliderPopover);
                  }}
                  className={`w-10 py-1.5 rounded-xl font-mono text-[10px] font-black flex flex-col items-center justify-center transition-all ${
                    isBoost
                      ? 'bg-gradient-to-b from-yellow-500 to-amber-600 text-black shadow-md shadow-amber-500/30 font-extrabold'
                      : 'bg-white/15 hover:bg-white/25 text-pink-300'
                  }`}
                  title="Volume Slider Kholein"
                >
                  {isBoost && <Sparkles className="w-2.5 h-2.5 text-black mb-0.5 animate-pulse" />}
                  <span>{percent}%</span>
                  {isBoost ? (
                    <span className="text-[7px] uppercase font-black tracking-tighter">Boost</span>
                  ) : (
                    <Sliders className="w-2.5 h-2.5 text-gray-400 mt-0.5" />
                  )}
                </button>

                {/* Volume Down (-) */}
                <button
                  onClick={handleVolDown}
                  className="w-10 h-8 rounded-xl bg-white/10 hover:bg-white/25 active:scale-90 text-white flex items-center justify-center transition-all"
                  title="Volume Kam Karein (-15%)"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>

              {/* Expandable Precision Slider Popover */}
              {showSliderPopover && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute top-0 z-50 p-3 rounded-2xl bg-[#160725]/95 backdrop-blur-2xl border border-pink-500/50 shadow-2xl text-white flex flex-col gap-2.5 w-60 animate-in fade-in zoom-in duration-150 ${
                    isRight ? 'right-16' : 'left-16'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-white/10">
                    <span className="font-bold text-gray-200">Volume Settings</span>
                    <button
                      onClick={() => setShowSliderPopover(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Live Level:</span>
                    <span className={`font-mono font-black ${isBoost ? 'text-yellow-300' : 'text-pink-300'}`}>
                      {percent}% {isBoost ? '🔥 (Loud Boost)' : ''}
                    </span>
                  </div>

                  {/* Range Slider */}
                  <input
                    type="range"
                    min="0.10"
                    max="1.50"
                    step="0.05"
                    value={callVolume}
                    onChange={(e) => setCallVolume(parseFloat(e.target.value))}
                    className="w-full accent-pink-500 cursor-pointer h-2 bg-white/20 rounded-lg"
                  />

                  {/* 4 Quick Presets */}
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[
                      { label: '30%', val: 0.3 },
                      { label: '60%', val: 0.6 },
                      { label: '100%', val: 1.0 },
                      { label: '140%', val: 1.4 }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setCallVolume(preset.val)}
                        className={`py-1 rounded text-[10px] font-bold transition-all text-center ${
                          Math.abs(callVolume - preset.val) < 0.08
                            ? 'bg-pink-600 text-white shadow'
                            : 'bg-white/10 hover:bg-white/20 text-gray-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px]">
                    <span className="text-gray-400">Audio Mode:</span>
                    <button
                      onClick={handleSpeakerToggle}
                      className={`font-black underline ${isSpeakerOn ? 'text-emerald-400' : 'text-amber-400'}`}
                    >
                      {isSpeakerOn ? '🔊 Speaker Mode' : '🔈 Earpiece Mode'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
