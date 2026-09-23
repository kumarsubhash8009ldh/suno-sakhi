import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageCircle, AlertCircle, Heart, Sparkles, Check, CheckCheck, Lock, LogIn } from 'lucide-react';
import { Sakhi } from '../types';
import { useHost, MESSAGE_RATE, MAX_MESSAGE_WORDS } from '../context/HostContext';
import { useWallet } from '../context/WalletContext';
import { markThreadAsRead, getChatClientId } from '../services/chatSync';
import { getCurrentUser, useActiveSession } from '../services/userAuthSync';

interface InCallChatDrawerProps {
  sakhi: Sakhi;
  isOpen: boolean;
  onClose: () => void;
}

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
  return (
    <span className="inline-flex items-center text-[#8696a0] ml-1" title="Sent (Single Grey Tick)">
      <Check className="w-3.5 h-3.5" />
    </span>
  );
};

export const InCallChatDrawer: React.FC<InCallChatDrawerProps> = ({ sakhi, isOpen, onClose }) => {
  const { messages, sendMessage, userRole, isHostLoggedIn, hostProfile } = useHost();
  const { balance, openWalletModal } = useWallet();
  const [inputText, setInputText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const myClientId = getChatClientId();
  const session = useActiveSession();
  const isHostViewer = Boolean(
    session.role === 'host' ||
    userRole === 'host' ||
    isHostLoggedIn ||
    localStorage.getItem('sunosakhi_host_logged_in') === 'true' ||
    localStorage.getItem('sunosakhi_active_role') === 'host' ||
    (hostProfile?.phone && String(hostProfile.phone).replace(/\D/g, '').length >= 10)
  );
  const isLoggedIn = session.isLoggedIn;

  const thread = messages[sakhi.id] || [];

  // Calculate word count
  const currentWords = inputText.trim().split(/\s+/).filter(Boolean);
  const wordCount = currentWords.length;
  const isOverLimit = wordCount > MAX_MESSAGE_WORDS;

  // Determine if a message was sent by the current viewer
  const isMsgSentByMe = (msg: (typeof thread)[0]): boolean => {
    if (isHostViewer) {
      return msg.sender === 'sakhi';
    }
    return msg.sender === 'user';
  };

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      markThreadAsRead(sakhi.id, 'user');
    }
  }, [thread, isOpen, sakhi.id]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (wordCount === 0) return;

    if (isOverLimit) {
      setErrorMsg(`Message limit exceed ho gayi! Maximum ${MAX_MESSAGE_WORDS} words allowed hain (Aapke: ${wordCount} words).`);
      return;
    }

    const res = sendMessage(sakhi.id, sakhi.name, inputText);
    if (res.success) {
      setInputText('');
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 max-h-[75vh] sm:max-h-[60vh] sm:max-w-md sm:right-4 sm:left-auto sm:bottom-24 flex flex-col rounded-t-3xl sm:rounded-3xl bg-black/85 backdrop-blur-xl border border-pink-500/40 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 text-white">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-[#160a26]/90">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-pink-400 p-[1px]">
            <img src={sakhi.avatar} alt={sakhi.name} className="w-full h-full rounded-full object-cover" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1">
              Sakhi Chat with {sakhi.name}
              <Heart className="w-3 h-3 text-pink-400 fill-pink-400" />
            </h4>
            <p className="text-[10px] text-pink-300/80 font-medium">
              Sakhi Chat: ₹{MESSAGE_RATE} / msg • Max {MAX_MESSAGE_WORDS} words
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Thread (WhatsApp dark style) */}
      <div className="flex-1 p-3 overflow-y-auto max-h-60 sm:max-h-52 text-xs bg-[#0b141a] flex flex-col">
        {!isLoggedIn ? (
          <div className="my-auto flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center mb-2.5 text-pink-400">
              <Lock className="w-6 h-6 text-pink-400 animate-pulse" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">
              🔒 Chat Ke Liye Login Zaroori Hai
            </h4>
            <p className="text-[11px] text-gray-300 max-w-xs mb-3">
              Bina ID login kare koi message send ya receive nahi ho sakta. Sender & Receiver dono ka logged in hona anivarya hai.
            </p>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-user-auth', { detail: { focus: 'user' } }));
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Mobile Se Login Karein</span>
            </button>
          </div>
        ) : thread.length === 0 ? (
          <div className="text-center py-6 text-gray-400 my-auto">
            <MessageCircle className="w-8 h-8 text-emerald-400/50 mx-auto mb-1.5" />
            <p className="text-gray-200">Koi message nahi hai abhi. Pehla message bhejein!</p>
            <p className="text-[10px] text-gray-400 mt-1">₹{MESSAGE_RATE} / message (Max {MAX_MESSAGE_WORDS} words)</p>
          </div>
        ) : (
          <div className="w-full flex flex-col space-y-2 py-1">
            {thread.map((msg) => {
              const isSentByMe = isMsgSentByMe(msg);

              return (
                /* Dedicated full-width row: Right for sender, Left for receiver */
                <div
                  key={msg.id}
                  className={`w-full flex my-1 ${isSentByMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`relative max-w-[85%] px-3.5 py-2 shadow-md ${
                      isSentByMe
                        ? 'bg-[#005c4b] text-white rounded-2xl rounded-tr-none ml-auto border border-emerald-500/20'
                        : 'bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-none mr-auto border border-white/10'
                    }`}
                  >
                    {/* Sender / Receiver Label */}
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span
                        className={`text-[9px] font-bold flex items-center gap-1 ${
                          isSentByMe ? 'text-emerald-300' : 'text-pink-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSentByMe ? 'bg-emerald-400' : 'bg-pink-400'
                          }`}
                        ></span>
                        <span>{isSentByMe ? 'Aap (Sender)' : `${sakhi.name} (Receiver)`}</span>
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed break-words select-text text-[#e9edef]">{msg.text}</p>

                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[9px] select-none ${
                        isSentByMe ? 'text-emerald-200/75' : 'text-[#8696a0]'
                      }`}
                    >
                      {isSentByMe && msg.cost > 0 && <span className="text-emerald-300 font-semibold">₹{msg.cost} •</span>}
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {/* WhatsApp Delivery Ticks ONLY on Outgoing Messages */}
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

      {/* Error notification */}
      {errorMsg && (
        <div className="px-3 py-1 bg-red-500/20 border-t border-red-500/40 text-red-300 text-[10px] font-semibold flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Bottom Input Area */}
      {!isLoggedIn ? (
        <div className="p-3 border-t border-white/10 bg-[#12071f]/90 flex items-center justify-between gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-[11px]">
            <Lock className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
            <span>Chat ke liye pehle login karein...</span>
          </div>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-user-auth', { detail: { focus: 'user' } }));
            }}
            className="py-2 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs flex items-center gap-1"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-[#12071f]/90 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px]">
            {isHostViewer ? (
              <span className="text-emerald-400 font-bold">
                🌸 Host ID: 100% Free (Zero Charges)
              </span>
            ) : (
              <span className="text-gray-400">
                Wallet: <strong className="text-white">₹{((balance ?? 0) || 0).toFixed(2)}</strong> (₹{MESSAGE_RATE}/msg)
              </span>
            )}
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded-full ${
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

          {/* Caller low balance alert */}
          {!isHostViewer && balance < MESSAGE_RATE && (
            <div className="flex items-center justify-between p-1.5 px-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold animate-pulse">
              <span>⚠️ Chat ke liye ₹{MESSAGE_RATE.toFixed(2)} balance hona chahiye.</span>
              <button
                type="button"
                onClick={openWalletModal}
                className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[9px] shrink-0"
              >
                Recharge
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={isHostViewer ? `Host reply (100% Free, max ${MAX_MESSAGE_WORDS} words)...` : `Type msg (max ${MAX_MESSAGE_WORDS} words, ₹${MESSAGE_RATE})...`}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              className={`flex-1 px-3.5 py-2 rounded-xl bg-black/60 border text-white text-xs focus:outline-none transition-colors ${
                isOverLimit
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-pink-500/30 focus:border-pink-500'
              }`}
            />
            <button
              type="submit"
              disabled={wordCount === 0 || isOverLimit}
              className="py-2 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isHostViewer ? 'Send (Free)' : `Send (₹${MESSAGE_RATE})`}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
