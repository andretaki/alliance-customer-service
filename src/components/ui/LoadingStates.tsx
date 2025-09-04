'use client';

import { useEffect, useState } from 'react';

export function PremiumSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-spin">
        <div className="h-full w-full rounded-full border-2 border-transparent border-t-white/30" />
      </div>
      <div className="absolute inset-[2px] rounded-full bg-white dark:bg-gray-900" />
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-30 blur-md animate-pulse" />
    </div>
  );
}

export function DotLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-bounce"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

export function PulseLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-ping" />
      <div className="relative rounded-full bg-gradient-to-r from-blue-500 to-purple-500 w-4 h-4" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-lg animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-5/6" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-4/6" />
      </div>
      <div className="mt-6 flex gap-2">
        <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
      <div className="p-4">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
              <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShimmerButton({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <button className={`relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-3 text-white font-medium shadow-lg hover:shadow-xl transition-all ${className}`}>
      <span className="relative z-10">{children}</span>
      <div className="absolute inset-0 -top-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </button>
  );
}

export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-2xl animate-scaleIn">
        <div className="flex flex-col items-center gap-4">
          <PremiumSpinner size="lg" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function ProgressBar({ progress, className = '' }: { progress: number; className?: string }) {
  return (
    <div className={`relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className}`}>
      <div 
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}

export function CircularProgress({ progress, size = 120 }: { progress: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#gradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          {progress}%
        </span>
      </div>
    </div>
  );
}