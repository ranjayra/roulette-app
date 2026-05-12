require("dotenv").config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // Force Google DNS

// Rest of your code... // Cloudflare aur Google DNS
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// JWT Secret
const JWT_SECRET = "your_super_secret_key_here";

// Force Win State
let forceWinState = {
    isActive: false,
    winningNumber: null,
    setBy: null,
    setAt: null
};

// Game Control State
let gameControlState = {
    isActive: true
};

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.log("❌ MongoDB Error:", err));


// ========== USER SCHEMA ==========
const authUserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 1000 },
    totalGames: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

// ========== GAME HISTORY SCHEMA ==========
const gameSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuthUser', required: true },
    username: { type: String },
    selectedNumber: { type: Number, required: true },
    winningNumber: { type: Number, required: true },
    result: { type: String, enum: ['win', 'lose'], required: true },
    bet: { type: Number, required: true },
    winAmount: { type: Number, default: 0 },
    balanceAfter: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
});

// ========== ADMIN SCHEMA ==========
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'admin', 'moderator'], default: 'admin' },
    permissions: {
        manageUsers: { type: Boolean, default: true },
        manageGames: { type: Boolean, default: true },
        viewReports: { type: Boolean, default: true },
        manageAdmins: { type: Boolean, default: false }
    },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    createdAt: { type: Date, default: Date.now }
});

// Models
const AuthUser = mongoose.model("AuthUser", authUserSchema);
const Game = mongoose.model("Game", gameSchema);
const Admin = mongoose.model("Admin", adminSchema);

// ========== CREATE DEFAULT ADMIN ==========
async function createDefaultAdmin() {
    const existingAdmin = await Admin.findOne({ username: "superadmin" });
    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash("Admin@123", 10);
        const admin = new Admin({
            username: "superadmin",
            password: hashedPassword,
            role: "super_admin",
            permissions: {
                manageUsers: true,
                manageGames: true,
                viewReports: true,
                manageAdmins: true
            }
        });
        await admin.save();
        console.log("✅ Default admin created - Username: superadmin, Password: Admin@123");
    } else {
        console.log("✅ Admin already exists");
    }
}

// ========== AUTH MIDDLEWARE ==========
const authMiddleware = async(req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Access denied. No token provided." });
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "Access denied. No token provided." });
        }

        const verified = jwt.verify(token, JWT_SECRET);
        req.userId = verified.userId;
        next();
    } catch (error) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }
};

// ========== ADMIN MIDDLEWARE ==========
const adminMiddleware = async(req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Access denied. No token provided." });
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "Access denied. No token provided." });
        }

        const verified = jwt.verify(token, JWT_SECRET);
        const admin = await Admin.findById(verified.id);

        if (!admin || !admin.isActive) {
            return res.status(403).json({ error: "Admin access denied" });
        }

        req.admin = admin;
        next();
    } catch (error) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }
};
//app get 
app.get("/", (req, res) => {
    res.send("🚀 Backend is running successfully!");
});
// ========== AUTH APIs ==========

app.post("/api/auth/register", async(req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await AuthUser.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: "Username or email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new AuthUser({ username, email, password: hashedPassword });
        await user.save();

        res.json({ success: true, message: "User created successfully! Please login." });
    } catch (error) {
        res.status(500).json({ error: "Registration failed" });
    }
});

app.post("/api/auth/login", async(req, res) => {
    try {
        const { email, password } = req.body;

        const user = await AuthUser.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });

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
        res.status(500).json({ error: "Login failed" });
    }
});

app.get("/api/auth/profile", authMiddleware, async(req, res) => {
    try {
        const user = await AuthUser.findById(req.userId).select("-password");
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Failed to get profile" });
    }
});

// ========== PROTECTED APIs ==========

