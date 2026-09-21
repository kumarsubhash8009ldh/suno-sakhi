import React, { useEffect } from 'react';
import { MessageCircle, X, ArrowRight, Sparkles, Volume2 } from 'lucide-react';
import { IncomingMessageNotification } from '../types';

interface HostMessageToastProps {
  notification: IncomingMessageNotification | null;
  onDismiss: () => void;
  onOpenReply: (notification: IncomingMessageNotification) => void;
}

export const HostMessageToast: React.FC<HostMessageToastProps> = ({
  notification,
  onDismiss,
  onOpenReply
}) => {
  useEffect(() => {
    if (!notification) return;

    // Trigger instant chime and vibration when toast pops up
    try {
      import('../utils/soundEffects').then(({ sounds }) => {
        sounds.playMessageReceived();
      });
    } catch (e) {}

    const timer = setTimeout(() => {
      onDismiss();
    }, 7000);

    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label={`New message from ${notification.callerName}`}
      className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[9999] w-[94%] max-w-md animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1e0a2f]/95 via-[#290f3e]/95 to-[#150722]/95 border-2 border-pink-500/50 p-3 sm:p-4 shadow-2xl shadow-pink-950/70 backdrop-blur-xl flex items-center justify-between gap-3 text-white">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl pointer-events-none"></div>

        {/* Icon with pulsing indicator or avatar */}
        <div className="relative flex-shrink-0">
          {notification.senderAvatar ? (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden border-2 border-pink-500/60 shadow-lg shadow-pink-600/40">
              <img src={notification.senderAvatar} alt="Sender" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-600/40">
              <MessageCircle className="w-5 h-5 animate-bounce" />
            </div>
          )}
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#1e0a2f] animate-pulse"></span>
        </div>

        {/* Sender name & message preview */}
        <div
          className="flex-1 min-w-0 cursor-pointer text-left"
          onClick={() => onOpenReply(notification)}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>{notification.senderRole === 'sakhi' ? '🌸 Naya Sakhi Message' : '👤 Naya Caller Message'}</span>
            </span>
            <Volume2 className="w-3 h-3 text-emerald-400 animate-pulse" />
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">
            {notification.senderRole === 'sakhi' ? (notification.sakhiName || 'Sakhi') : (notification.callerName || 'Caller')}
          </h4>
          <p className="text-[11px] text-gray-300 truncate max-w-[220px] sm:max-w-xs mt-0.5">
            "{notification.text}"
          </p>
        </div>

        {/* Actions: Quick Reply and Dismiss */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onOpenReply(notification)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 text-white font-extrabold text-xs shadow-md shadow-pink-600/30 flex items-center gap-1 transition-all active:scale-95"
            title="Open Chat and Reply"
          >
            <span>Reply</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={onDismiss}
            className="p-1 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
