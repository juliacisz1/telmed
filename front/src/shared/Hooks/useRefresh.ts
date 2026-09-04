import {useEffect, useState} from 'react';

export function useRefresh(intervalMs = 30000) {
    const [, setTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setTick(tick => tick + 1), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
}