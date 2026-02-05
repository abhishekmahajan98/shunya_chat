import { motion } from 'framer-motion';

export const SplashBackground = () => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            background: 'var(--color-bg)',
            zIndex: 0, // Ensure it sits behind everything
            transition: 'background 0.3s ease'
        }}>
            {/* Base Layer - Subtle Color Wash */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom right, var(--color-bg), var(--color-surface))',
                opacity: 0.8
            }} />

            {/* Fluid Blob 1 - Primary/Gold */}
            <motion.div
                animate={{
                    x: [0, 100, -50, 0],
                    y: [0, -50, 100, 0],
                    scale: [1, 1.2, 0.9, 1],
                    rotate: [0, 45, -45, 0]
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                style={{
                    position: 'absolute',
                    top: '20%',
                    left: '20%',
                    width: '600px',
                    height: '600px',
                    background: 'radial-gradient(circle, var(--color-primary), transparent 70%)',
                    filter: 'blur(80px)',
                    opacity: 0.15,
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            />

            {/* Fluid Blob 2 - Secondary/Surface Accents */}
            <motion.div
                animate={{
                    x: [0, -100, 50, 0],
                    y: [0, 100, -50, 0],
                    scale: [1, 1.3, 0.8, 1],
                    rotate: [0, -60, 60, 0]
                }}
                transition={{
                    duration: 25,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 2
                }}
                style={{
                    position: 'absolute',
                    bottom: '20%',
                    right: '20%',
                    width: '700px',
                    height: '700px',
                    background: 'radial-gradient(circle, var(--color-surface-hover), transparent 70%)', // Subtle grey/white
                    filter: 'blur(100px)',
                    opacity: 0.1,
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            />

            {/* Fluid Blob 3 - Tertiary/Tint */}
            <motion.div
                animate={{
                    x: [0, 50, -100, 0],
                    y: [0, -100, 50, 0],
                    scale: [1, 0.9, 1.2, 1],
                }}
                transition={{
                    duration: 18,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 5
                }}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '500px',
                    height: '500px',
                    background: 'radial-gradient(circle, var(--color-border), transparent 80%)',
                    filter: 'blur(60px)',
                    opacity: 0.1,
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            />

            {/* Noise Overlay for Texture (Optional, adds premium feel) */}
            <div style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.03,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                pointerEvents: 'none'
            }} />
        </div>
    );
};
