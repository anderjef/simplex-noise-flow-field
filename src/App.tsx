import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'
import { createNoise3D } from 'simplex-noise';
import Particle from './Particle.ts';

function App() {
  // Number of particles determined by experimentation.
  const NUM_PARTICLES = 16000;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);
  const [minAlpha, setMinAlpha] = useState(Number.MAX_VALUE);
  const particlesRef = useRef<Particle[]>([]);
  const requestRef = useRef<number>(null);
  const mouseCoords = useRef({ x: 0, y: 0 });
  const dimensions = useRef({ width: 0, height: 0 });

  // One simplex noise per axis to circumvent limitations mapping the bounded line of noise values onto a circle of angles.
  const simplexNoiseX = createNoise3D();
  const simplexNoiseY = createNoise3D();
  const simplexNoiseTemperature = createNoise3D();
  // X and Y flow components' x and y delta determined by experimentation.
  const delta: number = 0.005;
  // X and Y flow components' time delta determined by experimentation.
  const deltaT: number = delta / 2;
  // Fade rate determined by experimentation.
  const fadeRate = 2.5;
  const frameRatePeriod = 10;

  const handleMouseLeave = () => {
    mouseCoords.current = {
      x: dimensions.current.width / 2,
      y: dimensions.current.height / 2
    };
  };

  const handleMouseMove = (event: { currentTarget: { getBoundingClientRect: () => any; }; clientX: number; clientY: number; }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseCoords.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      for (let i = 0; i < NUM_PARTICLES; i++) {
        //TODO: Alternatively color particles based on a new simplex-noise field.
        particlesRef.current.push(new Particle(canvas.width, canvas.height, 0, 0, 0, `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`));
      }
      const context = canvas.getContext("2d");
      if (context) {
        let lastFrameCount = frameCountRef.current;
        let lastTime = performance.now();

        const render = async () => {
          frameCountRef.current += 1;
          if (frameCountRef.current % frameRatePeriod === 0) {
            const now = performance.now();
            setFps((frameCountRef.current - lastFrameCount) * 1000 / (now - lastTime));
            lastFrameCount = frameCountRef.current;
            lastTime = now;
          }

          // Debug-like coloring of canvas to indicate flow direction, where red indicates flow at 30 degrees, blue indicates flow at 150 degrees, and green indicates flow at 270 degrees.
          // const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
          // const data = imgData.data;
          // for (let y = 0; y < canvas.height; y++) {
          //   for (let x = 0; x < canvas.width; x++) {
          //     const i = y * canvas.width + x;
          //     const angleX = Math.PI / 2 * (simplexNoiseX(x * delta, y * delta, frameCountRef.current * deltaT) + 1);
          //     const angleY = Math.PI / 2 * simplexNoiseY(x * delta, y * delta, frameCountRef.current * deltaT);
          //     const flowX = Math.cos(angleX);
          //     // Negative because canvas y-direction is inverted from mathematical convention.
          //     const flowY = -Math.sin(angleY);
          //     const angle = Math.atan2(flowY, flowX);
          //     // Red indicates flow at at 30 degrees.
          //     data[i * 4 + 0] = (Math.PI * 3 / 2 < angle ? (1 - Math.abs((angle - Math.PI * 2) - Math.PI * 1 / 6) / (Math.PI * 2 / 3)) : (angle < Math.PI * 2 / 3 ? (1 - Math.abs(angle - Math.PI * 1 / 6) / (Math.PI * 2 / 3)) : 0)) * 255;
          //     // Green indicates flow at at 270 degrees.
          //     data[i * 4 + 1] = (angle < Math.PI * 1 / 3 ? (1 - Math.abs((angle + Math.PI * 2) - Math.PI * 3 / 2) / (Math.PI * 2 / 3)) : (Math.PI * 5 / 6 < angle ? (1 - Math.abs(angle - Math.PI * 3 / 2) / (Math.PI * 2 / 3)) : 0)) * 255;
          //     // Blue indicates flow at at 150 degrees.
          //     data[i * 4 + 2] = (Math.PI * 1 / 6 < angle && angle < Math.PI * 3 / 2 ? (1 - Math.abs(angle - Math.PI * 5 / 6) / (Math.PI * 2 / 3)) : 0) * 255;
          //     data[i * 4 + 3] = 255;
          //   }
          // }
          // context.putImageData(imgData, 0, 0);

          for (let i = 0; i < particlesRef.current.length; i++) {
            const particle = particlesRef.current[i];
            const angleX = Math.PI / 2 * (simplexNoiseX(particle.position.x * delta, particle.position.y * delta, frameCountRef.current * deltaT) + 1);
            const angleY = Math.PI / 2 * simplexNoiseY(particle.position.x * delta, particle.position.y * delta, frameCountRef.current * deltaT);
            const flowX = Math.cos(angleX);
            const flowY = Math.sin(angleY);
            // Temperature range of particles determined by experimentation.
            // Particle temperatures are offset from each other within the temperature field by an amount large enough to keep particle temperatures independent without generating a separate noise field for each.
            const temperature = 1.5 * (simplexNoiseTemperature(i * canvas.width * canvas.height + particle.position.x * delta, i * canvas.width * canvas.height + particle.position.y * delta, frameCountRef.current * deltaT) + 1);
            particle.update(canvas.width, canvas.height, temperature, flowX, flowY, context);
          }

          let alphaSum = 0;
          const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const i = y * canvas.width + x;
              if (data[i * 4 + 3] > 0) {
                data[i * 4 + 3] -= fadeRate;
              }
              alphaSum += data[i * 4 + 3];
            }
          }
          context.putImageData(imgData, 0, 0);
          if (frameCountRef.current > 50) {
            setMinAlpha((previousMinAlpha) => Math.min(previousMinAlpha, alphaSum));
          }

          requestRef.current = requestAnimationFrame(render);
        };

        requestRef.current = requestAnimationFrame(render);
      }
    }
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current)
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { inlineSize: width, blockSize: height } = entry.borderBoxSize[0];
        dimensions.current = { width: width, height: height };
        mouseCoords.current.x = width / 2;
        mouseCoords.current.y = height / 2;
      }
    });
    resizeObserver.observe(canvasRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <>
      <canvas ref={canvasRef}
        width={800}
        height={800}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      <p style={{ fontSize: "2rem" }}>{Math.floor(fps)} fps</p>
      <p style={{ fontSize: "1rem" }}>Frame: {frameCountRef.current}</p>
      <p style={{ fontSize: "1rem" }}>Particles: {NUM_PARTICLES}</p>
      <p style={{ fontSize: "1rem" }}>Min alpha: {minAlpha == Number.MAX_VALUE ? "-" : Math.floor(minAlpha / ((canvasRef.current?.width ?? 0) * (canvasRef.current?.height ?? 0)))} / pixel</p>
    </>
  )
}

export default App
