// components/VrmViewer.tsx

import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from '@react-three/drei';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { loadMixamoAnimation } from '../lib/loadMixamoAnimation';
import { loadAnimationWithExpressions } from '../lib/loadAnimationWithExpressions';
import { 
  createApartmentEnvironment, 
  setupApartmentLighting, 
  setupApartmentBackground 
} from '../lib/apartmentEnvironment';
import { ChatBox } from './ChatBox';

// VRM model component
const VrmModel = ({ vrm }: { vrm: VRM }) => {
  useEffect(() => {
    return () => { VRMUtils.deepDispose(vrm.scene); };
  }, [vrm]);
  return <primitive object={vrm.scene} />;
};

// Animation manager component
const AnimationManager = ({ 
  vrmRef, 
  mixerRef 
}: { 
  vrmRef: React.RefObject<VRM | null>, 
  mixerRef: React.RefObject<THREE.AnimationMixer | null> 
}) => {
  useFrame((_, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
    if (vrmRef.current) vrmRef.current.update(delta);
  });
  return null;
};

// Apartment scene setup component
const ApartmentScene = () => {
  const { scene, gl } = useThree();

  useEffect(() => {
    // Setup apartment environment
    const apartment = createApartmentEnvironment(scene);
    
    // Setup lighting
    const lights = setupApartmentLighting(scene, gl);
    
    // Setup background
    const background = setupApartmentBackground(scene);

    // Cleanup
    return () => {
      scene.remove(apartment);
      apartment.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => mat.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      background.dispose();
    };
  }, [scene, gl]);

  return null;
};

// Expression presets
const EXPRESSION_PRESETS = {
  neutral: { happy: 0, angry: 0, sad: 0, relaxed: 0, surprised: 0 },
  happy: { happy: 1, angry: 0, sad: 0, relaxed: 0.3, surprised: 0 },
  angry: { happy: 0, angry: 1, sad: 0, relaxed: 0, surprised: 0 },
  sad: { happy: 0, angry: 0, sad: 1, relaxed: 0, surprised: 0 },
  surprised: { happy: 0, angry: 0, sad: 0, relaxed: 0, surprised: 1 },
  relaxed: { happy: 0.3, angry: 0, sad: 0, relaxed: 1, surprised: 0 },
};

// Main viewer component props
type VrmViewerProps = {
  animationFiles?: string[];
};

export const VrmViewer = ({ 
  animationFiles = [] 
}: VrmViewerProps) => {
  const [vrmUrl, setVrmUrl] = useState<string>('/models/VRM_Alicia.vrm');
  const [currentVrm, setCurrentVrm] = useState<VRM | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableExpressions, setAvailableExpressions] = useState<string[]>([]);
  const [expressionValues, setExpressionValues] = useState<Record<string, number>>({});
  const [showExpressionPanel, setShowExpressionPanel] = useState(false);
  const [showApartment, setShowApartment] = useState(true);
 const [isZoomedToFace, setIsZoomedToFace] = useState(false);
 
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const currentAction = useRef<THREE.AnimationAction | null>(null);
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const fbxInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  // Load VRM model
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setCurrentVrm(null);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(vrmUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          setError("Failed to get VRM data from loaded model.");
          setIsLoading(false);
          return;
        }
        VRMUtils.rotateVRM0(vrm);
vrm.scene.traverse((obj) => { obj.frustumCulled = false; });

// Position VRM in front of table
vrm.scene.position.set(0.5, 0, 1.5);  // Slightly right, in front of table

