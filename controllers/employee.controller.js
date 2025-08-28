// -----------------------------------------------------------------------------
// ملف متحكم الموظفين (controllers/employee.controller.js) - محدث
// -----------------------------------------------------------------------------
const Employee = require('../models/employee.model');
const mongoose = require('mongoose');

/**
 * @desc    جلب قائمة بجميع الموظفين
 * @route   GET /api/employees
 * @access  Public
 */
const getEmployees = async (req, res) => {
    try {
        const employees = await Employee.find({});
        res.status(200).json(employees);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم عند جلب الموظفين', error: error.message });
    }
};

/**
 * @desc    إضافة موظف جديد
 * @route   POST /api/employees
 * @access  Public
 */
const createEmployee = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'حقل الاسم مطلوب' });
        }
        const newEmployee = new Employee({ name });
        await newEmployee.save();
        res.status(201).json(newEmployee);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'اسم الموظف مستخدم بالفعل' });
        }
        res.status(500).json({ message: 'حدث خطأ في الخادم عند إضافة الموظف', error: error.message });
    }
};

/**
 * @desc    تسجيل بصمة الوجه لموظف
 * @route   POST /api/employees/:name/face
 * @access  Public
 */
const registerFace = async (req, res) => {
    try {
        const employeeName = req.params.name;
        const { descriptor } = req.body;

        if (!descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
            return res.status(400).json({ message: 'بيانات بصمة الوجه غير صالحة' });
        }

        const updatedEmployee = await Employee.findOneAndUpdate(
            { name: employeeName.toUpperCase() },
            { faceDescriptor: descriptor },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ message: 'تم تسجيل بصمة الوجه بنجاح', employee: updatedEmployee });
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم عند تسجيل بصمة الوجه', error: error.message });
    }
};

/**
 * @desc    حذف موظف
 * @route   DELETE /api/employees/:id
 * @access  Public
 */
const deleteEmployee = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "صيغة معرّف الموظف غير صالحة" });
    }

    try {
        const deletedEmployee = await Employee.findByIdAndDelete(id);

        if (!deletedEmployee) {
            return res.status(404).json({ message: 'الموظف غير موجود' });
        }
        
        // TODO: حذف سجلات الدوام المرتبطة بهذا الموظف
        
        res.status(200).json({ message: 'تم حذف الموظف بنجاح' });
    } catch (error) {
        console.error("خطأ في حذف الموظف:", error);
        res.status(500).json({ message: 'حدث خطأ في الخادم عند حذف الموظف' });
    }
};

module.exports = {
    getEmployees,
    createEmployee,
    registerFace,
    deleteEmployee // إضافة الدالة الجديدة للتصدير
};
