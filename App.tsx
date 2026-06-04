import { useState, useRef, useEffect } from 'react';
import { Send, Utensils, MessageCircle, Clock, MapPin, Coffee, ShoppingBag, Loader2 } from 'lucide-react';
import { ChatMessage } from './types';
import ReactMarkdown from 'react-markdown';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '1',
    role: 'model',
    content: 'Hi! Welcome to Ambrosia Cafe & Bakery 🙏 How can I help you today?',
    timestamp: new Date()
  }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Map existing messages to history format
      // Note: we're ignoring the first welcome message to not pollute prompt, or we can send it.
      // But server uses systemInstruction which sets the role. So we'll skip first welcome if we want, or just send it.
      const history = messages
        .filter((msg, index) => !(index === 0 && msg.role === 'model'))
        .map(msg => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.content }] 
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: history
        })
      });

      if (!res.ok) {
        throw new Error('Failed to fetch response');
      }

      const data = await res.json();
      const modelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.text,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "Sorry, I'm having trouble connecting right now. Please try again later.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[#FCFAF7] overflow-hidden font-sans text-[#1F1F1F]">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-[380px] border-r border-black/10 p-8">
        <div className="mb-12">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-[#1F1F1F]">Ambrosia</h1>
          <p className="text-xs uppercase tracking-widest text-gray-500 mt-1 font-semibold">Cafe & Bakery</p>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-8">
          <div>
            <h3 className="font-serif italic text-xl mb-4 text-[#D4A373]">About Us</h3>
            <p className="text-sm text-gray-600 leading-relaxed border-b border-black/5 pb-4">
              We serve freshly baked cakes, pastries, croissants, and premium coffee. Place your order here for pickup or delivery!
            </p>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-serif italic text-xl mb-4 text-[#D4A373]">Details</h3>
            <div className="border-b border-black/5 pb-3">
              <div className="flex items-start text-sm text-gray-600">
                <MapPin size={16} className="mt-0.5 mr-2 text-[#4A5D4E] flex-shrink-0" />
                <span>14/3 Mall Road, Civil Lines, Kanpur, UP 208001</span>
              </div>
            </div>
            <div className="border-b border-black/5 pb-3">
              <div className="flex items-start text-sm text-[#4A5D4E] font-bold">
                <Clock size={16} className="mt-0.5 mr-2 flex-shrink-0" />
                <span>Mon-Sat 8AM - 9:30PM<br/>Sun 9AM - 8PM</span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#F2EFE9] p-5 rounded-2xl">
            <div className="flex items-center space-x-2 text-[#4A5D4E] font-bold mb-2 text-xs uppercase tracking-widest">
              <ShoppingBag size={16} />
              <span>Delivery Available</span>
            </div>
            <p className="font-serif italic text-lg leading-snug text-[#1F1F1F]">Free delivery on orders above ₹300</p>
            <p className="text-[11px] mt-2 text-gray-600">in select areas</p>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full bg-white/40 relative">
        
        {/* Header - Mobile & Desktop */}
        <header className="h-20 px-8 flex flex-shrink-0 items-center justify-between bg-white/80 backdrop-blur-sm border-b border-black/5 z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#4A5D4E] flex items-center justify-center text-white font-bold">
              A
            </div>
            <div>
              <h2 className="font-bold text-sm leading-none text-[#1F1F1F]">Digital Concierge</h2>
              <p className="text-[10px] text-green-600 mt-1 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
                <span>Online | Quick responses</span>
              </p>
            </div>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-[10px] font-bold uppercase tracking-tighter text-[#1F1F1F]">Delivery Status</p>
            <p className="text-xs text-gray-500">Active in Civil Lines</p>
          </div>
        </header>

        {/* Chat Messages */}
        <div 
          className="flex-1 flex flex-col p-8 space-y-6 overflow-y-auto"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] md:max-w-[70%] p-5 ${
                  msg.role === 'user' 
                    ? 'bg-[#4A5D4E] text-white rounded-[12px_12px_2px_12px] shadow-md' 
                    : 'bg-white border border-black/5 text-[#1F1F1F] rounded-[12px_12px_12px_2px] shadow-sm'
                }`}
              >
                {msg.role === 'model' ? (
                  <>
                    <p className="text-xs opacity-50 mb-2 font-bold uppercase tracking-wider text-[#1F1F1F]">Ambrosia Assistant</p>
                    <div className="prose prose-sm prose-stone max-w-none prose-p:leading-relaxed prose-p:my-1 prose-ul:my-1 prose-li:my-0 text-[#1F1F1F]">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm italic font-serif mb-2 text-white/70">Customer</p>
                    <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                  </>
                )}
                <div className={`text-[10px] text-right mt-2 ${msg.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start w-full">
              <div className="bg-white border border-black/5 rounded-[12px_12px_12px_2px] p-5 shadow-sm">
                <p className="text-xs opacity-50 mb-2 font-bold uppercase tracking-wider text-[#1F1F1F]">Ambrosia Assistant</p>
                <div className="flex space-x-1 items-center h-4">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <footer className="p-6 bg-white border-t border-black/5 flex items-center gap-4 z-10 flex-shrink-0">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-full flex items-center overflow-hidden">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your order details here..."
              className="w-full max-h-32 bg-transparent py-3 px-6 resize-none focus:outline-none text-sm text-[#1F1F1F] placeholder-gray-400"
              rows={1}
              style={{ minHeight: '44px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="w-12 h-12 flex-shrink-0 bg-[#4A5D4E] hover:bg-[#3d4d40] text-white rounded-full shadow-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform focus:scale-95 duration-150"
            aria-label="Send message"
          >
            <Send size={18} className="-ml-0.5" />
          </button>
        </footer>
        
      </main>
    </div>
  );
}
