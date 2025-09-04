'use client';

import { useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface ClientWrapperProps {
  children: ReactNode;
}

export default function ClientWrapper({ children }: ClientWrapperProps) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Initialize client-side features
  useEffect(() => {
    setMounted(true);

    // Smooth page transitions
    const links = document.querySelectorAll('a[href^="/"]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLAnchorElement;
        if (!target.href.includes('#') && !target.target) {
          document.body.style.opacity = '0.8';
          setTimeout(() => {
            document.body.style.opacity = '1';
          }, 300);
        }
      });
    });

    // Intersection Observer for animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe elements with animation classes
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      observer.observe(el);
    });

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, []);

  // Route change effects
  useEffect(() => {
    // Start loading animation
    setIsLoading(true);
    const loader = document.getElementById('global-loading');
    if (loader) {
      loader.style.opacity = '1';
    }

    // Stop loading after a delay
    const timer = setTimeout(() => {
      setIsLoading(false);
      if (loader) {
        loader.style.opacity = '0';
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [pathname]);

  // Add performance marks
  useEffect(() => {
    if ('performance' in window) {
      performance.mark('app-interactive');
      
      // Log performance metrics
      const paintEntries = performance.getEntriesByType('paint');
      paintEntries.forEach(entry => {
        console.log(`${entry.name}: ${Math.round(entry.startTime)}ms`);
      });
    }
  }, [mounted]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Quick actions with Alt key
      if (e.altKey) {
        switch(e.key) {
          case '1':
            e.preventDefault();
            window.location.href = '/';
            break;
          case '2':
            e.preventDefault();
            window.location.href = '/tickets';
            break;
          case '3':
            e.preventDefault();
            window.location.href = '/intake';
            break;
          case 'd':
            e.preventDefault();
            document.body.classList.toggle('debug-mode');
            break;
        }
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        document.dispatchEvent(new CustomEvent('close-modal'));
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, []);

  // Add scroll progress indicator
  useEffect(() => {
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    progressBar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #0071e3, #0a84ff);
      z-index: 100;
      transition: width 0.1s ease-out;
      width: 0%;
    `;
    document.body.appendChild(progressBar);

    const updateProgress = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = (scrollTop / scrollHeight) * 100;
      progressBar.style.width = `${progress}%`;
    };

    window.addEventListener('scroll', updateProgress);

    return () => {
      if (progressBar.parentNode) {
        progressBar.parentNode.removeChild(progressBar);
      }
      window.removeEventListener('scroll', updateProgress);
    };
  }, []);

  // Debug mode styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .debug-mode * {
        outline: 1px solid rgba(255, 0, 0, 0.1) !important;
      }
      .debug-mode *:hover {
        outline: 1px solid rgba(255, 0, 0, 0.3) !important;
      }
      
      /* Smooth animations for in-view elements */
      .animate-on-scroll {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease-out, transform 0.6s ease-out;
      }
      
      .animate-on-scroll.in-view {
        opacity: 1;
        transform: translateY(0);
      }
      
      /* Page transition effects */
      body {
        transition: opacity 0.3s ease-out;
      }
      
      /* Loading state for buttons */
      button[data-loading="true"] {
        position: relative;
        color: transparent !important;
        pointer-events: none;
      }
      
      button[data-loading="true"]::after {
        content: "";
        position: absolute;
        width: 20px;
        height: 20px;
        top: 50%;
        left: 50%;
        margin-left: -10px;
        margin-top: -10px;
        border: 2px solid #0071e3;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      /* Tooltip styles */
      [data-tooltip] {
        position: relative;
      }
      
      [data-tooltip]:hover::after {
        content: attr(data-tooltip);
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(-8px);
        background: #000;
        color: #fff;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 1000;
        pointer-events: none;
        animation: fadeIn 0.2s ease-out;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      /* Focus trap for modals */
      .focus-trap {
        position: fixed;
        inset: 0;
        z-index: 50;
      }
      
      /* Ripple effect for buttons */
      .ripple {
        position: relative;
        overflow: hidden;
      }
      
      .ripple::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        transform: translate(-50%, -50%);
        transition: width 0.6s, height 0.6s;
      }
      
      .ripple:active::before {
        width: 300px;
        height: 300px;
      }
      
      /* Skeleton loading improvements */
      .skeleton-text {
        position: relative;
        overflow: hidden;
        background: #e5e7eb;
        border-radius: 4px;
        height: 1em;
        margin: 0.25em 0;
      }
      
      .skeleton-text::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.2),
          transparent
        );
        animation: shimmer 2s infinite;
      }
      
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);

  // Add utilities to window
  useEffect(() => {
    // Global notification function
    (window as any).notify = (title: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
      const container = document.getElementById('notification-container');
      if (!container) return;

      const notification = document.createElement('div');
      notification.className = `pointer-events-auto animate-slideIn glass rounded-lg p-4 shadow-lg mb-2`;
      
      const colors = {
        success: 'text-green-600 bg-green-50 border-green-200',
        error: 'text-red-600 bg-red-50 border-red-200',
        warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
        info: 'text-blue-600 bg-blue-50 border-blue-200'
      };
      
      notification.innerHTML = `
        <div class="flex items-center gap-3 ${colors[type]} border p-3 rounded-lg">
          <p class="text-sm font-medium">${title}</p>
          <button onclick="this.parentElement.parentElement.remove()" class="ml-auto hover:opacity-70">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      `;
      
      container.appendChild(notification);
      
      // Auto remove after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'fadeOut 0.3s ease-out';
          setTimeout(() => notification.remove(), 300);
        }
      }, 5000);
    };

    // Loading state helper
    (window as any).setButtonLoading = (button: HTMLButtonElement, loading: boolean) => {
      button.setAttribute('data-loading', loading.toString());
      button.disabled = loading;
    };

    // Add ripple effect to buttons
    document.querySelectorAll('button').forEach(button => {
      if (!button.classList.contains('ripple')) {
        button.classList.add('ripple');
      }
    });
  }, [pathname]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      
      {/* Quick Action Button (FAB) */}
      <button
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200 z-40 flex items-center justify-center group"
        onClick={() => window.location.href = '/intake'}
        data-tooltip="New Ticket (Alt+3)"
      >
        <svg className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Debug Info Panel (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-white/90 backdrop-blur text-xs p-2 rounded-lg shadow-lg z-50 font-mono opacity-50 hover:opacity-100 transition-opacity">
          <div>Route: {pathname}</div>
          <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
          <div>Online: {typeof navigator !== 'undefined' ? (navigator.onLine ? 'Yes' : 'No') : 'N/A'}</div>
        </div>
      )}
    </>
  );
}