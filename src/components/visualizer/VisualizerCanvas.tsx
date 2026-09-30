import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../../audio/AudioEngine';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hue: number;
}

interface PulseRing {
  radius: number;
  maxRadius: number;
  alpha: number;
}

export const VisualizerCanvas: React.FC<{ className?: string; interactive?: boolean }> = ({
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const visualizerMode = useUIStore((state) => state.visualizerMode);
  const visualizerIntensity = useUIStore((state) => state.visualizerIntensity);
  const isVisualizerEnabled = useUIStore((state) => state.isVisualizerEnabled);
  const reducedMotion = useUIStore((state) => state.reducedMotion);

  const particlesRef = useRef<Particle[]>([]);
  const pulseRingsRef = useRef<PulseRing[]>([]);
  const peakCapsRef = useRef<number[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // Initialize particle system
  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < 65; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        size: Math.random() * 3 + 1.5,
        alpha: Math.random() * 0.7 + 0.3,
        hue: Math.random() * 60 + 170, // cyan to violet range
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    if (!isVisualizerEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 300);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    const accentColor = currentTrack?.accentColor || '#00f2fe';

    const render = () => {
      const freqData = audioEngine.getFrequencyData();
      const waveData = audioEngine.getWaveformData();

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Average bass energy
      let bassEnergy = 0;
      if (freqData) {
        for (let i = 0; i < 16; i++) bassEnergy += freqData[i];
        bassEnergy = bassEnergy / (16 * 255);
      }

      if (reducedMotion) {
        // Simple subtle breathing line in reduced motion mode
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      switch (visualizerMode) {
        case 'bars': {
          if (!freqData) break;
          const barCount = Math.min(64, Math.floor(width / 10));
          const barWidth = (width / barCount) * 0.75;
          const gap = (width / barCount) * 0.25;

          if (peakCapsRef.current.length !== barCount) {
            peakCapsRef.current = new Array(barCount).fill(0);
          }

          for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor((i / barCount) * (freqData.length * 0.75));
            const rawVal = freqData[dataIndex] || 0;
            const barHeight = Math.max(4, (rawVal / 255) * (height * 0.85) * visualizerIntensity);

            const x = i * (barWidth + gap) + gap / 2;
            const y = height - barHeight;

            // Falloff peak caps
            if (barHeight > peakCapsRef.current[i]) {
              peakCapsRef.current[i] = barHeight;
            } else {
              peakCapsRef.current[i] = Math.max(0, peakCapsRef.current[i] - 1.5);
            }

            // Gradient fill
            const grad = ctx.createLinearGradient(0, height, 0, y);
            grad.addColorStop(0, `${accentColor}33`);
            grad.addColorStop(0.6, accentColor);
            grad.addColorStop(1, '#9d4edd');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
            ctx.fill();

            // Peak cap dot
            const capY = height - peakCapsRef.current[i] - 3;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, capY, barWidth, 2);
          }
          break;
        }

        case 'circular': {
          if (!freqData) break;
          const cx = width / 2;
          const cy = height / 2;
          const baseRadius = Math.min(width, height) * 0.22 + bassEnergy * 25 * visualizerIntensity;
          const points = 72;

          ctx.save();
          ctx.translate(cx, cy);

          // Glowing center pulse
          const radialGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * 1.3);
          radialGrad.addColorStop(0, `${accentColor}55`);
          radialGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = radialGrad;
          ctx.beginPath();
          ctx.arc(0, 0, baseRadius * 1.3, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = accentColor;
          ctx.shadowBlur = 15;
          ctx.beginPath();

          for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const freqIdx = Math.floor((i % (points / 2) / (points / 2)) * 48);
            const val = ((freqData[freqIdx] || 0) / 255) * 60 * visualizerIntensity;
            const r = baseRadius + val;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'waveform': {
          if (!waveData) break;
          ctx.lineWidth = 3;
          ctx.strokeStyle = accentColor;
          ctx.shadowColor = accentColor;
          ctx.shadowBlur = 12;

          ctx.beginPath();
          const sliceWidth = width / waveData.length;
          let x = 0;

          for (let i = 0; i < waveData.length; i++) {
            const v = waveData[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
          break;
        }

        case 'particles': {
          const particles = particlesRef.current;
          const speedMultiplier = 1 + bassEnergy * 4 * visualizerIntensity;

          particles.forEach((p) => {
            p.x += p.vx * speedMultiplier;
            p.y += p.vy * speedMultiplier;

            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            const size = p.size * (1 + bassEnergy * 2);

            ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${p.alpha})`;
            ctx.shadowColor = accentColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.shadowBlur = 0;
          break;
        }

        case 'pulse': {
          const cx = width / 2;
          const cy = height / 2;

          if (bassEnergy > 0.65 && (!pulseRingsRef.current.length || pulseRingsRef.current[pulseRingsRef.current.length - 1].radius > 35)) {
            pulseRingsRef.current.push({
              radius: 10,
              maxRadius: Math.min(width, height) * 0.75,
              alpha: 0.9,
            });
          }

          pulseRingsRef.current.forEach((ring, idx) => {
            ring.radius += 3.5 * visualizerIntensity;
            ring.alpha -= 0.015;

            ctx.strokeStyle = `${accentColor}${Math.max(0, Math.floor(ring.alpha * 255)).toString(16).padStart(2, '0')}`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
            ctx.stroke();

            if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
              pulseRingsRef.current.splice(idx, 1);
            }
          });

          // Center icon / dot
          ctx.fillStyle = accentColor;
          ctx.beginPath();
          ctx.arc(cx, cy, 8 + bassEnergy * 15, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'fluid': {
          if (!freqData) break;
          const time = Date.now() * 0.002;
          ctx.save();
          ctx.translate(width / 2, height / 2);

          const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, height * 0.45);
          grad.addColorStop(0, `${accentColor}88`);
          grad.addColorStop(0.7, '#9d4edd55');
          grad.addColorStop(1, 'transparent');

          ctx.fillStyle = grad;
          ctx.beginPath();

          const fluidPoints = 12;
          for (let i = 0; i <= fluidPoints; i++) {
            const angle = (i / fluidPoints) * Math.PI * 2;
            const freqVal = (freqData[i * 2] || 0) / 255;
            const deform = Math.sin(angle * 3 + time) * 30 + freqVal * 60 * visualizerIntensity;
            const r = Math.min(width, height) * 0.25 + deform;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }

        case 'neon': {
          if (!freqData) break;
          const halfH = height / 2;
          const barWidth = width / 64;

          ctx.lineWidth = 2;
          for (let i = 0; i < 64; i++) {
            const val = ((freqData[i] || 0) / 255) * halfH * 0.9 * visualizerIntensity;
            const x = i * barWidth;

            ctx.strokeStyle = i % 2 === 0 ? accentColor : '#9d4edd';
            ctx.beginPath();
            ctx.moveTo(x, halfH - val);
            ctx.lineTo(x, halfH + val);
            ctx.stroke();
          }
          break;
        }

        case 'minimal':
        default: {
          if (!waveData) break;
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = `${accentColor}bb`;
          ctx.beginPath();
          const step = Math.ceil(waveData.length / width);
          for (let x = 0; x < width; x++) {
            const idx = Math.floor(x * step);
            const val = waveData[idx] / 255;
            const y = height / 2 + (val - 0.5) * height * 0.6 * visualizerIntensity;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          break;
        }
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [visualizerMode, visualizerIntensity, isVisualizerEnabled, currentTrack, isPlaying, reducedMotion]);

  return (
    <div className={`relative overflow-hidden pointer-events-none ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
