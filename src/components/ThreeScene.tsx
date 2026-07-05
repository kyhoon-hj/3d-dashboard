"use client";

import React, { useRef, useMemo, useEffect, Suspense } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Line, Html, useGLTF, useAnimations } from "@react-three/drei";
import { observer } from "mobx-react-lite";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { HomeDevice } from "../store/dashboardStore";
import { dashboardStore } from "../store/dashboardStore";
import { playTts, playTtsAfterUserGesture } from "../lib/ttsClient";

const robotSpeechByAnimation: Partial<Record<string, string>> = {
  Wave: "안녕하세요. HJ솔루션입니다",
  ThumbsUp: "정말 대단해요",
  Yes: "그렇군요",
  No: "그건 아닙니다.",
};

let danceAudioContext: AudioContext | null = null;
let danceMusicTimer: number | null = null;
let isDanceMusicPlaying = false;

function playTone(
  audioContext: AudioContext,
  startTime: number,
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume: number
) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function scheduleDanceMusicLoop(audioContext: AudioContext) {
  if (!isDanceMusicPlaying) return;

  const startTime = audioContext.currentTime + 0.04;
  const beat = 0.18;
  const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 739.99, 880, 739.99];

  melody.forEach((frequency, index) => {
    const noteStart = startTime + index * beat;
    playTone(audioContext, noteStart, frequency, beat * 0.75, "square", 0.045);

    if (index % 2 === 0) {
      playTone(audioContext, noteStart, 130.81, beat * 0.55, "sine", 0.08);
    }

    playTone(audioContext, noteStart + beat * 0.5, 1760, beat * 0.18, "triangle", 0.025);
  });

  danceMusicTimer = window.setTimeout(() => {
    scheduleDanceMusicLoop(audioContext);
  }, melody.length * beat * 1000);
}

function stopDanceMusic() {
  isDanceMusicPlaying = false;

  if (danceMusicTimer !== null) {
    window.clearTimeout(danceMusicTimer);
    danceMusicTimer = null;
  }
}

function startDanceMusic() {
  if (typeof window === "undefined" || isDanceMusicPlaying) return;

  const AudioContextConstructor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) return;

  danceAudioContext = danceAudioContext || new AudioContextConstructor();
  isDanceMusicPlaying = true;

  void danceAudioContext.resume().then(() => {
    scheduleDanceMusicLoop(danceAudioContext!);
  }).catch((error) => {
    stopDanceMusic();
    console.error("Dance music playback failed:", error);
  });
}

function playRobotSpeech(text: string) {
  void playTts(text).catch((error) => {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      playTtsAfterUserGesture(text);
      return;
    }

    console.error("Robot animation TTS playback failed:", error);
  });
}

// Cozy color palette helpers
const getThemeColors = (theme: string) => {
  switch (theme) {
    case "sage":
      return { primary: "#8dae92", secondary: "#cce0d0", accent: "#a2c4ab" };
    case "lavender":
      return { primary: "#a69cc7", secondary: "#e0dbe9", accent: "#b8acd8" };
    default: // apricot
      return { primary: "#ff9f75", secondary: "#fde8df", accent: "#ffb494" };
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "online":
      return "#10b981"; // emerald green
    case "warning":
      return "#f59e0b"; // warm yellow
    case "offline":
      return "#ef4444"; // warm red
    default:
      return "#a1a1aa";
  }
};

// Canvas Loader Component
const CanvasLoader = () => (
  <Html center>
    <div className="flex flex-col items-center justify-center p-4 bg-white/95 backdrop-blur rounded-2xl shadow-md border border-cozy-border-light whitespace-nowrap">
      <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mb-2" />
      <p className="font-sans font-bold text-xs text-cozy-text-light">3D 로봇 캐릭터 로드 중...</p>
    </div>
  </Html>
);

