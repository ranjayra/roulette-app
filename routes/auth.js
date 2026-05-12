const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key_here";

//  REGISTER API
router.post("/register", async(req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return res.status(400).json({
                error: "Username or email already exists"
            });
        }

        // Create new user
        const user = new User({ username, email, password });
        await user.save();

        res.json({
            success: true,
            message: "User created successfully! Please login."
        });

    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ error: "Registration failed" });
    }
});

// 🔐 LOGIN API
router.post("/login", async(req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        // Check password
        const isValid = await user.comparePassword(password);
        if (!isValid) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        // Generate token
        const token = jwt.sign({ userId: user._id, email: user.email },
            JWT_SECRET, { expiresIn: "7d" }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                totalGames: user.totalGames,
                totalWins: user.totalWins,
                totalLosses: user.totalLosses
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

// 👤 GET USER PROFILE (Protected)
router.get("/profile", authMiddleware, async(req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(user);

    } catch (error) {
        res.status(500).json({ error: "Failed to get profile" });
    }
});

module.exports = router;