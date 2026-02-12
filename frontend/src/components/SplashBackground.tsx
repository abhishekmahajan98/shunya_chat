import { motion } from 'framer-motion';

const AtomicSystem = ({ size, top, left, delay = 0, opacity = 0.05, blueprint = false }: { size: number, top: string, left: string, delay?: number, opacity?: number, blueprint?: boolean }) => {
    const orbs = [
        { id: 1, duration: 25, xRange: [size / 2, 0, -size / 2, 0, size / 2], yRange: [0, size / 4, 0, -size / 4, 0] },
        { id: 2, duration: 30, xRange: [size / 3, -size / 3, size / 3], yRange: [-size / 2, size / 2, -size / 2] },
        { id: 3, duration: 35, xRange: [-size / 2.5, size / 2.5, -size / 2.5], yRange: [size / 2.5, -size / 2.5, size / 2.5] },
        { id: 4, duration: 40, xRange: [0, size / 2, 0, -size / 2, 0], yRange: [size / 2, 0, -size / 2, 0, size / 2] },
    ];

    return (
        <div style={{
            position: 'absolute',
            top,
            left,
            width: size,
            height: size,
            transform: 'translate(-50%, -50%)',
            perspective: '2000px',
            pointerEvents: 'none',
            zIndex: 1
        }}>
            <motion.div
                style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d' }}
                animate={{ rotateY: 360, rotateX: [10, 20, 10] }}
                transition={{ duration: 80, repeat: Infinity, ease: "linear", delay }}
            >
                {/* Orbital Paths (Blueprint Style) */}
                {orbs.map(orb => (
                    <motion.div
                        key={orb.id}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            border: `0.5px ${blueprint ? 'dashed' : 'solid'} var(--color-primary)`,
                            opacity: blueprint ? 0.08 : 0,
                            transform: `rotateX(${orb.duration * 5}deg) rotateZ(${orb.id * 45}deg)`,
                            transformStyle: 'preserve-3d'
                        }}
                    />
                ))}

                {!blueprint && (
                    <>
                        {/* Core Glow */}
                        <motion.div
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                width: size * 0.4,
                                height: size * 0.4,
                                background: 'var(--color-primary)',
                                borderRadius: '50%',
                                filter: 'blur(60px)',
                                opacity: opacity * 2,
                                transform: 'translate(-50%, -50%)'
                            }}
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                        />

                        {/* Solid Orbs */}
                        {orbs.map(orb => (
                            <motion.div
                                key={orb.id}
                                style={{
                                    position: 'absolute',
                                    width: 4,
                                    height: 4,
                                    borderRadius: '50%',
                                    background: 'var(--color-primary)',
                                    top: '50%',
                                    left: '50%',
                                    boxShadow: `0 0 15px var(--color-primary)`,
                                    opacity: opacity * 4
                                }}
                                animate={{
                                    x: orb.xRange,
                                    y: orb.yRange,
                                    z: orb.xRange.map(v => v * 0.5),
                                }}
                                transition={{
                                    duration: orb.duration,
                                    repeat: Infinity,
                                    ease: "linear",
                                    delay: delay - (orb.id * 2)
                                }}
                            />
                        ))}
                    </>
                )}
            </motion.div>
        </div>
    );
};

interface SplashBackgroundProps {
    mode?: 'immersive' | 'plain' | 'blueprint';
}

export const SplashBackground = ({ mode = 'immersive' }: SplashBackgroundProps) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            background: 'var(--color-bg)',
            zIndex: 0,
            transition: 'background 0.3s ease'
        }}>
            {/* Base Layer */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom right, var(--color-bg), var(--color-surface))',
                opacity: 0.95
            }} />

            {/* Living Background Atomic Systems */}
            {mode === 'immersive' && (
                <>
                    <AtomicSystem size={800} top="20%" left="15%" delay={0} opacity={0.03} />
                    <AtomicSystem size={1000} top="80%" left="85%" delay={-15} opacity={0.02} />
                    <AtomicSystem size={600} top="50%" left="50%" delay={-30} opacity={0.015} />
                    <AtomicSystem size={900} top="10%" left="90%" delay={-45} opacity={0.025} />
                </>
            )}

            {/* Blueprint Background Systems */}
            {mode === 'blueprint' && (
                <>
                    <AtomicSystem size={1400} top="50%" left="50%" blueprint opacity={0.1} />
                    <AtomicSystem size={1800} top="40%" left="60%" blueprint opacity={0.05} delay={-20} />
                    <AtomicSystem size={1000} top="60%" left="30%" blueprint opacity={0.05} delay={-40} />
                </>
            )}

            {/* Noise Overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.02,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                pointerEvents: 'none'
            }} />
        </div>
    );
};
