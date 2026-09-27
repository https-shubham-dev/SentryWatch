import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Activity } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signup(email, password, orgName);
      navigate('/');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resErr = err as { response?: { data?: { error?: { message?: string } } } };
        setError(resErr.response?.data?.error?.message || 'Signup failed. Please try again.');
      } else {
        setError('Network error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm bg-ink-900 border border-ink-700 p-6">
        <div className="flex items-center space-x-2.5 mb-6">
          <div className="w-7 h-7 bg-signal-blue/10 border border-signal-blue/30 flex items-center justify-center text-signal-blue">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-mist-100 leading-none">SentryWatch</h1>
            <p className="text-[11px] text-mist-400 mt-0.5">Developer Observability</p>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-mist-100 mb-4 pb-2 border-b border-ink-700">
          Create Organization & Admin Account
        </h2>

        {error && (
          <div className="mb-4 p-2.5 bg-status-critical/10 border border-status-critical/30 text-status-critical text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-mist-400 mb-1 font-mono">Organization Name</label>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Engineering"
              className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-xs text-mist-100 font-mono focus:outline-none focus:border-signal-blue transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-mist-400 mb-1 font-mono">Admin Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@acme.com"
              className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-xs text-mist-100 font-mono focus:outline-none focus:border-signal-blue transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-mist-400 mb-1 font-mono">Password (min 6 chars)</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-ink-950 border border-ink-700 px-3 py-1.5 text-xs text-mist-100 font-mono focus:outline-none focus:border-signal-blue transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-signal-blue hover:bg-blue-600 text-white font-medium text-xs py-2 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Registering Organization...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-ink-700 text-center">
          <p className="text-xs text-mist-400">
            Already registered?{' '}
            <Link to="/login" className="text-signal-blue hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
