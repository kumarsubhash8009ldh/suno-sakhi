import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageCircle, AlertCircle, Heart, Phone, Video, ShieldCheck, Check, CheckCheck, Lock, LogIn } from 'lucide-react';
import { useHost, MESSAGE_RATE, MAX_MESSAGE_WORDS } from '../context/HostContext';
import { useWallet } from '../context/WalletContext';
import { useCall } from '../context/CallContext';
import { markThreadAsRead, getChatClientId, subscribeToCloudChat, getChatThreadId } from '../services/chatSync';
import { getCurrentUser, useActiveSession } from '../services/userAuthSync';
import { ChatMessage } from '../types';

const renderWhatsAppStatusTick = (status?: 'sent' | 'delivered' | 'read') => {
  if (status === 'read') {
    return (
      <span className="inline-flex items-center text-[#53bdeb] ml-1" title="Read (Double Blue Tick)">
        <CheckCheck className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center text-[#8696a0] ml-1" title="Delivered (Double Grey Tick)">
        <CheckCheck className="w-3.5 h-3.5" />
      </span>
    );
  }
  // Default: sent -> Single Grey Tick
  return (
    <span className="inline-flex items-center text-[#8696a0] ml-1" title="Sent (Single Grey Tick)">
      <Check className="w-3.5 h-3.5" />
    </span>
  );
};

export const DirectChatModal: React.FC = () => {
  const { directChatSakhi, closeDirectChat, messages, sendMessage, userRole, isHostLoggedIn, hostProfile } = useHost();
  const { balance, openWalletModal } = useWallet();
  const { startCall } = useCall();
  const [inputText, setInputText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const myClientId = getChatClientId();
  const session = useActiveSession();
  const isHostViewer = Boolean(
    session.role === 'host' ||
    userRole === 'host' ||
    isHostLoggedIn ||
    localStorage.getItem('sunosakhi_host_logged_in') === 'true'
  );
  const isLoggedIn = session.isLoggedIn;

  const hostPhone = isHostViewer
    ? (session.phone || (hostProfile?.phone ? hostProfile.phone.replace(/\D/g, '') : '')).slice(-10)
    : (directChatSakhi?.phone || directChatSakhi?.id || '').replace(/\D/g, '').slice(-10);

  const callerPhone = isHostViewer
    ? (directChatSakhi?.phone || directChatSakhi?.id || '').replace(/\D/g, '').slice(-10)
    : (session.phone || getCurrentUser()?.phone || '').replace(/\D/g, '').slice(-10);

  const canonicalThreadId = (hostPhone.length === 10 && callerPhone.length === 10)
    ? getChatThreadId(hostPhone, callerPhone)
    : (directChatSakhi ? directChatSakhi.id : '');

  // Direct subscription to real-time messages across devices
  useEffect(() => {
    if (!directChatSakhi || !canonicalThreadId) return;

    const initial = messages[canonicalThreadId] || messages[directChatSakhi.id] || [];
    if (initial.length > 0) {
      setLiveMessages(initial);
    }

    const unsub = subscribeToCloudChat(canonicalThreadId, (cloudMsgs) => {
      setLiveMessages(cloudMsgs);
      markThreadAsRead(canonicalThreadId, isHostViewer ? 'sakhi' : 'user');
    });

    return () => {
      if (unsub) unsub();
    };
  }, [directChatSakhi?.id, canonicalThreadId, isHostViewer]);

  const thread = liveMessages.length > 0
    ? liveMessages
    : (directChatSakhi ? (messages[canonicalThreadId] || messages[directChatSakhi.id] || []) : []);

  const currentWords = inputText.trim().split(/\s+/).filter(Boolean);
  const wordCount = currentWords.length;
  const isOverLimit = wordCount > MAX_MESSAGE_WORDS;

  // Determine if a message was sent by the current viewer
  const isMsgSentByMe = (msg: (typeof thread)[0]): boolean => {
    if (isHostViewer) {
      return msg.sender === 'sakhi';
    }
    // In caller view: 'user' is the caller (sender = RIGHT), 'sakhi' is companion (receiver = LEFT)
    return msg.sender === 'user';
  };

  useEffect(() => {
    if (directChatSakhi) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      markThreadAsRead(canonicalThreadId || directChatSakhi.id, isHostViewer ? 'sakhi' : 'user');
    }
  }, [thread, directChatSakhi, canonicalThreadId, isHostViewer]);

  if (!directChatSakhi) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (wordCount === 0) return;

    if (isOverLimit) {
      setErrorMsg(`Message 110 words se zyada nahi hona chahiye (Current: ${wordCount} words).`);
      return;
    }

    const res = sendMessage(directChatSakhi.id, directChatSakhi.name, inputText);
    if (res.success) {
      const optimisticMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        sakhiId: isHostViewer ? (hostProfile?.id || `sakhi-user-${hostPhone}`) : directChatSakhi.id,
        callerId: isHostViewer ? directChatSakhi.id : `caller_${callerPhone}`,
        callerName: isHostViewer ? directChatSakhi.name : (session.name || 'You'),
        sender: isHostViewer ? 'sakhi' : 'user',
        senderId: myClientId,
        text: inputText.trim(),
        wordCount,
        cost: isHostViewer ? 0 : MESSAGE_RATE,
        timestamp: Date.now(),
        status: 'sent'
      };
      setLiveMessages((prev) => [...prev, optimisticMsg]);
      setInputText('');
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0e161e] border border-pink-500/30 shadow-2xl flex flex-col h-[620px] max-h-[92vh] overflow-hidden text-white">
        {/* Header (WhatsApp style) */}
        <div className="p-3.5 sm:p-4 border-b border-white/10 bg-[#1f2c34] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-full overflow-hidden p-0.5 bg-gradient-to-tr from-pink-500 to-purple-600">
              <img src={directChatSakhi.avatar} alt={directChatSakhi.name} className="w-full h-full rounded-full object-cover" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                {directChatSakhi.name}, <span className="text-pink-300 font-normal">{directChatSakhi.age}</span>
                <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
              </h3>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>online • {isHostViewer ? 'Host Account (100% Free • ₹0 Charges)' : `Sakhi Chat (₹${MESSAGE_RATE}/msg)`}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                closeDirectChat();
                startCall(directChatSakhi, 'voice');
              }}
              className="p-2 rounded-xl bg-pink-600/30 hover:bg-pink-600/50 text-pink-300 border border-pink-500/40 transition-colors"
              title={isHostViewer ? 'Free Voice Call' : 'Voice Call (₹5/min)'}
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                closeDirectChat();
                startCall(directChatSakhi, 'video');
              }}
              className="p-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 transition-colors"
              title={isHostViewer ? 'Free Video Call' : 'Video Call (₹10/min)'}
            >
              <Video className="w-4 h-4" />
            </button>
            <button
              onClick={closeDirectChat}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Thread (WhatsApp dark wallpaper style) */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto bg-[#0b141a] flex flex-col">
          {!isLoggedIn ? (
            <div className="my-auto flex flex-col items-center justify-center text-center px-4 py-8">
              <div className="w-16 h-16 rounded-3xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center mb-4 text-pink-400 shadow-xl shadow-pink-900/30">
                <Lock className="w-8 h-8 text-pink-400 animate-pulse" />
              </div>
              <h4 className="text-base sm:text-lg font-black text-white mb-2">
                🔒 Chat Ke Liye Login Zaroori Hai
              </h4>
              <p className="text-xs sm:text-sm text-gray-300 max-w-sm leading-relaxed mb-5">
                Bina ID login kare koi bhi message <strong>send</strong> ya <strong>receive</strong> nahi kar sakta. Sender aur Receiver dono ka registered aur logged-in hona anivarya hai.
              </p>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-user-auth', { detail: { focus: 'user' } }));
                }}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-pink-900/40 transition-all flex items-center gap-2 active:scale-95 hover:scale-105"
              >
                <LogIn className="w-4 h-4" />
                <span>Mobile Number Se Login / Sign Up Karein</span>
              </button>
              <p className="text-[11px] text-gray-400 mt-4 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% Private, Safe & Verified Chat System</span>
              </p>
            </div>
          ) : thread.length === 0 ? (
            <div className="text-center py-16 text-gray-400 my-auto">
              <MessageCircle className="w-10 h-10 text-emerald-400/50 mx-auto mb-2" />
              <p className="font-semibold text-sm text-gray-200">Koi purana message nahi hai.</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                WhatsApp jaise alag-alag row mein chat karein. Bheja hua message daayein (Right) aur aaya hua baayein (Left) show hoga.
              </p>
            </div>
          ) : (
            <div className="w-full flex flex-col space-y-2 py-1">
              {/* WhatsApp Privacy & Legend Banner */}
              <div className="flex flex-col items-center justify-center my-2 gap-1 select-none">
                <div className="px-3 py-1 rounded-lg bg-[#182229] border border-white/5 text-[#8696a0] text-[10px] flex items-center gap-1.5 shadow-sm">
                  <Lock className="w-3 h-3 text-[#f7a600]" />
                  <span>Messages are end-to-end encrypted & private</span>
                </div>
                <div className="px-2.5 py-0.5 rounded-full bg-[#182229]/80 text-[#8696a0] text-[9px] font-semibold flex items-center gap-2">
                  <span className="flex items-center gap-0.5">
                    <Check className="w-3 h-3 text-[#8696a0]" /> Sent
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <CheckCheck className="w-3 h-3 text-[#8696a0]" /> Delivered
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-[#53bdeb]">
                    <CheckCheck className="w-3 h-3 text-[#53bdeb]" /> Read
                  </span>
                </div>
              </div>

              {thread.map((msg) => {
                const isSentByMe = isMsgSentByMe(msg);

                return (
                  /* Dedicated full-width row: Right for sender, Left for receiver */
                  <div
                    key={msg.id}
                    className={`w-full flex my-1 ${isSentByMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`relative max-w-[85%] sm:max-w-[72%] px-3.5 py-2 shadow-md ${
                        isSentByMe
                          ? 'bg-[#005c4b] text-white rounded-2xl rounded-tr-none ml-auto border border-emerald-500/20'
                          : 'bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-none mr-auto border border-white/10'
                      }`}
                    >
                      {/* Sender / Receiver Label */}
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span
                          className={`text-[10px] font-bold flex items-center gap-1 ${
                            isSentByMe ? 'text-emerald-300' : 'text-pink-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSentByMe ? 'bg-emerald-400' : 'bg-pink-400'
                            }`}
                          ></span>
                          <span>{isSentByMe ? 'Aap (Sender)' : `${directChatSakhi.name} (${isHostViewer ? 'Caller' : 'Sakhi'})`}</span>
                        </span>
                      </div>

                      {/* Message Content */}
                      <p className="text-xs sm:text-[13px] leading-relaxed break-words select-text text-[#e9edef]">
                        {msg.text}
                      </p>

                      {/* Footer: Time + Cost + WhatsApp Delivery Ticks */}
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
                          isSentByMe ? 'text-emerald-200/75' : 'text-[#8696a0]'
                        }`}
                      >
                        {isSentByMe && msg.cost > 0 && <span className="text-emerald-300 font-semibold">₹{msg.cost} •</span>}
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {/* WhatsApp Ticks: ONLY on Outgoing / Sent messages */}
                        {isSentByMe && renderWhatsAppStatusTick(msg.status)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="px-4 py-1.5 bg-red-500/20 border-t border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Bottom Input Area */}
        {!isLoggedIn ? (
          <div className="p-4 border-t border-white/10 bg-[#12071f] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex-1 w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 text-xs">
              <Lock className="w-4 h-4 text-pink-400 flex-shrink-0" />
              <span>Bina login ke koi message send ya receive nahi ho sakta...</span>
            </div>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-user-auth', { detail: { focus: 'user' } }));
              }}
              className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-pink-900/40 flex items-center justify-center gap-2 transition-all flex-shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>Login Karein</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-[#12071f] flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              {isHostViewer ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Host Account: 100% Free (Zero Charges)</span>
                </span>
              ) : (
                <span className="text-gray-400">
                  Wallet Balance: <strong className="text-white">₹{((balance ?? 0) || 0).toFixed(2)}</strong>
                </span>
              )}
              <span
                className={`font-mono font-bold px-2.5 py-0.5 rounded-full ${
                  isOverLimit
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                    : wordCount > 90
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-white/10 text-gray-300'
                }`}
              >
                {wordCount} / {MAX_MESSAGE_WORDS} words
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={isHostViewer ? `Host reply (100% Free, max ${MAX_MESSAGE_WORDS} words)...` : `Type a message (Sakhi Chat: ₹${MESSAGE_RATE} per msg, max ${MAX_MESSAGE_WORDS} words)...`}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                className={`flex-1 px-4 py-3 rounded-2xl bg-black/60 border text-white text-xs focus:outline-none transition-colors ${
                  isOverLimit
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-pink-500/30 focus:border-pink-500'
                }`}
              />
              <button
                type="submit"
                disabled={wordCount === 0 || isOverLimit}
                className="py-3 px-5 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-pink-900/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isHostViewer ? 'Send (Free)' : `Send (₹${MESSAGE_RATE})`}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
