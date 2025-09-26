const asyncHandler = require("express-async-handler");
module.exports = {
    getUserProfile: asyncHandler(async (req,res)=> res.json({message:"ok"})),
    updateUserProfile: asyncHandler(async (req,res)=> res.json({message:"ok"})),
    getUsers: asyncHandler(async (req,res)=> res.json([])),
    deleteUser: asyncHandler(async (req,res)=> res.json({message:"deleted"})),
    updateUser: asyncHandler(async (req,res)=> res.json({message:"updated"}))
};
