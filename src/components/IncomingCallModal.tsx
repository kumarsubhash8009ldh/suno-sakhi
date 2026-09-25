import React, { useEffect, useState, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  Mic,
  Heart,
  BellRing,
  Volume2,
  ChevronsRight,
  ChevronsLeft
} from 'lucide-react';
import { useCall } from '../context/CallContext';
import { sounds } from '../utils/soundEffects';
import { useActiveSession } from '../services/userAuthSync';

interface CallSwipeSliderProps {
  onAccept: () => void;
  onDecline: () => void;
  isVideo: boolean;
  role?: string | null;
}

const CallSwipeSlider: React.FC<CallSwipeSliderProps> = ({ onAccept, onDecline, isVideo, role }) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);

  const THRESHOLD = 70; // px threshold to trigger
  const MAX_DRAG = 110; // clamp limit

  const handleStart = (clientX: number) => {
    setIsDragging(true);
    startXRef.current = clientX;
    currentXRef.current = 0;
    setDragX(0);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    const delta = clientX - startXRef.current;
    const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, delta));
    currentXRef.current = clamped;
    setDragX(clamped);

    if (Math.abs(clamped) >= THRESHOLD && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const finalX = currentXRef.current;

    if (finalX >= THRESHOLD) {
      // Swiped Right -> Accept / Receive
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 30, 40]);
      }
      onAccept();
    } else if (finalX <= -THRESHOLD) {
      // Swiped Left -> Decline / Reject
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 30, 40]);
      }
      onDecline();
    }

    setDragX(0);
    currentXRef.current = 0;
  };

  useEffect(() => {
    if (!isDragging) return;

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => handleEnd();
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  const isAcceptReady = dragX >= THRESHOLD;
  const isDeclineReady = dragX <= -THRESHOLD;

  const rightOpacity = Math.max(0, Math.min(1, dragX / THRESHOLD));
  const leftOpacity = Math.max(0, Math.min(1, -dragX / THRESHOLD));

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* Interactive Slider Track */}
      <div className="relative w-full max-w-[310px] h-[66px] rounded-full bg-black/60 border-2 border-white/20 p-1 flex items-center justify-between overflow-hidden shadow-2xl backdrop-blur-xl touch-none">
        {/* Dynamic color fill overlays */}
        <div
          className="absolute inset-y-0 left-0 right-1/2 bg-gradient-to-r from-red-600/50 to-transparent pointer-events-none transition-opacity duration-150"
          style={{ opacity: leftOpacity }}
        />
        <div
          className="absolute inset-y-0 right-0 left-1/2 bg-gradient-to-l from-emerald-600/50 to-transparent pointer-events-none transition-opacity duration-150"
          style={{ opacity: rightOpacity }}
        />

        {/* Left: Decline Zone */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onDecline();
          }}
          className={`relative z-10 flex items-center gap-1 pl-3 text-red-400 font-bold text-xs transition-transform duration-200 cursor-pointer ${
            isDeclineReady ? 'scale-110 text-red-300 font-black' : 'opacity-85'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-red-600/30 flex items-center justify-center border border-red-500/40 shadow">
            <PhoneOff className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[11px] uppercase tracking-wider font-extrabold">Decline</span>
            <div className="flex items-center text-[9px] text-red-300/80">
              <ChevronsLeft className="w-3 h-3 animate-pulse" />
              <span>Swipe</span>
            </div>
          </div>
        </div>

        {/* Center Draggable Knob */}
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            handleStart(e.clientX);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            if (e.touches && e.touches[0]) {
              handleStart(e.touches[0].clientX);
            }
          }}
          style={{
            transform: `translateX(${dragX}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)'
          }}
          className={`absolute left-1/2 -ml-[28px] z-20 w-14 h-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-2xl transition-all duration-200 ${
            isAcceptReady
              ? 'bg-gradient-to-tr from-emerald-500 to-green-400 ring-4 ring-emerald-400/60 scale-110 shadow-emerald-500/80'
              : isDeclineReady
              ? 'bg-gradient-to-tr from-red-600 to-rose-500 ring-4 ring-red-400/60 scale-110 shadow-red-500/80'
              : 'bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 ring-2 ring-white/30 shadow-pink-600/60 animate-pulse'
          }`}
        >
          {isDeclineReady ? (
            <PhoneOff className="w-6 h-6 text-white animate-pulse" />
          ) : isAcceptReady ? (
            isVideo ? (
              <Video className="w-6 h-6 text-white animate-pulse" />
            ) : (
              <Phone className="w-6 h-6 text-white animate-pulse" />
            )
          ) : (
            <div className="flex items-center justify-center gap-1 text-white">
              <ChevronsLeft className="w-3 h-3 opacity-70" />
              {isVideo ? <Video className="w-5 h-5 fill-white/20" /> : <Phone className="w-5 h-5 fill-white/20" />}
              <ChevronsRight className="w-3 h-3 opacity-70" />
            </div>
          )}
        </div>

        {/* Right: Accept Zone */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onAccept();
          }}
          className={`relative z-10 flex items-center gap-1 pr-3 text-emerald-400 font-bold text-xs transition-transform duration-200 cursor-pointer ${
            isAcceptReady ? 'scale-110 text-emerald-300 font-black' : 'opacity-85'
          }`}
        >
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[11px] uppercase tracking-wider font-extrabold">Answer</span>
            <div className="flex items-center text-[9px] text-emerald-300/80">
              <span>Swipe</span>
              <ChevronsRight className="w-3 h-3 animate-pulse" />
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-600/30 flex items-center justify-center border border-emerald-500/40 shadow">
            {isVideo ? (
              <Video className="w-4 h-4 text-emerald-400" />
            ) : (
              <Phone className="w-4 h-4 text-emerald-400" />
            )}
          </div>
        </div>
      </div>

      {/* Swipe Status Label */}
      <div className="mt-2.5 h-4 flex items-center justify-center text-[11px] font-semibold text-gray-300">
        {isAcceptReady ? (
          <span className="text-emerald-300 font-bold animate-pulse">Release to Receive Call! 🟢</span>
        ) : isDeclineReady ? (
          <span className="text-red-300 font-bold animate-pulse">Release to Decline Call! 🔴</span>
        ) : (
          <span className="text-pink-300/90 font-medium">⟵ Swipe Left: Decline • Swipe Right: Receive ⟶</span>
        )}
      </div>

      {/* Direct Tap Fallback Buttons */}
      <div className="mt-4 flex items-center justify-center gap-3 w-full px-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDecline();
          }}
          className="flex-1 py-2 px-3 rounded-2xl bg-red-600/25 hover:bg-red-600/40 active:scale-95 border border-red-500/40 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
          title="Decline Call"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>Decline</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onAccept();
          }}
          className="flex-1 py-2 px-3 rounded-2xl bg-emerald-600/30 hover:bg-emerald-600/50 active:scale-95 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
          title="Accept Call"
        >
          {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
          <span>{role === 'host' ? 'Accept & Earn' : 'Accept Call'}</span>
        </button>
      </div>
    </div>
  );
};

