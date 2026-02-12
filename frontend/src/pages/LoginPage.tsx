import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { SplashBackground } from '../components/SplashBackground';
import { InnovationLoader } from '../components/InnovationLoader';
import './LoginPage.css';

export default function LoginPage() {
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { login, signup } = useAuth();
    const { refreshAllData } = useChat();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isSignup) {
                await signup(email, password, name || undefined);
                message.success('Account created successfully!');
            } else {
                await login(email, password);
                message.success('Welcome back!');
            }
            await refreshAllData();
            navigate('/');
        } catch (error) {
            message.error(error instanceof Error ? error.message : 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">
            <SplashBackground mode="blueprint" />

            <div className="login-container">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="glass-card"
                >
                    <div className="login-header">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1, delay: 0.2 }}
                            style={{ marginBottom: 32, display: 'flex', justifyContent: 'center' }}
                        >
                            <InnovationLoader scale={1.5} />
                        </motion.div>
                        <motion.h1
                            className="shunya-logo-text"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                        >
                            Shunya
                        </motion.h1>
                        <motion.p
                            className="login-subtitle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 1, delay: 0.6 }}
                        >
                            Intelligence Reimagined.
                        </motion.p>
                    </div>

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="login-tabs">
                            <button
                                type="button"
                                className={`login-tab ${!isSignup ? 'active' : ''}`}
                                onClick={() => setIsSignup(false)}
                            >
                                Sign In
                            </button>
                            <button
                                type="button"
                                className={`login-tab ${isSignup ? 'active' : ''}`}
                                onClick={() => setIsSignup(true)}
                            >
                                Sign Up
                            </button>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={isSignup ? 'signup' : 'login'}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.3 }}
                            >
                                {isSignup && (
                                    <div className="input-group">
                                        <label className="input-label" htmlFor="name">Name</label>
                                        <input
                                            id="name"
                                            className="shunya-input"
                                            type="text"
                                            placeholder="Your name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            autoComplete="name"
                                        />
                                    </div>
                                )}

                                <div className="input-group">
                                    <label className="input-label" htmlFor="email">Email</label>
                                    <input
                                        id="email"
                                        className="shunya-input"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="input-label" htmlFor="password">Password</label>
                                    <input
                                        id="password"
                                        className="shunya-input"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        autoComplete={isSignup ? 'new-password' : 'current-password'}
                                    />
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        <button
                            type="submit"
                            className="shunya-button"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="loading-dots">
                                    <span></span><span></span><span></span>
                                </div>
                            ) : (
                                isSignup ? 'Begin Journey' : 'Enter Void'
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
