"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    let lastTime = 0;
    let isInView = false;
    let gridParams: {
      cols: number;
      rows: number;
      squares: Float32Array;
      dpr: number;
    };
    let colorPrefix = "rgba(99, 102, 241,";

    const getColorPrefix = (color: string) => {
      const scratchCanvas = document.createElement("canvas");
      scratchCanvas.width = 1;
      scratchCanvas.height = 1;
      const scratchContext = scratchCanvas.getContext("2d");
      if (!scratchContext) return "rgba(99, 102, 241,";

      scratchContext.fillStyle = color;
      scratchContext.fillRect(0, 0, 1, 1);
      const [r, g, b] = Array.from(scratchContext.getImageData(0, 0, 1, 1).data);
      return `rgba(${r}, ${g}, ${b},`;
    };

    const updateColor = () => {
      const isDark =
        document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      colorPrefix = getColorPrefix(isDark ? darkModeColor : lightModeColor);
    };

    const setupCanvas = (targetCanvas: HTMLCanvasElement, width: number, height: number) => {
      const dpr = window.devicePixelRatio || 1;
      targetCanvas.width = width * dpr;
      targetCanvas.height = height * dpr;
      targetCanvas.style.width = `${width}px`;
      targetCanvas.style.height = `${height}px`;

      const cols = Math.floor(width / (squareSize + gridGap));
      const rows = Math.floor(height / (squareSize + gridGap));
      const squares = new Float32Array(cols * rows);

      for (let i = 0; i < squares.length; i++) {
        squares[i] = Math.random() * maxOpacity;
      }

      return { cols, rows, squares, dpr };
    };

    const updateSquares = (squares: Float32Array, deltaTime: number) => {
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < flickerChance * deltaTime) {
          squares[i] = Math.random() * maxOpacity;
        }
      }
    };

    const drawGrid = (
      context: CanvasRenderingContext2D,
      width: number,
      height: number,
      cols: number,
      rows: number,
      squares: Float32Array,
      dpr: number,
    ) => {
      context.clearRect(0, 0, width, height);

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
        context.fillStyle = `${colorPrefix}${opacity})`;
        positions.forEach((position) => {
          context.fillRect(position.x, position.y, squareSize * dpr, squareSize * dpr);
        });
      });
    };

    const updateCanvasSize = () => {
      const nextWidth = container.clientWidth || window.innerWidth;
      const nextHeight = container.clientHeight || window.innerHeight;
      gridParams = setupCanvas(canvas, nextWidth, nextHeight);
    };

    const stopAnimation = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
    };

    const animate = (time: number) => {
      if (!isInView || !gridParams) return;

      const deltaTime = lastTime === 0 ? 0 : (time - lastTime) / 1000;
      lastTime = time;
      updateSquares(gridParams.squares, deltaTime);
      drawGrid(ctx, canvas.width, canvas.height, gridParams.cols, gridParams.rows, gridParams.squares, gridParams.dpr);
      animationFrameId = requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      if (animationFrameId !== 0) return;
      lastTime = 0;
      animationFrameId = requestAnimationFrame(animate);
    };

    updateColor();
    updateCanvasSize();

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isInView = entry.isIntersecting;
      if (isInView) {
        startAnimation();
      } else {
        stopAnimation();
      }
    });
    intersectionObserver.observe(canvas);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateColor);

    const themeObserver = new MutationObserver(updateColor);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      stopAnimation();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      mediaQuery.removeEventListener("change", updateColor);
      themeObserver.disconnect();
    };
  }, [darkModeColor, flickerChance, gridGap, lightModeColor, maxOpacity, squareSize]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`fixed left-0 top-0 z-0 h-dvh w-dvw pointer-events-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute left-0 top-0 size-full"
      />
    </div>
  );
}
