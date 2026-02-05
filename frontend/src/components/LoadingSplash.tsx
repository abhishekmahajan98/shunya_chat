import { motion } from 'framer-motion';
import { SplashBackground } from './SplashBackground';

export const LoadingSplash = () => {
    return (
        <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
            <SplashBackground />
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 10
            }}>
                {/* Enso Circle / Minimalist Loader */}
                <svg width="80" height="80" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <motion.circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="var(--color-primary)"
                        strokeWidth="3"
                        fill="transparent"
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{
                            duration: 1.5,
                            ease: "easeInOut",
                            repeat: Infinity,
                            repeatType: "reverse"
                        }}
                    />
                    <motion.circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="var(--color-text)"
                        strokeWidth="1"
                        fill="transparent"
                        strokeDasharray="4 6"
                        opacity="0.3"
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 10,
                            ease: "linear",
                            repeat: Infinity,
                        }}
                        style={{ originX: '50px', originY: '50px' }}
                    />
                </svg>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        color: 'var(--color-text)',
                        fontFamily: 'Playfair Display, serif',
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        marginTop: 24,
                        letterSpacing: '0.05em'
                    }}
                >
                    Shunya
                </motion.div>
            </div>
        </div>
    );
};
