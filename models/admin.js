const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'moderator'],
        default: 'admin'
    },
    permissions: {
        manageUsers: { type: Boolean, default: true },
        manageGames: { type: Boolean, default: true },
        viewReports: { type: Boolean, default: true },
        manageAdmins: { type: Boolean, default: false }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: Date,
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('admin', adminSchema);