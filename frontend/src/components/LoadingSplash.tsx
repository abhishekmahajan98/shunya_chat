import { motion } from 'framer-motion';
import { SplashBackground } from './SplashBackground';
import { InnovationLoader } from './InnovationLoader';

export const LoadingSplash = () => {
    return (
        <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
            <SplashBackground mode="plain" />
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
                {/* Immersive Innovation Loader - Cinematic Scaling */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{ marginBottom: 40 }}
                >
                    <InnovationLoader scale={2.5} />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    style={{
                        color: 'var(--color-text)',
                        fontFamily: 'Playfair Display, serif',
                        fontSize: '1.75rem',
                        fontWeight: '600',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase'
                    }}
                >
                    Shunya
                </motion.div>
            </div>
        </div>
    );
};
