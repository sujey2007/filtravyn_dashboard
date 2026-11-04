import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Edges, Html, Line, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { COMPONENTS, type CompDef, type ComponentId } from '../../data/components'
import type { CompState, StateKind } from '../../services/componentState'

// The placeholder is a labelled schematic. It does not represent the real purifier.
// To use your own model, pass modelUrl (a GLB) and a mapping of mesh names to component ids.

const STATE_COLOR: Record<StateKind, string> = { ok: '#177A4E', warn: '#D79A1B', crit: '#B52A25', na: '#8E9DA6' }
const PIPE_Y = 0.62

export type Mapping = Partial<Record<ComponentId, string[]>>

interface TwinProps {
  states: Record<ComponentId, CompState>
  /** L/min, or null when unavailable (animation stays still) */
  flowLpm: number | null
  selected: ComponentId
  onSelect: (id: ComponentId) => void
  resetSignal: number
  autoRotate: boolean
  modelUrl?: string | null
  mapping?: Mapping
  /** Mapped pipe route (mesh names). Water animation only runs on the placeholder unless this is set. */
  pipeRoute?: string[] | null
  onMeshNames?: (names: string[]) => void
  onModelError?: (message: string) => void
}

export function Twin(props: TwinProps) {
  const { modelUrl } = props
  return (
    <div className="r3f">
      <Canvas camera={{ position: [12, 11, 14.5], fov: 30, near: 0.1, far: 200 }} dpr={[1, 2]}>
        <hemisphereLight args={['#ffffff', '#b9c6cd', 0.95]} />
        <directionalLight position={[6, 12, 8]} intensity={0.8} />
        <Controls resetSignal={props.resetSignal} autoRotate={props.autoRotate} hasModel={!!modelUrl} />
        {modelUrl ? (
          <ModelBoundary key={modelUrl} onError={props.onModelError}>
            <Suspense fallback={null}>
              <GltfModel
                url={modelUrl}
                states={props.states}
                mapping={props.mapping ?? {}}
                onMeshNames={props.onMeshNames}
              />
            </Suspense>
          </ModelBoundary>
        ) : (
          <Placeholder {...props} />
        )}
      </Canvas>
    </div>
  )
}

function Controls({ resetSignal, autoRotate, hasModel }: { resetSignal: number; autoRotate: boolean; hasModel: boolean }) {
  const ref = useRef<any>(null)
  useEffect(() => {
    ref.current?.reset()
  }, [resetSignal, hasModel])
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      target={[0, hasModel ? 2 : 0.5, 0.2]}
      maxPolarAngle={Math.PI * 0.47}
      minDistance={6}
      maxDistance={60}
      autoRotate={autoRotate}
      autoRotateSpeed={1.2}
    />
  )
}

/* ---------- placeholder schematic ---------- */

function Placeholder({ states, flowLpm, selected, onSelect }: TwinProps) {
  const route = useMemo(() => buildRoute(), [])
  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[18, 0.1, 9]} />
        <meshStandardMaterial color="#F9FBFB" roughness={0.9} />
        <Edges color="#B5C1C8" />
      </mesh>
      <gridHelper args={[18, 18, '#D3DCE1', '#D3DCE1']} position={[0, 0.006, 0]} />
      {COMPONENTS.map((c) => (
        <CompSymbol key={c.id} def={c} state={states[c.id]} selected={selected === c.id} onSelect={onSelect} />
      ))}
      <CellProbes />
      <Line points={route.points} color="#7F92EE" lineWidth={4} />
      <Water curve={route.curve} running={flowLpm != null && flowLpm > 0.05} speed={flowLpm ?? 0} />
    </group>
  )
}

function geometryFor(c: CompDef) {
  switch (c.kind) {
    case 'tank':
      return <boxGeometry args={[1.7, c.h, 1.7]} />
    case 'pump':
      return <cylinderGeometry args={[0.65, 0.65, c.h, 36]} />
    case 'filter':
      return <cylinderGeometry args={[0.5, 0.5, c.h, 36]} />
    case 'flow':
      return <boxGeometry args={[0.9, c.h, 0.7]} />
    case 'cell':
      return <boxGeometry args={[1.5, c.h, 1.1]} />
    default:
      return <cylinderGeometry args={[0.4, 0.4, c.h, 28]} />
  }
}

