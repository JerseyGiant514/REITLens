import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMSG, setErrorMSG] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMSG(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                // Optionally show a "Check your email" message here depending on Supabase settings
                onClose();
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onClose();
            }
        } catch (error: any) {
            setErrorMSG(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-darkBlue/80 border border-rain/20 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] rounded-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-rain/40 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="mb-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-lightBlue to-darkBlue rounded-lg flex items-center justify-center font-secondary text-xl font-bold text-white shadow-lg border border-white/10 mb-4 mx-auto">
                        RL
                    </div>
                    <h2 className="text-xl font-secondary font-bold text-white text-center uppercase tracking-widest">
                        {isSignUp ? 'Create Authorization' : 'System Uplink'}
                    </h2>
                    <p className="text-center text-[10px] font-bold text-rain uppercase tracking-widest mt-2 opacity-70">
                        {isSignUp ? 'Register to persist portfolios' : 'Identify to synchronize data'}
                    </p>
                </div>

                {errorMSG && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs text-center font-medium">
                        {errorMSG}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[9px] font-bold text-rain uppercase tracking-widest mb-1.5 ml-1">Email Designation</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-black/30 border border-rain/20 rounded px-4 py-2.5 text-sm text-white focus:border-lightBlue focus:outline-none transition-colors"
                            placeholder="user@institution.com"
                        />
                    </div>

                    <div>
                        <label className="block text-[9px] font-bold text-rain uppercase tracking-widest mb-1.5 ml-1">Passcode</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-black/30 border border-rain/20 rounded px-4 py-2.5 text-sm text-white focus:border-lightBlue focus:outline-none transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-6 bg-lightBlue/20 hover:bg-lightBlue/30 border border-lightBlue/40 text-lightBlue py-2.5 rounded font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                    >
                        {isLoading ? 'Processing...' : (isSignUp ? 'Register Identity' : 'Establish Connection')}

                        {/* Glossy overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setErrorMSG(null);
                        }}
                        className="text-[10px] font-bold text-rain/60 hover:text-white uppercase tracking-widest transition-colors"
                    >
                        {isSignUp ? 'Already authenticated? Login' : 'Require access? Register'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
