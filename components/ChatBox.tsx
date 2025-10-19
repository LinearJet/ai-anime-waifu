// components/ChatBox.tsx
import React, { useState, useRef, useEffect } from 'react';
import { generateLipSyncData } from '../lib/lipSync';
import { classifyByRules } from '../lib/animationClassifier';
import { Camera, Mic, Volume2, Settings, Smile, Send, Square } from 'lucide-react';

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
                  borderRadius: '12px',
                  background: msg.role === 'user' 
                    ? 'hsl(222.2 47.4% 11.2%)'
                    : 'hsl(240 3.7% 15.9%)',
                  border: '1px solid',
                  borderColor: msg.role === 'user'
                    ? 'hsl(217.2 32.6% 17.5%)'
                    : 'hsl(240 3.7% 15.9%)',
                  color: 'hsl(210 40% 98%)',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  wordWrap: 'break-word',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
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
                borderRadius: '12px',
                background: 'hsl(240 3.7% 15.9%)',
                border: '1px solid hsl(240 3.7% 15.9%)',
                color: 'hsl(210 40% 98%)',
                fontSize: '14px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
              }}>
                <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                  •••
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Toolbar */}
      <div style={{
        width: '100%',
        padding: '0 16px 20px 16px',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}>
        {/* Action Buttons Row - Full Width with 3 Buttons */}
        <div style={{
          width: '100%',
          maxWidth: '800px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {/* Audio Button - Left Pill */}
          <button
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '26px',
              background: 'rgba(30, 30, 35, 0.8)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'hsl(210 40% 98%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(40, 40, 45, 0.9)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(30, 30, 35, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <Volume2 size={20} />
          </button>

          {/* Camera Button - Center Squircle (Full Width) */}
          <button
            style={{
              flex: 1,
              height: '52px',
              borderRadius: '16px',
              background: 'rgba(30, 30, 35, 0.8)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'hsl(210 40% 98%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(40, 40, 45, 0.9)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(30, 30, 35, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <Camera size={20} />
            <span>Camera</span>
          </button>

          {/* Microphone Button - Right Pill */}
          <button
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '26px',
              background: 'rgba(30, 30, 35, 0.8)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'hsl(210 40% 98%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(40, 40, 45, 0.9)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(30, 30, 35, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <Mic size={20} />
          </button>
        </div>

        {/* Input Bar - Wider */}
        <div style={{
          width: '100%',
          maxWidth: '800px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            flex: 1,
            background: 'rgba(30, 30, 35, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '12px 18px',
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
                color: 'hsl(210 40% 98%)',
                fontSize: '15px',
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
                background: 'rgba(239, 68, 68, 0.9)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: '12px 18px',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: 'hsl(210 40% 98%)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(220, 38, 38, 0.95)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
              }}
            >
              <Square size={14} fill="currentColor" /> Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '16px',
                background: input.trim() 
                  ? 'rgba(255, 255, 255, 0.95)' 
                  : 'rgba(30, 30, 35, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: input.trim()
                  ? '1px solid rgba(255, 255, 255, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                color: input.trim() 
                  ? 'hsl(222.2 47.4% 11.2%)'
                  : 'hsl(240 5% 64.9%)',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (input.trim()) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
                }
              }}
              onMouseLeave={(e) => {
                if (input.trim()) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
                }
              }}
            >
              <Send size={18} />
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
          color: hsl(240 5% 64.9%);
        }
      `}</style>
    </div>
  );
};