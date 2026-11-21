import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { createNoise3D } from 'simplex-noise';
import Particle from './Particle.ts';
import mulberry32, { SEED, seededRandom } from './mulberry32.ts';

function App() {
  // Number of particles determined by experimentation.
  const NUM_PARTICLES = 16000;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameCountRef = useRef(0);
  const lastFrameCountRef = useRef(0);
  const lastTimeRef = useRef<number>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const minAlphaRef = useRef(Number.MAX_SAFE_INTEGER);
  const [minAlpha, setMinAlpha] = useState(Number.MAX_SAFE_INTEGER);
  const particlesRef = useRef<Particle[]>([]);
  const requestRef = useRef<number>(null);
  const mouseCoords = useRef({ x: 0, y: 0, });
  const dimensions = useRef({ width: 0, height: 0, });

  const randomColor = useMemo(() => (() => `rgb(${Math.floor(seededRandom() * 255)}, ${Math.floor(seededRandom() * 255)}, ${Math.floor(seededRandom() * 255)})`), []);

  // Simplex-noise values.
  // One simplex noise per axis to circumvent limitations mapping the bounded line of noise values onto a circle of angles.
  const simplexNoiseX = useMemo(() => createNoise3D(mulberry32(Math.round(seededRandom() * (2 ** 32 - 1)))), []);
  const simplexNoiseY = useMemo(() => createNoise3D(mulberry32(Math.round(seededRandom() * (2 ** 32 - 1)))), []);
  const simplexNoiseTemperature = useMemo(() => createNoise3D(mulberry32(Math.round(seededRandom() * (2 ** 32 - 1)))), []);
  // X and Y flow components' x and y delta determined by experimentation.
  const delta = 0.005;
  // X and Y flow components' time delta determined by experimentation.
  const deltaT = delta / 2;
  // Fade rate determined by experimentation.
  const fadeRate = 2.5;

  const handleMouseLeave = () => {
    mouseCoords.current = {
      x: dimensions.current.width / 2,
      y: dimensions.current.height / 2,
    };
  };

  const handleMouseMove = (event: { currentTarget: { getBoundingClientRect: () => any; }; clientX: number; clientY: number; }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseCoords.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      if (context) {

        // React's <StrictMode> runs effects multiple times in development, so ensure the particles list is cleared.
        particlesRef.current = [];

        // Poisson-disk distribution values.
        // The radius is chosen as the maximal value for which all of the particles can fit in the canvas, working backward from a target grid length of NUM_PARTICLES.
        const sideLength = Math.sqrt((canvas.width * canvas.height) / NUM_PARTICLES);
        // The integer ceiling is taken to ensure there are enough grid cells to fit all of the particles and the grid entirely covers the canvas.
        // Some of the grid cells may thus spill outside the canvas, but particles are prevented from spawning outside the canvas and the probability that a particle will spawn in the remainder of that cell is proportional to the area of the cell within the canvas.
        const columns = Math.ceil(canvas.width / sideLength);
        // The integer ceiling is taken to ensure there are enough grid cells to fit all of the particles and the grid entirely covers the canvas.
        // Some of the grid cells may thus spill outside the canvas, but particles are prevented from spawning outside the canvas and the probability that a particle will spawn in the remainder of that cell is proportional to the area of the cell within the canvas.
        const rows = Math.ceil(canvas.height / sideLength);
        // Two dimensions.
        const radius = sideLength * Math.sqrt(2);
        const grid = new Array<Particle | null>(columns * rows).fill(null);
        const numSampleAttempts = 30;
        const actives: Particle[] = [];

        // Poisson-disk distribution.
        // TODO: Alternatively color particles based on a new simplex-noise field or their Poisson-disk--distribution generation order.
        actives.push(new Particle({ x: seededRandom() * canvas.width, y: seededRandom() * canvas.height, }, randomColor(), canvas.width, canvas.height, 0, 0, context));
        grid[Math.floor(actives[0].position.x / sideLength) + Math.floor(actives[0].position.y / sideLength) * columns] = actives[0];
        particlesRef.current.push(actives[0]);
        while (actives.length && particlesRef.current.length < NUM_PARTICLES) {
          const activesIndex = Math.floor(seededRandom() * actives.length);
          const active = actives[activesIndex];
          let found = false;
          for (let i = 0; i < numSampleAttempts; i++) {
            const angle = seededRandom() * Math.PI * 2;
            const distance = seededRandom() * radius + radius;
            const x = active.position.x + Math.cos(angle) * distance;
            if (x < 0 || x >= canvas.width) {
              continue;
            }
            const y = active.position.y + Math.sin(angle) * distance;
            if (y < 0 || y >= canvas.height) {
              continue;
            }
            const position = { x: x, y: y, };
            const currentGridColumn = Math.floor(position.x / sideLength);
            if (currentGridColumn < 0 || currentGridColumn >= columns) {
              break;
            }
            const currentGridRow = Math.floor(position.y / sideLength);
            if (currentGridRow < 0 || currentGridRow >= rows) {
              break;
            }
            const currentGridIndex = currentGridColumn + currentGridRow * columns;
            let tooClose = false;
            for (let j = -1; j <= 1 && !tooClose; j++) {
              for (let k = -1; k <= 1 && !tooClose; k++) {
                const neighborGridColumn = currentGridColumn + j;
                if (neighborGridColumn < 0 || neighborGridColumn >= columns) {
                  continue;
                }
                const neighborGridRow = currentGridRow + k;
                if (neighborGridRow < 0 || neighborGridRow >= rows) {
                  continue;
                }
                const neighbor = grid[neighborGridColumn + neighborGridRow * columns];
                if (neighbor !== null) {
                  tooClose = Math.sqrt(Math.abs(position.x ** 2 - neighbor.position.x ** 2) + Math.abs(position.y ** 2 - neighbor.position.y ** 2)) < radius;
                }
              }
            }
            if (!tooClose) {
              if (!grid[currentGridIndex]) {
                const newParticle = new Particle(position, randomColor(), canvas.width, canvas.height, 0, 0, context);
                actives.push(newParticle);
                grid[currentGridIndex] = newParticle;
                particlesRef.current.push(newParticle);
                found = true;
                if (particlesRef.current.length === NUM_PARTICLES) {
                  break;
                }
              }
            }
          }
          if (!found) {
            actives.splice(activesIndex, 1);
          }
        }

        lastFrameCountRef.current = frameCountRef.current;
        lastTimeRef.current = performance.now();

        const render = async () => {
          frameCountRef.current += 1;
          const frameStart = performance.now();
          const updateUi = frameStart - lastTimeRef.current! >= 1000;
          if (updateUi) {
            setFrameCount(frameCountRef.current);
            setFps((frameCountRef.current - lastFrameCountRef.current) * 1000 / (frameStart - lastTimeRef.current!));
            lastFrameCountRef.current = frameCountRef.current;
            lastTimeRef.current = frameStart;
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
            // Y coordinate (and not additionally the X coordinate) in simplexNoiseY is offset slightly from simplexNoiseX to avoid shared zero points (points at startup that consistently push, pull, or swirl particles initially across runs) between the independent simplex fields.
            // Any of the simplexNoiseX.x, simplexNoiseY.x, simplexNoiseY.x, or simplexNoiseY.y coordinates could have been offset, but simplexNoiseY.y was thought to be the least impacting on readability.
            const angleY = Math.PI / 2 * simplexNoiseY(particle.position.x * delta, particle.position.y * delta + 1, frameCountRef.current * deltaT);
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
          if (frameCountRef.current > Math.ceil(255 / fadeRate)) {
            minAlphaRef.current = Math.min(minAlphaRef.current, alphaSum);
            if (updateUi) {
              setMinAlpha(() => Math.floor(minAlphaRef.current / (canvasRef.current!.width * canvasRef.current!.height)));
            }
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
  }, [simplexNoiseX, simplexNoiseY, simplexNoiseTemperature, deltaT]);

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
      <p style={{ fontSize: "1rem" }}>Frame: {frameCount}</p>
      <p style={{ fontSize: "1rem" }}>Particles: {NUM_PARTICLES}</p>
      <p style={{ fontSize: "1rem" }}>Min alpha: {minAlpha === Number.MAX_SAFE_INTEGER ? "-" : minAlpha} / pixel</p>
      <p style={{ fontSize: "1rem" }}>Seed: {SEED}</p>
    </>
  )
}

export default App
