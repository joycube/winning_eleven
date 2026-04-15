import { useCallback, useRef, useState, useEffect } from 'react';

export const useLongPress = (onLongPress: () => void, ms: number = 3000) => {
    const [startLongPress, setStartLongPress] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const start = useCallback(() => setStartLongPress(true), []);
    const stop = useCallback(() => setStartLongPress(false), []);

    useEffect(() => {
        if (startLongPress) {
            timerRef.current = setTimeout(onLongPress, ms);
        } else {
            if (timerRef.current) clearTimeout(timerRef.current);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [onLongPress, ms, startLongPress]);

    return {
        onMouseDown: start,
        onMouseUp: stop,
        onMouseLeave: stop,
        onTouchStart: start,
        onTouchEnd: stop,
    };
};