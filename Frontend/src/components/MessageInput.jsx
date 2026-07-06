import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square, Link as LinkIcon } from 'lucide-react';

// Web Speech API is prefixed on Chromium and absent on Firefox/Safari.
const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function MessageInput({ onSendMessage, disabled = false }) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const recognitionRef = useRef(null);
  const baseTextRef = useRef(''); // text already typed before dictation started

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message, evidenceUrl.trim() || null);
      setMessage('');
      setEvidenceUrl('');
      setShowEvidence(false);
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const startRecording = () => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || 'en-US';
    recognitionRef.current = recognition;
    baseTextRef.current = message ? `${message.trim()} ` : '';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setMessage(baseTextRef.current + transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognition.start();
    setIsRecording(true);
  };

  return (
    <div className="border-t bg-white p-4">
      {showEvidence && (
        <input
          type="url"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="Paste a source link (https://…) to back your claim"
          className="mb-2 w-full p-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      )}
      <div className="flex items-end space-x-2">
        <button
          type="button"
          onClick={() => setShowEvidence((v) => !v)}
          disabled={disabled}
          aria-label="Attach a source link"
          title="Cite a source"
          className={`p-2 rounded-full transition disabled:opacity-50 ${
            showEvidence || evidenceUrl ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <LinkIcon size={20} />
        </button>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            disabled ? 'Chat unavailable' : isRecording ? 'Listening… speak your argument' : 'Type your message…'
          }
          disabled={disabled}
          className="flex-1 p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {SpeechRecognition ? (
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
            aria-label={isRecording ? 'Stop dictation' : 'Dictate message'}
            title={isRecording ? 'Stop dictation' : 'Speak your argument'}
            className={`p-2 rounded-full transition disabled:opacity-50 ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isRecording ? <Square size={20} /> : <Mic size={20} />}
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="Voice input isn't supported in this browser (try Chrome or Edge)"
            className="p-2 rounded-full bg-gray-50 text-gray-300 cursor-not-allowed"
          >
            <Mic size={20} />
          </button>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled}
          aria-label="Send message"
          className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
