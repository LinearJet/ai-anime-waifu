// components/ChatBox.tsx
import React, { useState, useRef, useEffect } from 'react';
import { generateLipSyncData } from '../lib/lipSync';
import { classifyByRules } from '../lib/animationClassifier';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBoxProps {
  onExpressionChange?: (type: 'expression' | 'animation' | 'viseme', name: string, value: number) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ onExpressionChange }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Detect mobile and auto-minimize when not actively chatting
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
          systemPrompt: `You are Alicia, a highly intelligent AI assistant with a sarcastic, witty personality. Think Ada Wong meets a software engineer - confident, playful, and slightly nerdy.

Personality traits:
- Sarcastic and teasing, but ultimately helpful
- Intelligent and knowledgeable about tech
- Uses dry humor and clever wordplay
- Slightly smug when showing off knowledge
- Occasionally makes nerdy references
- Confident and self-assured
- Playfully competitive
- DO NOT USE EMOJIS

Keep responses concise (2-3 sentences max), witty, and engaging. Add personality to your answers - don't be bland or overly formal. Use your intelligence and humor to make interactions fun.`
        })
      });
  
      const chatData = await chatResponse.json();
  
      if (!chatData.success) {
        throw new Error(chatData.error);
      }
  
      // 2. Classify emotion, animation, and expression (hybrid approach)
      // Try rule-based first
      let classification = classifyByRules(chatData.text, userMessage.content);

      // If no rule match, use AI
      if (!classification) {
        const classifyResponse = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: chatData.text,
            conversationContext: userMessage.content 
          })
        });

        classification = await classifyResponse.json();
      }

      console.log('Using classification:', classification); // Debug
  
      // 3. Generate speech with emotion tag
      const ttsResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: chatData.text,
          emotion: classification.emotionTag
        })
      });
  
      const ttsData = await ttsResponse.json();
  
      if (ttsData.success) {
        // 4. Display message
        const assistantMessage: Message = { 
          role: 'assistant', 
          content: chatData.text 
        };
        setMessages(prev => [...prev, assistantMessage]);
  
        // 5. Apply expression and animation
        if (onExpressionChange) {
          onExpressionChange('expression', classification.expression, classification.intensity);
          onExpressionChange('animation', classification.animation, 1.0);
        }
  
        // 6. Play audio with lip sync
        const audio = new Audio(`data:audio/mpeg;base64,${ttsData.audio}`);
  
        // Generate lip sync data from text
        const lipSyncData = generateLipSyncData(chatData.text, audio.duration || 3);
        let lipSyncIndex = 0;
        let startTime = 0;
        let animationId: number;
  
        const updateLipSync = (currentTime: number) => {
          const elapsed = (currentTime - startTime) / 1000;
          
          while (lipSyncIndex < lipSyncData.length - 1 && 
                 lipSyncData[lipSyncIndex + 1].time <= elapsed) {
            lipSyncIndex++;
          }
          
          if (lipSyncIndex < lipSyncData.length) {
            const viseme = lipSyncData[lipSyncIndex].viseme;
            if (onExpressionChange) {
              onExpressionChange('viseme', 'aa', viseme.aa);
              onExpressionChange('viseme', 'ih', viseme.ih);
              onExpressionChange('viseme', 'ou', viseme.ou);
              onExpressionChange('viseme', 'ee', viseme.ee);
            }
          }
          
          if (!audio.paused && !audio.ended) {
            animationId = requestAnimationFrame(updateLipSync);
          }
        };
  
        audio.addEventListener('loadedmetadata', () => {
          const actualLipSyncData = generateLipSyncData(chatData.text, audio.duration);
          lipSyncData.splice(0, lipSyncData.length, ...actualLipSyncData);
        });
  
        audio.addEventListener('play', () => {
          startTime = performance.now();
          lipSyncIndex = 0;
          updateLipSync(startTime);
        });
  
        audio.addEventListener('ended', () => {
          cancelAnimationFrame(animationId);
          // Reset mouth but keep expression
          if (onExpressionChange) {
            onExpressionChange('viseme', 'aa', 0);
            onExpressionChange('viseme', 'ih', 0);
            onExpressionChange('viseme', 'ou', 0);
            onExpressionChange('viseme', 'ee', 0);
            // Return to idle animation after speaking
            onExpressionChange('animation', 'idle', 1.0);
          }
        });
  
        audio.addEventListener('pause', () => {
          cancelAnimationFrame(animationId);
        });
  
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
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: 0,
      margin: 0,
      isolation: 'isolate',
    }}>
      {/* Messages Area - Floating above toolbar */}
      {visibleMessages.length > 0 && (
        <div style={{
          width: '100%',
          maxWidth: '600px',
          padding: '0 16px',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
          maxHeight: '40vh',
          overflowY: 'auto',
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
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: '20px',
                  background: msg.role === 'user' 
                    ? 'rgba(0, 122, 255, 0.9)'
                    : 'rgba(60, 60, 67, 0.9)',
                  backdropFilter: 'blur(20px)',
                  color: 'white',
                  fontSize: '16px',
                  lineHeight: '1.4',
                  wordWrap: 'break-word',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                  pointerEvents: 'auto',
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
                padding: '12px 16px',
                borderRadius: '20px',
                background: 'rgba(60, 60, 67, 0.9)',
                backdropFilter: 'blur(20px)',
                color: 'white',
                fontSize: '16px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              }}>
                <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                  ●●●
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Toolbar - Grok Style */}
      <div style={{
        width: '100%',
        padding: '0 16px 20px 16px',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}>
        {/* Action Buttons Row */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Camera Button */}
          <button
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(60, 60, 67, 0.6)',
              backdropFilter: 'blur(20px)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(60, 60, 67, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(60, 60, 67, 0.6)';
            }}
          >
            📹
          </button>

          {/* Microphone Button */}
          <button
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(60, 60, 67, 0.6)',
              backdropFilter: 'blur(20px)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(60, 60, 67, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(60, 60, 67, 0.6)';
            }}
          >
            🔇
          </button>

          {/* Voice Input Button */}
          <button
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(60, 60, 67, 0.6)',
              backdropFilter: 'blur(20px)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(60, 60, 67, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(60, 60, 67, 0.6)';
            }}
          >
            🎤
          </button>

          {/* Settings Button */}
          <button
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(60, 60, 67, 0.6)',
              backdropFilter: 'blur(20px)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(60, 60, 67, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(60, 60, 67, 0.6)';
            }}
          >
            ⚙️
          </button>

          {/* Emoji/More Button */}
          <button
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(60, 60, 67, 0.6)',
              backdropFilter: 'blur(20px)',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(60, 60, 67, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(60, 60, 67, 0.6)';
            }}
          >
            😊
          </button>
        </div>

        {/* Input Bar */}
        <div style={{
          width: '100%',
          maxWidth: '600px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            flex: 1,
            background: 'rgba(60, 60, 67, 0.6)',
            backdropFilter: 'blur(20px)',
            borderRadius: '25px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Anything"
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '17px',
                outline: 'none',
                fontWeight: '400',
              }}
            />
          </div>

          {/* Stop Button (when loading) or Send Button */}
          {isLoading ? (
            <button
              onClick={() => {/* Add stop functionality if needed */}}
              style={{
                background: 'rgba(255, 59, 48, 0.9)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                padding: '12px 20px',
                border: 'none',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '16px' }}>■</span> Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: input.trim() 
                  ? 'rgba(0, 122, 255, 0.9)' 
                  : 'rgba(60, 60, 67, 0.3)',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              ↑
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
};