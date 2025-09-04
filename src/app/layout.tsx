import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { RootProviders } from "./providers";
import ClientWrapper from "./client-wrapper";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
  preload: true,
  adjustFontFallback: true,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0071e3" },
    { media: "(prefers-color-scheme: dark)", color: "#0a84ff" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://alliance.com"),
  title: {
    default: "Alliance Customer Service | Premium Support Platform",
    template: "%s | Alliance Customer Service",
  },
  description: "World-class customer service platform with AI-powered ticket management, real-time analytics, and seamless integrations for Alliance Chemical",
  keywords: [
    "customer service",
    "support platform",
    "ticket management",
    "AI classification",
    "Alliance Chemical",
    "enterprise support",
    "SLA monitoring",
    "customer experience",
  ],
  authors: [{ name: "Alliance Chemical", url: "https://alliance.com" }],
  creator: "Alliance Chemical",
  publisher: "Alliance Chemical",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Alliance Customer Service",
    title: "Alliance Customer Service | Premium Support Platform",
    description: "World-class customer service platform with AI-powered ticket management and real-time analytics",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Alliance Customer Service Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alliance Customer Service",
    description: "Premium support platform with AI-powered ticket management",
    images: ["/twitter-image.png"],
    creator: "@alliancechemical",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#0071e3",
      },
    ],
  },
  alternates: {
    canonical: "/",
  },
  other: {
    "msapplication-TileColor": "#0071e3",
    "msapplication-config": "/browserconfig.xml",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Alliance CS",
    "application-name": "Alliance Customer Service",
    "mobile-web-app-capable": "yes",
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
  modal?: React.ReactNode;
}

