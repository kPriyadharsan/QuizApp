import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
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

/* ── Reusable field component ───────────────────────────── */
const Field = ({ id, label, type = 'text', value, onChange, autoComplete,
                 showToggle = false, showPw = false, onToggle }) => (
    <div className="saas-field">
        <label className="saas-label" htmlFor={id}>{label}</label>
        <div className="saas-input-wrap">
            <input
                id={id}
                className={`saas-input${showToggle ? ' has-eye' : ''}`}
                type={type === 'password' ? (showPw ? 'text' : 'password') : type}
                value={value}
                onChange={onChange}
                placeholder={label}
                required
                autoComplete={autoComplete}
            />
            {showToggle && (
                <button type="button" className="eye-toggle"
                    onClick={onToggle} tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <IconEyeOpen /> : <IconEyeClosed />}
                </button>
            )}
        </div>
    </div>
);

/* ── Auth component ─────────────────────────────────────── */
const Auth = () => {
    const [isToggled, setIsToggled] = useState(false);

    /* sign-in */
    const [loginUser, setLoginUser]       = useState('');
    const [loginPass, setLoginPass]       = useState('');
    const [showLoginPw, setShowLoginPw]   = useState(false);
    const [loginError, setLoginError]     = useState('');
    const [loginLoading, setLoginLoading] = useState(false);

    /* sign-up */
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

    /* forgot password */
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
        setIsToggled(location.pathname === '/register');
        axios.get(`${import.meta.env.VITE_API_URL}/api/admin/settings`)
            .then(r  => setRegOpen(r.data.registrationOpen))
            .catch(() => setRegOpen(true))
            .finally(() => setCheckingReg(false));
    }, [location.pathname]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        setLoginLoading(true);
        const res = await login(loginUser, loginPass);
        if (!res.success) setLoginError(res.message);
        else navigate('/');
        setLoginLoading(false);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setRegError('');

        if (!regRegisterNumber.trim()) {
            setRegError('Register number is required');
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

    const goToRegister = (e) => { e.preventDefault(); setIsToggled(true);  navigate('/register', { replace: true }); };
    const goToLogin    = (e) => { e.preventDefault(); setIsToggled(false); navigate('/login',    { replace: true }); };

    return (
        <div className="auth-page-container">
            <div className={`auth-wrapper${isToggled ? ' toggled' : ''}`}>

                {/* ── Diagonal teal decoration panel ── */}
                <div className="deco-panel">
                    {/* "WELCOME BACK!" — shown on right when sign-in is active */}
                    <div className="deco-text signin">
                        <h2>WELCOME<br/>BACK!</h2>
                    </div>
                    {/* "SHREE VENKATESHWARA..." — shown on left when sign-up is active */}
                    <div className="deco-text signup">
                        <h2>SHREE VENKATESHWARA<br/>HI-TECH ENGINEERING<br/>COLLEGE</h2>
                    </div>
                </div>

                {/* ════════════════ SIGN-IN FORM ════════════════ */}
                <div className="form-panel signin" style={isForgot ? { display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', overflowY: 'auto', paddingTop: '40px', paddingBottom: '40px' } : {}}>
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
                                        />
                                        <Field
                                            id="forgot-reg-no"
                                            label="Register Number"
                                            type="text"
                                            value={forgotRegisterNumber}
                                            onChange={e => setForgotRegisterNumber(e.target.value)}
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
                                        />
                                        <Field
                                            id="forgot-reg-no-step2"
                                            label="Register Number"
                                            type="text"
                                            value={forgotRegisterNumber}
                                            onChange={e => setForgotRegisterNumber(e.target.value)}
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
                                        />
                                        <Field
                                            id="forgot-confirm-pw"
                                            label="Confirm New Password"
                                            type="password"
                                            value={forgotConfirmPassword}
                                            onChange={e => setForgotConfirmPassword(e.target.value)}
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
                                        label="Username"
                                        type="text"
                                        value={loginUser}
                                        onChange={e => setLoginUser(e.target.value)}
                                        autoComplete="username"
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
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 12 }}>
                                        <a 
                                            href="#" 
                                            onClick={(e) => { e.preventDefault(); setIsForgot(true); setForgotStep(1); setForgotError(''); setForgotSuccess(''); }} 
                                            style={{ color: '#00d4e8', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
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

                {/* ════════════════ SIGN-UP FORM ════════════════ */}
                <div className="form-panel signup" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', overflowY: 'auto', paddingTop: '40px', paddingBottom: '40px' }}>
                    <div className="form-inner">
                        {!checkingReg && !regOpen ? (
                            /* registration closed state */
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
                                <p  className="panel-sub ">Join the SVHEC quiz portal</p>

                                {regError && (
                                    <div className="auth-error">{regError}</div>
                                )}

                                <form className="auth-form" onSubmit={handleRegister} noValidate>
                                    <Field
                                        id="reg-name"
                                        label="Full name"
                                        type="text"
                                        value={regName}
                                        onChange={e => setRegName(e.target.value)}
                                        autoComplete="name"
                                    />
                                    <Field
                                        id="reg-email"
                                        label="Email address"
                                        type="email"
                                        value={regEmail}
                                        onChange={e => setRegEmail(e.target.value)}
                                        autoComplete="email"
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
                                    />
                                    <Field
                                        id="reg-register-number"
                                        label="Register Number"
                                        type="text"
                                        value={regRegisterNumber}
                                        onChange={e => setRegRegisterNumber(e.target.value)}
                                    />

                                    <div className="saas-field">
                                        <label className="saas-label" htmlFor="reg-year">Year</label>
                                        <div className="saas-input-wrap">
                                            <select
                                                id="reg-year"
                                                className="saas-input"
                                                value={regYear}
                                                onChange={e => setRegYear(e.target.value)}
                                                style={{ cursor: 'pointer', appearance: 'auto', WebkitAppearance: 'auto', background: '#1a2235', color: '#ffffff' }}
                                                required
                                            >
                                                <option value="" disabled>Select Year</option>
                                                <option value="I">I Year</option>
                                                <option value="II">II Year</option>
                                                <option value="III">III Year</option>
                                                <option value="IV">IV Year</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="saas-field">
                                        <label className="saas-label" htmlFor="reg-department">Department</label>
                                        <div className="saas-input-wrap">
                                            <select
                                                id="reg-department"
                                                className="saas-input"
                                                value={regDepartment}
                                                onChange={e => setRegDepartment(e.target.value)}
                                                style={{ cursor: 'pointer', appearance: 'auto', WebkitAppearance: 'auto', background: '#1a2235', color: '#ffffff' }}
                                                required
                                            >
                                                <option value="" disabled>Select Department</option>
                                                <option value="ECE">ECE (Electronics & Communication)</option>
                                                <option value="EEE">EEE (Electrical & Electronics)</option>
                                                <option value="CSE">CSE (Computer Science & Eng)</option>
                                                <option value="IT">IT (Information Technology)</option>
                                                <option value="AIDS">AIDS (AI & Data Science)</option>
                                                <option value="BME">BME (Biomedical Engineering)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="saas-field">
                                        <label className="saas-label" htmlFor="reg-college">College</label>
                                        <div className="saas-input-wrap">
                                            <select
                                                id="reg-college"
                                                className="saas-input"
                                                value={regCollege}
                                                onChange={e => setRegCollege(e.target.value)}
                                                style={{ cursor: 'pointer', appearance: 'auto', WebkitAppearance: 'auto', background: '#1a2235', color: '#ffffff' }}
                                                required
                                            >
                                                <option value="SVHEC">SVHEC</option>
                                                <option value="Others">Others</option>
                                            </select>
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
                                        />
                                    )}
                                    <button className="submit-button" type="submit" disabled={regLoading}>
                                        {regLoading ? 'Creating account…' : 'Create account'}
                                    </button>
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