export const IncomingCallModal: React.FC = () => {
  const session = useActiveSession();
  const { incomingCall, acceptIncomingCall, rejectIncomingCall } = useCall();
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  useEffect(() => {
    if (incomingCall) {
      // Force audio unlock and start ringtone
      sounds.unlockAudio();
      sounds.startRingtone({ vibrate: true });

      // Mobile vibration alert
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([1000, 400, 1000, 400, 1500]);
      }

      // Flashing tab title alert
      const originalTitle = document.title;
      let toggle = false;
      const titleInterval = window.setInterval(() => {
        document.title = toggle ? '📞 INCOMING CALL! 📞' : '🔔 Ringing... SunoSakhi';
        toggle = !toggle;
      }, 700);

      // Touch / click unlock listener in case browser blocked autoplay
      const handleUserTouch = () => {
        sounds.unlockAudio();
        sounds.startRingtone({ vibrate: true });
        setAudioUnlocked(true);
      };

      window.addEventListener('click', handleUserTouch, { passive: true });
      window.addEventListener('touchstart', handleUserTouch, { passive: true });
      window.addEventListener('pointerdown', handleUserTouch, { passive: true });

      return () => {
        sounds.stopRingtone();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(0);
        }
        clearInterval(titleInterval);
        document.title = originalTitle;
        window.removeEventListener('click', handleUserTouch);
        window.removeEventListener('touchstart', handleUserTouch);
        window.removeEventListener('pointerdown', handleUserTouch);
      };
    } else {
      sounds.stopRingtone();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === 'video';
  const earnRate = isVideo ? '6.00' : '3.00';
  const grossRate = isVideo ? '10' : '5';

  const handleModalTouch = () => {
    sounds.unlockAudio();
    sounds.startRingtone({ vibrate: true });
    setAudioUnlocked(true);
  };

  const handleAccept = () => {
    sounds.stopRingtone();
    sounds.unlockAudio();
    acceptIncomingCall();
  };

  const handleDecline = () => {
    sounds.stopRingtone();
    rejectIncomingCall();
  };

  return (
    <div
      onClick={handleModalTouch}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleModalTouch();
        }}
        className="relative w-full max-w-sm rounded-[36px] bg-gradient-to-b from-[#200d36] via-[#140824] to-[#0a0312] border-2 border-pink-500/50 p-6 text-center text-white shadow-2xl shadow-pink-600/40 flex flex-col items-center cursor-default"
      >
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-pink-600/20 blur-3xl pointer-events-none"></div>

        {/* Top Tag */}
        <div className="relative z-10 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-bold mb-4 shadow">
          {isVideo ? (
            <>
              <Video className="w-3.5 h-3.5 text-purple-400" />
              <span>Incoming Video Call • ₹{grossRate}/min</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-pink-400" />
              <span>Incoming Voice Call • ₹{grossRate}/min</span>
            </>
          )}
        </div>

        {/* Dynamic Role Banner */}
        {session.role === 'host' ? (
          <div className="relative z-10 px-3.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black mb-3">
            🎉 Host Earning: Aapko milega ₹{earnRate}/minute live!
          </div>
        ) : (
          <div className="relative z-10 px-3.5 py-1 rounded-xl bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-black mb-3">
            🌸 Sakhi {incomingCall.callerName} Calling You!
          </div>
        )}

        {/* Ringtone Alert / Tap to Unmute Banner */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleModalTouch();
          }}
          className="relative z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-pink-600/40 to-purple-600/40 border-2 border-pink-400 text-white text-xs font-black mb-4 animate-pulse shadow-lg shadow-pink-900/50 hover:scale-105 active:scale-95 transition-transform"
        >
          <BellRing className="w-4 h-4 text-pink-300 animate-bounce" />
          <span>🔊 Phone Ringing • Tap to Unmute / Ring Loud!</span>
          <Volume2 className="w-4 h-4 text-emerald-300 animate-pulse" />
        </button>

        {/* Caller Avatar & Pulsing Rings */}
        <div className="relative z-10 flex items-center justify-center my-3">
          <div className="absolute w-44 h-44 rounded-full border border-pink-500/40 animate-ping-slow"></div>
          <div className="absolute w-36 h-36 rounded-full border border-purple-500/40 animate-pulse"></div>

          <div className="relative w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 shadow-xl shadow-pink-600/50 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#180928] flex items-center justify-center text-3xl font-black text-pink-300">
              {incomingCall.callerName ? incomingCall.callerName.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </div>

        {/* Caller Name & ID */}
        <div className="relative z-10 mb-5">
          <h3 className="text-2xl font-black text-white">{incomingCall.callerName || 'Caller'}</h3>
          <p className="text-xs text-pink-300/80 mt-1 flex items-center justify-center gap-1">
            <Heart className="w-3 h-3 text-pink-400 fill-pink-400" />
            <span>Aap se live judna chahte hain...</span>
          </p>
        </div>

        {/* Swipe Right to Accept / Left to Decline Component */}
        <div className="relative z-10 w-full">
          <CallSwipeSlider
            onAccept={handleAccept}
            onDecline={handleDecline}
            isVideo={isVideo}
            role={session.role}
          />
        </div>
      </div>
    </div>
  );
};
