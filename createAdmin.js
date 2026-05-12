require("dotenv").config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/admin');

const createDefaultAdmin = async() => {
    try {

        // MongoDB connect
        await mongoose.connect(process.env.MONGO_URI);

        console.log("✅ MongoDB Connected");

        const existingAdmin = await Admin.findOne({ username: 'superadmin' });

        if (!existingAdmin) {

            const hashedPassword = await bcrypt.hash('Admin@123', 10);

            const admin = new Admin({
                username: 'superadmin',
                password: hashedPassword,
                role: 'super_admin',
                permissions: {
                    manageUsers: true,
                    manageGames: true,
                    viewReports: true,
                    manageAdmins: true
                }
            });

            await admin.save();

            console.log('✅ Default admin created successfully');
            console.log('📝 Username: superadmin');
            console.log('🔑 Password: Admin@123');

        } else {

            console.log('ℹ️ Admin already exists');

        }

        await mongoose.disconnect();

        process.exit(0);

    } catch (error) {

        console.error('❌ Error creating admin:', error);

        process.exit(1);
    }
};

createDefaultAdmin();