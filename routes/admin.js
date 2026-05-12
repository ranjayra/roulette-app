const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');
const User = require('../models/user');
const Game = require('../models/Game');
const { adminAuth, checkPermission } = require('../middleware/adminAuth');

const router = express.Router();

// Admin Login
router.post('/login', async(req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });

        if (!admin || !admin.isActive) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        admin.lastLogin = new Date();
        await admin.save();

        const token = jwt.sign({ id: admin._id, role: admin.role },
            process.env.JWT_SECRET, { expiresIn: '24h' }
        );

        res.json({
            token,
            admin: {
                id: admin._id,
                username: admin.username,
                role: admin.role,
                permissions: admin.permissions
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all users (Admin only)
router.get('/users', adminAuth, checkPermission('manageUsers'), async(req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user balance
router.put('/users/:userId/balance', adminAuth, checkPermission('manageUsers'), async(req, res) => {
    try {
        const { balance } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.userId, { balance, adminModified: true, modifiedBy: req.admin._id }, { new: true }
        ).select('-password');

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Block/Unblock user
router.patch('/users/:userId/status', adminAuth, checkPermission('manageUsers'), async(req, res) => {
    try {
        const { isActive } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.userId, { isActive }, { new: true }
        ).select('-password');

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get game statistics
router.get('/stats', adminAuth, checkPermission('viewReports'), async(req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const totalBets = await Game.aggregate([
            { $group: { _id: null, total: { $sum: '$betAmount' } } }
        ]);

        res.json({
            totalUsers,
            activeUsers,
            totalBets: totalBets[0] ? .total || 0,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Control game state
router.post('/game/control', adminAuth, checkPermission('manageGames'), async(req, res) => {
    try {
        const { action, winningNumber } = req.body;

        if (action === 'start') {
            await Game.updateMany({}, { bettingOpen: true });
        } else if (action === 'stop') {
            await Game.updateMany({}, { bettingOpen: false });
        } else if (action === 'setWinner' && winningNumber !== undefined) {
            const game = new Game({
                winningNumber,
                adminModified: true,
                modifiedBy: req.admin._id,
                roundId: `ROUND_${Date.now()}`
            });
            await game.save();
        }

        res.json({ message: `Game ${action} successful` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new admin (Super admin only)
router.post('/admins', adminAuth, checkPermission('manageAdmins'), async(req, res) => {
    try {
        const { username, password, role, permissions } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = new Admin({
            username,
            password: hashedPassword,
            role,
            permissions: permissions || {}
        });

        await admin.save();
        res.status(201).json({ message: 'Admin created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;