export default function RootLayout({ children, modal }: RootLayoutProps) {
  return (
    <html 
      lang="en" 
      className={inter.variable} 
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* DNS Prefetch for potential external resources */}
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="dns-prefetch" href="https://api.alliance.com" />
        
        {/* Inject critical CSS variables and performance styles early */}
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --font-inter: ${inter.style.fontFamily};
            }
            
            /* Prevent layout shift */
            html {
              overflow-x: hidden;
              scroll-padding-top: 4rem;
            }
            
            /* Optimize animations for performance */
            @media (prefers-reduced-motion: reduce) {
              *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
                scroll-behavior: auto !important;
              }
            }
            
            /* Hide elements until fonts load */
            .font-loading * {
              opacity: 0 !important;
            }
            
            /* Network status indicator */
            .offline-indicator {
              display: none;
            }
            
            .is-offline .offline-indicator {
              display: flex;
            }
            
            /* Focus visible improvements */
            :focus-visible {
              outline: 2px solid var(--ring);
              outline-offset: 2px;
              border-radius: 4px;
            }
            
            /* Smooth loading skeleton */
            @keyframes skeleton-loading {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            
            .skeleton {
              background: linear-gradient(
                90deg,
                var(--muted) 25%,
                var(--secondary) 50%,
                var(--muted) 75%
              );
              background-size: 200% 100%;
              animation: skeleton-loading 1.5s linear infinite;
            }
          `
        }} />
      </head>
      <body 
        className="antialiased min-h-screen bg-background text-foreground"
        suppressHydrationWarning
      >
        {/* Gradient background effect with performance optimization */}
        <div 
          className="fixed inset-0 -z-10 opacity-30 pointer-events-none will-change-transform"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </div>
        
        {/* Offline indicator */}
        <div className="offline-indicator fixed top-0 left-0 right-0 bg-destructive text-destructive-foreground px-4 py-2 text-center z-[200] animate-slideUp">
          <p className="text-sm font-medium">You&apos;re offline. Some features may be unavailable.</p>
        </div>
        
        {/* Skip to main content for accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        
        {/* Providers and Client Wrapper */}
        <RootProviders>
          <ClientWrapper>
            {/* Main application wrapper with proper spacing */}
            <div className="relative flex min-h-screen flex-col">
              {/* Portal for modals with backdrop */}
              {modal && (
                <>
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fadeIn" />
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="animate-scaleIn">
                      {modal}
                    </div>
                  </div>
                </>
              )}
              
              {/* Main content with proper semantic structure */}
              <main id="main-content" className="flex-1 relative">
                {children}
              </main>
            </div>
          </ClientWrapper>
        </RootProviders>
        
        {/* Global loading bar */}
        <div 
          id="global-loading" 
          className="fixed top-0 left-0 right-0 h-1 opacity-0 transition-opacity duration-300 pointer-events-none z-[100]"
          role="progressbar"
          aria-hidden="true"
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-gradient-to-r from-primary via-accent to-primary animate-shimmer" />
        </div>
        
        {/* Notification container with stacking */}
        <div 
          id="notification-container" 
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm"
          aria-live="polite"
          aria-atomic="true"
        />
        
        {/* Command palette placeholder */}
        <div id="command-palette" className="hidden" />
        
        {/* Performance and feature detection scripts */}
        <Script
          id="app-initialization"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Font loading optimization
                if ('fonts' in document) {
                  document.fonts.ready.then(function() {
                    document.documentElement.classList.remove('font-loading');
                  });
                }
                
                // Network status detection
                function updateOnlineStatus() {
                  if (navigator.onLine) {
                    document.body.classList.remove('is-offline');
                  } else {
                    document.body.classList.add('is-offline');
                  }
                }
                
                window.addEventListener('online', updateOnlineStatus);
                window.addEventListener('offline', updateOnlineStatus);
                updateOnlineStatus();
                
                // Color scheme detection and persistence
                const getPreferredTheme = () => {
                  const stored = localStorage.getItem('theme');
                  if (stored) return stored;
                  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                };
                
                const setTheme = (theme) => {
                  document.documentElement.classList.toggle('dark', theme === 'dark');
                  localStorage.setItem('theme', theme);
                };
                
                setTheme(getPreferredTheme());
                
                // Listen for theme changes
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                  if (!localStorage.getItem('theme')) {
                    setTheme(e.matches ? 'dark' : 'light');
                  }
                });
                
                // Expose theme toggle function globally
                window.toggleTheme = () => {
                  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
                  setTheme(current === 'dark' ? 'light' : 'dark');
                };
                
                // Keyboard shortcuts
                document.addEventListener('keydown', function(e) {
                  // Cmd/Ctrl + K for command palette
                  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('open-command-palette'));
                  }
                  
                  // Cmd/Ctrl + \ for theme toggle
                  if ((e.metaKey || e.ctrlKey) && e.key === '\\\\') {
                    e.preventDefault();
                    window.toggleTheme();
                  }
                });
                
                // Page visibility API for performance
                let hidden, visibilityChange;
                if (typeof document.hidden !== "undefined") {
                  hidden = "hidden";
                  visibilityChange = "visibilitychange";
                } else if (typeof document.msHidden !== "undefined") {
                  hidden = "msHidden";
                  visibilityChange = "msvisibilitychange";
                } else if (typeof document.webkitHidden !== "undefined") {
                  hidden = "webkitHidden";
                  visibilityChange = "webkitvisibilitychange";
                }
                
                if (visibilityChange) {
                  document.addEventListener(visibilityChange, function() {
                    if (document[hidden]) {
                      // Pause animations, stop polling, etc.
                      document.body.classList.add('page-hidden');
                    } else {
                      // Resume animations, restart polling, etc.
                      document.body.classList.remove('page-hidden');
                    }
                  });
                }
                
                // Smooth scroll behavior for hash links
                document.addEventListener('click', function(e) {
                  const link = e.target.closest('a[href^="#"]');
                  if (link) {
                    const target = document.querySelector(link.getAttribute('href'));
                    if (target) {
                      e.preventDefault();
                      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }
                });
                
                // Initialize performance observer
                if ('PerformanceObserver' in window) {
                  try {
                    const observer = new PerformanceObserver((list) => {
                      for (const entry of list.getEntries()) {
                        // Log to analytics
                        console.log('Alliance CS Performance:', entry.name, entry.startTime);
                      }
                    });
                    observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
                  } catch (e) {}
                }
                
                // Service Worker registration for offline support
                if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
                  window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(() => {});
                  });
                }
              })();
            `,
          }}
        />
        
        {/* Analytics Script (replace with your analytics) */}
        {process.env.NODE_ENV === 'production' && (
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=YOUR-GA-ID"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}