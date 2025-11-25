'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Wand2, MessageSquare, Clock, Menu, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createClient } from '@/lib/supabase/client'
import ChatHistory from './ChatHistory'
import { ChatMessage } from '@/lib/types/database'

interface Message {
  role: 'user' | 'assistant'
  content: string
  modifications_made?: boolean
  function_calls?: string[]
  processing?: boolean
}

const ChatMarkdownComponents = {
  h1: ({ node, ...props }: any) => <h1 className="text-lg font-bold mt-4 mb-2 text-slate-900 dark:text-white" {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="text-base font-bold mt-3 mb-2 text-slate-900 dark:text-white" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="text-sm font-bold mt-2 mb-1 text-slate-900 dark:text-white" {...props} />,
  p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5" {...props} />,
  li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
  strong: ({ node, ...props }: any) => <span className="font-bold text-slate-900 dark:text-white" {...props} />,
  blockquote: ({ node, ...props }: any) => <blockquote className="border-l-2 border-primary-400 pl-2 italic my-2 text-slate-500 dark:text-slate-400" {...props} />,
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your running coach assistant. I can help you with training advice, analyze your performance, and answer questions about your running plan.\n\n💡 **Tip**: Enable **Agentic Mode** to let me modify your training plan based on your requests! I can move runs, change distances, add weeks, and more.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [agenticMode, setAgenticMode] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Get user ID on mount
    const getUserId = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUserId()
  }, [])

  const loadConversation = async (conversationId: string) => {
    setLoadingHistory(true)
    try {
      const supabase = createClient()

      // Load messages for this conversation
      const { data: chatMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Convert to Message format
      const loadedMessages: Message[] = chatMessages.map((msg: ChatMessage) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        modifications_made: msg.modifications_made,
        function_calls: msg.function_calls || undefined,
      }))

      setMessages(loadedMessages)
      setCurrentConversationId(conversationId)
      setShowHistory(false)
    } catch (error) {
      console.error('Error loading conversation:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const startNewChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Hi! I'm your running coach assistant. I can help you with training advice, analyze your performance, and answer questions about your running plan.\n\n💡 **Tip**: Enable **Agentic Mode** to let me modify your training plan based on your requests! I can move runs, change distances, add weeks, and more.",
      },
    ])
    setCurrentConversationId(null)
    setShowHistory(false)
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Use Supabase Edge Function for agentic mode (no timeout limits)
      // Use Vercel API for regular chat (streaming works well)
      if (agenticMode) {
        await handleAgenticRequest(userMessage)
      } else {
        await handleStreamingRequest(userMessage)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleAgenticRequest = async (userMessage: Message) => {
    const supabase = createClient()

    // Get auth session for Edge Function
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      console.error('Session error:', sessionError)
      throw new Error('Failed to get session: ' + sessionError.message)
    }
    if (!session) {
      console.error('No session found')
      throw new Error('Not authenticated')
    }
    console.log('Session obtained, user:', session.user?.email)

    // Add processing message
    const processingMessage: Message = {
      role: 'assistant',
      content: '🤖 Processing your request... This may take a moment as I analyze your training plan.',
      processing: true,
    }
    setMessages((prev) => [...prev, processingMessage])

    // Call Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat-agentic`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [...messages, userMessage],
        enableTools: true,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Edge Function error:', errorData)
      console.error('Response status:', response.status)
      throw new Error(errorData.error || errorData.details || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Remove processing message and add real response
    setMessages((prev) => {
      const withoutProcessing = prev.filter(m => !m.processing)
      return [
        ...withoutProcessing,
        {
          role: 'assistant',
          content: data.message,
          modifications_made: data.modifications_made,
          function_calls: data.function_calls,
        },
      ]
    })
  }

  const handleStreamingRequest = async (userMessage: Message) => {
    const supabase = createClient()

    // Get auth session for Edge Function
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      console.error('Session error:', sessionError)
      throw new Error('Failed to get session: ' + sessionError.message)
    }
    if (!session) {
      console.error('No session found')
      throw new Error('Not authenticated')
    }

    // Generate conversation title from first user message
    const conversationTitle = currentConversationId
      ? undefined
      : userMessage.content.substring(0, 50) + (userMessage.content.length > 50 ? '...' : '')

    // Call Supabase Edge Function with streaming
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [...messages, userMessage],
        conversationId: currentConversationId,
        conversationTitle: conversationTitle,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('AI chat error:', errorData)
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    // Check if response is actually a stream
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('text/event-stream')) {
      // Not a streaming response, try to parse as JSON error
      const errorData = await response.json().catch(() => ({ error: 'Invalid response format' }))
      console.error('Expected streaming response but got:', contentType, errorData)
      throw new Error(errorData.error || 'Invalid response format from AI')
    }

    // Handle streaming response
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let assistantMessageAdded = false

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              break
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullContent += parsed.content

                // Add assistant message on first content chunk
                if (!assistantMessageAdded) {
                  setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }])
                  assistantMessageAdded = true
                } else {
                  // Update the last message (assistant) in real-time
                  setMessages((prev) => {
                    const newMessages = [...prev]
                    newMessages[newMessages.length - 1] = {
                      role: 'assistant',
                      content: fullContent,
                    }
                    return newMessages
                  })
                }
              }
            } catch (e) {
              console.error('Error parsing streaming data:', e, 'Data:', data)
              // Skip invalid JSON
            }
          }
        }
      }
    }

    if (!fullContent) {
      throw new Error('No content received from AI')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg flex h-[600px] overflow-hidden">
      {/* Chat History Sidebar */}
      {showHistory && userId && (
        <div className="w-64 flex-shrink-0">
          <ChatHistory
            userId={userId}
            currentConversationId={currentConversationId}
            onSelectConversation={loadConversation}
            onNewChat={startNewChat}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* History Toggle Button */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title={showHistory ? 'Hide chat history' : 'Show chat history'}
              >
                {showHistory ? (
                  <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                ) : (
                  <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                )}
              </button>

              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Bot className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  AI Running Coach
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Powered by GPT-4
                </p>
              </div>
            </div>

            {/* Agentic Mode Toggle */}
            <button
              onClick={() => setAgenticMode(!agenticMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                agenticMode
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
              title={agenticMode ? 'Agentic Mode: AI can modify your training plan' : 'Advice Mode: AI provides guidance only'}
            >
              {agenticMode ? (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Agentic</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" />
                  <span>Advice</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Loading conversation...</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-600" />
              </div>
            )}
            <div className="flex flex-col gap-2 max-w-[80%]">
              <div
                className={`rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : message.modifications_made
                    ? 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-300 dark:border-purple-700 text-slate-900 dark:text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                }`}
              >
                {message.role === 'assistant' ? (
                  <>
                    {message.processing && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mb-2">
                        <Clock className="w-3 h-3 animate-pulse" />
                        <span className="italic">Processing with extended timeout...</span>
                      </div>
                    )}
                    {message.modifications_made && (
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300">
                        <Wand2 className="w-3 h-3" />
                        <span>Training Plan Modified</span>
                      </div>
                    )}
                    
                    {/* 2. Updated ReactMarkdown block using our custom components */}
                    <div className="text-sm max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={ChatMarkdownComponents}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>

                    {message.function_calls && message.function_calls.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                          Actions performed: {message.function_calls.join(', ')}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
            )}
          </div>
              ))}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-3">
                    <Loader2 className="w-5 h-5 text-slate-600 dark:text-slate-400 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your training, performance, or get advice..."
              rows={2}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-600"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

