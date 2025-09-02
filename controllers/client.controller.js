const asyncHandler = require('express-async-handler');
const Client = require('../models/client.model.js');
const Project = require('../models/project.model.js');

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
const getClients = asyncHandler(async (req, res) => {
    const clients = await Client.find({});
    res.json(clients);
});

// @desc    Create a new client
// @route   POST /api/clients
// @access  Private
const createClient = asyncHandler(async (req, res) => {
    const { name, email, phone, address } = req.body;

    if (!name) {
        res.status(400);
        throw new Error('اسم العميل مطلوب');
    }

    const clientExists = await Client.findOne({ name });
    if (clientExists) {
        res.status(400);
        throw new Error('العميل مسجل بالفعل');
    }

    const client = await Client.create({ name, email, phone, address });
    res.status(201).json(client);
});

// @desc    Delete a client
// @route   DELETE /api/clients/:id
// @access  Private
const deleteClient = asyncHandler(async (req, res) => {
    const client = await Client.findById(req.params.id);

    if (client) {
        // Optional: Also delete projects associated with this client
        await Project.deleteMany({ clientName: client.name });
        await client.deleteOne();
        res.json({ message: 'تم حذف العميل والمشاريع المرتبطة به' });
    } else {
        res.status(404);
        throw new Error('لم يتم العثور على العميل');
    }
});


module.exports = {
    getClients,
    createClient,
    deleteClient,
};
