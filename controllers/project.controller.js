const asyncHandler = require('express-async-handler');
const Project = require('../models/project.model.js');

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
const getProjects = asyncHandler(async (req, res) => {
    const projects = await Project.find({});
    res.json(projects);
});

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
const createProject = asyncHandler(async (req, res) => {
    const { name, clientName, rate } = req.body;

    if (!name || !clientName || !rate) {
        res.status(400);
        throw new Error('الرجاء تعبئة جميع حقول المشروع');
    }

    const projectExists = await Project.findOne({ name });
    if (projectExists) {
        res.status(400);
        throw new Error('المشروع مسجل بالفعل');
    }

    const project = await Project.create({ name, clientName, rate });
    res.status(201).json(project);
});

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private
const deleteProject = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (project) {
        await project.deleteOne();
        res.json({ message: 'تم حذف المشروع بنجاح' });
    } else {
        res.status(404);
        throw new Error('لم يتم العثور على المشروع');
    }
});

module.exports = {
    getProjects,
    createProject,
    deleteProject,
};
