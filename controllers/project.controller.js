// -----------------------------------------------------------------------------
// ملف متحكم المشاريع (controllers/project.controller.js)
// -----------------------------------------------------------------------------
const Project = require('../models/project.model');
const Client = require('../models/client.model');
const mongoose = require('mongoose');

/**
 * @desc    جلب قائمة بجميع المشاريع
 * @route   GET /api/projects
 * @access  Public
 */
const getProjects = async (req, res) => {
    try {
        const projects = await Project.find({});
        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم عند جلب المشاريع', error: error.message });
    }
};

/**
 * @desc    إضافة مشروع جديد
 * @route   POST /api/projects
 * @access  Public
 */
const createProject = async (req, res) => {
    try {
        const { name, clientName, rate } = req.body;
        if (!name || !clientName || !rate) {
            return res.status(400).json({ message: 'الحقول (name, clientName, rate) مطلوبة' });
        }
        const clientExists = await Client.findOne({ name: clientName });
        if (!clientExists) {
            return res.status(404).json({ message: 'العميل المحدد غير موجود' });
        }
        const newProject = new Project({ name, clientName, rate });
        const savedProject = await newProject.save();
        res.status(201).json(savedProject);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'اسم المشروع مستخدم بالفعل' });
        }
        res.status(500).json({ message: 'حدث خطأ في الخادم عند إضافة المشروع', error: error.message });
    }
};

/**
 * @desc    حذف مشروع
 * @route   DELETE /api/projects/:id
 * @access  Public
 */
const deleteProject = async (req, res) => {
    const { id } = req.params;

    // FIX: التحقق من أن الـ ID صالح قبل إرساله لقاعدة البيانات
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "صيغة معرّف المشروع غير صالحة" });
    }

    try {
        const deletedProject = await Project.findByIdAndDelete(id);

        if (!deletedProject) {
            return res.status(404).json({ message: 'المشروع غير موجود' });
        }

        res.status(200).json({ message: 'تم حذف المشروع بنجاح' });
    } catch (error) {
        console.error("خطأ في حذف المشروع:", error);
        res.status(500).json({ message: 'حدث خطأ في الخادم عند حذف المشروع', error: error.message });
    }
};


module.exports = {
    getProjects,
    createProject,
    deleteProject
};
