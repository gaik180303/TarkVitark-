import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import UpperHeader from '../components/UpperHeader';
import ChatBody from '../components/ChatBody';
import MessageInput from '../components/MessageInput';
import Navbar from '../components/Navbar';
import LeftSideBar from '../components/LeftSideBar';
import MindsChangedPanel from '../components/MindsChangedPanel';
import TurnBanner from '../components/TurnBanner';
import MatchReport from '../components/MatchReport';
import { toast } from 'sonner';
import userService from '../services/userService';
import messageService from '../services/messageService';

// The API base includes the /api/v1 path; socket.io must connect to the bare origin.
const SOCKET_ORIGIN = new URL(import.meta.env.VITE_API_BASE_URL).origin;

function DiscussionPage() {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voteUpdate, setVoteUpdate] = useState(null);
  const [turn, setTurn] = useState({ active: false });
  const [matchResult, setMatchResult] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const socketRef = useRef(null);

  const location = useLocation();
  const { roomId, title, author, status } = location.state || {};

  useEffect(() => {
    if (!roomId) return undefined;

    let active = true;

    const setup = async () => {
      try {
        setLoading(true);
        setError('');

        // 1. Current user + stance for this room
        const user = await userService.getCurrentUser();
        const stance = await userService.getDebateStance(roomId);
        if (!active) return;
        setCurrentUser({ ...user, stance });

        // 2. Persistent chat history
        const history = await messageService.getMessages(roomId);
        if (!active) return;
        setMessages(Array.isArray(history) ? history : []);

        // 3. Real-time connection — identity comes from the httpOnly auth cookie
        const socket = io(SOCKET_ORIGIN, { withCredentials: true });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('joinRoom', { roomId });
        });

        socket.on('receiveMessage', (newMessage) => {
          setMessages(prev => [...prev, newMessage]);
        });

        socket.on('roomUpdate', (data) => {
          setParticipants(data.participants || []);
        });

        socket.on('voteUpdate', (data) => {
          setVoteUpdate(data);
        });

        socket.on('turnUpdate', (data) => {
          setTurn(data);
        });

        socket.on('debateEnded', () => {
          toast('The debate has ended — cast your final vote!');
        });

        socket.on('debateResult', (result) => {
          setMatchResult(result);
          setReportOpen(true);
        });

        socket.on('factCheckResult', ({ messageId, factCheck }) => {
          setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, factCheck } : m)));
        });

        socket.on('messageStarred', ({ messageId, starCount }) => {
          setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, starCount } : m)));
        });

        socket.on('error', (err) => {
          setError(err.message || 'A chat error occurred.');
        });

        socket.on('connect_error', (err) => {
          setError(err.message || 'Could not connect to the chat server.');
        });
      } catch (err) {
        if (active) {
          setError(err.response?.data?.message || 'Failed to load chat data or you are not registered.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    setup();

    return () => {
      active = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [roomId]);

  const handleSendMessage = (text, evidenceUrl) => {
    if (!text.trim() || !socketRef.current) return;
    socketRef.current.emit('sendMessage', { roomId, content: text, evidenceUrl });
  };

  const handleStar = (messageId) => socketRef.current?.emit('starMessage', { roomId, messageId });
  const startDebate = () => socketRef.current?.emit('startDebate', { roomId, turnSeconds: 45 });
  const endDebate = () => socketRef.current?.emit('endDebate', { roomId });

  // Am I the host? Derived from presence (which flags the host).
  const me = participants.find((p) => String(p.id) === String(currentUser?._id));
  const isHost = !!me?.isHost;

  // Can I speak right now? Free chat unless turns are running; then only my side
  // (the host may always moderate).
  const myStance = currentUser?.stance;
  const canSpeak =
    !turn.active || isHost || !myStance || myStance === turn.currentStance;

  if (!roomId || !title) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        Invalid discussion room. Please go back and try again.
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading Chat...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-red-600">{error}</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="fixed top-0 w-full z-50">
        <Navbar />
      </div>
      <div className="flex flex-row pt-16 flex-grow">
        <div className="fixed left-0 top-16 bottom-0 w-64 overflow-y-auto bg-white border-r">
          <LeftSideBar />
        </div>
        <div className="ml-64 mr-80 flex flex-col flex-grow bg-gray-50 relative">
          <div className="fixed left-64 right-80 top-16 bg-gray-50 z-40 shadow-md">
            <UpperHeader
              title={title}
              totalUsers={participants?.length || 0}
              inFavorCount={participants?.filter(p => p.stance === 'in_favor')?.length || 0}
              againstCount={participants?.filter(p => p.stance === 'against')?.length || 0}
              hostName={author}
              hostImage={`https://ui-avatars.com/api/?name=${encodeURIComponent(author || 'Host')}`}
            />
          </div>
          <div className="fixed left-64 right-80 top-44 z-30">
            <TurnBanner turn={turn} isHost={isHost} onStart={startDebate} onEnd={endDebate} />
          </div>
          <div className="flex-1 mt-56 mb-20 overflow-y-auto px-4">
            <ChatBody
              messages={messages}
              currentUserId={currentUser?._id}
              onStar={handleStar}
            />
          </div>
          <div className="fixed left-64 right-80 bottom-0 bg-gray-50 z-40 shadow-inner px-4 py-2">
            {!canSpeak && (
              <p className="text-center text-xs text-gray-500 pb-1">
                It's the {turn.currentStance === 'in_favor' ? 'For' : 'Against'} side's turn — please wait.
              </p>
            )}
            <MessageInput
              onSendMessage={handleSendMessage}
              disabled={!!error || !currentUser || !canSpeak}
            />
          </div>
        </div>

        {/* Right rail: live Minds-Changed voting */}
        <div className="fixed right-0 top-16 bottom-0 w-80 overflow-y-auto bg-gray-50 border-l p-3">
          <MindsChangedPanel
            debateId={roomId}
            debateStatus={status}
            liveUpdate={voteUpdate}
          />
          {matchResult && (
            <button
              onClick={() => setReportOpen(true)}
              className="mt-3 w-full text-xs font-medium bg-amber-100 text-amber-800 rounded-lg py-2 hover:bg-amber-200"
            >
              🏆 View match report
            </button>
          )}
        </div>
      </div>

      {matchResult && reportOpen && (
        <MatchReport
          result={matchResult}
          motion={title}
          debateId={roomId}
          messages={messages}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

export default DiscussionPage;
