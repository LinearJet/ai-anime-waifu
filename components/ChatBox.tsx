
// components/ChatBox.tsx
import React, { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBoxProps {
  onExpressionChange?: (emotion: string) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ onExpressionChange }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Get text response from Gemini
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          systemPrompt: 'You are a friendly anime girl AI assistant. Keep responses concise, cute, and engaging. Use casual, friendly language.'
        })
      });

      const chatData = await chatResponse.json();

      if (!chatData.success) {
        throw new Error(chatData.error);
      }

      // 2. Classify emotion
      const emotionResponse = await fetch('/api/emotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chatData.text })
      });

      const emotionData = await emotionResponse.json();
      const emotion = emotionData.success ? emotionData.emotion : '[neutral]';

      // 3. Generate speech with emotion
      const ttsResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: chatData.text,
          emotion: emotion
        })
      });

      const ttsData = await ttsResponse.json();

      if (ttsData.success) {
        // 4. Only display message when audio is ready
        const assistantMessage: Message = { 
          role: 'assistant', 
          content: chatData.text 
        };
        setMessages(prev => [...prev, assistantMessage]);

        // 5. Play audio
        const audio = new Audio(`data:audio/mpeg;base64,${ttsData.audio}`);
        audio.play().catch(err => console.error('Audio playback error:', err));
      } else {
        throw new Error('Failed to generate audio');
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isMinimized) {
    return (
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
      }}>
        <button
          onClick={() => setIsMinimized(false)}
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            color: 'white',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          💬
        </button>
      </div>
    );
  }

  // Get last 2 messages (1 user + 1 assistant pair, or latest 2)
  const visibleMessages = messages.slice(-2);

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      pointerEvents: 'none',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: 0,
      margin: 0,
      isolation: 'isolate',
    }}>
      {/* Messages Area - Transparent, only shows last 2 messages */}
      <div style={{
        width: '100%',
        maxWidth: '800px',
        padding: '0 20px 16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none',
      }}>
        {visibleMessages.map((msg, idx) => (
          <div
            key={messages.length - 2 + idx}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '12px 18px',
                borderRadius: '18px',
                background: msg.role === 'user' 
                  ? 'rgba(59, 130, 246, 0.85)'
                  : 'rgba(30, 30, 30, 0.85)',
                color: 'white',
                fontSize: '15px',
                lineHeight: '1.5',
                wordWrap: 'break-word',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                pointerEvents: 'auto',
                border: 'none',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            animation: 'slideUp 0.3s ease-out',
          }}>
            <div style={{
              padding: '12px 18px',
              borderRadius: '18px',
              background: 'rgba(30, 30, 30, 0.85)',
              color: 'white',
              fontSize: '15px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              border: 'none',
            }}>
              <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                ●●●
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box - Glassmorphic */}
      <div style={{
        width: '100%',
        maxWidth: '800px',
        padding: '0 20px 20px 20px',
        pointerEvents: 'auto',
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '12px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          isolation: 'isolate',
          WebkitMaskImage: '-webkit-radial-gradient(white, white)',
          maskImage: 'radial-gradient(white, white)',
        }}>
          {/* Minimize Button */}
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s',
              outline: 'none',
              border: '0',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            ─
          </button>

          {/* Input Field */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={isLoading}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '12px 18px',
              color: 'white',
              fontSize: '15px',
              outline: 'none',
              transition: 'all 0.2s',
              border: '0',
              WebkitAppearance: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          />

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
              background: input.trim() && !isLoading
                ? 'rgba(59, 130, 246, 0.8)'
                : 'rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              width: '48px',
              height: '48px',
              color: 'white',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              fontSize: '20px',
              transition: 'all 0.2s',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              outline: 'none',
              border: '0',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              if (input.trim() && !isLoading) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 1)';
              }
            }}
            onMouseLeave={(e) => {
              if (input.trim() && !isLoading) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)';
              }
            }}
          >
            {isLoading ? '...' : '→'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};