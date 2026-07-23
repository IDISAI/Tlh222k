"use client"

// react-three-fiber's JSX elements (mesh, meshStandardMaterial, ambientLight…)
// are three.js objects, not DOM nodes, so eslint-plugin-react's DOM attribute
// list flags every one of their props. Nothing to fix — just not DOM.
/* eslint-disable react/no-unknown-property */

import { useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import type { Mesh } from "three"

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

type ShapeSpec = {
  /**
   * Horizontal placement as a fraction of the half-viewport, NOT world units:
   * the hero is a very wide, short strip, so a fixed world x that clears the
   * headline at one width lands on top of it at another. |x| >= 0.82 keeps
   * every shape clear of the ~860px headline across the >=1128px widths where
   * the scene renders at all (see `showScene` in RoadmapsBrowser).
   */
  x: number
  y: number
  z: number
  scale: number
  color: string
  geometry: "ico" | "torus" | "box"
  /** Seeds the sine so the shapes never bob in lockstep. */
  phase: number
  speed: number
}

/**
 * Rausch appears exactly once — the design system's rule that the accent stays
 * scarce holds in 3D too. Everything else is the hairline/surface greys, so the
 * scene reads as texture behind the hero rather than as a second focal point.
 */
const SHAPES: ShapeSpec[] = [
  { x: -0.83, y: 1.0, z: -1, scale: 0.8, color: "#ff385c", geometry: "ico", phase: 0, speed: 0.5 },
  { x: -0.91, y: -1.3, z: -2, scale: 0.6, color: "#dddddd", geometry: "torus", phase: 1.7, speed: 0.4 },
  { x: -0.98, y: -0.5, z: -3, scale: 0.5, color: "#ebebeb", geometry: "box", phase: 2.3, speed: 0.55 },
  { x: 0.83, y: 1.4, z: -1.5, scale: 0.7, color: "#ebebeb", geometry: "box", phase: 3.1, speed: 0.45 },
  { x: 0.91, y: -1.1, z: -2.5, scale: 0.9, color: "#f2f2f2", geometry: "ico", phase: 4.4, speed: 0.35 },
  { x: 0.98, y: 0.9, z: -2.2, scale: 0.45, color: "#dddddd", geometry: "ico", phase: 5.2, speed: 0.6 },
]

function Shape({ spec, animate }: { spec: ShapeSpec; animate: boolean }) {
  const ref = useRef<Mesh>(null)
  // `viewport` is measured at z=0 in world units and updates on resize, so the
  // fractional x stays correct through every breakpoint.
  const { viewport } = useThree()
  const x = (viewport.width / 2) * spec.x

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh || !animate) return
    const t = state.clock.elapsedTime
    mesh.position.y = spec.y + Math.sin(t * spec.speed + spec.phase) * 0.28
    mesh.rotation.x = t * spec.speed * 0.25
    mesh.rotation.y = t * spec.speed * 0.35
  })

  return (
    <mesh ref={ref} position={[x, spec.y, spec.z]} scale={spec.scale}>
      {spec.geometry === "ico" ? <icosahedronGeometry args={[1, 0]} /> : null}
      {spec.geometry === "torus" ? <torusGeometry args={[0.8, 0.3, 16, 32]} /> : null}
      {spec.geometry === "box" ? <boxGeometry args={[1.2, 1.2, 1.2]} /> : null}
      <meshStandardMaterial color={spec.color} roughness={0.55} metalness={0.05} />
    </mesh>
  )
}

/**
 * Decorative low-poly field drifting behind the hero. Deliberately pushed to
 * the page's back layer at low opacity: the Airbnb system wants a flat white
 * canvas, so the 3D reads as paper texture, never as content.
 *
 * Non-interactive by design (`pointer-events-none`) so it can never swallow a
 * click meant for the search pill sitting on top of it, and `aria-hidden` so
 * assistive tech skips it entirely.
 */
export function HeroScene() {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-70"
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        // A still frame when the visitor asked for reduced motion: the shapes
        // still render, they just never move.
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        {SHAPES.map((spec, i) => (
          <Shape key={i} spec={spec} animate={!reducedMotion} />
        ))}
      </Canvas>
    </div>
  )
}
