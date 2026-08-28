import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import './auth.css';

/* ── SVG icons ─────────────────────────────────────────── */
const IconEyeOpen = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
    </svg>
);
const IconEyeClosed = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
);

/* ── Reusable field component with mobile optimization ── */
const Field = ({ id, label, type = 'text', value, onChange, autoComplete,
                 showToggle = false, showPw = false, onToggle,
                 isValid = null, validationMessage = '', inputMode, autoCapitalize, autoCorrect, spellCheck }) => (
    <div className="saas-field">
        <label className="saas-label" htmlFor={id}>{label}</label>
        <div className="saas-input-wrap">
            <input
                id={id}
                className={`saas-input${showToggle ? ' has-eye' : ''}${isValid === true ? ' is-valid' : isValid === false ? ' is-invalid' : ''}`}
                type={type === 'password' ? (showPw ? 'text' : 'password') : type}
                value={value}
                onChange={onChange}
                placeholder={label}
                required
                autoComplete={autoComplete}
                inputMode={inputMode}
                autoCapitalize={autoCapitalize}
                autoCorrect={autoCorrect}
                spellCheck={spellCheck}
            />
            {showToggle && (
                <button type="button" className="eye-toggle"
                    onClick={onToggle} tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <IconEyeOpen /> : <IconEyeClosed />}
                </button>
            )}
        </div>
        {isValid === false && validationMessage && (
            <div className="validation-hint invalid">
                <span>⚠️</span> {validationMessage}
            </div>
        )}
        {isValid === true && (
            <div className="validation-hint valid">
                <span>✓</span> Looks good
            </div>
        )}
    </div>
);

