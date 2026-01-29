import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for WebSocket connections with automatic reconnection
 * and subscription management.
 */
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const subscriptionsRef = useRef(new Set());
  const messageHandlersRef = useRef(new Map());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Get WebSocket URL from environment or default
  const getWsUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/api$/, '');
    return `${wsProtocol}://${host}/ws`;
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = getWsUrl();

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Re-subscribe to previous subscriptions
        for (const threadId of subscriptionsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'subscribe',
            threadId
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Call registered message handlers
          const handlers = messageHandlersRef.current.get(data.type) || [];
          handlers.forEach(handler => {
            try {
              handler(data);
            } catch (e) {
              console.error('[WebSocket] Handler error:', e);
            }
          });

          // For thread-specific messages, also call thread handlers
          if (data.threadId) {
            const threadHandlers = messageHandlersRef.current.get(`thread:${data.threadId}`) || [];
            threadHandlers.forEach(handler => {
              try {
                handler(data);
              } catch (e) {
                console.error('[WebSocket] Thread handler error:', e);
              }
            });
          }
        } catch (e) {
          console.error('[WebSocket] Parse error:', e);
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttempts.current = maxReconnectAttempts; // Prevent reconnection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const subscribe = useCallback((threadId) => {
    subscriptionsRef.current.add(String(threadId));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        threadId
      }));
    }
  }, []);

  const unsubscribe = useCallback((threadId) => {
    subscriptionsRef.current.delete(String(threadId));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        threadId
      }));
    }
  }, []);

  const send = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }, []);

  const onMessage = useCallback((type, handler) => {
    if (!messageHandlersRef.current.has(type)) {
      messageHandlersRef.current.set(type, []);
    }
    messageHandlersRef.current.get(type).push(handler);

    // Return cleanup function
    return () => {
      const handlers = messageHandlersRef.current.get(type) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    send,
    onMessage
  };
}

/**
 * Hook for subscribing to a specific thread's real-time updates
 */
export function useThreadSubscription(threadId, onNewReply) {
  const ws = useWebSocket();
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!threadId) return;

    // Connect if not already connected
    ws.connect();

    // Wait a bit for connection to establish, then subscribe
    const subscribeTimeout = setTimeout(() => {
      ws.subscribe(threadId);
      setIsSubscribed(true);
    }, 100);

    // Set up handler for new replies
    const cleanup = ws.onMessage('new_reply', (data) => {
      if (data.threadId === parseInt(threadId) && onNewReply) {
        onNewReply(data.reply);
      }
    });

    return () => {
      clearTimeout(subscribeTimeout);
      ws.unsubscribe(threadId);
      setIsSubscribed(false);
      cleanup();
    };
  }, [threadId, onNewReply, ws]);

  return {
    isConnected: ws.isConnected,
    isSubscribed
  };
}

export default useWebSocket;
