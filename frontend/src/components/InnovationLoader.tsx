import { motion } from 'framer-motion';

export const InnovationLoader = () => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            perspective: '1000px' // Enable 3D perspective
        }}>
            <div style={{
                position: 'relative',
                width: 40,
                height: 40,
                transformStyle: 'preserve-3d'
            }}>
                {/* Subtle Pulse Halo (Depth effect) */}
                <motion.div
                    style={{
                        position: 'absolute',
                        inset: -2,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        opacity: 0.05, // Lowered
                        filter: 'blur(10px)', // Softer
                        transform: 'translateZ(-10px)'
                    }}
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.05, 0.15, 0.05]
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />

                {/* Orb 1: Horizontal Plane with Depth */}
                <motion.div
                    style={{
                        position: 'absolute',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        top: '50%',
                        left: '50%',
                        marginLeft: -2,
                        marginTop: -2,
                        boxShadow: '0 0 2px var(--color-primary)',
                    }}
                    animate={{
                        x: [18, 0, -18, 0, 18],
                        z: [0, 15, 0, -15, 0], // Move in/out of screen
                        scale: [1, 1.4, 1, 0.7, 1], // Simulate depth
                        opacity: [1, 1, 1, 0.4, 1], // Dim behind core
                    }}
                    transition={{
                        duration: 2.2, // Non-prime-ish duration
                        repeat: Infinity,
                        ease: "linear"
                    }}
                />

                {/* Orb 2: 45 Degree Diagonal Plane with Depth */}
                <motion.div
                    style={{
                        position: 'absolute',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        top: '50%',
                        left: '50%',
                        marginLeft: -2,
                        marginTop: -2,
                        boxShadow: '0 0 2px var(--color-primary)',
                    }}
                    animate={{
                        // 45 degree tilt: x and y move together
                        x: [12, 0, -12, 0, 12],
                        y: [-12, 0, 12, 0, -12],
                        z: [0, -15, 0, 15, 0], // Opposite depth plane
                        scale: [0.9, 0.7, 0.9, 1.4, 0.9],
                        opacity: [1, 0.4, 1, 1, 1],
                    }}
                    transition={{
                        duration: 3.7, // Very different duration to prevent sync
                        repeat: Infinity,
                        ease: "linear",
                        delay: -1.5 // Start mid-sequence
                    }}
                />

                {/* Minimalist Core (Atomic Center) */}
                <motion.div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: 8,
                        height: 8,
                        marginLeft: -4,
                        marginTop: -4,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        opacity: 0.6, // Less shiny
                        transform: 'translateZ(0)'
                    }}
                    animate={{
                        scale: [1, 1.05, 1], // Subtle pulse
                        opacity: [0.5, 0.7, 0.5]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            </div>
        </div>
    );
};
