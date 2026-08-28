import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Camera, User, ArrowLeft, Save } from 'lucide-react';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars

const ProfilePage = () => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    
    const [profileName, setProfileName] = useState(user?.name || '');
    const [profilePhone, setProfilePhone] = useState(user?.phoneNumber || '');
    const [profileImg, setProfileImg] = useState(user?.profileImage || '');
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    
    const fileInputRef = useRef(null);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Image size limit: 5MB max
        if (file.size > 5 * 1024 * 1024) {
            setProfileError('Photo size must be smaller than 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setProfileImg(reader.result); // Base64 string
            setProfileError('');
        };
        reader.onerror = () => {
            setProfileError('Failed to read photo file.');
        };
        reader.readAsDataURL(file);
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileError('');
        setProfileSuccess('');

        try {
            const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/auth/profile`,
                { name: profileName, phoneNumber: profilePhone, profileImage: profileImg },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );

            // Sync user data to context
            const updatedUser = { 
                ...user, 
                name: res.data.name, 
                phoneNumber: res.data.phoneNumber, 
                profileImage: res.data.profileImage 
            };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            setProfileSuccess('Profile changes saved successfully!');
            setTimeout(() => setProfileSuccess(''), 4000);
        } catch (err) {
            setProfileError(err.response?.data?.message || 'Failed to save profile changes.');
        } finally {
            setSavingProfile(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    return (
        <motion.div 
            className="max-w-[560px] w-full mx-auto flex flex-col gap-5"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Back Button */}
            <div className="w-full flex justify-start">
                <button 
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-gray-500 font-bold text-sm bg-none border-none cursor-pointer hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Dashboard
                </button>
            </div>

            {/* Profile Settings Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 md:p-8 shadow-sm flex flex-col gap-6 w-full">
                <div className="flex items-center gap-3">
                    <div className="bg-[#6c63ff]/10 p-2.5 rounded-xl text-[#6c63ff] flex items-center justify-center">
                        <User size={22} />
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight leading-none">My Profile</h2>
                        <p className="text-xs text-gray-500 font-medium mt-1">Edit your student contact details</p>
                    </div>
                </div>

                <form onSubmit={handleSaveProfile} noValidate className="flex flex-col gap-5">
                    {/* Base64 Avatar Selector */}
                    <div className="flex flex-col items-center gap-2.5">
                        <div 
                            onClick={() => fileInputRef.current.click()}
                            className="relative w-24 h-24 rounded-full border-4 border-white shadow-md bg-blue-50 cursor-pointer overflow-hidden flex items-center justify-center group"
                        >
                            {profileImg ? (
                                <img src={profileImg} alt="Avatar Preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-3xl font-extrabold text-[#6c63ff]">
                                    {profileName?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Camera size={18} className="text-white" />
                            </div>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            accept="image/*" 
                            className="hidden" 
                        />
                        <span className="text-[11px] text-gray-400 font-medium">Tap avatar to change photo (Max 5MB)</span>
                    </div>

                    {/* Editable: Full name */}
                    <div className="flex flex-col gap-1.5 w-full">
                        <label className="text-xs font-bold text-gray-500" htmlFor="profile-name">Full Name</label>
                        <input 
                            id="profile-name"
                            type="text"
                            className="w-full px-4 py-3 text-sm font-semibold text-gray-900 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#6c63ff] focus:ring-4 focus:ring-[#6c63ff]/5 shadow-sm transition-all text-base"
                            value={profileName}
                            onChange={e => setProfileName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Editable: Phone number */}
                    <div className="flex flex-col gap-1.5 w-full">
                        <label className="text-xs font-bold text-gray-500" htmlFor="profile-phone">Phone Number</label>
                        <input 
                            id="profile-phone"
                            type="tel"
                            inputMode="tel"
                            className="w-full px-4 py-3 text-sm font-semibold text-gray-900 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#6c63ff] focus:ring-4 focus:ring-[#6c63ff]/5 shadow-sm transition-all text-base"
                            value={profilePhone}
                            onChange={e => setProfilePhone(e.target.value)}
                            placeholder="Enter your phone number"
                        />
                    </div>

                    {/* Read-Only: academic info cards */}
                    <div className="border-t border-gray-100 pt-5 flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Academic Data (Read-Only)</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-gray-50/50 p-3.5 rounded-xl border border-gray-100/80 flex flex-col gap-1">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Email address</span>
                                <span className="text-sm font-semibold text-gray-700 truncate" title={user?.email}>{user?.email}</span>
                            </div>
                            <div className="bg-gray-50/50 p-3.5 rounded-xl border border-gray-100/80 flex flex-col gap-1">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Register Number</span>
                                <span className="text-sm font-semibold text-gray-700">{user?.registerNumber}</span>
                            </div>
                            <div className="bg-gray-50/50 p-3.5 rounded-xl border border-gray-100/80 flex flex-col gap-1">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Department</span>
                                <span className="text-sm font-semibold text-gray-700">{user?.department}</span>
                            </div>
                            <div className="bg-gray-50/50 p-3.5 rounded-xl border border-gray-100/80 flex flex-col gap-1">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Academic Year</span>
                                <span className="text-sm font-semibold text-gray-700">{user?.year} Year</span>
                            </div>
                        </div>
                        <div className="bg-gray-50/50 p-3.5 rounded-xl border border-gray-100/80 flex flex-col gap-1">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">College</span>
                            <span className="text-sm font-semibold text-gray-700">
                                {user?.college === 'Others' ? user?.otherCollegeName : 'SVHEC'}
                            </span>
                        </div>
                    </div>

                    {/* Status feedback & Submit */}
                    <div className="mt-2 flex flex-col gap-2">
                        {profileError && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-500 text-xs font-semibold">
                                {profileError}
                            </div>
                        )}
                        {profileSuccess && (
                            <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-green-600 text-xs font-semibold">
                                {profileSuccess}
                            </div>
                        )}
                        
                        <button 
                            type="submit" 
                            disabled={savingProfile}
                            className="w-full py-3.5 rounded-xl bg-[#6c63ff] hover:bg-[#5b52e6] text-white font-bold text-sm cursor-pointer shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={16} /> {savingProfile ? 'Saving changes...' : 'Save Profile Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </motion.div>
    );
};

export default ProfilePage;
