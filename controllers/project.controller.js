const asyncHandler = require("express-async-handler");
const Project = require("../models/project.model.js");

const getProjects = asyncHandler(async (req,res) => {
    const projects = await Project.find({ kioskId: req.kioskId });
    res.json(projects);
});

const createProject = asyncHandler(async (req,res) => {
    const { name, clientName, rate } = req.body;
    if (!name || !clientName || !rate) { res.status(400); throw new Error("Please fill in all project fields"); }
    const projectExists = await Project.findOne({ name, kioskId: req.kioskId });
    if (projectExists) { res.status(400); throw new Error("Project already exists"); }
    const project = await Project.create({ name, clientName, rate, kioskId: req.kioskId });
    res.status(201).json(project);
});

const deleteProject = asyncHandler(async (req,res) => {
    const project = await Project.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (project) {
        await project.deleteOne();
        res.json({ message: "Project deleted successfully" });
    } else { res.status(404); throw new Error("Project not found"); }
});

module.exports = { getProjects, createProject, deleteProject };
