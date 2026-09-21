import React, { useState, useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, Volume1, AlertTriangle, Sparkles, Heart, Gift, MessageCircle } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useWallet } from '../context/WalletContext';
import { useHost } from '../context/HostContext';
import { InCallChatDrawer } from './InCallChatDrawer';
import { useActiveSession } from '../services/userAuthSync';
import { routeAudioOutput } from '../utils/audioOutput';
import { CallVolumeControls } from './CallVolumeControls';

export const VoiceCallModal: React.FC = () => {
  const session = useActiveSession();
  const {
    activeSakhi,
    callType,
    callStatus,
    isCallReceiver,
    durationSeconds,
    currentCost,
    isMuted,
    isSpeakerOn,
    callVolume,
    remoteStream,
    lowBalanceWarning,
    endCall,
    toggleMute,
    toggleSpeaker
  } = useCall();

  const { balance, openWalletModal } = useWallet();
  const { openGiftTray, activeGifts, isHostLoggedIn, hostProfile, userRole } = useHost();
  const isHostUser =
    isCallReceiver ||
    userRole === 'host' ||
    isHostLoggedIn ||
    session.role === 'host' ||
    localStorage.getItem('sunosakhi_host_logged_in') === 'true' ||
    localStorage.getItem('sunosakhi_active_role') === 'host' ||
    Boolean(hostProfile?.phone && String(hostProfile.phone).replace(/\D/g, '').length >= 10);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const playAudio = () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = false;
        if (remoteStream) {
          remoteStream.getAudioTracks().forEach((t) => {
            t.enabled = true;
          });
          if (remoteAudioRef.current.srcObject !== remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
        }
        routeAudioOutput(remoteAudioRef.current, isSpeakerOn, callVolume);
        remoteAudioRef.current.play().catch((err) => {
          console.warn('Audio autoPlay attempt (waiting for user gesture):', err);
        });
      }
    };

    playAudio();

    // Unlock audio on mobile devices or strict autoplay policies
    const handleInteraction = () => {
      playAudio();
    };

    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [remoteStream, isSpeakerOn, callVolume]);

  if (callStatus !== 'connected' || callType !== 'voice' || !activeSakhi) return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-b from-[#140822] via-[#0d0417] to-black text-white">
      {/* Real-time WebRTC audio playback for remote companion */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '1px', height: '1px', opacity: 0.001 }}
      />

      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-pink-600/20 blur-3xl pointer-events-none"></div>

      {/* Floating Live Gift Animations */}
      <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
        {activeGifts.map((anim) => (
          <div
            key={anim.id}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce duration-700"
          >
            <div className="p-3 rounded-full bg-pink-600/40 backdrop-blur-md border border-pink-400 shadow-2xl shadow-pink-500/50">
              <span className="text-6xl drop-shadow-lg">{anim.gift.icon}</span>
            </div>
            <span className="mt-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-pink-300 font-bold text-xs border border-pink-500/30">
              {anim.senderName} sent {anim.gift.name}!
            </span>
          </div>
        ))}
      </div>

      {/* Top Bar info */}
      <div className="relative z-10 flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={activeSakhi.avatar}
              alt={activeSakhi.name}
              className="w-12 h-12 rounded-full border-2 border-pink-500/50 object-cover"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-black rounded-full"></div>
          </div>
          <div>
            <h3 className="font-bold text-base flex items-center gap-1.5">
              {activeSakhi.name}
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            </h3>
            <p className="text-xs text-pink-300/80">{activeSakhi.city} • Verified</p>
          </div>
        </div>

        {/* Live Call Timer & Role Badge */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="font-mono text-sm font-semibold tracking-wider">{formatTime(durationSeconds)}</span>
          </div>
          {isHostUser ? (
            isCallReceiver ? (
              <span className="text-[11px] font-black text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                Host Earning: +₹{currentCost.toFixed(2)} (60%)
              </span>
            ) : (
              <span className="text-[11px] font-black text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                🌸 Host Outgoing: 100% FREE (₹0)
              </span>
            )
          ) : (
            <span className="text-[11px] font-semibold text-pink-400">
              ₹5/min • Balance: ₹{balance.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Center Companion Avatar with Sound Wave Pulse */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto">
        <div className="relative flex items-center justify-center">
          {/* Pulsing sound wave rings */}
          <div className="absolute w-64 h-64 rounded-full border border-pink-500/20 animate-ping-slow pointer-events-none"></div>
          <div className="absolute w-52 h-52 rounded-full border border-purple-500/30 animate-pulse pointer-events-none"></div>
          <div className="absolute w-40 h-40 rounded-full bg-gradient-to-tr from-pink-500/20 to-purple-600/20 blur-xl pointer-events-none"></div>

          {/* Main Avatar */}
          <div className="relative w-36 h-36 rounded-full p-1 bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 shadow-2xl shadow-pink-600/40">
            <img
              src={activeSakhi.avatar}
              alt={activeSakhi.name}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </div>

        <div className="text-center mt-6">
          <h2 className="text-2xl font-bold tracking-tight">{activeSakhi.name}</h2>
          <p className="text-xs text-pink-300/80 mt-1 flex items-center justify-center gap-1">
            <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
            <span>{activeSakhi.tagline || 'Live connected on SunoSakhi'}</span>
          </p>
        </div>

        {/* Low balance warning */}
        {!isHostUser && lowBalanceWarning && (
          <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold animate-pulse">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Balance kam hai (&lt;1 min bacha hai). Kripya recharge karein!</span>
            <button
              onClick={openWalletModal}
              className="ml-1 underline font-bold hover:text-amber-200"
            >
              Recharge
            </button>
          </div>
        )}

        {/* Status Indicator */}
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          {isMuted ? 'Aapka mic mute hai' : 'Voice is crystal clear'}
          <span className="text-gray-500">•</span>
          <span className={isSpeakerOn ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {isSpeakerOn ? '🔊 Speaker ON' : '🔈 Earpiece / Soft'}
          </span>
        </p>
      </div>

      {/* Volume & Speaker Control Bar */}
      <div className="relative z-20 flex flex-col items-center my-1">
        <CallVolumeControls />
      </div>

      {/* Bottom Controls with Chat & Gifts */}
      <div className="relative z-10 flex flex-col items-center pb-6 gap-3">
        <div className="flex items-center gap-3 sm:gap-4 p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-all ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* In-Call Sakhi Chat Button (₹2 / msg) */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-3 px-3.5 rounded-full transition-all flex items-center gap-1.5 ${
              isChatOpen
                ? 'bg-pink-600 text-white'
                : 'bg-white/10 hover:bg-white/20 text-pink-300'
            }`}
            title="Sakhi Chat (₹2/msg)"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[11px] font-bold">Sakhi Chat (₹2)</span>
          </button>

          {/* Send Gift Button */}
          <button
            onClick={openGiftTray}
            className="p-3 px-3.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white shadow-lg shadow-pink-600/40 flex items-center gap-1.5"
            title="Send Gift"
          >
            <Gift className="w-5 h-5" />
            <span className="text-[11px] font-bold">Gifts</span>
          </button>

          {/* Speaker Button */}
          <button
            onClick={toggleSpeaker}
            className={`p-3 rounded-full transition-all flex items-center justify-center ${
              isSpeakerOn
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/50 border border-emerald-400'
                : 'bg-white/10 hover:bg-white/20 text-amber-300 border border-white/20'
            }`}
            title={isSpeakerOn ? 'Speaker ON (Loud)' : 'Speaker OFF (Soft/Earpiece)'}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <Volume1 className="w-5 h-5 text-amber-400" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={() => endCall('user_ended')}
            className="p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/50 transform active:scale-95 transition-all"
            title="End Voice Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>

        <p className="text-[11px] text-gray-400">
          {isHostUser
            ? '🌸 Host ID: Outgoing & Incoming Calls are 100% FREE (₹0 Charges)'
            : 'Voice: ₹5/min • Sakhi Chat: ₹2/msg (Max 110 words) • Host earns 60%'}
        </p>
      </div>

      {/* In-Call Chat Drawer Overlay */}
      <InCallChatDrawer
        sakhi={activeSakhi}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
};
