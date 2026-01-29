import React, { Component, ReactNode, Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Float, Environment } from '@react-three/drei';
import * as THREE from 'three';

interface BusModelProps {
  bearing: number;
}

const ProceduralBus = () => (
  <group scale={1.5}>
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      {/* Chassis */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1, 0.8, 2.5]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.9, 0.2, 2.2]} />
        <meshStandardMaterial color="#fcd34d" />
      </mesh>
      {/* Windows */}
      <mesh position={[0, 0.6, 0.2]}>
        <boxGeometry args={[1.02, 0.3, 1.8]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Headlights */}
      <mesh position={[0.3, 0.3, 1.25]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} />
      </mesh>
      <mesh position={[-0.3, 0.3, 1.25]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} />
      </mesh>
      {/* Wheels */}
      {[[-0.5, 0, 0.8], [0.5, 0, 0.8], [-0.5, 0, -0.8], [0.5, 0, -0.8]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.15, 16]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
    </Float>
    <ambientLight intensity={1.5} />
    <directionalLight position={[5, 5, 5]} intensity={2} />
  </group>
);

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ModelErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: any): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error("3D Model Error:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const GLTFBuss = ({ bearing }: { bearing: number }) => {
  const { scene } = useGLTF('https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/bus/model.gltf');
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      const targetRotation = (bearing * Math.PI) / 180;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        -targetRotation,
        delta * 5
      );
    }
  });

  return (
    <group ref={groupRef} scale={0.5}>
      <primitive object={scene} />
      <Environment preset="city" />
    </group>
  );
};

export const BusModel: React.FC<BusModelProps> = ({ bearing }) => {
  return (
    <ModelErrorBoundary fallback={<ProceduralBus />}>
      <Suspense fallback={<ProceduralBus />}>
         <GLTFBuss bearing={bearing} />
      </Suspense>
    </ModelErrorBoundary>
  );
};

try {
  useGLTF.preload('https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/bus/model.gltf');
} catch (e) {
  console.warn("Failed to preload bus model");
}
