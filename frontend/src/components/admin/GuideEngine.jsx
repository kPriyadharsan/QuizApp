import React, { createContext, useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GUIDE_REGISTRY } from './GuideRegistry';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

const GuideContext = createContext(null);

export const useGuide = () => useContext(GuideContext);

export const GuideProvider = ({ children }) => {
    const [activeGuide, setActiveGuide] = useState(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [coords, setCoords] = useState(null);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const [validationError, setValidationError] = useState('');

    // Load persisted tutorial state on load
    useEffect(() => {
        const saved = localStorage.getItem('xo_quiz_guide_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.activeGuide && parsed.stepIndex !== undefined && !parsed.completed) {
                    setActiveGuide(parsed.activeGuide);
                    setCurrentStepIndex(parsed.stepIndex);
                    setShowResumePrompt(true);
                }
            } catch (e) {
                console.error('Could not restore tutorial state:', e);
            }
        }
    }, []);

    // Save state on change
    const saveState = (guide, index, completed = false) => {
        if (guide) {
            localStorage.setItem('xo_quiz_guide_state', JSON.stringify({
                activeGuide: guide,
                stepIndex: index,
                completed
            }));
        } else {
            localStorage.removeItem('xo_quiz_guide_state');
        }
    };

    const startGuide = (guideId) => {
        if (GUIDE_REGISTRY[guideId]) {
            setActiveGuide(guideId);
            setCurrentStepIndex(0);
            setValidationError('');
            saveState(guideId, 0);
        }
    };

    const stopGuide = (completed = false) => {
        saveState(activeGuide, currentStepIndex, completed);
        setActiveGuide(null);
        setCurrentStepIndex(0);
        setCoords(null);
        setValidationError('');
    };

    const handleNext = () => {
        const guide = GUIDE_REGISTRY[activeGuide];
        const step = guide.steps[currentStepIndex];

        // Validate user action if required
        if (step.required) {
            const el = document.querySelector(step.target);
            if (el) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (!el.value.trim()) {
                        setValidationError('Please enter a value before proceeding.');
                        return;
                    }
                } else if (el.tagName === 'SELECT') {
                    if (!el.value) {
                        setValidationError('Please select an option before proceeding.');
                        return;
                    }
                }
            }
        }

        setValidationError('');
        if (currentStepIndex < guide.steps.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
            saveState(activeGuide, currentStepIndex + 1);
        } else {
            stopGuide(true);
            alert(`🎉 Tutorial completed: ${guide.title}!`);
        }
    };

    const handleBack = () => {
        setValidationError('');
        if (currentStepIndex > 0) {
            setCurrentStepIndex(currentStepIndex - 1);
            saveState(activeGuide, currentStepIndex - 1);
        }
    };

    // Track active highlighted target element bounding boxes
    useEffect(() => {
        if (!activeGuide) return;
        const guide = GUIDE_REGISTRY[activeGuide];
        const step = guide?.steps[currentStepIndex];
        if (!step) return;

        const updateCoords = () => {
            const el = document.querySelector(step.target);
            if (el) {
                const rect = el.getBoundingClientRect();
                setCoords({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                });
            } else {
                setCoords(null); // Fallback: center overlay
            }
        };

        updateCoords();
        const interval = setInterval(updateCoords, 300); // Poll slightly faster in case of late rendering
        window.addEventListener('resize', updateCoords, { passive: true });
        window.addEventListener('scroll', updateCoords, { capture: true, passive: true });

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', updateCoords, { passive: true });
            window.removeEventListener('scroll', updateCoords, { capture: true });
        };
    }, [activeGuide, currentStepIndex]);

    // Listen to ESC key to close tour
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && activeGuide) {
                stopGuide(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeGuide]);

    // Calculate dynamic floating tooltip placement coordinates
    const getTooltipStyles = () => {
        if (!coords) {
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 3500
            };
        }

        const padding = 20; // 20px gap to prevent overlap
        const tooltipWidth = 420;
        const tooltipHeight = 220; // Estimated height for clamping vertical limits
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const step = GUIDE_REGISTRY[activeGuide]?.steps[currentStepIndex];
        let position = step?.position || 'bottom';

        // Collision Check: Auto-adjust position if it overflows the viewport or overlaps the target
        if (position === 'left' && coords.left - tooltipWidth - padding < 20) {
            // Not enough space on the left -> Try right, else bottom
            if (coords.left + coords.width + tooltipWidth + padding < viewportWidth - 20) {
                position = 'right';
            } else {
                position = 'bottom';
            }
        } else if (position === 'right' && coords.left + coords.width + tooltipWidth + padding > viewportWidth - 20) {
            // Not enough space on the right -> Try left, else bottom
            if (coords.left - tooltipWidth - padding > 20) {
                position = 'left';
            } else {
                position = 'bottom';
            }
        }

        // Vertical collision adjustments for top/bottom positions
        if (position === 'bottom' && coords.top + coords.height + tooltipHeight + padding > viewportHeight) {
            // Not enough space on bottom -> Try top
            if (coords.top - tooltipHeight - padding > 20) {
                position = 'top';
            }
        } else if (position === 'top' && coords.top - tooltipHeight - padding < 20) {
            // Not enough space on top -> Try bottom
            if (coords.top + coords.height + tooltipHeight + padding < viewportHeight) {
                position = 'bottom';
            }
        }

        // Return coordinates based on finalized position
        if (position === 'bottom') {
            return {
                position: 'fixed',
                top: coords.top + coords.height + padding,
                left: Math.max(20, Math.min(viewportWidth - tooltipWidth - 20, coords.left + coords.width / 2 - tooltipWidth / 2)),
                zIndex: 3500
            };
        }
        if (position === 'top') {
            return {
                position: 'fixed',
                top: coords.top - padding,
                left: Math.max(20, Math.min(viewportWidth - tooltipWidth - 20, coords.left + coords.width / 2 - tooltipWidth / 2)),
                transform: 'translateY(-100%)',
                zIndex: 3500
            };
        }
        if (position === 'left') {
            return {
                position: 'fixed',
                top: Math.max(20, Math.min(viewportHeight - tooltipHeight - 20, coords.top + coords.height / 2 - tooltipHeight / 2)),
                left: coords.left - tooltipWidth - padding,
                zIndex: 3500
            };
        }
        if (position === 'right') {
            return {
                position: 'fixed',
                top: Math.max(20, Math.min(viewportHeight - tooltipHeight - 20, coords.top + coords.height / 2 - tooltipHeight / 2)),
                left: coords.left + coords.width + padding,
                zIndex: 3500
            };
        }
    };

    const renderProgressDots = () => {
        const steps = GUIDE_REGISTRY[activeGuide]?.steps || [];
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {steps.map((_, idx) => (
                    <React.Fragment key={idx}>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: idx <= currentStepIndex ? 'var(--brand-accent)' : 'rgba(0,0,0,0.1)',
                            transition: 'all 0.3s ease'
                        }} />
                        {idx < steps.length - 1 && (
                            <div style={{
                                width: 14, height: 2,
                                background: idx < currentStepIndex ? 'var(--brand-accent)' : 'rgba(0,0,0,0.06)'
                            }} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    return (
        <GuideContext.Provider value={{ activeGuide, currentStepIndex, startGuide, stopGuide }}>
            {children}

            {/* Resume tutorial pop-up dialogue box rendered via portal */}
            {showResumePrompt && createPortal(
                <div style={{
                    position: 'fixed', bottom: 20, right: 20, zIndex: 4000,
                    background: 'white', border: '1px solid rgba(108,99,255,0.15)',
                    padding: '16px 20px', borderRadius: 16, width: 320,
                    boxShadow: '0 10px 30px rgba(108,99,255,0.1)',
                    display: 'flex', flexDirection: 'column', gap: 12
                }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        📖 Continue tutorial?
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                        You left off in the middle of a tutorial. Would you like to resume?
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => {
                                setShowResumePrompt(false);
                                stopGuide(false);
                            }}
                            style={{
                                padding: '6px 12px', border: 'none', background: '#f1f5f9',
                                color: '#475569', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                            }}
                        >
                            Reset
                        </button>
                        <button
                            onClick={() => setShowResumePrompt(false)}
                            style={{
                                padding: '6px 14px', border: 'none', background: 'var(--brand-accent)',
                                color: 'white', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(108,99,255,0.2)'
                            }}
                        >
                            Resume
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* Overlay components rendering via react portals */}
            {createPortal(
                <AnimatePresence>
                    {activeGuide && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            width: '100vw', height: '100vh',
                            pointerEvents: 'none', zIndex: 3000
                        }}>
                            {/* Dark backdrop overlay containing SVG spotlight cut-out mask (allows click-through to targets) */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{
                                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                                    background: 'rgba(10, 10, 20, 0.45)', pointerEvents: 'none',
                                    zIndex: 3100
                                }}
                            >
                                {coords && (
                                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                                        <defs>
                                            <mask id="spotlight-mask">
                                                <rect width="100%" height="100%" fill="white" />
                                                {/* Spotlight hole */}
                                                <rect
                                                    x={coords.left - 6}
                                                    y={coords.top - 6}
                                                    width={coords.width + 12}
                                                    height={coords.height + 12}
                                                    rx={10}
                                                    ry={10}
                                                    fill="black"
                                                />
                                            </mask>
                                        </defs>
                                        <rect width="100%" height="100%" fill="rgba(10, 10, 20, 0.45)" mask="url(#spotlight-mask)" />
                                    </svg>
                                )}
                            </motion.div>

                            {/* Spotlight outer neon glowing boundary ring */}
                            {coords && (
                                <motion.div
                                    animate={{
                                        top: coords.top - 8,
                                        left: coords.left - 8,
                                        width: coords.width + 16,
                                        height: coords.height + 16
                                    }}
                                    transition={{ type: 'spring', damping: 24, stiffness: 120 }}
                                    style={{
                                        position: 'fixed',
                                        borderRadius: 12,
                                        border: '2px solid var(--brand-accent)',
                                        boxShadow: '0 0 20px rgba(108,99,255,0.4)',
                                        pointerEvents: 'none',
                                        zIndex: 3200
                                    }}
                                />
                            )}

                            {/* Floating Tooltip Bubble */}
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                style={{
                                    ...getTooltipStyles(),
                                    width: 420,
                                    background: 'white',
                                    border: '1px solid rgba(0,0,0,0.03)',
                                    padding: 24,
                                    borderRadius: 20,
                                    boxShadow: '0 20px 45px rgba(0,0,0,0.14)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 14,
                                    pointerEvents: 'auto'
                                }}
                            >
                                {/* Title & Close */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        {GUIDE_REGISTRY[activeGuide]?.title}
                                    </div>
                                    <button
                                        onClick={() => stopGuide(false)}
                                        style={{ background: 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', padding: 6, borderRadius: '50%' }}
                                    >
                                        <X size={14} color="#718096" />
                                    </button>
                                </div>

                                {/* Description */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <h4 style={{ fontSize: 15.5, fontWeight: 900, color: 'var(--color-text-primary)', margin: 0 }}>
                                        {GUIDE_REGISTRY[activeGuide]?.steps[currentStepIndex]?.title}
                                    </h4>
                                    <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55, margin: 0 }}>
                                        {GUIDE_REGISTRY[activeGuide]?.steps[currentStepIndex]?.description}
                                    </p>
                                    {GUIDE_REGISTRY[activeGuide]?.steps[currentStepIndex]?.whyItMatters && (
                                        <p style={{ fontSize: 11, color: 'var(--brand-accent)', margin: '4px 0 0 0', display: 'flex', gap: 4, alignItems: 'center' }}>
                                            💡 <span style={{ fontStyle: 'italic' }}>{GUIDE_REGISTRY[activeGuide]?.steps[currentStepIndex]?.whyItMatters}</span>
                                        </p>
                                    )}
                                </div>

                                {/* User action waiting indicators */}
                                {validationError && (
                                    <div style={{ fontSize: 11.5, color: 'var(--color-danger)', fontWeight: 600 }}>
                                        ⚠️ {validationError}
                                    </div>
                                )}

                                {/* Progress & Controls */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                                    {renderProgressDots()}

                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            disabled={currentStepIndex === 0}
                                            onClick={handleBack}
                                            style={{
                                                padding: '6px 12px', border: '1px solid rgba(0,0,0,0.08)',
                                                background: 'white', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                                                cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                                                opacity: currentStepIndex === 0 ? 0.4 : 1,
                                                display: 'flex', alignItems: 'center', gap: 4
                                            }}
                                        >
                                            <ArrowLeft size={12} /> Back
                                        </button>
                                        <button
                                            onClick={handleNext}
                                            style={{
                                                padding: '6px 14px', border: 'none',
                                                background: 'var(--brand-accent)', color: 'white',
                                                borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: 4,
                                                boxShadow: '0 2px 6px rgba(108,99,255,0.2)'
                                            }}
                                        >
                                            {currentStepIndex === (GUIDE_REGISTRY[activeGuide]?.steps.length - 1) ? 'Finish' : 'Next'} <ArrowRight size={12} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </GuideContext.Provider>
    );
};
