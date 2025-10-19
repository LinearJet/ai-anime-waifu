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
import { 
  Settings, 
  Upload, 
  Film, 
  X, 
  ZoomIn,
  Smile,
  Frown,
  Meh,
  AlertCircle,
  Loader2
} from 'lucide-react';

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
  const [showControlPanel, setShowControlPanel] = useState(false);
 
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
      background: '#0a0a0a', 
      position: 'relative',
      overflow: 'hidden',
      margin: 0,
      padding: 0,
    }}>
      {/* Collapsible Control Panel */}
      <div style={{ 
        position: 'absolute', 
        top: '16px', 
        left: '16px', 
        zIndex: 100,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        {!showControlPanel ? (
          // Collapsed state - single button
          <button 
            onClick={() => setShowControlPanel(true)}
            style={{
              background: 'hsl(240 3.7% 15.9%)',
              border: '1px solid hsl(240 3.7% 15.9%)',
              borderRadius: '12px',
              width: '44px',
              height: '44px',
              color: 'hsl(210 40% 98%)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'hsl(240 3.7% 20%)';
              e.currentTarget.style.borderColor = 'hsl(240 3.7% 25%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'hsl(240 3.7% 15.9%)';
              e.currentTarget.style.borderColor = 'hsl(240 3.7% 15.9%)';
            }}
          >
            <Settings size={20} />
          </button>
        ) : (
          // Expanded state - all controls
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            animation: 'slideIn 0.3s ease-out',
            maxWidth: 'calc(100vw - 32px)',
          }}>
            {/* Close Button */}
            <button 
              onClick={() => setShowControlPanel(false)}
              style={{
                background: 'hsl(0 84.2% 60.2%)',
                border: '1px solid hsl(0 84.2% 60.2%)',
                borderRadius: '12px',
                padding: '10px 16px',
                color: 'hsl(210 40% 98%)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'hsl(0 84.2% 55%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'hsl(0 84.2% 60.2%)';
              }}
            >
              <X size={16} /> Close
            </button>

            {/* Load VRM Button */}
            <button 
              onClick={() => vrmInputRef.current?.click()}
              style={{
                background: 'hsl(240 3.7% 15.9%)',
                border: '1px solid hsl(240 3.7% 15.9%)',
                borderRadius: '12px',
                padding: '10px 16px',
                color: 'hsl(210 40% 98%)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'hsl(240 3.7% 20%)';
                e.currentTarget.style.borderColor = 'hsl(240 3.7% 25%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'hsl(240 3.7% 15.9%)';
                e.currentTarget.style.borderColor = 'hsl(240 3.7% 15.9%)';
              }}
            >
              <Upload size={16} /> Load VRM
            </button>

            {/* Load Animation Button */}
            <button 
              onClick={() => fbxInputRef.current?.click()}
              style={{
                background: 'hsl(240 3.7% 15.9%)',
                border: '1px solid hsl(240 3.7% 15.9%)',
                borderRadius: '12px',
                padding: '10px 16px',
                color: 'hsl(210 40% 98%)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'hsl(240 3.7% 20%)';
                e.currentTarget.style.borderColor = 'hsl(240 3.7% 25%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'hsl(240 3.7% 15.9%)';
                e.currentTarget.style.borderColor = 'hsl(240 3.7% 15.9%)';
              }}
            >
              <Film size={16} /> Load Animation
            </button>

            {/* Preset Animations Dropdown */}
            {animationFiles.length > 0 && (
              <div style={{ position: 'relative' }}>
                <select 
                  onChange={handlePresetAnimationChange} 
                  defaultValue=""
                  style={{
                    background: 'hsl(240 3.7% 15.9%)',
                    border: '1px solid hsl(240 3.7% 15.9%)',
                    borderRadius: '12px',
                    padding: '10px 16px',
                    paddingRight: '32px',
                    color: 'hsl(210 40% 98%)',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                    width: '100%',
                    appearance: 'none',
                    outline: 'none',
                  }}
                >
                  <option value="" disabled>Preset Animations</option>
                  {animationFiles.map((file) => (
                    <option key={file} value={file} style={{ background: 'hsl(240 3.7% 15.9%)' }}>
                      {file}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Face Zoom Toggle */}
            <button 
              onClick={toggleFaceZoom}
              style={{
                background: isZoomedToFace 
                  ? 'hsl(217.2 91.2% 59.8%)' 
                  : 'hsl(240 3.7% 15.9%)',
                border: '1px solid',
                borderColor: isZoomedToFace
                  ? 'hsl(217.2 91.2% 59.8%)'
                  : 'hsl(240 3.7% 15.9%)',
                borderRadius: '12px',
                padding: '10px 16px',
                color: 'hsl(210 40% 98%)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              onMouseEnter={(e) => {
                if (isZoomedToFace) {
                  e.currentTarget.style.background = 'hsl(217.2 91.2% 55%)';
                } else {
                  e.currentTarget.style.background = 'hsl(240 3.7% 20%)';
                  e.currentTarget.style.borderColor = 'hsl(240 3.7% 25%)';
                }
              }}
              onMouseLeave={(e) => {
                if (isZoomedToFace) {
                  e.currentTarget.style.background = 'hsl(217.2 91.2% 59.8%)';
                } else {
                  e.currentTarget.style.background = 'hsl(240 3.7% 15.9%)';
                  e.currentTarget.style.borderColor = 'hsl(240 3.7% 15.9%)';
                }
              }}
            >
              <ZoomIn size={16} /> {isZoomedToFace ? 'Zoom Out' : 'Face Zoom'}
            </button>

            {/* Expression Panel Toggle */}
            {currentVrm && (
              <button 
                onClick={() => setShowExpressionPanel(!showExpressionPanel)}
                style={{
                  background: showExpressionPanel 
                    ? 'hsl(142.1 76.2% 36.3%)' 
                    : 'hsl(240 3.7% 15.9%)',
                  border: '1px solid',
                  borderColor: showExpressionPanel
                    ? 'hsl(142.1 76.2% 36.3%)'
                    : 'hsl(240 3.7% 15.9%)',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  color: 'hsl(210 40% 98%)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                }}
                onMouseEnter={(e) => {
                  if (showExpressionPanel) {
                    e.currentTarget.style.background = 'hsl(142.1 76.2% 32%)';
                  } else {
                    e.currentTarget.style.background = 'hsl(240 3.7% 20%)';
                    e.currentTarget.style.borderColor = 'hsl(240 3.7% 25%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (showExpressionPanel) {
                    e.currentTarget.style.background = 'hsl(142.1 76.2% 36.3%)';
                  } else {
                    e.currentTarget.style.background = 'hsl(240 3.7% 15.9%)';
                    e.currentTarget.style.borderColor = 'hsl(240 3.7% 15.9%)';
                  }
                }}
              >
                <Smile size={16} /> {showExpressionPanel ? 'Hide' : 'Show'} Expressions
              </button>
            )}

            {/* Status Messages */}
            {isLoading && (
              <div style={{
                background: 'hsl(217.2 91.2% 59.8%)',
                border: '1px solid hsl(217.2 91.2% 59.8%)',
                borderRadius: '12px',
                padding: '10px 16px',
                color: 'hsl(210 40% 98%)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
              </div>
            )}
            {error && (
              <div style={{
                background: 'hsl(0 84.2% 60.2%)',
                border: '1px solid hsl(0 84.2% 60.2%)',
                borderRadius: '12px',
                padding: '10px 16px',
                color: 'hsl(210 40% 98%)',
                fontSize: '11px',
                maxWidth: '280px',
                wordWrap: 'break-word',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expression Panel - Mobile Optimized */}
      {showExpressionPanel && currentVrm && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 100,
          background: 'hsl(240 3.7% 15.9%)',
          border: '1px solid hsl(240 3.7% 15.9%)',
          padding: '16px',
          borderRadius: '12px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          maxWidth: 'min(320px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{ 
            fontWeight: '600', 
            marginBottom: '16px', 
            fontSize: '14px',
            color: 'hsl(210 40% 98%)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Smile size={16} /> Expression Controls
          </div>

          {/* Expression Presets */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '11px', 
              color: 'hsl(240 5% 64.9%)', 
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              Quick Presets
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', 
              gap: '6px' 
            }}>
              {Object.keys(EXPRESSION_PRESETS).map((presetName) => {
                const IconMap: Record<string, any> = {
                  happy: Smile,
                  sad: Frown,
                  neutral: Meh,
                  angry: AlertCircle,
                  surprised: AlertCircle,
                  relaxed: Smile
                };
                const Icon = IconMap[presetName] || Smile;
                
                return (
                  <button
                    key={presetName}
                    onClick={() => applyExpressionPreset(presetName as keyof typeof EXPRESSION_PRESETS)}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      background: 'hsl(217.2 32.6% 17.5%)',
                      color: 'hsl(210 40% 98%)',
                      border: '1px solid hsl(217.2 32.6% 17.5%)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '500',
                      textTransform: 'capitalize',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'hsl(217.2 32.6% 22%)';
                      e.currentTarget.style.borderColor = 'hsl(217.2 32.6% 27%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'hsl(217.2 32.6% 17.5%)';
                      e.currentTarget.style.borderColor = 'hsl(217.2 32.6% 17.5%)';
                    }}
                  >
                    <Icon size={12} />
                    {presetName}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={resetExpressions}
            style={{
              width: '100%',
              padding: '8px 12px',
              marginBottom: '16px',
              cursor: 'pointer',
              background: 'hsl(0 84.2% 60.2%)',
              color: 'hsl(210 40% 98%)',
              border: '1px solid hsl(0 84.2% 60.2%)',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'hsl(0 84.2% 55%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'hsl(0 84.2% 60.2%)';
            }}
          >
            Reset All
          </button>

          {/* Individual Expression Sliders */}
          <div style={{ 
            fontSize: '11px', 
            color: 'hsl(240 5% 64.9%)', 
            marginBottom: '12px',
            fontWeight: '500'
          }}>
            Manual Controls
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {availableExpressions.map((expr) => (
              <div key={expr}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '6px',
                  fontSize: '11px',
                  color: 'hsl(210 40% 98%)'
                }}>
                  <span style={{ fontWeight: '600' }}>{expr}</span>
                  <span style={{ 
                    color: 'hsl(240 5% 64.9%)',
                    fontFamily: 'monospace',
                    fontSize: '10px'
                  }}>
                    {(expressionValues[expr] || 0).toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={expressionValues[expr] || 0}
                  onChange={(e) => handleExpressionChange(expr, parseFloat(e.target.value))}
                  style={{ 
                    width: '100%',
                    height: '6px',
                    borderRadius: '3px',
                    appearance: 'none',
                    background: 'hsl(240 3.7% 20%)',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>

          {availableExpressions.length === 0 && (
            <div style={{ 
              color: 'hsl(240 5% 64.9%)', 
              fontSize: '11px', 
              textAlign: 'center', 
              padding: '20px' 
            }}>
              No expressions available
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
          position: isZoomedToFace ? [0.5, 1.4, 2.2] : [0.5, 1.2, 2.5],
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
          target={isZoomedToFace ? [0.5, 1.4, 1.5] : [0.5, 1.0, 1.5]}
          maxDistance={isZoomedToFace ? 2 : 4}
          minDistance={isZoomedToFace ? 0.5 : 1.5}
          maxPolarAngle={Math.PI / 1.8}
          enablePan={!isZoomedToFace}
        />
        <AnimationManager vrmRef={{ current: currentVrm }} mixerRef={mixer} />
      </Canvas>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Custom range slider styling */
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: hsl(210 40% 98%);
          cursor: pointer;
          border: 2px solid hsl(217.2 32.6% 17.5%);
        }

        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: hsl(210 40% 98%);
          cursor: pointer;
          border: 2px solid hsl(217.2 32.6% 17.5%);
        }

        /* Scrollbar styling */
        div::-webkit-scrollbar {
          width: 8px;
        }

        div::-webkit-scrollbar-track {
          background: hsl(240 3.7% 15.9%);
          border-radius: 4px;
        }

        div::-webkit-scrollbar-thumb {
          background: hsl(240 5% 26%);
          border-radius: 4px;
        }

        div::-webkit-scrollbar-thumb:hover {
          background: hsl(240 5% 34%);
        }
      `}</style>
    </div>
  );
};