// -----------------------------------------------------------------------------
// ملف متحكم العملاء (controllers/client.controller.js)
// -----------------------------------------------------------------------------
const Client = require('../models/client.model');
const mongoose = require('mongoose');

/**
 * @desc    جلب قائمة بجميع العملاء
 * @route   GET /api/clients
 * @access  Public
 */
const getClients = async (req, res) => {
    try {
        const clients = await Client.find({});
        res.status(200).json(clients);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم عند جلب العملاء', error: error.message });
    }
};

/**
 * @desc    إضافة عميل جديد
 * @route   POST /api/clients
 * @access  Public
 */
const createClient = async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'حقل اسم العميل مطلوب' });
        }
        const newClient = new Client({ name, email, phone, address });
        const savedClient = await newClient.save();
        res.status(201).json(savedClient);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'اسم العميل مستخدم بالفعل' });
        }
        res.status(500).json({ message: 'حدث خطأ في الخادم عند إضافة العميل', error: error.message });
    }
};

/**
 * @desc    حذف عميل
 * @route   DELETE /api/clients/:id
 * @access  Public
 */
const deleteClient = async (req, res) => {
    const { id } = req.params;

    // FIX: التحقق من أن الـ ID صالح قبل إرساله لقاعدة البيانات
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "صيغة معرّف العميل غير صالحة" });
    }

    try {
        const deletedClient = await Client.findByIdAndDelete(id);

        if (!deletedClient) {
            return res.status(404).json({ message: 'العميل غير موجود' });
        }
        
        // TODO: حذف المشاريع المرتبطة بهذا العميل
        
        res.status(200).json({ message: 'تم حذف العميل بنجاح' });
    } catch (error) {
        console.error("خطأ في حذف العميل:", error);
        res.status(500).json({ message: 'حدث خطأ في الخادم عند حذف العميل', error: error.message });
    }
};


module.exports = {
    getClients,
    createClient,
    deleteClient
};
