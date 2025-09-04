const express = require('express');
const router = express.Router();
const {
    getProjects,
    createProject,
    deleteProject,
} = require('../controllers/project.controller.js');
const { protect } = require('../middleware/auth.middleware.js');

// -----------------------------------------------------------------------------
// تم الآن جعل مسار جلب المشاريع (GET) عاماً ليتمكن تطبيق الموظف من عرضه.
// تبقى عمليات الإنشاء والحذف محمية للمدير فقط.
// -----------------------------------------------------------------------------

router.route('/')
    .get(getProjects) // تم إزالة الحماية من هنا للسماح للموظف بقراءة المشاريع
    .post(protect, createProject);

router.route('/:id')
    .delete(protect, deleteProject);

module.exports = router;

