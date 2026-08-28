import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Camera, User, Phone, ArrowLeft, Save } from 'lucide-react';
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

        // Image size limit: 2MB max
        if (file.size > 2 * 1024 * 1024) {
            setProfileError('Photo size must be smaller than 2MB.');
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
            className="page-wrap"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            style={{ maxWidth: 600, margin: '0 auto', padding: '16px' }}
        >
            {/* Back Button */}
            <div style={{ marginBottom: 20 }}>
                <button 
                    onClick={() => navigate('/')}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        color: '#666', fontWeight: 600, fontSize: 14
                    }}
                >
                    <ArrowLeft size={16} /> Back to Dashboard
                </button>
            </div>

            {/* Profile Settings Card */}
            <div className="card p-6 sm:p-8" style={{ background: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{ background: 'rgba(108,99,255,0.08)', padding: 12, borderRadius: 16 }}>
                        <User size={24} color="#6c63ff" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>My Profile</h2>
                        <p style={{ fontSize: 13, color: '#666', margin: 0, marginTop: 2 }}>Edit your student contact details</p>
                    </div>
                </div>

                <form onSubmit={handleSaveProfile} noValidate className="flex flex-col gap-4">
                    {/* Base64 Avatar Selector */}
                    <div className="flex flex-col items-center gap-2 mb-4">
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
                        <span className="text-xs text-gray-400 font-medium">Tap avatar to change photo (Max 2MB)</span>
                    </div>

                    {/* Editable: Full name */}
                    <div className="saas-field">
                        <label className="saas-label" htmlFor="profile-name">Full Name</label>
                        <input 
                            id="profile-name"
                            type="text"
                            className="input text-base"
                            value={profileName}
                            onChange={e => setProfileName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Editable: Phone number */}
                    <div className="saas-field">
                        <label className="saas-label" htmlFor="profile-phone">Phone Number</label>
                        <input 
                            id="profile-phone"
                            type="tel"
                            inputMode="tel"
                            className="input text-base"
                            value={profilePhone}
                            onChange={e => setProfilePhone(e.target.value)}
                            placeholder="Enter your phone number"
                        />
                    </div>

                    {/* Read-Only: academic info cards */}
                    <div className="border-t border-gray-100 pt-4 mt-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Academic Data (Read-Only)</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-500/5">
                                <div className="text-[10px] text-gray-400 font-semibold uppercase">Email address</div>
                                <div className="text-xs font-bold text-gray-800 truncate" title={user.email}>{user.email}</div>
                            </div>
                            <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-500/5">
                                <div className="text-[10px] text-gray-400 font-semibold uppercase">Register Number</div>
                                <div className="text-xs font-bold text-gray-800">{user.registerNumber}</div>
                            </div>
                            <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-500/5">
                                <div className="text-[10px] text-gray-400 font-semibold uppercase">Department</div>
                                <div className="text-xs font-bold text-gray-800">{user.department}</div>
                            </div>
                            <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-500/5">
                                <div className="text-[10px] text-gray-400 font-semibold uppercase">Year</div>
                                <div className="text-xs font-bold text-gray-800">{user.year} Year</div>
                            </div>
                        </div>
                        <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-500/5 mt-3">
                            <div className="text-[10px] text-gray-400 font-semibold uppercase">College</div>
                            <div className="text-xs font-bold text-gray-800">
                                {user.college === 'Others' ? user.otherCollegeName : 'SVHEC'}
                            </div>
                        </div>
                    </div>

                    {/* Status feedback & Submit */}
                    <div className="mt-4">
                        {profileError && (
                            <div className="auth-error" style={{ marginBottom: 12 }}>
                                {profileError}
                            </div>
                        )}
                        {profileSuccess && (
                            <div className="auth-error" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', marginBottom: 12 }}>
                                {profileSuccess}
                            </div>
                        )}
                        
                        <button 
                            type="submit" 
                            disabled={savingProfile}
                            className="btn btn-primary w-full"
                            style={{ padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
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
