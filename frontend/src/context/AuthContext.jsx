import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        const verifyUser = async () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                try {
                    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
                        headers: { Authorization: `Bearer ${parsedUser.token}` }
                    });
                    
                    // Update user state with verified data (including true role)
                    const verifiedUser = { ...res.data, token: parsedUser.token };
                    setUser(verifiedUser);
                    localStorage.setItem('user', JSON.stringify(verifiedUser));
                } catch (error) {
                    console.error('Session invalid:', error);
                    localStorage.removeItem('user');
                    setUser(null);
                }
            }
            setLoading(false);
        };

        verifyUser();
    }, []);

    // Axios interceptor to catch blocked responses
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response?.status === 403 && error.response?.data?.blocked) {
                    setIsBlocked(true);
                }
                return Promise.reject(error);
            }
        );

        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    const login = async (email, password) => {
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/login`, { email, password });
            setUser(res.data);
            setIsBlocked(false);
            localStorage.setItem('user', JSON.stringify(res.data));
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Login failed' };
        }
    };

    const register = async (name, email, password, registerNumber, year, department, college, otherCollegeName) => {
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/register`, { 
                name, email, password, registerNumber, year, department, college, otherCollegeName 
            });
            setUser(res.data);
            setIsBlocked(false);
            localStorage.setItem('user', JSON.stringify(res.data));
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Registration failed' };
        }
    };

    const logout = () => {
        setUser(null);
        setIsBlocked(false);
        localStorage.removeItem('user');
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{ user, setUser, login, register, logout, loading, isBlocked, setIsBlocked }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
