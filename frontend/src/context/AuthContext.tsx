import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface User {
    id: string;
    email: string;
    name?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem('auth_token')
    );
    const [isLoading, setIsLoading] = useState(true);

    // Check token validity on mount
    useEffect(() => {
        const checkAuth = async () => {
            const savedToken = localStorage.getItem('auth_token');
            if (!savedToken) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${savedToken}`,
                    },
                });

                if (response.ok) {
                    const userData = await response.json();
                    setUser(userData);
                    setToken(savedToken);
                } else {
                    // Token invalid, clear storage
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                    setToken(null);
                    setUser(null);
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                localStorage.removeItem('auth_token');
                localStorage.removeItem('refresh_token');
                setToken(null);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (email: string, password: string) => {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Login failed');
        }

        const data = await response.json();

        localStorage.setItem('auth_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        setToken(data.access_token);
        setUser({
            id: data.user_id,
            email: data.email,
        });
    };

    const signup = async (email: string, password: string, name?: string) => {
        const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, name }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Signup failed');
        }

        const data = await response.json();

        localStorage.setItem('auth_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        setToken(data.access_token);
        setUser({
            id: data.user_id,
            email: data.email,
        });
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        setToken(null);
        setUser(null);

        // Also call backend logout
        fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        }).catch(() => { }); // Ignore errors
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                isAuthenticated: !!user,
                login,
                signup,
                logout
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
}
