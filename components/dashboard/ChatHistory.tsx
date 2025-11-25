'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Plus, Loader2, Clock, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ChatConversation } from '@/lib/types/database'
import { formatDistanceToNow } from 'date-fns'

interface ChatHistoryProps {
  userId: string
  currentConversationId: string | null
  onSelectConversation: (conversationId: string) => void
  onNewChat: () => void
}

export default function ChatHistory({
  userId,
  currentConversationId,
  onSelectConversation,
  onNewChat,
}: ChatHistoryProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    loadConversations()
  }, [userId])

  const loadConversations = async (pageNum = 1) => {
    try {
      const supabase = createClient()
      const from = (pageNum - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      if (pageNum === 1) {
        setConversations(data || [])
      } else {
        setConversations((prev) => [...prev, ...(data || [])])
      }

      setHasMore((data || []).length === ITEMS_PER_PAGE)
      setPage(pageNum)
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      setLoading(true)
      loadConversations(page + 1)
    }
  }

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm('Delete this conversation?')) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId)

      if (error) throw error

      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      
      if (currentConversationId === conversationId) {
        onNewChat()
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          <>
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full text-left p-3 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group ${
                  currentConversationId === conv.id
                    ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-600'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {conv.title}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </button>
            ))}

            {/* Load More */}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full p-3 text-sm text-primary-600 dark:text-primary-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Load more...'
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

