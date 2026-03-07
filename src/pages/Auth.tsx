import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn, UserPlus, Wifi, WifiOff } from 'lucide-react';

interface AuthPageProps {
  onSkip: () => void;
}

export default function AuthPage({ onSkip }: AuthPageProps) {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else if (isSignUp) {
        toast.success('Account created! Check your email to verify, then log in.');
        setIsSignUp(false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Smart Vyapar Ledger</h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Create an account to sync across devices' : 'Sign in to access your data'}
          </p>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={!isSignUp ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setIsSignUp(false)}
                >
                  <LogIn className="h-3.5 w-3.5 mr-1" /> Login
                </Button>
                <Button
                  type="button"
                  variant={isSignUp ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setIsSignUp(true)}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Sign Up
                </Button>
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                <Wifi className="h-4 w-4 mr-2" />
                {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <button
          onClick={onSkip}
          className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          <WifiOff className="h-4 w-4" />
          Continue offline (local storage only)
        </button>
      </div>
    </div>
  );
}