setCurrentVrm(vrm);
        mixer.current = new THREE.AnimationMixer(vrm.scene);
        
        // Get available expressions
        const expressions = Object.keys(vrm.expressionManager.expressionMap);
        setAvailableExpressions(expressions);
        
        // Initialize expression values
        const initialValues: Record<string, number> = {};
        expressions.forEach(expr => {
          initialValues[expr] = 0;
        });
        setExpressionValues(initialValues);
        
        setIsLoading(false);
      },
      undefined,
      (err) => {
        console.error(err);
        setError(`Failed to load model from ${vrmUrl}.`);
        setIsLoading(false);
      }
    );
  }, [vrmUrl]);

  // Handle animation loading
  const handleAnimation = useCallback(async (animationUrl: string) => {
    if (!currentVrm || !mixer.current) {
      alert('Please wait for a VRM model to finish loading.');
      return;
    }
    try {
      let clip: THREE.AnimationClip;
      
      if (animationUrl.endsWith('.fbx')) {
        clip = await loadMixamoAnimation(animationUrl, currentVrm);
      } else if (animationUrl.endsWith('.glb')) {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(animationUrl);
        clip = gltf.animations[0];
        if (!clip) {
          throw new Error("The GLB file does not contain any animations.");
        }
      } else {
        throw new Error(`Unsupported animation file format: ${animationUrl}`);
      }
      
      const newAction = mixer.current.clipAction(clip);
      newAction.reset();
      
      if (currentAction.current) {
        currentAction.current.crossFadeTo(newAction, 0.5, true).play();
      } else {
        newAction.play();
      }
      currentAction.current = newAction;

    } catch (e) {
      console.error(e);
      setError((e as Error).message);
    }
  }, [currentVrm]);

  // Load default idle animation after VRM loads
  useEffect(() => {
    if (currentVrm && mixer.current) {
      const loadDefaultAnimation = async () => {
        try {
          await handleAnimation('/animations/idle.fbx');
        } catch (error) {
          console.error('Failed to load default idle animation:', error);
        }
      };
      
      loadDefaultAnimation();
    }
  }, [currentVrm, handleAnimation]);

  // Handle expression value change
  const handleExpressionChange = useCallback((name: string, value: number) => {
    if (!currentVrm) return;
    
    currentVrm.expressionManager.setValue(name, value);
    setExpressionValues(prev => ({ ...prev, [name]: value }));
  }, [currentVrm]);

  // Apply expression preset
  const applyExpressionPreset = useCallback((presetName: keyof typeof EXPRESSION_PRESETS) => {
    if (!currentVrm) return;
    
    const preset = EXPRESSION_PRESETS[presetName];
    const newValues: Record<string, number> = { ...expressionValues };
    
    Object.entries(preset).forEach(([expr, value]) => {
      if (availableExpressions.includes(expr)) {
        currentVrm.expressionManager.setValue(expr, value);
        newValues[expr] = value;
      }
    });
    
    setExpressionValues(newValues);
  }, [currentVrm, availableExpressions, expressionValues]);

  // Reset all expressions
  const resetExpressions = useCallback(() => {
    if (!currentVrm) return;
    
    const newValues: Record<string, number> = {};
    availableExpressions.forEach(expr => {
      currentVrm.expressionManager.setValue(expr, 0);
      newValues[expr] = 0;
    });
    
    setExpressionValues(newValues);
  }, [currentVrm, availableExpressions]);
  
  // Unified handler for expressions, animations, and lip sync
  const handleAnimationControl = useCallback((
    type: 'expression' | 'animation' | 'viseme',
    name: string,
    value: number
  ) => {
    if (!currentVrm) return;
    
    if (type === 'expression') {
      // Apply facial expression with intensity
      applyExpressionPreset(name as keyof typeof EXPRESSION_PRESETS);
      // Scale by intensity
      Object.keys(EXPRESSION_PRESETS[name as keyof typeof EXPRESSION_PRESETS] || {}).forEach(expr => {
        if (availableExpressions.includes(expr)) {
          const presetValue = (EXPRESSION_PRESETS[name as keyof typeof EXPRESSION_PRESETS] as any)[expr];
          currentVrm.expressionManager.setValue(expr, presetValue * value);
        }
      });
    } else if (type === 'animation') {
      // Trigger body animation
      const animationPath = `/animations/${name}.fbx`;
      handleAnimation(animationPath);
    } else if (type === 'viseme') {
      // Apply lip sync viseme
      if (availableExpressions.includes(name)) {
        currentVrm.expressionManager.setValue(name, value);
      }
    }
  }, [currentVrm, availableExpressions, handleAnimation, applyExpressionPreset]);

    const toggleFaceZoom = useCallback(() => {
    setIsZoomedToFace(!isZoomedToFace);
  }, [isZoomedToFace]);

  // Handle file loading
  const handleFileLoad = useCallback(async (file: File) => {
    setError(null);
    const fileType = file.name.split('.').pop()?.toLowerCase();
    const url = URL.createObjectURL(file);

    if (fileType === 'vrm') {
      setVrmUrl(url);
      mixer.current = null;
      currentAction.current = null;
    } else if (fileType === 'fbx' || fileType === 'glb') {
      await handleAnimation(url);
      URL.revokeObjectURL(url);
    }
  }, [handleAnimation]);

  const handlePresetAnimationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const fileName = event.target.value;
    if (fileName) {
      const animationPath = `/animations/${fileName}`;
      handleAnimation(animationPath);
    }
  };

  // Drag and drop setup
  useEffect(() => {
    const dropzone = dropzoneRef.current;
    if (!dropzone) return;
    
    const handleDragOver = (event: DragEvent) => event.preventDefault();
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (file) handleFileLoad(file);
    };
    
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('drop', handleDrop);
    
    return () => {
      dropzone.removeEventListener('dragover', handleDragOver);
      dropzone.removeEventListener('drop', handleDrop);
    };
  }, [handleFileLoad]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileLoad(file);
    event.target.value = '';
  };

  return (
    <div ref={dropzoneRef} style={{ 
      width: '100vw', 
      height: '100vh', 
      background: '#333', 
      position: 'relative',
      overflow: 'hidden',
      margin: 0,
      padding: 0,
    }}>
      {/* Collapsible Control Panel */}
      <div style={{ 
        position: 'absolute', 
        top: 20, 
        left: 20, 
        zIndex: 100,
        fontFamily: 'sans-serif',
      }}>
        {!showExpressionPanel ? (
          // Collapsed state - single circular button
          <button 
            onClick={() => setShowExpressionPanel(true)}
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '0',
              borderRadius: '50%',
              width: '56px',
              height: '56px',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              isolation: 'isolate',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1) rotate(90deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            }}
          >
            ⚙️
          </button>
        ) : (
          // Expanded state - all controls
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            animation: 'slideIn 0.3s ease-out',
          }}>
            {/* Close Button */}
            <button 
              onClick={() => setShowExpressionPanel(false)}
              style={{
                background: 'rgba(244, 67, 54, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '0',
                borderRadius: '50px',
                padding: '12px 24px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                isolation: 'isolate',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              ✕ Close Menu
            </button>

            {/* Load VRM Button */}
            <button 
              onClick={() => vrmInputRef.current?.click()}
              style={{
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '0',
                borderRadius: '50px',
                padding: '12px 24px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                isolation: 'isolate',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.9)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span>📁</span> Load VRM
            </button>

            {/* Load Animation Button */}
            <button 
              onClick={() => fbxInputRef.current?.click()}
              style={{
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '0',
                borderRadius: '50px',
                padding: '12px 24px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                isolation: 'isolate',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.9)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span>🎬</span> Load Animation
            </button>

            {/* Preset Animations Dropdown */}
            {animationFiles.length > 0 && (
              <select 
                onChange={handlePresetAnimationChange} 
                defaultValue=""
                style={{
                  background: 'rgba(0, 0, 0, 0.7)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '0',
                  borderRadius: '50px',
                  padding: '12px 24px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                  isolation: 'isolate',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  outline: 'none',
                }}
              >
                <option value="" disabled>🎭 Preset Animations</option>
                {animationFiles.map((file) => (
                  <option key={file} value={file} style={{ background: '#1a1a1a' }}>
                    {file}
                  </option>
                ))}
              </select>
            )}

            {/* Face Zoom Toggle */}
            <button 
              onClick={toggleFaceZoom}
              style={{
                background: isZoomedToFace 
                  ? 'rgba(255, 152, 0, 0.8)' 
                  : 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '0',
                borderRadius: '50px',
                padding: '12px 24px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                isolation: 'isolate',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              🔍 {isZoomedToFace ? 'Zoom Out' : 'Face Zoom'}
            </button>

            {/* Status Messages */}
            {isLoading && (
              <div style={{
                background: 'rgba(33, 150, 243, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '0',
                borderRadius: '50px',
                padding: '12px 24px',
                color: 'white',
                fontSize: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                isolation: 'isolate',
              }}>
                ⏳ Loading...
              </div>
            )}
            {error && (
              <div style={{
                background: 'rgba(244, 67, 54, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '0',
                borderRadius: '50px',
                padding: '12px 24px',
                color: 'white',
                fontSize: '12px',
                maxWidth: '300px',
                wordWrap: 'break-word',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                isolation: 'isolate',
              }}>
                ❌ {error}
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>
      </div>

      {/* Expression Panel */}
      {showExpressionPanel && currentVrm && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 100,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '15px',
          borderRadius: '5px',
          fontFamily: 'sans-serif',
          maxWidth: '350px',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '15px', fontSize: '16px' }}>
            🎭 Expression Controls
          </div>

          {/* Expression Presets */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Quick Presets:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
              {Object.keys(EXPRESSION_PRESETS).map((presetName) => (
                <button
                  key={presetName}
                  onClick={() => applyExpressionPreset(presetName as keyof typeof EXPRESSION_PRESETS)}
                  style={{
                    padding: '8px 5px',
                    cursor: 'pointer',
                    background: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '11px',
                    textTransform: 'capitalize'
                  }}
                >
                  {presetName}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={resetExpressions}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '15px',
              cursor: 'pointer',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              fontSize: '12px'
            }}
          >
            Reset All Expressions
          </button>

          {/* Individual Expression Sliders */}
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
            Manual Controls:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {availableExpressions.map((expr) => (
              <div key={expr}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '3px',
                  fontSize: '11px'
                }}>
                  <span style={{ fontWeight: 'bold' }}>{expr}</span>
                  <span>{(expressionValues[expr] || 0).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={expressionValues[expr] || 0}
                  onChange={(e) => handleExpressionChange(expr, parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>

          {availableExpressions.length === 0 && (
            <div style={{ color: '#999', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
              No expressions available for this model
            </div>
          )}
        </div>
      )}

      {/* Hidden File Inputs */}
      <input 
        type="file" 
        accept=".vrm" 
        ref={vrmInputRef} 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
      />
      <input 
        type="file" 
        accept=".fbx,.glb" 
        ref={fbxInputRef} 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
      />
      <ChatBox onExpressionChange={handleAnimationControl} />

      {/* 3D Canvas */}
      <Canvas 
        camera={{ 
          position: isZoomedToFace ? [0.5, 1.4, 2.2] : [0.5, 1.2, 2.5], // Changed from [0, 1.5, 4]
          fov: 50 
        }}
         shadows
        gl={{ 
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0
        }}
      >
        <ApartmentScene />
        {currentVrm && <VrmModel vrm={currentVrm} />}
        <OrbitControls 
           target={isZoomedToFace ? [0.5, 1.4, 1.5] : [0.5, 1.0, 1.5]} // Changed from [0, 1, 0]
           maxDistance={isZoomedToFace ? 2 : 4} // Changed from 8
           minDistance={isZoomedToFace ? 0.5 : 1.5} // Changed to prevent getting too close
           maxPolarAngle={Math.PI / 1.8}
           enablePan={!isZoomedToFace}
         />
        <AnimationManager vrmRef={{ current: currentVrm }} mixerRef={mixer} />
      </Canvas>
    </div>
  );
};