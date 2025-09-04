'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

const icons = {
  success: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const colors = {
  success: 'from-green-500 to-emerald-500',
  error: 'from-red-500 to-rose-500',
  warning: 'from-yellow-500 to-amber-500',
  info: 'from-blue-500 to-indigo-500',
};

const textColors = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  info: 'text-blue-600 dark:text-blue-400',
};

function Toast({ message, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = message.duration || 5000;
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(message.id);
    }, 300);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl min-w-[320px] max-w-md transition-all duration-300 ${
        isExiting ? 'animate-slideOut opacity-0 translate-x-full' : 'animate-slideIn'
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${colors[message.type]} opacity-5`} />
      <div className="relative p-4">
        <div className="flex gap-3">
          <div className={`flex-shrink-0 ${textColors[message.type]}`}>
            {icons[message.type]}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">
              {message.title}
            </p>
            {message.description && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {message.description}
              </p>
            )}
            {message.action && (
              <button
                onClick={() => {
                  message.action?.onClick();
                  handleClose();
                }}
                className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {message.action.label}
              </button>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colors[message.type]}`}>
          <div
            className="h-full bg-white/30 origin-left animate-shrink"
            style={{ animationDuration: `${message.duration || 5000}ms` }}
          />
        </div>
      </div>
    </div>
  );
}

interface ToastContainerProps {
  messages: ToastMessage[];
  onClose: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export function ToastContainer({ messages, onClose, position = 'top-right' }: ToastContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return createPortal(
    <div className={`fixed z-50 ${positionClasses[position]} space-y-3`}>
      {messages.map((message) => (
        <Toast key={message.id} message={message} onClose={onClose} />
      ))}
    </div>,
    document.body
  );
}

export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const toast = (message: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2);
    setMessages((prev) => [...prev, { ...message, id }]);
  };

  const removeToast = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  return {
    messages,
    toast,
    removeToast,
    success: (title: string, description?: string) => 
      toast({ type: 'success', title, description }),
    error: (title: string, description?: string) => 
      toast({ type: 'error', title, description }),
    warning: (title: string, description?: string) => 
      toast({ type: 'warning', title, description }),
    info: (title: string, description?: string) => 
      toast({ type: 'info', title, description }),
  };
}

export function ToastDemo() {
  const { messages, removeToast, success, error, warning, info } = useToast();

  return (
    <div className="p-8">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => success('Success!', 'Your changes have been saved.')}
          className="px-4 py-2 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors"
        >
          Success Toast
        </button>
        <button
          onClick={() => error('Error!', 'Something went wrong. Please try again.')}
          className="px-4 py-2 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
        >
          Error Toast
        </button>
        <button
          onClick={() => warning('Warning!', 'This action cannot be undone.')}
          className="px-4 py-2 rounded-xl bg-yellow-500 text-white font-medium hover:bg-yellow-600 transition-colors"
        >
          Warning Toast
        </button>
        <button
          onClick={() => info('Info', 'New features are available.')}
          className="px-4 py-2 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
        >
          Info Toast
        </button>
      </div>
      <ToastContainer messages={messages} onClose={removeToast} />
    </div>
  );
}