function CompSymbol({
  def,
  state,
  selected,
  onSelect,
}: {
  def: CompDef
  state: CompState
  selected: boolean
  onSelect: (id: ComponentId) => void
}) {
  const lampY = def.h + (def.kind === 'cell' ? 0.8 : 0.3)
  return (
    <group>
      <mesh
        position={[def.x, def.h / 2, def.z]}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(def.id)
        }}
      >
        {geometryFor(def)}
        <meshStandardMaterial color={selected ? '#DCE1FA' : '#F1F5F6'} roughness={0.65} />
        <Edges color={selected ? '#2A3FD8' : '#0F2230'} />
      </mesh>
      <mesh position={[def.x, lampY, def.z]}>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshBasicMaterial color={STATE_COLOR[state.st]} transparent opacity={state.st === 'na' ? 0.55 : 1} />
      </mesh>
      <Html position={[def.x, lampY + 0.35, def.z]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className={'tag inline' + (selected ? ' sel' : '')}>
          <b>{def.short}</b>
          <span>{state.label}</span>
        </div>
      </Html>
    </group>
  )
}

function CellProbes() {
  const cell = COMPONENTS.find((c) => c.id === 'cell')!
  return (
    <group>
      {[-0.4, 0].map((dx) => (
        <mesh key={dx} position={[cell.x + dx, 1.1 + 0.27, cell.z]}>
          <cylinderGeometry args={[0.06, 0.06, 0.55, 12]} />
          <meshStandardMaterial color="#0F2230" />
        </mesh>
      ))}
      {/* Turbidity optical sensor probe (ESP32-S3 Pin 6) */}
      <mesh position={[cell.x + 0.4, 1.1 + 0.27, cell.z]}>
        <cylinderGeometry args={[0.06, 0.06, 0.55, 12]} />
        <meshStandardMaterial color="#D97706" />
      </mesh>
    </group>
  )
}

function buildRoute() {
  const pts: THREE.Vector3[] = []
  const v = (x: number, z: number) => new THREE.Vector3(x, PIPE_Y, z)
  COMPONENTS.forEach((c, i) => {
    pts.push(i === 0 ? v(c.x, c.z) : v(c.x - c.hw, c.z))
    if (i < COMPONENTS.length - 1) {
      const n = COMPONENTS[i + 1]
      pts.push(v(c.x + c.hw, c.z))
      const xm = (c.x + c.hw + n.x - n.hw) / 2
      pts.push(v(xm, c.z))
      pts.push(v(xm, n.z))
    } else {
      pts.push(v(c.x, c.z))
    }
  })
  const curve = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].distanceTo(pts[i + 1]) > 1e-4) curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
  }
  return { points: pts, curve }
}

function Water({ curve, running, speed }: { curve: THREE.CurvePath<THREE.Vector3>; running: boolean; speed: number }) {
  const N = 80
  const ref = useRef<THREE.InstancedMesh>(null)
  const phase = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    if (running && !reduce) phase.current = (phase.current + Math.min(dt, 0.1) * (speed / 1.6) * 0.07) % 1
    for (let i = 0; i < N; i++) {
      const u = running ? (i / N + phase.current) % 1 : i / N
      const p = curve.getPointAt(Math.min(0.9999, u))
      dummy.position.copy(p)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <sphereGeometry args={[0.1, 8, 6]} />
      <meshBasicMaterial color="#1C2FB8" transparent opacity={running ? 1 : 0.18} />
    </instancedMesh>
  )
}

/* ---------- user-supplied GLB ---------- */

function GltfModel({
  url,
  states,
  mapping,
  onMeshNames,
}: {
  url: string
  states: Record<ComponentId, CompState>
  mapping: Mapping
  onMeshNames?: (names: string[]) => void
}) {
  const gltf = useGLTF(url)
  const root = useRef<THREE.Group>(null)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf])

  useLayoutEffect(() => {
    const names = new Set<string>()
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone()
        if (m.name) names.add(m.name)
      }
    })
    const g = root.current
    if (g) {
      const box = new THREE.Box3().setFromObject(scene)
      const size = box.getSize(new THREE.Vector3())
      const centre = box.getCenter(new THREE.Vector3())
      const s = 8 / Math.max(size.x, size.y, size.z, 1e-6)
      g.scale.setScalar(s)
      g.position.set(-centre.x * s, -box.min.y * s, -centre.z * s)
    }
    onMeshNames?.([...names])
  }, [scene, onMeshNames])

  // Tint only the parts the mapping names. Unmapped parts keep the supplied appearance.
  useEffect(() => {
    ;(Object.keys(mapping) as ComponentId[]).forEach((id) => {
      const list = mapping[id] ?? []
      const st = states[id]?.st ?? 'na'
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || !list.includes(m.name)) return
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        mats.forEach((mat) => {
          const sm = mat as THREE.MeshStandardMaterial
          if (sm.emissive) {
            sm.emissive.set(STATE_COLOR[st])
            sm.emissiveIntensity = st === 'na' ? 0 : 0.45
          }
        })
      })
    })
  }, [scene, mapping, states])

  return (
    <group>
      <group ref={root}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

class ModelBoundary extends Component<{ children: ReactNode; onError?: (m: string) => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: Error) {
    this.props.onError?.(err.message || 'Could not load model')
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
