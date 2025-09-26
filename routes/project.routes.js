const express = require('express');
const router = express.Router();
const { getProjects, createProject, deleteProject } = require('../controllers/project.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
router.route('/').get(protect, getProjects).post(protect, createProject);
router.route('/:id').delete(protect, deleteProject);
module.exports = router;