// 3D Humanoid Robot Character
const RobotModel = observer(() => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Load the RobotExpressive model from public folder
  const { scene, animations } = useGLTF("/models/robot.glb");
  
  // Bind animations using useAnimations hook
  const { actions } = useAnimations(animations, groupRef);
  const prevActionName = useRef<string | null>(null);
  const animationName = dashboardStore.robotAnimation;

  // Traverses meshes to enable shadows
  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  // Handle animation play and transition cross-fades
  useEffect(() => {
    const currentAction = actions[animationName];
    if (!currentAction) return;

    const transientActions = ["Wave", "Jump", "ThumbsUp", "Yes", "No", "Punch"];
    if (transientActions.includes(animationName)) {
      currentAction.clampWhenFinished = true;
      currentAction.setLoop(THREE.LoopOnce, 1);
    } else {
      currentAction.setLoop(THREE.LoopRepeat, Infinity);
    }

    currentAction.reset().fadeIn(0.25).play();

    const speechText = robotSpeechByAnimation[animationName];
    if (speechText && prevActionName.current !== animationName) {
      playRobotSpeech(speechText);
    }

    if (prevActionName.current && prevActionName.current !== animationName) {
      const prevAction = actions[prevActionName.current];
      if (prevAction) {
        prevAction.fadeOut(0.25);
      }
    }

    prevActionName.current = animationName;
  }, [animationName, actions]);

  useEffect(() => {
    if (animationName === "Dance") {
      startDanceMusic();
    } else {
      stopDanceMusic();
    }

    return () => {
      if (animationName === "Dance") {
        stopDanceMusic();
      }
    };
  }, [animationName]);

  useFrame(() => {
    if (groupRef.current) {
      // Manual turntable rotation: convert degrees from store to radians
      const angleRad = (dashboardStore.rotationAngle * Math.PI) / 180;
      groupRef.current.rotation.y = angleRad;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive 
        object={scene} 
        scale={0.52} 
        position={[0, -0.85, 0]} 
      />
    </group>
  );
});

// Stylized smart appliances
interface DeviceMeshProps {
  type: string;
  color: string;
  status: string;
}

const DeviceMesh = ({ type, color, status }: DeviceMeshProps) => {
  const isOffline = status === "offline";
  const meshColor = isOffline ? "#cbd5e1" : color;
  const emissiveColor = isOffline ? "#0f172a" : color;
  const emissiveInt = isOffline ? 0.0 : 0.6;

  switch (type) {
    case "lighting":
      return (
        <group>
          <mesh castShadow position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.2, 0.25, 0.06, 16]} />
            <meshStandardMaterial color="#475569" roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.45, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.5} />
          </mesh>
          <mesh castShadow position={[0, 0.3, 0]}>
            <coneGeometry args={[0.28, 0.25, 16, 1, true]} />
            <meshStandardMaterial 
              color={meshColor} 
              emissive={emissiveColor}
              emissiveIntensity={emissiveInt} 
              side={THREE.DoubleSide} 
            />
          </mesh>
          {!isOffline && (
            <mesh position={[0, 0.2, 0]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshBasicMaterial color="#ffeb3b" />
            </mesh>
          )}
        </group>
      );
    case "coffee":
      return (
        <group>
          <mesh castShadow position={[0, 0.1, 0]}>
            <boxGeometry args={[0.35, 0.45, 0.35]} />
            <meshStandardMaterial color={isOffline ? "#cbd5e1" : "#f1f5f9"} roughness={0.3} />
          </mesh>
          <mesh castShadow position={[0, 0.34, 0]}>
            <boxGeometry args={[0.3, 0.04, 0.3]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh castShadow position={[0, 0.02, 0.1]}>
            <cylinderGeometry args={[0.1, 0.12, 0.24, 16]} />
            <meshStandardMaterial 
              color={isOffline ? "#e2e8f0" : color} 
              transparent 
              opacity={isOffline ? 0.3 : 0.85} 
              roughness={0.15}
            />
          </mesh>
        </group>
      );
    case "purifier":
      return (
        <group>
          <mesh castShadow position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.5, 24]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 24]} />
            <meshStandardMaterial 
              color={meshColor} 
              emissive={emissiveColor}
              emissiveIntensity={emissiveInt * 1.5}
            />
          </mesh>
        </group>
      );
    case "vacuum":
      return (
        <group>
          <mesh castShadow position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.09, 24]} />
            <meshStandardMaterial color={isOffline ? "#94a3b8" : "#334155"} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.01, -0.05]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial color={status === "warning" ? "#ff9f00" : status === "online" ? "#10b981" : "#ef4444"} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh castShadow>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color={meshColor} />
        </mesh>
      );
  }
};

// Smart device mesh placement
interface SmartDeviceProps {
  device: HomeDevice;
  themeColor: string;
}

