import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { message } from 'antd';
import './LoginPage.css';

export default function LoginPage() {
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { login, signup } = useAuth();
    const { refreshHistory } = useChat();

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
            await refreshHistory();
            navigate('/');
        } catch (error) {
            message.error(error instanceof Error ? error.message : 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* Background decoration */}
            <div className="login-bg-decoration" />

            <div className="login-container">
                {/* Logo */}
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                        </svg>
                    </div>
                    <h1 className="login-title">Shunya Chat</h1>
                    <p className="login-subtitle">Your AI-powered workspace</p>
                </div>

                {/* Form */}
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

                    {isSignup && (
                        <div className="login-field">
                            <label htmlFor="name">Name</label>
                            <input
                                id="name"
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="name"
                            />
                        </div>
                    )}

                    <div className="login-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="login-field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete={isSignup ? 'new-password' : 'current-password'}
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="login-loading">
                                <span></span><span></span><span></span>
                            </span>
                        ) : (
                            isSignup ? 'Create Account' : 'Sign In'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <p className="login-footer">
                    Powered by AI agents and Supabase
                </p>
            </div>
        </div>
    );
}
