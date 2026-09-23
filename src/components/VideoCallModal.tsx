import React, { useRef, useEffect, useState } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  AlertTriangle,
  Gift,
  Sparkles,
  Heart,
  MessageCircle,
  Volume2,
  Volume1,
  ShieldAlert,
  Shield,
  EyeOff,
  X,
  AlertOctagon
} from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useWallet } from '../context/WalletContext';
import { useHost } from '../context/HostContext';
import { InCallChatDrawer } from './InCallChatDrawer';
import { useActiveSession } from '../services/userAuthSync';
import { routeAudioOutput } from '../utils/audioOutput';
import { FloatingVideoCallSideDock } from './FloatingVideoCallSideDock';
import { submitNudityReport } from '../services/safetyService';

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
  const [isPrivacyBlurred, setIsPrivacyBlurred] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Nudity / Obscene Exposure');
  const [showSafetyNotice, setShowSafetyNotice] = useState(true);
  const [submittingReport, setSubmittingReport] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Auto-dismiss safety notice after 5 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowSafetyNotice(false), 5000);
    return () => clearTimeout(t);
  }, []);

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

  const handleNudityReportSubmit = async () => {
    setSubmittingReport(true);
    try {
      const reporterRole: 'host' | 'caller' = isHostUser ? 'host' : 'caller';
      const offenderRole: 'host' | 'caller' = isHostUser ? 'caller' : 'host';
      const reporterPhone = session.phone || (isHostUser ? (hostProfile?.phone || '') : '');
      const reporterName = session.name || (isHostUser ? (hostProfile?.name || 'Host') : 'Caller');
      const offenderPhone = isHostUser ? (session.phone || '') : (activeSakhi?.phone || '');
      const offenderName = isHostUser ? (session.name || 'Caller') : (activeSakhi?.name || 'Sakhi');
      const offenderId = isHostUser ? undefined : activeSakhi?.id;

      await submitNudityReport({
        reportedByRole: reporterRole,
        reporterPhone,
        reporterName,
        offenderPhone,
        offenderName,
        offenderRole,
        offenderId,
        reason: reportReason,
        callType: 'video'
      });

      setSubmittingReport(false);
      setIsReportModalOpen(false);
      endCall('nudity_ban');
      alert('🚨 Report Submitted! Call turant disconnect kar di gayi hai aur user ko permanent ban ke liye blacklisted mark kar diya gaya hai.');
    } catch {
      setSubmittingReport(false);
      setIsReportModalOpen(false);
      endCall('nudity_ban');
    }
  };

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
            className={`w-full h-full object-cover transition-all duration-300 ${
              isPrivacyBlurred ? 'filter blur-3xl scale-110 brightness-50' : ''
            }`}
          />
        ) : (
          <img
            src={activeSakhi.videoPoster}
            alt={activeSakhi.name}
            className={`w-full h-full object-cover filter brightness-95 transition-all duration-300 ${
              isPrivacyBlurred ? 'filter blur-3xl scale-110 brightness-50' : ''
            }`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60 pointer-events-none"></div>
        <div className="absolute inset-0 bg-pink-500/5 mix-blend-overlay pointer-events-none"></div>

        {/* Privacy Shield Active Watermark Overlay */}
        {isPrivacyBlurred && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md text-center p-6 pointer-events-none">
            <EyeOff className="w-16 h-16 text-pink-400 mb-3 animate-pulse" />
            <h3 className="text-xl font-black text-white">🛡️ Privacy Shield Active</h3>
            <p className="text-xs text-gray-300 max-w-xs mt-1">
              Video stream temporary blur hai aapki safety ke liye.
            </p>
          </div>
        )}
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
                Host Earning: +₹{currentCost.toFixed(2)}
              </span>
            ) : (
              <span className="text-[11px] font-black text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 w-fit">
                🌸 Host Video Call: 100% FREE (₹0)
              </span>
            )
          ) : (
            <span className="text-[11px] font-semibold text-pink-300 drop-shadow">
              Video: ₹15/min • Bal: ₹{balance.toFixed(2)}
            </span>
          )}
        </div>

        {/* Anti-Nudity Zero Tolerance Safety Warning Badge */}
        <div className="flex flex-col items-center">
          <div className="px-3 py-1 rounded-full bg-red-950/80 border border-red-500/60 backdrop-blur-md flex items-center gap-1.5 text-[10px] font-black text-red-200 shadow-xl shadow-red-950/80">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>🚫 NUDITY BAN ACTIVE</span>
          </div>
          <span className="text-[9px] text-gray-400 mt-0.5 font-medium">Zero Tolerance • Instant Ban</span>
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

      {/* 5-second Auto-Dismiss Nudity Safety Alert */}
      {showSafetyNotice && (
        <div className="relative z-30 mx-4 my-1 p-2.5 rounded-2xl bg-gradient-to-r from-red-950/90 via-black/80 to-rose-950/90 border border-red-500/60 backdrop-blur-md flex items-center justify-between gap-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-red-500/20 text-red-400 flex-shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="text-[11px] leading-tight">
              <span className="font-black text-red-300">STRICT ZERO TOLERANCE:</span>{' '}
              <span className="text-gray-200">Video call par kisi bhi tarah ki Nudity ya Vulgarity 100% Ban hai. Violation karne par account aur device turant permanent ban hoga.</span>
            </div>
          </div>
          <button
            onClick={() => setShowSafetyNotice(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-white flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* Floating Side Dock for Sakhi Host ID, Speaker ON/OFF & Volume Controls */}
      <FloatingVideoCallSideDock />

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

          {/* Auxiliary Speaker Button (Desktop) */}
          <button
            onClick={toggleSpeaker}
            className={`hidden sm:flex p-2.5 sm:p-3 rounded-full transition-all items-center justify-center ${
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
            title={isHostUser ? 'Sakhi Chat (100% Free)' : 'Sakhi Chat (₹3/msg)'}
          >
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[11px] font-bold">{isHostUser ? 'Chat (Free)' : 'Chat (₹3)'}</span>
          </button>

          {/* Privacy Blur Shield */}
          <button
            onClick={() => setIsPrivacyBlurred(!isPrivacyBlurred)}
            className={`p-2.5 sm:p-3 rounded-full transition-all flex items-center justify-center ${
              isPrivacyBlurred
                ? 'bg-amber-600 text-white ring-2 ring-amber-400 shadow-lg shadow-amber-600/40'
                : 'bg-white/15 hover:bg-white/25 text-gray-300'
            }`}
            title={isPrivacyBlurred ? 'Privacy Shield Disable' : 'Privacy Shield (Blur Screen)'}
          >
            {isPrivacyBlurred ? <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" /> : <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />}
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

          {/* Instant Report Nudity & Ban */}
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="p-2 sm:p-2.5 px-3 sm:px-3.5 rounded-full bg-red-600/30 hover:bg-red-600/60 text-red-300 border border-red-500/60 flex items-center gap-1.5 transition-all shadow-lg shadow-red-950/60"
            title="Report Nudity & Instant Ban"
          >
            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-[10px] font-black text-red-200 uppercase tracking-tight">Report Nudity</span>
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

      {/* Report Nudity & Instant Ban Dialog Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#1a0815] border-2 border-red-500/80 p-5 sm:p-6 space-y-4 shadow-2xl text-left relative overflow-hidden">
            {/* Top red bar */}
            <div className="flex items-start justify-between border-b border-red-500/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/40">
                  <AlertOctagon className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5">
                    <span>🚨 Report & Instant Ban</span>
                  </h3>
                  <p className="text-[11px] text-red-300">Nudity & Vulgarity Zero Tolerance Policy</p>
                </div>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-200 leading-relaxed">
              Suno Sakhi par Nudity, Vulgarity, ya kisi bhi tarah ki ashleelta <strong>100% BANNED</strong> hai. Report submit hote hi call turant cut hogi aur samne wale user ka account <strong>Permanently Block & Blacklisted</strong> ho jayega.
            </p>

            {/* Select Reason */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                Violation Reason Select Karein:
              </label>
              <div className="space-y-1.5">
                {[
                  '🔞 Nudity & Obscene Body Exposure',
                  '⚠️ Vulgar / Obscene Sexual Gestures',
                  '🚫 Harassment, Abusive or Threatening Behavior',
                  '👶 Underage User / Illegal Conduct'
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setReportReason(reason)}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between border transition-all ${
                      reportReason === reason
                        ? 'bg-red-500/20 border-red-400 text-white font-bold ring-1 ring-red-400'
                        : 'bg-black/40 border-white/10 text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <span>{reason}</span>
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      reportReason === reason ? 'border-red-400 bg-red-500' : 'border-gray-500'
                    }`}>
                      {reportReason === reason && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Confirmation Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleNudityReportSubmit}
                disabled={submittingReport}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-red-950/80 transition-all active:scale-95 disabled:opacity-50"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{submittingReport ? 'Reporting & Banning...' : '🚨 Report & Instantly Ban User'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="w-full sm:w-auto py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-gray-300 font-bold text-xs transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
