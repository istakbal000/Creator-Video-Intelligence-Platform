import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://creator-video-intelligence-platform.onrender.com';

export function useChat(sessionId) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [currentCitations, setCurrentCitations] = useState([]);
  const [currentQueryType, setCurrentQueryType] = useState(null);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const streamBufferRef = useRef('');

  // Connect socket
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      setError('Failed to connect to server. Make sure the backend is running.');
      setIsConnected(false);
    });

    // Stream events
    socket.on('stream_start', ({ queryType }) => {
      setIsStreaming(true);
      setCurrentQueryType(queryType);
      setStreamingText('');
      streamBufferRef.current = '';
      setCurrentCitations([]);
    });

    socket.on('stream_token', ({ token }) => {
      streamBufferRef.current += token;
      setStreamingText(streamBufferRef.current);
    });

    socket.on('stream_end', ({ citations, queryType }) => {
      setIsStreaming(false);
      const finalText = streamBufferRef.current;
      setCurrentCitations(citations || []);
      setCurrentQueryType(queryType);

      if (finalText.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: 'assistant',
            content: finalText,
            citations: citations || [],
            queryType,
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      setStreamingText('');
      streamBufferRef.current = '';
    });

    socket.on('stream_error', ({ message }) => {
      setIsStreaming(false);
      setError(message);
      setStreamingText('');
      streamBufferRef.current = '';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: message || 'An error occurred.',
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  /**
   * Sends a chat message via Socket.IO.
   *
   * @param {string} message
   */
  const sendMessage = useCallback(
    (message) => {
      if (!message.trim() || isStreaming) return;

      const userMessage = {
        id: Date.now(),
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setError(null);

      socketRef.current?.emit('chat', {
        message: message.trim(),
        sessionId,
      });
    },
    [isStreaming, sessionId]
  );

  /**
   * Pushes video context to server via socket.
   */
  const setVideoContext = useCallback(
    (videoA, videoB) => {
      socketRef.current?.emit('set_video_context', {
        sessionId,
        videoA,
        videoB,
      });
    },
    [sessionId]
  );

  /**
   * Clears message history locally.
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingText('');
    streamBufferRef.current = '';
    setCurrentCitations([]);
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    isConnected,
    streamingText,
    currentCitations,
    currentQueryType,
    error,
    sendMessage,
    setVideoContext,
    clearMessages,
  };
}
