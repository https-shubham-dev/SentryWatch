import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';

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
        setError('Network error. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create organization"
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="text-signal-blue hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-2.5 border border-status-critical text-status-critical text-[13px] flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="sw-label">Organization name</label>
          <input
            type="text"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Engineering"
            className="sw-input"
            autoComplete="organization"
          />
        </div>

        <div>
          <label className="sw-label">Admin email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@acme.com"
            className="sw-input-mono"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="sw-label">Password</label>
          <input
            type="password"
            required
            minLength={8}
            pattern="(?=.*[A-Za-z])(?=.*\d).{8,}"
            title="At least 8 characters with a letter and a number"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8+ chars, letter + number"
            className="sw-input-mono"
            autoComplete="new-password"
          />
          <p className="mt-1 text-[11px] text-mist-400">Min 8 characters, include a letter and a number.</p>
        </div>

        <button type="submit" disabled={isSubmitting} className="sw-btn-primary w-full mt-1">
          {isSubmitting ? 'Creating organization…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
};
