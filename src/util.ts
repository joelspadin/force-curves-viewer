import { Dispatch, SetStateAction, useState } from 'react';

export function isDefined<T>(obj: T | undefined): obj is T {
    return obj !== undefined;
}

export function useLocalStorage<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
    const [state, setState] = useState(() => {
        const value = localStorage.getItem(key);
        return value ? (JSON.parse(value) as T) : defaultValue;
    });

    const setLocalStorageState: Dispatch<SetStateAction<T>> = (value) => {
        const nextState = value instanceof Function ? value(state) : value;
        localStorage.setItem(key, JSON.stringify(nextState));
        setState(nextState);
    };

    return [state, setLocalStorageState];
}
