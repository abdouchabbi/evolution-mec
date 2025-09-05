const asyncHandler = require('express-async-handler');
const Timesheet = require('../models/timesheet.model.js');
const Employee = require('../models/employee.model.js');
const faceapi = require('face-api.js');

// Helper to fetch and format a concise location name from coordinates
const getLocationName = async (lat, lon) => {
    try {
        // Using Nominatim's public API with addressdetails to get structured data
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=it,en&addressdetails=1`, {
            headers: {
                'User-Agent': 'EvolutionMECApp/1.0 (contact: your-email@example.com)'
            }
        });

        if (!response.ok) {
            console.error(`Geocoding service returned status: ${response.status}`);
            return `${lat.toFixed(4)}, ${lon.toFixed(4)}`; // Fallback to coordinates
        }

        const data = await response.json();

        if (data && data.address) {
            const address = data.address;
            const road = address.road || '';
            const locality = address.village || address.town || address.city || '';
            
            let provinceCode = '';
            // Use the reliable ISO code to get the province abbreviation (e.g., IT-PR -> PR)
            if (address['ISO3166-2-lvl6']) {
                provinceCode = address['ISO3166-2-lvl6'].split('-')[1];
            } else if (address.county) {
                // Fallback for cases where ISO code is not present
                provinceCode = address.county.substring(0, 2).toUpperCase();
            }

            let parts = [];
            if (road) parts.push(road);
            if (locality) parts.push(locality);
            
            let mainPart = parts.join(', ');
            if (provinceCode) {
                mainPart += ` (${provinceCode})`;
            }

            // Return the constructed string or fallback to the full display name
            return mainPart || data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }

        // Fallback if no address object is found
        return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    } catch (error) {
        console.error("Geocoding Fetch Error:", error);
        return 'Failed to fetch location';
    }
};


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

    const { total, regular, overtime } = calculateDayHours(timesheet.entries, new Date(date));
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
        
        const { total, regular, overtime } = calculateDayHours(timesheet.entries, new Date(timesheet.date));
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

function calculateDayHours(entries, dateObject) {
    const standardDaySeconds = 8 * 3600;
    let totalSeconds = 0;

    // --- NEW, MORE ROBUST LOGIC ---
    // 1. Filter out invalid entries and sort everything by time.
    const sortedEntries = entries
        .filter(e => e.time && typeof e.time === 'string' && /^\d{2}:\d{2}$/.test(e.time))
        .sort((a, b) => a.time.localeCompare(b.time));

    // 2. Create a mutable copy to process.
    let processingEntries = [...sortedEntries];

    // 3. Keep finding and processing pairs until no more pairs can be formed.
    while (processingEntries.length > 1) {
        // Find the first 'check-in' in the remaining entries.
        const checkInIndex = processingEntries.findIndex(e => e.type === 'check-in');

        if (checkInIndex === -1) {
            // If no more check-ins, we can't form any more intervals.
            break;
        }

        const checkIn = processingEntries[checkInIndex];

        // Find the very next 'check-out' that occurs chronologically *after* this 'check-in'.
        const checkOutIndex = processingEntries.findIndex(
            (e, i) => i > checkInIndex && e.type === 'check-out'
        );

        if (checkOutIndex !== -1) {
            // A valid pair has been found.
            const checkOut = processingEntries[checkOutIndex];

            const start = new Date(`1970-01-01T${checkIn.time}:00`);
            let end = new Date(`1970-01-01T${checkOut.time}:00`);

            // Ensure dates are valid before calculation.
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                if (end < start) {
                    end.setDate(end.getDate() + 1); // Handle overnight shifts.
                }
                totalSeconds += (end - start) / 1000;
            }

            // IMPORTANT: Remove the used pair from the array so they aren't processed again.
            // Remove in reverse index order to avoid shifting the array incorrectly.
            processingEntries.splice(checkOutIndex, 1);
            processingEntries.splice(checkInIndex, 1);
        } else {
            // This 'check-in' has no corresponding 'check-out' for the rest of the day.
            // It's an open interval, so we can't calculate its duration.
            // Remove it and let the loop continue to see if other pairs exist.
            processingEntries.splice(checkInIndex, 1);
        }
    }
    // --- END OF NEW LOGIC ---

    const dayOfWeek = dateObject.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday

    let regularSeconds = 0;
    let overtimeSeconds = 0;

    if (isWeekend) {
        overtimeSeconds = totalSeconds;
    } else {
        regularSeconds = Math.min(totalSeconds, standardDaySeconds);
        overtimeSeconds = Math.max(0, totalSeconds - standardDaySeconds);
    }

    if (overtimeSeconds > 0) {
        const overtimeMinutes = overtimeSeconds / 60;
        const roundedMinutes = Math.ceil(overtimeMinutes / 30) * 30;
        overtimeSeconds = roundedMinutes * 60;
    }
    
    const finalTotalSeconds = regularSeconds + overtimeSeconds;

    return { 
        total: finalTotalSeconds / 3600, 
        regular: regularSeconds / 3600, 
        overtime: overtimeSeconds / 3600 
    };
}

module.exports = {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
};