app.get("/api/balance", authMiddleware, async(req, res) => {
    try {
        const user = await AuthUser.findById(req.userId);
        res.json({ balance: user.balance });
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

app.post("/api/spin", authMiddleware, async(req, res) => {
    try {
        const { bet, selectedNumber } = req.body;

        if (!bet || selectedNumber === undefined) {
            return res.status(400).json({ error: "Invalid bet or number" });
        }

        const user = await AuthUser.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!gameControlState.isActive) {
            return res.status(400).json({ error: "Game is currently paused by admin" });
        }

        if (bet > user.balance) {
            return res.status(400).json({ error: "Insufficient balance", balance: user.balance });
        }

        // Check for forced win
        let winningNumber;
        let isForcedWin = false;

        if (forceWinState.isActive && forceWinState.winningNumber !== null) {
            winningNumber = forceWinState.winningNumber;
            isForcedWin = true;
            console.log(`🎯 FORCED WIN ACTIVE! Winning number set to: ${winningNumber}`);
            forceWinState.isActive = false;
        } else {
            winningNumber = Math.floor(Math.random() * 37);
        }

        let result = "lose";
        let winAmount = 0;
        let newBalance = user.balance - bet;

        if (selectedNumber === winningNumber) {
            result = "win";
            winAmount = bet * 35;
            newBalance = user.balance + winAmount;
            user.totalWins += 1;
        } else {
            user.totalLosses += 1;
        }

        user.totalGames += 1;
        user.balance = newBalance;
        await user.save();

        const gameData = {
            userId: user._id,
            username: user.username,
            selectedNumber: Number(selectedNumber),
            winningNumber: Number(winningNumber),
            result: result,
            bet: Number(bet),
            winAmount: Number(winAmount),
            balanceAfter: Number(newBalance),
            timestamp: new Date()
        };

        await Game.create(gameData);

        res.json({
            winningNumber: winningNumber,
            result: result,
            winAmount: winAmount,
            balance: newBalance,
            isForcedWin: isForcedWin
        });

    } catch (error) {
        console.log("❌ SPIN ERROR:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

app.post("/api/add-balance", authMiddleware, async(req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: "Invalid amount" });
        }

        const user = await AuthUser.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.balance += Number(amount);
        await user.save();

        res.json({ balance: user.balance });
    } catch (error) {
        res.status(500).json({ error: "Failed to add balance" });
    }
});

app.get("/api/history", authMiddleware, async(req, res) => {
    try {
        const data = await Game.find({ userId: req.userId }).sort({ timestamp: -1 }).limit(100);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

app.delete("/api/history", authMiddleware, async(req, res) => {
    try {
        const result = await Game.deleteMany({ userId: req.userId });
        res.json({ message: "History cleared", deletedCount: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// ========== ADMIN APIs ==========

app.post("/api/admin/login", async(req, res) => {
    try {
        const { username, password } = req.body;

        const admin = await Admin.findOne({ username });
        if (!admin || !admin.isActive) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isValid = await bcrypt.compare(password, admin.password);
        if (!isValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        admin.lastLogin = new Date();
        await admin.save();

        const token = jwt.sign({ id: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: "24h" });

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
        res.status(500).json({ error: "Server error" });
    }
});

// Set Forced Win Number
app.post("/api/admin/set-forced-win", adminMiddleware, async(req, res) => {
    try {
        const { winningNumber } = req.body;

        if (winningNumber === undefined || winningNumber < 0 || winningNumber > 36) {
            return res.status(400).json({ error: "Invalid winning number" });
        }

        forceWinState = {
            isActive: true,
            winningNumber: winningNumber,
            setBy: req.admin.username,
            setAt: new Date()
        };

        console.log(`🎮 Admin ${req.admin.username} set forced win to: ${winningNumber}`);

        res.json({
            success: true,
            message: `Winner number set to ${winningNumber}`,
            winningNumber: winningNumber
        });
    } catch (error) {
        console.error("Error setting forced win:", error);
        res.status(500).json({ error: "Failed to set winner number" });
    }
});

// Disable Forced Win
app.post("/api/admin/disable-forced-win", adminMiddleware, async(req, res) => {
    try {
        forceWinState = {
            isActive: false,
            winningNumber: null,
            setBy: null,
            setAt: null
        };

        console.log(`🎮 Admin ${req.admin.username} disabled forced win mode`);

        res.json({ success: true, message: "Force mode disabled successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to disable force mode" });
    }
});

// Get Forced Win Status
app.get("/api/admin/forced-win-status", adminMiddleware, async(req, res) => {
    try {
        res.json({
            isActive: forceWinState.isActive,
            winningNumber: forceWinState.winningNumber,
            setBy: forceWinState.setBy,
            setAt: forceWinState.setAt
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to get status" });
    }
});

// Game Control APIs
app.post("/api/admin/game-control", adminMiddleware, async(req, res) => {
    try {
        const { action } = req.body;

        if (action === 'start') {
            gameControlState.isActive = true;
            res.json({ success: true, message: "Game started" });
        } else if (action === 'stop') {
            gameControlState.isActive = false;
            res.json({ success: true, message: "Game paused" });
        } else {
            res.status(400).json({ error: "Invalid action" });
        }
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

app.get("/api/admin/game-status", adminMiddleware, async(req, res) => {
    try {
        res.json({ isActive: gameControlState.isActive });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Get All Users
app.get("/api/admin/users", adminMiddleware, async(req, res) => {
    try {
        const users = await AuthUser.find().select("-password");
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Update User Balance
app.put("/api/admin/users/:userId/balance", adminMiddleware, async(req, res) => {
    try {
        const { balance } = req.body;
        const user = await AuthUser.findByIdAndUpdate(
            req.params.userId, { balance }, { new: true }
        ).select("-password");
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Toggle User Status
app.patch("/api/admin/users/:userId/status", adminMiddleware, async(req, res) => {
    try {
        const { isActive } = req.body;
        const user = await AuthUser.findByIdAndUpdate(
            req.params.userId, { isActive }, { new: true }
        ).select("-password");
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Get Statistics
app.get("/api/admin/stats", adminMiddleware, async(req, res) => {
    try {
        const totalUsers = await AuthUser.countDocuments();
        const activeUsers = await AuthUser.countDocuments({ isActive: true });
        const totalGames = await Game.countDocuments();
        const totalWins = await Game.countDocuments({ result: "win" });

        const totalBetsResult = await Game.aggregate([
            { $group: { _id: null, total: { $sum: "$bet" } } }
        ]);

        res.json({
            totalUsers,
            activeUsers,
            totalGames,
            totalWins,
            totalBets: totalBetsResult[0] ? totalBetsResult[0].total : 0
        });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Test API
app.get("/api/test", (req, res) => {
    res.json({ message: "Backend is working!", timestamp: new Date() });
});

// ========== START SERVER ==========
createDefaultAdmin();

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Test API: http://localhost:${PORT}/api/test`);
});