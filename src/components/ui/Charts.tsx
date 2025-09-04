'use client';

import { useEffect, useRef, useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface ChartProps {
  data: DataPoint[];
  height?: number;
  animated?: boolean;
}

export function BarChart({ data, height = 300, animated = true }: ChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const maxValue = Math.max(...data.map(d => d.value));

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={chartRef} className="relative" style={{ height }}>
      <div className="absolute inset-0 flex items-end justify-between gap-2">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div className="relative w-full flex flex-col items-center">
              <span className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {item.value}
              </span>
              <div className="relative w-full" style={{ height: height - 60 }}>
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded-t-xl transition-all duration-1000 ease-out ${
                    item.color || 'bg-gradient-to-t from-blue-500 to-purple-500'
                  }`}
                  style={{
                    height: animated && isVisible ? `${(item.value / maxValue) * 100}%` : '0%',
                    transitionDelay: `${index * 100}ms`
                  }}
                >
                  <div className="absolute inset-0 bg-white/10 rounded-t-xl" />
                </div>
              </div>
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <div className="absolute left-0 right-0 bottom-12 h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

export function LineChart({ data, height = 300, animated = true }: ChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((item.value - minValue) / (maxValue - minValue)) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div ref={chartRef} className="relative" style={{ height }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="fillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        <polyline
          points={points}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={animated && isVisible ? 'animate-draw' : ''}
          style={{
            strokeDasharray: 1000,
            strokeDashoffset: animated && isVisible ? 0 : 1000,
            transition: 'stroke-dashoffset 2s ease-out'
          }}
        />
        
        <polygon
          points={`0,100 ${points} 100,100`}
          fill="url(#fillGradient)"
          className={animated && isVisible ? 'animate-fadeIn' : 'opacity-0'}
        />
        
        {data.map((item, index) => {
          const x = (index / (data.length - 1)) * 100;
          const y = 100 - ((item.value - minValue) / (maxValue - minValue)) * 100;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="1.5"
              fill="white"
              stroke="url(#lineGradient)"
              strokeWidth="0.5"
              className={animated && isVisible ? 'animate-scaleIn' : 'scale-0'}
              style={{
                transformOrigin: `${x}% ${y}%`,
                animationDelay: `${index * 100 + 500}ms`
              }}
            />
          );
        })}
      </svg>
      
      <div className="absolute bottom-0 left-0 right-0 flex justify-between">
        {data.map((item, index) => (
          <span key={index} className="text-xs text-gray-600 dark:text-gray-400">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PieChart({ data, height = 300, animated = true }: ChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const colors = [
    'from-blue-500 to-indigo-500',
    'from-purple-500 to-pink-500',
    'from-green-500 to-emerald-500',
    'from-orange-500 to-amber-500',
    'from-red-500 to-rose-500',
  ];

  let cumulativePercentage = 0;

  return (
    <div ref={chartRef} className="relative flex items-center justify-center" style={{ height }}>
      <div className="relative" style={{ width: height * 0.7, height: height * 0.7 }}>
        <svg
          className="transform -rotate-90"
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
        >
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const strokeDasharray = `${percentage} ${100 - percentage}`;
            const strokeDashoffset = -cumulativePercentage;
            cumulativePercentage += percentage;

            return (
              <circle
                key={index}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={`url(#gradient${index})`}
                strokeWidth="20"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className={animated && isVisible ? 'transition-all duration-1000 ease-out' : ''}
                style={{
                  opacity: animated && isVisible ? 1 : 0,
                  transform: animated && isVisible ? 'scale(1)' : 'scale(0.8)',
                  transformOrigin: '50% 50%',
                  transitionDelay: `${index * 200}ms`
                }}
              />
            );
          })}
          <defs>
            {colors.map((color, index) => {
              const [from, to] = color.replace('from-', '').replace('to-', '').split(' ');
              return (
                <linearGradient key={index} id={`gradient${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className={`text-${from}`} stopColor="currentColor" />
                  <stop offset="100%" className={`text-${to}`} stopColor="currentColor" />
                </linearGradient>
              );
            })}
          </defs>
        </svg>
      </div>
      
      <div className="absolute right-0 space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-2 animate-slideIn" style={{ animationDelay: `${index * 100}ms` }}>
            <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${colors[index % colors.length]}`} />
            <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {Math.round((item.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SparkLine({ data, width = 100, height = 30, color = '#3b82f6' }: { data: number[]; width?: number; height?: number; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatCard({ 
  title, 
  value, 
  change, 
  sparkData,
  icon 
}: { 
  title: string; 
  value: string | number; 
  change?: number; 
  sparkData?: number[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-lg hover:shadow-xl transition-all hover-lift">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <svg
                className={`w-4 h-4 ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={change >= 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}
                />
              </svg>
              <span className={`text-sm font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {Math.abs(change)}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10">
            {icon}
          </div>
        )}
      </div>
      {sparkData && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <SparkLine data={sparkData} width={250} height={40} />
        </div>
      )}
    </div>
  );
}