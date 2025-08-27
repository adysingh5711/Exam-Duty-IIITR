import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(
    key: string,
    defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
    const [value, setValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return defaultValue;
        }
    });

    const setStoredValue = useCallback((newValue: T | ((prev: T) => T)) => {
        try {
            const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
            setValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, value]);

    const removeStoredValue = useCallback(() => {
        try {
            setValue(defaultValue);
            window.localStorage.removeItem(key);
        } catch (error) {
            console.warn(`Error removing localStorage key "${key}":`, error);
        }
    }, [key, defaultValue]);

    return [value, setStoredValue, removeStoredValue];
}

export function useSessionStorage<T>(
    key: string,
    defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
    const [value, setValue] = useState<T>(() => {
        try {
            const item = window.sessionStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading sessionStorage key "${key}":`, error);
            return defaultValue;
        }
    });

    const setStoredValue = useCallback((newValue: T | ((prev: T) => T)) => {
        try {
            const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
            setValue(valueToStore);
            window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.warn(`Error setting sessionStorage key "${key}":`, error);
        }
    }, [key, value]);

    const removeStoredValue = useCallback(() => {
        try {
            setValue(defaultValue);
            window.sessionStorage.removeItem(key);
        } catch (error) {
            console.warn(`Error removing sessionStorage key "${key}":`, error);
        }
    }, [key, defaultValue]);

    return [value, setStoredValue, removeStoredValue];
}