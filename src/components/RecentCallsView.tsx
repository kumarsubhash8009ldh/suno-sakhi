import React, { useState, useEffect } from 'react';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Trash2,
  Sparkles,
  ArrowRight,
  Heart
} from 'lucide-react';
import { RecentCallLog, CallType, Sakhi } from '../types';
import { getRecentCalls, clearRecentCalls } from '../services/callLogService';
import { useCall } from '../context/CallContext';

interface RecentCallsViewProps {
  onExploreSakhis: () => void;
  onlineSakhis: Sakhi[];
}

export const RecentCallsView: React.FC<RecentCallsViewProps> = ({ onExploreSakhis, onlineSakhis }) => {
  const [calls, setCalls] = useState<RecentCallLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'voice' | 'video' | 'missed'>('all');
  const { startCall } = useCall();

  useEffect(() => {
    setCalls(getRecentCalls());
  }, []);

  const handleClear = () => {
    if (window.confirm('Kya aap saari recent call history delete karna chahte hain?')) {
      clearRecentCalls();
      setCalls([]);
    }
  };

  const filteredCalls = calls.filter((c) => {
    if (filter === 'voice') return c.type === 'voice';
    if (filter === 'video') return c.type === 'video';
    if (filter === 'missed') return c.status === 'missed' || c.status === 'rejected';
    return true;
  });

  const formatDuration = (secs: number) => {
    if (secs <= 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${timeStr}`;
  };

  const handleRedial = (log: RecentCallLog) => {
    // Look up if Sakhi is in online list
    const found = onlineSakhis.find((s) => s.id === log.sakhiId);
    if (found) {
      startCall(found, log.type);
    } else {
      // Create temporary Sakhi profile to place call
      const fallbackSakhi: Sakhi = {
        id: log.sakhiId,
        name: log.sakhiName,
        age: 23,
        city: 'India',
        avatar: log.sakhiAvatar,
        videoPoster: log.sakhiAvatar,
        status: 'online',
        rating: 5.0,
        totalCalls: 1,
        languages: ['Hindi'],
        bio: 'Connecting live...',
        interests: ['Friendly Talk'],
        voiceRatePerMin: 5,
        videoRatePerMin: 10,
        audioSnippet: '',
        tagline: 'Voice Connects Hearts ♡'
      };
      startCall(fallbackSakhi, log.type);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-pink-500/20">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-pink-400" />
            <span>Recent Calls & History</span>
          </h2>
          <p className="text-xs text-pink-200/80 mt-0.5">
            Aapki sabhi voice aur video calls ka live record
          </p>
        </div>

        {calls.length > 0 && (
          <button
            onClick={handleClear}
            className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All Calls' },
          { id: 'voice', label: '🎙️ Voice (₹5/m)' },
          { id: 'video', label: '📹 Video (₹10/m)' },
          { id: 'missed', label: '❌ Missed / Cancelled' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filter === tab.id
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calls List */}
      <div className="space-y-2.5">
        {filteredCalls.length === 0 ? (
          <div className="rounded-3xl glass-card border border-white/10 p-12 text-center text-gray-400">
            <Clock className="w-12 h-12 text-pink-400/40 mx-auto mb-3" />
            <h4 className="text-base font-bold text-white">Koi call record nahi mila</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Aapne abhi tak koi call nahi ki hai. Online verified Sakhis se judkar pehli baar baat karein!
            </p>
            <button
              onClick={onExploreSakhis}
              className="mt-5 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs shadow-lg inline-flex items-center gap-2"
            >
              <span>Explore Sakhis</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          filteredCalls.map((log) => {
            const isVideo = log.type === 'video';
            const isMissed = log.status === 'missed' || log.status === 'rejected';

            return (
              <div
                key={log.id}
                className="p-3.5 sm:p-4 rounded-2xl glass-card border border-pink-500/20 hover:border-pink-500/40 transition-all flex items-center justify-between gap-3 group"
              >
                {/* Left: Avatar & Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 h-12 rounded-2xl p-0.5 bg-gradient-to-tr from-pink-500 to-purple-600 flex-shrink-0">
                    <img
                      src={log.sakhiAvatar}
                      alt={log.sakhiName}
                      className="w-full h-full rounded-[14px] object-cover"
                    />
                    <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#140824] border border-pink-500/40 text-[10px]">
                      {isVideo ? (
                        <Video className="w-3 h-3 text-purple-400" />
                      ) : (
                        <Phone className="w-3 h-3 text-pink-400" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-pink-300 transition-colors">
                        {log.sakhiName}
                      </h4>
                      <span className="text-[10px] font-mono text-pink-400 font-semibold">
                        ID: {log.sakhiId}
                      </span>
                      {isMissed && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                          Missed
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        {log.direction === 'outgoing' ? (
                          <PhoneOutgoing className="w-3 h-3 text-emerald-400" />
                        ) : isMissed ? (
                          <PhoneMissed className="w-3 h-3 text-red-400" />
                        ) : (
                          <PhoneIncoming className="w-3 h-3 text-blue-400" />
                        )}
                        <span className="text-[11px]">{log.direction === 'outgoing' ? 'Outgoing' : 'Incoming'}</span>
                      </span>
                      <span>•</span>
                      <span className="text-[11px] text-gray-300">{formatTimestamp(log.timestamp)}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      <span className="text-pink-300 font-medium">
                        Duration: <strong>{formatDuration(log.durationSeconds)}</strong>
                      </span>
                      {log.cost > 0 && (
                        <>
                          <span className="text-gray-500">•</span>
                          <span className="text-emerald-400 font-bold">
                            Cost: ₹{((log.cost ?? 0) || 0).toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Quick Redial Button */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRedial(log)}
                    className="p-3 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-md hover:scale-105 transition-all flex items-center gap-1.5 text-xs font-bold"
                    title={`Call again with ${log.type}`}
                  >
                    {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    <span className="hidden sm:inline">Call Again</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
