import React, { useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Video, Sparkles, Volume2, Volume1 } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useHost } from '../context/HostContext';
import { useActiveSession } from '../services/userAuthSync';
import { sounds } from '../utils/soundEffects';
import { CallVolumeControls } from './CallVolumeControls';

export const CallingScreen: React.FC = () => {
  const session = useActiveSession();
  const { isHostLoggedIn, hostProfile, userRole } = useHost();
  const {
    activeSakhi,
    callType,
    callStatus,
    cancelCalling,
    isSpeakerOn,
    callVolume,
    toggleSpeaker,
    isMuted,
    toggleMute
  } = useCall();

  const isHost = Boolean(
    session.role === 'host' ||
    userRole === 'host' ||
    isHostLoggedIn ||
    localStorage.getItem('sunosakhi_host_logged_in') === 'true' ||
    localStorage.getItem('sunosakhi_active_role') === 'host' ||
    (hostProfile?.phone && String(hostProfile.phone).replace(/\D/g, '').length >= 10)
  );

  useEffect(() => {
    if (callStatus === 'calling') {
      sounds.unlockAudio();
      sounds.setRingtoneVolume(isSpeakerOn ? callVolume : callVolume * 0.25);
      sounds.startRingtone();
    }
    return () => {
      sounds.stopRingtone();
    };
  }, [callStatus]);

  useEffect(() => {
    sounds.setRingtoneVolume(isSpeakerOn ? callVolume : callVolume * 0.25);
  }, [isSpeakerOn, callVolume]);

  if (callStatus !== 'calling' || !activeSakhi) return null;

  const rate = callType === 'voice' ? 7 : 15;

  return (
    <div
      onClick={() => {
        sounds.unlockAudio();
        sounds.startRingtone();
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-gradient-to-b from-[#180928] via-[#0e0517] to-black text-white select-none"
    >
      {/* Background glowing aura */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-pink-600/20 blur-3xl pointer-events-none"></div>

      {/* Top Bar info */}
      <div className="relative z-10 flex flex-col items-center pt-8 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-semibold mb-3">
          {isHost ? (
            <span className="text-emerald-300 font-bold">🌸 Host Call • 100% FREE (₹0 Charges)</span>
          ) : callType === 'voice' ? (
            <>
              <Mic className="w-3.5 h-3.5 text-pink-400" />
              <span>Voice Call • ₹7 / min</span>
            </>
          ) : (
            <>
              <Video className="w-3.5 h-3.5 text-purple-400" />
              <span>Video Call • ₹15 / min</span>
            </>
          )}
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight">{activeSakhi.name}</h2>
        <p className="text-xs font-mono text-pink-400 font-bold mt-1">ID: {activeSakhi.id}</p>
        <p className="text-pink-300/80 text-sm mt-0.5">
          {activeSakhi.city || 'India'}{' '}
          {activeSakhi.tagline ? `• "${activeSakhi.tagline}"` : ''}
        </p>
        <p className="text-sm font-medium text-pink-400 animate-pulse mt-3 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          <span>{isHost ? `Calling ${activeSakhi.name}...` : 'Ringing... Connecting with Sakhi'}</span>
        </p>
      </div>

      {/* Center Avatar with Pulsing Rings */}
      <div className="relative z-10 flex items-center justify-center my-auto">
        <div className="absolute w-56 h-56 rounded-full border border-pink-500/30 animate-ping-slow"></div>
        <div className="absolute w-44 h-44 rounded-full border border-purple-500/40 animate-pulse"></div>

        <div className="relative w-36 h-36 rounded-full p-1 bg-gradient-to-tr from-pink-500 via-fuchsia-500 to-purple-600 shadow-2xl shadow-pink-600/50">
          <img
            src={activeSakhi.avatar}
            alt={activeSakhi.name}
            className="w-full h-full rounded-full object-cover"
          />
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 flex flex-col items-center pb-12 gap-3 w-full max-w-xs">
        <p className="text-xs text-gray-400 text-center">
          {isHost
            ? '🌸 Host Calling: 100% FREE • Zero Balance Required'
            : `Rate: ₹${rate}/min will deduct live once connected`}
        </p>

        {/* Live Volume Up / Down & Speaker Control Bar */}
        <CallVolumeControls />

        <div className="flex items-center justify-center gap-8 w-full mt-1">
          {/* Speaker On / Off Toggle */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSpeaker();
              }}
              className={`flex items-center justify-center w-14 h-14 rounded-full transition-all ${
                isSpeakerOn
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/50 border-2 border-emerald-400'
                  : 'bg-white/10 hover:bg-white/20 text-amber-300 border border-white/20'
              }`}
              title={isSpeakerOn ? 'Speaker ON (Loud)' : 'Speaker OFF (Soft/Earpiece)'}
            >
              {isSpeakerOn ? (
                <Volume2 className="w-6 h-6" />
              ) : (
                <Volume1 className="w-6 h-6 text-amber-400" />
              )}
            </button>
            <span className="text-[11px] font-bold text-gray-300">
              {isSpeakerOn ? 'Speaker ON' : 'Speaker OFF'}
            </span>
          </div>

          {/* Cancel Call Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                sounds.stopRingtone();
                cancelCalling();
              }}
              className="flex items-center justify-center w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/50 transition-transform transform active:scale-95"
              title="Cancel Call"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
              Cancel
            </span>
          </div>

          {/* Mute Mic Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className={`flex items-center justify-center w-14 h-14 rounded-full transition-all ${
                isMuted
                  ? 'bg-red-500/30 text-red-400 border-2 border-red-400'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
              title={isMuted ? 'Mic Muted' : 'Mic ON'}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <span className="text-[11px] font-bold text-gray-300">
              {isMuted ? 'Muted' : 'Mute'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
