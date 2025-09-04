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

    const sortedEntries = [...entries].sort((a, b) => a.time.localeCompare(b.time));
    
    for (let i = 0; i < sortedEntries.length; i += 2) {
        const checkIn = sortedEntries[i];
        const checkOut = sortedEntries[i + 1];
        if (checkIn && checkOut && checkIn.type === 'check-in' && checkOut.type === 'check-out') {
             const start = new Date(`1970-01-01T${checkIn.time}:00`);
             let end = new Date(`1970-01-01T${checkOut.time}:00`);
             if (end < start) {
                 end.setDate(end.getDate() + 1);
             }
             totalSeconds += (end - start) / 1000;
        }
    }

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

    return { 
        total: totalSeconds / 3600, 
        regular: regularSeconds / 3600, 
        overtime: overtimeSeconds / 3600 
    };
}

module.exports = {
    getTimesheets,
    createOrUpdateEntry,
    updateTimesheet,
};
