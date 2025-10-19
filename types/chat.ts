// types/chat.ts
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  systemPrompt?: string;
}

export interface ChatResponse {
  text: string;
  success: boolean;
  error?: string;
}