const SmartDevice = observer(({ device, themeColor }: SmartDeviceProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = React.useState(false);
  
  const isSelected = dashboardStore.selectedNodeId === device.id;
  const colors = getThemeColors(themeColor);
  const statusColor = getStatusColor(device.status);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    if (groupRef.current && device.status !== "offline") {
      groupRef.current.position.y = device.position[1] + Math.sin(elapsed * 1.3 + device.position[0]) * 0.06;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    dashboardStore.selectNode(device.id);
  };

  return (
    <group>
      {/* Network Line linking back to base platform */}
      {device.status !== "offline" && (
        <Line
          points={[[0, -0.4, 0], device.position]}
          color={colors.primary}
          lineWidth={isSelected ? 1.5 : hovered ? 1.0 : 0.4}
          transparent
          opacity={isSelected ? 0.65 : hovered ? 0.35 : 0.15}
        />
      )}

      <group
        ref={groupRef}
        position={device.position}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          setHovered(false);
          e.stopPropagation();
        }}
      >
        {/* Selection Indicator Ring */}
        {isSelected && (
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
            <ringGeometry args={[0.42, 0.48, 32]} />
            <meshBasicMaterial 
              color={colors.primary} 
              transparent 
              opacity={0.85} 
              side={THREE.DoubleSide} 
            />
          </mesh>
        )}

        <group scale={hovered ? 1.12 : 1.0}>
          <DeviceMesh type={device.type} color={colors.primary} status={device.status} />
        </group>

        {/* Status Dot */}
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color={statusColor} />
        </mesh>

        {/* Hover Label */}
        {hovered && (
          <Html distanceFactor={6} position={[0, 0.75, 0]} center pointerEvents="none">
            <div className="px-2.5 py-1 text-[10px] font-sans font-bold bg-white border border-cozy-border-light text-cozy-text rounded-lg shadow-md flex items-center gap-1.5 animate-bounce-slow whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ backgroundColor: statusColor }} />
              <span>{device.name}</span>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
});

// Camera and target manager
const ControlAndCameraManager = observer(() => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [transitioning, setTransitioning] = React.useState(false);
  const lastSelectedNodeId = useRef<string | null>(null);
  const selectedNodeId = dashboardStore.selectedNodeId;
  const cameraFocusVersion = dashboardStore.cameraFocusVersion;
  const nodes = dashboardStore.nodes;
  
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const targetLookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const targetCamPos = useMemo(() => new THREE.Vector3(0, 3.2, 5.5), []);

  useEffect(() => {
    if (selectedNode) {
      const [x, y, z] = selectedNode.position;
      if (selectedNode.type === "robot") {
        targetLookAt.set(0, 0.18, 0);
        targetCamPos.set(0, 2.5, 4.8);
      } else {
        targetLookAt.set(x, y + 0.1, z);
        const dir = new THREE.Vector3(x, y, z).normalize();
        targetCamPos.set(
          x + dir.x * 1.8, 
          y + 1.2, 
          z + dir.z * 1.8
        );
      }
    }
  }, [selectedNode, targetLookAt, targetCamPos]);

  // Trigger camera transition when a node is selected or explicitly focused again
  useEffect(() => {
    if (
      selectedNodeId !== lastSelectedNodeId.current ||
      cameraFocusVersion > 0
    ) {
      setTransitioning(true);
      lastSelectedNodeId.current = selectedNodeId;
    }
  }, [cameraFocusVersion, selectedNodeId]);

  useFrame((state) => {
    if (controlsRef.current) {
      if (transitioning) {
        // Lerp Target & Camera Position
        controlsRef.current.target.lerp(targetLookAt, 0.08);
        state.camera.position.lerp(targetCamPos, 0.08);
        controlsRef.current.update();

        // Halt transitioning once we arrive within epsilon limits
        const distPos = state.camera.position.distanceTo(targetCamPos);
        const distLook = controlsRef.current.target.distanceTo(targetLookAt);

        if (distPos < 0.08 && distLook < 0.08) {
          state.camera.position.copy(targetCamPos);
          controlsRef.current.target.copy(targetLookAt);
          setTransitioning(false);
        }
      }
    }
  });

  // Stop camera transitions immediately when the user starts manipulating OrbitControls manually
  const handleInteractionStart = () => {
    setTransitioning(false);
  };

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      maxDistance={12}
      minDistance={1.8}
      makeDefault
      onStart={handleInteractionStart}
    />
  );
});

// Main Three.js Scene Stage Component
const ThreeScene = observer(() => {
  return (
    <div className="relative w-full h-full select-none">
      <Canvas
        shadows
        camera={{ position: [0, 3.2, 5.5], fov: 45 }}
        className="w-full h-full"
      >
        <color attach="background" args={["#f5ede0"]} />

        <ambientLight intensity={0.7} color="#fffcf5" />
        
        <directionalLight 
          position={[5, 8, 4]} 
          intensity={1.5} 
          color="#ffebdb" 
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={20}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />

        <pointLight position={[-6, 4, -4]} intensity={0.6} color="#d6cbff" />
        
        <gridHelper 
          args={[20, 20, "#cca580", "#ebd4be"]} 
          position={[0, -0.85, 0]} 
        />

        <mesh receiveShadow castShadow position={[0, -0.92, 0]}>
          <cylinderGeometry args={[2.5, 2.7, 0.15, 48]} />
          <meshStandardMaterial 
            color="#cca580" 
            roughness={0.65} 
            metalness={0.1} 
          />
        </mesh>

        <mesh position={[0, -0.84, 0]}>
          <cylinderGeometry args={[2.42, 2.42, 0.02, 48]} />
          <meshStandardMaterial 
            color="#e3bf9b" 
            roughness={0.8} 
          />
        </mesh>

        <Suspense fallback={<CanvasLoader />}>
          <RobotModel />
        </Suspense>

        {dashboardStore.nodes.map((device) => {
          if (device.type === "robot") return null;
          return (
            <SmartDevice 
              key={device.id} 
              device={device} 
              themeColor={dashboardStore.themeColor} 
            />
          );
        })}

        <spotLight 
          position={[0, 5, 0]} 
          intensity={0.8} 
          distance={8} 
          angle={Math.PI / 3}
          color="#ffeecc" 
        />

        <ControlAndCameraManager />
      </Canvas>
    </div>
  );
});

export default ThreeScene;
export { getThemeColors };
