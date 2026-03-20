"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, type IChartApi, type ISeriesApi, LineSeries } from "lightweight-charts";

interface PerformanceChartProps {
  months: string[];
  values: number[];
  /** If true, animate the chart drawing point by point */
  animate?: boolean;
  /** Color of the line */
  color?: string;
  /** Optional second series (for battle mode) */
  values2?: number[];
  color2?: string;
  /** Label for the line(s) */
  label?: string;
  label2?: string;
  /** Chart height in pixels (default 300) */
  height?: number;
}

export default function PerformanceChart({
  months,
  values,
  animate = true,
  color = "#3B82F6",
  values2,
  color2 = "#EF4444",
  height: heightProp,
}: PerformanceChartProps) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const height = heightProp ?? (isMobile ? Math.round(window.innerHeight * 0.3) : 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const series1Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const series2Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const [currentIndex, setCurrentIndex] = useState(animate ? 0 : values.length);

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "#94A3B8",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#1E293B" },
        horzLines: { color: "#1E293B" },
      },
      rightPriceScale: {
        borderColor: "#1E293B",
      },
      timeScale: {
        borderColor: "#1E293B",
        tickMarkFormatter: (time: number) => months[time] ?? "",
      },
      crosshair: {
        horzLine: { color: "#475569" },
        vertLine: { color: "#475569" },
      },
    });

    const s1 = chart.addSeries(LineSeries, {
      color,
      lineWidth: 3,
      priceFormat: { type: "custom", formatter: (v: number) => `$${v.toFixed(0)}` },
    });
    series1Ref.current = s1;

    if (values2) {
      const s2 = chart.addSeries(LineSeries, {
        color: color2,
        lineWidth: 3,
        priceFormat: { type: "custom", formatter: (v: number) => `$${v.toFixed(0)}` },
      });
      series2Ref.current = s2;
    }

    chartRef.current = chart;

    // Responsive
    const handleResize = () => {
      if (containerRef.current) {
        const mobile = window.innerWidth < 768;
        const newHeight = heightProp ?? (mobile ? Math.round(window.innerHeight * 0.3) : 300);
        chart.applyOptions({ width: containerRef.current.clientWidth, height: newHeight });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate data or set all at once
  useEffect(() => {
    if (!animate) {
      // Set all data immediately
      const data = values.map((v, i) => ({ time: i as unknown as string, value: v }));
      series1Ref.current?.setData(data as never);

      if (values2 && series2Ref.current) {
        const data2 = values2.map((v, i) => ({ time: i as unknown as string, value: v }));
        series2Ref.current.setData(data2 as never);
      }

      chartRef.current?.timeScale().fitContent();
      return;
    }

    // Progressive animation
    setCurrentIndex(0);
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= values.length) {
          clearInterval(interval);
          return values.length;
        }
        return next;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [values, values2, animate]);

  // Update chart data when currentIndex changes (animation)
  useEffect(() => {
    if (!animate || currentIndex === 0) return;

    const data = values.slice(0, currentIndex).map((v, i) => ({
      time: i as unknown as string,
      value: v,
    }));
    series1Ref.current?.setData(data as never);

    if (values2 && series2Ref.current) {
      const data2 = values2.slice(0, currentIndex).map((v, i) => ({
        time: i as unknown as string,
        value: v,
      }));
      series2Ref.current.setData(data2 as never);
    }

    chartRef.current?.timeScale().fitContent();
  }, [currentIndex, values, values2, animate]);

  // Current month display
  const displayMonth =
    currentIndex > 0 && currentIndex <= months.length
      ? months[currentIndex - 1]
      : months[0] ?? "";

  return (
    <div>
      {animate && (
        <div className="mb-2 text-center text-sm text-slate-400">
          {displayMonth}
          {currentIndex < values.length && (
            <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
          )}
        </div>
      )}
      <div ref={containerRef} className="w-full rounded-xl overflow-hidden" />
    </div>
  );
}
