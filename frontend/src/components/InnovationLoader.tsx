import { motion } from 'framer-motion';

interface InnovationLoaderProps {
    scale?: number;
}

export const InnovationLoader = ({ scale = 1 }: InnovationLoaderProps) => {
    // scale-adjusted parameters
    const sizeBase = 40 * scale;
    const containerSize = 60 * scale;

    // Orbital configurations - Solid colors, high-fidelity glows
    const orbs = [
        { id: 1, duration: 2.8, size: 5 * scale, color: 'var(--color-primary)', delay: 0, xRange: [22 * scale, 0, -22 * scale, 0, 22 * scale], yRange: [0, 8 * scale, 0, -8 * scale, 0], zRange: [15 * scale, 0, -15 * scale, 0, 15 * scale] },
        { id: 2, duration: 4.5, size: 4 * scale, color: 'var(--color-primary)', delay: -0.5, xRange: [14 * scale, -14 * scale, 14 * scale], yRange: [-20 * scale, 20 * scale, -20 * scale], zRange: [10 * scale, -10 * scale, 10 * scale] },
        { id: 3, duration: 3.2, size: 3 * scale, color: 'var(--color-primary)', delay: -1.2, xRange: [-18 * scale, 18 * scale, -18 * scale], yRange: [12 * scale, -12 * scale, 12 * scale], zRange: [18 * scale, -18 * scale, 18 * scale] },
        { id: 4, duration: 6.0, size: 4 * scale, color: 'var(--color-primary)', delay: -2.0, xRange: [0, 20 * scale, 0, -20 * scale, 0], yRange: [20 * scale, 0, -20 * scale, 0, 20 * scale], zRange: [0, 20 * scale, 0, -20 * scale, 0] },
    ];

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: containerSize,
            height: containerSize,
            perspective: '1200px'
        }}>
            <div style={{
                position: 'relative',
                width: sizeBase,
                height: sizeBase,
                transformStyle: 'preserve-3d'
            }}>
                {/* Global Plane Rotation (Subtle 3D tilt) */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    transformStyle: 'preserve-3d',
                    transform: 'rotateX(20deg) rotateZ(10deg)'
                }}>

                    {/* FIXED Planetary Core: Solid Sphere, No individual rotation */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: 12 * scale,
                        height: 12 * scale,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        transform: 'translate(-50%, -50%)',
                        boxShadow: `0 0 ${15 * scale}px var(--color-primary)`,
                        zIndex: 10
                    }} />

                    {/* Orbital Aura Ring (Fixed reference) */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: 28 * scale,
                        height: 28 * scale,
                        borderRadius: '50%',
                        border: '1px solid var(--color-primary)',
                        opacity: 0.1,
                        transform: 'translate(-50%, -50%) rotateX(70deg)'
                    }} />

                    {/* Planetary Orbs: Independent high-fidelity orbits */}
                    {orbs.map((orb) => (
                        <motion.div
                            key={orb.id}
                            style={{
                                position: 'absolute',
                                width: orb.size,
                                height: orb.size,
                                borderRadius: '50%',
                                background: orb.color,
                                top: '50%',
                                left: '50%',
                                marginLeft: -orb.size / 2,
                                marginTop: -orb.size / 2,
                                boxShadow: `0 0 ${orb.size * 3}px ${orb.color}`,
                                filter: 'brightness(1.3)',
                                opacity: 1 // Max clarity/HD
                            }}
                            animate={{
                                x: orb.xRange,
                                y: orb.yRange,
                                z: orb.zRange,
                                scale: [1, 1.2, 1, 0.8, 1],
                            }}
                            transition={{
                                duration: orb.duration,
                                repeat: Infinity,
                                ease: "linear",
                                delay: orb.delay
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
