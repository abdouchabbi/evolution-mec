function toLocalMidnight(dateStr) {
    return new Date(`${dateStr}T00:00:00`);
}

function parseTimeToSeconds(t) {
    if (typeof t !== 'string') return null;
    const m = t.trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
    if (!m) return null;
    const h = Number(m[1]), min = Number(m[2]), s = m[3] ? Number(m[3]) : 0;
    if (h > 23) return null;
    return h * 3600 + min * 60 + s;
}

function mergeIntervals(intervals) {
    if (!intervals || intervals.length <= 1) return intervals || [];
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [];
    let [cs, ce] = intervals[0];
    for (let i = 1; i < intervals.length; i++) {
        const [s, e] = intervals[i];
        if (s <= ce) {
            ce = Math.max(ce, e);
        } else {
            merged.push([cs, ce]);
            [cs, ce] = [s, e];
        }
    }
    merged.push([cs, ce]);
    return merged;
}

function calculateDayHours(entries, dateObject, options = {}) {
    const roundTimeToNearestHalfHour = (seconds, direction) => {
        const minutes = seconds / 60;
        if (direction === 'up') {
            return Math.ceil(minutes / 30) * 30 * 60;
        } else {
            return Math.floor(minutes / 30) * 30 * 60;
        }
    };

    const standardHours = options.standardHours ?? 8;
    const weekendDays = options.weekendDays ?? [0, 6]; 
    const standardDaySeconds = standardHours * 3600;

    const cleaned = (entries || [])
        .filter(e => e && (e.type === 'check-in' || e.type === 'check-out'))
        .map(e => ({ type: e.type, sec: parseTimeToSeconds(e.time) }))
        .filter(e => e.sec !== null)
        .sort((a, b) => a.sec - b.sec);

    const intervals = [];
    let openIn = null;
    for (const e of cleaned) {
        if (e.type === 'check-in') {
            openIn = e.sec;
        } else {
            if (openIn !== null) {
                let start = openIn;
                let end = e.sec;
                const roundedStart = roundTimeToNearestHalfHour(start, 'up');
                const roundedEnd = roundTimeToNearestHalfHour(end, 'down');
                if (roundedEnd > roundedStart) {
                    intervals.push([roundedStart, roundedEnd]);
                }
                openIn = null;
            }
        }
    }

    const merged = mergeIntervals(intervals);
    let totalSeconds = 0;
    for (const [s, e] of merged) totalSeconds += (e - s);

    const dayOfWeek = dateObject.getDay();
    const isWeekend = weekendDays.includes(dayOfWeek);

    let regularSeconds = 0;
    let overtimeSeconds = 0;

    if (isWeekend) {
        overtimeSeconds = totalSeconds;
    } else {
        regularSeconds = Math.min(totalSeconds, standardDaySeconds);
        overtimeSeconds = Math.max(0, totalSeconds - standardDaySeconds);
    }
    
    const toHours = (sec) => Number((sec / 3600).toFixed(4));
    const totalSecondsFinal = regularSeconds + overtimeSeconds;

    return {
        total: toHours(totalSecondsFinal),
        regular: toHours(regularSeconds),
        overtime: toHours(overtimeSeconds),
    };
}

const getLocationName = async (lat, lon) => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=it,en`);
        if (!response.ok) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        const data = await response.json();
        return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch (error) {
        console.error("Geocoding Error:", error);
        return 'Location unavailable';
    }
};

module.exports = { toLocalMidnight, parseTimeToSeconds, mergeIntervals, calculateDayHours, getLocationName };
