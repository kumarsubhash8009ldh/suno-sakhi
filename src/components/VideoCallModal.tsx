import React, { useRef, useEffect, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera, AlertTriangle, Gift, Sparkles, Heart, MessageCircle, Volume2, Volume1 } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useWallet } from '../context/WalletContext';
import { useHost } from '../context/HostContext';
import { InCallChatDrawer } from './InCallChatDrawer';
import { useActiveSession } from '../services/userAuthSync';
import { routeAudioOutput } from '../utils/audioOutput';
import { CallVolumeControls } from './CallVolumeControls';

export const VideoCallModal: React.FC = () => {
  const session = useActiveSession();
  const {
    activeSakhi,
    callType,
    callStatus,
    isCallReceiver,
    durationSeconds,
    currentCost,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    callVolume,
    localStream,
    remoteStream,
    lowBalanceWarning,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    switchCamera
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
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.muted = false;
      remoteStream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      routeAudioOutput(remoteVideoRef.current, isSpeakerOn, callVolume);
      remoteVideoRef.current.play().catch((err) => {
        console.warn('Remote video playback warning:', err);
      });
    }
  }, [remoteStream, isSpeakerOn, callVolume, callStatus]);

  if (callStatus !== 'connected' || callType !== 'video' || !activeSakhi) return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black text-white overflow-hidden">
      {/* Companion Main Video Stream (Full Screen Real-Time WebRTC) */}
      <div className="absolute inset-0 z-0 bg-[#0c0414] flex items-center justify-center">
        {remoteStream ? (
          <video
            ref={(el) => {
              remoteVideoRef.current = el;
              if (el && remoteStream && el.srcObject !== remoteStream) {
                el.srcObject = remoteStream;
                routeAudioOutput(el, isSpeakerOn, callVolume);
                el.play().catch(() => {});
              }
            }}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={activeSakhi.videoPoster}
            alt={activeSakhi.name}
            className="w-full h-full object-cover filter brightness-95"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60 pointer-events-none"></div>
        <div className="absolute inset-0 bg-pink-500/5 mix-blend-overlay pointer-events-none"></div>
      </div>

      {/* Floating Live Gift Animations on Screen */}
      <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
        {activeGifts.map((anim) => (
          <div
            key={anim.id}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce duration-700"
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

      {/* Top Bar with Timer, Live Charges, Balance & Picture-in-Picture */}
      <div className="relative z-10 flex items-start justify-between p-4 pt-6">
        {/* Call Duration, Rate & Role Earning Badge */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 w-fit">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="font-mono text-sm font-semibold tracking-wider text-white">
              {formatTime(durationSeconds)}
            </span>
          </div>
          {isHostUser ? (
            isCallReceiver ? (
              <span className="text-[11px] font-black text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 w-fit">
                Host Earning: +₹{currentCost.toFixed(2)} (60%)
              </span>
            ) : (
              <span className="text-[11px] font-black text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 w-fit">
                🌸 Host Video Call: 100% FREE (₹0)
              </span>
            )
          ) : (
            <span className="text-[11px] font-semibold text-pink-300 drop-shadow">
              Video: ₹10/min • Bal: ₹{balance.toFixed(2)}
            </span>
          )}
        </div>

        {/* Floating User Self-Video PiP */}
        <div className="relative w-24 h-32 sm:w-28 sm:h-36 rounded-2xl overflow-hidden border-2 border-pink-500/80 shadow-2xl shadow-pink-600/40 bg-black">
          {localStream && !isVideoOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-400">
              <VideoOff className="w-6 h-6 mb-1 text-pink-400" />
              <span className="text-[10px] font-medium">Cam Off</span>
            </div>
          )}
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white">
            You
          </div>
        </div>
      </div>

      {/* Low balance alert */}
      {!isHostUser && lowBalanceWarning && (
        <div className="relative z-20 mx-4 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/30 backdrop-blur-md border border-amber-500/50 text-amber-200 text-xs font-semibold animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Balance kam hai (&lt;1 min bacha hai).</span>
          </div>
          <button
            onClick={openWalletModal}
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0"
          >
            Recharge
          </button>
        </div>
      )}

      {/* Companion Info Banner with Speaker Status */}
      <div className="relative z-10 px-6 mb-2 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
          <span className="text-sm font-bold text-white">{activeSakhi.name}</span>
          <span className="text-xs text-pink-300">({activeSakhi.city})</span>
          <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400 ml-1" />
        </div>

        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md border ${
          isSpeakerOn
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        }`}>
          {isSpeakerOn ? '🔊 Speaker ON' : '🔈 Earpiece / Soft'}
        </span>
      </div>

      {/* Interactive Volume & Speaker Control Bar */}
      <div className="relative z-20 flex flex-col items-center my-1">
        <CallVolumeControls />
      </div>

      {/* Bottom Floating Control Bar with Chat & Gifts */}
      <div className="relative z-10 flex flex-col items-center pb-6 pt-1">
        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-full bg-black/70 backdrop-blur-lg border border-white/15 shadow-2xl">
          {/* Mute Mic */}
          <button
            onClick={toggleMute}
            className={`p-2.5 sm:p-3 rounded-full transition-all ${
              isMuted
                ? 'bg-red-500 text-white'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Speaker Button */}
          <button
            onClick={toggleSpeaker}
            className={`p-2.5 sm:p-3 rounded-full transition-all flex items-center justify-center ${
              isSpeakerOn
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/50 border border-emerald-400'
                : 'bg-white/15 hover:bg-white/25 text-amber-300 border border-white/20'
            }`}
            title={isSpeakerOn ? 'Speaker ON (Loud)' : 'Speaker OFF (Soft/Earpiece)'}
          >
            {isSpeakerOn ? (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Volume1 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            )}
          </button>

          {/* Toggle Video */}
          <button
            onClick={toggleVideo}
            className={`p-2.5 sm:p-3 rounded-full transition-all ${
              isVideoOff
                ? 'bg-red-500 text-white'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
            title={isVideoOff ? 'Start Camera' : 'Stop Camera'}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Live In-Call Sakhi Chat Button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2.5 sm:p-3 px-3 sm:px-4 rounded-full transition-all flex items-center gap-1 ${
              isChatOpen
                ? 'bg-pink-600 text-white'
                : 'bg-white/15 hover:bg-white/25 text-pink-300'
            }`}
            title="Sakhi Chat (₹2/msg)"
          >
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[11px] font-bold">Sakhi Chat (₹2)</span>
          </button>

          {/* Send Gift Button */}
          <button
            onClick={openGiftTray}
            className="p-2.5 sm:p-3 px-3 sm:px-4 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white shadow-lg shadow-pink-600/50 flex items-center gap-1"
            title="Send Gift"
          >
            <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[11px] font-bold">Gifts</span>
          </button>

          {/* Switch Camera */}
          <button
            onClick={switchCamera}
            className="p-2.5 sm:p-3 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all"
            title="Switch Camera"
          >
            <SwitchCamera className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* End Call Button */}
          <button
            onClick={() => endCall('user_ended')}
            className="p-3 sm:p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/50 transform active:scale-95 transition-all"
            title="End Video Call"
          >
            <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <p className="text-[11px] text-gray-400 mt-2">
          {isHostUser
            ? '🌸 Host ID: Video Call is 100% FREE (₹0 Charges) • Zero Deductions'
            : 'Video: ₹15/min • Sakhi Chat: ₹3/msg (Max 150 words) • Rank 1 Host ₹7/min'}
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
