import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Design tokens for #EDAC33 accent
const tokens = {
    colorPrimary: '#EDAC33',
    colorLink: '#EDAC33',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const lightTheme = {
    algorithm: antTheme.defaultAlgorithm,
    token: {
        ...tokens,
        colorBgBase: '#FAFAFA',
        colorBgContainer: '#FFFFFF',
        colorBgElevated: '#FFFFFF',
        colorText: '#1A1A1A',
        colorTextSecondary: '#666666',
        colorBorder: '#E5E5E5',
        colorBorderSecondary: '#F0F0F0',
    },
};

const darkTheme = {
    algorithm: antTheme.darkAlgorithm,
    token: {
        ...tokens,
        colorBgBase: '#0F0F0F',
        colorBgContainer: '#1A1A1A',
        colorBgElevated: '#252525',
        colorText: '#F5F5F5',
        colorTextSecondary: '#A0A0A0',
        colorBorder: '#333333',
        colorBorderSecondary: '#2A2A2A',
    },
};

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('shunya-theme');
        return (saved as Theme) || 'dark';
    });

    useEffect(() => {
        localStorage.setItem('shunya-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const currentTheme = theme === 'light' ? lightTheme : darkTheme;

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            <ConfigProvider theme={currentTheme}>
                {children}
            </ConfigProvider>
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
