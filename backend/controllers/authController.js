import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AppSettings from '../models/AppSettings.js';

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

export const registerUser = async (req, res) => {
    const { name, email, password, registerNumber, year, department, college, otherCollegeName } = req.body;

    try {
        // Check if registration is open
        let settings = await AppSettings.findOne();
        if (settings && !settings.registrationOpen) {
            return res.status(403).json({ message: 'Registration is currently closed by the admin.' });
        }

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'user', // Force user role
            registerNumber,
            year,
            department,
            college,
            otherCollegeName,
            isApproved: false
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isApproved: user.isApproved,
                registerNumber: user.registerNumber,
                year: user.year,
                department: user.department,
                college: user.college,
                otherCollegeName: user.otherCollegeName,
                token: generateToken(user._id, user.role),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await bcrypt.compare(password, user.password))) {
            // Check if user is blocked
            if (user.isBlocked) {
                return res.status(403).json({ message: 'Your account has been blocked by the admin.', blocked: true });
            }

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isApproved: user.isApproved,
                registerNumber: user.registerNumber,
                year: user.year,
                department: user.department,
                college: user.college,
                otherCollegeName: user.otherCollegeName,
                token: generateToken(user._id, user.role),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Verify user token and get current user info
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (user) {
            if (user.isBlocked) {
                return res.status(403).json({ message: 'Your account has been blocked.', blocked: true });
            }
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isApproved: user.isApproved,
                registerNumber: user.registerNumber,
                year: user.year,
                department: user.department,
                college: user.college,
                otherCollegeName: user.otherCollegeName,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Request a password reset to admin
export const requestPasswordReset = async (req, res) => {
    const { email, registerNumber } = req.body;
    try {
        if (!email || !registerNumber) {
            return res.status(400).json({ message: 'Email and Register Number are required' });
        }
        const user = await User.findOne({ email: email.trim().toLowerCase(), registerNumber: registerNumber.trim() });
        if (!user) {
            return res.status(404).json({ message: 'No student matches this email and register number' });
        }
        
        user.resetPasswordStatus = 'pending';
        await user.save();
        
        res.json({ message: 'Reset request successfully submitted to admin' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Reset password once approved by admin
export const resetPassword = async (req, res) => {
    const { email, registerNumber, newPassword } = req.body;
    try {
        if (!email || !registerNumber || !newPassword) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const user = await User.findOne({ email: email.trim().toLowerCase(), registerNumber: registerNumber.trim() });
        if (!user) {
            return res.status(404).json({ message: 'No student matches this email and register number' });
        }
        
        if (user.resetPasswordStatus === 'pending') {
            return res.status(403).json({ message: 'Your password reset request is still pending admin approval' });
        }
        
        if (user.resetPasswordStatus === 'none') {
            return res.status(403).json({ message: 'No reset request approved for this user. Please submit a request first' });
        }
        
        // approved! Hash new password and save
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordStatus = 'none'; // reset status
        await user.save();
        
        res.json({ message: 'Password updated successfully. You can now log in' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
