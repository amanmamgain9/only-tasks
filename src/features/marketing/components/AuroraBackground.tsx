"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface AuroraBackgroundProps {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  lightModeColor?: string;
  darkModeColor?: string;
  maxOpacity?: number;
  className?: string;
}

export default function AuroraBackground({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  lightModeColor = "#6366f1",
  darkModeColor = "#B29EB3",
  maxOpacity = 0.2,
  className = "",
}: AuroraBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(
        document.documentElement.classList.contains("dark") ||
          window.matchMedia("(prefers-color-scheme: dark)").matches,
      );
    };

    updateTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateTheme);

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      mediaQuery.removeEventListener("change", updateTheme);
      observer.disconnect();
    };
  }, []);

  const activeColor = isDark ? darkModeColor : lightModeColor;

  const memoizedColor = useMemo(() => {
    if (typeof window === "undefined") {
      return "rgba(99, 102, 241,";
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return "rgba(99, 102, 241,";
    }

    ctx.fillStyle = activeColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
    return `rgba(${r}, ${g}, ${b},`;
  }, [activeColor]);

  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement, width: number, height: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const cols = Math.floor(width / (squareSize + gridGap));
      const rows = Math.floor(height / (squareSize + gridGap));
      const squares = new Float32Array(cols * rows);

      for (let i = 0; i < squares.length; i++) {
        squares[i] = Math.random() * maxOpacity;
      }

      return { cols, rows, squares, dpr };
    },
    [gridGap, maxOpacity, squareSize],
  );

  const updateSquares = useCallback(
    (squares: Float32Array, deltaTime: number) => {
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < flickerChance * deltaTime) {
          squares[i] = Math.random() * maxOpacity;
        }
      }
    },
    [flickerChance, maxOpacity],
  );

  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      cols: number,
      rows: number,
      squares: Float32Array,
      dpr: number,
    ) => {
      ctx.clearRect(0, 0, width, height);

      const opacityGroups: Record<string, Array<{ x: number; y: number }>> = {};
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const opacity = Math.round(squares[i * rows + j] * 100) / 100;
          opacityGroups[opacity] ??= [];
          opacityGroups[opacity].push({
            x: i * (squareSize + gridGap) * dpr,
            y: j * (squareSize + gridGap) * dpr,
          });
        }
      }

      Object.entries(opacityGroups).forEach(([opacity, positions]) => {
        ctx.fillStyle = `${memoizedColor}${opacity})`;
        positions.forEach((position) => {
          ctx.fillRect(position.x, position.y, squareSize * dpr, squareSize * dpr);
        });
      });
    },
    [gridGap, memoizedColor, squareSize],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    let gridParams: ReturnType<typeof setupCanvas>;

    const updateCanvasSize = () => {
      const nextWidth = container.clientWidth || window.innerWidth;
      const nextHeight = container.clientHeight || window.innerHeight;
      setCanvasSize({ width: nextWidth, height: nextHeight });
      gridParams = setupCanvas(canvas, nextWidth, nextHeight);
    };

    updateCanvasSize();

    let lastTime = 0;
    const animate = (time: number) => {
      if (!isInView) return;

      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;
      updateSquares(gridParams.squares, deltaTime);
      drawGrid(ctx, canvas.width, canvas.height, gridParams.cols, gridParams.rows, gridParams.squares, gridParams.dpr);
      animationFrameId = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    });
    intersectionObserver.observe(canvas);

    if (isInView) {
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [drawGrid, isInView, setupCanvas, updateSquares]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`fixed left-0 top-0 z-0 h-dvh w-dvw pointer-events-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute left-0 top-0 h-full w-full"
        style={{ width: canvasSize.width, height: canvasSize.height }}
      />
    </div>
  );
}