/* ── Auth component ─────────────────────────────────────── */
const Auth = () => {
    const [isToggled, setIsToggled] = useState(false);

    /* sign-in state */
    const [loginUser, setLoginUser]       = useState('');
    const [loginPass, setLoginPass]       = useState('');
    const [showLoginPw, setShowLoginPw]   = useState(false);
    const [loginError, setLoginError]     = useState('');
    const [loginLoading, setLoginLoading] = useState(false);

    /* sign-up wizard state */
    const [regStep, setRegStep]                     = useState(1);
    const [regName, setRegName]                     = useState('');
    const [regEmail, setRegEmail]                   = useState('');
    const [regPass, setRegPass]                     = useState('');
    const [showRegPw, setShowRegPw]                 = useState(false);
    const [regRegisterNumber, setRegRegisterNumber] = useState('');
    const [regYear, setRegYear]                     = useState('');
    const [regDepartment, setRegDepartment]         = useState('');
    const [regCollege, setRegCollege]               = useState('SVHEC');
    const [regOtherCollegeName, setRegOtherCollegeName] = useState('');
    const [regError, setRegError]                   = useState('');
    const [regLoading, setRegLoading]               = useState(false);

    /* forgot password state */
    const [isForgot, setIsForgot]                   = useState(false);
    const [forgotStep, setForgotStep]               = useState(1); 
    const [forgotEmail, setForgotEmail]             = useState('');
    const [forgotRegisterNumber, setForgotRegisterNumber] = useState('');
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
    const [showForgotPw, setShowForgotPw]           = useState(false);
    const [forgotError, setForgotError]             = useState('');
    const [forgotSuccess, setForgotSuccess]         = useState('');
    const [forgotLoading, setForgotLoading]         = useState(false);

    /* registration gate */
    const [regOpen, setRegOpen]           = useState(true);
    const [checkingReg, setCheckingReg]   = useState(true);

    const { login, register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const pathIsRegister = location.pathname === '/register';
        setIsToggled(pathIsRegister);
        if (pathIsRegister) {
            setRegStep(1);
        }
        
        axios.get(`${import.meta.env.VITE_API_URL}/api/admin/settings`)
            .then(r  => setRegOpen(r.data.registrationOpen))
            .catch(() => setRegOpen(true))
            .finally(() => setCheckingReg(false));
    }, [location.pathname]);

    /* Real-time Validation States for credentials step */
    const emailIsValid = regEmail ? /\S+@\S+\.\S+/.test(regEmail) : null;
    const nameIsValid = regName ? regName.trim().length >= 3 : null;
    const passIsValid = regPass ? regPass.length >= 6 : null;

    /* Real-time Validation for Step 2 */
    const regNoIsValid = regRegisterNumber ? regRegisterNumber.trim().length >= 5 : null;

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        setLoginLoading(true);
        const res = await login(loginUser, loginPass);
        if (!res.success) setLoginError(res.message);
        else navigate('/');
        setLoginLoading(false);
    };

    const handleNextStep = (e) => {
        e.preventDefault();
        setRegError('');
        
        if (!regName.trim() || regName.trim().length < 3) {
            setRegError('Full name must be at least 3 characters.');
            return;
        }
        if (!regEmail.trim() || !/\S+@\S+\.\S+/.test(regEmail)) {
            setRegError('Please enter a valid email address.');
            return;
        }
        if (!regPass || regPass.length < 6) {
            setRegError('Password must be at least 6 characters.');
            return;
        }
        
        setRegStep(2);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setRegError('');

        if (!regRegisterNumber.trim()) {
            setRegError('Register number is required');
            return;
        }
        if (regRegisterNumber.trim().length < 5) {
            setRegError('Register number must be at least 5 characters');
            return;
        }
        if (!regYear) {
            setRegError('Please select your year');
            return;
        }
        if (!regDepartment) {
            setRegError('Please select your department');
            return;
        }
        if (regCollege === 'Others' && !regOtherCollegeName.trim()) {
            setRegError('Please enter your college name');
            return;
        }

        setRegLoading(true);
        const res = await register(
            regName, regEmail, regPass, 
            regRegisterNumber.trim(), regYear, regDepartment, regCollege, 
            regCollege === 'Others' ? regOtherCollegeName.trim() : ''
        );
        if (!res.success) {
            setRegError(res.message || 'Registration failed');
        } else {
            setIsToggled(false);
            setRegStep(1);
            setLoginUser(regEmail);
            navigate('/login', { replace: true });
        }
        setRegLoading(false);
    };

    const handleRequestReset = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotSuccess('');
        
        if (!forgotEmail.trim() || !forgotRegisterNumber.trim()) {
            setForgotError('Please enter both your email and register number');
            return;
        }
        
        setForgotLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password`, {
                email: forgotEmail.trim(),
                registerNumber: forgotRegisterNumber.trim()
            });
            setForgotSuccess(res.data.message || 'Reset request successfully submitted.');
            setForgotStep(2); 
        } catch (err) {
            setForgotError(err.response?.data?.message || 'Error submitting request');
        } finally {
            setForgotLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotSuccess('');
        
        if (!forgotNewPassword.trim()) {
            setForgotError('New password is required');
            return;
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
            setForgotError('Passwords do not match');
            return;
        }
        
        setForgotLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/reset-password`, {
                email: forgotEmail.trim(),
                registerNumber: forgotRegisterNumber.trim(),
                newPassword: forgotNewPassword.trim()
            });
            setForgotSuccess(res.data.message || 'Password reset successfully!');
            setTimeout(() => {
                setIsForgot(false);
                setForgotStep(1);
                setLoginUser(forgotEmail);
                setForgotEmail('');
                setForgotRegisterNumber('');
                setForgotNewPassword('');
                setForgotConfirmPassword('');
                setForgotSuccess('');
            }, 3000);
        } catch (err) {
            setForgotError(err.response?.data?.message || 'Password reset failed');
        } finally {
            setForgotLoading(false);
        }
    };

    const goToRegister = (e) => { 
        e.preventDefault(); 
        setIsToggled(true);  
        setRegStep(1);
        setRegError('');
        navigate('/register', { replace: true }); 
    };
    
    const goToLogin = (e) => { 
        e.preventDefault(); 
        setIsToggled(false); 
        setRegStep(1);
        setLoginError('');
        navigate('/login', { replace: true }); 
    };

    /* Static choices for Segmented Pickers */
    const academicYears = [
        { value: 'I', label: 'I Year' },
        { value: 'II', label: 'II Year' },
        { value: 'III', label: 'III Year' },
        { value: 'IV', label: 'IV Year' }
    ];

    const departmentChips = [
        { value: 'CSE', label: 'CSE', desc: 'Computer Science' },
        { value: 'AIDS', label: 'AIDS', desc: 'AI & Data Sci' },
        { value: 'IT', label: 'IT', desc: 'Info Tech' },
        { value: 'ECE', label: 'ECE', desc: 'Electronics' },
        { value: 'EEE', label: 'EEE', desc: 'Electrical' },
        { value: 'BME', label: 'BME', desc: 'Biomedical' }
    ];

    return (
        <div className="auth-page-container">
            <div className={`auth-wrapper${isToggled ? ' toggled' : ''}`}>

                {/* ── Diagonal decoration panel ── */}
                <div className="deco-panel">
                    <div className="deco-text signin">
                        <h2>WELCOME<br/>BACK!</h2>
                    </div>
                    <div className="deco-text signup">
                        <h2>SHREE VENKATESHWARA<br/>HI-TECH ENGINEERING<br/>COLLEGE</h2>
                    </div>
                </div>

                {/* ════════════════ SIGN-IN FORM ════════════════ */}
                <div className="form-panel signin" style={isForgot ? { display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '40px', paddingBottom: '40px' } : {}}>
                    <div className="form-inner">
                        {isForgot ? (
                            <>
                                <h2 className="panel-title">Reset password</h2>
                                <p className="panel-sub">
                                    {forgotStep === 1 
                                        ? 'Request admin approval to change password' 
                                        : 'Set a new password for your account'}
                                </p>

                                {forgotError && <div className="auth-error">{forgotError}</div>}
                                {forgotSuccess && <div className="auth-error" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>{forgotSuccess}</div>}

                                {forgotStep === 1 ? (
                                    <form className="auth-form" onSubmit={handleRequestReset} noValidate>
                                        <Field
                                            id="forgot-email"
                                            label="Email address"
                                            type="email"
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                            autoComplete="email"
                                            inputMode="email"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            spellCheck="false"
                                        />
                                        <Field
                                            id="forgot-reg-no"
                                            label="Register Number"
                                            type="text"
                                            value={forgotRegisterNumber}
                                            onChange={e => setForgotRegisterNumber(e.target.value.toUpperCase())}
                                            autoCapitalize="characters"
                                            autoCorrect="off"
                                            spellCheck="false"
                                        />
                                        <button className="submit-button" type="submit" disabled={forgotLoading}>
                                            {forgotLoading ? 'Submitting request…' : 'Submit Reset Request'}
                                        </button>
                                        <div className="switch-link" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                            <a href="#" onClick={(e) => { e.preventDefault(); setForgotStep(2); setForgotError(''); setForgotSuccess(''); }}>Already Approved?</a>
                                            <a href="#" onClick={(e) => { e.preventDefault(); setIsForgot(false); setForgotError(''); setForgotSuccess(''); }}>Back to Login</a>
                                        </div>
                                    </form>
                                ) : (
                                    <form className="auth-form" onSubmit={handleResetPassword} noValidate>
                                        <Field
                                            id="forgot-email-step2"
                                            label="Email address"
                                            type="email"
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                            autoComplete="email"
                                            inputMode="email"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            spellCheck="false"
                                        />
                                        <Field
                                            id="forgot-reg-no-step2"
                                            label="Register Number"
                                            type="text"
                                            value={forgotRegisterNumber}
                                            onChange={e => setForgotRegisterNumber(e.target.value.toUpperCase())}
                                            autoCapitalize="characters"
                                            autoCorrect="off"
                                            spellCheck="false"
                                        />
                                        <Field
                                            id="forgot-new-pw"
                                            label="New Password"
                                            type="password"
                                            value={forgotNewPassword}
                                            onChange={e => setForgotNewPassword(e.target.value)}
                                            showToggle
                                            showPw={showForgotPw}
                                            onToggle={() => setShowForgotPw(v => !v)}
                                            autoComplete="new-password"
                                            autoCorrect="off"
                                            spellCheck="false"
                                        />
                                        <Field
                                            id="forgot-confirm-pw"
                                            label="Confirm New Password"
                                            type="password"
                                            value={forgotConfirmPassword}
                                            onChange={e => setForgotConfirmPassword(e.target.value)}
                                            autoComplete="new-password"
                                            autoCorrect="off"
                                            spellCheck="false"
                                        />
                                        <button className="submit-button" type="submit" disabled={forgotLoading}>
                                            {forgotLoading ? 'Updating password…' : 'Update Password'}
                                        </button>
                                        <div className="switch-link" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                            <a href="#" onClick={(e) => { e.preventDefault(); setForgotStep(1); setForgotError(''); setForgotSuccess(''); }}>Request Reset</a>
                                            <a href="#" onClick={(e) => { e.preventDefault(); setIsForgot(false); setForgotError(''); setForgotSuccess(''); }}>Back to Login</a>
                                        </div>
                                    </form>
                                )}
                            </>
                        ) : (
                            <>
                                <h2 className="panel-title">Welcome back</h2>
                                <p  className="panel-sub">Sign in to your account</p>

                                {loginError && (
                                    <div className="auth-error">{loginError}</div>
                                )}

                                <form className="auth-form" onSubmit={handleLogin} noValidate>
                                    <Field
                                        id="login-username"
                                        label="Username / Email"
                                        type="text"
                                        value={loginUser}
                                        onChange={e => setLoginUser(e.target.value)}
                                        autoComplete="username"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck="false"
                                    />
                                    <Field
                                        id="login-password"
                                        label="Password"
                                        type="password"
                                        value={loginPass}
                                        onChange={e => setLoginPass(e.target.value)}
                                        autoComplete="current-password"
                                        showToggle
                                        showPw={showLoginPw}
                                        onToggle={() => setShowLoginPw(v => !v)}
                                        autoCorrect="off"
                                        spellCheck="false"
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 12 }}>
                                        <a 
                                            href="#" 
                                            onClick={(e) => { e.preventDefault(); setIsForgot(true); setForgotStep(1); setForgotError(''); setForgotSuccess(''); }} 
                                            style={{ color: '#00d4e8', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                                        >
                                            Forgot Password?
                                        </a>
                                    </div>
                                    <button className="submit-button" type="submit" disabled={loginLoading}>
                                        {loginLoading ? 'Signing in…' : 'Sign in'}
                                    </button>
                                    <div className="switch-link">
                                        Don't have an account?{' '}
                                        <a href="#" onClick={goToRegister}>Sign up</a>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>

                {/* ════════════════ SIGN-UP FORM (WITH MOBILE WIZARD) ════════════════ */}
                <div className="form-panel signup" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '40px', paddingBottom: '40px' }}>
                    <div className="form-inner">
                        {!checkingReg && !regOpen ? (
                            <>
                                <h2 className="panel-title" style={{ color: '#f87171' }}>
                                    Registration Closed
                                </h2>
                                <p className="panel-sub" style={{ marginBottom: 24 }}>
                                    The administrator has closed registration.<br/>
                                    Please contact your instructor for access.
                                </p>
                                <button className="submit-button" type="button" onClick={goToLogin}>
                                    Go to Login
                                </button>
                            </>
                        ) : (
                            <>
                                <h2 className="panel-title">Create account</h2>
                                <p  className="panel-sub">Join the SVHEC quiz portal</p>

                                {/* Multi-step progress dots */}
                                <div className="step-progress-container">
                                    <div className={`step-dot ${regStep >= 1 ? 'completed' : ''} ${regStep === 1 ? 'active' : ''}`}>1</div>
                                    <div className={`step-connector ${regStep >= 2 ? 'completed' : ''}`}></div>
                                    <div className={`step-dot ${regStep >= 2 ? 'completed' : ''} ${regStep === 2 ? 'active' : ''}`}>2</div>
                                </div>

                                {regError && (
                                    <div className="auth-error">{regError}</div>
                                )}

                                <form className="auth-form" onSubmit={handleRegister} noValidate>
                                    <AnimatePresence mode="wait">
                                        {regStep === 1 ? (
                                            <motion.div
                                                key="step1"
                                                initial={{ opacity: 0, x: -15 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 15 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <Field
                                                    id="reg-name"
                                                    label="Full name"
                                                    type="text"
                                                    value={regName}
                                                    onChange={e => setRegName(e.target.value)}
                                                    autoComplete="name"
                                                    autoCapitalize="words"
                                                    autoCorrect="off"
                                                    spellCheck="false"
                                                    isValid={nameIsValid}
                                                    validationMessage="Name must be at least 3 characters"
                                                />
                                                <Field
                                                    id="reg-email"
                                                    label="Email address"
                                                    type="email"
                                                    value={regEmail}
                                                    onChange={e => setRegEmail(e.target.value)}
                                                    autoComplete="email"
                                                    inputMode="email"
                                                    autoCapitalize="none"
                                                    autoCorrect="off"
                                                    spellCheck="false"
                                                    isValid={emailIsValid}
                                                    validationMessage="Please enter a valid email address"
                                                />
                                                <Field
                                                    id="reg-password"
                                                    label="Password"
                                                    type="password"
                                                    value={regPass}
                                                    onChange={e => setRegPass(e.target.value)}
                                                    autoComplete="new-password"
                                                    showToggle
                                                    showPw={showRegPw}
                                                    onToggle={() => setShowRegPw(v => !v)}
                                                    autoCorrect="off"
                                                    spellCheck="false"
                                                    isValid={passIsValid}
                                                    validationMessage="Password must be at least 6 characters"
                                                />
                                                
                                                <button 
                                                    className="submit-button" 
                                                    type="button" 
                                                    onClick={handleNextStep}
                                                    style={{ marginTop: 8 }}
                                                >
                                                    Continue ➔
                                                </button>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="step2"
                                                initial={{ opacity: 0, x: 15 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -15 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <Field
                                                    id="reg-register-number"
                                                    label="Register Number"
                                                    type="text"
                                                    value={regRegisterNumber}
                                                    onChange={e => setRegRegisterNumber(e.target.value.toUpperCase())}
                                                    autoCapitalize="characters"
                                                    autoCorrect="off"
                                                    spellCheck="false"
                                                    isValid={regNoIsValid}
                                                    validationMessage="Register number must be at least 5 characters"
                                                />

                                                {/* Segmented Picker for Year */}
                                                <div className="saas-field">
                                                    <label className="saas-label">Academic Year</label>
                                                    <div className="picker-group">
                                                        {academicYears.map(item => (
                                                            <button
                                                                key={item.value}
                                                                type="button"
                                                                className={`picker-btn ${regYear === item.value ? 'active' : ''}`}
                                                                onClick={() => setRegYear(item.value)}
                                                            >
                                                                {item.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Grid Chip Picker for Department */}
                                                <div className="saas-field">
                                                    <label className="saas-label">Department</label>
                                                    <div className="dept-grid">
                                                        {departmentChips.map(item => (
                                                            <button
                                                                key={item.value}
                                                                type="button"
                                                                className={`dept-chip ${regDepartment === item.value ? 'active' : ''}`}
                                                                onClick={() => setRegDepartment(item.value)}
                                                            >
                                                                <span className="dept-chip-title">{item.label}</span>
                                                                <span className="dept-chip-sub" title={item.desc}>{item.desc}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* College Select Toggle */}
                                                <div className="saas-field">
                                                    <label className="saas-label">College</label>
                                                    <div className="college-toggle-group">
                                                        <button
                                                            type="button"
                                                            className={`college-toggle-btn ${regCollege === 'SVHEC' ? 'active' : ''}`}
                                                            onClick={() => { setRegCollege('SVHEC'); setRegOtherCollegeName(''); }}
                                                        >
                                                            SVHEC
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`college-toggle-btn ${regCollege === 'Others' ? 'active' : ''}`}
                                                            onClick={() => setRegCollege('Others')}
                                                        >
                                                            Others
                                                        </button>
                                                    </div>
                                                </div>

                                                {regCollege === 'Others' && (
                                                    <Field
                                                        id="reg-other-college"
                                                        label="College Name"
                                                        type="text"
                                                        value={regOtherCollegeName}
                                                        onChange={e => setRegOtherCollegeName(e.target.value)}
                                                        placeholder="Enter your college name"
                                                        autoCapitalize="words"
                                                        spellCheck="false"
                                                    />
                                                )}

                                                <div className="wizard-actions">
                                                    <button 
                                                        className="btn-prev" 
                                                        type="button" 
                                                        onClick={() => setRegStep(1)}
                                                    >
                                                        Back
                                                    </button>
                                                    <button 
                                                        className="submit-button btn-next" 
                                                        type="submit" 
                                                        disabled={regLoading}
                                                    >
                                                        {regLoading ? 'Creating account…' : 'Register'}
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="switch-link">
                                        Already have an account?{' '}
                                        <a href="#" onClick={goToLogin}>Sign in</a>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>

            </div>

            <div className="auth-footer">
                SVHEC Quiz Portal &nbsp;·&nbsp;{' '}
                <a href="#" target="_blank" rel="noreferrer">SVHEC</a>
            </div>
        </div>
    );
};

export default Auth;
