const asyncHandler = require("express-async-handler");
const Client = require("../models/client.model.js");
const Project = require("../models/project.model.js");

const getClients = asyncHandler(async (req,res) => {
    const clients = await Client.find({ kioskId: req.kioskId });
    res.json(clients);
});

const createClient = asyncHandler(async (req,res) => {
    const { name, email, phone, address } = req.body;
    if (!name) { res.status(400); throw new Error("Client name is required"); }
    const clientExists = await Client.findOne({ name, kioskId: req.kioskId });
    if (clientExists) { res.status(400); throw new Error("Client already exists in this kiosk"); }
    const client = await Client.create({ name, email, phone, address, kioskId: req.kioskId });
    res.status(201).json(client);
});

const deleteClient = asyncHandler(async (req,res) => {
    const client = await Client.findOne({ _id: req.params.id, kioskId: req.kioskId });
    if (client) {
        await Project.deleteMany({ clientName: client.name, kioskId: req.kioskId });
        await client.deleteOne();
        res.json({ message: "Client and associated projects have been deleted" });
    } else { res.status(404); throw new Error("Client not found"); }
});

module.exports = { getClients, createClient, deleteClient };
