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

        // Image size limit: 1MB max to avoid payload issues
        if (file.size > 1 * 1024 * 1024) {
            setProfileError('Photo size is too large. Please select an image under 1MB.');
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
            if (err.response?.status === 413) {
                setProfileError('The uploaded image is too large for the server. Please try a smaller image (under 1MB).');
            } else {
                setProfileError(err.response?.data?.message || 'Failed to save profile changes.');
            }
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
            className="max-w-[520px] w-full mx-auto flex flex-col gap-5"
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
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm w-full" style={{ padding: 'var(--card-padding)', display: 'flex', flexDirection: 'column', gap: 'var(--card-gap)' }}>
                <div className="flex items-center gap-4">
                    <div className="bg-[#6c63ff]/10 p-3 rounded-2xl text-[#6c63ff] flex items-center justify-center">
                        <User size={26} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">My Profile</h2>
                        <p className="text-sm text-gray-500 font-medium mt-1">Edit your student contact details</p>
                    </div>
                </div>

                <form onSubmit={handleSaveProfile} noValidate className="flex flex-col" style={{ gap: 'var(--card-gap)' }}>
                    {/* Base64 Avatar Selector with always-visible camera badge */}
                    <div className="flex flex-col items-center gap-3">
                        <div 
                            onClick={() => fileInputRef.current.click()}
                            className="relative w-28 h-28 rounded-full border-4 border-white shadow-lg bg-indigo-50 cursor-pointer flex items-center justify-center group"
                        >
                            {profileImg ? (
                                <img src={profileImg} alt="Avatar Preview" className="w-full h-full object-cover rounded-full" />
                            ) : (
                                <span className="text-4xl font-extrabold text-[#6c63ff]">
                                    {profileName?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            )}
                            <div className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-[#6c63ff] border-[3px] border-white shadow-md flex items-center justify-center text-white transition-transform group-hover:scale-110">
                                <Camera size={16} />
                            </div>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            accept="image/*" 
                            className="hidden" 
                        />
                        <span className="text-xs text-gray-400 font-semibold">Tap avatar to change photo (Max 1MB)</span>
                    </div>

                    {/* Editable: Full name */}
                    <div className="flex flex-col w-full" style={{ gap: '8px' }}>
                        <label className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider" htmlFor="profile-name">Full Name</label>
                        <input 
                            id="profile-name"
                            type="text"
                            className="w-full text-sm sm:text-base font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:bg-white focus:border-[#6c63ff] focus:ring-4 focus:ring-[#6c63ff]/10 transition-all"
                            style={{ height: 'var(--input-height)', paddingLeft: 'var(--input-padding)', paddingRight: 'var(--input-padding)' }}
                            value={profileName}
                            onChange={e => setProfileName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Editable: Phone number */}
                    <div className="flex flex-col w-full" style={{ gap: '8px' }}>
                        <label className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider" htmlFor="profile-phone">Phone Number</label>
                        <input 
                            id="profile-phone"
                            type="tel"
                            inputMode="tel"
                            className="w-full text-sm sm:text-base font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:bg-white focus:border-[#6c63ff] focus:ring-4 focus:ring-[#6c63ff]/10 transition-all"
                            style={{ height: 'var(--input-height)', paddingLeft: 'var(--input-padding)', paddingRight: 'var(--input-padding)' }}
                            value={profilePhone}
                            onChange={e => setProfilePhone(e.target.value)}
                            placeholder="Enter your phone number"
                        />
                    </div>

                    {/* Read-Only: academic info card */}
                    <div className="border-t border-gray-100 pt-6 flex flex-col" style={{ gap: '16px' }}>
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs sm:text-sm font-extrabold text-gray-400 uppercase tracking-widest">Academic Profile</h4>
                            <span className="px-3 py-1 rounded-full bg-gray-100 text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest">Read-Only</span>
                        </div>
                        <div className="bg-slate-50/80 rounded-3xl border border-slate-100 flex flex-col shadow-sm" style={{ padding: 'var(--card-padding)', gap: '16px' }}>
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                                <span className="text-xs sm:text-sm font-semibold text-gray-500">Email Address</span>
                                <span className="text-xs sm:text-sm font-bold text-gray-800 truncate max-w-[180px] sm:max-w-[260px]" title={user?.email}>{user?.email}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                                <span className="text-xs sm:text-sm font-semibold text-gray-500">Register Number</span>
                                <span className="text-xs sm:text-sm font-bold text-gray-800">{user?.registerNumber}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                                <span className="text-xs sm:text-sm font-semibold text-gray-500">Department & Year</span>
                                <span className="text-xs sm:text-sm font-bold text-gray-800">{user?.department} • Year {user?.year}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs sm:text-sm font-semibold text-gray-500">Institution</span>
                                <span className="text-xs sm:text-sm font-bold text-gray-800">
                                    {user?.college === 'Others' ? user?.otherCollegeName : 'SVHEC'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Status feedback & Submit */}
                    <div className="mt-4 flex flex-col" style={{ gap: '12px' }}>
                        {profileError && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 text-sm font-bold">
                                {profileError}
                            </div>
                        )}
                        {profileSuccess && (
                            <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-green-600 text-sm font-bold">
                                {profileSuccess}
                            </div>
                        )}
                        
                        <button 
                            type="submit" 
                            disabled={savingProfile}
                            className="w-full rounded-2xl bg-[#6c63ff] hover:bg-[#5b52e6] text-white font-extrabold text-sm sm:text-base tracking-widest uppercase cursor-pointer shadow-lg shadow-[#6c63ff]/30 hover:shadow-[#6c63ff]/40 transition-all flex items-center justify-center gap-3"
                            style={{ height: 'var(--input-height)' }}
                        >
                            <Save size={18} /> {savingProfile ? 'Saving changes...' : 'Save Profile Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </motion.div>
    );
};

export default ProfilePage;
