const asyncHandler = require('express-async-handler');
const Timesheet = require('../models/timesheet.model.js');
const Employee = require('../models/employee.model.js');
const faceapi = require('face-api.js');

// ======================
// Helpers
// ======================

// حول "YYYY-MM-DD" إلى منتصف الليل بالتوقيت المحلي لتفادي انحراف المناطق الزمنية
function toLocalMidnight(dateStr) {
    return new Date(`${dateStr}T00:00:00`);
}

// يحوّل "HH:MM" أو "HH:MM:SS" إلى عدد الثواني منذ بداية اليوم.
function parseTimeToSeconds(t) {
    if (typeof t !== 'string') return null;
    const m = t.trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
    if (!m) return null;
    const h = Number(m[1]), min = Number(m[2]), s = m[3] ? Number(m[3]) : 0;
    if (h > 23) return null;
    return h * 3600 + min * 60 + s;
}

// يدمج الفترات المتداخلة/المتلاصقة
function mergeIntervals(intervals) {
    if (intervals.length <= 1) return intervals;
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

// دالة الحساب الدقيقة
function calculateDayHours(entries, dateObject, options = {}) {
    const standardHours = options.standardHours ?? 8;
    const weekendDays   = options.weekendDays   ?? [0, 6]; // 0=الأحد, 6=السبت
    const countOvernightInSameDay = options.countOvernightInSameDay ?? true;
    const rounding = options.rounding ?? null;

    const standardDaySeconds = standardHours * 3600;

    // تنظيف الإدخالات
    const cleaned = entries
        .filter(e => e && (e.type === 'check-in' || e.type === 'check-out'))
        .map(e => ({ type: e.type, sec: parseTimeToSeconds(e.time) }))
        .filter(e => e.sec !== null)
        .sort((a, b) => a.sec - b.sec);

    // أزواج check-in / check-out
    const intervals = [];
    let openIn = null;
    for (const e of cleaned) {
        if (e.type === 'check-in') {
            openIn = e.sec;
        } else {
            if (openIn !== null) {
                let start = openIn;
                let end = e.sec;
                if (end <= start) {
                    if (countOvernightInSameDay) {
                        end += 24 * 3600;
                    } else {
                        end += 24 * 3600;
                    }
                }
                intervals.push([start, end]);
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

    // تقريب اختياري
    const applyRounding = (sec) => {
        if (!rounding || !rounding.minutes || rounding.minutes <= 0) return sec;
        const quantum = rounding.minutes * 60;
        const mode = rounding.mode || 'nearest';
        if (mode === 'up')     return Math.ceil(sec / quantum) * quantum;
        if (mode === 'down')   return Math.floor(sec / quantum) * quantum;
        return Math.round(sec / quantum) * quantum;
    };

    if (rounding && (rounding.target === 'overtime' || rounding.target === 'all')) {
        if (rounding.target === 'all') {
            const roundedTotal = applyRounding(regularSeconds + overtimeSeconds);
            if (isWeekend) {
                regularSeconds = 0;
                overtimeSeconds = roundedTotal;
            } else {
                const roundedRegular = Math.min(roundedTotal, standardDaySeconds);
                const roundedOver    = Math.max(0, roundedTotal - standardDaySeconds);
                regularSeconds = roundedRegular;
                overtimeSeconds = roundedOver;
            }
        } else {
            overtimeSeconds = applyRounding(overtimeSeconds);
        }
    }

    const toHours = (sec) => Number((sec / 3600).toFixed(4));
    const totalSecondsFinal = regularSeconds + overtimeSeconds;

    return {
        total:   toHours(totalSecondsFinal),
        regular: toHours(regularSeconds),
        overtime:toHours(overtimeSeconds),
    };
}

// ======================
// Helper to fetch and format a concise location name from coordinates
// ======================
const getLocationName = async (lat, lon) => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=it,en&addressdetails=1`, {
            headers: {
                'User-Agent': 'EvolutionMECApp/1.0 (contact: your-email@example.com)'
            }
        });

        if (!response.ok) {
            console.error(`Geocoding service returned status: ${response.status}`);
            return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }

        const data = await response.json();

        if (data && data.address) {
            const address = data.address;
            const road = address.road || '';
            const locality = address.village || address.town || address.city || '';
            
            let provinceCode = '';
            if (address['ISO3166-2-lvl6']) {
                provinceCode = address['ISO3166-2-lvl6'].split('-')[1];
            } else if (address.county) {
                provinceCode = address.county.substring(0, 2).toUpperCase();
            }

            let parts = [];
            if (road) parts.push(road);
            if (locality) parts.push(locality);
            
            let mainPart = parts.join(', ');
            if (provinceCode) {
                mainPart += ` (${provinceCode})`;
            }

            return mainPart || data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }

        return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch (error) {
        console.error("Geocoding Fetch Error:", error);
        return 'Failed to fetch location';
    }
};

// ======================
// Controllers
// ======================

// @desc    Get timesheet records for an employee within a date range
const getTimesheets = asyncHandler(async (req, res) => {
    const { employeeName, startDate, endDate } = req.query;

    if (!employeeName || !startDate || !endDate) {
        res.status(400);
        throw new Error('معلومات الاستعلام ناقصة');
    }

    const records = await Timesheet.find({
        employeeName: employeeName.toUpperCase(),
        date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 'asc' });

    res.json(records);
});

// @desc    Create or update a timesheet entry
const createOrUpdateEntry = asyncHandler(async (req, res) => {
    const { employeeName, date, time, location, faceDescriptor, project, description } = req.body;
    
    if (!employeeName || !date || !time || !location || !faceDescriptor) {
        res.status(400);
        throw new Error('بيانات التسجيل ناقصة');
    }

    const employee = await Employee.findOne({ name: employeeName.toUpperCase() });
    if (!employee || !employee.faceDescriptor || employee.faceDescriptor.length === 0) {
        res.status(401);
        throw new Error('لم يتم تسجيل بصمة الوجه لهذا الموظف');
    }

    const faceMatcher = new faceapi.FaceMatcher([new Float32Array(employee.faceDescriptor)], 0.5);
    const bestMatch = faceMatcher.findBestMatch(new Float32Array(faceDescriptor));

    if (bestMatch.label === 'unknown') {
        res.status(401);
        throw new Error('الوجه غير مطابق، فشل التحقق');
    }
    
    const locationName = await getLocationName(location.lat, location.lon);
    const locationWithdName = { ...location, name: locationName };

    let timesheet = await Timesheet.findOne({ employeeName: employeeName.toUpperCase(), date });

    if (timesheet) {
        const lastEntry = timesheet.entries[timesheet.entries.length - 1];
        const newEntryType = !lastEntry || lastEntry.type === 'check-out' ? 'check-in' : 'check-out';
        timesheet.entries.push({ type: newEntryType, time, location: locationWithdName, project, description });
    } else {
        timesheet = await Timesheet.create({
            employeeName: employeeName.toUpperCase(),
            date,
            entries: [{ type: 'check-in', time, location: locationWithdName, project, description }],
        });
    }

    const { total, regular, overtime } = calculateDayHours(timesheet.entries, toLocalMidnight(date));
    timesheet.totalHours = total;
    timesheet.regularHours = regular;
    timesheet.overtimeHours = overtime;

    const updatedTimesheet = await timesheet.save();
    res.json(updatedTimesheet);
});

// @desc    Update a full timesheet record (for admin edits)
const updateTimesheet = asyncHandler(async (req, res) => {
    const timesheet = await Timesheet.findById(req.params.id);

    if (timesheet) {
        timesheet.entries = req.body.entries || timesheet.entries;
        
        const { total, regular, overtime } = calculateDayHours(timesheet.entries, toLocalMidnight(timesheet.date));
        timesheet.totalHours = total;
        timesheet.regularHours = regular;
        timesheet.overtimeHours = overtime;
        
        const updatedTimesheet = await timesheet.save();
        res.json(updatedTimesheet);
    } else {
        res.status(404);
        throw new Error('لم يتم العثور على سجل الدوام');
    }
});

module.exports = {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
};
