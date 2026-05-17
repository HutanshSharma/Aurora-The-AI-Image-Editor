import { useEffect, useRef } from 'react';

class Pixel {
  constructor(canvas, context, x, y, color, speed, delay) {
    this.width = canvas.width;
    this.height = canvas.height;
    this.ctx = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.getRandomValue(0.1, 0.9) * speed;
    this.size = 0;
    this.sizeStep = Math.random() * 0.8;
    this.minSize = 1.5;
    this.maxSizeInteger = 6;
    this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger);
    this.delay = delay;
    this.counter = 0;
    this.counterStep = Math.random() * 4 + (this.width + this.height) * 0.01;
    this.isIdle = false;
    this.isReverse = false;
    this.isShimmer = false;
  }

  getRandomValue(min, max) {
    return Math.random() * (max - min) + min;
  }

  draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  appear() {
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      this.draw();
      return;
    }

    if (this.size >= this.maxSize) {
      this.isShimmer = true;
    }

    if (this.isShimmer) {
      this.shimmer();
    } else {
      this.size += this.sizeStep;
    }

    this.draw();
  }

  shimmer() {
    if (this.size >= this.maxSize) {
      this.isReverse = true;
    } else if (this.size <= this.minSize) {
      this.isReverse = false;
    }

    this.size += this.isReverse ? -this.speed : this.speed;
  }
}

const VARIANTS = {
  default: {
    gap: 5,
    speed: 35,
    colors: 'rgba(248, 250, 252, 0.9),rgba(241, 245, 249, 0.8),rgba(203, 213, 225, 0.7)'
  },
  pink: {
    gap: 6,
    speed: 80,
    colors: 'rgba(254, 205, 211, 0.9),rgba(253, 164, 175, 0.8),rgba(225, 29, 72, 0.7)'
  },
  blue: {
    gap: 7,
    speed: 30,
    colors: 'rgba(96, 165, 250, 0.85),rgba(59, 130, 246, 0.75),rgba(37, 99, 235, 0.65)'
  }
};

export default function PixelCard({
  variant = 'default',
  gap,
  speed,
  colors,
  imageBounds,
  canvasRef,
  zoom = 1,
  offset = { x: 0, y: 0 }
}) {
  const pixelCanvasRef = useRef(null);
  const pixelsRef = useRef([]);
  const animationRef = useRef(null);

  const cfg = VARIANTS[variant] || VARIANTS.default;
  const finalGap = gap ?? cfg.gap;
  const finalSpeed = speed ?? cfg.speed;
  const finalColors = colors ?? cfg.colors;

  const initPixels = () => {
    if (!imageBounds || !pixelCanvasRef.current || !canvasRef.current) return;

    const canvas = pixelCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colorsArr = finalColors.split(',');
    const pxs = [];

    const { x: imgX, y: imgY, width: imgWidth, height: imgHeight } = imageBounds;
    
    const screenX = imgX * zoom + offset.x;
    const screenY = imgY * zoom + offset.y;
    const screenWidth = imgWidth * zoom;
    const screenHeight = imgHeight * zoom;
    
    const centerX = screenX + screenWidth / 2;
    const centerY = screenY + screenHeight / 2;

    for (let x = screenX; x < screenX + screenWidth; x += finalGap) {
      for (let y = screenY; y < screenY + screenHeight; y += finalGap) {
        const color = colorsArr[Math.floor(Math.random() * colorsArr.length)];

        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        pxs.push(new Pixel(canvas, ctx, x, y, color, finalSpeed * 0.01, distance));
      }
    }

    pixelsRef.current = pxs;
  };

  const animate = () => {
    const canvas = pixelCanvasRef.current;
    if (!canvas || !imageBounds) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const px of pixelsRef.current) {
      px.appear();
    }

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (!imageBounds) return;
    
    initPixels();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [imageBounds, zoom, offset, finalGap, finalSpeed, finalColors]);

  if (!imageBounds) return null;

  return (
    <canvas 
      ref={pixelCanvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        mixBlendMode: 'overlay',
        zIndex: 40,
        filter: 'drop-shadow(0 0 2px rgba(59, 130, 246, 0.5))',
      }}
    />
  );
}
